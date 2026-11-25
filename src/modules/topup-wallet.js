'use strict';
/**
 * Port of Controllers/MemberPanelCntrl/TopupWalletController.cs
 * Routes: DepositHistory, TransferHistory, E_Walletstatement, AdminBankDetailList, TopupRequest,
 *         TopupWalletBalance, TransferTopupWallet (7)
 */
const express = require('express');
const multer = require('multer');
const { query, queryOne, scalar, procOne, proc } = require('../db');
const config = require('../config');
const { auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { mapRows, netDate } = require('../utils/shape');
const UtilityClass = require('../lib/UtilityClass');
const DataUtility = require('../lib/DataUtility');
const ATCAPI = require('../lib/ATCAPI');
const Security_Key = require('../lib/Security_Key');
const DAL_RegistrationOrLogin = require('../lib/DAL_RegistrationOrLogin');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// ---------------------------------------------------------------- helpers
class BadParam extends Error {}
const isBlank = (v) => v === undefined || v === null;
/** Convert.ToInt64 / ToInt32 emulation (null => 0, bad format => throws) */
function convInt(v) {
  if (isBlank(v)) return 0;
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return Number(s);
}
/** Convert.ToDecimal emulation (null => 0) */
function convDecimal(v) {
  if (isBlank(v)) return 0;
  const s = String(v).trim();
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(s)) throw new Error('Input string was not in a correct format.');
  return Number(s);
}
/** non-nullable value-type action parameter (long / decimal) */
function reqLong(v) {
  if (isBlank(v) || !/^[+-]?\d+$/.test(String(v).trim())) throw new BadParam('bad long');
  return Number(String(v).trim());
}
function reqDecimal(v) {
  if (isBlank(v) || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(String(v).trim())) throw new BadParam('bad decimal');
  return Number(String(v).trim());
}
/** int? action parameter */
function optInt(v) {
  if (isBlank(v) || String(v).trim() === '') return null;
  const s = String(v).trim();
  return /^[+-]?\d+$/.test(s) ? Number(s) : null;
}
const h = (fn) => asyncHandler(async (req, res) => {
  try { await fn(req, res); } catch (e) {
    if (e instanceof BadParam) return res.status(400).json({ Message: 'The request is invalid.' });
    throw e;
  }
});
/** fire-and-forget (legacy System.Threading.Thread) */
const bg = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e)); };
const DT_DEFAULT = '0001-01-01T00:00:00';
const num = (v) => (isBlank(v) ? 0 : v);

const TOPUP_PROPS = ['RowNumber', 'TFHID', 'RegNo', 'Type', 'Amount', 'Date', 'ByUser', 'Remark', 'Status', 'Username', 'EmailId',
  'FullName', 'ByUserFullName', 'ByUsername', 'GeneratedBy', 'PaymentMode', 'PaymentModeName', 'ChallanImage', 'BankName',
  'BranchName', 'ReferenceNumber', 'ReferenceDate', 'RemarkByMember', 'ApprovedOnDate', 'IsVerifiedByAdmin', 'TransactionId'];
const TOPUP_NUM = ['RowNumber', 'TFHID', 'RegNo', 'Amount', 'ByUser', 'GeneratedBy', 'PaymentMode', 'IsVerifiedByAdmin'];
const STATEMENT_PROPS = ['RowNumber', 'UserName', 'Mobile', 'ProcessDate', 'CrDrType', 'Cr_Amount', 'Dr_Amount', 'Remark', 'Old_Bal',
  'Balance', 'Date', 'Amount'];
const STATEMENT_NUM = ['RowNumber', 'Cr_Amount', 'Dr_Amount', 'Old_Bal', 'Balance', 'Amount'];
const INR_PROPS = ['RowNumber', 'type', 'DrAmount', 'Amount', 'Date', 'Remark', 'Plid', 'Currentbalance', 'TRANSFERDATE'];
const INR_NUM = ['RowNumber', 'DrAmount', 'Amount', 'Plid', 'Currentbalance', 'TRANSFERDATE'];

/** SqlQuery<T> materialisation: missing value-type columns default to 0 / DateTime.MinValue */
function materialise(rows, props, numProps, dateProps = []) {
  return mapRows(rows, props).map((r) => {
    for (const p of numProps) r[p] = num(r[p]);
    for (const p of dateProps) r[p] = isBlank(r[p]) ? DT_DEFAULT : netDate(r[p]);
    return r;
  });
}

