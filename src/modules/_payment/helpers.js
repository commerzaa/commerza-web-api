'use strict';
/**
 * Helpers for PaymentController (NOT auto-mounted: lives in a sub-folder).
 * Port of the non-routed public/protected methods of Controllers/WebPanelCntrl/PaymentController.cs
 * (Resellerwalletdeduction, Generatehash512, SaveData, SendConfirmationToConcern, getFranchise,
 *  PaymentSuccess, SendMailconfirmation, PaymentFailed) plus Models/RazorCoreAPI.CreateOrder.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const axios = require('axios');
const config = require('../../config');
const { query, queryOne, scalar, exec, proc, procOne } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');
const { Encryptword, Decryptword } = require('../../utils/crypto');
const UtilityClass = require('../../lib/UtilityClass');

/* ------------------------------------------------------------------ config */
const appCfg = () => config.app;
// legacy CompanySettings.CompanyREDIRECT (AppSettings["CompanyREDIRECT"])
const companyRedirect = () => appCfg().CompanyREDIRECT || process.env.COMPANY_REDIRECT || appCfg().CompanyURL || '';

/* --------------------------------------------------------- C# conversions */
/** Convert.ToDecimal(string): null => 0, blank/invalid => FormatException */
function toDecimal(v) {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim();
  if (s === '' || !/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) throw new Error('Input string was not in a correct format.');
  return Number(s);
}
/** Convert.ToInt32(string) */
function toInt(v) {
  if (v === undefined || v === null) return 0;
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseInt(s, 10);
}
/** Convert.ToInt64/ToInt32(decimal): banker's rounding (round half to even) */
function roundEven(n) {
  const f = Math.floor(n);
  const d = n - f;
  if (Math.abs(d - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1;
  return Math.round(n);
}
/** string.ToString() on a possibly-null value => NullReferenceException */
function req(v) {
  if (v === null || v === undefined) throw new TypeError('Object reference not set to an instance of an object.');
  return String(v);
}
const pad = (n, l = 2) => String(n).padStart(l, '0');
/** DateTime.Now.ToString("yyyyMMddHHmmssffff") */
function tranIdNow() {
  const d = new Date();
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}${pad(d.getMilliseconds(), 3)}0`;
}
/** DateTime.Now.ToString() with en-US culture: "M/d/yyyy h:mm:ss tt" */
function dateTimeNowString() {
  const d = new Date();
  const h = d.getHours();
  return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()} ${h % 12 === 0 ? 12 : h % 12}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${h < 12 ? 'AM' : 'PM'}`;
}
/** String.Replace (all occurrences, no special replacement patterns) */
const repAll = (s, a, b) => String(s).split(a).join(b === null || b === undefined ? '' : String(b));
const fire = (fn) => { Promise.resolve().then(fn).catch((e) => console.error('[PaymentController] background task failed:', e && e.message)); };

// DBO.FUN_GETCURRENTDATE() => India current time
const FUN_GETCURRENTDATE = "(now() at time zone 'Asia/Kolkata')";

/* ------------------------------------------------------------ 3rd party HTTP */
/** POST json to the reseller/MLM wallet API (HttpWebRequest). Returns parsed JObject. Non-2xx => throws (WebException). */
async function walletApiPost(baseUrl, apiPath, body) {
  const r = await axios.post(baseUrl + apiPath, JSON.stringify(body), {
    headers: { 'Content-Type': 'application/json' },
    responseType: 'text',
    transformResponse: [(d) => d],
    timeout: 100000,
  });
  const o = JSON.parse(r.data);
  if (o === null || typeof o !== 'object' || Array.isArray(o)) throw new Error('Error reading JObject from JsonReader.');
  return o;
}
/** ResellerApi class serialised by JavaScriptSerializer (all properties, declaration order) */
const resellerApi = (o) => ({ MemberID: o.MemberID, WalletID: o.WalletID, Amount: o.Amount === undefined ? 0 : o.Amount, Type: o.Type === undefined ? null : o.Type, TransactionID: o.TransactionID === undefined ? null : o.TransactionID });
/** JToken["x"].ToString() : missing/null => NullReferenceException */
const jstr = (o, k) => req(o[k]);
/** JArray handling of the "Details" token: returns null when Details.ToString() == "[]" */
function detailsArr(o) {
  const d = o.Details;
  if (d === null || d === undefined) throw new TypeError('Object reference not set to an instance of an object.');
  if (Array.isArray(d)) return d.length === 0 ? null : d;
  const s = String(d);
  if (s === '[]') return null;
  return JSON.parse(s);
}

/* ------------------------------------------------------- order amount queries */
async function getOrderAmount(tranId) {
  const v = await scalar('shopping', 'select coalesce(amount,0) from tbl_orderonlinerequests where transactionid=@t limit 1', { t: String(tranId) });
  return v === null ? 0 : Number(v);
}
async function getActualOrderId(tranId) {
  const v = await scalar('shopping', 'select orderid from tbl_orderonlinerequests where transactionid=@t limit 1', { t: String(tranId) });
  return v === null || v === undefined ? null : String(v);
}
/** Paid via wallets. voucherMultiplier / includeCod differ between flows exactly as in the legacy queries. */
async function getOfflinePaid(actualOrderId, voucherMultiplier, includeCod) {
  const cod = includeCod ? '+codpayment' : '';
  const v = await scalar('shopping',
    `select coalesce((cashbackwalletused+cashwalletused+ewalletused${cod}+(voucherwalletused*${voucherMultiplier})),0) from tbl_orderpayment_history where orderid=@o limit 1`,
    { o: actualOrderId === null ? '' : actualOrderId });
  return v === null ? 0 : Number(v);
}

/* ---------------------------------------- ENCRYPTBYPASSPHRASE / DECRYPTBYPASSPHRASE */
// PORT-NOTE: SQL Server ENCRYPTBYPASSPHRASE has no PostgreSQL equivalent. The legacy Token is only an opaque value
// handed to PaymentSuccess whose verification result is never enforced, so AES-256-CBC keyed by SHA-256(passphrase)
// is used ("0x"+hex like CONVERT(VARCHAR(MAX), varbinary, 1)).
function encryptByPassphrase(pass, text) {
  const iv = crypto.randomBytes(16);
  const c = crypto.createCipheriv('aes-256-cbc', crypto.createHash('sha256').update(String(pass), 'utf8').digest(), iv);
  return '0x' + Buffer.concat([iv, c.update(String(text), 'utf8'), c.final()]).toString('hex').toUpperCase();
}
function decryptByPassphrase(pass, tokenHex) {
  try {
    const b = Buffer.from(String(tokenHex).replace(/^0x/i, ''), 'hex');
    const d = crypto.createDecipheriv('aes-256-cbc', crypto.createHash('sha256').update(String(pass), 'utf8').digest(), b.subarray(0, 16));
    return Buffer.concat([d.update(b.subarray(16)), d.final()]).toString('utf8');
  } catch (e) { return null; }
}
const makeToken = (username, refrenceid, response) => encryptByPassphrase(String(username === null || username === undefined ? '' : username) + String(refrenceid === null || refrenceid === undefined ? '' : refrenceid), response);
/** Key used for token validation: USERNAME+TRANSACTIONID of the order's customer */
async function tokenKey(transactionId) {
  const v = await scalar('shopping',
    "select username||''||transactionid from tbl_orderonlinerequests inner join tbl_customerlogin on tbl_customerlogin.clid=tbl_orderonlinerequests.clid where transactionid=@t limit 1",
    { t: String(transactionId) });
  return v === null ? null : String(v);
}

/* ------------------------------------------------------------- Generatehash512 */
function Generatehash512(text) {
  return crypto.createHash('sha512').update(Buffer.from(text, 'utf8')).digest('hex');
}

/* ------------------------------------------------------------ Razorpay CreateOrder */
/** Port of RazorCoreAPI.CreateOrder. Returns response text, or the exception message when the request fails. */
async function RazorCreateOrder(amount, receipt) {
  const url = 'https://api.razorpay.com/v1/orders';
  const postRequest = JSON.stringify({ amount, currency: 'INR', receipt, payment_capture: 1 });
  let resp;
  try {
    const auth = Buffer.from(`${appCfg().razorpayKeyId}:${appCfg().razorpayKeySecret}`).toString('base64');
    const r = await axios.post(url, postRequest, {
      headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + auth },
      responseType: 'text', transformResponse: [(d) => d], timeout: 100000,
    });
    resp = r.data;
  } catch (e) {
    return e.message;
  }
  try {
    // PORT-NOTE: USP_MANAGEGATEWAYRESPONSE is not in the schema dumps; failures are swallowed exactly like the legacy try/catch.
    await proc('shopping', 'usp_managegatewayresponse', { amount, orderid: receipt, request: postRequest, response: resp });
  } catch (e) { /* legacy: return StrPostData anyway */ }
  return resp;
}

