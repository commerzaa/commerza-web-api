'use strict';
// Port of Member\Common\Controllers\CustomerPanel\Invoices.cs (InvoicesController)
const express = require('express');
const router = express.Router();
const { auth, optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const DB = 'affiliate';
const GetInvoiceList = ['SFDID', 'SNO', 'DepositAmount', 'DateTime', 'PAYMENTTYPE', 'REMARK', 'FUNDTYPE', 'TRANSID'];
const InvoicePrint = ['RowNumber', 'TASMID', 'TotalPayableAmount', 'PaymentMode', 'ModeName', 'CommentORRemark', 'RegNo', 'ImageName', 'BankName', 'BranchName', 'ReferenceDate', 'ReferenceNumber', 'WalletId', 'TransactionPassword', 'GoogleAuthenticationCode', 'AllPackageId', 'AllPackageType', 'AllPackageAmount', 'PuchaseDate', 'IsActive', 'Status', 'Plid', 'AllPackageName', 'IsApproved', 'Transaction_id', 'service_tax', 'service_tax_per', 'With_out_tax_Amount', 'username', 'fullname', 'mobile', 'emailid', 'ADDRESS', 'CITY', 'POSTALCODE', 'alladdress', 'sid', 'statename', 'statenamepincode', 'invoice_no'];

// auth (legacy had no session check and used Plid=0 without a session; it only returns the logged in member's deposits)
router.all('/member/Invoices/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = req.user && req.user.plid ? Number(req.user.plid) : 0;
  const rows = await db.query(DB, `Select SFDID,ROW_NUMBER() Over(Order By SFDID Desc) As SNO,cast(DepositAmount as varchar(11)) As DepositAmount,
    to_char(DateTime,'DD Mon YYYY') As DateTime,PAYMENTTYPE,
    REMARK,FUNDTYPE,TRANSID From TBL_SPONSERFUNDDETAILS Where PLID=@plid`, { plid: Plid });
  res.json(mapRows(rows, GetInvoiceList));
}));

// public (printable invoice link carries the encrypted invoice id; legacy session check is commented out)
// route-config: referral/invoices/{ID} and view-invoices/{ID} -> Invoices/InvicesPrintable
router.all(['/member/Invoices/InvicesPrintable{/:ID}', '/member/referral/invoices{/:ID}', '/member/view-invoices{/:ID}'], optionalAuth, asyncHandler(async (req, res) => {
  const ID = req.p.ID === undefined ? req.params.ID : req.p.ID;
  const DecryptId = await UtilityClass.Decryptword(ID);
  let Plid = 0;
  if (req.user && req.user.plid) Plid = Number(req.user.plid);
  if (DecryptId !== null && DecryptId !== undefined && DecryptId !== '') Plid = 0;
  const rows = await db.proc(DB, 'usp_userinvoice', { plid: Plid, sfdid: DecryptId });
  res.json(mapRows(rows, InvoicePrint));
}));

module.exports = router;