// ---------------------------------------------------------------- DepositHistory
// auth
router.post('/api/DepositHistory', auth, h(async (req, res) => {
  let { plid, page, fromDate, toDate } = req.p;
  const MaxRows = 100;
  const Plid = convInt(plid);
  page = optInt(page);
  if (page === null) page = 1;
  if (isBlank(fromDate)) fromDate = '';
  if (isBlank(toDate)) toDate = '';

  const RegNo = (await scalar('affiliate', 'select regno from member_master where regno = @plid limit 1', { plid: Plid })) || 0;
  const rows = await proc('affiliate', 'usp_fund_request', {
    mode: '2', regno: RegNo, type: 'Cr', amount: '0', remark: '', paymentmode: '0', paymentmodename: '',
    challanimage: '', bankname: '', branchname: '', referencenumber: '', referencedate: '',
    fromdate: fromDate, todate: toDate, startrowindex: page, maxrows: MaxRows,
  });
  const Obj = materialise(rows, TOPUP_PROPS, TOPUP_NUM);
  res.json([{ status: 'true', data: Obj }]);
}));

// ---------------------------------------------------------------- TransferHistory
// auth
router.post('/api/TransferHistory', auth, h(async (req, res) => {
  let { plid, page, fromDate, toDate, CrDrType, TrType, ddlcustpage, Type, Username } = req.p;
  const responseData = [];
  page = optInt(page);
  ddlcustpage = optInt(ddlcustpage);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (isBlank(Username)) Username = '';
  if (isBlank(fromDate)) fromDate = '';
  if (isBlank(toDate)) toDate = '';
  if (isBlank(CrDrType)) CrDrType = '';
  if (isBlank(TrType)) TrType = '0';
  if (TrType === '') TrType = '0';

  try {
    const MaxRows = ddlcustpage;
    if (page === null) page = 1;
    const Plid = convInt(plid);
    const rows = await proc('affiliate', 'usp_fund_history_transfer', {
      plid: Plid, fromdate: fromDate, todate: toDate, username: Username, startrowindex: page, maxrows: MaxRows,
    });
    const Obj = materialise(rows, STATEMENT_PROPS, STATEMENT_NUM, ['Date']);
    responseData.push({ status: 'true', data: Obj });
  } catch (Exp) {
    responseData.push({ status: 'false', message: 'Something went wrong', _error: Exp.message });
  }
  res.json(responseData);
}));

// ---------------------------------------------------------------- E_Walletstatement
// auth
router.post('/api/E_Walletstatement', auth, h(async (req, res) => {
  let { plid, page, fromDate, toDate, CrDrType, TrType, ddlcustpage } = req.p;
  page = optInt(page);
  ddlcustpage = optInt(ddlcustpage);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (isBlank(fromDate)) fromDate = '';
  if (isBlank(toDate)) toDate = '';
  if (isBlank(CrDrType)) CrDrType = '';
  if (isBlank(TrType)) TrType = '0';
  if (TrType === '') TrType = '0';

  // Auto approval of BTC for E-Wallet topup (background thread in legacy)
  bg(async () => {
    const RegNo = convInt(plid);
    await ATCAPI.BTCPaymentClearification(RegNo);
  });

  const MaxRows = ddlcustpage;
  if (page === null) page = 1;
  const Plid = convInt(plid);
  const rows = await proc('affiliate', 'usp_fund_history', {
    tfhid: Plid, fromdate: fromDate, todate: toDate, startrowindex: page, maxrows: MaxRows,
    crdrtype: CrDrType, trtype: convInt(TrType), mode: 0,
  });
  // PORT-NOTE: legacy also read the OUT params (TOTALCOUNT/CRAMOUNT/DRAMOUNT/AVALIBALEFUND) but never used them in the response.
  const Obj = materialise(rows, INR_PROPS, INR_NUM);
  res.json([{ status: 'true', data: Obj }]);
}));

// ---------------------------------------------------------------- AdminBankDetailList
// auth
router.post('/api/AdminBankDetailList', auth, h(async (req, res) => {
  const BANK_PROPS = ['TABDID', 'AccountHolderName', 'AccountNo', 'BankName', 'BranchName', 'IFSCCode', 'LOGO'];
  const fix = (rows) => mapRows(rows, BANK_PROPS).map((r) => { r.TABDID = num(r.TABDID); return r; });

  const objBankList = fix(await query('affiliate',
    "SELECT coalesce(ACCOUNTHOLDERNAME,'') AS ACCOUNTHOLDERNAME, coalesce(ACCOUNTNO,'') AS ACCOUNTNO, coalesce(BANKNAME,'') AS BANKNAME, " +
    "coalesce(BRANCHNAME,'') AS BRANCHNAME, coalesce(IFSCCODE,'') AS IFSCCODE, LOGO FROM TBL_ADMIN_BANKDETAILS WHERE STATUS=1 AND ACTIVE=1"));

  const BankDetailsAdmin = fix(await query('affiliate',
    "select TABDID, BankName || '(' || AccountNo || ')' as BankName from Tbl_Admin_BankDetails where status=1 and active = 1"));

  const LiTBL_PAYMODE = mapRows(await query('affiliate',
    'SELECT PMOID,PAYMODE,STATUS FROM TBL_PAYMODE WHERE STATUS=1 AND Type=@type AND PMOID IN (1,4,6,7,9,10,11,12,13,1019,1021,1022,1023)',
    { type: 1 }), ['PMOID', 'PAYMODE', 'STATUS']).map((r) => { r.PMOID = num(r.PMOID); r.STATUS = num(r.STATUS); return r; });

  res.json([{ status: 'true', data: objBankList, BankDetailsAdmin, PaymentMode: LiTBL_PAYMODE }]);
}));

