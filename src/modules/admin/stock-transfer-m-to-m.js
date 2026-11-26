'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Stock_Transfer_M_To_M.cs (class Stock_Transfer_M_To_MController, no namespace => /admin/Stock_Transfer_M_To_M/...)
// Database: affiliate (Db_Affiliate). Procs UPS_GetUserName_M_to_M, USP_AddTransferStockMtoM, UPS_GetDetailsByUserNameMToM, UPS_GetDetailsByProductNameMToM,
// UPS_GetDetailsByUserName, USP_DELIVERYCHALLANMASTERMToM, USP_DELIVERYCHALLANDETAILSMToM; tables tbl_smsaction, tbl_emailaction.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nStr, reqInt, col, str, cvtInt, at, splitCsv } = require('./_shared/batch11-common');
const { smsAction, emailAction, need } = require('./_shared/batch06-debit');
const { fireAndForget } = require('./_shared/batch13-07-common');

const router = express.Router();
const C = 'Stock_Transfer_M_To_M';

/** public class StockDetailsMtoM */
const STOCK_DETAILS_MTOM_PROPS = ['RowNumber', 'TKPMID', 'PLID', 'FRID', 'PRODUCTLIST', 'INSTOCK', 'OUTSTOCK', 'AVAILABLE', 'EMAILID', 'MRP', 'COUNTRY',
  'STATE', 'ADDRESS', 'CITY', 'PINCODE', 'Name', 'PRcode', 'Username', 'Mobile', 'ATTRIBUTE'];

// ---------------------------------------------------------------- ActionResult Index(string FCode, string PLID, string URL, string Type, string PinCode, string FRID)
// auth (PORT-NOTE: legacy had no session check; admin panel page => adminAuth)
// route-config: "AdminPanel/Stock-Transfer-M-M" -> Stock_Transfer_M_To_M/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Stock-Transfer-M-M'], adminAuth, asyncHandler(async (req, res) => {
  const FCode = nStr(req.p.FCode);
  let PLID = nStr(req.p.PLID);
  let URL = nStr(req.p.URL);
  let Type = nStr(req.p.Type);
  const PinCode = nStr(req.p.PinCode);
  let FRID = nStr(req.p.FRID);
  const ViewBag = {};
  const FrCode = await UtilityClass.Decryptword(FCode);
  if (FrCode === null || FrCode === undefined || FrCode === '') ViewBag.FrCode = '';
  else ViewBag.FrCode = FrCode;
  if (FRID === null) FRID = ''; // eslint-disable-line no-unused-vars
  else ViewBag.FRID = FRID;
  if (URL !== '' && URL !== null) {
    URL = await UtilityClass.Decryptword(URL);
    Type = await UtilityClass.Decryptword(Type);
    if (URL !== null && URL !== undefined && URL !== '') {
      if (Type === 'Stockist') ViewBag.URL = URL + '?' + 'Stockist=' + (await UtilityClass.Encryptword(FrCode));
      else ViewBag.URL = URL + '?' + 'PinCode=' + (PinCode === null ? '' : PinCode);
    }
  } else {
    ViewBag.URL = '/AdminPanel/Stock-Transfer-M-M';
  }
  if (PLID !== '' && PLID !== null) {
    const pli = await UtilityClass.Decryptword(PLID); // eslint-disable-line no-unused-vars
    ViewBag.MPLId = await UtilityClass.Decryptword(String(PLID));
  } else {
    PLID = ''; // eslint-disable-line no-unused-vars
  }
  return res.json({ view: '~/Views/AdminPanel/Stock_Transfer_M_To_M/Index.cshtml', ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult GetUserName(string prefix)
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetUserName{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const ObjUserName = mapRows(await db.proc(DB, 'UPS_GetUserName_M_to_M', { UserName: nStr(req.p.prefix) }), STOCK_DETAILS_MTOM_PROPS);
  return res.json(ObjUserName);
}));

