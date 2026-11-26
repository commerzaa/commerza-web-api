// Ported from ClusterofferShopingPortal/Controllers/UserPanel/Orders.cs
'use strict';
/**
 * OrdersController (customer order list / cancel / track). DB: Db_Shopping => 'shopping'.
 * Actions: CancelProductOrderStatus, Index, OpenOrder, CompleteOrder, ReturenedOrder, CanceledOrder, TrackOrder.
 * SendConfirmationEmail is protected (not routed, ported as an internal function). OrderDetailsIndex is commented out in legacy.
 * [DistributerSessionExpireCheck] / [CheckResellerTimeout] are no-ops; [SessionExpireCheck] => ps.customerAuth.
 */
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const { CompanyMasterSettings } = require('../../lib/portal/CompanySettings');
const { NRE, s, rep, toInt32, parseInt32, outVal, listParam, pget, bindInt, viewJson, fire } = require('./_shared/batch-21-common');

const DB = 'shopping';
const C = '/portal/Orders';
const router = express.Router();

/** class AllOrderList (Orders.cs) */
const ALL_ORDER_LIST = ['MobileNo', 'netPayblePrice', 'orderDate', 'orderID', 'orid', 'OStatus', 'PayMode', 'PayRemark', 'Poid', 'Prod_Images',
  'Product_Name', 'quntity', 'ReplacementDate', 'ReplacementDay', 'rowNumber', 'ShippingAddress', 'singleProdPrice', 'Total_Ship_Ch', 'total_cost',
  'Total_payble_vat', 'total_purchase_cost', 'OrderQty', 'OrderTotalAmount', 'OrderTotalVat', 'OrderShippingCharges', 'Status', 'Name',
  'totalPaybleAmt', 'Order_PV', 'Order_BV', 'IntStatus', 'MLMWALLET', 'MLMWALLET1', 'MLMWALLET2', 'MLMWALLET3', 'OnlinePayments', 'CUSTOMERWALLET',
  'MLMWALLETTransactionId', 'MLMWALLET1TransactionId', 'MLMWALLET2TransactionId', 'MLMWALLET3TransactionId', 'OnlinePaymentsTransactionId',
  'InvoiceNo', 'SPRID'];
/** class TrackOrder (Orders.cs) */
const TRACK_ORDER = ['IntStatus', 'CreatedDate', 'APPROVEDDATE', 'PACKEDDATE', 'HANDOVERDATE', 'TransitDate', 'PickedDate', 'DeliveredDate'];
/** class Resellerwisecompanydetails (Orders.cs) */
const RESELLER_COMPANY = ['CompanyDomain', 'COMPANYINFOEMAILID', 'CompanySupportEmailId', 'CompanyName', 'CompanyDomainLogo', 'FacebookShare',
  'TwitterShare', 'GoogleplusShare', 'LinkedinShare', 'PinterestShare'];