// ---------------------------------------------------------------- TopupRequest
// auth
router.post('/api/TopupRequest', auth, upload.any(), h(async (req, res) => {
  // HttpContext.Current.Request.Form[...] (case-insensitive NameValueCollection)
  const form = {};
  for (const k of Object.keys(req.body || {})) if (!(k.toLowerCase() in form)) form[k.toLowerCase()] = req.body[k];
  const F = (name) => form[name.toLowerCase()];
  const FS = (name) => { // .ToString() on a null form value => NullReferenceException
    const v = F(name);
    if (isBlank(v)) throw new TypeError('Object reference not set to an instance of an object.');
    return String(v);
  };

  const Plid = convInt(F('Plid'));
  const Mobile = FS('Mobile');
  const Emailid = FS('Emailid');
  const UserName = FS('UserName');
  const AmountRaw = convDecimal(F('Amount'));
  const AmountStr = isBlank(F('Amount')) ? '0' : String(F('Amount')).trim().replace(/^\+/, '');
  const Amount = AmountRaw;
  const ChallanImage = FS('ChallanImage');
  const PaymentMode = FS('PaymentMode');
  const ModeName = FS('ModeName');
  const CommentORRemark = FS('CommentORRemark');
  const BankName = FS('BankName');
  const BranchName = FS('BranchName');
  const ReferenceDate = FS('ReferenceDate');
  let ReferenceNumber = FS('ReferenceNumber');
  const IFSCCode = FS('IFSCCode');
  const BTCAddress = FS('BTCAddress');
  let OTPCODE = FS('OTPCODE');
  const BtcUserId = FS('BtcUserId');
  const BTCLabelName = FS('BTCLabelName');
  const BitCoinAmount = FS('BitCoinAmount');
  const BWAFW = convInt(F('BWAFW'));
  const BANKID = convInt(F('BANKID'));

  const OTP = String(await UtilityClass.RandomNumberStringByLength(6));
  let Mobilestatus = 0;
  let Emailstatus = 0;
  let ReturnOutput = '';
  const responseData = [];

  // (Mobile != null || Mobile != "") is always true in legacy
  {
    const msg = await queryOne('affiliate', 'select * from tbl_smsaction where id = 5 limit 1');
    Mobilestatus = msg.sms_send_status;
    if (Mobilestatus === 1) {
      const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(UserName, msg.sms_content, '', OTP, 4);
      bg(() => UtilityClass.SendSMSWithAPI(Mobile, messg, '1'));
    }
  }
  {
    const emailmsg = await queryOne('affiliate', 'select * from tbl_emailaction where eid = 5 limit 1');
    Emailstatus = emailmsg.email_send_status;
    if (Emailstatus === 1) {
      const Emailmsg = await UtilityClass.FindingEmailContentWithUserIdPassword(UserName, emailmsg.email_content, '', OTP, 2, '');
      bg(() => UtilityClass.SendEmailByApiSetting(UserName, '', '', '', '', '', Emailid, 'Member Topup', Emailmsg, null, '', ''));
    }
  }

  if (Mobilestatus === 0 && Emailstatus === 0) {
    if (ReferenceNumber === '') {
      const StrHash = await UtilityClass.Generatehash512('System.Random' + new Date().toString());
      ReferenceNumber = String(StrHash).substring(0, 20);
    }
    let TransactionId = '';
    {
      const msg = await queryOne('affiliate', 'select * from tbl_smsaction where id = 5 limit 1');
      const emailmsg = await queryOne('affiliate', 'select * from tbl_emailaction where eid = 5 limit 1');

      if (PaymentMode === '14') {
        // legacy: TransactionId is always "" here (TempData line commented out)
        if (TransactionId === '') {
          return res.json('error^Invalid Transaction Id.');
        }
      }
      if (PaymentMode === '3') {
        TransactionId = ReferenceNumber;
      }
      if (OTPCODE === null || OTPCODE === undefined) OTPCODE = '0';
      if (msg.sms_send_status !== 0 && emailmsg.email_send_status !== 0) {
        if (OTPCODE !== OTP) {
          return res.json('error^You have entered wrong OTP.');
        }
      }
    }

    // PaymentMode == "2" (BTC verification) was fully commented out in legacy

    if (Amount <= 0 || PaymentMode === '' || PaymentMode === '0') {
      return res.json('error^Mandatory fields are required.');
    }
    let ImageName = '';
    let FullUrlWithFolder = '';
    let RegNo = 0;
    try {
      RegNo = (await scalar('affiliate', 'select regno from member_master where regno = @plid limit 1', { plid: Plid })) || 0;
      if (ChallanImage !== '') {
        FullUrlWithFolder = `${req.protocol}://${req.get('host')}/Challen_Image/`;
        ImageName = await UtilityClass.ImageUploadMasterMethod(ChallanImage, '../Challen_Image', '../Challen_Image',
          UtilityClass.ImageMode ? UtilityClass.ImageMode.Both : 2, String(RegNo));
        FullUrlWithFolder += ImageName;
      }
      const row = await procOne('affiliate', 'usp_fund_request', {
        mode: 1, regno: RegNo, type: 'Cr', amount: Amount, remark: CommentORRemark, paymentmode: PaymentMode,
        paymentmodename: ModeName, challanimage: FullUrlWithFolder, bankname: BankName, branchname: BranchName,
        referencenumber: ReferenceNumber, referencedate: ReferenceDate, fromdate: '', todate: '', startrowindex: '1',
        maxrows: '100', ifsccode: IFSCCode, btcaddress: BTCAddress, btcuserid: BtcUserId, btclabelname: BTCLabelName,
        bitcoinamount: (BitCoinAmount === '' ? '0.00000000' : BitCoinAmount), transactionid: TransactionId,
        bwafw: BWAFW, bankid: BANKID,
      });
      const out = String(row.strresult === null || row.strresult === undefined ? (() => { throw new TypeError('null output'); })() : row.strresult);
      if (out.toLowerCase() === 'success') {
        ReturnOutput = 'success^Thank you! Topup Request has been sent successfully.^/referral/do-not-refresh-payment?CommentORRemark=' +
          CommentORRemark + '&Amount=' + AmountStr + '&OrderId=' + ReferenceNumber + '';
      } else {
        ReturnOutput = out;
      }
    } catch (ExpObj) {
      ReturnOutput = 'error^Some exception occured while making the request.';
    }

    responseData.push({ status: 'true', data: ReturnOutput });
    return res.json(responseData);
  }

  responseData.push({ status: 'true', data: ReturnOutput });
  return res.json(responseData);
}));

