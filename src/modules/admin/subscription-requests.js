'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\SubscriptionRequests.cs (class SubscriptionRequestsController => /admin/SubscriptionRequests/...)
// Database: affiliate (Db_Affiliate). Procs: Usp_ManageSubscriptionMaster, USP_GETSUBSCRIPTIONDETAILS, Usp_PaymentManagement, Usp_PaymentManagement1,
// USP_EXCEL_DOWNLOAD_HISTORY. Tables: member_master, country, state.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const DataUtility = require('../../lib/admin/DataUtility');
const SendMail = require('../../lib/admin/SendMail');
const Payment_Mode = require('../../lib/admin/Payment_Mode');
const CheckPermissions = require('../../lib/admin/CheckPermissions');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/admin-session');
const {
  DB, nInt, nStr, cellStr, tab, nowStamp, excelHistory, writeXlsExport, netFormat, dec2, outOf, outIntOf, trimS, cvtInt,
} = require('./_shared/batch11-common');
const { viewRes, dynPaging, drStr, cvtInt32Obj, netLongDate, fireAndForget } = require('./_shared/batch13-08-common');

const router = express.Router();
const C = 'SubscriptionRequests';

/** class SubscriptionRequest */
const SR_PROPS = ['Rownumber', 'LoginID', 'TASMID', 'TotalPayableAmount', 'PaymentMode', 'ModeName', 'CommentORRemark', 'RegNo', 'ImageName',
  'BankName', 'BranchName', 'ReferenceDate', 'ReferenceNumber', 'WalletId', 'TransactionPassword', 'GoogleAuthenticationCode',
  'ShortAllPackageName', 'AllPackageName', 'PuchaseDate', 'AllPackageId', 'AllPackageType', 'AllPackageAmount', 'Status', 'Transaction_id',
  'invoice_no', 'TOUSERNAME', 'MOBILE', 'USERNAME', 'CoinRateWhilePurchased', 'TotalPaidInYourCurrency'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** Usp_ManageSubscriptionMaster @Mode,...,@RECORDCOUNT OUT,...,@TotalUSD out,@orderbydate (note: @SEARCHFIELD <= SearchValue, @SEARCHVALUE <= SearchField, as legacy) */
const subscriptionProc = (o) => db.proc(DB, 'Usp_ManageSubscriptionMaster', {
  Mode: '1', PLID: '0', STARTROWINDEX: o.page, MAXROWS: o.MaxRows, REQFIELD: '0', ASC: '1', ORDERBYFIELD: '',
  SEARCHFIELD: trimS(o.SearchValue), SEARCHVALUE: trimS(o.SearchField), FROMDATE: trimS(o.fromDate), TODATE: trimS(o.toDate),
  UserName: '', PurchageDate: '', AllPackageName: '', TotalPayableAmount: '0', PaymentMode: o.PaymentMode, BankName: '', BranchName: '',
  ReferenceNumber: '', ReferenceDate: '', Status: '', loginid: '', transid: '', mobile: '', IsDownload: '0', userid: '0', Package: o.package,
  JOINTYPE: o.jointype, Userdownlinemember: o.UserDownlineSearch, SIDE: o.Side, TopupSearching: o.SelfToprPayIfForwward, orderbydate: o.orderbydate,
});

// public static string GetHtmlBodyForPayment()  (static => not an MVC action)
const PAYMENT_BODY = "<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px; padding-bottom:10px;'>\r\n  <div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>\r\n    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\r\n    <table cellpadding='0' cellspacing='0' style=' margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>\r\n        <tbody>\r\n\r\n      <tr>\r\n        <td><table style='width:100%;'>\r\n            <tbody>\r\n              <tr>\r\n                <td width='100%' align='center'><a href='http://cryptoinbox.com/' target='UlOxf6W290vd9HCE04UigQH'> <img src='http://cryptoinbox.com/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>\r\n              </tr>\r\n            </tbody>\r\n          </table></td>\r\n      </tr>\r\n        <tr>\r\n\r\n        <td>\r\n\r\n      <div>\r\n        <div class='clear'></div>\r\n        <table style='padding-bottom: 10px; width: 100%; '>\r\n          <tbody>\r\n            <tr>\r\n              <td>\r\n            <tr>\r\n              <td align='center'><strong style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> Package Purchase Approved\r\n                </p>\r\n                </strong>\r\n                <div style='text-align:left;'>\r\n                  <h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px\r\n\r\n15px; color: #3f3f42;'>Dear $$lblName$$, </h1>\r\n                  <strong style='font-size: 14px;font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #3f3f42;'> Your subscription order has been approved. Attached is the bill for your records.</strong></br>\r\n                  <a href='$$Link$$'>$$Link$$</a>\r\n                  <div style='font-size: 15px; color: #333;'>\r\n                    <p style='font-size:14px;  margin-top:20px; margin-bottom:0;'>Your new package pack details are :</p><br>\r\n                    <p style='font-size:14px; margin:5px; margin-left:0; '> Package: $$lblpackages$$ </p>\r\n                    <p style='font-size:14px; margin:5px; margin-left:0; '> Type of subscription:  </p>\r\n                    <p style='font-size:14px;  margin:5px; margin-left:0;'> Starts Date: $$lblPurchaseDate$$ </p>\r\n                    <p style='font-size:14px;   margin:5px; margin-left:0;'> End Date: $$lbldate$$ </p>\r\n                  </div>\r\n                </div>\r\n                <div style='clear: both'></div>\r\n                <div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>\r\n                  <h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>\r\n                          <p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000' > If you have any issues,\r\n            we will be happy to help you. You can contact us on <a href = 'mailto:support@cryptoinbox.com' target = '_blank' style = 'color:#00a0a8;' > support@cryptoinbox.com </a ></p >\r\n\r\n                                     </div >\r\n\r\n                                     </td >\r\n\r\n                                 </tr >\r\n\r\n                               <div style = 'clear: both' ></div >\r\n\r\n                                <div style = 'clear: both' ></div >\r\n\r\n                                   </td >\r\n\r\n                                   </tr >\r\n\r\n                                 <tr >\r\n\r\n                                   <td ><table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;' >\r\n\r\n                                          <tbody >\r\n\r\n                                            <tr >\r\n\r\n                                            <td >\r\n\r\n                                                <p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;' > Sincerely </p >\r\n\r\n                                                   <h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;' > The Cryptoinbox Team</h5 >\r\n\r\n                                                  </td >\r\n\r\n                                                    <td >\r\n\r\n                                                    <div style = 'margin-right: 7px; text-align:right' >\r\n\r\n                                                     <a href = '#' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9' > <img src = 'http://cryptoinbox.com/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' > </a >\r\n\r\n                                                                <a href = '#' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9' > <img src = 'http://cryptoinbox.com/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' ></a >\r\n\r\n                                                                           <a href = '#' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD' > <img src = 'http://cryptoinbox.com/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' > </a >\r\n\r\n                                                                                      <a href = '#' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB' > <img src = 'http://cryptoinbox.com/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' ></a >\r\n\r\n                                                                                                  <a href = '#' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk' > <img src = 'http://cryptoinbox.com/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' ></a >\r\n\r\n                                                                                                             </div ></td >\r\n\r\n                                                                                                          </tr >\r\n\r\n                                                                                                        </tbody >\r\n\r\n                                                                                                      </table ></td >\r\n\r\n                                                                                                  </tr >\r\n\r\n                                                                                                    </tbody >\r\n\r\n                                                                                                </table >\r\n\r\n                                                                                                <div class='clear'></div>\r\n      </div>\r\n        </td>\r\n\r\n        </tr>\r\n\r\n        </tbody>\r\n\r\n    </table>\r\n  </div>\r\n  <p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;' >© 2016-2017 All Rights Reserved | cryptoinbox.com</p>\r\n</div>";
// public static string GetHtmlBodyForRejectPayment()  (static => not an MVC action)
const REJECT_BODY = "<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px; padding-bottom:10px;'>\r\n  <div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>\r\n    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\r\n    <table cellpadding='0' cellspacing='0' style=' margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>\r\n        <tbody>\r\n\r\n      <tr>\r\n        <td><table style='width:100%;'>\r\n            <tbody>\r\n              <tr>\r\n                <td width='100%' align='center'><a href='http://cryptoinbox.com/' target='UlOxf6W290vd9HCE04UigQH'> <img src='http://cryptoinbox.com/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>\r\n              </tr>\r\n            </tbody>\r\n          </table></td>\r\n      </tr>\r\n        <tr>\r\n\r\n        <td>\r\n\r\n      <div>\r\n        <div class='clear'></div>\r\n        <table style='padding-bottom: 10px; width: 100%; '>\r\n          <tbody>\r\n            <tr>\r\n              <td>\r\n            <tr>\r\n              <td align='center'><strong style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'> Package Purchase Declined\r\n                </p>\r\n                </strong>\r\n                <div style='text-align:left;'>\r\n                  <h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px\r\n\r\n15px; color: #3f3f42;'>Dear $$lblName$$, </h1>\r\n                  <div style='font-size: 15px; color: #333;'>\r\n                    <p style='font-size:14px;  margin-top:20px; margin-bottom:0;'>Your subscription purchase order  $$lblPackName$$. Your payment has been declined, possible causes are: </p>\r\n                    <ul style='margin:10px 0px 0px 20px; padding:0;'>\r\n                      <li style='font-size:14px; margin:5px; margin-left:0; '> The details you have provided are incorrect, recheck the information. </li>\r\n                      <li style='font-size:14px;  margin:5px; margin-left:0;'> No balance available, ensure you have available funds. </li>\r\n                      <li style='font-size:14px;  margin:5px; margin-left:0;'> System error may have occurred, try again or use alternative payment method. </li>\r\n                    </ul>\r\n                  </div>\r\n                </div>\r\n                <div style='clear: both'></div>\r\n                <div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>\r\n                  <h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>\r\n                          <p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000' > If you have any issues,\r\n            we will be happy to help you. You can contact us on <a href = 'mailto:support@cryptoinbox.com' target = '_blank' style = 'color:#00a0a8;' > support@cryptoinbox.com </a ></p >\r\n\r\n                                     </div >\r\n\r\n                                     </td >\r\n\r\n                                 </tr >\r\n\r\n                               <div style = 'clear: both' ></div >\r\n\r\n                                <div style = 'clear: both' ></div >\r\n\r\n                                   </td >\r\n\r\n                                   </tr >\r\n\r\n                                 <tr >\r\n\r\n                                   <td ><table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;' >\r\n\r\n                                          <tbody >\r\n\r\n                                            <tr >\r\n\r\n                                            <td >\r\n\r\n                                                <p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;' > Sincerely </p >\r\n\r\n                                                   <h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;' > The Cryptoinbox Team</h5 >\r\n\r\n                                                  </td >\r\n\r\n                                                    <td >\r\n\r\n                                                    <div style = 'margin-right: 7px; text-align:right' >\r\n\r\n                                                     <a href = '#' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9' > <img src = 'http://cryptoinbox.com/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' > </a >\r\n\r\n                                                                <a href = '#' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9' > <img src = 'http://cryptoinbox.com/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' ></a >\r\n\r\n                                                                           <a href = '#' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD' > <img src = 'http://cryptoinbox.com/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' > </a >\r\n\r\n                                                                                      <a href = '#' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB' > <img src = 'http://cryptoinbox.com/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' ></a >\r\n\r\n                                                                                                  <a href = '#' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk' > <img src = 'http://cryptoinbox.com/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' ></a >\r\n\r\n                                                                                                             </div ></td >\r\n\r\n                                                                                                          </tr >\r\n\r\n                                                                                                        </tbody >\r\n\r\n                                                                                                      </table ></td >\r\n\r\n                                                                                                  </tr >\r\n\r\n                                                                                                    </tbody >\r\n\r\n                                                                                                </table >\r\n\r\n                                                                                                <div class='clear'></div>\r\n      </div>\r\n        </td>\r\n\r\n        </tr>\r\n\r\n        </tbody>\r\n\r\n    </table>\r\n  </div>\r\n  <p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center' >© 2016-2017 All Rights Reserved | cryptoinbox.com</p>\r\n</div>";
const GetHtmlBodyForPayment = () => PAYMENT_BODY;
const GetHtmlBodyForRejectPayment = () => REJECT_BODY;

/** string.Replace(old, new) (all occurrences) */
const rep = (s, a, b) => s.split(a).join(b === null || b === undefined ? '' : b);

// public void ExportReport(string SearchField, string SearchValue, string fromDate, string toDate, int? page, string PaymentMode, int? jointype, string UserDownlineSearch, int? Side, string SelfToprPayIfForwward, string package)
async function ExportReport(req, res, o, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Sales_Report_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const MaxRows = await UtilityClass.GridPageSize();
  const page = o.page === null ? 1 : o.page;
  const Obj = mapRows(await subscriptionProc({ ...o, page, MaxRows, orderbydate: '' }), SR_PROPS);
  if (Obj.length > 0) {
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Sales_Report.xls', Filename, setFilepath: false, // (ViewBag.filepath = filepath commented out in legacy)
      headers: ['S.No.', 'Date', 'OrderId', 'UserName', 'ToUsername', 'ContactNo.', 'Package', 'Amount', 'Mode', 'Details'],
      rows: Obj,
      innerProc: 'SubscriptionRequest',
      outerProc: 'Usp_ManageSubscriptionMaster',
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'Rownumber')) + ' \t');
        // Convert.ToDateTime(item.PuchaseDate).ToString("dd/MM/yyyy")  (null => DateTime.MinValue)
        w(tab(item.PuchaseDate === null ? '01/01/0001' : netFormat(item.PuchaseDate, 'dd/MM/yyyy')) + ' \t');
        w(tab(cellStr(item, 'Transaction_id')) + ' \t');
        w(tab(cellStr(item, 'USERNAME')) + ' \t');
        w(tab(cellStr(item, 'TOUSERNAME')) + ' \t');
        w(tab(cellStr(item, 'MOBILE')) + ' \t');
        w(tab(cellStr(item, 'ShortAllPackageName').trim()) + ' \t');
        w(tab(dec2(item.TotalPaidInYourCurrency)) + ' \t');
        w(cellStr(item, 'ModeName').replace(/\t/g, '   ') + ' \t'); // (3 spaces in legacy)
        w(tab(cellStr(item, 'Status')) + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string fromDate, string toDate, int? page, string PaymentMode, string btnexel, int? jointype, string UserDownlineSearch, int? Side, string SelfToprPayIfForwward, string package)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/subscription-request" -> SubscriptionRequests/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/subscription-request'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  ViewBag.PayList = await Payment_Mode.PayModeList();
  const d = (k) => { const v = nStr(req.p[k]); return v === null ? '' : v; };
  const SearchField = d('SearchField');
  const pkg = d('package');
  let jointype = nInt(req.p.jointype); if (jointype === null) jointype = 0;
  const SearchValue = d('SearchValue');
  let dynamicpagging = nInt(req.p.dynamicpagging);
  if (dynamicpagging === null) dynamicpagging = dynPaging();
  const orderbydate = d('orderbydate');
  const fromDate = d('fromDate');
  const toDate = d('toDate');
  const PaymentMode = d('PaymentMode');
  const btnexel = d('btnexel');
  const UserDownlineSearch = d('UserDownlineSearch');
  let Side = nInt(req.p.Side); if (Side === null) Side = 0;
  const SelfToprPayIfForwward = d('SelfToprPayIfForwward');
  let page = nInt(req.p.page);
  const Empid = req.user.emp_id;
  const perm = await CheckPermissions.GetPageActionPermission(url, Empid);
  ViewBag.isactive = perm._opIsDownloadAllowed;
  ViewBag.isedit = perm._opIsEditAllowed;
  ViewBag.excelactive = await CheckPermissions.GetExcelPermission(url);
  try {
    const MaxRows = Number(dynamicpagging);
    if (page === null) page = 1;
    const o = { SearchField, SearchValue, fromDate, toDate, page, PaymentMode, jointype, UserDownlineSearch, Side, SelfToprPayIfForwward, package: pkg };
    const rows = await subscriptionProc({ ...o, MaxRows, orderbydate });
    const Obj = mapRows(rows, SR_PROPS);
    const rc = outOf(rows, 'RECORDCOUNT');
    const TotalRecord = parseInt(rc === '' ? '0' : rc, 10);
    const TOTALUSD = outIntOf(rows, 'TotalUSD'); // int.Parse(v == "" ? "0" : v)
    ViewBag.TOTALUSD = TOTALUSD;
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.orderbydate = orderbydate;
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.PaymentMode = PaymentMode;
    ViewBag.package = pkg;
    ViewBag.UserDownlineSearch = UserDownlineSearch;
    ViewBag.Side = Side;
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, o, ViewBag);
      if (r.sent) return undefined;
    }
    return viewRes(res, '~/Views/AdminPanel/SubscriptionRequests/Index.cshtml', Obj, ViewBag);
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'Usp_ManageSubscriptionMaster');
    return viewRes(res, '~/Views/PageNotFound/Index.cshtml', undefined, ViewBag);
  }
}));

