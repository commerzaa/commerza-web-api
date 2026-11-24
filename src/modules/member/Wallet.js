'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Wallet.cs (WalletController)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 */
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');
const Security_Key = require('../../lib/member/Security_Key');
const ATCAPI = require('../../lib/member/ATCAPI');
const SendMail = require('../../lib/member/SendMail');

const router = express.Router();
const DB = 'affiliate';

const WALLET_PROPS = ['Rownumber', 'WDID', 'PLID', 'CRDRTYPE', 'WITHDRAWAMOUNT', 'ADMINCHARGE', 'TDS', 'WITHDRAWLPOINTS', 'PAYBLEAMOUNT', 'DATE', 'REMARKS', 'STATUS',
  'Trans_Id', 'ACCOUNTNO', 'Paid_status', 'PAID_MODE', 'ADMIN_REMARK', 'INT_PAID_ACID', 'TDS_SECTION_ID', 'TDS_PERForAdsPoints', 'ADMINCHARGE_PERForAdsPoints',
  'TDS_SECTION_ID_ForAdsPoints', 'BinaryAndDirectWithdrawal', 'AdsPointsWithdrawal', 'WithDrawlPointsForAdsPoints', 'TDSForBinaryAndDirect', 'TDSForAdsPoints'];

const nn = (v) => (v === undefined || v === null ? '' : String(v));
const optInt = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const col = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };
const outStr = (row, name) => { const v = col(row, name); return v === null ? '' : String(v); };
const bg = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e)); }; // legacy new Thread(...).Start()
const legacyPath = (req) => req.originalUrl.split('?')[0].replace(/^\/member/, '');
const npe = () => new Error('Object reference not set to an instance of an object.');
// Convert.ToDecimal(string)
const toDecimal = (v) => {
  if (v === undefined || v === null) return 0;
  const n = Number(String(v).trim());
  if (String(v).trim() === '' || Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
};
// APIResponse.Substring(2, APIResponse.Length - 4).Replace("\\", "") then JArray.Parse
function parseApi(resp) {
  const t = String(resp).substring(2, String(resp).length - 2).replace(/\\/g, '');
  return JSON.parse(t);
}
// JToken["x"].ToString() on a missing key => NullReferenceException
function jt(o, key) {
  if (o === undefined || o === null || o[key] === undefined || o[key] === null) throw npe();
  return typeof o[key] === 'object' ? JSON.stringify(o[key]) : String(o[key]);
}

// auth
// route-config: "referral/wallet" -> Wallet/Index (id optional)
router.all(['/member/Wallet/Index{/:id}', '/member/referral/wallet{/:id}'], auth, asyncHandler(async (req, res) => {
  let ddlcustpage = optInt(req.p.ddlcustpage);
  const SearchField = nn(req.p.SearchField);
  const SearchValue = nn(req.p.SearchValue);
  const fromdate = nn(req.p.fromdate);
  const todate = nn(req.p.todate);
  let page = optInt(req.p.page);
  if (ddlcustpage === null) ddlcustpage = 100;
  const Plid = Number(req.user.plid);
  const MaxRows = ddlcustpage;
  if (page === null) page = 1;
  // PORT-NOTE: @TotalCount OUT param is returned as a column ("totalcount") of the result row.
  const rows = await db.proc(DB, 'usp_wallet_history', {
    plid: Plid, startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(), fromdate: fromdate.trim(), todate: todate.trim(),
  });
  const tc = col(rows[0], 'totalcount');
  const ViewBag = {
    CurrentPage: page,
    GridPageSize: MaxRows,
    TotalRecord: tc === null ? 0 : parseInt(tc, 10),
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField,
    SearchValue,
    fromDate: fromdate,
    toDate: todate,
    ddlcustpage,
  };
  res.json({ view: '~/Views/CustomerPanel/Wallet/Index.cshtml', Model: mapRows(rows, WALLET_PROPS), ViewBag });
}));

// public (no session check in legacy; only calls an external currency service)
router.all('/member/Wallet/ConvertYHOO{/:id}', asyncHandler(async (req, res) => {
  const amount = toDecimal(req.p.amount);
  const { fromCurrency, toCurrency } = req.p;
  const url = `https://finance.yahoo.com/d/quotes.csv?e=.csv&f=sl1d1t1&s=${String(fromCurrency).toUpperCase()}${String(toCurrency).toUpperCase()}=X`;
  const r = await axios.get(url, { responseType: 'text', transformResponse: (d) => d });
  const values = String(r.data).split(',');
  const rate = toDecimal(values[1]);
  res.json(rate * amount);
}));

/** SendMailWithdrawal (protected in legacy, not an action) */
async function SendMailWithdrawal(ToEmail, Username) { // eslint-disable-line no-unused-vars
  const subject = ''; const mailtxt = '';
  return SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
}

/** public string Approve_WithdrawalInBulk(int wdid, int status, string remarks) */
async function Approve_WithdrawalInBulk(req, wdid, status, remarks) {
  let ret = '';
  let TransactionId = '';
  try {
    let Obj = null;
    if (status === 1) {
      Obj = await db.procOne(DB, 'usp_atctransfer', { wdid });
      try {
        // ---- check receiver ATC wallet address exists or not ----
        if (!Obj) throw npe();
        const APIResponseValidate = await ATCAPI.ValidateATCWalletAddress(Obj.towalletaddress);
        const ObjJArrayValidate = parseApi(APIResponseValidate);
        const ResponseValidate = jt(ObjJArrayValidate[0], 'Response');
        const IsSuccessValidate = jt(ObjJArrayValidate[0], 'IsSuccess');
        if (IsSuccessValidate.trim() !== '1') {
          return ResponseValidate;
        }
        const APIResponse = await ATCAPI.ATCSendReceived(Obj.fromuserid, Obj.towalletaddress, String(Obj.noofcoin));
        const ObjJArray = parseApi(APIResponse);
        const ResponseMessage = jt(ObjJArray[0], 'Response');
        TransactionId = jt(ObjJArray[0], 'TxID');
        if (ResponseMessage.trim().toLowerCase() !== 'true') {
          return ResponseMessage;
        }
        if (TransactionId === '') {
          return ResponseMessage;
        }
      } catch (ExpObj) {
        try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'Approve_WithdrawalInBulk', 0, legacyPath(req)); } catch (e) { console.error(e); }
        return ExpObj.message;
      }
    }
    // PORT-NOTE: @STRRESULT is InputOutput (initial value = remarks); @IntResult OUT is returned as a column of the result row.
    const out = await db.procOne(DB, 'usp_withdrawal_approveorreject', {
      wdid, mode: status, strresult: remarks, activitybyuserid: 'Auto Transfered', transactionid: TransactionId,
    });
    ret = outStr(out, 'strresult');
    return ret;
  } catch (ExpObj) {
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'USP_WITHDRAWAL_APPROVEORREJECT', 0, legacyPath(req)); } catch (e) { console.error(e); }
    ret = String(ExpObj.message);
    return ret;
  }
}

