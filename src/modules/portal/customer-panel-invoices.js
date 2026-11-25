'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Invoices.cs (InvoicesController)
// Actions: Index, InvicesPrintable (2). [CheckResellerTimeout] has a commented-out body => no check.
const express = require('express');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const { DB } = require('./_shared/batch-04-common');

const router = express.Router();

const GetInvoiceList = ['SFDID', 'SNO', 'DepositAmount', 'DateTime', 'PAYMENTTYPE', 'REMARK', 'FUNDTYPE', 'TRANSID'];
const InvoicePrint = ['RowNumber', 'TASMID', 'TotalPayableAmount', 'PaymentMode', 'ModeName', 'CommentORRemark', 'RegNo', 'ImageName', 'BankName',
  'BranchName', 'ReferenceDate', 'ReferenceNumber', 'WalletId', 'TransactionPassword', 'GoogleAuthenticationCode', 'AllPackageId', 'AllPackageType',
  'AllPackageAmount', 'PuchaseDate', 'IsActive', 'Status', 'Plid', 'AllPackageName', 'IsApproved', 'Transaction_id', 'service_tax', 'service_tax_per',
  'With_out_tax_Amount', 'username', 'fullname', 'mobile', 'emailid', 'ADDRESS', 'CITY', 'POSTALCODE', 'alladdress', 'sid', 'statename',
  'statenamepincode', 'invoice_no'];

const plidOrZero = (req) => (ps.isCustomer(req) ? Number(req.user.plid) : 0);

// public (legacy: no session => Plid = 0, the redirect is commented out)
router.all(['/portal/Invoices/Index{/:id}', '/portal/Invoices'], ps.portalSession, asyncHandler(async (req, res) => {
  const Plid = plidOrZero(req);
  // Convert(Varchar(11),DepositAmount) (money, style 0 => 2 decimals) / Convert(Varchar(11),DateTime,106) => 'dd Mon yyyy'
  const rows = await db.query(DB, `select sfdid, row_number() over (order by sfdid desc) as sno,
            cast(cast(depositamount as numeric(19,2)) as varchar(11)) as depositamount,
            cast(to_char(datetime, 'DD Mon YYYY') as varchar(11)) as datetime, paymenttype,
            remark, fundtype, transid from tbl_sponserfunddetails where plid = @plid`, { plid: Plid });
  res.json({ view: '~/Views/CustomerPanel/Invoices/Index.cshtml', Model: mapRows(rows, GetInvoiceList) });
}));

// public (legacy: session check commented out, Plid = 0 without session)
// route-config: merchant/invoices/{ID} and view-invoices/{ID} -> Invoices/InvicesPrintable
router.all(['/portal/Invoices/InvicesPrintable{/:ID}', '/portal/merchant/invoices{/:ID}', '/portal/view-invoices{/:ID}'], ps.portalSession, asyncHandler(async (req, res) => {
  const DecryptId = await UtilityClass.Decryptword(req.p.ID === undefined ? null : req.p.ID);
  const Plid = plidOrZero(req);
  // USP_USERINVOICE @PLID,@SFDID
  const rows = await db.proc(DB, 'usp_userinvoice', { plid: Plid, sfdid: DecryptId });
  res.json({ view: '~/Views/CustomerPanel/Invoices/Invoices.cshtml', Model: mapRows(rows, InvoicePrint) });
}));

module.exports = router;
