'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Courier_Status.cs (class Courier_StatusController => /admin/Courier_Status/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const axios = require('axios');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const { pagePermissions, excelLink } = require('./_shared/login-log-common');
const B = require('./_shared/batch05-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Courier_Status';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests.
let url = '';
let url1 = '';

/** class CorrierStatus */
const CS_PROPS = ['ROWNUMBER', 'CSID', 'DATE', 'Delivery_Date', 'USERNAME', 'MOBILE', 'EMAILID', 'PROODUCTNAME', 'PCODE', 'PackRemark',
  'COURIERTYPE', 'REMARK', 'COURIERSTATUS', 'SENDTYPE', 'NAME'];
/** class UserDetails */
const UD_PROPS = ['NAME', 'ADDRESS', 'MOBILE', 'EMAILID', 'CITYNAME', 'STATENAME', 'PINCODE'];
/** class BindState */
const BS_PROPS = ['SID', 'STATENAME'];
/** class CourierDeliverStatus */
const CDS_PROPS = ['CDSID', 'CSID', 'Name', 'SENDTYPE', 'USERNAME', 'MOBILE', 'EMAILID', 'ADDRESS', 'SENDATE', 'REMARK', 'DOCKETNO',
  'PRODUCTCODE', 'PACKAGEID', 'COURIERSTATUS', 'Shipment_Address', 'STATENAME', 'CITYNAME', 'Pincode', 'PackRemark', 'ProductName',
  'COURIERTYPE', 'DeliveryDate', 'CMID'];
/** class cityname (All_Member_List.cs) */
const CITY_PROPS = ['CTID', 'CITYNAME'];
/** class PinCodeWithPostal (AreaMasterController.cs) */
const PIN_PROPS = ['Name', 'Description', 'BranchType', 'DeliveryStatus', 'Taluk', 'Circle', 'District', 'Division', 'Region', 'State', 'Country'];

/** Convert.ToDateTime(string) (null => DateTime.MinValue, invalid => FormatException) */
function toDateTime(s) {
  if (s === null || s === undefined) return new Date('0001-01-01T00:00:00');
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) throw new Error('String was not recognized as a valid DateTime.');
  return d;
}

/** dbo.USP_COURIERDELIVERYSTATUS (all 21 parameters; @RESULT OUT is returned as a column) */
function courierDeliveryStatus(p) {
  return db.proc(DB, 'USP_COURIERDELIVERYSTATUS', {
    CSID: p.CSID, SENDTYPE: p.SENDTYPE, USERNAME: p.USERNAME, MOBILE: p.MOBILE, EMAILID: p.EMAILID, ADDRESS: p.ADDRESS, REMARK: p.REMARK,
    SENDATE: p.SENDATE, CMID: p.CMID, DOCKETNO: p.DOCKETNO, PRODUCTCODE: p.PRODUCTCODE, PACKAGEID: p.PACKAGEID, ProductName: p.ProductName,
    Name: p.Name, Shipment_Address: p.Shipment_Address, Sid: p.Sid, Cid: p.Cid, Pincode: p.Pincode, DeliveryDate: p.DeliveryDate, MODE: p.MODE,
  });
}

/** public void CourierDelivery(int CSID, string SENDTYPE, ..., int sid, int cid, string pincode, string deliverydate) */
async function CourierDelivery(CSID, SENDTYPE, USERNAME, MOBILE, EMAIL, ADDRESS, REMARK, SENDATE, CMID, DOCKETNO, PRODUCTCODE, PACKAGEID,
  PRODUCTNAME, CDSID, Name, Shipment_Address, sid, cid, pincode, deliverydate) {
  let mode = 0;
  if (CDSID === '0') mode = 1;
  else mode = 4;
  const rows = await courierDeliveryStatus({
    CSID: B.cvtInt(CSID), SENDTYPE: B.cvtInt(SENDTYPE), MOBILE, USERNAME, EMAILID: EMAIL, REMARK, ADDRESS, SENDATE, CMID: B.cvtInt(CMID),
    DOCKETNO, PRODUCTCODE, PACKAGEID, ProductName: PRODUCTNAME, Name, Shipment_Address, Sid: sid, Cid: cid, Pincode: pincode,
    DeliveryDate: deliverydate, MODE: mode,
  });
  const intresult = B.outStr(rows[0], 'result'); // assigned, unused (void)
  return intresult;
}