/* ------------------------------------------------------ Resellerwalletdeduction */
async function Resellerwalletdeduction(grosspayble, source, refrenceid, FailURL, SuccessURL, Response) {
  const tranid = tranIdNow();
  if (source !== null && source !== undefined && String(source) === 'Recharge') {
    const row = await procOne('shopping', 'usp_userresellerwallet_recharge', {
      ordernumber: String(refrenceid), usedamount: 0, tranid, mlmwalletusedamount: 0, walletid: 0,
      beni_username: '', mlmtranid: '', onlinepayment: grosspayble,
    });
    const Result = req(row && row.strresult);
    if (Result.toUpperCase() !== 'SUCCESS') { /* result = "rechargefailed"; URLCON = FailURL?refrenceid=Response (unused) */ }
  } else {
    const row = await procOne('shopping', 'usp_userresellerwallet', {
      ordernumber: String(refrenceid), usedamount: 0, tranid, mlmwalletusedamount: 0, voucherqty: 0, walletid: 0,
      beni_username: '', mlmtranid: '', onlinepayment: grosspayble,
    });
    const Result = req(row && row.strresult);
    if (Result.toUpperCase() !== 'SUCCESS') { /* result = Result; URLCON = FailURL?refrenceid=Response (unused) */ }
  }
}

