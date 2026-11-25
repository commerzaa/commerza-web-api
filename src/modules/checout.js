'use strict';
/**
 * Port of Controllers/WebPanelCntrl/ChecoutController.cs (class ChecoutController, 7 routes).
 * Helper statics of the C# file (GetShoppingCartData, product_detail_cutom.getshipingcharge/getvatcharge,
 * PinCodeCheckAvalibility, GetStockCount, getSelectedAttr, CustomerAddressDal) are ported below and also
 * attached to the exported router (router.GetShoppingCartData, router.product_detail_cutom, ...)
 * so sibling modules may reuse them.
 */
const express = require('express');
const config = require('../config');
const { query, queryOne, scalar, exec, proc, procOne } = require('../db');
const { mapRow, mapRows, netDate } = require('../utils/shape');
const { Encryptword, Decryptword } = require('../utils/crypto');
const { auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// ---------------------------------------------------------------- helpers (C# runtime semantics)
const NRE_MSG = 'Object reference not set to an instance of an object.';
const FORMAT_MSG = 'Input string was not in a correct format.';

/** Convert.ToInt64/ToInt32/ToByte(string): null => 0, invalid => FormatException */
function convToInt(s) {
  if (s === null || s === undefined) return 0;
  const t = String(s);
  if (!/^\s*[+-]?\d+\s*$/.test(t)) throw new Error(FORMAT_MSG);
  return Number(t.trim());
}
/** Convert.ToDouble(string) */
function convToDouble(s) {
  if (s === null || s === undefined) return 0;
  const t = String(s).trim();
  if (t === '' || isNaN(Number(t))) throw new Error(FORMAT_MSG);
  return Number(t);
}
/** Object.ToString() ?? "" (ToStringOrEmpty) */
const strOrEmpty = (v) => (v === null || v === undefined ? '' : String(v));
/** Math.Round(decimal) - banker's rounding (MidpointRounding.ToEven) */
function roundHalfEven(x) {
  const f = Math.floor(x);
  const diff = x - f;
  if (Math.abs(diff - 0.5) < 1e-9) return f % 2 === 0 ? f : f + 1;
  return Math.round(x);
}
/** Web API binding of a non-nullable value-type action parameter. returns undefined if it cannot bind. */
function bindNum(v, def, integer) {
  if (v === undefined || v === null || v === '') return def;
  const n = Number(v);
  if (isNaN(n) || (integer && !Number.isInteger(n))) return undefined;
  return n;
}
const badRequest = (res, name) => res.status(400).json({
  Message: 'The request is invalid.',
  MessageDetail: `The parameters dictionary contains a null or invalid entry for parameter '${name}'.`,
});
/** SqlParameter with a null value => ADO.NET raises "parameter was not supplied" */
function assertSupplied(params) {
  for (const k of Object.keys(params)) {
    if (params[k] === null || params[k] === undefined) {
      throw new Error(`The parameterized query expects the parameter '@${k}', which was not supplied.`);
    }
  }
}
const outVal = (row, name) => {
  if (!row) return null;
  if (name in row) return row[name];
  return null;
};
const isDbError = (e) => !!(e && (e.code || e.sql));

// ---------------------------------------------------------------- model property lists (C# property names)
const ADDR_PROPS = ['Id', 'PinCode', 'ShortAddress', 'LandMark', 'CityId', 'StateId', 'CountryId', 'VillageName', 'CityName',
  'DistrictName', 'StateName', 'CountryName', 'PhoneNo1', 'PhoneNo2', 'Email1', 'Email2', 'FaxNo1', 'FaxNo2', 'Remarks',
  'CurrencyId', 'IsActive', 'LogId', 'CreatedDate', 'AddressGuid', 'IsDefault', 'AddressType', 'ToUserType', 'IsVerified',
  'ToUserId', 'name', 'CNAME', 'ADDRESSTYPE1'];
const SC_PROPS = ['CategoryId', 'CheckoutType', 'DAP', 'GrandTotal', 'Images', 'PaybleAmount', 'PaybleAmount_OnPurchase',
  'PayblePurchaseTotal', 'TotalVatAmount', 'VatAmount', 'VatPrecentage', 'PinCodeAvailability', 'IsStockCount', 'PrTitle',
  'quantity', 'sellMRP', 'ShippingCharges', 'SPRID', 'TotalAmount', 'TotalShipping', 'BV', 'PV', 'CASHBACK', 'title', 'value',
  'productdetails', 'ProductRealAmount'];
const OPUD_PROPS = ['ORDER_BV', 'ORDER_PV', 'ORDER_CASHBACK', 'USERNAME', 'NAME', 'PHONE', 'EMAILID', 'AMOUNT', 'JPPOINTS',
  'SUCCESSURL', 'FAILUREURL', 'INPROCESSURL', 'CANCELLEDURL', 'COMPANYNAME', 'COMPANYLOGO', 'SHOPPINGWALLET', 'RESELLERWALLET',
  'APIURL', 'SMSAPI', 'COMPANYPGMERCHANTKEY', 'COMPANYPGSALT', 'RazorPayDataKey', 'PMID', 'COMPNAYNAME',
  'TRANSATIONPAYUMONEYRATE', 'TRANSATIONRAZORPAYRATE'];
const WALLET_PROPS = ['WALLETID', 'WALLETNAME', 'MAXUSEPER', 'ISRETURN'];
const MEMBERPROFILE_PROPS = ['PMID', 'plid', 'Title', 'Fname', 'Lname', 'Phone', 'Designation', 'CPer_EmailID', 'LoginId',
  'Password', 'ImageName', 'USERNAME', 'PhoneWithCode', 'CountryName', 'INTRO_PLID', 'DOB', 'FatherOrMotherName', 'Gender',
  'HighestQualification', 'CID', 'SID', 'CTID', 'Atc_WalletAddress', 'CityName', 'MarriageAnniversary', 'SponserName', 'ACTIVE',
  'PINCODE', 'NOMINEEMNAME', 'NOMINEEMREL', 'NOMINEEDOB', 'NOMINEECONTACT', 'FACEBOOKLINK', 'maritalstatus', 'Address',
  'SponsorUsername', 'STATENAME'];

const toBool = (v) => (v === null || v === undefined ? null : !!v);
function mapAddress(row) {
  if (!row) return null;
  const o = mapRow(row, ADDR_PROPS);
  o.IsActive = toBool(o.IsActive);
  o.IsDefault = toBool(o.IsDefault);
  o.IsVerified = toBool(o.IsVerified);
  if (o.CreatedDate) o.CreatedDate = netDate(o.CreatedDate);
  return o;
}
const mapAddresses = (rows) => (rows || []).map(mapAddress);

// ---------------------------------------------------------------- static helpers of the C# file
/** product_detail_cutom.getshipingcharge(MPRID) */
async function getshipingcharge(MPRID) {
  let shippingcharges = 0;
  const row = await queryOne('shopping', 'select shippingcharges from ims_subproduct where sprid = @sprid limit 1', { sprid: MPRID });
  if (row) shippingcharges = Number(row.shippingcharges === null ? 0 : row.shippingcharges); // Convert.ToDecimal(null) => 0
  return shippingcharges;
}

/** product_detail_cutom.getvatcharge(MPRID) */
async function getvatcharge(MPRID) {
  let vatcharges = 0;
  const sub = await queryOne('shopping', 'select vatcategoryid from ims_subproduct where sprid = @sprid limit 1', { sprid: MPRID });
  const VatCategoryId = sub ? sub.vatcategoryid : null;
  const row = VatCategoryId === null || VatCategoryId === undefined
    ? null
    : await queryOne('shopping', 'select vatpercvalue from tbl_vat_categories where vcid = @vcid limit 1', { vcid: VatCategoryId });
  if (!row) vatcharges = 0;
  else vatcharges = Number(row.vatpercvalue === null ? 0 : row.vatpercvalue);
  return vatcharges;
}
const product_detail_cutom = { getshipingcharge, getvatcharge };

/** ChecoutController.GetShoppingCartData(Plid, SessionID) - returns null on any error (as the C# did) */
async function GetShoppingCartData(Plid, SessionID) {
  let CLID = 0;
  try {
    if (Plid !== null && Plid !== undefined) CLID = convToInt(Plid);
    const sessionId = SessionID;
    assertSupplied({ SESSIONID: sessionId });
    const rows = await proc('shopping', 'usp_getshoppingcartdata', { clid: CLID, sessionid: sessionId });
    return mapRows(rows, SC_PROPS);
  } catch (ex) {
    return null;
  }
}

/** ChecoutController.PinCodeCheckAvalibility(PRID, RegNo) */
async function PinCodeCheckAvalibility(PRID, RegNo) {
  const ReturnValue = new Array(4).fill(null);
  ReturnValue[0] = 'not found';
  const Datacount = Number(await scalar('shopping', "select count(1) from ims_customeraddress where touserid = @r and tousertype = 'Customer'", { r: RegNo })) || 0;
  if (Datacount === 1) {
    await exec('shopping', "update ims_customeraddress set isdefault = true where touserid = @r and tousertype = 'Customer'", { r: RegNo });
  }
  const adrs = mapAddress(await queryOne('shopping',
    "select * from ims_customeraddress where touserid = @r and tousertype = 'Customer' and isdefault::int = 1 limit 1", { r: RegNo }));
  /* sprid = Convert.ToInt64(Decryptword(PRID)); the IMS_SubProduct row (pms) is only dereferenced inside a branch that can
     never execute (ar is never null there), so only the conversion is kept */
  convToInt(await Decryptword(PRID));
  let pg = null;
  if (adrs) {
    pg = await queryOne('shopping', 'select * from tbl_courierpincodes where pincode = @pin limit 1', { pin: adrs.PinCode });
  }
  if (pg && adrs) {
    ReturnValue[0] = 'found';
    ReturnValue[1] = adrs.PinCode;
  } else {
    ReturnValue[1] = '';
  }
  return ReturnValue;
}

/** ChecoutController.GetStockCount(SPRID) */
async function GetStockCount(SPRID) {
  const v = await scalar('shopping', 'select stockin from ims_subproduct where sprid = @sprid limit 1', { sprid: SPRID });
  return Math.trunc(Number(v === null || v === undefined ? 0 : v));
}

/** ChecoutController.getSelectedAttr(SPRID) */
async function getSelectedAttr(SPRID) {
  const rows = await query('shopping',
    `select distinct title, value from ims_masterproductattribute mpa
       inner join tbl_attributes_with_category awc on mpa.awcid = awc.awct_id
      where awc.isselectiveattr::int = 1 and mpa.sprid = @sprid`, { sprid: SPRID });
  return mapRows(rows, ['title', 'value']);
}

/** ProcessResult result of the address DAL: { Message, ReturnValue, Success } */
function procResultFrom(row) {
  const pb = {};
  const sqlResult = outVal(row, 'sqlresult');
  const success = outVal(row, 'success');
  const message = outVal(row, 'message');
  pb.ReturnValue = strOrEmpty(sqlResult);
  if (success === null || success === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  pb.Success = !!success;
  pb.Message = strOrEmpty(message);
  return pb;
}

const CustomerAddressDal = {
  async CreateAddress(adrs, IPAddress) {
    let pb = {};
    try {
      const params = {
        id: adrs.Id,
        pincode: strOrEmpty(adrs.PinCode),
        shortaddress: strOrEmpty(adrs.ShortAddress),
        landmark: strOrEmpty(adrs.LandMark),
        countryid: adrs.CountryId,
        cityname: strOrEmpty(adrs.CityName),
        countryname: '',
        phoneno1: strOrEmpty(adrs.PhoneNo1),
        phoneno2: strOrEmpty(adrs.PhoneNo2),
        email1: strOrEmpty(adrs.Email1),
        remarks: 'Its Created Directly.',
        addresstype: adrs.AddressType,
        touserid: adrs.ToUserId,
        tousertype: adrs.ToUserType,
        addresstype1: adrs.ADDRESSTYPE1,
        cname: adrs.CNAME,
        ipaddress: IPAddress,
      };
      assertSupplied(params);
      const row = await procOne('shopping', 'ims_usp_createcustomeraddress', params);
      pb = procResultFrom(row);
    } catch (ex) {
      if (!isDbError(ex) && !/was not supplied/.test(ex.message || '')) throw ex; // only SqlException is swallowed
      pb = { ReturnValue: '', Success: false, Message: String(ex.message) };
    }
    return pb;
  },

  async GetAddress(ToUserID) {
    const row = await queryOne('shopping',
      'select * from ims_customeraddress where touserid = @u and isdefault::int = 1 limit 1', { u: ToUserID });
    return mapAddress(row);
  },

  async IsActive_Address(a, IPAddress) {
    let pb = {};
    try {
      const params = { addressguid: a.AddressGuid, touserid: a.ToUserId, tousertype: a.ToUserType, ipaddress: IPAddress };
      assertSupplied(params);
      pb = procResultFrom(await procOne('shopping', 'ims_usp_isactive_customeraddress', params));
    } catch (ex) {
      if (!isDbError(ex) && !/was not supplied/.test(ex.message || '')) throw ex;
      pb = { ReturnValue: '', Success: false, Message: String(ex.message) };
    }
    return pb;
  },

  async IsDefault_Address(adrs, IPAddress) {
    let pb = {};
    try {
      const params = { addressguid: adrs.AddressGuid, touserid: adrs.ToUserId, tousertype: adrs.ToUserType, ipaddress: IPAddress };
      assertSupplied(params);
      pb = procResultFrom(await procOne('shopping', 'ims_usp_isdefault_customeraddress', params));
    } catch (ex) {
      if (!isDbError(ex) && !/was not supplied/.test(ex.message || '')) throw ex;
      pb = { ReturnValue: '', Success: false, Message: String(ex.message) };
    }
    return pb;
  },

  async IsVerified_Address(a, IPAddress) {
    let pb = {};
    try {
      const params = { addressguid: a.AddressGuid, touserid: a.ToUserId, tousertype: a.ToUserType, ipaddress: IPAddress };
      assertSupplied(params);
      pb = procResultFrom(await procOne('shopping', 'ims_usp_isverified_customeraddress', params));
    } catch (ex) {
      if (!isDbError(ex) && !/was not supplied/.test(ex.message || '')) throw ex;
      pb = { ReturnValue: '', Success: false, Message: String(ex.message) };
    }
    return pb;
  },

  async GetAddressList(adrs) {
    // GetCustomerAddressInfoList : ProcessResult { Message, ReturnValue, Success, AddressInfoList }
    const rows = await proc('shopping', 'ims_usp_getall_customeraddress',
      { addressguid: adrs.AddressGuid, touserid: adrs.ToUserId, tousertype: adrs.ToUserType });
    return (rows || []).map((r) => ({
      Message: r.message === undefined ? null : r.message,
      ReturnValue: r.returnvalue === undefined ? null : r.returnvalue,
      Success: r.success === undefined || r.success === null ? null : !!r.success,
      AddressInfoList: [],
    }));
  },
};

// ================================================================= ROUTES
// auth
router.post('/api/Ordersadd', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const Plid = p.Plid;
  const SessionID = p.SessionID;
  const loginID = p.loginID;
  const paymode = p.paymode;
  const IsCouponApplyed = bindNum(p.IsCouponApplyed, 0, true);
  const SumBv = bindNum(p.SumBv, 0, false);
  const JP = bindNum(p.JP, 0, false);
  const netorder = bindNum(p.netorder, 0, false);
  if (IsCouponApplyed === undefined) return badRequest(res, 'IsCouponApplyed');
  if (SumBv === undefined) return badRequest(res, 'SumBv');
  if (JP === undefined) return badRequest(res, 'JP');
  if (netorder === undefined) return badRequest(res, 'netorder');

  if (Plid === null || Plid === undefined) {
    return res.json('Session Expired Please Refresh Page ');
  }
  const responseData = [];
  let ret = 'ok';
  let successurl = '', failureurl = '', inprocessurl = '', canceledurl = '';
  try {
    // CompanySettings.PMID / CompanyMasterSettings.GetResellerData() => AppSettings["PMID"]
    const PMID = Number(config.app.PMID) || 0;
    const ResellerWalletRow = await scalar('shopping',
      'SELECT coalesce(available_wallet,0) AS available_wallet FROM tbl_distributor_prepaid_setting WHERE pmid = @pmid limit 1',
      { pmid: String(PMID) });
    const ResellerWallet = ResellerWalletRow === null || ResellerWalletRow === undefined ? 0 : Number(ResellerWalletRow);
    if (ResellerWallet < 10000) {
      return res.json('insufficientfund^');
    }

    const Loginid = loginID;
    const PLID = convToInt(Plid);
    let ml = null;
    let adrs = {};
    ml = await queryOne('shopping', 'select clid, fname, lname, emailid, phone from tbl_customerlogin where clid = @clid limit 1', { clid: PLID });
    if (ml) {
      adrs = mapAddress(await queryOne('shopping',
        "select * from ims_customeraddress where tousertype = 'Customer' and touserid = @u and isdefault::int = 1 limit 1", { u: PLID }));
      ml = { CLID: ml.clid, FNAME: ml.fname, LNAME: ml.lname, EMAILID: ml.emailid, PHONE: ml.phone };
    }
    let newstringval = '';
    let Payamount = 0;

    // ---- cart manage
    const shoppingData = await GetShoppingCartData(Plid, SessionID);
    if (shoppingData && shoppingData.length > 0) {
      for (const shopData of shoppingData) {
        const po = {};
        po.SPRID = shopData.SPRID;
        po.quantity = convToInt(shopData.quantity);
        po.ShippingCharges = await getshipingcharge(shopData.SPRID);
        po.VatPrecentage = await getvatcharge(shopData.SPRID);
        newstringval += po.SPRID + '^' + po.quantity + '|';
        Payamount = Payamount + Number(shopData.ProductRealAmount) + po.ShippingCharges;
        po.VatAmount = ((shopData.ProductRealAmount * po.quantity) * po.VatPrecentage) / 100;
        Payamount += po.VatAmount;
      }
    }

    newstringval = newstringval.trim().replace(/^\|+|\|+$/g, '').trim();
    if (newstringval === '') {
      return res.json('No product selected for Registration');
    }
    const Product = newstringval;

    if (netorder < 0) {
      return res.json('Amount Can Not Be Less Than Zero.');
    }
    if (netorder === 0) {
      return res.json('Amount Can Not Zero.');
    }

    // ---- DID (CompanyMasterSettings.GetResellerData(); AppSettings["DID"])
    let DID = 0;
    if (DID === 0) {
      DID = convToInt(config.app.DID);
      if (DID === 0) DID = 1;
    }
    if (DID !== null) {
      DID = convToInt(config.app.DID);
    }

    const TRANSACTIONPASSWORD = '';
    const USERNAMEEWALLET = '';
    const TRANSACTIONPASSWORDEWALLET = '';
    const stockistname = '';
    const SumCashback = 0;
    const USERNAME = '';
    if (!ml) throw new Error(NRE_MSG);
    if (!adrs) throw new Error(NRE_MSG);
    const makeOrderParams = {
      orderid: '',
      loginid: Loginid,
      product: Product,
      fname: strOrEmpty(ml.FNAME) + ' ' + strOrEmpty(ml.LNAME),
      lname: ml.LNAME,
      address11: adrs.ShortAddress,
      towncity: adrs.CityName,
      postalcode: adrs.PinCode,
      emails: ml.EMAILID,
      mobile: adrs.PhoneNo1 === '' ? ml.PHONE : adrs.PhoneNo1,
      paymode,
      paymentremark: '',
      ordertype: 'Purchase',
      sh_fname: '',
      sh_lname: '',
      sh_address11: '',
      sh_towncity: '',
      sh_postalcode: '',
      sh_emails: '',
      sh_mobile: '',
      distributorid: DID,
      iscouponapplyed: IsCouponApplyed,
      username: USERNAME,
      transactionpassword: TRANSACTIONPASSWORD,
      sumbv: SumBv,
      jp: JP,
      netorder,
      usernameewallet: USERNAMEEWALLET,
      transactionpasswordewallet: TRANSACTIONPASSWORDEWALLET,
      plid: PLID,
      stockistusername: stockistname,
      sumcashback: SumCashback,
    };
    assertSupplied(makeOrderParams);
    const makeRow = await procOne('shopping', 'usp_customer_make_order', makeOrderParams);
    ret = strOrEmpty(outVal(makeRow, 'strresult')); // @STRRESULT OUT
    const splitdata = ret.split('^');
    if (splitdata.length > 1) {
      if (splitdata[1].toString().trim() === 'add') {
        // (OrderPayment op - built by the C# but never used afterwards)
        const Id = Encryptword(splitdata[0].toString().trim());
        ret = 'add^' + Id;
        const BASEURL = config.app.CompanyREDIRECT || '';
        successurl = BASEURL + '/secure-order-payment/payment-success';
        failureurl = BASEURL + '/secure-order-payment/payment-failed';
        inprocessurl = BASEURL + '/secure-order-payment/payment-inprocess';
        canceledurl = BASEURL + '/secure-order-payment/payment-cancel';

        if (paymode === 'payumoney' && Id !== '' && Id !== null && Id !== undefined) {
          const paySource = 'Checkout';
          const tempCheckOutOrderId = await Decryptword(String(Id));
          const orderIdArray = tempCheckOutOrderId.split(',');
          if (orderIdArray.length < 2) throw new Error('Index was outside the bounds of the array.');
          const checkOutOrderId = orderIdArray[1];

          const pgRow = await scalar('shopping',
            'SELECT coalesce(order_netamt,0) FROM tbl_order_master WHERE orderid = @o AND loginid = @l limit 1',
            { o: checkOutOrderId, l: Loginid });
          const PGAmount = pgRow === null || pgRow === undefined ? 0 : Number(pgRow);

          const reqParams = {
            clid: PLID,
            amount: PGAmount,
            orderid: checkOutOrderId,
            source: paySource,
            successurl,
            failureurl,
            inprocessurl,
            cancelledurl: canceledurl,
          };
          assertSupplied(reqParams);
          const reqRow = await procOne('shopping', 'usp_orderonlinerequests', reqParams);
          const paymentoutputResult = strOrEmpty(outVal(reqRow, 'stroutput'));
          const paymenttransactionID = strOrEmpty(outVal(reqRow, 'transactionid'));

          if (paymentoutputResult.toUpperCase() === 'SUCCESS' && paymenttransactionID !== '' && successurl !== '' &&
            failureurl !== '' && inprocessurl !== '' && canceledurl !== '') {
            const PaymentBaseURL = config.app.PaymentURL;
            if (PaymentBaseURL === null || PaymentBaseURL === undefined) throw new Error(NRE_MSG);

            if (ResellerWallet >= 10000) {
              // (the C# built this "Url" string but never used it; Encryptword calls are side-effect free)
              // const Url = PaymentBaseURL + 'Home?refrenceid=' + Encryptword(paymenttransactionID) + ...

              let TempPMID = 0;
              await Decryptword(String(PMID)); // PMID11 (unused)
              if (String(PMID) !== '0') {
                const t = await scalar('shopping', 'SELECT pmid FROM tbl_distributor WHERE did = @did limit 1', { did: PMID });
                TempPMID = t === null || t === undefined ? 0 : Number(t);
              } else {
                TempPMID = convToInt(String(Plid));
              }
              await Decryptword(successurl); // SuccessURL (unused)
              await Decryptword(canceledurl); // FailURL (unused)

              const pgmParams = (mode) => ({
                mode, ordernumber: String(paymenttransactionID), source: String(paySource), successurl: String(successurl),
                failureurl: String(failureurl), inprocessurl: String(inprocessurl), canceledurl: String(canceledurl),
              });
              // paySource is the constant "Checkout" so only that branch of the original if/else-if chain is reachable
              const opudRow = await procOne('shopping', 'usp_paymentgatewaymaster', pgmParams('2'));
              const obj_li_OnlinePaymentUserDetails = mapRow(opudRow, OPUD_PROPS);
              const walletRows = await proc('shopping', 'usp_paymentgatewaymaster', pgmParams('3'));
              const list = mapRows(walletRows, WALLET_PROPS);
              responseData.push({
                status: 'true',
                message: 'success',
                data: obj_li_OnlinePaymentUserDetails,
                WalletDetail: list,
                TransactionID: paymenttransactionID,
              });
              return res.json(responseData);
            }
          } else {
            return res.json('/page-not-found');
          }
        }
      }
    }
  } catch (ex) {
    ret = ex.message;
  }

  responseData.push({
    status: 'true',
    message: 'success',
    data: ret,
  });
  return res.json(responseData);
}));

