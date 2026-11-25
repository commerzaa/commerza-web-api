'use strict';
// Ported from C:/Users/MY ASUS/cluster/ClusterofferShopingPortal/ClusterofferShopingPortal/Controllers/CustomerPanel/MyCustomerList.cs
// (class MyCustomerListController => /portal/MyCustomerList/...). Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const { DB, view, outTotal, nInt, nStr } = require('./_shared/batch-06-common');

const router = express.Router();

/** class MyCustomerList */
const MYCUSTOMERLIST_PROPS = ['RowNumber', 'PLID', 'REGNO', 'LOGINID', 'USERNAME', 'FULLNAME', 'FNAME', 'LNAME', 'PHONE', 'EMAILID', 'STATUS',
  'REGDATE'];

// ---------------------------------------------------------------- Index(fromdate, todate, Username, EmailID, Phone, int? page)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "referral/my-customer-list" -> MyCustomerList/Index
router.all(['/portal/MyCustomerList/Index{/:id}', '/portal/MyCustomerList', '/portal/referral/my-customer-list'], ps.customerAuth,
  asyncHandler(async (req, res) => {
    const d = (k) => { const v = nStr(req.p[k]); return v === null ? '' : v; };
    const fromdate = d('fromdate');
    const todate = d('todate');
    const Username = d('Username');
    const EmailID = d('EmailID');
    const Phone = d('Phone');
    let page = nInt(req.p.page);
    const MaxRows = await UtilityClass.GridPageSize();
    if (page === null) page = 1;
    let Obj = [];
    const ViewBag = {};
    try {
      const Plid = Number(req.user.plid);
      const rows = await db.proc(DB, 'usp_referralcustomerlist', {
        PLID: Plid, STARTROWINDEX: page, MAXROWS: MaxRows, FromDate: fromdate.trim(), ToDate: todate.trim(), Username: Username.trim(),
        EmailID: EmailID.trim(), Phone: Phone.trim(), // Phone searching is not started
      });
      Obj = mapRows(rows, MYCUSTOMERLIST_PROPS);
      const TotalRecord = outTotal(rows, 'totalcount');
      ViewBag.CurrentPage = page;
      ViewBag.GridPageSize = MaxRows;
      ViewBag.TotalRecord = TotalRecord;
      ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
      ViewBag.EmailID = EmailID;
      ViewBag.Username = Username;
      ViewBag.Phone = Phone;
      ViewBag.fromDate = fromdate;
      ViewBag.toDate = todate;
    } catch (Ex) {
      // swallowed (legacy empty catch)
    }
    view(res, '~/Views/CustomerPanel/MyCustomerList/Index.cshtml', Obj, ViewBag);
  }));

module.exports = router;