// ---------------------------------------------------------------- public void GenerateDeliveryChallan(string SFRID, string RFRID, string stock, string Remarks)
// (every exception is swallowed by the legacy `catch (Exception ex) { }`)
async function GenerateDeliveryChallan(SFRID, RFRID, stock, Remarks) { // eslint-disable-line no-unused-vars
  let OutputResult = '';
  try {
    // DBO.USP_DELIVERYCHALLANMASTERMToM @FROMID,@TOID,@CHALLANTYPE,@STROUTPUT OUT
    const row = await db.procOne(DB, 'USP_DELIVERYCHALLANMASTERMToM', { FROMID: cvtInt(SFRID), TOID: cvtInt(RFRID), CHALLANTYPE: 'Stock Transfer' });
    OutputResult = str(col(row, 'STROUTPUT'));
    if (OutputResult !== '' && OutputResult !== null) {
      const a1 = splitCsv(stock, '^');
      for (let i = 0; i < a1.length; i++) {
        const p = a1[i].split('~');
        const ID = cvtInt(p[0]);
        const QNTY = at(p, 1);
        if (QNTY !== '') {
          // DBO.USP_DELIVERYCHALLANDETAILSMToM @DCID,@TKPMID,@QTY,@STROUTPUT OUT
          await db.procOne(DB, 'USP_DELIVERYCHALLANDETAILSMToM', { DCID: cvtInt(OutputResult), TKPMID: ID, QTY: cvtInt(QNTY) });
        }
      }
    }
  } catch (ex) {
    // swallowed (legacy empty catch)
  }
}

