'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\HomeController.cs (class HomeController => /admin/Home/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'affiliate';
const C = 'Home';

// ---------------------------------------------------------------- ActionResult Index()
// public
// route-config: "Default" route "{controller}/{action}/{id}" defaults Home/Index => "/" and "/Home"
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin'], asyncHandler(async (req, res) => {
  if (req.hostname !== 'localhost') { // Request.Url.Host != "localhost"
    const ViewBag = {};
    // _TBL_COMPANYMASTER.Where(a => a.COMID == 1).Select(a => a.SOFTWARE_URL).FirstOrDefault()
    const r = await db.queryOne(DB, 'select software_url from tbl_companymaster where comid = 1 limit 1');
    ViewBag.URL = r ? r.software_url : null;
    // Response.Redirect(null) => ArgumentNullException
    if (ViewBag.URL === null || ViewBag.URL === undefined) throw new Error("Value cannot be null.\r\nParameter name: url");
    return res.json({ redirect: ViewBag.URL, URL: ViewBag.URL }); // Response.Redirect(ViewBag.URL) ends the request
  }
  return res.json({ redirect: 'Login/Index' }); // RedirectToAction("Index", "Login")
}));

module.exports = router;
