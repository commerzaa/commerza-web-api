'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Common_SettingsController.cs
// (class Common_SettingsController => /admin/Common_Settings/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');
const B = require('./_shared/batch05-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Common_Settings';

/** class Commonsetting */
const SETTING_PROPS = ['caption', 'CLUBDESC', 'Value', 'Symbol', 'Row', 'Emp_Name', 'ActivityReport'];

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Common" -> Common_Settings/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Common'], adminAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  let settings = mapRows(await db.query(DB, `select caption, clubdesc, (limits)::numeric(10,2) as value, symbol from settings
    where active = 1 and caption = 'IsTaxApplicableOnPackagePrice'`, {}), SETTING_PROPS);
  ViewBag.Capation = settings;
  settings = mapRows(await db.query(DB, `select row_number() over (order by ch.hid desc) as row, ch.capation as caption, ch."limit" as value,
    em.emp_name, ch.activityreport from tbl_commonsettings_history ch left join tbl_employee_master em on ch.userid = em.emp_id
    order by activityreport desc`, {}), SETTING_PROPS);
  return res.json({ view: '~/Views/AdminPanel/Common_Settings/Index.cshtml', Model: settings, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult updatesettings(string getdata, string Hdata)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/updatesettings{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const getdata = B.nStr(req.p.getdata);
  const Hdata = B.nStr(req.p.Hdata);
  let returnval = 1;
  const splitfeild = B.splitCsv(getdata);
  const historydata = B.splitCsv(Hdata);
  const userid = req.user.emp_id;
  for (const item of historydata) {
    if (item.trim() !== '') {
      const splitv = item.split(':');
      const getfie = splitv[0].trim();
      if (splitv[1] === undefined) throw new Error('Index was outside the bounds of the array.');
      let getval = splitv[1].trim();
      if (getval.trim() === '') getval = '0.00';
      if (getfie.trim() !== '') {
        // PORT-NOTE: legacy concatenated the values into the SQL (injection); parameterised here. LIMIT was a numeric literal.
        await db.exec(DB, `insert into tbl_commonsettings_history (capation, "limit", userid, activityreport)
          values (@getfie, (@getval)::numeric, @userid, now())`, { getfie, getval, userid });
      }
    }
  }
  for (const items of splitfeild) {
    if (items.trim() !== '') {
      if (returnval > 0) {
        const splitvalue = items.split(':');
        const getfield = splitvalue[0].trim();
        if (splitvalue[1] === undefined) throw new Error('Index was outside the bounds of the array.');
        let getvalue = splitvalue[1].trim();
        if (getvalue.trim() === '') getvalue = '0.00';
        if (getfield.trim() !== '') {
          // objutil.ExecuteSql(...) returns the affected row count
          returnval = await db.exec(DB, 'update settings set limits = (@getvalue)::numeric where caption = @getfield', { getvalue, getfield });
          const empcode = req.user.emp_code; // read but unused (legacy)
          void empcode;
        }
      }
    }
  }
  if (returnval > 0) return res.json('ok');
  return res.json('error');
}));

module.exports = router;