/** public void ExportReport(string SendType, string SearchFieldDate, string SearchStatus, string SearchField, string Searchvalue, string fromDate, string toDate, int? page, int? dynamicpagging) */
async function ExportReport(req, res, ViewBag, SendType, SearchFieldDate, SearchStatus, SearchField, Searchvalue, fromDate, toDate, page, dynamicpagging) {
  const userid = req.user.emp_id;
  const Filename = 'CourierStatus' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = dynamicpagging === null || dynamicpagging === undefined ? 0 : Number(dynamicpagging);
  if (page === null || page === undefined) page = 1;
  // PORT-NOTE: legacy passed @SENDTYPE as a SqlParameter but the command text had no @SENDTYPE placeholder, so the proc never got it - omitted.
  void SendType;
  const corrierstatus = mapRows(await db.proc(DB, 'USP_GETALLCOURIERSTATUS', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: Searchvalue, FROMDATE: fromDate, TODATE: toDate,
    SEARCHFIELDDATE: SearchFieldDate, STATUS: SearchStatus,
  }), CS_PROPS);
  if (corrierstatus.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'CourierStatus.xls', Filename,
      headers: ['S.No.', 'Username', 'Mobile No.', 'Package Name', 'Package Code', 'Purchase Date', 'Delivery Type', 'Delivery Date', 'Remark', 'Status'],
      rows: corrierstatus, innerProc: 'USP_GETALLCOURIERSTATUS', outerProc: 'USP_ALL_MEMBERLIST',
      cells: (item, w) => {
        w('\n'); // PORT-NOTE: legacy wrote no S.No. cell per row (header has one) - kept.
        for (const k of ['USERNAME', 'MOBILE', 'PROODUCTNAME', 'PCODE', 'DATE', 'SENDTYPE', 'Delivery_Date', 'REMARK', 'COURIERSTATUS']) {
          w(B.tab(B.cellStr(item, k)) + ' \t');
        }
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(string btnexel, string SendType, string SearchFieldDate, string SearchStatus, string SearchField, string Searchvalue, string fromDate, string toDate, int? page, int? dynamicpagging)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/courier_status" -> Courier_Status/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/courier_status'], adminAuth, asyncHandler(async (req, res) => {
  const btnexel = B.nStr(req.p.btnexel);
  let SendType = B.nStr(req.p.SendType);
  let SearchFieldDate = B.nStr(req.p.SearchFieldDate);
  let SearchStatus = B.nStr(req.p.SearchStatus);
  let SearchField = B.nStr(req.p.SearchField);
  let Searchvalue = B.nStr(req.p.Searchvalue);
  let fromDate = B.nStr(req.p.fromDate);
  let toDate = B.nStr(req.p.toDate);
  let page = B.nInt(req.p.page);
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (SendType === null) SendType = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (SearchFieldDate === null) SearchFieldDate = '';
  if (SearchStatus === null) SearchStatus = '';
  if (SearchField === null) SearchField = '';
  if (Searchvalue === null) Searchvalue = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  const ViewBag = {};
  ViewBag.excelactive = await excelLink(url); // USP_EXCEL_LINK
  const Employeeid = req.user.emp_id;
  const perm = await pagePermissions(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await db.proc(DB, 'USP_GETALLCOURIERSTATUS', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: SearchField, SEARCHVALUE: Searchvalue, FROMDATE: fromDate,
    SEARCHFIELDDATE: SearchFieldDate, STATUS: SearchStatus, SENDTYPE: SendType, TODATE: toDate,
  });
  const CorrierStatus = mapRows(rows, CS_PROPS);
  // PORT-NOTE: @TOTALCOUNT OUT read from the result row column "totalcount" (no row => 0).
  const TotalRecord = rows.length ? B.outInt(rows[0], 'totalcount') : 0;
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, ViewBag, SendType, SearchFieldDate, SearchStatus, SearchField, Searchvalue, fromDate, toDate, page, dynamicpagging);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Courier_Status/Index.cshtml', Model: CorrierStatus, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult AddCourierStatus(string Username, string Date, string ProduTcname, string Couriertype, string Remark, string CourierStatus)
// auth (admin write; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/AddCourierStatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const row = await db.procOne(DB, 'USP_SUBMITCOURIER_STATUS', {
    CSID: 0, USERNAME: B.nStr(req.p.Username), DATE: toDateTime(B.nStr(req.p.Date)), PRODUCTNAME: B.nStr(req.p.ProduTcname),
    COURIERTYPE: B.nStr(req.p.Couriertype), REMARK: B.nStr(req.p.Remark), COURIERSTATUS: B.nStr(req.p.CourierStatus), MODE: 1,
  });
  const intresult = B.outInt(row, 'intresult');
  return res.json(intresult);
}));

