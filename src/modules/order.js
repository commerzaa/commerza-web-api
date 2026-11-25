'use strict';
/**
 * Port of Controllers/WebPanelCntrl/OrderController.cs (8 routes).
 */
const express = require('express');
const config = require('../config');
const db = require('../db');
const { mapRows } = require('../utils/shape');
const { auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const UtilityClass = require('../lib/UtilityClass');
const DAL_RegistrationOrLogin = require('../lib/DAL_RegistrationOrLogin');

const router = express.Router();

const NRE = 'Object reference not set to an instance of an object.';

// ---- helpers -------------------------------------------------------------------------------------
const isNull = (v) => v === undefined || v === null;
const str = (v) => (isNull(v) ? null : String(v));
const nz = (v) => (isNull(v) ? '' : String(v)); // "if (x == null) x = "";"

/** Int32? binding: invalid / missing => null */
function toInt32Nullable(v) {
  if (isNull(v) || String(v).trim() === '') return null;
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) return null;
  const n = parseInt(s, 10);
  return (n > 2147483647 || n < -2147483648) ? null : n;
}

/** Convert.ToInt64(string): throws FormatException for null-safe invalid input (null => 0 only for object null; here string) */
function convertToInt64(v) {
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return Number(s);
}

/** Convert.ToDouble(string): null => 0, invalid => FormatException */
function convertToDouble(v) {
  if (isNull(v)) return 0;
  const s = String(v).trim();
  if (s === '' || isNaN(Number(s))) throw new Error('Input string was not in a correct format.');
  return Number(s);
}

const ALL_ORDER_LIST_PROPS = ['MobileNo', 'netPayblePrice', 'orderDate', 'orderID', 'orid', 'OStatus', 'PayMode', 'PayRemark',
  'Poid', 'Prod_Images', 'Product_Name', 'quntity', 'ReplacementDate', 'ReplacementDay', 'rowNumber', 'ShippingAddress',
  'singleProdPrice', 'Total_Ship_Ch', 'total_cost', 'Total_payble_vat', 'total_purchase_cost', 'OrderQty', 'OrderTotalAmount',
  'OrderTotalVat', 'OrderShippingCharges', 'Status', 'Name', 'totalPaybleAmt', 'Order_PV', 'Order_BV', 'IntStatus', 'MLMWALLET',
  'MLMWALLET1', 'MLMWALLET2', 'MLMWALLET3', 'OnlinePayments', 'CUSTOMERWALLET', 'MLMWALLETTransactionId',
  'MLMWALLET1TransactionId', 'MLMWALLET2TransactionId', 'MLMWALLET3TransactionId', 'OnlinePaymentsTransactionId', 'InvoiceNo', 'SPRID'];

const TRACK_ORDER_PROPS = ['IntStatus', 'CreatedDate', 'APPROVEDDATE', 'PACKEDDATE', 'HANDOVERDATE', 'TransitDate', 'PickedDate', 'DeliveredDate'];

function dateJson(d) { // .NET DateTime JSON
  if (d === null || d === undefined) return d;
  const x = d instanceof Date ? d : new Date(d);
  if (isNaN(x.getTime())) return d;
  return x.toISOString().replace(/\.\d{3}Z$/, '');
}

/** usp_user_order_list -> List<AllOrderList>. (@TotalCount OUT is parsed but never used by the legacy code.) */
async function getUserOrderList(args) {
  const rows = await db.proc('shopping', 'usp_user_order_list', args);
  return mapRows(rows, ALL_ORDER_LIST_PROPS).map((r) => {
    r.ReplacementDate = dateJson(r.ReplacementDate);
    return r;
  });
}

/**
 * Re-creates the legacy grouping exactly (including its quirk: OStatus/MobileNo/OrderQty/orderDate/ShippingAddress/
 * totalPaybleAmt of group "o" are taken from the o-th ROW of the list, not from the group's own rows).
 */
