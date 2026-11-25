'use strict';
/**
 * Port of Controllers/MemberPanelCntrl/WithdrawalController.cs
 * Routes: BankWithdrawalHistory, MemberBankDetailList, withdrawal_request, withdrawal_Balance (4)
 */
const express = require('express');
const { query, queryOne, scalar, procOne, proc } = require('../db');
const { auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { mapRow, mapRows, netDate } = require('../utils/shape');
const UtilityClass = require('../lib/UtilityClass');

const router = express.Router();

// ---------------------------------------------------------------- helpers
class BadParam extends Error {}
const isBlank = (v) => v === undefined || v === null;
function convInt(v) {
  if (isBlank(v)) return 0;
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return Number(s);
}
function reqLong(v) {
  if (isBlank(v) || !/^[+-]?\d+$/.test(String(v).trim())) throw new BadParam('bad int');
  return Number(String(v).trim());
}
function reqDecimal(v) {
  if (isBlank(v) || !/^[+-]?(\d+\.?\d*|\.\d+)$/.test(String(v).trim())) throw new BadParam('bad decimal');
  return Number(String(v).trim());
}
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
const bg = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e)); };
const DT_DEFAULT = '0001-01-01T00:00:00';
const num = (v) => (isBlank(v) ? 0 : v);
const mustStr = (v) => { // SqlParameter.Value.ToString() => NRE when null
  if (isBlank(v)) throw new TypeError('Object reference not set to an instance of an object.');
  return String(v);
};
/** DateTime.Now.ToString() (en-US) */
function dotnetNow() {
  return new Date().toLocaleString('en-US', { year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).replace(',', '');
}

const HISTORY_PROPS = ['ROWNUMBER', 'AMOUNT', 'DATE', 'USERNAME', 'ACCOUNTHOLDERNAME', 'ACCOUNTNO', 'IFSC', 'BANKNAME', 'STATUS', 'BRANCHNAME',
  'WITHDRWALAMOUNT', 'ADMINCHARGE', 'TDS', 'NETPAYABLE', 'Processing_Fee', 'INCOMETYPENAME', 'Repurchase'];
const HISTORY_NUM = ['ROWNUMBER', 'AMOUNT', 'WITHDRWALAMOUNT', 'ADMINCHARGE', 'TDS', 'NETPAYABLE', 'Processing_Fee', 'Repurchase'];

// ---------------------------------------------------------------- BankWithdrawalHistory
// auth
router.post('/api/BankWithdrawalHistory', auth, h(async (req, res) => {
  let { plid, fromdate, todate, SearchField, SearchValue, page, ddlstatus } = req.p;
  if (isBlank(plid)) {
    return res.json({ status: 'false', message: 'Invalid user' });
  }
  if (isBlank(fromdate)) fromdate = '';
  if (isBlank(ddlstatus)) ddlstatus = '';
  if (isBlank(todate)) todate = '';
  if (isBlank(SearchField)) SearchField = '';
  if (isBlank(SearchValue)) SearchValue = '';
  page = optInt(page);

  const Plid = convInt(plid);
  const MaxRows = 1000;
  if (page === null) page = 1;
  const rows = await proc('affiliate', 'usp_bankwithdrawal_history', {
    plid: String(Plid), startrowindex: page, maxrows: MaxRows, searchfield: SearchField, searchvalue: SearchValue,
    fromdate: String(fromdate).trim(), todate: String(todate).trim(), status: ddlstatus,
  });
  // PORT-NOTE: legacy read the @TOTALCOUNT OUT param but did not use it in the response.
  const WithDrawalHisrory = mapRows(rows, HISTORY_PROPS).map((r) => {
    for (const p of HISTORY_NUM) r[p] = num(r[p]);
    r.DATE = isBlank(r.DATE) ? DT_DEFAULT : netDate(r.DATE);
    return r;
  });
  res.json([{ status: 'true', message: 'success', data: WithDrawalHisrory }]);
}));

// ---------------------------------------------------------------- MemberBankDetailList
// auth
router.post('/api/MemberBankDetailList', auth, h(async (req, res) => {
  const Plid = reqLong(req.p.Plid);
  const responseData = [];
  let regno = 0;
  const row = await queryOne('affiliate', 'select regno from member_master where regno = @plid limit 1', { plid: Plid });
  if (row !== null) regno = row.regno;
  const r = await queryOne('affiliate',
    'SELECT Regno,ACCOUNTHOLDERNAME,ACCOUNTNO,BANKNAME,BRANCHNAME,IFSCCODE FROM TBL_MEMBER_KYC_DETAILS WHERE Regno=@regno LIMIT 1', { regno });
  if (r !== null) {
    const BankDetails = mapRow(r, ['ACID', 'Regno', 'ACCOUNTHOLDERNAME', 'ACCOUNTNO', 'BANKNAME', 'BRANCHNAME', 'IFSCCODE', 'ACTIVE',
      'DTM_DATE', 'DTM_UPDATE_DATE', 'PancardNo', 'SwiftCode']);
    BankDetails.ACID = num(BankDetails.ACID);
    BankDetails.Regno = num(BankDetails.Regno);
    BankDetails.ACTIVE = BankDetails.ACTIVE === null ? false : BankDetails.ACTIVE;
    BankDetails.DTM_DATE = isBlank(BankDetails.DTM_DATE) ? DT_DEFAULT : netDate(BankDetails.DTM_DATE);
    BankDetails.DTM_UPDATE_DATE = isBlank(BankDetails.DTM_UPDATE_DATE) ? DT_DEFAULT : netDate(BankDetails.DTM_UPDATE_DATE);
    responseData.push({ status: 'true', message: 'success', data: BankDetails });
    return res.json(responseData);
  }
  responseData.push({ status: 'true', message: 'success', data: 'Bank Detail KYC Not Approved!' });
  return res.json(responseData);
}));

// ---------------------------------------------------------------- withdrawal_request
// auth
router.post('/api/withdrawal_request', auth, h(async (req, res) => {
  const Plid = reqLong(req.p.Plid);
  reqLong(req.p.paymode); // int paymode (unused)
  const amount = reqDecimal(req.p.amount);
  // paymodename, masterOtp unused (OTP checks commented out in legacy)
  const { bankName, branchName, IFSC, accountHolderName, accountNumber } = req.p;
  const withdrawaltype = reqLong(req.p.withdrawaltype);
  const responseData = [];

  // legacy first block only read TBL_SMSACTION(9) / tbl_emailaction(9) / TBL_MEMBERAUTHENTICATION flags; results were unused (all uses commented out).

  let ResultOutput = '';
  const bal = await scalar('affiliate', 'Select coalesce(AvailableCommissionWallet,0) As AvailableCommissionWallet From MEMBER_PERFORMANCE Where RegNo=@plid LIMIT 1', { plid: Plid });
  const AvailableCommissionWallet = isBlank(bal) ? 0 : bal;

  if (withdrawaltype === 3) {
    if (AvailableCommissionWallet < amount) {
      ResultOutput = 'error^You have insufficient Balance ! !';
      responseData.push({ status: 'false', message: 'error', data: ResultOutput });
      return res.json(responseData);
    }
  }

  const orderid = 'CL' + (await UtilityClass.GenerateOrderId());
  const spRow = await procOne('affiliate', 'usp_bankwithdrawal', {
    regno: Plid, amount, wallettype: withdrawaltype, bankname: bankName, branchname: branchName, ifsc: IFSC,
    accountholdername: accountHolderName, accountnumber: accountNumber, orderid,
  });
  ResultOutput = mustStr(spRow ? spRow.strresult : null);
  if (ResultOutput === 'success') {
    const emailmsg = await queryOne('affiliate', 'select * from tbl_emailaction where eid = 39 limit 1');
    const mm = await queryOne('affiliate', 'select emailid from member_master where regno = @plid limit 1', { plid: Plid });
    const EmailId = mm ? mm.emailid : null;
    const WithdrawalMsg = emailmsg.email_content;
    const DynamicSponcerMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(accountHolderName, WithdrawalMsg, EmailId, bankName,
      31, branchName, accountNumber, 0, amount, IFSC);
    if (emailmsg.email_send_status === 1) {
      bg(() => UtilityClass.SendEmailByApiSetting(accountHolderName, '', '', '', '', '', EmailId.toLowerCase(), emailmsg.email_subject,
        DynamicSponcerMsg, null));
    }
    const data = await queryOne('affiliate', "select * from tbl_withdrawals where plid = @plid and status = 'Pending' limit 1", { plid: Plid });
    let status = 0;
    if (amount <= 5000) {
      status = await ProcessPayout(String(Plid), String(data.wdid));
    }

    if (status === 1) {
      ResultOutput = 'success';
    } else if (status === 2) {
      ResultOutput = 'Withdrawal Failed to transfer';
      responseData.push({ status: 'error', message: 'fail', data: ResultOutput });
      return res.json(responseData);
    } else {
      ResultOutput = 'Withdrawal Pending It will clear Soon';
      responseData.push({ status: 'error', message: 'fail', data: ResultOutput });
      return res.json(responseData);
    }
  }
  responseData.push({ status: 'true', message: 'success', data: ResultOutput });
  return res.json(responseData);
}));

// ---------------------------------------------------------------- withdrawal_Balance
// auth
router.post('/api/withdrawal_Balance', auth, h(async (req, res) => {
  const Plid = reqLong(req.p.Plid);
  const Row = await queryOne('affiliate', 'select * from member_performance where regno = @regno limit 1', { regno: Plid });
  const currentincome = Row.availablecommissionwallet; // Row null => NullReferenceException (500) as in legacy
  res.json([{ status: 'true', message: 'success', data: currentincome }]);
}));

// ---------------------------------------------------------------- ProcessPayout (internal, public method in legacy)
async function ProcessPayout(Plid, Wdid) {
  let ret = '';
  let payresponseMsg = '';
  let paystatus = '';
  const Regno = convInt(Plid);

  const data = await UtilityClass.WithdrawalByPayunie(Regno);
  payresponseMsg = data[0].status;
  paystatus = data[0].statusMessage;

  let ActivityByUserId = '';
  let remarks = '';
  let Transaction = '';
  let paiddate = '';
  let status = 0;
  let PaidMode = 0;

  const un = await queryOne('affiliate', 'select username from member_master where regno = @regno limit 1', { regno: Regno });
  const username = un ? un.username : null;

  if (payresponseMsg.toUpperCase() === 'ACCEPTED') {
    if (paystatus.toUpperCase() === 'SUCCESS') {
      status = 1;
      ActivityByUserId = 'Self';
      PaidMode = 13;
      remarks = 'Success';
      Transaction = '';
      paiddate = dotnetNow();
    } else if (paystatus.toUpperCase() === 'FAIL') {
      const jsonObject = typeof data[0].error === 'string' ? JSON.parse(data[0].error) : data[0].error;
      status = 2;
      ActivityByUserId = 'Self';
      PaidMode = 13;
      remarks = jsonObject.status;
      Transaction = '';
      paiddate = dotnetNow();
    } else {
      status = 4;
      ActivityByUserId = 'Self';
      PaidMode = 13;
      remarks = 'PENDING';
      Transaction = '';
      paiddate = dotnetNow();
    }
  } else if (paystatus.toLowerCase() === 'insufficient wallet balance') {
    status = 4;
    ActivityByUserId = 'Self';
    PaidMode = 13;
    remarks = 'PENDING';
    Transaction = '';
    paiddate = dotnetNow();
  } else {
    status = 2;
    ActivityByUserId = 'Self';
    PaidMode = 13;
    remarks = 'Failed';
    Transaction = '';
    paiddate = dotnetNow();
  }

  // PORT-NOTE: legacy also passed an unused @SendBy SqlParameter that the SQL text never referenced, so the proc default ('') applied; it is not passed here.
  const spRow = await procOne('affiliate', 'usp_bankwithdrawal_approveorreject', {
    wdid: Wdid, mode: status, strresult: remarks, activitybyuserid: ActivityByUserId, paidmode: PaidMode,
    remark: remarks, transaction: Transaction, paiddate,
  });
  ret = mustStr(spRow ? spRow.strresult : null);

  if (ret === 'SUCCESS') {
    if (status === 1) {
      const m = await queryOne('affiliate', 'select emailid from member_master where lower(username) = lower(@u) limit 1', { u: username });
      const EmailId = m ? m.emailid : null;
      const emailmsg = await queryOne('affiliate', 'select * from tbl_emailaction where eid = 40 limit 1');
      const WithdrawalMsg = emailmsg.email_content;
      const DynamicSponcerMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(username, WithdrawalMsg, EmailId, '', 32, '', '', 0, 0, '');
      if (emailmsg.email_send_status === 1) {
        bg(() => UtilityClass.SendEmailByApiSetting(username, '', '', '', '', '', EmailId.toLowerCase(), emailmsg.email_subject, DynamicSponcerMsg, null));
      }
    } else if (status === 2) {
      const m = await queryOne('affiliate', 'select emailid from member_master where lower(username) = lower(@u) limit 1', { u: username });
      const EmailId = m ? m.emailid : null;
      const emailmsg = await queryOne('affiliate', 'select * from tbl_emailaction where eid = 41 limit 1');
      const WithdrawalMsg = emailmsg.email_content;
      const DynamicSponcerMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(username, WithdrawalMsg, EmailId, '', 33, '', remarks, 0, 0, '');
      if (emailmsg.email_send_status === 1) {
        bg(() => UtilityClass.SendEmailByApiSetting(username, '', '', '', '', '', EmailId.toLowerCase(), emailmsg.email_subject, DynamicSponcerMsg, null));
      }
    }
  }
  return status;
}

module.exports = router;
