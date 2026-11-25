'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Investment_History.cs (class Investment_HistoryController => /admin/Investment_History/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const DataUtility = require('../../lib/admin/DataUtility');
const SendMail = require('../../lib/admin/SendMail');
const Payment_Mode = require('../../lib/admin/Payment_Mode');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/adminSession');
const B = require('./_shared/batch08_common');
const { GetHtmlBodyForPayment, GetHtmlBodyForRejectPayment } = require('./_shared/batch08C_investmentMail');

const router = express.Router();
const DB = 'affiliate';
const C = 'Investment_History';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** class RepurchaseHistory */
const REPURCHASE_HISTORY_PROPS = ['Rownumber', 'LoginID', 'TASMID', 'TotalPayableAmount', 'PaymentMode', 'ModeName', 'CommentORRemark', 'RegNo',
  'ImageName', 'BankName', 'BranchName', 'ReferenceDate', 'ReferenceNumber', 'WalletId', 'TransactionPassword', 'GoogleAuthenticationCode',
  'ShortAllPackageName', 'AllPackageName', 'PuchaseDate', 'AllPackageId', 'AllPackageType', 'AllPackageAmount', 'Status', 'Transaction_id',
  'invoice_no', 'MOBILE', 'USERNAME', 'CoinRateWhilePurchased', 'TotalPaidInYourCurrency'];
/** class InvestListDetails (property order of the C# class; JSON keys as serialised by MVC) */
const INVEST_DETAILS_PROPS = ['bankname', 'branchname', 'imagename', 'regno', 'date', 'name', 'loginid', 'email', 'mobile', 'image', 'amount',
  'paymode', 'status', 'refdate', 'refno', 'allpackagename', 'allpackageamount', 'totalpaybleamount', 'CommentORRemark', 'ProcessingFee', 'FULLNAME'];

