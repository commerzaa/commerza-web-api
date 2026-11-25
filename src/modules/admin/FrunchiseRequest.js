'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\FrunchiseRequest.cs (class FrunchiseRequestController => /admin/FrunchiseRequest/...)
// Database: affiliate (Db_Affiliate). Models: PendingRequest (Pending_RequestController.cs), PinCodeWithPostal (AreaMasterController.cs).
// Unused model classes in the file (franchisepackage, PinCodeWithPostal1, FRANCHISEPACKAGEMASTER) are plain property bags - not ported.
const os = require('os');
const express = require('express');
const axios = require('axios');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/adminSession');
const { pagePermissions, excelLink } = require('./_shared/loginLogCommon');
const B = require('./_shared/batch07_common');
const { nn, totalOut } = require('./_shared/batch07C_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'FrunchiseRequest';

/** class PendingRequest */
const PR_PROPS = ['RowNumber', 'PLID', 'FRID', 'FPMID', 'FNAME', 'MRP', 'Mobile', 'DATE', 'STATE', 'CITY', 'COUNTRY', 'ADDRESS', 'PINCODE',
  'PackageName', 'PackageID', 'IPADDRESS', 'DESCRIPTION', 'STATUS', 'ACTIVE', 'COMMISSION', 'Taluk', 'District', 'Circle', 'Region',
  'StoreType', 'FRCode', 'Emailid', 'GST', 'TinNo', 'CommissionPer', 'Referralusername', 'Remark', 'USERNAME', 'Sponsor', 'Upline_FRcode',
  'Paymentdate', 'ModeName', 'ReferanceNo', 'Attachment', 'Bank'];
/** class PinCodeWithPostal */
const PINCODE_POSTAL_PROPS = ['Name', 'Description', 'BranchType', 'DeliveryStatus', 'Taluk', 'Circle', 'District', 'Division', 'Region',
  'State', 'Country'];

// PORT-NOTE: `private static string url, url1` - process-wide like the C# static fields (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** DBO.USP_FranchiseList @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,@SearchField,@TOTALCOUNT out,@FRID,@SearchValue
 *  PORT-NOTE: legacy sent @FRID = "" (nvarchar) to the INT parameter => SQL Server converted it to 0; 0 is sent. */
async function franchiseList(fromDate, toDate, MAXROWS, STARTROWINDEX, SearchField, SearchValue) {
  return db.proc(DB, 'USP_FranchiseList', nn({
    fromDate, toDate, MAXROWS, STARTROWINDEX, SearchField, FRID: 0, SearchValue,
  }));
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string orderbydate, int? Page, string FromDate, string ToDate, string SearchField, string SearchValue, string btnexel, int? ddlcustpage, string FRID)
// auth (reads Session["Admin_User"])
// route-config: "AdminPanel/FrunchiseRequest" -> FrunchiseRequest/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/FrunchiseRequest'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let orderbydate = B.nStr(req.p.orderbydate);
  let Page = B.nInt(req.p.Page);
  let FromDate = B.nStr(req.p.FromDate);
  let ToDate = B.nStr(req.p.ToDate);
  let SearchField = B.nStr(req.p.SearchField);
  let SearchValue = B.nStr(req.p.SearchValue);
  let btnexel = B.nStr(req.p.btnexel);
  let ddlcustpage = B.nInt(req.p.ddlcustpage);
  let FRID = B.nStr(req.p.FRID);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  if (btnexel === null) btnexel = '';
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  if (FRID !== '' && FRID !== null) {
    ViewBag.FRID = await UtilityClass.Decryptword(FRID);
  } else {
    FRID = '';
  }
  const perm = await pagePermissions(Employeeid, url); // USP_GETEXCELPERMISIONSTATUS
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = await excelLink(url); // USP_EXCEL_LINK
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (FromDate === null) FromDate = '';
  if (ToDate === null) ToDate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (btnexel === null) btnexel = '';
  if (ddlcustpage === null) ddlcustpage = 100;
  try {
    const MaxRows = Number(dynamicpagging);
    if (Page === null) Page = 1;
    const rows = await franchiseList(FromDate, ToDate, MaxRows, Page, SearchField, SearchValue);
    const List = mapRows(rows, PR_PROPS);
    const TotalRecord = totalOut(rows, 'TOTALCOUNT');
    ViewBag.CurrentPage = Page;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.GridPageSize = ddlcustpage;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = FromDate;
    ViewBag.toDate = ToDate;
    if (btnexel === 'Export Excel') {
      if (await ExportReport(req, res, ViewBag, FromDate, ToDate, SearchField, SearchValue)) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/FrunchiseRequest/Index.cshtml', Model: List, ...ViewBag });
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'USP_FranchisePending');
    ViewBag.ErrorMessage = ExpObj.message;
    return res.json({ view: '~/Views/AdminPanel/FrunchiseRequest/Index.cshtml', Model: null, ...ViewBag });
  }
}));

