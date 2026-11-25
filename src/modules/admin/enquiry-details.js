'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Enquiry_Details.cs (class Enquiry_DetailsController, no namespace => /Enquiry_Details/...)
// Database: affiliate (Db_Affiliate). Procs USP_GETEXCELPERMISIONSTATUS, usp_GetEnquiry_Details, USP_EXCEL_DOWNLOAD_HISTORY;
// tables tbl_enquiry, tbl_emailtemplate, tbl_emailaccount, city (via lib CITY). The empty constructor has no logic.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const CITY = require('../../lib/admin/City');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const {
  nInt, nStr, reqInt, col, str, cvtInt, perms, nowStamp, excelHistory, writeXlsExport, cellStr, tab, dynPaging, intParse, trimNull, nullRef,
  netFormat,
} = require('./_shared/batch06-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Enquiry_Details';

/** public class EnquiryDetail */
const ENQUIRY_DETAIL_PROPS = ['rowNumber', 'Eid', 'Name', 'EmailId', 'Subject', 'Message', 'date', 'Mobile', 'Stateid', 'Cityid', 'StateName', 'CityName',
  'Enquiry_type'];
/** Models/MailMessage_Master.cs class Tbl_Enquiry */
const TBL_ENQUIRY_PROPS = ['EId', 'Name', 'EmailId', 'Mobile', 'Subject', 'Message', 'EnqDate', 'Status', 'LastReplyMsg', 'LastReplyDate', 'Type', 'Source',
  'Stateid', 'Cityid', 'Enquiry_type'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** usp_GetEnquiry_Details @StartRowIndex,@MaxRows,@TotalCount out,@FROMDATE,@TODATE,@SearchField,@SearchValue,@State,@City,@enquiry_type */
const enquiryDetails = (StartRowIndex, MaxRows, FROMDATE, TODATE, SearchField, SearchValue, State, City, enquiry_type) => db.proc(DB, 'usp_GetEnquiry_Details', {
  StartRowIndex, MaxRows, FROMDATE, TODATE, SearchField, SearchValue, State, City, enquiry_type,
});

/** public void ExportReport(string fromDate, string toDate, string SearchField, string SearchValue, int? ddlState, int? ddlCity, int? enquiry_type) */
async function ExportReport(req, res, fromDate, toDate, SearchField, SearchValue, ddlState, ddlCity, enquiry_type, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'EnquiryDetail_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const list = mapRows(await enquiryDetails(1, 9999999, fromDate, toDate, trimNull(SearchField), trimNull(SearchValue), ddlState, ddlCity, enquiry_type),
    ENQUIRY_DETAIL_PROPS);
  if (list.length > 0) {
    return writeXlsExport({
      req, res, sheet: 'EnquiryDetail.xls', Filename, ViewBag, rows: list,
      headers: ['S.No.', 'Name', 'Email Id', 'Mobile No.', 'Message', 'Date'],
      innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
      cells: (item, w) => {
        w('\n');
        for (const k of ['rowNumber', 'Name', 'EmailId', 'Mobile', 'Message', 'date']) w(tab(cellStr(item, k)) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, int? page, string fromDate, string btnexel, string toDate,
//   int? ddlState, int? ddlCity, string SearchField, string SearchValue, int? enquiry_type)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Enquiry-Details" -> Enquiry_Details/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Enquiry-Details'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = nInt(req.p.dynamicpagging);
  let page = nInt(req.p.page);
  let fromDate = nStr(req.p.fromDate);
  let btnexel = nStr(req.p.btnexel);
  let toDate = nStr(req.p.toDate);
  let ddlState = nInt(req.p.ddlState);
  let ddlCity = nInt(req.p.ddlCity);
  let SearchField = nStr(req.p.SearchField);
  let SearchValue = nStr(req.p.SearchValue);
  let enquiry_type = nInt(req.p.enquiry_type);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const Employeeid = req.user.emp_id;
  const ViewBag = {};
  // inline USP_GETEXCELPERMISIONSTATUS (its isactive/isedit are overwritten just below by CheckPermissions)
  const prow = await db.procOne(DB, 'USP_GETEXCELPERMISIONSTATUS', { EMPID: Employeeid, HERF: url });
  const e = str(col(prow, 'EXCELSTATUS'));
  const i = str(col(prow, 'ISEDIT'));
  ViewBag.isactive = cvtInt(e === '' ? '0' : e);
  ViewBag.isedit = cvtInt(i === '' ? '0' : i);
  const p = await perms(req.user.emp_id, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = p.excelactive;
  if (dynamicpagging === null) dynamicpagging = dynPaging();
  if (fromDate === null) fromDate = '';
  if (btnexel === null) btnexel = '';
  if (toDate === null) toDate = '';
  if (SearchField === null) SearchField = '';
  if (SearchValue === null) SearchValue = '';
  if (ddlState === null) ddlState = 0;
  if (ddlCity === null) ddlCity = 0;
  if (enquiry_type === null) enquiry_type = 0;
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  const rows = await enquiryDetails(page, MaxRows, fromDate, toDate, SearchField.trim(), SearchValue.trim(), ddlState, ddlCity, enquiry_type);
  const AllEnquiryDetail = mapRows(rows, ENQUIRY_DETAIL_PROPS);
  const TotalRecord = intParse(col(rows[0], 'TotalCount'));
  ViewBag.CurrentPage = page;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.ddlState = ddlState;
  ViewBag.ddlCity = ddlCity;
  if (btnexel === 'Export Excel') {
    const x = await ExportReport(req, res, fromDate, toDate, SearchField, SearchValue, ddlState, ddlCity, enquiry_type, ViewBag);
    if (x.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Enquiry_Details/Index.cshtml', Model: AllEnquiryDetail, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(string fromDate, string toDate, string SearchField, string SearchValue,
//   int? ddlState, int? ddlCity, int? enquiry_type)
// auth (PORT-NOTE: public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const x = await ExportReport(req, res, nStr(req.p.fromDate), nStr(req.p.toDate), nStr(req.p.SearchField), nStr(req.p.SearchValue),
    nInt(req.p.ddlState), nInt(req.p.ddlCity), nInt(req.p.enquiry_type), {});
  if (!x.sent) res.send(''); // void action => empty response
}));

/** Db._Tbl_Enquiry.Where(a => a.Status == 1 && a.EId == eid).FirstOrDefault() */
async function activeEnquiry(eid) {
  const r = await db.queryOne(DB, 'select * from tbl_enquiry where status = 1 and eid = @eid limit 1', { eid });
  return r ? mapRow(r, TBL_ENQUIRY_PROPS) : null;
}

/** Legacy reply-mail HTML template (built and filled, but - as in legacy - NOT the body that is sent: SendEmailByApiSetting gets replymsg). */
const REPLY_BODY_TEMPLATE = "<div style='margin: auto; background: #fff url(http://qlook.bz/images/topborder.png) top left repeat-x; border: 2px solid #ddd; width: 700px; padding-bottom: 7px; -webkit-box-shadow: 0 2px 9px rgba(0, 0, 0, 0.65); -moz-box-shadow: 0 2px 9px rgba(0, 0, 0, 0.65); box-shadow: 0 2px 9px rgba(0, 0, 0, 0.65);'>\n           <table width='700' style='background: #14c5aa; margin: 0px auto; padding: 45px 0px;'>\n        <tr>\n            <td>\n                <table cellpadding='0' cellspacing='0' style='background: none repeat scroll 0 0 #fff; border: 7px solid #dcdcdc; color: #333; font-family: Arial,Helvetica,sans-serif; margin: 0 48px; width: 585px;'>\n                    <tr>\n                        <td>\n                            <table width='585'>\n                                <tr>\n                                    <td style='width: 350px; height: 70px;background-color:#2cabe3'><a href='http://cryptoinbox.com/'>\n                                        <img src='http://cryptoinbox.com/images/logo-website.png' height='45px' border='0' style='height: 45px; margin-left: 6px; float: left;' />\n                                    </a></td>\n                                    <td style='text-align: right; font-size: 15px; padding-right: 15px; color: #333; font-family: Arial,Helvetica,sans-serif; width: 250px;'>$$date$$\n                                    </td>\n                                </tr>\n                            </table>\n                        </td>\n                    </tr>\n\n                    <tr>\n                        <td>\n                            <div>\n                                <div class='clear'></div>\n\n                                <table style='border-top: 1px solid rgb(204, 204, 204); height: auto; padding-bottom: 0px; padding-left: 12px; padding-top: 6px; width: 585px;'>\n                                    <tr>\n                                        <td>\n                                            <h1 style='font-size: 15px; font-family: arial; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42; text-decoration:none;'> Dear,<span style='color:#3b7bd1;'> $$Name$$ </span> </h1>\n                                            <p style='font-size: 13px;   margin: 0px; color: #484848;'>Thank you for Contacting CryptoInbox</p>\n\n                                             <br/>\n\n                                            </table>\n                                            <div style='clear: both'></div>\n                                            <p style='font-size: 12px; font-family: Arial; font-weight: normal; margin: 15px 0px 7px 15px; color: #3f3f42;'>\n                                               $$MESSAGE$$\n                                            </p>\n                                            <p style='font-size: 12px; font-family: Arial; font-weight: 500; margin: 15px 0px 7px 15px; color: #131313;'>You can contact  us on support@cryptoinbox.com</p>\n                                            <div style='clear: both'></div>\n                                        </td>\n                                    </tr>\n\n                                    <tr>\n                                        <td>\n                                            <table width='554'>\n                                                <tr>\n                                                    <td width='70%' style='padding-top:10px;'>\n\n                                                        <p style='font-size: 12px; font-family: Arial; font-weight: normal; margin: 6px 0px 7px 15px; float: left; color: #3f3f42;'>\n\n                                                            Sincerely,\n                <br />\n                                                            CryptoInbox Team<br/><br/>\nhttp://cryptoinbox.com/\n\n                                                        </p>\n                                                    </td>\n                                                </tr>\n                                            </table>\n\n                                        </td>\n                                    </tr>\n                                </table>\n                                <div class='clear'></div>\n                            </div>\n                        </td>\n                    </tr>\n                </table>\n            </td>\n        </tr>\n    </table>\n        </div>";

// ---------------------------------------------------------------- JsonResult SendReply(string Eid, string replymsg, string EmailID, string Subject, string name,
//   string FromEamilid, string EmailTemplate)
// auth (PORT-NOTE: legacy had no session check; admin action that mails a member => adminAuth)
router.all(`/admin/${C}/SendReply{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Eid = nStr(req.p.Eid);
  let replymsg = nStr(req.p.replymsg);
  const EmailID = nStr(req.p.EmailID);
  const Subject = nStr(req.p.Subject);
  const name = nStr(req.p.name);
  const FromEamilid = nStr(req.p.FromEamilid);
  const eid = cvtInt(Eid); // Convert.ToInt32 outside the try (FormatException => 500)
  let ret = 'success';
  let body = '';
  try {
    if (replymsg === null) throw nullRef();
    replymsg = replymsg.split('lessthan').join('<');
    replymsg = replymsg.split('greatthan').join('>');
    replymsg = replymsg.replace(/<(.|\n)*?>/g, '');
    const Row = await activeEnquiry(eid);
    if (Row !== null) {
      // Row.LastReplyMsg = replymsg.Trim(); Row.LastReplyDate = DateTime.UtcNow; Db.SaveChanges();
      await db.exec(DB, "update tbl_enquiry set lastreplymsg = @msg, lastreplydate = (now() at time zone 'utc') where eid = @eid",
        { msg: replymsg.trim(), eid: Row.EId });
    }
    if (EmailID !== '' || EmailID !== null) { // always true (legacy condition)
      body = REPLY_BODY_TEMPLATE;
      body = body.split('$$Name$$').join(name === null ? '' : name);
      body = body.split('$$MESSAGE$$').join(replymsg);
      const now = new Date();
      const utc = new Date(now.getTime() + now.getTimezoneOffset() * 60000);
      body = body.split('$$date$$').join(netFormat(utc, 'M/d/yyyy')); // DateTime.UtcNow.ToShortDateString() (en-US)
      void body;
      // new Thread(() => SendEmailByApiSetting(name,"","",FromEamilid,"","",EmailID,Subject,replymsg,null,"","")).Start()
      Promise.resolve()
        .then(() => UtilityClass.SendEmailByApiSetting(name, '', '', FromEamilid, '', '', EmailID, Subject, replymsg, null, '', ''))
        .catch((e) => console.error('[admin] Enquiry_Details SendReply mail failed:', e.message));
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'SendReply');
    ret = 'error';
  }
  return res.json(ret);
}));

// ---------------------------------------------------------------- JsonResult DeleteEnquiry(string Eid)
// auth (PORT-NOTE: legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/DeleteEnquiry{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const eid = cvtInt(nStr(req.p.Eid));
  const Row = await activeEnquiry(eid);
  if (Row !== null) {
    await db.exec(DB, 'update tbl_enquiry set status = 2 where eid = @eid', { eid: Row.EId }); // Row.Status = 2; SaveChanges()
    return res.json('success');
  }
  return res.json('error');
}));

// ---------------------------------------------------------------- JsonResult GetEnquiryDetail(string EnquiryID)
// auth (PORT-NOTE: legacy had no session check; enquiry personal data => adminAuth)
router.all(`/admin/${C}/GetEnquiryDetail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const eid = cvtInt(nStr(req.p.EnquiryID));
  const Row = await activeEnquiry(eid);
  if (Row !== null) return res.json(Row);
  return res.json('error');
}));

// ---------------------------------------------------------------- JsonResult Ctid(int SID)
// public (master-data city list; no session check in legacy)
router.all(`/admin/${C}/Ctid{/:id}`, asyncHandler(async (req, res) => {
  const SID = reqInt(req.p.SID, 'SID');
  const ctname = await new CITY().City_List_On_SID(SID);
  return res.json(ctname);
}));

// ---------------------------------------------------------------- JsonResult GetAllEmailTemplate()
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetAllEmailTemplate{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const list = mapRows(await db.query(DB, 'select etid, title from tbl_emailtemplate where status = 1', {}), ['ETID', 'TITLE']);
  return res.json(list);
}));

// ---------------------------------------------------------------- JsonResult GetAllFromEmailTemplate()
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetAllFromEmailTemplate{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const list = mapRows(await db.query(DB, 'select eaid, emailid from tbl_emailaccount where status = 1', {}), ['EAID', 'EMAILID']);
  return res.json(list);
}));

module.exports = router;
