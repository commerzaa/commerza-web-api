'use strict';
// Ported from ClusterofferShopingPortal\Controllers\CustomerPanel\AccountStatement.cs (class AccountStatementController => /portal/AccountStatement/...)
// Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const { DB, view, toInt64 } = require('./_shared/batch-02-common');

const router = express.Router();
const C = '/portal/AccountStatement';

/** class AccountStatement */
const ACCOUNT_STATEMENT = ['Number', 'Cr', 'Dr', 'Balance', 'Date', 'CommentOrRemark'];

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "referral/account-statement" -> AccountStatement/Index
router.all([`${C}/Index{/:id}`, C, '/portal/referral/account-statement'], ps.customerAuth, asyncHandler(async (req, res) => {
  const PLID = toInt64(req.user.plid);
  // Convert(Varchar(11),Date,106) => 'dd Mon yyyy'
  const rows = await db.query(DB, `Select
ROW_NUMBER() Over(Order By TASID Desc) As Number, Cr, Dr, Balance,
to_char(Date, 'DD Mon YYYY') As Date,
(Case When CommentOrRemark = '' Then 'N/A' Else CommentOrRemark End) As CommentOrRemark
From Tbl_AccountStatement
Where PLID = @PLID`, { PLID });
  const AccountStatementLi = mapRows(rows, ACCOUNT_STATEMENT);
  return view(res, '~/Views/CustomerPanel/AccountStatement/Index.cshtml', AccountStatementLi);
}));

module.exports = router;