// Verbatim C# @"..." mail template of SendConfirmationEmail (CRLF line breaks kept)
const MAIL_TEMPLATE = "<div>\r\n<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\r\n<table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 585px'>\r\n<tbody><tr><td>\r\n<table width='585'><tbody><tr><td style='width: 350px'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='$$CompanyDomainLogo$$' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;padding: 5px;background: #0e1017;'></a></td>\r\n<td style='text-align: right; font-size: 17px; padding-right: 5px; color: #000; font-family: Arial, Helvetica, sans-serif; width: 250px'>$$datetime$$</td>\r\n</tr></tbody></table></td>\r\n</tr><tr><td>\r\n<div>\r\n<div class='clear'></div>\r\n\r\n<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px;'><tbody><tr><td>\r\n<h1 style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px15px; color: #000'>\r\nHello $$lblname$$,</h1>\r\n<p style='font-size: 16px; font-weight: normal; margin:10px 0px 20px 0px; color: #000'>\r\n<table cellpadding='0' cellspacing='0' width='98%' style='font-size:14px;  font-family:Arial; color:#454545;  border:1px solid #eaeaea; background:#f0ffff;  '>\r\n    <tr>\r\n        <td colspan='3' style='height:10px; line-height:10px;'></td>\r\n    </tr>\r\n    <tr>\r\n    <td colspan='3' style='height:10px; line-height:30px;'>$$lblmessage$$</td>\r\n    </tr>\r\n\r\n    <tr>\r\n        <td colspan='3' style='height:15px; line-height:15px;'></td>\r\n    </tr>\r\n\r\n</table>\r\n</p>\r\n<div style='clear: both'></div>\r\n<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>\r\n\r\n</p>\r\n<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>\r\nIf you have any issues regarding this mail, you can write us on <a href = 'mailto:$$SupportEmailId$$' target = '_blank' style = 'color:#00a0a8;'> $$SupportEmailId$$ </a></p>\r\n<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'></strong>\r\n<div style='clear: both'></div>\r\n\r\n<div style='clear: both'></div>\r\n</td>\r\n</tr><tr><td>\r\n<table width='554'><tbody><tr><td>\r\n<p style='font-size: 16px; line-height:1.6; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>\r\nBest Regards,\r\n<br>\r\nThe $$CompanyName$$ Team\r\n</p>\r\n</td>\r\n<td style='width: 240px; text-align: right'>\r\n<span>Follow us on</span>\r\n<br>\r\n<div style = 'margin-right: 7px; text-align:right'>\r\n<a href = '$$FacebookShare$$' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = '$$CompanyresellerDomain$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\r\n\r\n<a href = '$$TwitterShare$$' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = '$$CompanyresellerDomain$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\r\n\r\n<a href = '$$GoogleplusShare$$' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = '$$CompanyresellerDomain$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>\r\n\r\n<a href = '$$LinkedinShare$$' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = '$$CompanyresellerDomain$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>\r\n\r\n<a href = '$$PinterestShare$$' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = '$$CompanyresellerDomain$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>\r\n</div\r\n</td>\r\n</tr></tbody></table></td>\r\n</tr></tbody></table><div class='clear'></div>\r\n</div>\r\n</td>\r\n</tr></tbody></table>\r\n    </div>";

const pad2 = (n) => String(n).padStart(2, '0');
const ddMMyyyy = (d = new Date()) => `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`;
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+$/;

/** int? page binding (unparsable => null, like the MVC binder) */
function bindPage(req) {
  const v = req.p.page;
  if (v === undefined || v === null || String(v).trim() === '') return null;
  const t = String(v).trim();
  return /^[+-]?\d+$/.test(t) ? parseInt(t, 10) : null;
}

