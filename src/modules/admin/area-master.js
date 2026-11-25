'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\AreaMasterController.cs (class AreaMasterController => /AreaMaster/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const { DB, col, str, sv, nint, toStr, nullRef, tab, nowStamp, excelLink, pagePermissions, tsvExport } = require('./_shared/batch03-common');

const router = express.Router();
const C = 'AreaMaster';

/** class Area_MAster */
const AREA_PROPS = ['STATENAME', 'CITYNAME', 'PINCODE', 'PMID', 'AID', 'ROWNUMBER', 'SID1', 'CTID1', 'CACTIVE'];
const BIND_STATE_PROPS = ['STATENAME', 'SID'];
const BIND_CITY_PROPS = ['CITYNAME', 'CTID'];
const PINCODE_POSTAL_PROPS = ['Name', 'Description', 'BranchType', 'DeliveryStatus', 'Taluk', 'Circle', 'District', 'Division', 'Region',
  'State', 'Country'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (kept as module state).
let url = '';
let url1 = '';

/** public JsonResult GET_STATE_AND_CITY(string STATE, string MODE) - returns the Json payload; sets ViewBag.state when STATE == "" */
async function GET_STATE_AND_CITY(STATE, MODE, ViewBag) {
  let state = [];
  let city = [];
  try {
    const params = { STARTROW: '1', MAXROW: '100', STATE, PINCODE: '', PMID: '0', CACTIVE: '0', MODE, AID: '0', CITY: '' };
    if (STATE === '') {
      state = mapRows(await db.proc(DB, 'USP_AREA_MASTER', params), BIND_STATE_PROPS);
      if (ViewBag) ViewBag.state = state;
    } else {
      city = mapRows(await db.proc(DB, 'USP_AREA_MASTER', params), BIND_CITY_PROPS);
    }
    return STATE === '' ? state : city;
  } catch (ex) {
    state = null;
    return state;
  }
}

/** public void ExportReport(string State1, string Pincode, string City) */
async function ExportReport(req, res, ViewBag, State1, Pincode, City) {
  const userid = req.user.emp_id;
  const Filename = `PinCodeMaster_${userid}_${nowStamp()}`;
  await db.proc(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, FILENAME: Filename, MODE: '1' });
  if (State1 === null || Pincode === null || City === null) nullRef();
  const AllEPinRequestsList = mapRows(await db.proc(DB, 'USP_AREA_MASTER', {
    STARTROW: 1, MAXROW: 999999, STATE: State1.trim(), PINCODE: Pincode.trim(), PMID: '0', CACTIVE: '0', MODE: '1', AID: '0', CITY: City.trim(),
  }), AREA_PROPS);
  if (AllEPinRequestsList.length > 0) {
    return tsvExport({
      req, res, ViewBag, sheet: 'PinCodeMaster.xls', filename: Filename, rows: AllEPinRequestsList,
      innerProc: 'AllEPinRequestsList', outerProc: 'AllEPinRequestsList',
      headers: ['S.No. \t', 'STATE \t', 'CITY \t', 'PINCODE \t'],
      cells: (item, w) => {
        for (const k of ['ROWNUMBER', 'STATENAME', 'CITYNAME', 'PINCODE']) w(tab(toStr(item[k])) + ' \t');
      },
    });
  }
  return false;
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string State1, string City, string Pincode, int? page, int? ddlcustpage, string btnexel)
// auth (reads Session["Admin_User"] before its null check)
// route-config: "AdminPanel/Area-Master" -> AreaMaster/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Area-Master'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nint(req.p.dynamicpagging);
  let State1 = sv(req.p.State1);
  let City = sv(req.p.City);
  let Pincode = sv(req.p.Pincode);
  let page = nint(req.p.page);
  let ddlcustpage = nint(req.p.ddlcustpage);
  let btnexel = sv(req.p.btnexel);
  const ViewBag = {};
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const perm = await pagePermissions(Employeeid, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = await excelLink(url);
  if (ddlcustpage === null) ddlcustpage = 100;
  if (dynamicpagging === null) dynamicpagging = 100;
  if (State1 === null) State1 = '';
  if (City === null) City = '';
  if (Pincode === null) Pincode = '';
  if (btnexel === null) btnexel = '';
  if (page === null) page = 1;
  const MaxRows = Number(dynamicpagging);
  const rows = await db.proc(DB, 'USP_AREA_MASTER', {
    STARTROW: page, MAXROW: MaxRows, STATE: State1.trim(), PINCODE: Pincode.trim(), PMID: '0', CACTIVE: '0', MODE: '1', AID: '0', CITY: City.trim(),
  });
  const AllEPinRequestsList = mapRows(rows, AREA_PROPS);
  const r = str(col(rows[0], 'result'));
  const TotalRecord = parseInt(r === '' ? '0' : r, 10);
  ViewBag.State1 = State1;
  ViewBag.City = City;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = ddlcustpage;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.Pincode = Pincode;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  await GET_STATE_AND_CITY('', '5', ViewBag); // fills ViewBag.state
  if (btnexel === 'Export Excel') {
    if (await ExportReport(req, res, ViewBag, State1, Pincode, City)) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/AreaMaster/Index.cshtml', Model: AllEPinRequestsList, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string State1, string Pincode, string City)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await ExportReport(req, res, {}, sv(req.p.State1), sv(req.p.Pincode), sv(req.p.City));
  if (!sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult validatePincode(string AID, string PinCode, string state, string city, string mode, string PMID, string CACTIVE)
// auth (PORT-NOTE: legacy had NO session check on this area-master insert/update - protected here)
router.all(`/admin/${C}/validatePincode{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  try {
    // dbo.USP_AREA_MASTER ... @RESULT out  (TransactionalBehavior.DoNotEnsureTransaction)
    const row = await db.procOne(DB, 'USP_AREA_MASTER', {
      STARTROW: '1', MAXROW: '100', STATE: sv(req.p.state), PINCODE: sv(req.p.PinCode), PMID: sv(req.p.PMID), CACTIVE: sv(req.p.CACTIVE),
      MODE: sv(req.p.mode), AID: sv(req.p.AID), CITY: sv(req.p.city),
    });
    const outPutResult = str(col(row, 'result'));
    return res.json(outPutResult);
  } catch (ex) {
    return res.json('ERROR');
  }
}));

// ---------------------------------------------------------------- JsonResult GET_STATE_AND_CITY(string STATE, string MODE)
// public (legacy had no session check; state/city master data)
router.all(`/admin/${C}/GET_STATE_AND_CITY{/:id}`, asyncHandler(async (req, res) => {
  const result = await GET_STATE_AND_CITY(sv(req.p.STATE), sv(req.p.MODE), null);
  if (result === null) return res.type('application/json').send(''); // Json(null)
  return res.json(result);
}));

// ---------------------------------------------------------------- JsonResult CheckPinCode(string PinCode)
// public (legacy had no session check; external postal pincode lookup)
router.all(`/admin/${C}/CheckPinCode{/:id}`, asyncHandler(async (req, res) => {
  const PinCode = sv(req.p.PinCode);
  try {
    const baseurl = 'http://postalpincode.in/api/pincode/' + (PinCode === null ? '' : PinCode);
    // WebClient.DownloadString (throws on non-2xx)
    const resp = await axios.get(baseurl, { responseType: 'text', transformResponse: (x) => x });
    const Result = typeof resp.data === 'string' ? resp.data : String(resp.data);
    const Obj = JSON.parse(Result); // JObject.Parse
    if (Obj === null || typeof Obj !== 'object' || Array.isArray(Obj)) throw new Error('Error reading JObject from JsonReader.');
    // eslint-disable-next-line no-unused-vars
    let Message = '';
    for (const name of Object.keys(Obj)) {
      if (name === 'Status') Message = Obj[name] === null ? '' : String(Obj[name]);
      if (name === 'PostOffice') {
        const v = Obj[name];
        if (v === null) return res.type('application/json').send(''); // Json(null)
        if (!Array.isArray(v)) throw new Error('Cannot deserialize the current JSON object into type List<PinCodeWithPostal>.');
        // Newtonsoft deserialisation is case-insensitive => mapRows (case-insensitive) with the class property names
        return res.json(mapRows(v.map((o) => (o && typeof o === 'object' ? o : {})), PINCODE_POSTAL_PROPS));
      }
    }
    return res.json(Result);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'checkPinCode function error.');
    // ViewBag.Message = ExpObj.Message (not visible in a JsonResult)
    const error = ' Not Found';
    return res.json(error);
  }
}));

module.exports = router;