// ---------------------------------------------------------------- JsonResult showdetails(string tasmid)
// auth (legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/showdetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const tasmid = nStr(req.p.tasmid);
  const objdut = new DataUtility();
  const dt = await objdut.GetDataTableSP([DataUtility.SqlParameter('@TASMID', cvtInt(tasmid))], 'USP_GETSUBSCRIPTIONDETAILS');
  const DetailList = [];
  for (const dtrow of dt) {
    // class ListDetails (property order kept; unset properties stay null)
    DetailList.push({
      bankname: drStr(dtrow, 'BANKNAME'),
      branchname: drStr(dtrow, 'BRANCHNAME'),
      imagename: drStr(dtrow, 'IMAGENAME'),
      regno: null,
      date: drStr(dtrow, 'DATE'),
      name: drStr(dtrow, 'USERNAME'),
      loginid: null,
      email: drStr(dtrow, 'EMAIL'),
      mobile: drStr(dtrow, 'PHONE'),
      image: null,
      amount: null,
      paymode: drStr(dtrow, 'ModeName'),
      status: null,
      refdate: drStr(dtrow, 'ReferenceDate'),
      refno: drStr(dtrow, 'ReferenceNumber'),
      allpackagename: drStr(dtrow, 'AllPackageName'),
      allpackageamount: drStr(dtrow, 'AllPackageAmount'),
      totalpaybleamount: drStr(dtrow, 'TotalPayableAmount'),
      CommentORRemark: drStr(dtrow, 'CommentORRemark'),
      ProcessingFee: drStr(dtrow, 'ProcessingFee'),
      FULLNAME: drStr(dtrow, 'FNAME') + ' ' + drStr(dtrow, 'LNAME'),
    });
  }
  return res.json(DetailList);
}));

