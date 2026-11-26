'use strict';
// Ported from C:/Users/MY ASUS/cluster/ClusterofferShopingPortal/ClusterofferShopingPortal/Controllers/CustomerPanel/MyDownline.cs
// (class MyDownlineController => /portal/MyDownline/...). Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const { DB, view, outTotal, nInt, nStr, toInt32 } = require('./_shared/batch-06-common');

const router = express.Router();

/** class MyDownline */
const MYDOWNLINE_PROPS = ['rownumber', 'EmpLevel', 'LoginId', 'Name', 'Emailid', 'mobile', 'Regdate', 'DOC', 'Active', 'Status', 'paystatus',
  'UserName', 'ImageName', 'SpLoginId', 'SpEmailid', 'SpMobile', 'SpRegdate', 'SpUserName', 'Help_Amount', 'Confirm_Amount', 'ISDcode',
  'COUNTRYNAME'];

// ---------------------------------------------------------------- Index(SearchField, SearchValue, fromdate, todate, Username, EmailID, SponserID,
//                                                                     int? page, levelnumber, int? ddlcustpage, int? ReferralType)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "referral/MyDownline" -> MyDownline/Index
router.all(['/portal/MyDownline/Index{/:id}', '/portal/MyDownline', '/portal/referral/MyDownline{/:id}'], ps.customerAuth,
  asyncHandler(async (req, res) => {
    const d = (k) => { const v = nStr(req.p[k]); return v === null ? '' : v; };
    const ViewBag = {};
    let ddlcustpage = nInt(req.p.ddlcustpage);
    if (ddlcustpage === null) ddlcustpage = 50;
    const SearchField = d('SearchField');
    const SearchValue = d('SearchValue');
    const fromdate = d('fromdate');
    const todate = d('todate');
    let levelnumber = d('levelnumber');
    if (SearchField === '0') ViewBag.lable = '0';
    if (SearchField === '1') ViewBag.lable = '1';
    const Username = d('Username');
    const EmailID = d('EmailID');
    const SponserID = d('SponserID');
    let ReferralType = nInt(req.p.ReferralType);
    if (ReferralType === null) ReferralType = 0;

    const MaxRows = toInt32(ddlcustpage);
    let page = nInt(req.p.page);
    if (page === null) page = 1;
    levelnumber = '0';
    const rows = await db.proc(DB, 'usp_direct_tree_list', {
      LoginID: req.user.username, // ((Login)Session["Plid"]).UserName
      StartRowIndex: page,
      MaxRows,
      SearchField: SearchField.trim(),
      SearchValue: SearchValue.trim(),
      fromDate: fromdate.trim(),
      ToDate: todate.trim(),
      levenumber: levelnumber,
      Username: Username.trim(),
      EmailID: EmailID.trim(),
      SponserID: SponserID.trim(),
      ReferralType,
    });
    const AllFreeEpinList = mapRows(rows, MYDOWNLINE_PROPS);
    const TotalRecord = outTotal(rows, 'totalcount');
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromdate;
    ViewBag.toDate = todate;
    ViewBag.levelnumber = levelnumber;
    ViewBag.ddlcustpage = ddlcustpage;
    view(res, '~/Views/CustomerPanel/MyDownline/Index.cshtml', AllFreeEpinList, ViewBag);
  }));

module.exports = router;