/** DataRow["X"] (case-insensitive like DataTable columns; missing column => ArgumentException) */
function dr(row, name) {
  if (!row) throw new Error('There is no row at position 0.');
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k === undefined) throw new Error(`Column '${name}' does not belong to table .`);
  return row[k];
}
/** DataRow["X"].ToString() (DBNull => "") */
const drs = (row, name) => { const v = dr(row, name); return v === null || v === undefined ? '' : (v instanceof Date ? B.netDateString(v) : String(v)); };
/** Dt.Rows[0] (IndexOutOfRangeException-like when empty) */
const row0 = (rows) => { if (!rows || rows.length === 0) throw new Error('There is no row at position 0.'); return rows[0]; };
/** Convert.ToInt32(object) on a DataRow value: DBNull => InvalidCastException ; decimal/double => banker's rounding ; string => Int32.Parse */
function cInt32Obj(v) {
  if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  const bank = (n) => { const f = Math.floor(n); const d = n - f; return d === 0.5 ? (f % 2 === 0 ? f : f + 1) : Math.round(n); };
  if (typeof v === 'number') return bank(v);
  const t = String(v).trim();
  if (/^[-+]?\d+$/.test(t)) return parseInt(t, 10);
  if (/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) return bank(parseFloat(t)); // numeric column delivered as a string by pg
  throw new Error('Input string was not in a correct format.');
}
/** DateTime.Now.ToString("dddd MMMM dd yyyy hh:mm tt") (en-US) */
function nowLong() {
  const d = new Date();
  const DAY = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const p2 = (n) => String(n).padStart(2, '0');
  const h = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return `${DAY[d.getDay()]} ${MONTH[d.getMonth()]} ${p2(d.getDate())} ${d.getFullYear()} ${p2(h)}:${p2(d.getMinutes())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}
/** new Thread(() => SendMail.Send(...)).Start() - fire and forget */
function sendMailAsync(to, subject, body) {
  Promise.resolve().then(() => SendMail.Send('', to, '', '', subject, body)).catch((e) => console.error('[Investment_History] SendMail:', e.message));
}

/** public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, int? page, string PaymentMode) */
async function ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate, page, PaymentMode) {
  const userid = req.user.emp_id;
  const Filename = 'Investment_History' + userid + '_' + B.nowStamp();
  await B.excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize(); // eslint-disable-line no-unused-vars
  if (page === null) page = 1;
  if (SearchValue === null || SearchField === null || fromDate === null || toDate === null) throw B.nullRef(); // .Trim() on null
  const Obj = mapRows(await db.proc(DB, 'USP_RepurchseMANAGESUBSCRIPTIONMASTER', {
    Mode: '1', PLID: '0', STARTROWINDEX: '1', MAXROWS: '10000', REQFIELD: '0', ASC: '1', ORDERBYFIELD: '',
    SEARCHFIELD: SearchValue.trim(), SEARCHVALUE: SearchField.trim(), FROMDATE: fromDate.trim(), TODATE: toDate.trim(), UserName: '',
    PurchageDate: '', AllPackageName: '', TotalPayableAmount: '0', PaymentMode, BankName: '', BranchName: '', ReferenceNumber: '',
    ReferenceDate: '', Status: '', loginid: '', transid: '', mobile: '', IsDownload: '0', userid: '0', Package: '',
  }), REPURCHASE_HISTORY_PROPS);
  if (Obj.length > 0) {
    return B.writeXlsExport({
      req, res, ViewBag, sheet: 'Investment_History.xls', Filename, setFilepath: false, // (ViewBag.filepath = filepath is commented out)
      headers: ['S.No.', 'Date', 'Order Id', 'User Name', 'Contact No.', 'Email ID', 'Package', 'Amount', 'Mode', 'Details'],
      rows: Obj,
      innerProc: 'RepurchaseHistory',
      outerProc: 'USP_RepurchseMANAGESUBSCRIPTIONMASTER',
      cells: (item, w) => {
        w('\n');
        w(B.tab(B.cellStr(item, 'Rownumber')) + ' \t');
        w(B.tab(B.cellStr(item, 'PuchaseDate')) + ' \t');
        w(B.tab(B.cellStr(item, 'Transaction_id')) + ' \t');
        w(B.tab(B.cellStr(item, 'USERNAME')) + ' \t');
        w(B.tab(B.cellStr(item, 'MOBILE')) + ' \t');
        w(B.tab(B.cellStr(item, 'LoginID')) + ' \t');
        w(B.tab(B.cellStr(item, 'ShortAllPackageName')) + ' \t');
        w(B.tab(B.dec2(item.TotalPayableAmount)) + ' \t');
        w(B.tab(B.cellStr(item, 'ModeName')) + ' \t');
        w(B.tab(B.cellStr(item, 'Status')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? dynamicpagging, string SearchField, string SearchValue, string fromDate, string toDate, int? page, string PaymentMode, string btnexel, int? jointype, string UserDownlineSearch, int? Side)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, asyncHandler(async (req, res) => {
  const p = req.p;
  let dynamicpagging = B.nInt(p.dynamicpagging);
  let SearchField = B.nStr(p.SearchField);
  let SearchValue = B.nStr(p.SearchValue);
  let fromDate = B.nStr(p.fromDate);
  let toDate = B.nStr(p.toDate);
  let page = B.nInt(p.page);
  let PaymentMode = B.nStr(p.PaymentMode);
  let btnexel = B.nStr(p.btnexel);
  let jointype = B.nInt(p.jointype);
  let UserDownlineSearch = B.nStr(p.UserDownlineSearch);
  let Side = B.nInt(p.Side);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  ViewBag.PayList = await Payment_Mode.PayModeList();
  if (SearchField === null) SearchField = '';
  if (jointype === null) jointype = 0;
  if (SearchValue === null) SearchValue = '';
  if (dynamicpagging === null) {
    const value = config.app.DynamicPagging; // AppSettings["DynamicPagging"]
    dynamicpagging = B.cvtInt(value === undefined ? null : value); // Convert.ToInt16(string)
  }
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (PaymentMode === null) PaymentMode = '';
  if (btnexel === null) btnexel = '';
  if (UserDownlineSearch === null) UserDownlineSearch = '';
  if (Side === null) Side = 0;
  const er = await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  const ev = B.outStr(er, 'ISACTIVE');
  ViewBag.excelactive = B.cvtInt(ev === '0' ? '0' : ev);
  const Employeeid = req.user.emp_id;
  const perm = await db.procOne(DB, 'USP_GETEXCELPERMISIONSTATUS', { EMPID: Employeeid, HERF: url });
  const s1 = B.outStr(perm, 'EXCELSTATUS'); const s2 = B.outStr(perm, 'ISEDIT');
  ViewBag.isactive = B.cvtInt(s1 === '' ? '0' : s1);
  ViewBag.isedit = B.cvtInt(s2 === '' ? '0' : s2);
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    // PORT-NOTE: legacy passes SearchValue as @SEARCHFIELD and SearchField as @SEARCHVALUE (kept).
    const rows = await db.proc(DB, 'USP_RepurchseMANAGESUBSCRIPTIONMASTER', {
      Mode: '1', PLID: '0', STARTROWINDEX: page, MAXROWS: MaxRows, REQFIELD: '0', ASC: '1', ORDERBYFIELD: '',
      SEARCHFIELD: SearchValue.trim(), SEARCHVALUE: SearchField.trim(), FROMDATE: fromDate.trim(), TODATE: toDate.trim(), UserName: '',
      PurchageDate: '', AllPackageName: '', TotalPayableAmount: '0', PaymentMode, BankName: '', BranchName: '', ReferenceNumber: '',
      ReferenceDate: '', Status: '', loginid: '', transid: '', mobile: '', IsDownload: '0', userid: '0', Package: '',
      JOINTYPE: jointype, Userdownlinemember: UserDownlineSearch, SIDE: Side,
    });
    const Obj = mapRows(rows, REPURCHASE_HISTORY_PROPS);
    // PORT-NOTE: OUT @RECORDCOUNT is read from the first result row; no row => "0".
    const rc = rows.length ? B.outStr(rows[0], 'RECORDCOUNT') : '0';
    B.cvtInt(rc === '' ? 'x' : rc); // int TotalRecord1 = Convert.ToInt32(spOutput.Value.ToString()) ("" => FormatException)
    const TotalRecord = B.cvtInt(rc === '' ? '0' : rc);
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows; ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.PaymentMode = PaymentMode;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag, SearchField, SearchValue, fromDate, toDate, page, PaymentMode);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Investment_History/Index.cshtml', Model: Obj, ...ViewBag });
  } catch (ExpObj) {
    return B.errorView(req, res, ExpObj, 'USP_RepurchseMANAGESUBSCRIPTIONMASTER');
  }
}));

// ---------------------------------------------------------------- JsonResult showdetails(string tasmid)
// public (legacy had no session check)
router.all(`/admin/${C}/showdetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const tasmid = B.nStr(req.p.tasmid);
  const DetailList = [];
  const objdut = new DataUtility();
  const param = [DataUtility.SqlParameter('@TASMID', B.cvtInt(tasmid))];
  const dt = await objdut.GetDataTableSP(param, 'USP_GETSUBSCRIPTIONDETAILS');
  for (const dtrow of dt) {
    const details = {};
    for (const k of INVEST_DETAILS_PROPS) details[k] = null;
    details.date = drs(dtrow, 'DATE');
    details.name = drs(dtrow, 'USERNAME');
    details.email = drs(dtrow, 'EMAIL');
    details.mobile = drs(dtrow, 'PHONE');
    details.paymode = drs(dtrow, 'ModeName');
    details.bankname = drs(dtrow, 'BANKNAME');
    details.branchname = drs(dtrow, 'BRANCHNAME');
    details.refdate = drs(dtrow, 'ReferenceDate');
    details.refno = drs(dtrow, 'ReferenceNumber');
    details.allpackagename = drs(dtrow, 'AllPackageName');
    details.allpackageamount = drs(dtrow, 'AllPackageAmount');
    details.totalpaybleamount = drs(dtrow, 'TotalPayableAmount');
    details.CommentORRemark = drs(dtrow, 'CommentORRemark');
    details.imagename = drs(dtrow, 'IMAGENAME');
    details.ProcessingFee = drs(dtrow, 'ProcessingFee');
    details.FULLNAME = drs(dtrow, 'FNAME') + ' ' + drs(dtrow, 'LNAME');
    DetailList.push(details);
  }
  return res.json(DetailList);
}));

