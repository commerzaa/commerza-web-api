'use strict';
/**
 * Port of Controllers/WebPanelCntrl/MarchantPController.cs (class MarchantPController, 4 routes).
 * (The old commented-out "previous cashback request" MarchantPurchase overload is dropped.)
 */
const express = require('express');
const multer = require('multer');
const { query, queryOne, scalar, procOne } = require('../db');
const { mapRows } = require('../utils/shape');
const { build } = require('../middleware/params');
const { auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const CustomEncriptionAndDecription = require('../lib/CustomEncriptionAndDecription');
const common = require('../lib/common');
const SaveImage = require('../lib/SaveImage');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() }).any(); // multipart text fields (HttpContext.Current.Request[...])

const NRE_MSG = 'Object reference not set to an instance of an object.';
const FORMAT_MSG = 'Input string was not in a correct format.';

/** Convert.ToInt64(string) */
function convToInt64(s) {
  if (s === null || s === undefined) return 0;
  const t = String(s);
  if (!/^\s*[+-]?\d+\s*$/.test(t)) throw new Error(FORMAT_MSG);
  return Number(t.trim());
}
/** Convert.ToDecimal(string) */
function convToDecimal(s) {
  if (s === null || s === undefined) return 0;
  const t = String(s).trim();
  if (t === '' || isNaN(Number(t))) throw new Error(FORMAT_MSG);
  return Number(t);
}
const isNullOrEmpty = (s) => s === null || s === undefined || s === '';
const DISTRIBUTOR_PROPS = ['pmId', 'CompanyName', 'MOBILENO', 'ADDRESS', 'TITLE', 'AREANAME', 'PINCODE', 'LANKMARK'];
const DIST_COLS = 'PMID::int as PMID, COMPANYNAME, MOBILENO, ADDRESS, TITLE, AREANAME, PINCODE, LANKMARK';

// public
router.post('/api/FranchiseListing', asyncHandler(async (req, res) => {
  let PMID = req.p.PMID;
  const responseData = [];
  if (PMID !== null && PMID !== undefined) {
    if (PMID === '') PMID = 0; // SQL Server implicit conversion of '' to int
    const rows = await query('shopping', `Select ${DIST_COLS} from distributor_master Where pmid = @PMID`, { PMID });
    const distributor = mapRows(rows.slice(0, 1), DISTRIBUTOR_PROPS)[0] || null;
    if (distributor !== null) {
      responseData.push({ status: 'true', message: 'success', data: distributor });
      return res.json(responseData);
    }
    responseData.push({ status: 'true', message: 'error', data: 'Not Available Franchise!' });
    return res.json(responseData);
  }
  const rows = await query('shopping', `Select ${DIST_COLS} from distributor_master Where active::int = 1`);
  const distributors = mapRows(rows, DISTRIBUTOR_PROPS);
  responseData.push({ status: 'true', message: 'success', data: distributors });
  return res.json(responseData);
}));

// public
router.post('/api/FranchiseListingsearch', asyncHandler(async (req, res) => {
  const search = req.p.search === undefined ? null : req.p.search;
  const responseData = [];
  let rows;
  if (search === null || String(search).trim() === '') {
    rows = await query('shopping', `Select ${DIST_COLS} from distributor_master Where active::int = 1`);
  } else {
    rows = await query('shopping',
      `Select ${DIST_COLS} from distributor_master Where active::int = 1 and companyname ilike '%' || @search || '%'`, { search: String(search) });
  }
  const distributors = mapRows(rows, DISTRIBUTOR_PROPS);
  responseData.push({ status: 'true', message: 'error', data: distributors });
  return res.json(responseData);
}));

