'use strict';
/** Port of Franchise/Controllers/CustomerPanel/ReleasedBV.cs. DB: 'shopping' */
const express = require('express');
const axios = require('axios');
const { query, queryOne, scalar, exec, proc, procOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const CompanySettings = require('../../lib/franchise/CompanySettings');
const GetIP = require('../../lib/franchise/GetIP');

const router = express.Router();
const DB = 'shopping';
const s = (v) => (v === null || v === undefined ? '' : String(v));
function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k !== undefined) return row[k];
  const f = Object.keys(row)[0];
  return f === undefined ? null : row[f];
}

// auth
// route-config: franchisee/Released-BV
router.all(['/franchise/ReleasedBV/Index{/:id}', '/franchise/franchisee/Released-BV'], auth, asyncHandler(async (req, res) => {
  const Pmid = Number(req.user.pmid);
  const PLID = parseInt(req.user.did, 10);
  const v = await scalar(DB, 'SELECT coalesce(CAST(bvrate AS DECIMAL(18,2)),0) AS bvrate FROM tbl_companysettings WHERE pmid=@pmid LIMIT 1', { pmid: Pmid });
  const BVRate = v === null || v === undefined ? 0 : v;
  const rows = await proc(DB, 'usp_wallet_statement_dashboard', { pmid: 0, did: PLID, mode: 4 });
  const resellercomm = mapRows(rows, ['HoldCommission', 'PendingCommission', 'ReleaseCommission', 'TotalCommission']);
  res.json({ ViewBag: { BVRate, resellercomm } });
}));

// auth
router.all('/franchise/ReleasedBV/SaveBV{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let Ret = '0';
  let fromDate = p.fromDate, toDate = p.toDate;
  const memberid = p.memberid, orderid = p.orderid, LOGINID = p.LOGINID;
  if (fromDate === '' || fromDate == null) fromDate = '';
  if (toDate === '' || toDate == null) toDate = '';
  const PLID = parseInt(req.user.did, 10);
  const Mobile = await scalar(DB, 'select phone from tbl_distributor where did=@did LIMIT 1', { did: PLID });
  const url = 'http://apishop.mlmkabila.com/api/ReleasedBV';
  const OBjSendReceive = { FROMDATE: fromDate, TODATE: toDate, MEMBERID: memberid, ORDERID: orderid, DID: String(PLID), Orderno: null, Amount: 0, BV: 0, OrderDate: null, UserName: null };
  const StrPostData = JSON.stringify(OBjSendReceive);
  const resp = await axios.post(url, StrPostData, { headers: { 'Content-Type': 'application/json' }, transformResponse: (r) => r });
  const Return = String(resp.data);
  const ObjProductDetails = JSON.parse(Return);
  const Flag = s(ObjProductDetails.Flag);
  if (Flag === 'success') {
    const Details = typeof ObjProductDetails.Details === 'string' ? ObjProductDetails.Details : JSON.stringify(ObjProductDetails.Details);
    const obj = typeof ObjProductDetails.Details === 'string' ? JSON.parse(ObjProductDetails.Details) : ObjProductDetails.Details;
    if (Details !== '[]') {
      Ret = '1';
      let SPOUT = '';
      try {
        const ip_address = await GetIP.GetLocalIP();
        const Batchid = s(obj[0].BatchID);
        const row = await procOne(DB, 'usp_releasedbv_updatestatus', {
          fromdate: fromDate, todate: toDate, memberid, orderid, loginid: LOGINID, batchid: Batchid, ip_address: s(ip_address), did: PLID,
        });
        SPOUT = s(outVal(row, 'spout'));
      } catch (ex) {
        Ret = 'error';
      }
      try {
        // background thread in C#
        Promise.resolve(UtilityClass.SendMsgOnMobile(Mobile, 'Dear Reseller \r\n Your BV Released Successfully  from ' + fromDate + ' to ' + toDate + ' .\r\n  ' + CompanySettings.CompanyName + ' Team')).catch(() => {});
      } catch (e) { /* ignore */ }
      if (SPOUT === 'success') Ret = '1';
      else if (SPOUT === 'error') Ret = 'error';
      else Ret = '0';
    } else {
      Ret = '0';
    }
  } else {
    Ret = s(ObjProductDetails.Message);
  }
  res.json(Ret);
}));

// auth
router.all('/franchise/ReleasedBV/UpdateBV{/:id}', auth, asyncHandler(async (req, res) => {
  let Ret = '0';
  const BVrate = Number(req.p.BVrate);
  if (BVrate <= 0) {
    Ret = 'BVRate should be greater then Zero(0).';
    return res.json(Ret);
  }
  const Pmid = Number(req.user.pmid);
  const val = await exec(DB, 'update tbl_companysettings set bvrate=@bv where pmid=@pmid', { bv: BVrate, pmid: Pmid });
  Ret = String(val);
  return res.json(Ret);
}));

module.exports = router;
