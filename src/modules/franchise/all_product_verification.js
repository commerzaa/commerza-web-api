'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/all_product_verification.cs (all_product_verificationController)
 * Prefix: /franchise   DB: Franchise DataBaseContext points at Db_Shopping => 'shopping'
 * PORT-NOTE: legacy guarded Index with Session["Admin_User"] (redirect to adminlogin); here the franchise JWT (auth) is required.
 */
const express = require('express');
const { query, queryOne, procOne, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const CompanySettings = require('../../lib/franchise/CompanySettings');
const Payment_Mode = require('../../lib/franchise/Payment_Mode');

const router = express.Router();
const DB = 'shopping';
const C = 'all_product_verification';

// ---- helpers -------------------------------------------------------------------------------------------
const s = (v) => (v === null || v === undefined ? '' : String(v));
const pad = (n, l = 2) => String(n).padStart(l, '0');
function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k !== undefined) return row[k];
  const first = Object.keys(row)[0];
  return first === undefined ? null : row[first];
}
/** DateTime.Now.ToString("ddMMyyyyhhmmss") */
function nowStamp() {
  const d = new Date();
  const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return pad(d.getDate()) + pad(d.getMonth() + 1) + d.getFullYear() + pad(h12) + pad(d.getMinutes()) + pad(d.getSeconds());
}
const totalOf = (rows) => (rows.length ? Number(rows[0].totalcount || 0) : 0);
const tabClean = (v) => s(v).replace(/\t/g, '    ');
const ensureDir = (d) => { fs.mkdirSync(d, { recursive: true }); return d; };
const xmlEsc = (v) => s(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
/** DataSet.GetXml() equivalent for one table */
function getXml(ds) {
  let x = '<NewDataSet>';
  for (const name of Object.keys(ds)) {
    for (const r of ds[name]) {
      x += `<${name}>`;
      for (const k of Object.keys(r)) if (r[k] !== null && r[k] !== undefined) x += `<${k}>${xmlEsc(r[k] instanceof Date ? r[k].toISOString() : r[k])}</${k}>`;
      x += `</${name}>`;
    }
  }
  return x + '</NewDataSet>';
}


const LIST_PROPS = ['ROWNUMBER', 'MPRID', 'PRODUCTCODE', 'SUBPRCODE', 'PRODUCTTITLE', 'MAINCATNAME', 'QTY', 'PRODUCTIMAGES', 'SELLMRP', 'DAP', 'SPRID', 'ISACTIVE',
  'PROCUREMENTSLA', 'REPLACEMENTDAY', 'SHIPPINGCHARGES', 'CASHONDELIVERY', 'WEIGHT_KG', 'LENGTH_CMS', 'BREADTH_CMS', 'HEIGHT_CMS', 'MVAT', 'DEALSIDS', 'STOCKINQTY',
  'STOCKOUTQTY', 'STOCKNETQTY', 'ISSTOCK', 'VATTITLE', 'PRODUCTCOUNT', 'ISVERIFIED'];

// ---- Index ---------------------------------------------------------------------------------------------
const indexHandler = asyncHandler(async (req, res) => {
  let { SearchField, SearchValue, fromDate, toDate, WalletType, page, type } = req.p;
  const ViewBag = {};
  ViewBag.PayList = await Payment_Mode.PayModeList();
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  if (type == null) type = '';
  const MaxRows = 100;
  if (page == null || page === '') page = 1;
  page = parseInt(page, 10);
  const rows = await proc(DB, 'usp_getall_productlist_admin', {
    startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue, mode: 1, id: type,
  });
  // PORT-NOTE: @TOTALCOUNT OUT is read from the "totalcount" column of the first result row (0 when no rows)
  const TotalRecord = totalOf(rows);
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.WalletType = WalletType === undefined ? null : WalletType;
  ViewBag.ddlcustpage = MaxRows;
  ViewBag.Rate = 1;
  res.json({ Model: mapRows(rows, LIST_PROPS), ViewBag });
});
// auth
router.all([`/franchise/${C}/Index{/:id}`, `/franchise/${C}`], auth, indexHandler);

// ---- ChangeWithdrawalStatus (public string => action) ------------------------------------------------
async function ChangeWithdrawalStatus(MRPID, Mode, Remark) {
  const o = await procOne(DB, 'usp_getall_productlist_admin', {
    startrowindex: 1, maxrows: 100, searchfield: '', searchvalue: '', mode: Mode, id: MRPID, remark: Remark,
  });
  const returnvals = s(outVal(o, 'intresult'));
  if (parseInt(returnvals, 10) === 2) {
    if (Remark !== '') {
      const M = await queryOne(DB, 'select branchid,producttitle from ims_masterproduct where mprid=@mprid', { mprid: String(MRPID) });
      const P = await queryOne(DB, 'select emailid,fname,lname from portal_login where plid=@plid', { plid: String(M.branchid) });
      const Emailid = P.emailid;
      const Name = P.fname + ' ' + P.lname;
      const subject = 'Order Refuse';
      const myString = 'Dear ' + Name + ',<br/> Thank you for being a part of ' + CompanySettings.CompanyName + '.<br/> This email is to notify you that we have rejected the listed below product.<br/>' + M.producttitle + ' (' + Remark + ') Regards Admin';
      // legacy: background Thread
      Promise.resolve(UtilityClass.Send('', Emailid, '', '', subject, myString)).catch(() => {});
    } else {
      const M = await queryOne(DB, 'select branchid,producttitle from ims_masterproduct_temp where mprid=@mprid', { mprid: String(MRPID) });
      const P = await queryOne(DB, 'select emailid,fname,lname from portal_login where plid=@plid', { plid: String(M.branchid) });
      const Emailid = P.emailid;
      const Name = P.fname + ' ' + P.lname;
      const subject = 'Confirm Order';
      const myString = 'Dear ' + Name + ',<br/> Thank you for choosing ' + CompanySettings.CompanyName + '<br/> We are glad to inform you that are your product' + M.producttitle + 'has been approved by our team.<br/> Regards Admin';
      Promise.resolve(UtilityClass.Send('', Emailid, '', '', subject, myString)).catch(() => {});
    }
  }
  return returnvals;
}
// auth
router.all(`/franchise/${C}/ChangeWithdrawalStatus{/:id}`, auth, asyncHandler(async (req, res) => {
  const ret = await ChangeWithdrawalStatus(Number(req.p.MRPID), s(req.p.Mode), s(req.p.Remark));
  // legacy: public string action => ContentResult
  res.type('text/plain').send(ret);
}));

// ---- bulkWithdrawalConfirm / bulkverifyreject --------------------------------------------------------
async function bulkWithdrawalConfirm(list, Mode, Remark) {
  for (const Item of list || []) {
    const MRPID = Number(pget(Item, 'MPRID'));
    await ChangeWithdrawalStatus(MRPID, Mode, Remark);
  }
}
function pget(o, name) {
  if (!o) return undefined;
  const k = Object.keys(o).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? undefined : o[k];
}
// auth
router.all(`/franchise/${C}/bulkWithdrawalConfirm{/:id}`, auth, asyncHandler(async (req, res) => {
  const list = pget(req.body, 'list') || [];
  await bulkWithdrawalConfirm(list, s(req.p.Mode), s(req.p.Remark));
  res.json('');
}));
// auth
router.all(`/franchise/${C}/bulkverifyreject{/:id}`, auth, asyncHandler(async (req, res) => {
  const things = Array.isArray(req.body) ? req.body : (pget(req.body, 'things') || []);
  const Mode = s(pget(things[0], 'Mode')); // Convert.ToString(null) == ""
  const Remark = s(pget(things[0], 'Remark'));
  await bulkWithdrawalConfirm(pget(things[0], 'CartList'), Mode, Remark);
  res.json('');
}));

// ---- ObjectserchTitle / ObjectserchSub ---------------------------------------------------------------
// auth
router.all(`/franchise/${C}/ObjectserchTitle{/:id}`, auth, asyncHandler(async (req, res) => {
  await UtilityClass.GridPageSize();
  const rows = await query(DB, "select mprid, producttitle from ims_masterproduct where producttitle like '%' || @sv || '%'", { sv: s(req.p.SearchValue) });
  res.json(mapRows(rows, LIST_PROPS));
}));
// auth
router.all(`/franchise/${C}/ObjectserchSub{/:id}`, auth, asyncHandler(async (req, res) => {
  await UtilityClass.GridPageSize();
  const rows = await query(DB, "select maincatid, maincatname from tbl_main_category where maincatname like '%' || @sv || '%'", { sv: s(req.p.SearchValue) });
  res.json(mapRows(rows, LIST_PROPS));
}));

module.exports = router;
