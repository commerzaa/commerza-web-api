'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/Bv_Distribute.cs (Bv_DistributeController)
 * Prefix: /franchise   DB: Franchise DataBaseContext points at Db_Shopping => 'shopping'
 */
const express = require('express');
const os = require('os');
const dns = require('dns').promises;
const axios = require('axios');
const { proc, procOne, exec, scalar } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const GetIP = require('../../lib/franchise/GetIP');

const router = express.Router();
const DB = 'shopping';
const NRE = () => new TypeError('Object reference not set to an instance of an object.');

const BV_PROPS = ['ROWNUMBER', 'CHID', 'FILENAME', 'DATE', 'CLUBGROUP', 'TOTALREQUEST', 'TOTALAMOUNT', 'PROCESSDATE', 'PROCESSBY', 'PROCESSSTATUS',
  'PROCESSIPADDRESS', 'DateRanage'];
const BVD_PROPS = ['ROWNUMBER', 'Username', 'Amount', 'OrderID', 'BV', 'PV', 'TransactionID', 'OrderStatus', 'OrderDate', 'ConformationDate', 'COMDID'];
const nn = (v) => (v === undefined || v === null ? '' : String(v));
function totalOf(rows, name) {
  const f = rows && rows[0];
  if (!f) return 0;
  const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase());
  const n = k === undefined ? NaN : parseInt(f[k], 10);
  return Number.isNaN(n) ? 0 : n;
}
function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k !== undefined) return row[k];
  const first = Object.keys(row)[0];
  return first === undefined ? null : row[first];
}

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: franchisee/Bv-Distribute
// auth (legacy cast Session["Plid"] without a null check)
router.all(['/franchise/Bv_Distribute/Index{/:id}', '/franchise/franchisee/Bv-Distribute'], auth, asyncHandler(async (req, res) => {
  const fromDate = nn(req.p.fromDate);
  const toDate = nn(req.p.toDate);
  let page = parseInt(req.p.page, 10);
  const DID = Number(req.user.did);
  const MaxRows = await UtilityClass.GridPageSize();
  if (Number.isNaN(page)) page = 1;
  // PORT-NOTE: @TOTALRECORD OUT is read from the first result row (column "totalrecord"); 0 when no rows.
  const rows = await proc(DB, 'usp_bv_reseller_clubhistory_list', { startrowindex: page, maxrows: MaxRows, fromdate: fromDate, todate: toDate, did: DID });
  const _Bv_Distribute = mapRows(rows, BV_PROPS);
  const TotalRecord = totalOf(rows, 'totalrecord');
  const ViewBag = { CurrentPage: page, GridPageSize: MaxRows, fromDate, toDate, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage() };
  return res.json({ view: '~/Views/Bv_Distribute/Index.cshtml', Model: _Bv_Distribute, ViewBag });
}));

// ---- cancel --------------------------------------------------------------------------------------------
// auth
router.all('/franchise/Bv_Distribute/cancel{/:id}', auth, asyncHandler(async (req, res) => {
  const GROUPNO = req.p.GROUPNO;
  let str = '';
  try {
    let IpAddress = '';
    const addr = await dns.lookup(os.hostname(), { all: true });
    if (addr.length > 1) IpAddress = addr[1].address;
    const Empid = req.user.did;
    const r = await procOne(DB, 'usp_bv_reseller_update', { groupnumber: GROUPNO, processby: Empid, processipaddress: IpAddress, mode: 2 });
    const v = outVal(r, 'strresult');
    if (v === null || v === undefined) throw NRE();
    str = String(v);
    if (str === '1') str = 'success';
  } catch (ex) {
    return res.json('error');
  }
  return res.json(str);
}));

// ---- ProceedBV -----------------------------------------------------------------------------------------
// auth
router.all('/franchise/Bv_Distribute/ProceedBV{/:id}', auth, asyncHandler(async (req, res) => {
  const GROUPNO = req.p.GROUPNO;
  let result = '';
  const DID = Number(req.user.did);
  const _DistributeBvDetails = mapRows(await proc(DB, 'usp_distributebvdetails', { groupname: GROUPNO }), BVD_PROPS);
  const v = await scalar(DB, "Select coalesce(apiurl,'') from tbl_companysettings where pmid = @pmid LIMIT 1", { pmid: DID });
  const APiURl = v === undefined ? null : v;
  const url = (APiURl === null ? '' : APiURl) + 'api/UserBussinessDetails';
  const OBjSendReceive = { ROWNUMBER: 0, Username: null, Amount: 0, OrderID: null, BV: 0, PV: 0, TransactionID: null, OrderStatus: null, OrderDate: null, ConformationDate: null, COMDID: 0 };
  for (const Item of _DistributeBvDetails) {
    OBjSendReceive.Username = Item.Username;
    OBjSendReceive.Amount = Item.Amount;
    OBjSendReceive.OrderID = Item.OrderID;
    OBjSendReceive.BV = Item.BV;
    OBjSendReceive.PV = Item.PV;
    OBjSendReceive.TransactionID = Item.TransactionID;
    OBjSendReceive.OrderStatus = Item.OrderStatus;
    OBjSendReceive.OrderDate = Item.OrderDate;
    OBjSendReceive.ConformationDate = Item.ConformationDate;
    const StrPostData = JSON.stringify(OBjSendReceive);
    const resp = await axios.post(url, StrPostData, {
      headers: { 'Content-Type': 'application/json' }, responseType: 'text', transformResponse: (d) => d, timeout: 100000,
    });
    const ObjProductDetails = JSON.parse(resp.data);
    if (ObjProductDetails.Flag === undefined || ObjProductDetails.Flag === null) throw NRE();
    const Flag = String(ObjProductDetails.Flag);
    if (Flag === 'success') {
      try {
        const ip_address = await GetIP.GetLocalIP(req);
        await proc(DB, 'usp_bv_distributed', { mode: 1, comdid: Item.COMDID, status: 1, groupno: GROUPNO });
        result = 'success';
      } catch (ex) {
        result = 'error';
      }
    } else {
      await proc(DB, 'usp_bv_distributed', { mode: 2, comdid: Item.COMDID, status: 2, groupno: GROUPNO });
      if (ObjProductDetails.Message === undefined || ObjProductDetails.Message === null) throw NRE();
      result = String(ObjProductDetails.Message);
    }
  }
  return res.json(result);
}));

module.exports = router;
