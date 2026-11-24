'use strict';
// Ported from Franchise\Controllers\CustomerPanel\ServicesHighlights.cs  (database: shopping — Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const DAL_Servicehighlights = require('../../lib/franchise/DAL_Servicehighlights');

const router = express.Router();
const P = '/franchise/ServicesHighlights';

const GETALLRECORDS = ['RowNumber', 'semid', 'catid', 'service_name'];
const GETALLRECORDSOLD = ['ppid', 'productname'];
const str = (v) => (v === undefined || v === null ? '' : String(v));
const dbl = (s) => (s !== undefined && s !== null && s !== '' ? Number(s) : 0); // Convert.ToDouble
const OUTV = (r, n) => (r ? (n.toLowerCase() in r ? r[n.toLowerCase()] : r[Object.keys(r)[0]]) : null);

// public static in legacy (not an MVC action)
async function GETSUGGEDATA(pmidParam) {
  const PMID = dbl(pmidParam);
  let collectionofcatid = '';
  const obj = new DAL_Servicehighlights();
  const CATID = await db.queryOne('shopping', 'select catid from distributor_master where pmid = @pmid limit 1', { pmid: PMID });
  if (CATID != null) collectionofcatid = CATID.catid;
  return await obj.GetAllSuggestedServices(collectionofcatid);
}

async function getSuggedataOldData(pmidParam) {
  const pmid = dbl(pmidParam);
  const rows = await db.query('shopping', 'select ppid,productname,pmid from portal_product_desc where active::int=1 and pmid=@pmid order by srno', { pmid });
  return mapRows(rows, GETALLRECORDSOLD);
}

// auth
router.all(P + '/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.did);
  const vb = {};
  const pmid = await db.queryOne('shopping', 'select pmid from tbl_distributor where did = @did limit 1', { did: Plid });
  if (pmid != null) {
    const encriptpmid = String(pmid.pmid);
    vb.pmid = encriptpmid;
    vb.SuggestedService = await GETSUGGEDATA(encriptpmid);
    vb.SelectedService = await getSuggedataOldData(encriptpmid);
  }
  res.json(vb);
}));