// auth
router.all('/member/Wallet/request_wallet{/:id}', auth, asyncHandler(async (req, res) => {
  const amount = toDecimal(req.p.amount);
  const { remark, adspoint, GAKEY } = req.p;
  if (amount < 0) {
    return res.json('Withdrawal can not be less than zero.');
  }
  let ResultOutput = '';
  // (Session["Plid"] == null => "Session Expired. Please login again." is covered by the auth middleware)
  const Plid = Math.trunc(Number(req.user.plid));
  let objs = new Security_Key();
  objs = await objs.Get_Security_Key(Plid);
  if (objs) {
    // PORT-NOTE: legacy passes GAKEY as the *secret* argument of Check_GaKey(plid, SecretKey, user2FACode = "") - kept as is.
    if (!(await objs.Check_GaKey(Plid, GAKEY))) {
      return res.json('Error^Please enter valid GA key !');
    }
  }
  // PORT-NOTE: @STRRESULT / @WDIDOUT OUT params are read from the result row.
  const out = await db.procOne(DB, 'usp_withdrawal_request', { plid: Plid, points: amount, adspoint, remark });
  ResultOutput = outStr(out, 'strresult');
  const wd = col(out, 'wdidout');
  const WDID = wd === null ? 0 : parseInt(wd, 10);

  if (ResultOutput === 'success') {
    bg(() => Approve_WithdrawalInBulk(req, WDID, 1, 'Your Payout Released'));

    const Obj = await db.queryOne(DB, "select coalesce(phone, '') as phone, emailid, username from portal_login where plid = @plid limit 1", { plid: Plid });
    if (!Obj) throw npe();
    const Message = 'Your withdrawal request is sent to Admin for approval.\r\n For more details visit https://bfxmining.com/.\r\nCrypto Inbox Support Team.';
    if (Obj.phone !== null && Obj.phone !== undefined && Obj.phone !== '') {
      bg(() => UtilityClass.SendMsgOnMobile(Obj.phone, Message));
    }
    if (Obj.emailid !== null && Obj.emailid !== undefined && Obj.emailid !== '') {
      bg(() => SendMailWithdrawal(Obj.emailid, Obj.username));
    }
  }
  return res.json(ResultOutput);
}));

