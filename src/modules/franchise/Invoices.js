'use strict';
/**
 * Port of Franchise\Controllers\CustomerPanel\Invoices.cs (InvoicesController)
 * Actions: Index, InvicesPrintable (2)
 */
const express = require('express');
const router = express.Router();
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const DB = 'shopping'; // Franchise DataBaseContext => Db_Shopping (Web.config)
const GETINVOICELIST_PROPS = ['SFDID', 'SNO', 'DepositAmount', 'DateTime', 'PAYMENTTYPE', 'REMARK', 'FUNDTYPE', 'TRANSID'];
const INVOICEPRINT_PROPS = ['RowNumber', 'TASMID', 'TotalPayableAmount', 'PaymentMode', 'ModeName', 'CommentORRemark', 'RegNo', 'ImageName', 'BankName', 'BranchName', 'ReferenceDate',
  'ReferenceNumber', 'WalletId', 'TransactionPassword', 'GoogleAuthenticationCode', 'AllPackageId', 'AllPackageType', 'AllPackageAmount', 'PuchaseDate', 'IsActive', 'Status', 'Plid',
  'AllPackageName', 'IsApproved', 'Transaction_id', 'service_tax', 'service_tax_per', 'With_out_tax_Amount', 'username', 'fullname', 'mobile', 'emailid', 'ADDRESS', 'CITY', 'POSTALCODE',
  'alladdress', 'sid', 'statename', 'statenamepincode', 'invoice_no'];

// public (legacy: Plid falls back to 0 when there is no session)
router.all('/franchise/Invoices/Index{/:id}', optionalAuth, asyncHandler(async (req, res) => {
  const Plid = req.user && req.user.did !== undefined ? Number(req.user.did) : 0;
  const rows = await db.query(DB, `Select SFDID,ROW_NUMBER() Over(Order By SFDID Desc) As SNO,CAST(DepositAmount AS VARCHAR(11)) As DepositAmount,
            to_char(DateTime,'DD Mon YYYY') As DateTime,PAYMENTTYPE,
            REMARK,FUNDTYPE,TRANSID From TBL_SPONSERFUNDDETAILS Where PLID=@plid`, { plid: Plid });
  res.json({ Model: mapRows(rows, GETINVOICELIST_PROPS) });
}));

// public (legacy: Plid falls back to 0 when there is no session)
router.all('/franchise/Invoices/InvicesPrintable{/:id}', optionalAuth, asyncHandler(async (req, res) => {
  const DecryptId = await UtilityClass.Decryptword(req.p.ID);
  const Plid = req.user && req.user.did !== undefined ? Number(req.user.did) : 0;
  const rows = await db.proc(DB, 'USP_USERINVOICE', { PLID: Plid, SFDID: DecryptId });
  res.json({ Model: mapRows(rows, INVOICEPRINT_PROPS) });
}));

module.exports = router;