// auth
router.post('/api/Orderreview', auth, asyncHandler(async (req, res) => {
  const Plid = req.p.Plid;
  const SessionID = req.p.SessionID;
  const pkgorder = [];
  let RegNo = 0;
  if (Plid !== null && Plid !== undefined) RegNo = convToInt(Plid);

  let NetAmount = 0;
  let TotalShippingCharge = 0;
  let Total_VatAmount = 0;
  let CP_Charge = 0;
  let ItemBill = 0;
  const responseData = [];

  const shoppingData = await GetShoppingCartData(Plid, SessionID);
  if (shoppingData && shoppingData.length > 0) {
    for (const shopData of shoppingData) {
      const pkg = {
        CategoryId: 0, CheckoutType: '', DAP: 0, GrandTotal: 0, Images: null, PaybleAmount: 0, PaybleAmount_OnPurchase: 0,
        PayblePurchaseTotal: 0, TotalVatAmount: 0, VatAmount: 0, VatPrecentage: 0, PinCodeAvailability: null, IsStockCount: 0,
        PrTitle: null, quantity: 0, sellMRP: 0, ShippingCharges: 0, SPRID: 0, TotalAmount: 0, TotalShipping: 0, BV: 0, PV: 0,
        CASHBACK: 0, title: null, value: null, productdetails: null, ProductRealAmount: 0, listproductdetails: null,
      };
      pkg.SPRID = shopData.SPRID;
      pkg.PrTitle = shopData.PrTitle;
      pkg.PaybleAmount = Number(shopData.PaybleAmount);
      pkg.Images = shopData.Images;
      pkg.quantity = convToInt(shopData.quantity);
      pkg.BV = Number(shopData.BV);
      pkg.PV = Number(shopData.PV * shopData.quantity);
      pkg.CASHBACK = Number(shopData.CASHBACK * shopData.quantity);
      pkg.ProductRealAmount = Number(shopData.ProductRealAmount);
      pkg.ShippingCharges = await getshipingcharge(pkg.SPRID);
      pkg.VatPrecentage = await getvatcharge(pkg.SPRID);
      pkg.PayblePurchaseTotal = pkg.PaybleAmount + (pkg.quantity * pkg.ShippingCharges);
      pkg.VatAmount = (pkg.PaybleAmount * pkg.VatPrecentage) / 100;
      const ReturnValue = await PinCodeCheckAvalibility(Encryptword(pkg.SPRID.toString()), RegNo);
      pkg.PinCodeAvailability = ReturnValue[0].toString();
      pkg.IsStockCount = await GetStockCount(Number(pkg.SPRID.toString()));
      pkg.DAP = Number(shopData.DAP);
      pkg.listproductdetails = await getSelectedAttr(shopData.SPRID);
      // (cookie "pincode" creation was a no-op in the C#: ReturnValue[1].ToString() is still evaluated)
      ReturnValue[1].toString();
      pkg.TotalAmount += pkg.PayblePurchaseTotal;
      pkg.TotalShipping += pkg.quantity * pkg.ShippingCharges;
      pkg.TotalVatAmount += pkg.VatAmount;
      pkg.GrandTotal += pkg.PayblePurchaseTotal + (pkg.quantity * pkg.ShippingCharges) + pkg.VatAmount;

      pkgorder.push(pkg);

      NetAmount = NetAmount + pkg.TotalAmount;
      ItemBill = ItemBill + pkg.DAP;
      TotalShippingCharge = TotalShippingCharge + pkg.TotalShipping;
      Total_VatAmount = Total_VatAmount + pkg.TotalVatAmount;
      CP_Charge = CP_Charge + pkg.BV;
    }

    responseData.push({
      status: 'true',
      message: 'success',
      itemBill: ItemBill,
      Tax: Total_VatAmount,
      Ship_Charges: TotalShippingCharge,
      CP: CP_Charge,
      Total_pay: roundHalfEven(NetAmount),
      data: pkgorder,
    });
  }
  return res.json(responseData);
}));

