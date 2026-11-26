'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/ServicesHighlights.cs (ServicesHighlightsController)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const DAL_Servicehighlights = require('../../lib/portal/DAL_Servicehighlights');
const ps = require('./_shared/portal-session');
const { toDbl, boolStr, csReplace } = require('./_shared/batch-08-common');

const router = express.Router();
const DB = 'shopping';
const P = '/portal/ServicesHighlights';
const GETALLRECORDSOLD = ['ppid', 'productname'];

const isPgError = (e) => !!(e && e.code !== undefined && e.severity !== undefined);

// public static List<GetAllRecords> GETSUGGEDATA(string pmidParam) - not an action
async function GETSUGGEDATA(pmidParam) {
  let PMID = 0;
  if (pmidParam != null && pmidParam !== '') PMID = toDbl(pmidParam);
  let collectionofcatid = '';
  const obj = new DAL_Servicehighlights();
  const CATID = await db.queryOne(DB, 'select catid from portal_master where pmid = @pmid limit 1', { pmid: PMID });
  if (CATID != null) collectionofcatid = CATID.catid;
  return obj.GetAllSuggestedServices(collectionofcatid);
}

// public static List<GetAllRecordsOld> getSuggedataOldData(string pmidParam) - not an action
async function getSuggedataOldData(pmidParam) {
  let pmid = 0;
  if (pmidParam != null && pmidParam !== '') pmid = toDbl(pmidParam);
  const rows = await db.query(DB, 'select ppid, productname, pmid from portal_product_desc where active::int = 1 and pmid = @pmid order by srno', { pmid });
  return mapRows(rows, GETALLRECORDSOLD);
}

// auth (Session["Plid"] == null -> RedirectToAction("Index","Home"))
// route-config: merchant/serviceshighlights -> ServicesHighlights/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/serviceshighlights'], ps.customerAuth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const out = { view: '~/Views/CustomerPanel/ServicesHighlights/Index.cshtml' };
  const pmid = await db.queryOne(DB, 'select pmid from portal_login where plid = @plid limit 1', { plid: Plid });
  if (pmid != null) {
    const encriptpmid = pmid.pmid === null || pmid.pmid === undefined ? '' : String(pmid.pmid);
    out.pmid = encriptpmid;
    out.SuggestedService = await GETSUGGEDATA(encriptpmid);
    out.SelectedService = await getSuggedataOldData(encriptpmid);
  }
  res.json(out);
}));