/* -------------------------------------------------------------------- SaveData */
async function SaveData(Name, Address, ContactNo, CityName, EmailId, State, Amount, Country, Remark, Pincode, OrderId, PaymentStatus, ReferenceId) {
  try {
    const row = await procOne('shopping', 'usp_paymentmanagement_payment_gateway', {
      name: Name, address: Address, contactno: ContactNo, cityname: CityName, emailid: EmailId, state: State,
      amount: Amount, country: Country, remark: Remark, pincode: Pincode, orderid: OrderId,
      paymentstatus: PaymentStatus, refernecid: ReferenceId,
    });
    const g = (k) => (row && row[k] !== null && row[k] !== undefined ? String(row[k]) : '');
    return `${g('strresult')}^${g('successurl')}^${g('failureurl')}^${g('inprocessurl')}^${g('canceledurl')}`;
  } catch (e) {
    return 'error^/page-not-found^/page-not-found^/page-not-found^/page-not-found';
  }
}

/* --------------------------------------------------------------- getFranchise */
async function getFranchise(did) {
  // PORT-NOTE: legacy used DataBaseContext, but Distributor_MASTER/TBL_DISTRIBUTOR exist in Db_Shopping in the schema dump.
  const r = await queryOne('shopping',
    'select dm.companyname as companyname, dm.mobileno as phone from tbl_distributor td join distributor_master dm on td.regno=dm.plid where dm.pmid=@did limit 1',
    { did: String(did) });
  return mapRow(r, ['phone', 'COMPANYNAME']);
}

/* ------------------------------------------------------ SendConfirmationToConcern */
const OverallOrderProps = ['BrCode', 'USERNAME', 'PHONE', 'FNAME', 'EMAILID', 'City', 'InvQty', 'IsCancelByMember', 'IsReturn', 'LoginId', 'MobileNo', 'Name', 'order_DAP', 'order_netAmt', 'order_QTY', 'OrderDate', 'orderID', 'OrderIntStatus', 'PayMode', 'poid', 'ProcessBy', 'ProcessDate', 'ProcessRemark', 'Prod_Images', 'ProdColor', 'ProdQty', 'ProdSize', 'Product_Name', 'Product_qty', 'ProductIntStatus', 'ProductTotalVat', 'VATPERCENTAGE', 'ProUnit', 'Reason', 'rownumber', 'single_DAP', 'SPRID', 'status', 'total_cost', 'total_DAP', 'Total_Ship_Ch', 'total_Vat', 'total_purchase_cost', 'Address', 'PinCode', 'CountryName', 'JP', 'BV', 'Orderno', 'Approved', 'dispatchdate', 'ProcurementSLA', 'couriername', 'DocketNO', 'DateDiff', 'MERCHANTNAME', 'MERCHANTMOBILE', 'FranchiseId', 'orderjp', 'orderbv', 'COMPANYNAME', 'Invoiceno', 'Morderid', 'CREATEDDATE', 'PACKED', 'HANDOVER', 'INTRANSIT', 'DELIVERED', 'CANCEL', 'OUTFORDELIVERY', 'DISTRIBUTORNAME'];

