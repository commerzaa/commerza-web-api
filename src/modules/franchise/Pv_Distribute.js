'use strict';
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row (0 when absent).
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : 0);
const s = (v) => (v === undefined || v === null ? '' : String(v));
const pg = (v) => { const n = parseInt(v, 10); return Number.isNaN(n) ? 1 : n; };
const axios = require('axios');
const os = require('os');
const GetIP = require('../../lib/franchise/GetIP');
// Port of Franchise\Controllers\CustomerPanel\Pv_Distribute.cs (3 actions)
// route-config: franchisee/Pv-Distribute -> Index
const PROPS = ['ROWNUMBER', 'CHID', 'FILENAME', 'DATE', 'CLUBGROUP', 'TOTALREQUEST', 'TOTALAMOUNT', 'PROCESSDATE', 'PROCESSBY', 'PROCESSSTATUS', 'PROCESSIPADDRESS', 'DateRanage'];
const DPROPS = ['Username', 'Amount', 'OrderID', 'BV', 'PV', 'TransactionID', 'OrderStatus', 'OrderDate', 'ConformationDate', 'COMDID'];

// Dns.GetHostEntry(Dns.GetHostName()).AddressList[1] equivalent
function hostIp() {
  const addrs = [];
  const ifs = os.networkInterfaces();
  for (const k of Object.keys(ifs)) for (const a of ifs[k]) addrs.push(a.address);
  return addrs.length > 1 ? addrs[1] : '';
}

// auth
router.all(['/franchise/Pv_Distribute/Index{/:id}', '/franchise/franchisee/Pv-Distribute'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const fromDate = s(p.fromDate);
  const toDate = s(p.toDate);
  const DID = req.user.did;
  const MaxRows = await UtilityClass.GridPageSize();
  const page = p.page ? pg(p.page) : 1;
  const rows = await db.proc('shopping', 'usp_pv_reseller_clubhistory_list', { STARTROWINDEX: page, MAXROWS: MaxRows, FROMDATE: fromDate, TODATE: toDate, DID });
  const TotalRecord = parseInt(outv(rows, 'TOTALRECORD'), 10) || 0;
  res.json({
    Model: mapRows(rows, PROPS),
    CurrentPage: page,
    GridPageSize: MaxRows,
    fromDate,
    toDate,
    TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
  });
}));

// auth
router.all('/franchise/Pv_Distribute/cancel{/:id}', auth, asyncHandler(async (req, res) => {
  let str = '';
  try {
    const GROUPNO = req.p.GROUPNO;
    const IpAddress = hostIp();
    const Empid = req.user.did;
    const r = await db.procOne('shopping', 'usp_pv_reseller_update', { GROUPNUMBER: GROUPNO, PROCESSBY: Empid, PROCESSIPADDRESS: IpAddress, MODE: 2 });
    str = r && r.strresult !== undefined && r.strresult !== null ? String(r.strresult) : '';
    if (str === '1') str = 'success';
  } catch (ex) {
    return res.json('error');
  }
  return res.json(str);
}));

// auth
router.all('/franchise/Pv_Distribute/ProceedBV{/:id}', auth, asyncHandler(async (req, res) => {
  let result = '';
  const GROUPNO = req.p.GROUPNO;
  const DID = req.user.did;
  const list = mapRows(await db.proc('shopping', 'usp_distributepvdetails', { GROUPNAME: GROUPNO }), DPROPS);
  const APiURl = await db.scalar('shopping', "Select coalesce(APIURL,'') from TBL_COMPANYSETTINGS where PMID=@did limit 1", { did: DID });
  const url = (APiURl === null ? '' : APiURl) + 'api/UserBussinessDetails';
  for (const Item of list) {
    const OBjSendReceive = {
      ROWNUMBER: 0,
      Username: Item.Username, Amount: Item.Amount, OrderID: Item.OrderID, BV: Item.BV, PV: Item.PV,
      TransactionID: Item.TransactionID, OrderStatus: Item.OrderStatus, OrderDate: Item.OrderDate, ConformationDate: Item.ConformationDate,
      COMDID: 0,
    };
    const StrPostData = JSON.stringify(OBjSendReceive);
    const resp = await axios.post(url, StrPostData, { headers: { 'Content-Type': 'application/json' }, transformResponse: (d) => d });
    const ObjProductDetails = JSON.parse(resp.data);
    const Flag = String(ObjProductDetails.Flag);
    if (Flag === 'success') {
      try {
        await GetIP.GetLocalIP(req);
        await db.proc('shopping', 'usp_pv_distributed', { MODE: 1, COMDID: Item.COMDID, STATUS: 1, GROUPNO });
        result = 'success';
      } catch (ex) {
        result = 'error';
      }
    } else {
      await db.proc('shopping', 'usp_pv_distributed', { MODE: 2, COMDID: Item.COMDID, STATUS: 2, GROUPNO });
      result = String(ObjProductDetails.Message);
    }
  }
  res.json(result);
}));

module.exports = router;