// ---------------------------------------------------------------- JsonResult verifyPayment(string tasmid, string remarks, string email)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/verifyPayment{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const tasmid = nStr(req.p.tasmid);
  const remarks = nStr(req.p.remarks);
  const email = nStr(req.p.email);
  const objdut = new DataUtility();
  const Result = await objdut.ExecuteSqlSP([
    DataUtility.SqlParameter('@TASMID', cvtInt(tasmid)),
    DataUtility.SqlParameter('@REMARKS', remarks),
    DataUtility.SqlParameter('@IntResult', null, 'Output'),
  ], '[Usp_PaymentManagement]');
  const Status = String(Result); // param[2].Value.ToString()
  if (Status === '100') return res.json('100');
  const datetime = netLongDate(new Date());
  const Dt = await objdut.GetDataTableSP([DataUtility.SqlParameter('@TASMID', cvtInt(tasmid))], 'USP_GETSUBSCRIPTIONDETAILS');
  try {
    const r0 = Dt[0];
    if (!r0) throw new Error('There is no row at position 0.');
    // PORT-NOTE: legacy concatenated RegNo into the SQL; parameterised.
    const regno = cvtInt(drStr(r0, 'RegNo'));
    const dt = await objdut.GetDataTable([DataUtility.SqlParameter('@regno', regno)],
      `select coalesce(mm.address, '') as address, coalesce(mm.cityname, '') as cityname, coalesce(s.statename, '') as state, c.countryname
       from member_master mm left join country c on c.cid = mm.cid left join state s on s.sid = mm.sid where mm.regno = @regno`);
    if (!dt[0]) throw new Error('There is no row at position 0.');
    let Address = drStr(dt[0], 'ADDRESS') + ', ' + drStr(dt[0], 'CITYNAME') + ', ' + drStr(dt[0], 'State') + ', ' + drStr(dt[0], 'COUNTRYNAME');
    Address = rep(Address, ',,', ''); void Address;
    const AllPackageName = drStr(r0, 'AllPackageName').split('~'); void AllPackageName.length;
    const AllPackageAmount = drStr(r0, 'AllPackageAmount').split('~'); void AllPackageAmount;
    const Totalpayable = cvtInt32Obj(Object.entries(r0).find(([k]) => k.toLowerCase() === 'totalpayableamount')?.[1] ?? null);
    const servicetax = cvtInt32Obj(Object.entries(r0).find(([k]) => k.toLowerCase() === 'service_tax')?.[1] ?? null);
    const AmountInWords = await UtilityClass.NumberToWords(Totalpayable); void AmountInWords;
    const TaxAmountInWords = await UtilityClass.NumberToWords(servicetax); void TaxAmountInWords;
    const ID = drStr(r0, 'TASMID');
    const EncryptId = await UtilityClass.Encryptword(ID);
    const link = "<a href='http://cryptoinbox.com/view-invoices/" + EncryptId + "'>Attached </a>";
    const Message = 'Your payment has been accepted by our Administrative Team. Thank you.';
    const SmsMessage = 'Dear ' + drStr(r0, 'USERNAME') + ",\r\nYour subscription purchase order '" + drStr(r0, 'Transaction_id')
      + "' has approved. Login to your customer panel to print purchase bill. Thank you.\r\nThe Cryptoinbox Team ";
    await UtilityClass.SendMsgOnMobile(drStr(r0, 'PHONE'), SmsMessage);
    let body = GetHtmlBodyForPayment();
    body = rep(body, '$$lblName$$', drStr(r0, 'USERNAME'));
    body = rep(body, '$$lbldate$$', datetime);
    body = rep(body, '$$lblpackages$$', drStr(r0, 'AllPackageName'));
    body = rep(body, '$$lblPurchaseDate$$', drStr(r0, 'PuchaseDate'));
    body = rep(body, '$$lblReferenceDate$$', drStr(r0, 'ReferenceDate'));
    body = rep(body, '$$lblReference$$', drStr(r0, 'ReferenceNumber'));
    body = rep(body, '$$lblTotalPayableAmount$$', drStr(r0, 'TotalPayableAmount'));
    body = rep(body, '$$lblmessage$$', Message);
    body = rep(body, '$$lbllink$$', link);
    body = rep(body, '$$ConfirmReject$$', 'Confirmation');
    body = rep(body, '$$Attached$$', link);
    body = rep(body, '$$Link$$', 'http://cryptoinbox.com/view-invoices/' + EncryptId);
    fireAndForget(() => SendMail.Send('', email, '', '', 'Payment confirmation', body)); // new Thread(...).Start()
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'verifyPayment');
  }
  return res.json(Result);
}));