/** public void ExportReport(string FromDate, string ToDate, string SearchField, string SearchValue) - true when the download was sent */
async function ExportReport(req, res, ViewBag, FromDate, ToDate, SearchField, SearchValue) {
  const userid = req.user.emp_id;
  const Filename = 'Add_Franchise_List_' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename); // [USP_EXCEL_DOWNLOAD_HISTORY] @ID,@DOWNLOADEDFROM,@FILENAME,@MODE='1',@STRRESULT OUT
  const List = mapRows(await franchiseList(FromDate, ToDate, 999999, 1, SearchField, SearchValue), PR_PROPS);
  if (List.length > 0) {
    const r = await B.writeXlsExport({
      req, res, sheet: 'Add_Franchise_List.xls', downloadName: 'Add_Franchise_List.xls', Filename, ViewBag,
      headers: ['S.No.', 'Store Type', 'PackageName', 'Name', 'FR-Code', 'State', 'City', 'Pincode'],
      rows: List, innerProc: 'AllEPinRequestsList', outerProc: 'LiUserWiseIWalletStatementsController_Report',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'RowNumber')) + ' \t');
        w(B.tab(B.cellStr(item, 'StoreType')) + ' \t');
        w(B.tab(B.cellStr(item, 'PackageName')) + ' \t');
        w(B.tab(B.cellStr(item, 'FNAME')) + ' \t');
        w(B.tab(B.cellStr(item, 'FRCode')) + ' \t');
        w(B.tab(B.cellStr(item, 'STATE')) + ' \t');
        w(B.tab(B.cellStr(item, 'CITY')) + ' \t');
        w(B.tab(B.cellStr(item, 'PINCODE')) + ' \t');
      },
    });
    return r.sent;
  }
  return false;
}

// ---------------------------------------------------------------- public void ExportReport(string FromDate, string ToDate, string SearchField, string SearchValue)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const sent = await ExportReport(req, res, {}, B.nStr(req.p.FromDate), B.nStr(req.p.ToDate), B.nStr(req.p.SearchField), B.nStr(req.p.SearchValue));
  if (!sent) res.send(''); // void action => empty response
}));

/** Dns.GetHostEntry(Dns.GetHostName()).AddressList - the SERVER's own addresses (PORT-NOTE: os.networkInterfaces() equivalent). */
function serverAddressList() {
  const out = [];
  const ifs = os.networkInterfaces();
  for (const name of Object.keys(ifs)) for (const a of ifs[name] || []) if (!a.internal) out.push(a.address);
  return out;
}

