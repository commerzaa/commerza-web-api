'use strict';
/**
 * Helpers private to admin port batch06: shared body of Debit_Fund.DebitFunds and DebitIncomeWallet.DebitFunds
 * (identical C# except the procedure name: [Usp_Fund_Transfer] vs [USP_Income_TRANSFER]).
 * Exports: debitFunds(req, res, procName)
 */
const db = require('../../../db');
const UtilityClass = require('../../../lib/admin/UtilityClass');
const { nStr, reqInt, reqDec, outStr } = require('./batch06_common');
const { validateDebit, gaCheck, memberByUserName, smsAction, emailAction, need, fireSms, fireEmail } = require('./batch06_debit');

const DB = 'affiliate';

async function debitFunds(req, res, procName) {
  const Username = nStr(req.p.Username);
  const Amount = reqDec(req.p.Amount, 'Amount');
  const Id = reqInt(req.p.Id, 'Id');
  const Remark = nStr(req.p.Remark);
  const GAKEY = nStr(req.p.GAKEY);
  const EmpId = req.user.emp_id;
  let ret = '';
  const v = validateDebit(Username, Amount, Id);
  if (v) return res.json(v);
  const ga = await gaCheck(EmpId, GAKEY);
  if (ga) return res.json(ga);
  const MemberDetails = await memberByUserName(Username);
  const Employeeid = req.user.emp_id;
  // [<proc>] @Mode,@RegNo,@ByUserRegNo,@Type,@Amount,@Remark,@StrResult OUT,@TotalCount OUT,@FromDate,@ToDate,@StartRowIndex,@MaxRows,@TFHID,
  //   @EMAILID,@MINAMOUNT,@MAXAMOUNT,@ISVERIFIEDBYADMIN,@ORDERBYFIELD,@PaymentMode,@TransactionId,@ACTIVITYBYUSER,@ACTIVITY_BY_EMP_ID,@TXID,
  //   @AmountBTC,@DATE,@APROVETRANSACTIONID,@AMTTOTAL out,@EID,@orderbydate,@SessionID   (TransactionalBehavior.DoNotEnsureTransaction)
  const row = await db.procOne(DB, procName, {
    Mode: '3', RegNo: Id, ByUserRegNo: '0', Type: 'Dr', Amount, Remark, FromDate: '', ToDate: '', StartRowIndex: '1', MaxRows: '100',
    TFHID: 0, EMAILID: '', MINAMOUNT: 0, MAXAMOUNT: 0, IsVerifiedByAdmin: -1, ORDERBYFIELD: '', PaymentMode: 0, TransactionId: '',
    ACTIVITYBYUSER: '', ACTIVITY_BY_EMP_ID: 0, TXID: '', AmountBTC: 0, DATE: '', APROVETRANSACTIONID: '', EID: Employeeid,
    orderbydate: '', SessionID: '0',
  });
  ret = outStr(row, 'StrResult');
  if (ret === 'success') {
    const Frommsg = await smsAction(1049);
    const Frommessg = await UtilityClass.FindingSmsContentWithUserIdPassword(Username, need(Frommsg).Sms_Content, '', '', 36, Id, 0, '', '', Amount, 0);
    const Debitemailmsg = await emailAction(1045);
    const DynamicMsgForDebit = await UtilityClass.FindingEmailContentWithUserIdPassword('', need(Debitemailmsg).Email_Content, need(MemberDetails).Emailid, '', 39, '', '', Id, 0, '', '', 0, Amount, 0);
    fireSms(Frommsg, MemberDetails, Frommessg);
    fireEmail(Debitemailmsg, MemberDetails, DynamicMsgForDebit);
  }
  return res.json(ret);
}

module.exports = { debitFunds };
