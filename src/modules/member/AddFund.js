'use strict';
/** Port of Member/Controllers/CustomerPanel/AddFund.cs (AddFundController). Prefix /member. DB: 'affiliate' */
const express = require('express');
const { proc, procOne } = require('../../db');
const { mapRows, mapRow } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';

const FUND_PROPS = ['rowNumber', 'CREDITDATE', 'DEPOSITDATE', 'DEPOSITAMOUNT', 'PAYMENTTYPE', 'STATUS', 'COMMENT'];
const PAY_PROPS = ['PLID', 'Name', 'Payamount', 'Product', 'Email', 'Mobile', 'PaymentMode', 'CommentORRemark', 'OrderId'];
const outCol = (rows, name) => { const f = Array.isArray(rows) ? rows[0] : rows; if (!f) return ''; const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined || f[k] === null ? '' : String(f[k]); };

/** Legacy public helper PayByPayYouMoney(PLID, Amount, CommentORRemark) (called by AddFundInWallet; not routed). */
async function PayByPayYouMoney(req, PLID, Amount, CommentORRemark) {
  let ReturnOutput = 'PayYouMoney';
  try {
    const r = await procOne(DB, 'usp_paybypayumoney', { plid: PLID, amount: Amount, commentorremark: CommentORRemark });
    const Obj = r ? mapRow(r, PAY_PROPS) : null;
    sessionStore.set(req, 'PaymentForOrder', Obj); // Session["PaymentForOrder"] = Obj
  } catch (Exp) {
    ReturnOutput = 'Some Exception Occur : ' + Exp.message;
    await new DataUtility().ErrorInsert(0, Exp.message, 'Usp_PayByPayuMoney', 0, req.originalUrl.split('?')[0]);
  }
  return ReturnOutput;
}

// auth
router.all(['/member/AddFund/Index{/:id}'], auth, asyncHandler(async (req, res) => {
  sessionStore.set(req, 'PaymentForOrder', null); // Session["PaymentForOrder"] = null
  const rows = await proc(DB, 'usp_add_fund', {});
  res.json({ view: '~/Views/CustomerPanel/AddFund/Index.cshtml', Model: mapRows(rows, FUND_PROPS) });
}));

// auth
router.all('/member/AddFund/AddFundInWallet{/:id}', auth, asyncHandler(async (req, res) => {
  const Amount = req.p.Amount;
  const CommentORRemark = req.p.CommentORRemark;
  const PLID = Math.trunc(Number(req.user.plid));
  const ReturnOutput = await PayByPayYouMoney(req, String(PLID), Amount, CommentORRemark);
  res.json(ReturnOutput);
}));

// auth
router.all('/member/AddFund/AddFundInWalletByOffline{/:id}', auth, asyncHandler(async (req, res) => {
  const PaymentMode = req.p.PaymentMode;
  const Amount = req.p.Amount;
  const BankName = req.p.BankName;
  const BranchName = req.p.BranchName;
  const ReferenceNumber = req.p.ReferenceNumber;
  const DateV = req.p.Date;
  const CommentORRemark = req.p.CommentORRemark; // (Receipt is bound by the legacy action but never used)
  const PLID = Math.trunc(Number(req.user.plid));
  const ImageName = '';
  // PORT-NOTE: @STRRESULT OUT is returned as a column of the result row; @AMOUNTINPOUND '' (SQL Server MONEY => 0) is passed as 0.
  const rows = await proc(DB, 'usp_addfundnew', {
    plid: PLID, paymenttype: PaymentMode, depositamount: Amount, checkno: ReferenceNumber, depositdate: DateV, bankname: BankName, branchname: BranchName,
    accountnumber: '', couponno: '', fromloginid: '', password: '', reqfrom: '', remark: CommentORRemark, fname: '', lname: '', emailid: '', contactno: '',
    ipaddress: ImageName, amountinpound: 0,
  });
  const ReturnOutput = outCol(rows, 'strresult');
  sessionStore.set(req, 'PaymentForOrder', null);
  res.json(ReturnOutput);
}));

module.exports = router;