// auth (legacy had no session check; writes the merchant's services by pmidParam)
router.all(`${P}/ProductNameEntry{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  let Productname = req.p.Productname;
  const pmidParam = req.p.pmidParam;
  let pmid = 0;
  let returnvalue = '';
  if (pmidParam != null && pmidParam !== '') pmid = toDbl(pmidParam);
  if (pmid <= 0) returnvalue = 'expired'; // legacy does not return here
  Productname = csReplace(Productname.toString(), '~', "'");
  Productname = csReplace(Productname, '’', "'");
  Productname = csReplace(Productname, "'", "''");
  Productname = csReplace(Productname, '`', ' ');
  const splitdate = Productname.split('^');
  let portal_product_descActive = '';
  const getSerOrsuggest = splitdate[0];
  if (splitdate.length < 2) throw new RangeError('Index was outside the bounds of the array.');
  Productname = splitdate[1];
  // The concatenated legacy SQL turned the doubled quote ('') back into one quote in the stored value; the LINQ lookup
  // and the proc parameter used the doubled value as-is.
  const lit = csReplace(Productname, "''", "'");
  let checkDuplicate = 0;
  let srno = 0;
  try {
    const suggestServiceStatus = await db.queryOne(DB, 'select active from portal_product_desc where productname = @pn and pmid = @pmid limit 1', { pn: Productname, pmid });
    if (suggestServiceStatus != null) {
      checkDuplicate = 1;
      portal_product_descActive = boolStr(suggestServiceStatus.active);
    } else {
      checkDuplicate = 0;
    }
    if (checkDuplicate === 0) {
      let SEMID = Number(await db.scalar(DB, 'select semid from tbl_servicesmaster where status::int = 1 and service_name = @sn limit 1', { sn: lit })) || 0;
      if (SEMID === 0) SEMID = 1;
      const Status = Number(await db.scalar(DB, 'select coalesce(max(coalesce(srno, 0) + 1), 1) as srno from portal_product_desc where active::int = 1 and pmid = @pmid', { pmid })) || 0;
      if (suggestServiceStatus != null) {
        let strisr = String(Status).trim();
        if (strisr.trim() === '') strisr = '0';
        srno = parseInt(strisr, 10) + 1;
      } else {
        srno = Status;
      }
      await db.exec(DB, "insert into portal_product_desc (productname, productdesc, active, pmid, productimgname, srno, semid) values (@pn, @pn, '1', @pmid, '', @srno, @semid)",
        { pn: lit, pmid, srno, semid: SEMID });
      if (getSerOrsuggest.trim() === '2') {
        await db.proc(DB, 'insertupdateownsugestion', { pmid, getnewservices: Productname, mode: '0' });
        returnvalue = 'Services/Highlights inserted successfully';
      } else {
        returnvalue = 'Services/Highlights inserted successfully';
      }
    } else if (portal_product_descActive.toLowerCase() === 'false') {
      await db.exec(DB, "update portal_product_desc set active = '1' where pmid = @pmid and productname = @pn", { pmid, pn: lit });
      if (getSerOrsuggest.trim() === '2') {
        await db.proc(DB, 'insertupdateownsugestion', { pmid, getnewservices: Productname, mode: '0' });
        returnvalue = 'Services/Highlights inserted successfully';
      } else {
        returnvalue = 'Services/Highlights inserted successfully';
      }
    } else {
      returnvalue = 'This Services/Highlights already exists';
    }
  } catch (ex) {
    if (isPgError(ex)) returnvalue = 'You have done something wrong'; // catch (SqlException) only
    else throw ex;
  }
  res.json(returnvalue);
}));

// auth (legacy had no session check)
router.all(`${P}/productUpdate{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const { oldValues, newValues, pmidParam } = req.p;
  let pmid = 0;
  let returnValues = '';
  if (pmidParam != null && pmidParam !== '') pmid = toDbl(pmidParam);
  if (pmid <= 0) {
    returnValues = 'expired';
    return res.json(returnValues);
  }
  try {
    const affectedRows = await db.exec(DB, 'update portal_product_desc set productname = @productname1, productdesc = @productname2 where productname = @productname and pmid = @pmid::numeric', {
      productname1: newValues === undefined ? null : newValues, productname2: newValues === undefined ? null : newValues,
      productname: oldValues === undefined ? null : oldValues, pmid: String(pmid),
    });
    if (affectedRows > 0) returnValues = 'Services/Highlights Updated successfully';
    else returnValues = 'Try Again';
  } catch (ex) {
    returnValues = 'Please Try Again';
  }
  return res.json(returnValues);
}));

// auth (legacy had no session check)
router.all(`${P}/ProductNameDelete{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  let Productname = req.p.Productname;
  const pmidParam = req.p.pmidParam;
  let pmid = 0;
  if (pmidParam != null && pmidParam !== '') pmid = toDbl(pmidParam);
  if (pmid <= 0) return res.json('expired');
  Productname = csReplace(Productname.toString(), '’', "'");
  Productname = csReplace(Productname, '~', "'");
  Productname = csReplace(Productname, '`', ' ');
  Productname = csReplace(Productname, "'", '');
  let returnvalue = '';
  try {
    // PORT-NOTE: ExecuteSqlCommand returned the rows affected inside the proc; the PG function is expected to return
    // them as column "affectedrows" (fallback: number of rows returned).
    const rows = await db.proc(DB, 'insertupdateownsugestion', { pmid, getnewservices: Productname, mode: 1 });
    const r0 = rows && rows[0];
    const affectedRows = r0 && r0.affectedrows !== undefined ? Number(r0.affectedrows) : (rows ? rows.length : 0);
    if (affectedRows > 0) returnvalue = 'Services/Highlights Deleted successfully';
    else returnvalue = 'Try Again';
  } catch (ex) {
    returnvalue = 'Try Again';
  }
  return res.json(returnvalue);
}));

module.exports = router;