// auth
router.all('/member/Wallet/check_kyc{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const idfroof = req.p.idfroof;
  // PORT-NOTE: @int_status OUT param is read from the result row.
  const row = await db.procOne(DB, '_kyc_status_refer_dashborad', { regno: Plid, title: idfroof });
  res.json(outStr(row, 'int_status'));
}));

/** Shared body of Generate_Atc_Wallet_Old / Generate_Atc_Wallet (they differ in how the address is requested and the final guard). */
async function generateAtcWallet(req, res, old) {
  const Plid = Number(req.user.plid);
  let APIResponse;
  if (old) {
    const userid = await db.scalar(DB, 'select atcuserid from portal_login where plid = @plid limit 1', { plid: Plid });
    APIResponse = await ATCAPI.ATCRegistrationOld(userid);
  } else {
    APIResponse = await ATCAPI.ATCRegistration();
  }
  const ObjJArray = parseApi(APIResponse);
  const ATCAddress = jt(ObjJArray[0], 'Address');
  const AtcUserId = jt(ObjJArray[0], 'UserID');

  // ---- validate generated ATC wallet address ----
  const APIResponseValidate = await ATCAPI.ValidateATCWalletAddress(ATCAddress);
  const ObjJArrayValidate = parseApi(APIResponseValidate);
  const ResponseValidate = jt(ObjJArrayValidate[0], 'Response');
  const IsSuccessValidate = jt(ObjJArrayValidate[0], 'IsSuccess');
  if (IsSuccessValidate.trim() !== '1') {
    return res.json('Error^' + ResponseValidate);
  }

  const proceed = old ? ATCAddress !== '' : (ATCAddress !== '' && AtcUserId !== '' && jt(ObjJArray[0], 'IsSuccess') === '1');
  if (proceed) {
    // PORT-NOTE: @INTRESULT OUT param is read from the result row.
    const out = await db.procOne(DB, 'usp_generateatcwalletaddress', { plid: Math.trunc(Plid), atcwalletaddress: ATCAddress.trim(), userid: AtcUserId.trim() });
    return res.json(outStr(out, 'intresult') + '^' + ATCAddress);
  }
  return res.json('Error: ' + jt(ObjJArray[0], 'Response'));
}

// auth
router.all('/member/Wallet/Generate_Atc_Wallet_Old{/:id}', auth, asyncHandler((req, res) => generateAtcWallet(req, res, true)));

// auth
router.all('/member/Wallet/Generate_Atc_Wallet{/:id}', auth, asyncHandler((req, res) => generateAtcWallet(req, res, false)));

// auth (returns a member's bank details for a withdrawal id)
router.all('/member/Wallet/WithdrawalList{/:id}', auth, asyncHandler(async (req, res) => {
  const wdid = req.p.wdid;
  if (wdid === undefined || wdid === null || !/^\s*[+-]?\d+\s*$/.test(String(wdid))) throw new Error('The parameters dictionary contains a null entry for parameter \'wdid\'.');
  let result = '';
  const row = await db.queryOne(DB, 'select * from withdrawal_history where wdid = @wdid limit 1', { wdid: String(parseInt(wdid, 10)) });
  if (row) {
    const s = (v) => (v === null || v === undefined ? '' : String(v));
    result = s(row.accountholdername) + '^' + s(row.accountno) + '^' + s(row.bankname) + '^' + s(row.branchname) + '^' + s(row.ifsc);
  }
  res.json(result);
}));

// auth (public string action in legacy with no session check; it releases a withdrawal payout, so it is protected here)
router.all('/member/Wallet/Approve_WithdrawalInBulk{/:id}', auth, asyncHandler(async (req, res) => {
  const wdid = parseInt(req.p.wdid, 10);
  const status = parseInt(req.p.status, 10);
  if (Number.isNaN(wdid) || Number.isNaN(status)) throw new Error('The parameters dictionary contains a null entry for a non-nullable parameter.');
  const remarks = req.p.remarks === undefined ? null : req.p.remarks;
  const ret = await Approve_WithdrawalInBulk(req, wdid, status, remarks);
  res.send(ret);
}));

module.exports = router;