function groupOrders(list) {
  const n = list.length;
  let count = 0;
  const oids = new Array(n).fill(null);
  for (const item of list) {
    if (!oids.includes(item.orderID)) { oids[count] = item.orderID; count++; }
  }
  const orderidwise = [];
  for (let o = 0; o < count; o++) {
    const data = list.filter((x) => x.orderID === oids[o]);
    orderidwise.push({
      OStatus: list[o].OStatus,
      totalPaybleAmt: list[o].totalPaybleAmt,
      ShippingAddress: list[o].ShippingAddress,
      OrderQty: list[o].OrderQty,
      orderDate: list[o].orderDate,
      MobileNo: list[o].MobileNo,
      orderID: oids[o],
      Order: data,
    });
  }
  return orderidwise;
}

async function getResellerData() {
  const lib = require('../lib/CompanySettings');
  const m = lib.CompanyMasterSettings || lib;
  await m.GetResellerData();
}

// ---- OrderList / OrderlistUpdate --------------------------------------------------------------------
// Shared body of OrderList and OrderlistUpdate (both identical; OrderlistUpdate discards the result).
async function orderListCore(Plid, SearchField, loginID, SearchValue, page, fromDate, toDate, Orderid /* , clid */) {
  // legacy: clid = null is forced at the top, so the clid branch (customer re-login SP) is dead code.
  SearchValue = nz(SearchValue);
  fromDate = nz(fromDate);
  toDate = nz(toDate);
  if (isNull(Orderid)) Orderid = '';
  else Orderid = await UtilityClass.Decryptword(Orderid);

  await getResellerData();
  let DID = parseInt(config.app.DID, 10);
  if (DID === 0) DID = 1;

  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null || page === undefined) page = 1;

  const list = await getUserOrderList({
    startrowindex: page,
    maxrows: MaxRows,
    searchfield: String(Orderid).trim(),
    searchvalue: SearchValue.trim(),
    fromdate: fromDate.trim(),
    todate: toDate.trim(),
    loginid: isNull(loginID) ? null : loginID,
    status: '',
    did: DID,
  });
  return list;
}

// public status lists: OpenOrder / CompleteOrder / ReturenedOrder / CanceledOrder
async function statusOrderList(req, res, status) {
  const p = req.p;
  const SearchField = nz(p.SearchField); // unused afterwards in legacy
  void SearchField;
  const SearchValue = nz(p.SearchValue);
  const fromDate = nz(p.fromDate);
  const toDate = nz(p.toDate);
  const MaxRows = await UtilityClass.GridPageSize();
  let page = toInt32Nullable(p.page);
  if (page === null) page = 1;
  // PORT-NOTE: legacy passed @Did as an extra SqlParameter that is not in the EXEC text => the SP default (0) applied; did omitted here.
  const list = await getUserOrderList({
    startrowindex: page,
    maxrows: MaxRows,
    searchfield: SearchField.trim(),
    searchvalue: SearchValue.trim(),
    fromdate: fromDate.trim(),
    todate: toDate.trim(),
    loginid: isNull(p.LoginID) ? null : p.LoginID,
    status,
  });
  res.json([{ status: 'true', message: 'success', data: groupOrders(list) }]);
}

// auth
router.post('/api/OrderList', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const page = toInt32Nullable(p.page);
  const list = await orderListCore(p.Plid, p.SearchField, p.loginID, p.SearchValue, page, p.fromDate, p.toDate, p.Orderid);
  res.json([{ status: 'true', message: 'success', data: groupOrders(list) }]);
}));

// auth
router.post('/api/TrackOrder', auth, asyncHandler(async (req, res) => {
  const ProductNo = toInt32Nullable(req.p.ProductNo);
  if (ProductNo === null) {
    return res.status(400).json({ Message: 'The request is invalid.' });
  }
  const LoginID = req.p.LoginID;
  let objTrackOrder = [];
  try {
    if (ProductNo !== 0) {
      const rows = await db.proc('shopping', 'usp_track_order', { poid: ProductNo, loginid: isNull(LoginID) ? null : LoginID });
      objTrackOrder = mapRows(rows, TRACK_ORDER_PROPS);
    }
    return res.json([{ status: 'true', message: 'success', data: objTrackOrder }]);
  } catch (e) {
    return res.json([{ status: 'true', message: 'error' }]);
  }
}));