// ---------------------------------------------------------------- JsonResult OrderFranchise(... 33 string params ...)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/OrderFranchise{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const P = (k) => B.nStr(req.p[k]);
  // (TotalPayableAmount, ALLMRP, ALLPRODUCTNAME, DESCRIPTION are bound but unused in legacy)
  let AllPackageId = P('AllPackageId');
  const ADDRESS = P('ADDRESS'); const COUNTRY = P('COUNTRY'); const STATES = P('STATES'); const CITYS = P('CITYS');
  const PINCODE = P('PINCODE'); const CUSTOMERNAME = P('CUSTOMERNAME'); const MOBILE = P('MOBILE'); const EMAILID = P('EMAILID');
  let TOTALCOMMISSION = P('TOTALCOMMISSION');
  const taluk = P('taluk'); const district = P('district'); const circle = P('circle'); const region = P('region');
  const StoreType = P('StoreType');
  let FRID = P('FRID');
  const GST = P('GST'); const TinNo = P('TinNo');
  let PaymentMode = P('PaymentMode');
  const ModeName = P('ModeName'); const ChallanImage = P('ChallanImage'); const BankName = P('BankName'); const BranchName = P('BranchName');
  const ReferenceDate = P('ReferenceDate'); const ReferenceNumber = P('ReferenceNumber'); const IFSCCode = P('IFSCCode');
  const Username = P('Username'); const ReferralUsername = P('ReferralUsername');
  let Upline = P('Upline');
  if (Upline === null) Upline = '';
  let IpAddress = '';
  const addr = serverAddressList();
  if (addr.length > 1) IpAddress = addr[1];
  let ReturnOutput = 'success';
  const pass = 100000 + Math.floor(Math.random() * 900000); // generator.Next(100000, 1000000)
  const Password = await UtilityClass.Encryptword(String(pass));
  try {
    const loginid = req.user.emp_id;
    let ImageName = '';
    let FullUrlWithFolder = '';
    if (ChallanImage !== '') { // (null != "" is true in legacy as well)
      FullUrlWithFolder = `${req.protocol}://${req.get('host')}/Challen_Image/`;
      ImageName = await UtilityClass.ImageUploadMasterMethod(ChallanImage, '../Challen_Image', '../Challen_Image', UtilityClass.ImageMode.Both, String(loginid));
      FullUrlWithFolder += ImageName;
    }
    if (FRID === '') FRID = '0';
    if (TOTALCOMMISSION === '') TOTALCOMMISSION = '0';
    if (AllPackageId === '') AllPackageId = '0';
    if (PaymentMode === '-Select Paymode-' || PaymentMode === '' || PaymentMode === null) PaymentMode = '0';
    // [DBO].[USP_ADDFRANCHISEBYADMIN] @FIMID(=> 1st param @FPMID),@COUNTRY,...,@StrOutPut out,...,@AdminID,@Upline
    // null string values => SqlParameter not sent => procedure defaults (nn()).
    const row = await db.procOne(DB, 'USP_ADDFRANCHISEBYADMIN', nn({
      FPMID: B.cvtInt(AllPackageId),
      COUNTRY, STATE: STATES, CITY: CITYS, ADDRESS, PINCODE,
      IPADDRESS: IpAddress,
      DESCRIPTION: '',
      TOTALCOMMISSION: B.cvtDec(TOTALCOMMISSION),
      TALUK: taluk, DISTRICT: district, CIRCLE: circle, REGION: region,
      NAME: CUSTOMERNAME, Emailid: EMAILID, Mobile: MOBILE, StoreType, PassWord: Password,
      FRID: B.cvtInt(FRID), GST, TinNo, RegNo: loginid,
      PaymentMode: B.cvtInt(PaymentMode), ModeName, ChallanImage: FullUrlWithFolder, BankName, BranchName, ReferenceDate,
      ReferenceNumber, IFSCCode, Username, ReferralUsername, AdminID: loginid, Upline,
    }));
    ReturnOutput = B.outStr(row, 'StrOutPut');
    // Db._TBL_SMSACTION.Where(a => a.ID == 23).FirstOrDefault()
    const msg = await db.queryOne(DB, 'select sms_content, sms_send_status from tbl_smsaction where id = 23 limit 1', {});
    if (!msg) throw B.nullRef();
    const Message = msg.sms_content;
    const IsSMSactive = Number(msg.sms_send_status);
    const PasswordForSMSOrEamil = await UtilityClass.Decryptword(Password);
    // Db._tbl_emailaction.Where(a => a.EID == 19).FirstOrDefault()
    const ForSponceEmailmsg = await db.queryOne(DB, 'select email_subject, email_content, email_send_status from tbl_emailaction where eid = 19 limit 1', {});
    if (!ForSponceEmailmsg) throw B.nullRef();
    const EmailMessage = ForSponceEmailmsg.email_content;
    const IsActiveEmail = Number(ForSponceEmailmsg.email_send_status);
    if (ReturnOutput === 'success') {
      if (IsSMSactive === 1) {
        const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(CUSTOMERNAME, Message, '', PasswordForSMSOrEamil, 1);
        // background thread in legacy
        Promise.resolve().then(() => UtilityClass.SendSMSWithAPI(MOBILE, messg, '1'))
          .catch((e) => console.error('[admin/FrunchiseRequest] SMS failed:', e.message));
      }
      if (IsActiveEmail === 1) {
        // background thread in legacy
        Promise.resolve().then(async () => {
          const fileUploader = null;
          const DynamicMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(CUSTOMERNAME, EmailMessage, EMAILID, PasswordForSMSOrEamil, 1, '');
          if (EMAILID === null) throw B.nullRef(); // EMAILID.ToLower()
          return UtilityClass.SendEmailByApiSetting(CUSTOMERNAME, PasswordForSMSOrEamil, '', '', '', '', EMAILID.toLowerCase(),
            ForSponceEmailmsg.email_subject, DynamicMsg, fileUploader);
        }).catch((e) => console.error('[admin/FrunchiseRequest] mail failed:', e.message));
      }
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'USP_FRANCHISEREQUEST');
    ReturnOutput = 'Error^Some Exception Occur : ' + ExpObj.message;
  }
  return res.json(ReturnOutput);
}));