// auth
router.all(P + '/ProductNameEntry{/:id}', auth, asyncHandler(async (req, res) => {
  let Productname = req.p.Productname;
  const pmidParam = req.p.pmidParam;
  let pmid = 0;
  let returnvalue = '';
  if (pmidParam != null && pmidParam !== '') pmid = dbl(pmidParam);
  if (pmid <= 0) returnvalue = 'expired';
  Productname = Productname.split('~').join("'");
  Productname = Productname.split('\u2019').join("'");
  Productname = Productname.split("'").join("''");
  Productname = Productname.split('`').join(' ');
  const splitdate = Productname.split('^');
  let portal_product_descActive = '';
  const getSerOrsuggest = splitdate[0];
  if (splitdate.length < 2) throw new RangeError('Index was outside the bounds of the array.');
  Productname = splitdate[1];
  // Legacy built these statements by string concatenation, so the doubled quotes ('') reached the database as a single quote;
  // the LINQ lookup and the stored-procedure parameters used the doubled value as-is.
  const lit = Productname.split("''").join("'");
  let checkDuplicate = 0;
  let srno = 0;
  try {
    const suggestServiceStatus = await db.queryOne('shopping', 'select active from portal_product_desc where productname = @pn and pmid = @pmid limit 1', { pn: Productname, pmid });
    if (suggestServiceStatus != null) {
      checkDuplicate = 1;
      // bool.ToString() => "True"/"False"
      const a = suggestServiceStatus.active;
      portal_product_descActive = (a === true || a === 1 || a === '1') ? 'True' : 'False';
    } else {
      checkDuplicate = 0;
    }
    if (checkDuplicate === 0) {
      let SEMID = Number(await db.scalar('shopping', 'select semid from tbl_servicesmaster where status::int=1 and service_name=@sn limit 1', { sn: lit })) || 0;
      if (SEMID === 0) SEMID = 1;
      const Status = Number(await db.scalar('shopping', 'select coalesce(max(coalesce(srno,0)+1),1) as srno from portal_product_desc where active::int=1 and pmid=@pmid', { pmid })) || 0;
      if (suggestServiceStatus != null) {
        let strisr = String(Status).trim();
        if (strisr.trim() === '') strisr = '0';
        srno = parseInt(strisr, 10) + 1;
      } else {
        srno = Status;
      }
      await db.exec('shopping', "insert into portal_product_desc (productname,productdesc,active,pmid,productimgname,srno,semid) values (@pn,@pn,'1',@pmid,'',@srno,@semid)", { pn: lit, pmid, srno, semid: SEMID });
      if (getSerOrsuggest.trim() === '2') {
        await db.procOne('shopping', 'insertupdateownsugestion', { pmid, getnewservices: Productname, mode: '0' });
        returnvalue = 'Services/Highlights inserted successfully';
      } else {
        returnvalue = 'Services/Highlights inserted successfully';
      }
    } else {
      if (portal_product_descActive.toLowerCase() === 'false') {
        await db.exec('shopping', 'update portal_product_desc set active=true where pmid=@pmid and productname=@pn', { pmid, pn: lit });
        if (getSerOrsuggest.trim() === '2') {
          await db.procOne('shopping', 'insertupdateownsugestion', { pmid, getnewservices: Productname, mode: '0' });
          returnvalue = 'Services/Highlights inserted successfully';
        } else {
          returnvalue = 'Services/Highlights inserted successfully';
        }
      } else {
        returnvalue = 'This Services/Highlights already exists';
      }
    }
  } catch (ex) {
    // catch (SqlException) only
    if (ex && ex.code !== undefined && ex.severity !== undefined) returnvalue = 'You have done something wrong';
    else throw ex;
  }
  res.json(returnvalue);
}));

// auth
router.all(P + '/productUpdate{/:id}', auth, asyncHandler(async (req, res) => {
  const { oldValues, newValues, pmidParam } = req.p;
  let pmid = 0;
  let returnValues = '';
  if (pmidParam != null && pmidParam !== '') pmid = dbl(pmidParam);
  if (pmid <= 0) return res.json('expired');
  try {
    const affectedRows = await db.exec('shopping', 'update PORTAL_PRODUCT_DESC set productname =@productname1,ProductDesc=@productname2 where productname=@productname and pmid=@pmid', {
      productname1: newValues, productname2: newValues, productname: oldValues, pmid: String(pmid),
    });
    if (affectedRows > 0) returnValues = 'Services/Highlights Updated successfully';
    else returnValues = 'Try Again';
  } catch (ex) {
    returnValues = 'Please Try Again';
  }
  res.json(returnValues);
}));

// auth
router.all(P + '/ProductNameDelete{/:id}', auth, asyncHandler(async (req, res) => {
  let Productname = req.p.Productname;
  const pmidParam = req.p.pmidParam;
  let pmid = 0;
  if (pmidParam != null && pmidParam !== '') pmid = dbl(pmidParam);
  if (pmid <= 0) return res.json('expired');
  Productname = Productname.split('\u2019').join("'");
  Productname = Productname.split('~').join("'");
  Productname = Productname.split('`').join(' ');
  Productname = Productname.split("'").join('');
  let returnvalue = '';
  try {
    // ExecuteSqlCommand on a procedure returns the affected-row count (-1 when SET NOCOUNT ON); here: rows returned by the call
    const rows = await db.proc('shopping', 'insertupdateownsugestion', { pmid, getnewservices: Productname, mode: 1 });
    const affectedRows = rows ? rows.length : 0;
    if (affectedRows > 0) returnvalue = 'Services/Highlights Deleted successfully';
    else returnvalue = 'Try Again';
  } catch (ex) {
    returnvalue = 'Try Again';
  }
  res.json(returnvalue);
}));

module.exports = router;