// auth
router.post('/api/OpenOrder', auth, asyncHandler((req, res) => statusOrderList(req, res, 'open')));
// auth
router.post('/api/CompleteOrder', auth, asyncHandler((req, res) => statusOrderList(req, res, 'COMPLETED')));
// auth
router.post('/api/ReturenedOrder', auth, asyncHandler((req, res) => statusOrderList(req, res, 'RETURNED')));
// auth
router.post('/api/CanceledOrder', auth, asyncHandler((req, res) => statusOrderList(req, res, 'CANCELLED')));

// ---- CancelProductOrderStatus -----------------------------------------------------------------------
function outValue(row, name) {
  if (!row) return '';
  let v = row[name];
  if (v === undefined) { const k = Object.keys(row); v = k.length ? row[k[0]] : null; }
  return isNull(v) ? '' : String(v);
}

function replaceAll(s, token, value) { return String(s).split(token).join(value); }

const MAIL_TEMPLATE = `<div>
<link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style='background: #ebfafb; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif;width: 585px'>
<tbody><tr><td>
<table width='585'><tbody><tr><td style='width: 350px'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='$$CompanyDomainLogo$$' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;padding: 5px;background: #0e1017;'></a></td>
<td style='text-align: right; font-size: 17px; padding-right: 5px; color: #000; font-family: Arial, Helvetica, sans-serif; width: 250px'>$$datetime$$</td>
</tr></tbody></table></td>
</tr><tr><td>
<div>
<div class='clear'></div>

<table style='padding-bottom: 10px; margin: 6px; padding-left: 12px; width: 554px; padding-top: 6px;'><tbody><tr><td>
<h1 style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px15px; color: #000'>
Hello $$lblname$$,</h1>
<p style='font-size: 16px; font-weight: normal; margin:10px 0px 20px 0px; color: #000'>
<table cellpadding='0' cellspacing='0' width='98%' style='font-size:14px;  font-family:Arial; color:#454545;  border:1px solid #eaeaea; background:#f0ffff;  '>
    <tr>
        <td colspan='3' style='height:10px; line-height:10px;'></td>
    </tr>
    <tr>
    <td colspan='3' style='height:10px; line-height:30px;'>$$lblmessage$$</td>
    </tr>

    <tr>
        <td colspan='3' style='height:15px; line-height:15px;'></td>
    </tr>

</table>
</p>
<div style='clear: both'></div>
<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>

</p>
<p style='font-size: 16px; font-weight: normal; margin: 10px 0px 7px 0px; padding-top: 14px; font-family: Arial, Helvetica, sans-serif; color: #000'>
If you have any issues regarding this mail, you can write us on <a href = 'mailto:$$SupportEmailId$$' target = '_blank' style = 'color:#00a0a8;'> $$SupportEmailId$$ </a></p>
<strong style='font-size: 16px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 0px; color: #000'></strong>
<div style='clear: both'></div>

<div style='clear: both'></div>
</td>
</tr><tr><td>
<table width='554'><tbody><tr><td>
<p style='font-size: 16px; line-height:1.6; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; float: left; color: #000'>
Best Regards,
<br>
The $$CompanyName$$ Team
</p>
</td>
<td style='width: 240px; text-align: right'>
<span>Follow us on</span>
<br>
<div style = 'margin-right: 7px; text-align:right'>
<a href = '$$FacebookShare$$' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = '$$CompanyresellerDomain$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

<a href = '$$TwitterShare$$' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = '$$CompanyresellerDomain$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

<a href = '$$GoogleplusShare$$' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = '$$CompanyresellerDomain$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

<a href = '$$LinkedinShare$$' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = '$$CompanyresellerDomain$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

<a href = '$$PinterestShare$$' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = '$$CompanyresellerDomain$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>
</div
</td>
</tr></tbody></table></td>
</tr></tbody></table><div class='clear'></div>
</div>
</td>
</tr></tbody></table>
    </div>`;

function ddMMyyyy(d) {
  const z = (n) => String(n).padStart(2, '0');
  return `${z(d.getDate())}-${z(d.getMonth() + 1)}-${d.getFullYear()}`;
}

