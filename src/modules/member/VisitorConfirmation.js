'use strict';
/**
 * Port of Member/Common/Controllers/VisitorConfirmation.cs (VisitorConfirmationController)
 * Prefix: /member   DB: affiliate (DataBaseContext => Db_Affiliate)
 */
const express = require('express');
const path = require('path');
const { queryOne } = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');
const RegistrationConfirmation = require('../../lib/member/RegistrationConfirmation');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: Regisrtration-Confirmation/{action}  (VisitorConfirmation / Index)
// public
router.all(['/member/VisitorConfirmation/Index{/:id}', '/member/Regisrtration-Confirmation{/:action}'], asyncHandler(async (req, res) => {
  const { emailid, vmid, password, TransPassword, AutoUserName, username } = req.p;
  const PageUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const ViewBag = { Canonical: PageUrl, Title: '', MetaDesc: '', MetaKeyword: '' };
  if (emailid !== undefined && emailid !== null && emailid !== '' && vmid !== undefined && vmid !== null && vmid !== '') {
    // Request.QueryString["vmid"] / ["emailid"]
    ViewBag.Message = await RegistrationConfirmation.Verification(String(req.query.vmid), String(req.query.emailid), path.join(process.cwd(), 'visitor_confirm.html')); // Server.MapPath("visitor_confirm.html")
    if (ViewBag.Message === 'All Ok') {
      try {
        const SoftUrl = await queryOne(DB, 'SELECT SOFTWARE_URL, NAME FROM TBL_COMPANYMASTER WHERE COMID = 1 LIMIT 1');
        const CompanyName = SoftUrl.name; // SoftUrl.NAME (NullReference when no row => caught below)
        ViewBag.CompanyName = CompanyName;
        const EmailWLCMsg = await queryOne(DB, 'SELECT Email_Send_Status, Email_Content, Email_Subject FROM tbl_emailaction WHERE EID = 1 LIMIT 1');
        if (Number(EmailWLCMsg.email_send_status) === 1) {
          // legacy: fire-and-forget background thread
          (async () => {
            try {
              const Mailmsg = EmailWLCMsg.email_content;
              const fileUploader = null;
              await UtilityClass.Decryptword(TransPassword); // transpasword (unused further, may throw like legacy)
              const DynamicMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(AutoUserName, Mailmsg, emailid, password, 1, TransPassword);
              await UtilityClass.SendEmailByApiSetting(username, password, '', '', '', '', String(emailid).toLowerCase(), EmailWLCMsg.email_subject, DynamicMsg, fileUploader);
            } catch (e) {
              console.error(e);
            }
          })();
        }
      } catch (e) {
        console.error(e);
        try { await new DataUtility().ErrorInsert(0, e.message, 'Index', 0, req.path); } catch (e2) { console.error(e2); }
      }
    }
  } else {
    ViewBag.Message = "Please Don't Play With URL.!!!";
  }
  return res.json({ view: '~/Views/VisitorConfirmation/Index.cshtml', ViewBag });
}));

module.exports = router;