// ---------------------------------------------------------------- JsonResult CheckPinCode(string PinCode)
// public (legacy had no session check; external postal pincode lookup)
router.all(`/admin/${C}/CheckPinCode{/:id}`, asyncHandler(async (req, res) => {
  const PinCode = B.nStr(req.p.PinCode);
  try {
    const baseurl = 'http://postalpincode.in/api/pincode/' + (PinCode === null ? '' : PinCode);
    const resp = await axios.get(baseurl, { responseType: 'text', transformResponse: (x) => x }); // WebClient.DownloadString
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

// ---------------------------------------------------------------- JsonResult CheckFranchiseExistsOnBlur(string UserName)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/CheckFranchiseExistsOnBlur{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const UserName = B.nStr(req.p.UserName);
  let RowSp = 0;
  // SELECT 1 FROM MEMBER_MASTER where ACTIVE=1 and USERNAME='<UserName>'  (parameterised; null concatenated as '')
  const v = await db.scalar(DB, 'select 1 from member_master where active = 1 and username = @UserName limit 1', { UserName: UserName === null ? '' : UserName });
  const ROW_Check_Alreadyuser = v === null || v === undefined ? 0 : Number(v);
  if (ROW_Check_Alreadyuser !== 0) {
    return res.json('1');
  }
  RowSp = 0;
  return res.json(RowSp);
}));

// ---------------------------------------------------------------- JsonResult Editfranchise(string FRID)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/Editfranchise{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const FRID = B.nStr(req.p.FRID);
  // DBO.USP_FranchiseList @fromDate,@toDate,@MAXROWS,@STARTROWINDEX,STARTROWINDEX,@TOTALCOUNT out,@FRID,@SearchValue
  // PORT-NOTE: the 5th argument is the bare identifier STARTROWINDEX, which T-SQL passes as the string 'STARTROWINDEX' to @SearchField;
  // a null FRID is not sent => procedure default (22); a non-numeric FRID fails the nvarchar->int conversion (500) like legacy.
  let frid = null;
  if (FRID !== null) {
    const s = FRID.trim();
    if (s === '') frid = 0;
    else if (/^[-+]?\d+$/.test(s)) frid = parseInt(s, 10);
    else throw new Error(`Conversion failed when converting the nvarchar value '${FRID}' to data type int.`);
  }
  const franchise = mapRows(await db.proc(DB, 'USP_FranchiseList', nn({
    fromDate: '', toDate: '', MAXROWS: 1, STARTROWINDEX: 1, SearchField: 'STARTROWINDEX', FRID: frid, SearchValue: '',
  })), PR_PROPS);
  return res.json(franchise);
}));

module.exports = router;