async function SendConfirmationEmail(ToEmail, Username, Text, subject, Type) {
  let CompanyDomain = '', CompanySupportEmailId = '', CompanyName = '', CompanyDomainLogo = '';
  let FacebookShare = '', TwitterShare = '', GoogleplusShare = '', LinkedinShare = '', PinterestShare = '';
  const companyresellerurl = config.app.CompanyResellerURL;
  const companyresellerlogo = config.app.CompanyLogowithurl;
  try {
    if (Username === '') Username = ToEmail;
    if (Type !== '' && !isNull(Type)) {
      const list = await db.query('shopping',
        `Select coalesce(companyredirect,'') as CompanyDomain, companyinfoemailid, companysupportemailid, coalesce(companyname,'') as CompanyName,
           '' as CompanyDomainLogo, coalesce(companyfacebooklink,'') as FacebookShare, coalesce(companygooglepluslink,'') as GoogleplusShare,
           coalesce(companyfacebooklink,'') as TwitterShare, coalesce(companylinkedinlink,'') as LinkedinShare,
           coalesce(companypinterestlink,'') as PinterestShare
         from tbl_companysettings where pmid=1`);
      for (const item of list) {
        CompanyDomain = item.companydomain;
        CompanySupportEmailId = item.companysupportemailid;
        CompanyName = item.companyname;
        CompanyDomainLogo = item.companydomainlogo;
        FacebookShare = item.facebookshare;
        TwitterShare = item.twittershare;
        GoogleplusShare = item.googleplusshare;
        LinkedinShare = item.linkedinshare;
        PinterestShare = item.pinterestshare;
      }
    }
    const Date_ = ddMMyyyy(new Date());
    let mailtxt = MAIL_TEMPLATE;
    mailtxt = replaceAll(mailtxt, '$$lblname$$', Username);
    mailtxt = replaceAll(mailtxt, '$$datetime$$', Date_);
    mailtxt = replaceAll(mailtxt, '$$lblmessage$$', Text);
    mailtxt = replaceAll(mailtxt, '$$CompanyDomain$$', CompanyDomain);
    mailtxt = replaceAll(mailtxt, '$$CompanyURL$$', CompanyDomain);
    mailtxt = replaceAll(mailtxt, '$$SupportEmailId$$', CompanySupportEmailId);
    mailtxt = replaceAll(mailtxt, '$$CompanyName$$', CompanyName);
    mailtxt = replaceAll(mailtxt, '$$CompanyDomainLogo$$', companyresellerlogo);
    mailtxt = replaceAll(mailtxt, '$$FacebookShare$$', FacebookShare);
    mailtxt = replaceAll(mailtxt, '$$TwitterShare$$', TwitterShare);
    mailtxt = replaceAll(mailtxt, '$$GoogleplusShare$$', GoogleplusShare);
    mailtxt = replaceAll(mailtxt, '$$LinkedinShare$$', LinkedinShare);
    mailtxt = replaceAll(mailtxt, '$$PinterestShare$$', PinterestShare);
    mailtxt = replaceAll(mailtxt, '$$CompanyresellerDomain$$', companyresellerurl);
    const process_ = 'Order Cancel';
    // legacy: background thread sends the mail
    Promise.resolve().then(() => UtilityClass.SendEmail('', ToEmail, '', '', subject, mailtxt, Type))
      .catch((e) => console.error('SendEmail', e.message));
    await UtilityClass.TrackCustomersEmails(ToEmail, mailtxt, process_);
    // legacy: result is always "" so the method simply returns
  } catch (exp) {
    // swallowed like the legacy code
  }
}