async function SendConfirmationToConcern(orderId) {
  const MaxRows = await UtilityClass.GridPageSize();
  const page = 1;
  const orderid = orderId;
  const rawRows = await proc('shopping', 'usp_all_overall_order', {
    startrowindex: page, maxrows: MaxRows, searchfield: '', searchvalue: '', fromdate: '', todate: '',
    orderid, company: '', poid: '0', orderno: '', mode: 1, statusid: '0', loginid: '',
    sortbydispatchorder: '', statusdate: '', docketno: '', ddlcourier: '', merchantname: '', productname: '',
  });
  const objAllOrderList = mapRows(rawRows, OverallOrderProps);
  // @TotalCount OUT: returned as a column when the PG function exposes it, else the row count
  const tc = rawRows[0] && rawRows[0].totalcount;
  const TotalRecord = tc !== undefined && tc !== null ? parseInt(tc, 10) : objAllOrderList.length;

  const merchents = new Array(TotalRecord).fill(null);
  const merchentsname = new Array(TotalRecord).fill(null);
  const Franchise = new Array(TotalRecord).fill(null);
  let j = 0;
  const first = objAllOrderList[0];
  if (!first) throw new TypeError('Object reference not set to an instance of an object.');
  const customerNumber = first.MobileNo;
  const customerplace = first.City;
  const customername = first.FNAME;

  const smscontent = await UtilityClass.FindingSmsContentWithUserIdPassword(customername, '', orderid, customerNumber, 58, orderid);
  fire(() => UtilityClass.SendSMSWithAPIG(customerNumber, smscontent, 1073, '1'));

  for (const item of objAllOrderList) {
    let merchantMobile = req(item.MERCHANTMOBILE);
    const m = merchantMobile.split(',');
    merchantMobile = repAll(repAll(m[0], '+91-', ''), '91-', '');
    if (!merchents.includes(merchantMobile)) {
      if (j >= TotalRecord) throw new RangeError('Index was outside the bounds of the array.');
      Franchise[j] = item.FranchiseId === null || item.FranchiseId === undefined ? '' : String(item.FranchiseId);
      merchents[j] = merchantMobile;
      merchentsname[j] = item.MERCHANTNAME;
      j++;
    }
  }

  /*************** sending all merchant SMS **********************/
  for (let i = 0; i < merchents.length; i++) {
    // PORT-NOTE: slots left null by duplicate merchant mobiles (legacy would try to SMS a null number) are skipped.
    if (merchents[i] === null) continue;
    const mobile = merchents[i];
    const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(merchentsname[i], '', customerplace, customerNumber, 56, orderid);
    fire(() => UtilityClass.SendSMSWithAPIG(mobile, messg, 1071, '1'));

    if (Franchise[i] !== null && Franchise[i] !== '') {
      const frndata = await getFranchise(Franchise[i]);
      if (!frndata) throw new TypeError('Object reference not set to an instance of an object.');
      let franchisename = frndata.COMPANYNAME;
      if (franchisename === null || franchisename === undefined || franchisename === '') franchisename = 'Franchise';
      const messg1 = await UtilityClass.FindingSmsContentWithUserIdPassword(franchisename, '', merchentsname[i], customerNumber, 57, orderid);
      const phone = frndata.phone;
      fire(() => UtilityClass.SendSMSWithAPIG(phone, messg1, 1072, '1'));
    }
  }
}