// protected void SendConfirmationEmail(string ToEmail, string Username, string Text, string subject, string Type)
async function SendConfirmationEmail(ViewBag, ToEmail, Username, Text, subject, Type) {
  let send = 0;
  let CompanyDomain = ''; let COMPANYINFOEMAILID = ''; let CompanySupportEmailId = ''; let CompanyName = ''; let CompanyDomainLogo = '';
  let FacebookShare = ''; let TwitterShare = ''; let GoogleplusShare = ''; let LinkedinShare = ''; let PinterestShare = '';
  const companyresellerurl = config.app.CompanyResellerURL;
  const companyresellerlogo = config.app.CompanyLogowithurl;
  try {
    if (Username === '') Username = ToEmail;
    if (Type !== '' && Type !== null && Type !== undefined) {
      const rows = await db.query(DB, `select coalesce(companyredirect,'') as companydomain, companyinfoemailid, companysupportemailid,
          coalesce(companyname,'') as companyname, '' as companydomainlogo, coalesce(companyfacebooklink,'') as facebookshare,
          coalesce(companygooglepluslink,'') as googleplusshare, coalesce(companyfacebooklink,'') as twittershare,
          coalesce(companylinkedinlink,'') as linkedinshare, coalesce(companypinterestlink,'') as pinterestshare
        from tbl_companysettings where pmid = 1`);
      for (const item of mapRows(rows, RESELLER_COMPANY)) {
        CompanyDomain = item.CompanyDomain;
        COMPANYINFOEMAILID = item.COMPANYINFOEMAILID;
        CompanySupportEmailId = item.CompanySupportEmailId;
        CompanyName = item.CompanyName;
        CompanyDomainLogo = item.CompanyDomainLogo;
        FacebookShare = item.FacebookShare;
        TwitterShare = item.TwitterShare;
        GoogleplusShare = item.GoogleplusShare;
        LinkedinShare = item.LinkedinShare;
        PinterestShare = item.PinterestShare;
      }
    }
    void COMPANYINFOEMAILID; void CompanyDomainLogo;
    let mailtxt = '';
    const Date_ = ddMMyyyy();
    const CompanySendMailID = config.app.ComSendMail;
    if (send === 0) {
      // new MailMessage("" + CompanySendMailID + "", ToEmail): argument validation of System.Net.Mail
      const from = s(CompanySendMailID);
      if (from === '') throw new Error("The parameter 'from' cannot be an empty string.\r\nParameter name: from");
      if (ToEmail === null || ToEmail === undefined) throw new Error('Value cannot be null.\r\nParameter name: to');
      if (String(ToEmail) === '') throw new Error("The parameter 'to' cannot be an empty string.\r\nParameter name: to");
      if (!EMAIL_RE.test(from.trim()) || !String(ToEmail).split(',').every((x) => EMAIL_RE.test(x.trim()))) {
        throw new Error('The specified string is not in the form required for an e-mail address.');
      }
      mailtxt = MAIL_TEMPLATE;
      mailtxt = rep(mailtxt, '$$lblname$$', Username);
      mailtxt = rep(mailtxt, '$$datetime$$', Date_);
      mailtxt = rep(mailtxt, '$$lblmessage$$', Text);
      mailtxt = rep(mailtxt, '$$CompanyDomain$$', CompanyDomain);
      mailtxt = rep(mailtxt, '$$CompanyURL$$', CompanyDomain);
      mailtxt = rep(mailtxt, '$$SupportEmailId$$', CompanySupportEmailId);
      mailtxt = rep(mailtxt, '$$CompanyName$$', CompanyName);
      mailtxt = rep(mailtxt, '$$CompanyDomainLogo$$', companyresellerlogo);
      mailtxt = rep(mailtxt, '$$FacebookShare$$', FacebookShare);
      mailtxt = rep(mailtxt, '$$TwitterShare$$', TwitterShare);
      mailtxt = rep(mailtxt, '$$GoogleplusShare$$', GoogleplusShare);
      mailtxt = rep(mailtxt, '$$LinkedinShare$$', LinkedinShare);
      mailtxt = rep(mailtxt, '$$PinterestShare$$', PinterestShare);
      mailtxt = rep(mailtxt, '$$CompanyresellerDomain$$', companyresellerurl);
      const process = 'Order Cancel';
      const result = '';
      const body = mailtxt;
      fire(() => UtilityClass.SendEmail('', ToEmail, '', '', subject, body, Type)); // new Thread(...).Start()
      await UtilityClass.TrackCustomersEmails(ToEmail, mailtxt, process);
      if (result === 's') {
        send = 1;
      } else {
        return;
      }
    }
  } catch (exp) {
    ViewBag.Message = exp.message;
  }
}