// ---------------------------------------------------------------- public void CourierDelivery(int CSID, string SENDTYPE, ... , int sid, int cid, string pincode, string deliverydate)
// auth (public method => routable in legacy; admin write without session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/CourierDelivery{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const s = (k) => B.nStr(req.p[k]);
  await CourierDelivery(B.reqInt(req.p.CSID, 'CSID'), s('SENDTYPE'), s('USERNAME'), s('MOBILE'), s('EMAIL'), s('ADDRESS'), s('REMARK'),
    s('SENDATE'), s('CMID'), s('DOCKETNO'), s('PRODUCTCODE'), s('PACKAGEID'), s('PRODUCTNAME'), s('CDSID'), s('Name'), s('Shipment_Address'),
    B.reqInt(req.p.sid, 'sid'), B.reqInt(req.p.cid, 'cid'), s('pincode'), s('deliverydate'));
  res.send('');
}));

// ---------------------------------------------------------------- JsonResult GetSingleCourierStatus(int csid)
// auth (admin data; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/GetSingleCourierStatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const csid = B.reqInt(req.p.csid, 'csid');
  // PORT-NOTE: legacy concatenated csid (int) into the SQL; parameterised. convert(varchar,TCS.DATE,110) => 'MM-DD-YYYY'.
  const rows = await db.query(DB, `select coalesce(to_char(tcs.date, 'MM-DD-YYYY'), '') as date, km.pcode, coalesce(sm.subscriptiondetails, '') as packremark,
      km.title as proodductname, coalesce(mm.username, '') as username, coalesce(mm.mobile, '') as mobile, coalesce(mm.emailid, '') as emailid,
      coalesce(tcs.couriertype, '') as couriertype, coalesce(tcs.remark, '') as remark, coalesce(tcs.courierstatus, '') as courierstatus
    from member_master mm inner join tbl_courierstatus tcs on mm.regno = tcs.regno
    inner join tbl_allsubscriptionmaster asm on asm.tasmid = tcs.tsmid
    inner join kit_master km on km.kid = asm.allpackageid
    inner join tbl_subscriptionmaster sm on sm.tsmid = asm.allpackageid
    where tcs.csid = @csid`, { csid });
  return res.json(mapRows(rows, CS_PROPS));
}));

// ---------------------------------------------------------------- JsonResult GetUserDetails(string username)
// auth (member personal data; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/GetUserDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await courierDeliveryStatus({
    CSID: '0', SENDTYPE: '0', MOBILE: '', USERNAME: B.nStr(req.p.username), EMAILID: '', REMARK: '', ADDRESS: '', SENDATE: '', CMID: '0',
    DOCKETNO: '', PRODUCTCODE: '', PACKAGEID: '0', ProductName: '', Name: '', Shipment_Address: '', Sid: '0', Cid: '0', Pincode: '',
    DeliveryDate: '', MODE: 2,
  });
  return res.json(mapRows(rows, UD_PROPS));
}));