// auth
router.post('/api/AddMemberAddress', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const CountryId = bindNum(p.CountryId, undefined, true);
  if (CountryId === undefined) return badRequest(res, 'CountryId');
  const responseData = [];
  try {
    const Regno = convToInt(p.Plid);
    const adrs = {};
    adrs.Id = convToInt(p.AddressId);
    adrs.CountryId = CountryId;
    adrs.PhoneNo1 = p.MobileNo === undefined ? null : p.MobileNo;
    adrs.CityName = p.CityName === undefined ? null : p.CityName;
    adrs.StateName = p.StateName === undefined ? null : p.StateName;
    adrs.ShortAddress = p.StreetAddress === undefined ? null : p.StreetAddress;
    adrs.PinCode = p.Pincode === undefined ? null : p.Pincode;
    adrs.LandMark = p.LandMark === undefined ? null : p.LandMark;
    adrs.AddressType = p.AddressType === undefined ? null : p.AddressType;
    adrs.ToUserId = Regno;
    adrs.PhoneNo2 = p.Alternate_phone === undefined ? null : p.Alternate_phone;
    adrs.ToUserType = 'Customer'; // UtilityClass.SeclectUserType.Customer.ToString()
    const t = convToInt(p.adrestype);
    if (t < 0 || t > 255) throw new Error('Value was either too large or too small for an unsigned byte.');
    adrs.ADDRESSTYPE1 = t;
    adrs.CNAME = p.Name === undefined ? null : p.Name;
    const pb = await CustomerAddressDal.CreateAddress(adrs, '101.102.103.1');
    responseData.push({
      status: 'true',
      message: 'success',
      data: (pb.Success === null || pb.Success === undefined ? '' : (pb.Success ? 'True' : 'False')) + '^' + strOrEmpty(pb.Message),
    });
  } catch (ex) {
    responseData.push({
      status: 'false',
      message: 'Error',
      data: ex.message,
    });
  }
  return res.json(responseData);
}));

