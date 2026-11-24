'use strict';
/**
 * Port of Merchant Panel Controllers/HomeController.cs (Eblaa_Merchant.Controllers.HomeController)
 * Actions: Index, SaveMerchantEnquiry (2)   DB: Db_Shopping => 'shopping'
 */
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const UtilityClass = require('../../lib/merchant/UtilityClass');
const CompanySettings = require('../../lib/merchant/CompanySettings');
const SendRegisrtaionConfirmationMail = require('../../lib/merchant/SendRegisrtaionConfirmationMail');

const router = express.Router();
const DB = 'shopping';

// ---- Index ---------------------------------------------------------------------------------------------
// public
router.all(['/merchant/Home/Index{/:id}', '/merchant/Home', '/merchant'], asyncHandler(async (req, res) => {
  let { resellerid } = req.p;
  await UtilityClass.Encryptword('MlmMunafa@123'); // legacy: encryptString (unused)
  if (resellerid !== null && resellerid !== undefined && resellerid !== '') {
    resellerid = await UtilityClass.Decryptword(resellerid);
  } else {
    resellerid = '';
  }
  res.json({});
}));

// ---- SaveMerchantEnquiry -------------------------------------------------------------------------------
// public
router.all('/merchant/Home/SaveMerchantEnquiry{/:id}', asyncHandler(async (req, res) => {
  const { Name, businessname, Email, phonenumber, state, city, Messagae } = req.p;
  const source = 'Merchant Enquiry';
  await db.proc(DB, 'usp_Submit_Enquiry', {
    name: Name, email: Email, subject: businessname, message: Messagae, Type: 'Enquiry', replymsg: '', mode: 'Add', Mobile: phonenumber, city, state, Source: source,
  });
  // PORT-NOTE: legacy returned ExecuteSqlCommand's affected-row count as a string (SQL Server reports -1 for procedures using SET NOCOUNT ON), not the @strResult output.
  const result = '-1';

  const MobileNoNoForSendSms = phonenumber;
  const Message = 'Dear ' + Name + ',\r\nThank You for choosing ' + CompanySettings.CompanyName + '! \r\nOur concerned team is going through your queries and will revert back soon .\r\n' + CompanySettings.CompanyName + ' Team';
  const process_ = 'Merchant Enquiry';
  // background thread 1: SMS + track
  (async () => {
    await UtilityClass.SendMsgOnMobile(MobileNoNoForSendSms, Message);
    await UtilityClass.TrackMerchantsMessages(MobileNoNoForSendSms, MobileNoNoForSendSms, process_);
  })().catch((e) => console.error(e));
  // background thread 2: enquiry mail
  (async () => {
    await SendRegisrtaionConfirmationMail.SendEnquiryMail(Email, Name, 'Our company is considered one of the largest marketplace with more than thousands of satisfied registered users. ' + CompanySettings.CompanyName + ' gives a platform to merchants to sell their products and make them visible in national market. Our concern team is looking at your query and will revert back soon.');
  })().catch((e) => console.error(e));
  res.json(result);
}));

module.exports = router;