// ---------------------------------------------------------------- JsonResult GetCourierDeliveryStatus(string CSID)
// auth (admin data; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/GetCourierDeliveryStatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await courierDeliveryStatus({
    CSID: B.cvtInt(B.nStr(req.p.CSID)), SENDTYPE: 0, MOBILE: '', USERNAME: '', EMAILID: '', REMARK: '', ADDRESS: '', SENDATE: '', CMID: 0,
    DOCKETNO: '', PRODUCTCODE: '', PACKAGEID: '', ProductName: '', Name: '', Shipment_Address: '', Sid: 0, Cid: 0, Pincode: '', DeliveryDate: '',
    MODE: 3,
  });
  return res.json(mapRows(rows, CDS_PROPS));
}));

// ---------------------------------------------------------------- JsonResult UpdateCourierStatus(int CSID, string USERNAME, string DATE, ...)
// auth (admin write; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/UpdateCourierStatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const s = (k) => B.nStr(req.p[k]);
  const CSID = B.reqInt(req.p.CSID, 'CSID');
  const USERNAME = s('USERNAME'); const DATE = s('DATE'); const PRODUCTNAME = s('PRODUCTNAME'); const COURIERTYPE = s('COURIERTYPE');
  const REMARK = s('REMARK'); const COURIERSTATUS = s('COURIERSTATUS'); const SENDTYPE = s('SENDTYPE'); const MOBILE = s('MOBILE');
  const EMAIL = s('EMAIL'); const ADDRESS = s('ADDRESS'); const CMID = s('CMID'); const DOCKETNO = s('DOCKETNO'); const PRODUCTCODE = s('PRODUCTCODE');
  const PACKAGEID = s('PACKAGEID'); const CDSID = s('CDSID'); const NAME = s('NAME'); const SHIPMENTADDRESS = s('SHIPMENTADDRESS');
  const SName = s('SName'); const CName = s('CName'); const pincode = s('pincode'); const Deliverdate = s('Deliverdate');
  let sid = 0;
  let cid = 0;
  let intresult = '0';
  if (SName !== null && SName !== '') {
    const states = await db.queryOne(DB, 'select sid from state where statename = @SName limit 1', { SName });
    if (!states) throw B.nullRef(); // states.Sid on null
    sid = Number(B.col(states, 'sid'));
  }
  if (CName !== null && CName !== '') {
    const cities = await db.queryOne(DB, 'select ctid from city where cityname = @CName limit 1', { CName });
    if (!cities) throw B.nullRef();
    cid = Number(B.col(cities, 'ctid'));
  }
  const row = await db.procOne(DB, 'USP_SUBMITCOURIER_STATUS', {
    CSID, USERNAME, PRODUCTNAME, COURIERTYPE, REMARK, COURIERSTATUS, MODE: 2,
  });
  intresult = B.outStr(row, 'intresult');
  if (intresult === '1') {
    await CourierDelivery(CSID, SENDTYPE, USERNAME, MOBILE, EMAIL, ADDRESS, REMARK, DATE, CMID, DOCKETNO, PRODUCTCODE, PACKAGEID, PRODUCTNAME,
      CDSID, NAME, SHIPMENTADDRESS, sid, cid, pincode, Deliverdate);
    if (SENDTYPE === '2') { // for generate slip
      const csid = String(CSID);
      intresult += '^' + await UtilityClass.Encryptword(csid);
    }
  }
  return res.json(intresult);
}));

