'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\API_Reference.cs (class API_ReferenceController => /API_Reference/...)
// Database: affiliate (Db_Affiliate). (class API_Menu of this file = API_MENU_PROPS in _shared/adminSession.js, used by the V4 login.)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const { DB, sv } = require('./_shared/batch03-common');

const router = express.Router();
const C = 'API_Reference';

/** class API_Doc_List (API_Doc_List.cs) */
const API_DOC_LIST_PROPS = ['ROWNUMBER', 'APIID', 'APIMAINMENU', 'TYPE', 'NAME', 'LINK', 'PARAMETERCONTENT', 'PARAMETERNAME', 'DATATYPE',
  'PARAMETERDESCRIPTION', 'RESPONSE', 'REMARK', 'ACTIVE', 'STATUS', 'CREATEDATE', 'UPDATEDATE'];

// ---------------------------------------------------------------- Index()
// auth
// route-config: "AdminPanel/api-reference" -> API_Reference/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/api-reference'], adminAuth, asyncHandler(async (req, res) => {
  try {
    const rows = await db.proc(DB, 'USP_APICMS', {
      APIMAINMENU: '', TYPE: '', NAME: '', LINK: '', PARAMETERCONTENT: '', PARAMETERNAME: '', DATATYPE: '', PARAMETERDESCRIPTION: '',
      RESPONSE: '', REMARK: '', ACTIVE: 0, STATUS: 0, MODE: 2, APIID: 0, FROMDATE: '', TODATE: '', SEARCHFIELD: '', SEARCHVALUE: '',
      STARTROWINDEX: 1, MAXROWS: 1000000, ORDERBYFIELD: '',
    });
    return res.json({ view: '~/Views/AdminPanel/API_Reference/Index.cshtml', Model: mapRows(rows, API_DOC_LIST_PROPS) });
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_APICMS');
    return res.json({ view: '~/Views/AdminPanel/API_Reference/Index.cshtml', Model: null });
  }
}));

// ---------------------------------------------------------------- JsonResult APIbyID(string divid)
// public (legacy had no session check; read-only API documentation lookup)
router.all(`/admin/${C}/APIbyID{/:id}`, asyncHandler(async (req, res) => {
  let divid = sv(req.p.divid);
  const id = divid;
  if (divid === null) divid = '';
  else divid = 'www.appapi.localhost:13789/api/app/v1/' + divid;
  // ... where Link = '<divid>' or Link like '%<id>%' and Status = 1   (AND binds tighter, kept; parameterised)
  const row = await db.queryOne(DB, `select apiid, type, name, link, parametercontent, parametername, datatype, parameterdescription, response,
    remark, active, status, createdate, updatedate, apimainmenu from tbl_apicms
    where link = @divid or link like '%' || @id || '%' and status = 1 limit 1`, { divid, id: id === null ? '' : id });
  if (!row) return res.type('application/json').send(''); // Json(null)
  return res.json(mapRow(row, API_DOC_LIST_PROPS));
}));

module.exports = router;