// ---------------------------------------------------------------- JsonResult verifyPayment(string tasmid, string remarks, string email)
// public (legacy had no session check - see security notes)
router.all(`/admin/${C}/verifyPayment{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const tasmid = B.nStr(req.p.tasmid);
  const remarks = B.nStr(req.p.remarks);
  const email = B.nStr(req.p.email);
  const objdut = new DataUtility();
  const SP = DataUtility.SqlParameter;
  const param = [SP('@TASMID', B.cvtInt(tasmid)), SP('@REMARKS', remarks), SP('@IntResult', null, 'Output')];
  const Result = await objdut.ExecuteSqlSP(param, '[Usp_PaymentManagement]');
  const Status = String(Result); // param[2].Value.ToString()
  if (Status === '100') return res.json('100');
  const datetime = nowLong();
  const Param = [SP('@TASMID', B.cvtInt(tasmid))];
  const Dt = await objdut.GetDataTableSP(Param, 'USP_GETSUBSCRIPTIONDETAILS');
  try {
    const regno = B.cvtInt(drs(row0(Dt), 'RegNo')); // Convert.ToInt32(Dt.Rows[0]["RegNo"].ToString())
    // PORT-NOTE: legacy concatenated the REGNO into the SQL text; parameterised here.
    const dt = await objdut.GetDataTable([SP('@REGNO', regno)], `select coalesce(address, '') as address, coalesce(cityname, '') as cityname,
      coalesce(s.statename, '') as state, c.countryname from member_master mm left join country c on c.cid = mm.cid
      left join state s on s.sid = mm.sid where mm.regno = @REGNO`);
    let Address = drs(row0(dt), 'ADDRESS') + ', ' + drs(dt[0], 'CITYNAME') + ', ' + drs(dt[0], 'State') + ', ' + drs(dt[0], 'COUNTRYNAME');
    Address = Address.split(',,').join(''); // eslint-disable-line no-unused-vars
    const AllPackageName = drs(Dt[0], 'AllPackageName').split('~');
    const Count = AllPackageName.length; // eslint-disable-line no-unused-vars
    const AllPackageAmount = drs(Dt[0], 'AllPackageAmount').split('~'); // eslint-disable-line no-unused-vars
    let AmountInWords = ''; let TaxAmountInWords = ''; // eslint-disable-line no-unused-vars
    let Totalpayable = 0; let servicetax = 0;
    Totalpayable = cInt32Obj(dr(Dt[0], 'TotalPayableAmount'));
    servicetax = cInt32Obj(dr(Dt[0], 'service_tax'));
    AmountInWords = await UtilityClass.NumberToWords(Totalpayable);
    TaxAmountInWords = await UtilityClass.NumberToWords(servicetax);
    const ID = drs(Dt[0], 'TASMID');
    const EncryptId = await UtilityClass.Encryptword(ID);
    const link = "<a href='http://cryptoinbox.com/view-invoices/" + EncryptId + "'>Attached </a>";
    const Message = 'Your payment has been accepted by our Administrative Team. Thank you.';
    const SmsMessage = 'Dear ' + drs(Dt[0], 'USERNAME') + ",\r\nYour subscription purchase order '" + drs(Dt[0], 'Transaction_id')
      + "' has approved. Login to your customer panel to print purchase bill. Thank you.\r\nThe Cryptoinbox Team ";
    await UtilityClass.SendMsgOnMobile(drs(Dt[0], 'PHONE'), SmsMessage);
    let body = GetHtmlBodyForPayment();
    body = body.split('$$lblName$$').join(drs(Dt[0], 'USERNAME'));
    body = body.split('$$lbldate$$').join(datetime);
    body = body.split('$$lblpackages$$').join(drs(Dt[0], 'AllPackageName'));
    body = body.split('$$lblPurchaseDate$$').join(drs(Dt[0], 'PuchaseDate'));
    body = body.split('$$lblReferenceDate$$').join(drs(Dt[0], 'ReferenceDate'));
    body = body.split('$$lblReference$$').join(drs(Dt[0], 'ReferenceNumber'));
    body = body.split('$$lblTotalPayableAmount$$').join(drs(Dt[0], 'TotalPayableAmount'));
    body = body.split('$$lblmessage$$').join(Message);
    body = body.split('$$lbllink$$').join(link);
    body = body.split('$$ConfirmReject$$').join('Confirmation');
    body = body.split('$$Attached$$').join(link);
    body = body.split('$$Link$$').join('http://cryptoinbox.com/view-invoices/' + EncryptId);
    sendMailAsync(email, 'Payment confirmation', body);
  } catch (Ex) {
    // (empty catch in legacy)
  }
  return res.json(Result);
}));

// ---------------------------------------------------------------- JsonResult rejectPayment(string tasmid, string remarks, string email)
// public (legacy had no session check - see security notes)
router.all(`/admin/${C}/rejectPayment{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const tasmid = B.nStr(req.p.tasmid);
  const remarks = B.nStr(req.p.remarks);
  const email = B.nStr(req.p.email);
  const objdut = new DataUtility();
  const SP = DataUtility.SqlParameter;
  const param = [SP('@TASMID', B.cvtInt(tasmid)), SP('@remarks', remarks), SP('@IntResult', null, 'Output')];
  const Result = await objdut.ExecuteSqlSP(param, '[Usp_PaymentManagement1]');
  const datetime = nowLong();
  const Param = [SP('@TASMID', B.cvtInt(tasmid))];
  const Dt = await objdut.GetDataTableSP(Param, 'USP_GETSUBSCRIPTIONDETAILS');
  try {
    const Message = "Your payment has been <span style='color:red'>Rejected</span> by our Administrative Team. <br> Reason is: "
      + (remarks === null ? '' : remarks) + '</br>';
    const SmsMessage = "Your payment dated on '" + drs(row0(Dt), 'PuchaseDate') + "' with Order ID '" + drs(Dt[0], 'Transaction_id')
      + "' for packages '" + drs(Dt[0], 'AllPackageName')
      + "' is Rejected by Cryptoinbox Administration. \r\nThank you \r\nFor Query contact us on support@cryptoinbox.com";
    await UtilityClass.SendMsgOnMobile(drs(Dt[0], 'PHONE'), SmsMessage);
    let allpackagepurchase = '';
    allpackagepurchase = drs(Dt[0], 'AllPackageName');
    const allpackagename = allpackagepurchase.split('~').join(',');
    let body = GetHtmlBodyForRejectPayment();
    body = body.split('$$lblName$$').join(drs(Dt[0], 'USERNAME'));
    body = body.split('$$lbldate$$').join(datetime);
    body = body.split('$$lblPackName$$').join(allpackagename);
    body = body.split('$$lblPurchaseDate$$').join(drs(Dt[0], 'PuchaseDate'));
    body = body.split('$$lblReferenceDate$$').join(drs(Dt[0], 'ReferenceDate'));
    body = body.split('$$lblReference$$').join(drs(Dt[0], 'ReferenceNumber'));
    body = body.split('$$lblTotalPayableAmount$$').join(drs(Dt[0], 'TotalPayableAmount'));
    body = body.split('$$lblmessage$$').join(Message);
    body = body.split('$$ConfirmReject$$').join('Rejection');
    sendMailAsync(email, 'Payment Rejected', body);
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'rejectPayment');
  }
  return res.json(Result);
}));

// ---------------------------------------------------------------- public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, int? page, string PaymentMode)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const p = req.p;
  const r = await ExportReport(req, res, {}, B.nStr(p.SearchField), B.nStr(p.SearchValue), B.nStr(p.fromDate), B.nStr(p.toDate),
    B.nInt(p.page), B.nStr(p.PaymentMode));
  if (!r.sent) res.send(''); // void action => empty response
}));

// (public static string GetHtmlBodyForPayment() / GetHtmlBodyForRejectPayment(): static methods are not MVC actions (MVC only selects
//  public INSTANCE methods) => not routed; logic in _shared/batch08C_investmentMail.js)

module.exports = router;