// auth
router.post('/api/MarchantPurchase', auth, upload, asyncHandler(async (req, res) => {
  const p = build(req); // re-bind after multipart parsing
  let Response = 'ok';
  let ReturnValue = 'added';
  const responseData = [];
  let Marchant_ID = 0;
  const _decr = new CustomEncriptionAndDecription();

  try {
    const Username = p.Username === undefined ? null : p.Username;
    const MarchantID = p.MarchantID === undefined ? null : p.MarchantID;
    const AmountStr = p.Amount === undefined ? null : p.Amount;
    const OrderID = p.OrderID === undefined ? null : p.OrderID;
    const Remark = p.Remark === undefined ? null : p.Remark;
    const BillAmountStr = p.Bill_Amount === undefined ? null : p.Bill_Amount;
    const Imagebase64 = p.image_upload === undefined ? null : p.image_upload;

    const cfg = await new common().GetConfigInfo('BILL_AMOUNT,BILL_UPLOAD');
    const cfgVal = (name) => {
      const hit = (cfg || []).find((x) => String(x.TEXT === undefined ? x.text : x.TEXT).toLowerCase() === name);
      if (!hit) throw new Error(NRE_MSG); // FirstOrDefault() => null => .ToString() NullReferenceException
      const v = hit.VALUE === undefined ? hit.value : hit.VALUE;
      if (v === null || v === undefined) throw new Error(NRE_MSG);
      return String(v).toLowerCase();
    };
    if (cfgVal('bill_amount') === 'true') {
      if (isNullOrEmpty(BillAmountStr)) {
        responseData.push({ status: 'false', message: 'Bill Amount Required!!', data: '' });
        return res.json(responseData);
      }
    }

    const Amount = isNullOrEmpty(AmountStr) ? 0 : convToInt64(AmountStr);
    const Bill_Amount = isNullOrEmpty(BillAmountStr) ? 0 : convToDecimal(BillAmountStr);

    try {
      if (MarchantID === null) throw new Error(NRE_MSG);
      Marchant_ID = convToInt64(await _decr.decryption(String(MarchantID)));
    } catch (ex) {
      responseData.push({ status: 'false', message: 'Invalid Request!!', data: ex.message });
      return res.json(responseData);
    }

    let LoginId = 0;
    let Plid = 0;
    if (Marchant_ID !== 0) {
      const data = await queryOne('affiliate',
        'select loginid, regno from member_master where username = @u limit 1', { u: Username });
      if (data) {
        LoginId = convToInt64(data.loginid);
        Plid = convToInt64(data.regno);
      } else {
        responseData.push({ status: 'false', message: 'Invalid Request by user', data: '' });
        return res.json(responseData);
      }

      const isValid = Number(await scalar('affiliate',
        'select count(1) from member_master where regno = @r and username = @u', { r: Plid, u: Username })) > 0;
      if (isValid) {
        let imagePath = '';

        if (cfgVal('bill_upload') === 'true') {
          if (isNullOrEmpty(Imagebase64)) {
            responseData.push({ status: 'false', message: 'Bill upload Required!!', data: '' });
            return res.json(responseData);
          }
        }
        if (!isNullOrEmpty(Imagebase64)) {
          const folderPath = '~/UploadedBills/';
          const savedPath = await SaveImage.SaveBase64Image(Imagebase64, folderPath);
          if (savedPath.split(':')[0].toLowerCase().includes('error')) {
            responseData.push({ status: 'false', message: savedPath.split(':')[1].toString(), data: '' });
            return res.json(responseData);
          }
          imagePath = savedPath.split(':')[1].toString();
        }

        // [db_affiliate].[DBO].InsertRepurchaseDetails (with Bill_Amount) - @ResultMessage OUT
        const params = {
          username: Username, plid: Plid, loginid: LoginId, marchantid: Marchant_ID, amount: Amount,
          orderid: OrderID, remark: Remark, image_path: imagePath, bill_amount: Bill_Amount,
        };
        for (const k of Object.keys(params)) {
          if (params[k] === null || params[k] === undefined) {
            throw new Error(`The parameterized query expects the parameter '@${k}', which was not supplied.`);
          }
        }
        const row = await procOne('affiliate', 'insertrepurchasedetails', params);
        const out = row && 'resultmessage' in row ? row.resultmessage : null;
        ReturnValue = out === null || out === undefined ? '' : String(out);
      } else {
        responseData.push({ status: 'true', message: 'error', data: 'UserName Not Exist!' });
        return res.json(responseData);
      }
    } else {
      responseData.push({ status: 'true', message: 'Error', data: 'Marchant ID is Invalid!' });
      return res.json(responseData);
    }
  } catch (ex) {
    Response = 'error^' + ex.message;
    responseData.push({ status: 'False', message: 'Error', data: Response });
    return res.json(responseData);
  }

  responseData.push({ status: 'true', message: 'success', data: ReturnValue });
  return res.json(responseData);
}));

// public (no verb attribute => all verbs)
router.all('/api/FetchCashback', asyncHandler(async (req, res) => {
  const merchantId = req.p.merchantId === undefined ? null : req.p.merchantId;
  const amountRaw = req.p.amount;
  if (amountRaw === undefined || amountRaw === null || amountRaw === '' || isNaN(Number(amountRaw))) {
    return res.status(400).json({
      Message: 'The request is invalid.',
      MessageDetail: "The parameters dictionary contains a null or invalid entry for parameter 'amount'.",
    });
  }
  const amount = Number(amountRaw);
  let data = '';
  const _decr = new CustomEncriptionAndDecription();
  if (merchantId === null) throw new Error(NRE_MSG);
  const Marchant_ID = convToInt64(await _decr.decryption(String(merchantId)));
  try {
    // [db_shopping].[DBO].USP_GET_MERCHANT_COFIG_DATA @FLAG,@MERCHANT_ID,@VALUE,@OUT_DATA out
    // PORT-NOTE: the procedure lives in Db_Shopping, so the 'shopping' database is used (was reached through DataBaseContext + db prefix).
    const row = await procOne('shopping', 'usp_get_merchant_cofig_data', { flag: 'Cashback', merchant_id: Marchant_ID, value: amount });
    const out = row && 'out_data' in row ? row.out_data : null;
    data = out === null || out === undefined ? '' : String(out);
  } catch (ex) {
    return res.json({ status: false, message: 'error', error: ex.message });
  }
  try {
    if (!isNullOrEmpty(data)) {
      const response = data.split('^');
      if (response.length > 0) {
        let cbp = 0;
        if (!isNullOrEmpty(response[0])) {
          cbp = Math.floor(convToDecimal(response[0]));
        }
        if (response.length < 3) throw new Error('Index was outside the bounds of the array.'); // response[2]
        return res.json({
          status: true,
          message: 'Success',
          data: {
            cash_back_value: cbp,
            type: response[2],
            value: response[1],
          },
        });
      }
      return res.json({ status: false, message: 'data not found!', data: {} });
    }
    return res.json({ status: false, message: 'data not found!!', data: {} });
  } catch (ex) {
    return res.json({ status: false, message: 'error', error: ex.message });
  }
}));

module.exports = router;