// auth
router.post('/api/GetAddressDetail', auth, asyncHandler(async (req, res) => {
  const AddressId = req.p.AddressId;
  const Plid = req.p.Plid;
  convToInt(Plid); // Regno
  const responseData = [];
  const adid = convToInt(AddressId);
  const adrs = mapAddress(await queryOne('shopping', 'select * from ims_customeraddress where id = @id limit 1', { id: adid }));
  responseData.push({
    status: 'true',
    message: 'success',
    data: adrs,
  });
  return res.json(responseData);
}));

// auth
router.post('/api/DeleteMemberAddress', auth, asyncHandler(async (req, res) => {
  const AddressId = req.p.AddressId;
  const Plid = req.p.Plid;
  convToInt(Plid); // Regno
  let Return = false;
  const adid = convToInt(AddressId);
  await exec('shopping', 'DELETE FROM ims_customeraddress WHERE id = @id', { id: adid });
  Return = true;
  const responseData = [];
  responseData.push({
    status: 'true',
    message: 'success',
    data: Return,
  });
  return res.json(responseData);
}));

// auth
router.post('/api/GetMemberAddressList', auth, asyncHandler(async (req, res) => {
  const Plid = bindNum(req.p.Plid, undefined, true);
  if (Plid === undefined) return badRequest(res, 'Plid');
  const responseData = [];
  const lst = mapAddresses(await query('shopping', 'select * from ims_customeraddress where touserid = @p', { p: Plid }));
  responseData.push({
    status: 'true',
    message: 'success',
    data: lst,
  });
  return res.json(responseData);
}));