// auth
router.post('/api/CancelProductOrderStatus', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const OrderID = str(p.OrderID);
  const Status = str(p.Status);
  let Remark = str(p.Remark);
  let Reason = str(p.Reason);
  const SPRID = str(p.SPRID);
  const Plid = str(p.Plid);

  let RegNo = 0;
  if (Plid === null) {
    return res.json('errro^This page has been expired, Please login again.');
  }
  RegNo = convertToInt64(Plid);
  const IsCancelByMember = RegNo !== 0;
  if (OrderID === null || OrderID === '') {
    return res.json('errro^Invalid Order ID');
  }
  if (Status === null || Status === '') {
    return res.json('errro^Please select Order Status');
  }
  // legacy precedence: (IsCancelByMember == true && Reason == null) || Reason == ""
  if ((IsCancelByMember === true && Reason === null) || Reason === '') {
    return res.json('errro^Please select Reason for Order Cancellation');
  }
  if (Reason === null) Reason = '';
  if (Remark === null) Remark = '';

  let Response = 'ok';
  try {
    const spArgs = {
      orderid: OrderID,
      status: Status,
      remark: Remark,
      reason: Reason,
      iscancelbymember: IsCancelByMember,
    };
    if (SPRID !== null) spArgs.poid = SPRID; // null SqlParameter => SP default
    const spRow = await db.procOne('shopping', 'usp_updateorderstatus_new', spArgs);
    Response = outValue(spRow, 'strresult');
    // Refund On Return
    if (Response === 'ok^ok') {
      const refundRow = await db.procOne('shopping', 'usp_refundwallet', { transactionid: OrderID });
      if (outValue(refundRow, 'stroutput') === 'success') {
        Response = outValue(spRow, 'strresult');
        const Obj_orderDetails = await db.queryOne('shopping',
          `Select coalesce(loginid,'') As LoginId, coalesce(orderid,'') As OrderId, coalesce(product_name,'') As Product_Name
           From tbl_product_order_master where orderid = @orderid limit 1`, { orderid: OrderID });
        if (!Obj_orderDetails) throw new Error(NRE);
        const Obj_mailDetails = await db.queryOne('shopping',
          `Select coalesce(phone,'') As Phone, emailid as EmailID, fname as UserName from tbl_customerlogin where loginid = @loginid limit 1`,
          { loginid: Obj_orderDetails.loginid });
        const CompanyName = await db.scalar('shopping', 'Select companyname from tbl_companysettings Where pmid=1 limit 1');
        const prod = Obj_orderDetails.product_name;
        const oid = Obj_orderDetails.orderid;
        const PhoneMessage = 'Dear Customer,\r\nYour ' + prod + '  with Order Id ' + oid + ' has been Cancel. We will notify you for further updates.\r\nThank you for shopping with us.\r\nThe ' + CompanyName + ' Team';
        const Mailsubject = "Order :- '" + oid + "' has been Cancel";
        const processName = '';
        if (Obj_mailDetails) { // (EmailID != "" || EmailID != null) is always true
          let UserName = Obj_mailDetails.username;
          if (UserName === '' || UserName === null) UserName = "Dear Sir/ Ma'am";
          await SendConfirmationEmail(Obj_mailDetails.emailid, UserName,
            'Your  - ' + prod + ' with Order Id ' + oid + ' has been Cancel. We will notify you for further updates.', Mailsubject, 'Customer');
        }
        if (!Obj_mailDetails) throw new Error(NRE);
        if (Obj_mailDetails.phone !== null && Obj_mailDetails.phone !== '') {
          const phone = Obj_mailDetails.phone;
          Promise.resolve().then(async () => {
            await UtilityClass.SendSMSOnMobile(phone, PhoneMessage, 'Customer');
            await UtilityClass.TrackCustomersMessages(phone, PhoneMessage, processName);
          }).catch((e) => console.error('SMS', e.message));
        }
      } else {
        Response = 'error^' + 'Payment was declined !';
      }
      await orderListCore(Plid, '', '', '', 1, '', '', OrderID);
    }
  } catch (ex) {
    Response = 'error^' + ex.message;
  }
  return res.json([{ status: 'true', message: 'success', data: Response }]);
}));

// ---- ProfileVerification ----------------------------------------------------------------------------
const randomInt = (min, maxExclusive) => Math.floor(Math.random() * (maxExclusive - min)) + min;