// ---------------------------------------------------------------- TopupWalletBalance
// auth
router.post('/api/TopupWalletBalance', auth, h(async (req, res) => {
  const Regno = reqLong(req.p.Regno);
  let Available_Fund = 0;
  const Row = await queryOne('affiliate', 'select * from member_performance where regno = @regno limit 1', { regno: Regno });
  if (Row !== null) Available_Fund = Row.available_fund;
  res.json([{ status: 'true', data: Available_Fund }]);
}));

// ---------------------------------------------------------------- TransferTopupWallet
// auth
router.post('/api/TransferTopupWallet', auth, h(async (req, res) => {
  const Plid = reqLong(req.p.Plid);
  const Username = req.p.Username;
  const Amount = reqDecimal(req.p.Amount);
  const GAKEY = req.p.GAKEY;
  const Remark = req.p.Remark;
  // Password, OTPCODE, hfauthenticated are accepted but unused (security check call is commented out in legacy)
  const PaymentMode = 14;
  const responseData = [];
  const IsSecuritySuccess = 'success';
  if (IsSecuritySuccess !== 'success') {
    return res.json(IsSecuritySuccess);
  }

  let JsonReply = '';
  let mode = 0;
  if (PaymentMode === 12) mode = 2; // Coin Wallet Transfer
  if (PaymentMode === 14) mode = 1; // INR/(I) Wallet Transfer
  if (mode === 0) {
    JsonReply = 'Invalid^Please select payment mode.';
    responseData.push({ status: 'true', data: JsonReply });
    return res.json(responseData);
  }
  try {
    const objs = await new Security_Key().Get_Security_Key(Plid);
    let ActiveKey = 0;
    if (objs !== null && objs !== undefined) {
      ActiveKey = objs.Status;
      const ValidRandomNo = await DAL_RegistrationOrLogin.CheckRandomNo(Number(Plid));
      if (ActiveKey === 1) {
        if (!(await objs.Check_GaKey(Plid, ValidRandomNo, GAKEY))) {
          JsonReply = 'Error^Please enter the valid GA key !';
          responseData.push({ status: 'true', data: JsonReply });
          return res.json(responseData);
        }
      }
    }

    const ToUserDetails = await queryOne('affiliate',
      'select * from member_master where lower(username) = lower(@u) limit 1', { u: Username.trim() });
    if (ToUserDetails === null) {
      JsonReply = 'Failure^Username is incorrect. Please try again.';
      return res.json(JsonReply);
    }
    const reply = await procOne('affiliate', 'usp_transferfundtouser', {
      mode, tmfthid: '0', plid: Plid, toplid: ToUserDetails.regno, amount: Amount, remark: Remark,
      fromdate: '', todate: '', startrowindex: '1', maxrows: '100',
    });
    const StrResult = String(reply.strresult);
    JsonReply = StrResult;
    if (StrResult.toLowerCase() !== 'success') {
      JsonReply = 'Error^' + StrResult;
      responseData.push({ status: 'true', data: JsonReply });
      return res.json(responseData);
    }

    const MemberDetails = await queryOne('affiliate', 'select * from member_master where regno = @plid limit 1', { plid: Plid });
    const Frommsg = await queryOne('affiliate', 'select * from tbl_smsaction where id = 45 limit 1');
    const Tomsg = await queryOne('affiliate', 'select * from tbl_smsaction where id = 46 limit 1');
    const Frommessg = await UtilityClass.FindingSmsContentWithUserIdPassword(MemberDetails.username, Frommsg.sms_content, '', '', 32, '',
      ToUserDetails.username, 0, Amount, Plid);
    const Tomessg = await UtilityClass.FindingSmsContentWithUserIdPassword(MemberDetails.username, Tomsg.sms_content, '', '', 33, '',
      ToUserDetails.username, Amount, 0, 0, ToUserDetails.regno);

    const emailmsg = await queryOne('affiliate', 'select * from tbl_emailaction where eid = 42 limit 1');
    const DynamicMsgForDebit = await UtilityClass.FindingEmailContentWithUserIdPassword('', emailmsg.email_content, MemberDetails.emailid,
      '', 35, '', '', Plid, 0, '', '', 0, Amount, 0);
    const Creditemailmsg = await queryOne('affiliate', 'select * from tbl_emailaction where eid = 43 limit 1');
    const DynamicMsgForCredit = await UtilityClass.FindingEmailContentWithUserIdPassword('', Creditemailmsg.email_content,
      MemberDetails.emailid, '', 36, '', '', 0, 0, '', '', ToUserDetails.regno, 0, Amount);

    // Debit SMS
    if (Frommsg.smscategory === 'Transfer') {
      if (Frommsg.sms_send_status === 1) {
        bg(() => UtilityClass.SendSMSWithAPI(MemberDetails.mobile, Frommessg, '1'));
      }
    }
    // Credit SMS
    if (Tomsg.smscategory === 'Transfer') {
      if (Tomsg.sms_send_status === 1) {
        bg(() => UtilityClass.SendSMSWithAPI(ToUserDetails.mobile, Tomessg, '1'));
      }
    }
    // Debit member email
    if (emailmsg.email_send_status === 1) {
      bg(() => UtilityClass.SendEmailByApiSetting(MemberDetails.username, '', '', '', '', '', MemberDetails.emailid.toLowerCase(),
        emailmsg.email_subject, DynamicMsgForDebit, null));
    }
    // Credit member email
    if (Creditemailmsg.email_send_status === 1) {
      bg(() => UtilityClass.SendEmailByApiSetting(MemberDetails.username, '', '', '', '', '', ToUserDetails.emailid.toLowerCase(),
        Creditemailmsg.email_subject, DynamicMsgForCredit, null));
    }

    JsonReply = StrResult + '^Fund transferred successfully.';
    responseData.push({ status: 'true', data: JsonReply });
    return res.json(responseData);
  } catch (ExpObj) {
    try {
      await new DataUtility().ErrorInsert(0, ExpObj.message, 'Usp_TransferFundToUser', 0, req.path);
    } catch (e2) { console.error(e2); }
    responseData.push({ status: 'true', data: 'Error^Some error occured. Please try again.' });
    return res.json(responseData);
  }
}));

// PORT-NOTE: CheckSecurityForTransctiion (public static, Session based, call site commented out in legacy) is not routable and not ported.

module.exports = router;