/* ---------------------------------------------------------- SendMailconfirmation */
const CompleteorderProps = ['orid', 'poid', 'MerchantName', 'orderID', 'PayMode', 'PayRemark', 'orderType', 'orderDate', 'Name', 'billadd', 'City', 'PinCode', 'EmailID', 'MobileNo', 'Product_Name', 'quntity', 'singleProdPrice', 'total_DAP', 'Prod_Images', 'Total_Ship_Ch', 'total_cost', 'Total_payble_vat', 'total_purchase_cost', 'OrderQty', 'OrderTotalAmount', 'OrderTotalVat', 'OrderShippingCharges', 'totalPaybleAmt', 'DID', 'BV', 'PV'];
const f2 = (n) => Number(n).toFixed(2);
const f0 = (n) => String(roundEven(Number(n)));

async function SendMailconfirmation(OrderID) {
  let CompanyDomain = '', CompanySupportEmailId = '', CompanyName = '';
  let TrProduct = '', mobileno = '', Address = '', city = '', pincode = '';
  let MemberName = '', email = ''; let TotalAmount = 0; let DID = 0; let TotalBV = 0; let TotalPV = 0;
  const getorderid = String(OrderID).replace(/^,+|,+$/g, '');
  const companyresellerurl = appCfg().CompanyResellerURLN || appCfg().CompanyResellerURL || process.env.COMPANY_RESELLER_URLN || '';
  const companyresellerlogo = appCfg().CompanyLogowithurl;
  const Currencyy = '';
  // legacy also selected the (unused) social-share link columns
  const cs = await query('shopping',
    "select coalesce(companyredirect,'') as companydomain, companyinfoemailid, companysupportemailid, coalesce(companyname,'') as companyname from tbl_companysettings where pmid=1");
  for (const Item of cs) {
    CompanyDomain = Item.companydomain;
    CompanySupportEmailId = Item.companysupportemailid;
    CompanyName = Item.companyname;
  }
  try {
    const rows = mapRows(await proc('shopping', 'ordercomplete', { orderid: getorderid }), CompleteorderProps);
    let OrderId = '';
    for (const items of rows) {
      mobileno = items.MobileNo; Address = items.billadd; city = items.City; pincode = items.PinCode;
      email = items.EmailID; MemberName = items.Name;
      TotalAmount += Number(items.total_purchase_cost);
      TotalBV += Number(items.BV);
      TotalPV += Number(items.PV);
      DID = items.DID;
      if (items.orderID !== OrderId) {
        OrderId = items.orderID;
        TrProduct += `
                                    <tr>
                                    	<td colspan='7' height='35px'>
                                        <a href='#' style='background-color: rgba(0, 0, 0, 0.7); border-color: 
                                        rgb(218, 218, 218) rgb(218, 218, 218) rgb(204, 204, 204); box-shadow: 0 1px 1px rgba(90, 90, 90, 0.1); 
                                        padding:5px 10px; color:#ffffff; border:1px solid #d4d4d4; text-decoration:none;'>
                                        <span>$$OrderId$$</span> 
                                        <span>Seller: $$MerchantName$$ </span> 
                                        </a>
                                        </td>
                                    </tr>`;
      }
      TrProduct += `<tr>
                             <td width='10%' style='border:1px solid #dddddd; padding:0px 5px;'>
                                 <img style='height: 30px; width: 30px; border:0px;' src='$$CompanyURL$$'></td>
                             <td width='25%' style='border:1px solid #dddddd; padding:0px 5px;'>
                            <p style='overflow:auto; font-size:14px;'> $$product$$ </p></td>
                             <td width='15%' style='border:1px solid #dddddd; padding:0px 5px;'> $$price$$</td>
                             <td width='10%' style='border:1px solid #dddddd; padding:0px 5px;'> $$quantity$$</td>
                             <td width='15%' style='border:1px solid #dddddd; padding:0px 5px;'> $$shippingcharges$$</td>
                             <td width='15%' style='border:1px solid #dddddd; padding:0px 5px;'> $$vatcharges$$</td>
                             <td width='10%' style='border:1px solid #dddddd; padding:0px 5px;'> $$subtotal$$</td>
                             <td width='10%' style='border:1px solid #dddddd; padding:0px 5px;'> $$subbv$$</td>
                             <td width='10%' style='border:1px solid #dddddd; padding:0px 5px;'> $$subpv$$</td>
                              </tr>`;

      TrProduct = repAll(TrProduct, '$$MerchantName$$', items.MerchantName);
      TrProduct = repAll(TrProduct, '$$OrderId$$', items.orderID);
      TrProduct = repAll(TrProduct, '$$product$$', items.Product_Name);
      TrProduct = repAll(TrProduct, '$$CompanyURL$$', appCfg().CompanyURL);
      TrProduct = repAll(TrProduct, '$$quantity$$', items.quntity);
      TrProduct = repAll(TrProduct, '$$price$$', Currencyy + ' ' + f2(items.total_DAP));
      TrProduct = repAll(TrProduct, '$$shippingcharges$$', Currencyy + ' ' + f2(items.Total_Ship_Ch));
      TrProduct = repAll(TrProduct, '$$vatcharges$$', Currencyy + ' ' + f2(items.Total_payble_vat));
      TrProduct = repAll(TrProduct, '$$subtotal$$', Currencyy + ' ' + f2(items.total_purchase_cost));
      TrProduct = repAll(TrProduct, '$$subbv$$', ' ' + f0(items.BV));
      TrProduct = repAll(TrProduct, '$$subpv$$', ' ' + f0(items.PV));

      const imag = req(items.Prod_Images);
      const splitimage = imag.split('^')[0];
      if (splitimage !== '') {
        TrProduct = repAll(TrProduct, 'http://kreazlife.com/images/logo.png', 'http://kreazlife.com/Product_Images/' + splitimage);
      }
    }

    const subject = 'Your Order Successfuly Placed in  ' + appCfg().CompanyName;
    let myString = fs.readFileSync(path.join(__dirname, 'OrderDetail.html'), 'utf8');
    // DateTime.Now.ToShortDateString() (PORT-NOTE: en-IN short date dd/MM/yyyy)
    const now = new Date();
    myString = repAll(myString, '$$date$$', `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`);
    myString = repAll(myString, '$$Name$$', MemberName);
    myString = repAll(myString, '$$Mobile$$', mobileno);
    myString = repAll(myString, '$$Address$$', Address);
    myString = repAll(myString, '$$City$$', city);
    myString = repAll(myString, '$$PinCode$$', pincode);
    myString = repAll(myString, '$$CompanyName$$', CompanyName);
    myString = repAll(myString, '$$CompanyURL$$', CompanyDomain);
    myString = repAll(myString, '$$CompanyDomain$$', CompanyDomain);
    myString = repAll(myString, '$$CompanySupportEmailID$$', CompanySupportEmailId);
    myString = repAll(myString, '$$customTr$$', TrProduct);
    myString = repAll(myString, '$$TotalProudctAmount$$', Currencyy + f2(TotalAmount));
    myString = repAll(myString, '$$TotalProudctBV$$', f2(TotalBV));
    myString = repAll(myString, '$$TotalProudctPV$$', f2(TotalPV));
    myString = repAll(myString, '$$CompanyresellerDomain$$', companyresellerurl);
    myString = repAll(myString, '$$logo$$', companyresellerlogo);
    await UtilityClass.CheckAndSendMsgOnEmail((MemberName === null || MemberName === undefined || MemberName === '' ? MemberName : email), email, '', '', subject, myString, '', '', '', DID);
  } catch (objExp) {
    // legacy: swallowed
  }
}

