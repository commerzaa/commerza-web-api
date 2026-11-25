'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Add_API.cs (class Add_APIController)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nstr, nint, nre, toInt32, outStr, col, view, mapRows } = require('./_shared/batch02-common');

const router = express.Router();
const C = 'Add_API';

const API_MAINMENU_LIST_PROPS = ['MID', 'TITLE', 'STATUS'];

// ---------------------------------------------------------------- Index()
// auth (Session["Admin_User"] == null => RedirectToAction("adminlogin","Index"))
// route-config: "AdminPanel/add-api" -> Add_API/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/add-api'], adminAuth, asyncHandler(async (req, res) => {
  return view(res, '~/Views/AdminPanel/Add_API/Index.cshtml');
}));

// ---------------------------------------------------------------- JsonResult AddNewAPI(string apiMainMenu, string apitype, string apiname, string apilink, string pcontent, string pname, string datatype, string pdescription, string response, string remark, int? mode)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/AddNewAPI{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let pcontent = nstr(req.p.pcontent);
  let response = nstr(req.p.response);
  nint(req.p.mode); // int? mode (unused by legacy)
  if (pcontent === null) throw nre();
  pcontent = pcontent.split('lessthan').join('<');
  pcontent = pcontent.split('greatthan').join('>');
  if (response === null) throw nre();
  response = response.split('lessthan').join('<');
  response = response.split('greatthan').join('>');
  const row = await db.procOne(DB, 'USP_APICMS', {
    APIMAINMENU: nstr(req.p.apiMainMenu), TYPE: nstr(req.p.apitype), NAME: nstr(req.p.apiname), LINK: nstr(req.p.apilink),
    PARAMETERCONTENT: pcontent, PARAMETERNAME: nstr(req.p.pname), DATATYPE: nstr(req.p.datatype), PARAMETERDESCRIPTION: nstr(req.p.pdescription),
    RESPONSE: response, REMARK: nstr(req.p.remark), ACTIVE: 1, STATUS: 1, MODE: 1,
  });
  const result = toInt32(outStr(col(row, 'intresult')) || 'x'); // int.Parse("") => FormatException
  return res.json(result);
}));

// ---------------------------------------------------------------- JsonResult getAPI_MainMenu()
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/getAPI_MainMenu{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.query(DB, 'select mid, title from tbl_mainmenu_apicms where status = 1', {});
  return res.json(mapRows(rows, API_MAINMENU_LIST_PROPS).map((r) => ({ ...r, STATUS: r.STATUS === null ? 0 : r.STATUS })));
}));

module.exports = router;