async function editContactDetails(Plid, mobile, email, mode) {
  // PORT-NOTE: legacy passed "" for the INT parameters (@Gender, @HighestQualification, @IsVerified); SQL Server coerced '' to 0.
  const row = await db.procOne('shopping', 'usp_editcontactdetails', {
    plid: Plid,
    cpertitle: '',
    cperdesignation: '',
    cpermobileno: mobile,
    cperemailid: email,
    firstname: '',
    lastname: '',
    username: '',
    dob: '',
    fatherormothername: '',
    gender: 0,
    highestqualification: 0,
    mode,
    isverified: 0,
    idtype: '',
    idrefno: '',
    panno: '',
  });
  return outValue(row, 'intresult');
}

// auth
router.post('/api/ProfileVerification', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const R1 = nz(p.R1);
  const R2 = nz(p.R2);
  const IsSend = nz(p.IsSend);
  const Email = nz(p.Email);
  const Phoneno = nz(p.Phoneno);
  let IsVerified = 4;
  let checkmobile = 0, checkemail = 0;
  const Plid = convertToDouble(p.plid);
  const responseData = [];
  const DID = parseInt(config.app.DID, 10);
  let ResValue = '';

  if (R1 !== '') {
    ResValue = await editContactDetails(Plid, Phoneno, '', 2);
    if (ResValue === '20') IsVerified = 1;
    else if (ResValue === '7') IsVerified = 9;
    else IsVerified = 8;
  }
  if (R2 !== '') {
    ResValue = await editContactDetails(Plid, '', Email, 3);
    if (ResValue === '30') IsVerified = 1;
    else if (ResValue === '6') IsVerified = 11;
    else IsVerified = 8;
  }
  if (R1 !== '' && R2 !== '' && IsVerified === 1) IsVerified = 1;

  if (IsSend === '1') {
    if (Phoneno !== '' && Email === '') {
      checkmobile = Number(await db.scalar('shopping', 'select count(1) from tbl_customerlogin where phone=@phone and did=@did', { phone: Phoneno, did: DID })) || 0;
      if (checkmobile === 0) {
        const R11 = randomInt(100000, 555555);
        await UtilityClass.SendMsgOnMobile(Phoneno, 'Verification Code:' + R11 + ' Please Use This Verification Code For Update Your Contact No.');
        await UtilityClass.TrackOTP(Phoneno, 'Verification Code:' + R11 + ' Please Use This Verification Code For Update Your Contact No.', 'Profile Mobile No Verifications');
        IsVerified = 10;
        responseData.push({ status: 'true', message: 'success', data: IsVerified, OTP: R11 });
        return res.json(responseData);
      }
      IsVerified = 9;
    }
    if (Email !== '' && Phoneno === '') {
      const validate_Var = await DAL_RegistrationOrLogin.validate(Email, '', '');
      if (validate_Var !== 'ok') {
        IsVerified = 13;
      } else {
        checkemail = Number(await db.scalar('shopping', 'select count(1) from tbl_customerlogin where emailid=@email and did=@did', { email: Email, did: DID })) || 0;
        if (checkemail === 0) {
          const R21 = randomInt(666666, 999999);
          // PORT-NOTE: legacy created the e-mail thread (SendMail.Send1 + TrackCustomersEmails) but returned BEFORE
          // calling Start(), so the verification e-mail was never sent; the OTP is only returned in the response. Kept as is.
          responseData.push({ status: 'true', message: 'success', data: IsVerified, OTP: R21 });
          return res.json(responseData);
        }
        IsVerified = 11;
      }
    }
    if (Email === '' && Phoneno === '') IsVerified = 7;
  }
  if (IsVerified === 1) {
    // legacy performs these calls and discards every result
    await db.procOne('shopping', 'usp_check_kyc', { plid: Plid });
    await db.scalar('shopping', "select coalesce(mobileno,'') from tbl_referenceusername where clid=@plid and status=1 limit 1", { plid: Plid });
    await db.scalar('shopping', "select coalesce(username,'') from tbl_referenceusername where clid=@plid and status=1 limit 1", { plid: Plid });
    await db.procOne('shopping', 'usp_getcontactdetails', { plid: Plid });
  }
  responseData.push({ status: 'true', message: 'success', data: IsVerified });
  return res.json(responseData);
}));

module.exports = router;