// ---- CancelProductOrderStatus -----------------------------------------------------------------------------
// auth-or-message (legacy: param[0] read first, then Session["Plid"] == null => Json("errro^This page has been expired, Please login again."))
router.all(`${C}/CancelProductOrderStatus{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const param = listParam(req);
  if (param === null) throw NRE();
  if (param.length === 0 || param[0] === undefined) {
    throw new RangeError('Index was out of range. Must be non-negative and less than the size of the collection.\r\nParameter name: index');
  }
  const p0 = param[0] || {};
  const OrderID = pget(p0, 'OrderID');
  const SPRID = pget(p0, 'SPRID');
  const Status = pget(p0, 'Status');
  let Remark = pget(p0, 'Remark');
  let Reason = pget(p0, 'Reason');

  let EMPID = 0; let BranchId = 0; let RegNo = 0;
  if (!ps.isCustomer(req)) {
    return res.json('errro^This page has been expired, Please login again.');
  }
  RegNo = Number(req.user.plid);
  EMPID = Number(req.user.plid);
  BranchId = Number(req.user.plid);
  void EMPID; void BranchId;
  const IsCancelByMember = RegNo !== 0;
  if (OrderID === null || OrderID === undefined || OrderID === '') return res.json('errro^Invalid Order ID');
  if (Status === null || Status === undefined || Status === '') return res.json('errro^Please select Order Status');
  // legacy precedence: (IsCancelByMember == true && Reason == null) || Reason == ""
  if ((IsCancelByMember === true && (Reason === null || Reason === undefined)) || Reason === '') {
    return res.json('errro^Please select Reason for Order Cancellation');
  }
  if (Reason === null || Reason === undefined) Reason = '';
  if (Remark === null || Remark === undefined) Remark = '';

  let Response = 'ok';
  try {
    const r1 = await db.procOne(DB, 'usp_updateorderstatus_new', {
      orderid: OrderID, poid: SPRID, status: Status, remark: Remark, reason: Reason, iscancelbymember: IsCancelByMember,
    });
    const spOutput = s(outVal(r1, 'strresult')); // DBNull.ToString() => ''
    Response = spOutput;
    // #region Refund On Return
    if (Response === 'ok^ok') {
      const r2 = await db.procOne(DB, 'usp_refundwallet', { transactionid: OrderID });
      const StrOutput = s(outVal(r2, 'stroutput'));
      if (StrOutput === 'success') {
        Response = spOutput;
        // legacy concatenated OrderID / LoginId into the SQL text; parameterised here
        const od = await db.queryOne(DB, `select coalesce(loginid,'') as loginid, coalesce(orderid,'') as orderid, coalesce(product_name,'') as product_name
            from tbl_product_order_master where orderid = @OrderID limit 1`, { OrderID });
        const Obj_orderDetails = od ? mapRow(od, ['LoginId', 'OrderId', 'Product_Name']) : null;
        if (!Obj_orderDetails) throw NRE(); // Obj_orderDetails.LoginId
        const md = await db.queryOne(DB, `select coalesce(phone,'') as phone, emailid, (fname) as username
            from tbl_customerlogin where loginid = @LoginId limit 1`, { LoginId: Obj_orderDetails.LoginId });
        const Obj_mailDetails = md ? mapRow(md, ['Phone', 'EmailID', 'UserName']) : null;
        const CompanyName = await db.scalar(DB, 'select companyname from tbl_companysettings where pmid = 1 limit 1');
        const PhoneMessage = 'Dear Customer,\r\nYour ' + s(Obj_orderDetails.Product_Name) + '  with Order Id ' + s(Obj_orderDetails.OrderId)
          + ' has been Cancel. We will notify you for further updates.\r\nThank you for shopping with us.\r\nThe ' + s(CompanyName) + ' Team';
        const Mailsubject = "Order :- '" + s(Obj_orderDetails.OrderId) + "' has been Cancel";
        const process = '';
        // legacy condition (EmailID != "" || EmailID != null) is always true
        if (Obj_mailDetails !== null && (Obj_mailDetails.EmailID !== '' || Obj_mailDetails.EmailID !== null)) {
          if (Obj_mailDetails.UserName === '' || Obj_mailDetails.UserName === null) {
            Obj_mailDetails.UserName = "Dear Sir/ Ma'am";
          }
          await SendConfirmationEmail(ViewBag, Obj_mailDetails.EmailID, Obj_mailDetails.UserName,
            'Your  - ' + s(Obj_orderDetails.Product_Name) + ' with Order Id ' + s(Obj_orderDetails.OrderId) + ' has been Cancel. We will notify you for further updates.',
            Mailsubject, 'Customer');
        }
        if (!Obj_mailDetails) throw NRE(); // Obj_mailDetails.Phone
        if (Obj_mailDetails.Phone !== null && Obj_mailDetails.Phone !== '') {
          const phone = Obj_mailDetails.Phone;
          fire(async () => { // new Thread(delegate { ... }).Start()
            await UtilityClass.SendSMSOnMobile(phone, PhoneMessage, 'Customer');
            await UtilityClass.TrackCustomersMessages(phone, PhoneMessage, process);
          });
        }
      } else {
        Response = 'error^' + 'Payment was declined !';
      }
    }
    // #endregion Refund On Return
  } catch (ex) {
    Response = 'error^' + ex.message;
  }
  return res.json(Response);
}));

// ---- Index ------------------------------------------------------------------------------------------------
// auth ([SessionExpireCheck] runs before the action, so the clid login below only happens for an existing session)
// Login action (SESSION.md section 4): with `clid` the session is re-logged via USP_PORTALLOGIN_M_CUSTOMER and a new `token` is returned.
// PORT-NOTE: legacy auto-login by encrypted CLID (reads PHONE/PASSWORD from TBL_CUSTOMERLOGIN); kept as legacy.
// route-config: customer/orders -> Orders/Index
router.all([`${C}/Index{/:id}`, C, '/portal/customer/orders'], ps.customerAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  let { SearchField, SearchValue, fromDate, toDate, Orderid, clid } = req.p;
  let page = bindPage(req);
  if (SearchField == null) SearchField = '';
  if (SearchValue == null) SearchValue = '';
  if (fromDate == null) fromDate = '';
  if (toDate == null) toDate = '';
  let token;
  let login = ps.getCustomerLogin(req);
  if (clid == null) {
    clid = '';
  } else {
    clid = await UtilityClass.Decryptword(clid);
    const custCLID = toInt32(clid);
    // legacy concatenated CLID into the SQL; parameterised here
    const UserName = await db.scalar(DB, 'select phone from tbl_customerlogin where clid = @clid limit 1', { clid: custCLID });
    const Password = await db.scalar(DB, 'select password from tbl_customerlogin where clid = @clid limit 1', { clid: custCLID });
    const didRow = await db.queryOne(DB, 'select did from tbl_customerlogin where clid = @clid limit 1', { clid: custCLID });
    if (didRow && (didRow.did === null || didRow.did === undefined)) throw new Error('The cast to value type \'System.Int32\' failed because the materialized value is null.');
    const Did = didRow ? didRow.did : 0;
    const loginRow = await db.procOne(DB, 'usp_portallogin_m_customer', { USERNAME: UserName, PASSWORD: Password, IPADDRESS: '', DID: Did });
    const ObjLogin = loginRow ? mapRow(loginRow, ps.LOGIN_PROPS) : null;
    if (ObjLogin) token = ps.issueCustomerToken(ObjLogin, req); // Session["Plid"] = ObjLogin
    else ps.sessionRemove(req, 'Plid');
    login = ObjLogin;
  }
  if (Orderid == null) Orderid = '';
  else Orderid = await UtilityClass.Decryptword(Orderid);

  let DID = 1;
  await CompanyMasterSettings.GetResellerData();
  DID = toInt32(config.app.DID);
  if (DID === 0) DID = 1;
  const MaxRows = await UtilityClass.GridPageSize();
  if (page == null) page = 1;
  if (!login) throw NRE(); // ((Login)Session["Plid"]).LoginID
  const LoginId = login.LoginID;
  const rows = await db.proc(DB, 'usp_user_order_list', {
    startrowindex: page, maxrows: MaxRows, searchfield: String(Orderid).trim(), searchvalue: String(SearchValue).trim(),
    fromdate: String(fromDate).trim(), todate: String(toDate).trim(), loginid: LoginId, status: '', did: DID,
  });
  const objAllOrderList = mapRows(rows, ALL_ORDER_LIST);
  // Int32.Parse(spOutput.Value.ToString())  (@TotalCount OUT returned as a column)
  // PORT-NOTE: no result row => no OUTPUT column in PostgreSQL; treated as 0 (SQL Server still returned @TotalCount).
  const tc = outVal(rows, 'totalcount');
  const TotalRecord = tc === null ? 0 : parseInt32(tc);
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = SearchField;
  ViewBag.SearchValue = SearchValue;
  ViewBag.fromDate = fromDate;
  ViewBag.toDate = toDate;
  ViewBag.OrderType = 'All Orders';
  return viewJson(res, '~/Views/UserPanel/Orders/Index.cshtml', objAllOrderList, ViewBag, token ? { token } : {});
}));

/** OpenOrder / CompleteOrder / ReturenedOrder / CanceledOrder (identical bodies except @status, view and ViewBag.OrderType) */
function statusList(status, viewPath, OrderType) {
  return asyncHandler(async (req, res) => {
    const ViewBag = {};
    let { SearchField, SearchValue, fromDate, toDate } = req.p;
    let page = bindPage(req);
    if (SearchField == null) SearchField = '';
    if (SearchValue == null) SearchValue = '';
    if (fromDate == null) fromDate = '';
    if (toDate == null) toDate = '';
    const MaxRows = await UtilityClass.GridPageSize();
    if (page == null) page = 1;
    const LoginId = req.user.loginid;
    // PORT-NOTE: legacy also added "@Did" (AppSettings["DID"]) to the parameter list but the command text has no @Did placeholder,
    //   so SQL Server used the proc default (@DID = 0); it is therefore not passed here either.
    const rows = await db.proc(DB, 'usp_user_order_list', {
      startrowindex: page, maxrows: MaxRows, searchfield: String(SearchField).trim(), searchvalue: String(SearchValue).trim(),
      fromdate: String(fromDate).trim(), todate: String(toDate).trim(), loginid: LoginId, status,
    });
    const objAllOrderList = mapRows(rows, ALL_ORDER_LIST);
    // PORT-NOTE: no result row => no OUTPUT column in PostgreSQL; treated as 0.
    const tc = outVal(rows, 'totalcount');
    const TotalRecord = tc === null ? 0 : parseInt32(tc);
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = SearchField;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    if (OrderType !== undefined) ViewBag.OrderType = OrderType;
    return viewJson(res, viewPath, objAllOrderList, ViewBag);
  });
}

// auth ([SessionExpireCheck])
// route-config: customer/openorder -> Orders/OpenOrder
router.all([`${C}/OpenOrder{/:id}`, '/portal/customer/openorder'], ps.customerAuth, statusList('open', '~/Views/UserPanel/Orders/Index.cshtml', 'Open Orders'));

// auth ([SessionExpireCheck])
// route-config: customer/completedorder -> Orders/CompleteOrder
router.all([`${C}/CompleteOrder{/:id}`, '/portal/customer/completedorder'], ps.customerAuth, statusList('COMPLETED', '~/Views/UserPanel/Orders/Index.cshtml', 'Completed Orders'));

// auth ([SessionExpireCheck])
// route-config: customer/returened-order -> Orders/ReturenedOrder
router.all([`${C}/ReturenedOrder{/:id}`, '/portal/customer/returened-order'], ps.customerAuth, statusList('RETURNED', '~/Views/UserPanel/Orders/returnorder.cshtml'));

// auth ([SessionExpireCheck])
// route-config: customer/cancelled-order -> Orders/CanceledOrder
router.all([`${C}/CanceledOrder{/:id}`, '/portal/customer/cancelled-order'], ps.customerAuth, statusList('CANCELLED', '~/Views/UserPanel/Orders/cancelorder.cshtml'));

// ---- TrackOrder -------------------------------------------------------------------------------------------
// public-with-session (legacy: no filter; ((Login)Session["Plid"]).LoginID inside the try => "Error" without a session)
router.all(`${C}/TrackOrder{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  const ProductNo = bindInt(req, 'ProductNo', 'System.Web.Mvc.JsonResult TrackOrder(Int32)');
  let objTrackOrder = [];
  try {
    if (ProductNo !== 0 && ProductNo !== null) {
      if (!ps.isCustomer(req)) throw NRE();
      const LoginId = req.user.loginid;
      const rows = await db.proc(DB, 'usp_track_order', { poid: ProductNo, loginid: LoginId });
      objTrackOrder = mapRows(rows, TRACK_ORDER);
    }
    return res.json(objTrackOrder);
  } catch (e) {
    return res.json('Error');
  }
}));

void toInt32;
module.exports = router;
