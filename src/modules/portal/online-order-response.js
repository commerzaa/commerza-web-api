// Ported from C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal\Controllers\OnlineOrderResponseController.cs
'use strict';
const DB = 'shopping';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const UtilityClass = require('../../lib/portal/UtilityClass');
const { CompanySettings } = require('../../lib/portal/CompanySettings');
const { outVal, jtok } = require('./_shared/batch-11-common');

const router = express.Router();
const P = '/portal/OnlineOrderResponse';

const NRE = 'Object reference not set to an instance of an object.';
const nullRef = () => { throw new Error(NRE); };
const str = (v) => (v === undefined || v === null ? '' : String(v)); // Convert.ToString
const send = (res, ViewBag) => res.json({ ViewBag, ...ViewBag });
const num = (v) => (v === null || v === undefined || v === '' ? 0 : Number(v));
const fixed = (v, d) => num(v).toFixed(d); // decimal.ToString("0.00") / ("0")
const background = (fn) => { Promise.resolve().then(fn).catch((e) => console.error('[OnlineOrderResponse thread]', e && e.message)); };
/** Convert.ToDecimal(string) */
const toDecimal = (v) => {
  if (v === null || v === undefined) return 0;
  const s = String(v).trim();
  const n = Number(s);
  if (s === '' || !Number.isFinite(n)) throw new Error('Input string was not in a correct format.');
  return n;
};
/** Convert.ToInt64(decimal): banker's rounding */
const toInt64 = (d) => {
  const f = Math.floor(d); const r = d - f;
  if (r > 0.5) return f + 1;
  if (r < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
};
/** Insert Into TBL_VOUCHERAPICALLLOG(...) (PORT-NOTE: legacy concatenated the values into the SQL; parameterised) */
const log = (apiurl, response, transId) => (transId === undefined
  ? db.exec(DB, 'insert into tbl_voucherapicalllog(apiurl, rpiresponse, datetime) values (@apiurl, @rpiresponse, fun_getcurrentdate())', { apiurl, rpiresponse: response })
  : db.exec(DB, 'insert into tbl_voucherapicalllog(apiurl, rpiresponse, datetime, transactionid) values (@apiurl, @rpiresponse, fun_getcurrentdate(), @tid)', { apiurl, rpiresponse: response, tid: transId }));

/** T-SQL CAST(<Token literal> AS VARBINARY(2000)): only a hex literal 0x... yields bytes; anything else -> null (legacy SQL error -> catch). */
function tokenBytes(Token) {
  const m = /^0x([0-9a-f]*)$/i.exec(String(Token).trim());
  if (!m) return null;
  let h = m[1];
  if (h.length % 2) h = '0' + h;
  return Buffer.from(h, 'hex').subarray(0, 2000);
}

/**
 * SQL Server DECRYPTBYPASSPHRASE(varchar passphrase, varbinary) -> CONVERT(VARCHAR(MAX), ...). null when it cannot decrypt.
 * v1 blobs: 3DES (key = SHA1(passphrase)[0..16)), v2 blobs: AES-256 (key = SHA256(passphrase)); payload header 0xBAADF00D + length.
 */
function decryptByPassphrase(pass, blob) {
  try {
    if (!blob || blob.length < 8) return null;
    const version = blob.readUInt32LE(0);
    const pw = Buffer.from(str(pass), 'latin1');
    let dec;
    if (version === 1) {
      const key = crypto.createHash('sha1').update(pw).digest().subarray(0, 16);
      const d = crypto.createDecipheriv('des-ede-cbc', key, blob.subarray(4, 12));
      dec = Buffer.concat([d.update(blob.subarray(12)), d.final()]);
    } else if (version === 2) {
      const key = crypto.createHash('sha256').update(pw).digest();
      const d = crypto.createDecipheriv('aes-256-cbc', key, blob.subarray(4, 20));
      dec = Buffer.concat([d.update(blob.subarray(20)), d.final()]);
    } else return null;
    if (dec.length < 8 || dec.readUInt32LE(0) !== 0xBAADF00D) return null;
    const len = dec.readUInt16LE(6);
    return dec.subarray(8, 8 + len).toString('latin1');
  } catch (e) {
    return null;
  }
}

/** getFranchise(did) -> Franchisedata { phone, COMPANYNAME } | null */
async function getFranchise(did) {
  // PORT-NOTE: legacy concatenated did into the SQL; parameterised.
  const r = await db.queryOne(DB, `select dm.companyname, dm.mobileno as phone from tbl_distributor td join distributor_master dm on td.regno = dm.plid
    where dm.pmid::text = @did limit 1`, { did: str(did) });
  return r ? { phone: r.phone, COMPANYNAME: r.companyname } : null;
}

/** SendConfirmationToConcern(orderId): SMS to customer, merchants and franchises of the order. */
async function SendConfirmationToConcern(orderId, ViewBag) {
  const BranchId = 0;
  if (ViewBag) ViewBag.BranchId = BranchId;
  const MaxRows = UtilityClass.GridPageSize();
  let page = 0;
  const orderid = orderId;
  if (page === 0) page = 1;
  const rows = await db.proc(DB, 'usp_all_overall_order', {
    STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: '', SEARCHVALUE: '', FROMDATE: '', TODATE: '', orderid, Company: '', POID: '0', Orderno: '',
    mode: 1, statusid: '0', loginid: '', sortbydispatchorder: '', statusdate: '', docketno: '', ddlcourier: '', merchantname: '', productname: '',
  });
  const first = rows[0] || null;
  const tc = first ? first.totalcount : null;
  const TotalRecord = tc === null || tc === undefined || tc === '' ? 0 : parseInt(String(tc), 10);
  const merchents = new Array(TotalRecord).fill(null);
  const merchentsname = new Array(TotalRecord).fill(null);
  const Franchise = new Array(TotalRecord).fill(null);
  let j = 0;
  if (!first) nullRef(); // objAllOrderList.FirstOrDefault().MobileNo
  const customerNumber = first.mobileno;
  const customerplace = first.city;
  const customername = first.fname;
  const smscontent = await UtilityClass.FindingSmsContentWithUserIdPassword(customername, '', orderid, customerNumber, 58, orderid);
  await UtilityClass.SendSMSWithAPI(customerNumber, smscontent, 1073, '1');
  for (const item of rows) {
    let merchantMobile = item.merchantmobile;
    if (merchantMobile === null || merchantMobile === undefined) nullRef();
    const m = String(merchantMobile).split(',');
    merchantMobile = m[0].split('+91-').join('').split('91-').join('');
    if (!merchents.includes(merchantMobile)) {
      if (j >= merchents.length) throw new Error('Index was outside the bounds of the array.');
      Franchise[j] = item.franchiseid === null || item.franchiseid === undefined ? '' : String(item.franchiseid);
      merchents[j] = merchantMobile;
      merchentsname[j] = item.merchantname;
      j++;
    }
  }
  // sending all merchant SMS
  for (let i = 0; i < merchents.length; i++) {
    const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(merchentsname[i], '', customerplace, customerNumber, 56, orderid);
    // PORT-NOTE: the C# thread closure captured the shared loop variable i (race / IndexOutOfRange); this iteration's value is used.
    const to = merchents[i];
    background(() => UtilityClass.SendSMSWithAPI(to, messg, 1071, '1'));
    if (Franchise[i] !== null && Franchise[i] !== '') {
      const frndata = await getFranchise(Franchise[i]);
      if (!frndata) nullRef();
      let franchisename = frndata.COMPANYNAME;
      if (frndata.COMPANYNAME === null || frndata.COMPANYNAME === undefined || frndata.COMPANYNAME === '') franchisename = 'Franchise';
      const messg1 = await UtilityClass.FindingSmsContentWithUserIdPassword(franchisename, '', merchentsname[i], customerNumber, 57, orderid);
      background(() => UtilityClass.SendSMSWithAPI(String(frndata.phone).split('+91-').join('').split('91-').join(''), messg1, 1072, '1'));
    }
  }
}

/** class CompleteorderConfir */
const CONFIR_ROW = (r) => ({
  orid: r.orid, poid: r.poid, MerchantName: r.merchantname, orderID: r.orderid, PayMode: r.paymode, PayRemark: r.payremark, orderType: r.ordertype,
  orderDate: r.orderdate, Name: r.name, billadd: r.billadd, City: r.city, PinCode: r.pincode, EmailID: r.emailid, MobileNo: r.mobileno,
  Product_Name: r.product_name, quntity: r.quntity, singleProdPrice: r.singleprodprice, total_DAP: r.total_dap, Prod_Images: r.prod_images,
  Total_Ship_Ch: r.total_ship_ch, total_cost: r.total_cost, Total_payble_vat: r.total_payble_vat, total_purchase_cost: r.total_purchase_cost,
  OrderQty: r.orderqty, OrderTotalAmount: r.ordertotalamount, OrderTotalVat: r.ordertotalvat, OrderShippingCharges: r.ordershippingcharges,
  totalPaybleAmt: r.totalpaybleamt, DID: r.did, BV: r.bv, PV: r.pv,
});
const rep = (s, a, b) => String(s).split(a).join(b === null || b === undefined ? '' : String(b));
const shortDate = () => { const d = new Date(); return `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`; }; // ToShortDateString() (en-US assumed)

/** protected SendMailconfirmation(OrderID): order confirmation e-mail (exceptions after the company read are swallowed). */
async function SendMailconfirmation(OrderID, Currency) {
  let CompanyDomain = ''; let CompanySupportEmailId = ''; let CompanyName = '';
  let TrProduct = ''; let mobileno = ''; let Address = ''; let city = ''; let pincode = '';
  let MemberName = ''; let email = ''; let TotalAmount = 0; let DID = 0; let TotalBV = 0; let TotalPV = 0;
  const getorderid = String(OrderID).replace(/^,+|,+$/g, '');
  const companyresellerurl = config.app.CompanyResellerURLN;
  const companyresellerlogo = config.app.CompanyLogowithurl;
  const comp = await db.query(DB, `select coalesce(companyredirect, '') as companydomain, companyinfoemailid, companysupportemailid,
      coalesce(companyname, '') as companyname, '' as companydomainlogo, coalesce(companyfacebooklink, '') as facebookshare,
      coalesce(companygooglepluslink, '') as googleplusshare, coalesce(companyfacebooklink, '') as twittershare,
      coalesce(companylinkedinlink, '') as linkedinshare, coalesce(companypinterestlink, '') as pinterestshare
    from tbl_companysettings where pmid = 1`);
  for (const Item of comp) {
    CompanyDomain = Item.companydomain;
    CompanySupportEmailId = Item.companysupportemailid;
    CompanyName = Item.companyname;
  }
  try {
    const list = (await db.proc(DB, 'ordercomplete', { ORDERID: getorderid })).map(CONFIR_ROW);
    let OrderId = '';
    for (const items of list) {
      mobileno = items.MobileNo; Address = items.billadd; city = items.City; pincode = items.PinCode; email = items.EmailID; MemberName = items.Name;
      TotalAmount += num(items.total_purchase_cost); TotalBV += num(items.BV); TotalPV += num(items.PV); DID = items.DID;
      if (items.orderID !== OrderId) {
        OrderId = items.orderID;
        TrProduct = TrProduct + `
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
      TrProduct = TrProduct + `<tr>
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
      TrProduct = rep(TrProduct, '$$MerchantName$$', items.MerchantName);
      TrProduct = rep(TrProduct, '$$OrderId$$', items.orderID);
      TrProduct = rep(TrProduct, '$$product$$', items.Product_Name);
      TrProduct = rep(TrProduct, '$$CompanyURL$$', CompanySettings.CompanyURL);
      TrProduct = rep(TrProduct, '$$quantity$$', items.quntity);
      TrProduct = rep(TrProduct, '$$price$$', Currency + ' ' + fixed(items.total_DAP, 2));
      TrProduct = rep(TrProduct, '$$shippingcharges$$', Currency + ' ' + fixed(items.Total_Ship_Ch, 2));
      TrProduct = rep(TrProduct, '$$vatcharges$$', Currency + ' ' + fixed(items.Total_payble_vat, 2));
      TrProduct = rep(TrProduct, '$$subtotal$$', Currency + ' ' + fixed(items.total_purchase_cost, 2));
      TrProduct = rep(TrProduct, '$$subbv$$', ' ' + fixed(items.BV, 0));
      TrProduct = rep(TrProduct, '$$subpv$$', ' ' + fixed(items.PV, 0));
      if (items.Prod_Images === null || items.Prod_Images === undefined) nullRef();
      const splitimage = String(items.Prod_Images).split('^')[0];
      if (splitimage !== '') TrProduct = rep(TrProduct, 'http://kreazlife.com/images/logo.png', 'http://kreazlife.com/Product_Images/' + splitimage);
    }
    const subject = 'Your Order Successfuly Placed in  ' + CompanySettings.CompanyName;
    // Server.MapPath("~/OrderDetail.html") -> config.uploadDir/OrderDetail.html
    const readFile = fs.readFileSync(path.join(config.uploadDir || '', 'OrderDetail.html'), 'utf8');
    let myString = readFile;
    myString = rep(myString, '$$date$$', shortDate());
    myString = rep(myString, '$$Name$$', MemberName);
    myString = rep(myString, '$$Mobile$$', mobileno);
    myString = rep(myString, '$$Address$$', Address);
    myString = rep(myString, '$$City$$', city);
    myString = rep(myString, '$$PinCode$$', pincode);
    myString = rep(myString, '$$CompanyName$$', CompanyName);
    myString = rep(myString, '$$CompanyURL$$', CompanyDomain);
    myString = rep(myString, '$$CompanyDomain$$', CompanyDomain);
    myString = rep(myString, '$$CompanySupportEmailID$$', CompanySupportEmailId);
    myString = rep(myString, '$$customTr$$', TrProduct);
    myString = rep(myString, '$$TotalProudctAmount$$', Currency + TotalAmount.toFixed(2));
    myString = rep(myString, '$$TotalProudctBV$$', TotalBV.toFixed(2));
    myString = rep(myString, '$$TotalProudctPV$$', TotalPV.toFixed(2));
    myString = rep(myString, '$$CompanyresellerDomain$$', companyresellerurl);
    myString = rep(myString, '$$logo$$', companyresellerlogo);
    await UtilityClass.CheckAndSendMsgOnEmail((MemberName === null || MemberName === '' ? MemberName : email), email, '', '', subject, myString, '', '', '', DID);
  } catch (objExp) { /* swallowed */ }
}

const masterpage = (req, ViewBag) => {
  if (ps.sessionGet(req, 'LoginwithMobile') !== null) ViewBag.masterpageshow = 'MobileLogin';
  else ViewBag.masterpageshow = '';
};

// public (gateway return URL; identity from the session cookie, legacy had no session check)
// route-config: secure-order-payment/payment-success, reseller/{ID}/secure-order-payment/payment-success
router.all([P + '/PaymentSuccess{/:id}', '/portal/secure-order-payment/payment-success', '/portal/reseller/:ID/secure-order-payment/payment-success'],
  ps.callbackSession, asyncHandler(async (req, res) => {
    const ViewBag = {};
    const Currency = str(ps.sessionGet(req, 'CURRENCYCODE'));
    let refrenceid = req.p.refrenceid;
    let Token = req.p.Token;
    // Strong Validation Here (outside the try: exceptions were unhandled in the legacy)
    if (refrenceid == null) refrenceid = '';
    if (Token == null) Token = '';
    refrenceid = String(refrenceid); Token = String(Token);
    if (refrenceid === '' || Token === '') {
      ViewBag.PaymentStatus = 'Invalid Attempts !';
      ViewBag.TransactionId = UtilityClass.Decryptword(refrenceid);
      return send(res, ViewBag);
    }
    const decRef = UtilityClass.Decryptword(refrenceid);
    // PORT-NOTE: legacy concatenated refrenceid and Token into the SQL (SQL injection); parameterised here.
    const Key = await db.scalar(DB, `select tbl_customerlogin.username || '' || tbl_orderonlinerequests.transactionid from tbl_orderonlinerequests
      inner join tbl_customerlogin on tbl_customerlogin.clid = tbl_orderonlinerequests.clid where transactionid = @tid limit 1`, { tid: decRef });
    // PORT-NOTE: SQL Server DECRYPTBYPASSPHRASE has no PostgreSQL equivalent; re-implemented in Node (decryptByPassphrase).
    //   A Token that is not a 0x hex literal made the legacy SQL fail -> its catch ("Invalid Attempts !").
    const blob = tokenBytes(Token);
    if (blob === null) {
      ViewBag.PaymentStatus = 'Invalid Attempts !';
      ViewBag.TransactionId = UtilityClass.Decryptword(refrenceid);
      return send(res, ViewBag);
    }
    const DecryptedToken = decryptByPassphrase(Key === null ? '' : Key, blob);
    if (str(DecryptedToken) !== refrenceid) {
      ViewBag.PaymentStatus = 'Invalid Attempts !';
      ViewBag.TransactionId = UtilityClass.Decryptword(refrenceid);
      return send(res, ViewBag);
    }
    // Paymentvalidation
    const oa = await db.queryOne(DB, 'select coalesce(amount, 0) as v from tbl_orderonlinerequests where transactionid = @tid limit 1', { tid: decRef });
    const OrderAmount = oa ? num(oa.v) : 0;
    const oid = await db.queryOne(DB, 'select orderid as v from tbl_orderonlinerequests where transactionid = @tid limit 1', { tid: decRef });
    const ActualOrderId = oid ? oid.v : null;
    const off = await db.queryOne(DB, `select coalesce((cashbackwalletused + cashwalletused + ewalletused + codpayment + (voucherwalletused * 500)), 0) as v
      from tbl_orderpayment_history where orderid = @oid limit 1`, { oid: ActualOrderId });
    const TotalOffLineAmount = off ? num(off.v) : 0;
    const onl = await db.queryOne(DB, "select coalesce(amount::text, '0') as v from tbl_onlinepaymenthistory where paymentstatus = 1 and refernecid = @tid limit 1", { tid: decRef });
    const TotalOnLineAmount = onl ? onl.v : null;
    const OnlinePayments = toDecimal(TotalOnLineAmount);
    const diff = OrderAmount - (TotalOffLineAmount + OnlinePayments);
    const RemainAmount = diff < 0 ? 0 : diff;
    if (toInt64(RemainAmount) > 0) {
      ViewBag.PaymentStatus = 'Invalid Attempts !';
      ViewBag.TransactionId = UtilityClass.Decryptword(refrenceid);
      return send(res, ViewBag);
    }
    masterpage(req, ViewBag);
    try {
      let strOutput = ''; let outputOrderId = ''; let OUTSOURCE = ''; let outputCLID = 0;
      if (refrenceid !== '') {
        refrenceid = UtilityClass.Decryptword(refrenceid);
        await log('Method Invoked Success', '', refrenceid);
        const r = await db.procOne(DB, 'usp_update_orderonlinerequests', { MODE: 1, TRANSACTIONID: refrenceid });
        strOutput = outVal(r, 'STROUTPUT');
        outputOrderId = outVal(r, 'OUTPUTORDERID');
        const clidStr = outVal(r, 'OUTPUTCLID');
        if (!/^\s*[+-]?\d+\s*$/.test(clidStr)) throw new Error('Input string was not in a correct format.');
        outputCLID = parseInt(clidStr, 10);
        OUTSOURCE = outVal(r, 'OUTSOURCE');
        ViewBag.OUTSOURCE = OUTSOURCE;
        await log('After Execution USP_UPDATE_ORDERONLINEREQUESTS', 'strOutput=' + strOutput + ' & outputOrderId=' + outputOrderId + ' & outputCLID=' + outputCLID + ' & OUTSOURCE=' + OUTSOURCE);
        if (outputOrderId !== '' && outputCLID !== 0 && OUTSOURCE.toLowerCase() === 'checkout' && str(strOutput).toLowerCase() === 'success') {
          ps.sessionSet(req, 'Cart', null);
          await db.exec(DB, 'update tbl_addtocart set status = 0 where clid = @clid and status = 1', { clid: outputCLID });
          const CompanyName = await db.scalar(DB, 'select companyname from tbl_companysettings where pmid = 1 limit 1');
          const row = await db.queryOne(DB, 'select clid, phone, fname, lname, emailid from tbl_customerlogin where clid = @clid limit 1', { clid: outputCLID });
          if (row != null) {
            const PHONE = row.phone; const FNAME = row.fname; const LNAME = row.lname; const EMAILID = row.emailid;
            if (PHONE !== '') {
              let CustomerName = '';
              // legacy bug kept: the name is only used when FNAME is empty
              CustomerName = FNAME === '' ? str(FNAME) + str(LNAME) : '';
              if (CustomerName.trim() === '') CustomerName = 'Customer';
              background(() => UtilityClass.SendMsgOnMobile(PHONE, 'Dear ' + CustomerName + ',\r\nYour order ' + outputOrderId + ' has been successfully placed and we have send an email with complete information.\r\nThank you for shopping with us.\r\nThe ' + str(CompanyName) + ' Team'));
            }
            background(async () => {
              if (EMAILID !== '') await SendMailconfirmation(outputOrderId, Currency);
            });
          }
        }
        if (outputOrderId !== '' && outputCLID !== 0 && OUTSOURCE.toLowerCase() === 'evoucher' && str(strOutput).toLowerCase() === 'success') {
          await log('Evoucher Section Entered', '');
          if (!ps.isCustomer(req)) {
            await log('EVOUCHER SECTION ENTERED', 'LOGINID=COMING NULL WHY ? & PLID=0');
          }
          const c = await db.queryOne(DB, 'select fname, lname, phone, emailid from tbl_customerlogin where clid = @clid limit 1', { clid: outputCLID });
          const oblCL = c ? { FNAME: c.fname, LNAME: c.lname, PHONE: c.phone, EMAILID: c.emailid } : null;
          await log('Get Data From TBL_VOUCHER_ORDER_MASTER', 'DMID=0'); // objDenoMinationMaster.DMID is still the default 0 here
          const dm = await db.queryOne(DB, 'select dmid, orderqty, vmid from tbl_voucher_order_master where orderid = @oid and intstatus = 0 limit 1', { oid: outputOrderId });
          if (!dm) nullRef();
          const objDenoMinationMaster = { DMID: dm.dmid, OrderQty: dm.orderqty, VMID: dm.vmid };
          const av = await db.queryOne(DB, `select dmid, denomination, date, active, status, denominationdetails, pguid, productcode, vmid, brand, bv, redeemcash,
            receivablecashback from tbl_denomination_master where dmid = @dmid limit 1`, { dmid: objDenoMinationMaster.DMID });
          if (!av) nullRef();
          if (!oblCL) nullRef();
          const PGUID = str(av.pguid);
          await log('Before BaseURl', 'ProductGuid=' + PGUID + ' & Quantity=' + objDenoMinationMaster.OrderQty + ' & Name=' + str(oblCL.FNAME) + str(oblCL.LNAME) + str(oblCL.LNAME) + ' & Mobile=' + str(oblCL.PHONE) + ' & EmailId=' + str(oblCL.EMAILID));
          // Secrets from config: BuyerGUID, BuyerPassword (ConfigurationManager[...].ToString() threw when missing)
          if (config.app.BuyerGUID === undefined || config.app.BuyerPassword === undefined) nullRef();
          const BaseURl = 'https://catalog.vouchagram.com/EPService.svc/SendVoucher?BuyerGuid=' + (config.app.BuyerGUID || '') + '&ProductGuid=' + PGUID + '&ExternalOrderID=' + outputOrderId + '&Quantity=' + objDenoMinationMaster.OrderQty + '&CustomerFName=' + str(oblCL.FNAME) + '&CustomerMName=' + str(oblCL.LNAME) + '&CustomerLName=' + str(oblCL.LNAME) + '&CommunicationMode=S&EmailTo=' + str(oblCL.EMAILID) + '&EmailCC=' + str(oblCL.EMAILID) + '&EmailSubject=Kreazlife E-Voucher Details&MobileNo=' + str(oblCL.PHONE) + '&Password=' + (config.app.BuyerPassword || '') + '&TemplateID=757';
          await log(BaseURl, '');
          // Added For Mannual Confirmation
          await db.exec(DB, 'update tbl_voucher_order_master set voucherurl = @url where orderid = @oid and intstatus = 0', { url: BaseURl, oid: outputOrderId });
          const StrPostData = ''; // the vouchagram HTTP call is commented out in the legacy
          await log(BaseURl, StrPostData);
          if (StrPostData !== '' && StrPostData !== '[]') {
            await log('Maintain TBL_VOUCHER_ORDER_CONFIRMATION_MASTER Log', StrPostData);
            const ObjObjectTemp = JSON.parse(StrPostData);
            const ObjObjectRateManagement = JSON.parse(jtok(ObjObjectTemp, 'SendVouchersResult'));
            if (jtok(ObjObjectRateManagement[0], 'ResultType') === 'SUCCESS') {
              const arr = JSON.parse(jtok(ObjObjectRateManagement[0], 'BlastedVouchers'));
              for (let J = 0; J < objDenoMinationMaster.OrderQty; J++) {
                await db.exec(DB, `insert into tbl_voucher_order_confirmation_master(vomid, orderid, activitydatetime, email_status, productname, sms_status,
                  voucherno, voucherguid, completeapiresponse, status, active) values (@vomid, @oid, fun_getcurrentdate(), @es, @pn, @ss, @vn, @vg, @resp, 1, 1)`, {
                  vomid: objDenoMinationMaster.VMID, oid: outputOrderId, es: jtok(arr[J], 'Email_Status'), pn: jtok(arr[J], 'ProductName'),
                  ss: jtok(arr[J], 'Sms_Status'), vn: jtok(arr[J], 'VoucherNo'), vg: jtok(arr[J], 'Voucherguid'), resp: StrPostData,
                });
              }
              await db.exec(DB, `update tbl_voucher_order_master set voucherurl = @url, status = 'Confirm', intstatus = 1, description = 'Order Confirmed'
                where orderid = @oid and intstatus = 0`, { url: BaseURl, oid: outputOrderId });
              await log('Maintained TBL_VOUCHER_ORDER_CONFIRMATION_MASTER Log', StrPostData);
            }
          }
        }
        if (strOutput.toUpperCase() === 'SUCCESS' && refrenceid !== '') {
          ViewBag.PaymentStatus = 'SUCCESS';
          ViewBag.TransactionId = refrenceid;
          await SendConfirmationToConcern(outputOrderId, ViewBag);
        }
      } else {
        ViewBag.PaymentStatus = 'Error';
      }
      return send(res, ViewBag);
    } catch (objexp) {
      try {
        await log('Last Exception', objexp.message);
      } catch (obj) {
        ViewBag.PaymentStatus = obj.message;
        ViewBag.TransactionId = refrenceid;
      }
      ViewBag.PaymentStatus = 'Your Payment was declined.If Deducted It Will Auto Refund !';
      ViewBag.TransactionId = null;
      return send(res, ViewBag);
    }
  }));

// public (legacy test action, no session check)
// PORT-NOTE: security - anyone can trigger the SMS fan-out for order OD527141386 (legacy behaviour kept). return null -> empty 200 body.
// route-config: secure-order-payment/payment-test
router.all([P + '/PaymentTest{/:id}', '/portal/secure-order-payment/payment-test'], ps.portalSession, asyncHandler(async (req, res) => {
  await SendConfirmationToConcern('OD527141386', {});
  res.status(200).end();
}));

function refund() {
  return asyncHandler(async (req, res) => {
    const ViewBag = {};
    masterpage(req, ViewBag);
    try {
      const refrenceid = UtilityClass.Decryptword(req.p.refrenceid === undefined ? '' : req.p.refrenceid);
      const r = await db.procOne(DB, 'usp_refundwallet', { TRANSACTIONID: refrenceid });
      if (outVal(r, 'StrOutPut') === 'success') ViewBag.PaymentStatus = 'Your Payment was declined.If Deducted It Will Auto Refund !';
      else ViewBag.PaymentStatus = 'Payment was declined !';
      ViewBag.TransactionId = null;
      return send(res, ViewBag);
    } catch (objexp) {
      ViewBag.PaymentStatus = objexp.message;
      ViewBag.TransactionId = null;
      return send(res, ViewBag);
    }
  });
}

// public (gateway return URL)
// route-config: secure-order-payment/payment-failed, reseller/{ID}/secure-order-payment/payment-failed
router.all([P + '/PaymentFailed{/:id}', '/portal/secure-order-payment/payment-failed', '/portal/reseller/:ID/secure-order-payment/payment-failed'],
  ps.callbackSession, refund());

// public (gateway return URL)
// route-config: secure-order-payment/payment-inprocess, reseller/{ID}/secure-order-payment/payment-inprocess
router.all([P + '/PaymentInProcess{/:id}', '/portal/secure-order-payment/payment-inprocess', '/portal/reseller/:ID/secure-order-payment/payment-inprocess'],
  ps.callbackSession, asyncHandler(async (req, res) => {
    const ViewBag = {};
    masterpage(req, ViewBag);
    const refrenceid = req.p.refrenceid === undefined || req.p.refrenceid === null ? '' : String(req.p.refrenceid);
    if (refrenceid !== '') ViewBag.PaymentInProcess = 'Success';
    else ViewBag.PaymentInProcess = 'Error';
    return send(res, ViewBag);
  }));

// public (gateway return URL)
// route-config: secure-order-payment/payment-cancel, reseller/{ID}/secure-order-payment/payment-cancel
router.all([P + '/PaymentCancel{/:id}', '/portal/secure-order-payment/payment-cancel', '/portal/reseller/:ID/secure-order-payment/payment-cancel'],
  ps.callbackSession, refund());

module.exports = router;