// auth
router.post('/api/MemberProfile', auth, asyncHandler(async (req, res) => {
  const plid = req.p.plid;
  const Plid = convToDouble(plid);
  // dbo.Usp_check_kyc @plid, @strResult out (result string is never used by the C#)
  await proc('shopping', 'usp_check_kyc', { plid: Plid });
  // Tbl_ReferenceUserName lookups (values unused by the C#, kept for parity)
  await scalar('shopping', "select coalesce(mobileno,'') from tbl_referenceusername where clid = @clid and status::int = 1 limit 1", { clid: String(Plid) });
  await scalar('shopping', "select coalesce(username,'') from tbl_referenceusername where clid = @clid and status::int = 1 limit 1", { clid: String(Plid) });

  const memRow = await procOne('shopping', 'usp_getcontactdetails', { plid: Plid });
  const memdetails = mapRow(memRow, MEMBERPROFILE_PROPS);
  const responseData = [];
  responseData.push({
    status: 'true',
    message: 'success',
    data: memdetails,
  });
  return res.json(responseData);
}));

// helpers re-usable by sibling modules
router.GetShoppingCartData = GetShoppingCartData;
router.PinCodeCheckAvalibility = PinCodeCheckAvalibility;
router.GetStockCount = GetStockCount;
router.getSelectedAttr = getSelectedAttr;
router.product_detail_cutom = product_detail_cutom;
router.CustomerAddressDal = CustomerAddressDal;

module.exports = router;