// ---------------------------------------------------------------- JsonResult rejectPayment(string tasmid, string remarks, string email)
// auth (legacy had no session check; admin-only write => adminAuth)
router.all(`/admin/${C}/rejectPayment{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const tasmid = nStr(req.p.tasmid);
  const remarks = nStr(req.p.remarks);
  const email = nStr(req.p.email);
  const objdut = new DataUtility();
  const Result = await objdut.ExecuteSqlSP([
    DataUtility.SqlParameter('@TASMID', cvtInt(tasmid)),
    DataUtility.SqlParameter('@remarks', remarks),
    DataUtility.SqlParameter('@IntResult', null, 'Output'),
  ], '[Usp_PaymentManagement1]');
  const datetime = netLongDate(new Date());
  const Dt = await objdut.GetDataTableSP([DataUtility.SqlParameter('@TASMID', cvtInt(tasmid))], 'USP_GETSUBSCRIPTIONDETAILS');
  try {
    const r0 = Dt[0];
    if (!r0) throw new Error('There is no row at position 0.');
    const Message = "Your payment has been <span style='color:red'>Rejected</span> by our Administrative Team. <br> Reason is: " + (remarks === null ? '' : remarks) + '</br>';
    const SmsMessage = "Your payment dated on '" + drStr(r0, 'PuchaseDate') + "' with Order ID '" + drStr(r0, 'Transaction_id') + "' for packages '"
      + drStr(r0, 'AllPackageName') + "' is Rejected by Cryptoinbox Administration. \r\nThank you \r\nFor Query contact us on support@cryptoinbox.com";
    await UtilityClass.SendMsgOnMobile(drStr(r0, 'PHONE'), SmsMessage);
    const allpackagepurchase = drStr(r0, 'AllPackageName');
    const allpackagename = rep(allpackagepurchase, '~', ',');
    let body = GetHtmlBodyForRejectPayment();
    body = rep(body, '$$lblName$$', drStr(r0, 'USERNAME'));
    body = rep(body, '$$lbldate$$', datetime);
    body = rep(body, '$$lblPackName$$', allpackagename);
    body = rep(body, '$$lblPurchaseDate$$', drStr(r0, 'PuchaseDate'));
    body = rep(body, '$$lblReferenceDate$$', drStr(r0, 'ReferenceDate'));
    body = rep(body, '$$lblReference$$', drStr(r0, 'ReferenceNumber'));
    body = rep(body, '$$lblTotalPayableAmount$$', drStr(r0, 'TotalPayableAmount'));
    body = rep(body, '$$lblmessage$$', Message);
    body = rep(body, '$$ConfirmReject$$', 'Rejection');
    fireAndForget(() => SendMail.Send('', email, '', '', 'Payment Rejected', body)); // new Thread(...).Start()
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'rejectPayment');
  }
  return res.json(Result);
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const s = (k) => nStr(req.p[k]);
  const r = await ExportReport(req, res, {
    SearchField: s('SearchField'), SearchValue: s('SearchValue'), fromDate: s('fromDate'), toDate: s('toDate'), page: nInt(req.p.page),
    PaymentMode: s('PaymentMode'), jointype: nInt(req.p.jointype), UserDownlineSearch: s('UserDownlineSearch'), Side: nInt(req.p.Side),
    SelfToprPayIfForwward: s('SelfToprPayIfForwward'), package: s('package'),
  }, {});
  if (!r.sent) res.send('');
}));

module.exports = router;