/* ---------------------------------------------------------------- PaymentSuccess */
const vlog = (apiurl, resp, tranId) => exec('shopping',
  `insert into tbl_voucherapicalllog(apiurl,rpiresponse,datetime${tranId !== undefined ? ',transactionid' : ''}) values(@a,@r,${FUN_GETCURRENTDATE}${tranId !== undefined ? ',@t' : ''})`,
  tranId !== undefined ? { a: apiurl, r: resp, t: tranId } : { a: apiurl, r: resp });

async function PaymentSuccess(refrenceid = '', Token = '') {
  if (refrenceid === null || refrenceid === undefined) refrenceid = '';
  if (Token === null || Token === undefined) Token = '';
  // "Strong validation" in legacy only assigned unused local variables (nothing is enforced); queries are kept.
  const plainRef = Decryptword(refrenceid);
  const Key = await tokenKey(plainRef);
  try { decryptByPassphrase(Key, Token); } catch (e) { /* legacy: ignored */ }

  const OrderAmount = await getOrderAmount(plainRef);
  const ActualOrderId = await getActualOrderId(plainRef);
  const TotalOffLineAmount = await getOfflinePaid(ActualOrderId, 500, true);
  const onl = await scalar('shopping', 'select coalesce(amount,0) from tbl_onlinepaymenthistory where paymentstatus=1 and refernecid=@t limit 1', { t: plainRef });
  const OnlinePayments = onl === null ? 0 : Number(onl);
  const RemainAmount = (OrderAmount - (TotalOffLineAmount + OnlinePayments)) < 0 ? 0 : (OrderAmount - (TotalOffLineAmount + OnlinePayments));
  void RemainAmount;

  try {
    if (refrenceid !== '') {
      refrenceid = plainRef;
      await vlog('Method Invoked Success', '', refrenceid);

      const o = await procOne('shopping', 'usp_update_orderonlinerequests', { mode: 1, transactionid: refrenceid });
      const strOutput = req(o && o.stroutput);
      const outputOrderId = req(o && o.outputorderid);
      const outputCLID = toInt(o.outputclid);
      const OUTSOURCE = req(o.outsource);

      await vlog('After Execution USP_UPDATE_ORDERONLINEREQUESTS',
        'strOutput=' + strOutput + ' & outputOrderId=' + outputOrderId + ' & outputCLID=' + outputCLID + ' & OUTSOURCE=' + OUTSOURCE);

      // ===========START SEND CONFIRMATION MESSAGE AND MAIL TO USER========
      if (outputOrderId !== '' && outputCLID !== 0 && OUTSOURCE.toLowerCase() === 'checkout' && strOutput.toLowerCase() === 'success') {
        // CLEAR CART AFTER ORDER CONFIRMATION
        await exec('shopping', 'update tbl_addtocart set status=0 where clid=@c and status=1', { c: String(outputCLID) });
        const csName = await scalar('shopping', 'select companyname from tbl_companysettings where pmid=1 limit 1');
        const CompanyName = csName === null || csName === undefined ? '' : String(csName);
        const row = await queryOne('shopping', 'select * from tbl_customerlogin where clid=@c limit 1', { c: outputCLID });
        if (row) {
          if (row.phone !== '') {
            let CustomerName = '';
            CustomerName = row.fname === '' ? (row.fname + row.lname) : '';
            if (CustomerName.trim() === '') CustomerName = 'Customer';
            const phone = row.phone;
            fire(() => UtilityClass.SendMsgOnMobile(phone, 'Dear ' + CustomerName + ',\r\nYour order ' + outputOrderId + ' has been successfully placed and we have send an email with complete information.\r\nThank you for shopping with us.\r\nThe ' + CompanyName + ' Team'));
          }
          fire(async () => {
            if (row.emailid !== '') await SendMailconfirmation(outputOrderId);
          });
        }
      }
      if (outputOrderId !== '' && outputCLID !== 0 && OUTSOURCE.toLowerCase() === 'evoucher' && strOutput.toLowerCase() === 'success') {
        await vlog('Evoucher Section Entered', '');

        const oblCL = await queryOne('shopping', 'select * from tbl_customerlogin where clid=@c limit 1', { c: outputCLID });

        // legacy: objDenoMinationMaster is a fresh object here, so DMID is logged as 0
        await vlog('Get Data From TBL_VOUCHER_ORDER_MASTER', 'DMID=0');
        const objDenoMinationMaster = mapRow(await queryOne('shopping',
          'select dmid, orderqty, vmid from tbl_voucher_order_master where orderid=@o and intstatus=0 limit 1', { o: outputOrderId }),
        ['DMID', 'OrderQty', 'VMID']);
        if (!objDenoMinationMaster) throw new TypeError('Object reference not set to an instance of an object.');

        const objAllvocherDenomination = mapRow(await queryOne('shopping',
          'select dmid,denomination,date,active,status,denominationdetails,pguid,productcode,vmid,brand,bv,redeemcash,receivablecashback from tbl_denomination_master where dmid=@d limit 1',
          { d: objDenoMinationMaster.DMID }),
        ['Denomination', 'DenominationDetails', 'PRODUCTCODE', 'PGUID', 'DMID', 'VMID', 'Brand', 'BV', 'RedeemCash', 'ReceivableCashBack']);

        if (!oblCL || !objAllvocherDenomination) throw new TypeError('Object reference not set to an instance of an object.');
        const nz = (v) => (v === null || v === undefined ? '' : v);
        await vlog('Before BaseURl',
          'ProductGuid=' + nz(objAllvocherDenomination && objAllvocherDenomination.PGUID) + ' & Quantity=' + objDenoMinationMaster.OrderQty +
          ' & Name=' + nz(oblCL.fname) + nz(oblCL.lname) + nz(oblCL.lname) + ' & Mobile=' + nz(oblCL.phone) + ' & EmailId=' + nz(oblCL.emailid));

        // BuyerGUID / BuyerPassword are AppSettings keys (never copied from Web.config)
        const BaseURl = 'https://catalog.vouchagram.com/EPService.svc/SendVoucher?BuyerGuid=' + req(appCfg().BuyerGUID !== undefined ? appCfg().BuyerGUID : (process.env.BUYER_GUID || ''))
          + '&ProductGuid=' + req(objAllvocherDenomination.PGUID) + '&ExternalOrderID=' + outputOrderId + '&Quantity=' + objDenoMinationMaster.OrderQty
          + '&CustomerFName=' + nz(oblCL.fname) + '&CustomerMName=' + nz(oblCL.lname) + '&CustomerLName=' + nz(oblCL.lname)
          + '&CommunicationMode=S&EmailTo=' + nz(oblCL.emailid) + '&EmailCC=' + nz(oblCL.emailid) + '&EmailSubject=Kreazlife E-Voucher Details&MobileNo=' + nz(oblCL.phone)
          + '&Password=' + req(appCfg().BuyerPassword !== undefined ? appCfg().BuyerPassword : (process.env.BUYER_PASSWORD || '')) + '&TemplateID=757';

        await vlog(BaseURl, '');

        // Added For Mannual Confirmation
        await exec('shopping', 'update tbl_voucher_order_master set voucherurl=@u where orderid=@o and intstatus=0', { u: BaseURl, o: outputOrderId });

        // PORT-NOTE: legacy HTTP GET to vouchagram is commented out (StrPostData stays ""), so the
        // confirmation branch (`StrPostData != "" && != "[]"`) is unreachable and only the log row is written.
        const StrPostData = '';
        await vlog(BaseURl, StrPostData);
      }
      // ===========END SEND CONFIRMATION MESSAGE AND MAIL TO USER========

      if (strOutput.toUpperCase() === 'SUCCESS' && refrenceid !== '') {
        await SendConfirmationToConcern(outputOrderId);
      }
    }
  } catch (objexp) {
    try {
      await vlog('Last Exception', String(objexp && objexp.message));
    } catch (obj) { /* legacy: ignored */ }
  }
}

/* ----------------------------------------------------------------- PaymentFailed */
async function PaymentFailed(refrenceid = '') {
  try {
    refrenceid = Decryptword(refrenceid);
    // PORT-NOTE: legacy ran this on DataBaseContext; USP_REFUNDWALLET lives in Db_Shopping in the schema dump.
    await procOne('shopping', 'usp_refundwallet', { transactionid: refrenceid });
    // legacy only set an unused PaymentStatus text from @StrOutPut
  } catch (objexp) { /* legacy: swallowed */ }
}

module.exports = {
  companyRedirect, toDecimal, toInt, roundEven, req, tranIdNow, dateTimeNowString, repAll, fire, FUN_GETCURRENTDATE,
  walletApiPost, resellerApi, jstr, detailsArr,
  getOrderAmount, getActualOrderId, getOfflinePaid, makeToken, tokenKey, encryptByPassphrase, decryptByPassphrase,
  Generatehash512, RazorCreateOrder, Resellerwalletdeduction, SaveData, getFranchise,
  SendConfirmationToConcern, SendMailconfirmation, PaymentSuccess, PaymentFailed,
};