// ---------------------------------------------------------------- JsonResult stocktransferMtoM(string SFRID, string RFRID, string stock, string Remarks, string ReciverEmail,
//   string ReciverMobile, string SenderEmail, string SenderMobile, string SenderName, string ReciverName)
// auth (PORT-NOTE: legacy had no session check but dereferences Session["Admin_User"] => adminAuth)
router.all(`/admin/${C}/stocktransferMtoM{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const SFRID = nStr(req.p.SFRID);
  let RFRID = nStr(req.p.RFRID);
  const stock = nStr(req.p.stock);
  let Remarks = nStr(req.p.Remarks);
  const ReciverEmail = nStr(req.p.ReciverEmail);
  const ReciverMobile = nStr(req.p.ReciverMobile);
  const SenderEmail = nStr(req.p.SenderEmail);
  const SenderMobile = nStr(req.p.SenderMobile);
  const SenderName = nStr(req.p.SenderName);
  const ReciverName = nStr(req.p.ReciverName);
  let OutputResult = '';
  const a = splitCsv(stock, '^');
  for (let i = 0; i < a.length; i++) {
    const p = a[i].split('~');
    const ID = cvtInt(p[0]);
    const QNTY = at(p, 1);
    if (QNTY !== '') {
      if (RFRID === '') RFRID = '0'; // (MVC binds "" as null, so this only matches a literal "" - kept)
      if (Remarks === null) Remarks = '';
      const loginid = req.user.emp_id;
      // USP_AddTransferStockMtoM @SFRID,@RFRID,@ID,@QNTY,@loginid,@StrResult OUT,@REMARK
      const row = await db.procOne(DB, 'USP_AddTransferStockMtoM', {
        SFRID: cvtInt(SFRID), RFRID: cvtInt(RFRID), ID, QNTY: cvtInt(QNTY), loginid, REMARK: Remarks,
      });
      OutputResult = str(col(row, 'StrResult'));
    }
  }
  if (OutputResult.toUpperCase() === 'SUCCESS') {
    await GenerateDeliveryChallan(SFRID, RFRID, stock, Remarks);
    if (SenderName !== '') {
      const SMSVerification = need(await smsAction(27));
      const MobileSMS = SMSVerification.Sms_Content; // eslint-disable-line no-unused-vars
      const emailVerificationmsg = need(await emailAction(23));
      const DynamicNewOrderMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(SenderName, emailVerificationmsg.Email_Content, '', ReciverName, 14, '');
      if (Number(SMSVerification.Sms_Send_Status) === 1) {
        const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(SenderName, SMSVerification.Sms_Content, ReciverName, '', 15);
        fireAndForget('Stock_Transfer_M_To_M sender SMS', () => UtilityClass.SendSMSWithAPI(SenderMobile, messg, '1'));
      }
      if (Number(emailVerificationmsg.Email_Send_Status) === 1) {
        const fileUploader = null;
        fireAndForget('Stock_Transfer_M_To_M sender email', () => UtilityClass.SendEmailByApiSetting('', '', '', '', '', '', SenderEmail,
          emailVerificationmsg.Email_Subject, DynamicNewOrderMsg, fileUploader));
      }
    }
    if (ReciverName !== '') {
      const SMSVerification = need(await smsAction(28));
      const MobileSMS = SMSVerification.Sms_Content; // eslint-disable-line no-unused-vars
      const emailVerificationmsg = need(await emailAction(24));
      const DynamicNewOrderMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(ReciverName, emailVerificationmsg.Email_Content, '', SenderName, 15, '');
      if (Number(SMSVerification.Sms_Send_Status) === 1) {
        const messg = await UtilityClass.FindingSmsContentWithUserIdPassword(ReciverName, SMSVerification.Sms_Content, SenderName, '', 15);
        fireAndForget('Stock_Transfer_M_To_M receiver SMS', () => UtilityClass.SendSMSWithAPI(ReciverMobile, messg, '1'));
      }
      if (Number(emailVerificationmsg.Email_Send_Status) === 1) {
        const fileUploader = null;
        fireAndForget('Stock_Transfer_M_To_M receiver email', () => UtilityClass.SendEmailByApiSetting('', '', '', '', '', '', ReciverEmail,
          emailVerificationmsg.Email_Subject, DynamicNewOrderMsg, fileUploader));
      }
    }
  }
  return res.json(OutputResult);
}));

// ---------------------------------------------------------------- JsonResult GetDetailsByUserNameMToM(string username)
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetDetailsByUserNameMToM{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const ObjUserName = mapRows(await db.proc(DB, 'UPS_GetDetailsByUserNameMToM', { UserName: nStr(req.p.username) }), STOCK_DETAILS_MTOM_PROPS);
  return res.json(ObjUserName);
}));

// ---------------------------------------------------------------- JsonResult GetDetailsByProductName(string productcode, string productname, string PPLID)
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetDetailsByProductName{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let productcode = nStr(req.p.productcode);
  let productname = nStr(req.p.productname);
  const PPLID = nStr(req.p.PPLID);
  if (productcode === '' || productcode === null) productcode = '';
  if (productname === '' || productname === null) productname = '';
  // DBO.UPS_GetDetailsByProductNameMToM @productname,@PLID,@productcode
  const ObjUserName = mapRows(await db.proc(DB, 'UPS_GetDetailsByProductNameMToM', {
    productname, PLID: cvtInt(PPLID), productcode,
  }), STOCK_DETAILS_MTOM_PROPS);
  return res.json(ObjUserName);
}));

// ---------------------------------------------------------------- JsonResult GetDetailsByUserName(string username, int itemid)
// auth (PORT-NOTE: legacy had no session check; admin data => adminAuth)
router.all(`/admin/${C}/GetDetailsByUserName{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const username = nStr(req.p.username);
  const itemid = reqInt(req.p.itemid, 'itemid');
  // DBO.UPS_GetDetailsByUserName @UserName,@itemid
  const ObjUserName = mapRows(await db.proc(DB, 'UPS_GetDetailsByUserName', { UserName: username, itemid }), STOCK_DETAILS_MTOM_PROPS);
  return res.json(ObjUserName);
}));

// ---------------------------------------------------------------- public void GenerateDeliveryChallan(string SFRID, string RFRID, string stock, string Remarks)
// auth (PORT-NOTE: public void method => routable action in legacy (no session check); creates delivery challans => adminAuth)
router.all(`/admin/${C}/GenerateDeliveryChallan{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  await GenerateDeliveryChallan(nStr(req.p.SFRID), nStr(req.p.RFRID), nStr(req.p.stock), nStr(req.p.Remarks));
  res.send(''); // void action => empty response
}));

module.exports = router;