// ---------------------------------------------------------------- JsonResult CHECKDOCKET(string DOCKET)
// auth (admin data; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/CHECKDOCKET{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const rows = await courierDeliveryStatus({
    CSID: '0', SENDTYPE: 0, MOBILE: '', USERNAME: '', EMAILID: '', REMARK: '', ADDRESS: '', SENDATE: '', CMID: 0, DOCKETNO: B.nStr(req.p.DOCKET),
    PRODUCTCODE: '', PACKAGEID: '', ProductName: '', Name: '', Shipment_Address: '', Sid: 0, Cid: 0, Pincode: '', DeliveryDate: '', MODE: 5,
  });
  // SqlQuery<int>(...).FirstOrDefault(): first column of the first row (0 when no row).
  // PORT-NOTE: if the PG function also returns the @RESULT OUT column, the first selected column is still taken.
  let docket = 0;
  if (rows.length) {
    const v = rows[0][Object.keys(rows[0])[0]];
    docket = v === null || v === undefined ? 0 : Number(v);
  }
  return res.json(docket);
}));

// ---------------------------------------------------------------- JsonResult GetState(string Prefix)
// public (master-data autocomplete; no session check in legacy)
router.all(`/admin/${C}/GetState{/:id}`, asyncHandler(async (req, res) => {
  const _cityname = mapRows(await db.proc(DB, 'USP_GETSTATE_AUTOCOMPLETE', { Prefix: B.nStr(req.p.Prefix) }), BS_PROPS);
  return res.json(_cityname);
}));

// ---------------------------------------------------------------- JsonResult GetCity(string Prefix, string sname)
// public (master-data autocomplete; no session check in legacy)
router.all(`/admin/${C}/GetCity{/:id}`, asyncHandler(async (req, res) => {
  let sid = 0;
  const sname = B.nStr(req.p.sname);
  const states = sname === null ? null : await db.queryOne(DB, 'select sid from state where statename = @sname limit 1', { sname });
  if (states !== null) sid = Number(B.col(states, 'sid'));
  const _cityname = mapRows(await db.proc(DB, 'USP_GETCITY_autocomplete', { Prefix: B.nStr(req.p.Prefix), sid }), CITY_PROPS);
  return res.json(_cityname);
}));

// ---------------------------------------------------------------- JsonResult CheckPinCode(string PinCode)
// public (pincode lookup via postalpincode.in; no session check in legacy)
router.all(`/admin/${C}/CheckPinCode{/:id}`, asyncHandler(async (req, res) => {
  const PinCode = B.nStr(req.p.PinCode);
  try {
    const baseurl = 'http://postalpincode.in/api/pincode/' + (PinCode === null ? '' : encodeURIComponent(PinCode));
    const resp = await axios.get(baseurl, { responseType: 'text', transformResponse: (x) => x }); // WebClient.DownloadString
    let Result = typeof resp.data === 'string' ? resp.data : JSON.stringify(resp.data);
    const Obj = JSON.parse(Result); // JObject.Parse (throws on non-object JSON too)
    if (Obj === null || typeof Obj !== 'object' || Array.isArray(Obj)) throw new Error('Error reading JObject from JsonReader.');
    let Message = '';
    if (Obj.Status !== 'Error') {
      for (const Name of Object.keys(Obj)) {
        if (Name === 'Status') Message = Obj[Name] === null ? '' : String(Obj[Name]);
        if (Name === 'PostOffice') {
          const v = Obj[Name];
          const PinCodeWithPostal = v === null ? null : (Array.isArray(v) ? v.map((x) => mapRow(x, PIN_PROPS)) : (() => { throw new Error('Cannot deserialize the current JSON object into type List<PinCodeWithPostal>.'); })());
          return res.json(PinCodeWithPostal); // Message + "^" + ... (commented in legacy)
        }
      }
    } else {
      Result = '';
    }
    void Message;
    return res.json(Result);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'checkPinCode function error.');
    const error = ' Not Found';
    return res.json(error);
  }
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const s = (k) => B.nStr(req.p[k]);
  const r = await ExportReport(req, res, {}, s('SendType'), s('SearchFieldDate'), s('SearchStatus'), s('SearchField'), s('Searchvalue'),
    s('fromDate'), s('toDate'), B.nInt(req.p.page), B.nInt(req.p.dynamicpagging));
  if (!r.sent) res.send('');
}));

void config;
module.exports = router;
