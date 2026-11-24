'use strict';
/**
 * Port of Franchise\Controllers\CustomerPanel\businesskyc.cs (businesskycController)
 * Actions: Index, GetKycdetails, GetBankdetails, UpdateKyc, UpdateBank, ExportReport  (6)
 */
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore'); // eslint-disable-line no-unused-vars
const UtilityClass = require('../../lib/franchise/UtilityClass');
const SendMail = require('../../lib/franchise/SendMail');
const CS = require('../../lib/franchise/CompanySettings');
const CompanySettings = CS.CompanySettings || CS;

const DB = 'shopping'; // Franchise DataBaseContext => Db_Shopping (Web.config)
const BUSSINESSKYC_PROPS = ['ROWNUMBER', 'REGNO', 'NAME', 'COMPNAYNAME', 'REQUESTDATE', 'ENTITYTYPE', 'CATID', 'MOBILE', 'EMAILID', 'IsFirstTimeOrAfterRejection', 'LASTUPDATEDDATEBYUSER', 'PROFILESTATUS', 'KYCSTATUS', 'ISCOMPANYDEED', 'ISPARTNERSHIPDEED', 'ISPANCARDDETAILS', 'ISADDRESSPROOF', 'ISINCORPORATIONCERTIFICATE', 'ISMEMORANDUMOFASSOCIATIONPROOF', 'COMPANYDEED', 'PARTNERSHIPDEED', 'PANCARDDETAILS', 'ADDRESSPROOF', 'INCORPORATIONCERTIFICATE', 'MEMORANDUMOFASSOCIATIONPROOF', 'Businessname', 'ISKYCPPROVED', 'Entitype', 'PACKAGENAME', 'ProductPackge', 'TravelPackage', 'DealsPackage'];
const BUSINESSDATA_PROPS = ['PMID', 'PLID', 'COMPANYNAME', 'NOOFEMPLOYEE', 'URL', 'YEAROFESTABLE', 'COMPANYDESC', 'GSTNO', 'TANNO', 'CINNO', 'STATENAME', 'CITYNAME', 'PINCODE', 'AREANAME', 'LANKMARK', 'PICK_CITY', 'PICK_AREA', 'PICK_PINCODE', 'PICK_ADDRESS', 'PICK_LANDMARK', 'MOBILENO', 'COMEMAILID', 'PICK_State', 'ADDRESS', 'ID', 'Regno', 'Type', 'Image', 'Dtm_date', 'KYCTYPE', 'AddressType', 'IsAprove', 'AddressNumber', 'CommentOrRemark'];
const BANKDETAILS_PROPS = ['PLID', 'ACCOUNTHOLDERNAME', 'ACCOUNTNO', 'BANKNAME', 'BRANCHNAME', 'IFSCCODE', 'Cancelled_Cheque_img', 'Address', 'State', 'City', 'ISAPROVE', 'CommentOrRemark'];
const BUSINESSKYCDETAILS_PROPS = ['EntityType', 'PANNO', 'DOI', 'Type'];

// PORT-NOTE: SQL Server stored procedures with an OUTPUT @RECORDCOUNT are expected to expose it as a
// "recordcount" column of the result rows (db layer convention); falls back to the row count.
function recordCount(rows) {
  if (rows.length && rows[0].recordcount !== undefined && rows[0].recordcount !== null) return parseInt(rows[0].recordcount, 10);
  return rows.length;
}

const rep = (s, k, v) => s.split(k).join(v === null || v === undefined ? '' : String(v));
const pad2 = (n) => String(n).padStart(2, '0');
const todayDMY = () => { const d = new Date(); return `${pad2(d.getDate())}-${pad2(d.getMonth() + 1)}-${d.getFullYear()}`; };
const safeStr = (v) => String(v === null || v === undefined ? '' : v).replace(/\t/g, '    ');
const bg = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e.message)); }; // background thread

function mailShell(innerPara, linksHtml, urlPrefix) {
  return `<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px; padding-bottom:10px;'>
<div style='background: #fff; margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; padding:15px 25px;'>
<link href='http://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />
<table cellpadding='0' cellspacing='0' style=' margin:0 auto; color: #333; font-family: Arial,Helvetica,sans-serif; width: 100%'>
<tbody>
<tr>
<td><table style='width:100%;'>
<tbody>
<tr>
<td width='100%' align='center'><a href='$$CompanyDomain$$' target='UlOxf6W290vd9HCE04UigQH'> <img src='http://$$CompanyURL$$/images/logo-website.png' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:20px;'></a></td>
</tr>
</tbody>
</table></td>
</tr>
<tr>
<td>
<div class='clear'></div>
<table style='padding-bottom: 10px; width: 100%; '>
<tbody>
<tr>
<td>
<tr>
<td align='center'><strong style='font-size: 18px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000;'>
</p>
</strong>
<div style='text-align:left;'>
<h1 style='font-size: 14px; font-family: Arial, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42;'>Dear Sir/ Ma’am, </h1>
<div style='font-size: 15px; color: #333;'>
</div>
${innerPara}
</div>
<div style='clear: both'></div>
<div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>
<h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>
<p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> For more information, approach us at anytime.
${urlPrefix} be happy to help you. You can contact us on <a href = 'mailto:$$CompanySupportEmailID$$' target = '_blank' style = 'color:#00a0a8;'> $$CompanySupportEmailID$$ </a></p>
</div>
</td>
</tr>
<div style = 'clear: both'></div>
<div style = 'clear: both'></div>
</td>
</tr>
<tr>
<td><table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>
<tbody>
<tr>
<td>
<p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Sincerely </p>
<h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The $$CompanyName$$ Team</h5>
</td>
<td>
<div style = 'margin-right: 7px; text-align:right'>
${linksHtml}
</div></td>
</tr>
</tbody>
</table></td>
</tr>
</tbody>
</table>
<div class='clear'></div>
</div>
</td>
</tr>
</tbody>
</table>
</div>
<p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2017-2018 All Rights Reserved | $$CompanyURL$$</p>
</div>`;
}

const iconStyle = "border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;";
function socialLinks(f, t, g, l, p) {
  return `<a href = '${f}' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'http://$$CompanyURL$$/images/mailer-facebook.png'  style = '${iconStyle}'> </a>

<a href = '${t}' style = 'color:#55acee; ${iconStyle}' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'http://$$CompanyURL$$/images/mailer-twitter.png' style = '${iconStyle}'></a>

<a href = '${g}' style = 'color:#dd4b39; ${iconStyle}' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'http://$$CompanyURL$$/images/mailer-gplus.png'  style = '${iconStyle}'> </a>

<a href = '${l}' style = 'color: #0072a4; ${iconStyle}' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'http://$$CompanyURL$$/images/mailer-linkeden.jpg'  style = '${iconStyle}'></a>

<a href = '${p}' style = 'color:#cb2027; ${iconStyle}' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'http://$$CompanyURL$$/images/mailer-pintrest.png'  style = '${iconStyle} '></a>`;
}

async function SendRejectionEmail(ToEmail, Username, Text, DID = 8) {
  let send = 0;
  try {
    let companyurl = '', companyname = '', companysupportemail = '';
    const emailAuth = await db.proc(DB, 'USP_GET_EMAILAUTHENTICATION', { DID });
    for (const item of emailAuth) {
      companyurl = item.companyurl;
      companyname = item.companyname;
      companysupportemail = item.companysupportemailid;
    }
    const subject = `${CompanySettings.CompanyName} Support Center`;
    const Date_ = todayDMY();
    if (send === 0) {
      let mailtxt = mailShell(
        `<p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> Sorry! . </p>
<p  style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'>This email is to confirm that Your KYC has been Rejected. Please submit it again. </p>`,
        socialLinks('https://www.facebook.com/EblaaServices/', 'https://twitter.com/EblaaServices', 'https://plus.google.com/+EblaaIn', 'https://www.linkedin.com/company/eblaa/', 'https://in.pinterest.com/EblaaServices/'),
        'We will');
      mailtxt = rep(mailtxt, '$$lblname$$', Username);
      mailtxt = rep(mailtxt, '$$datetime$$', Date_);
      mailtxt = rep(mailtxt, '$$lblmessage$$', Text);
      mailtxt = rep(mailtxt, '$$CompanyName$$', companyname);
      mailtxt = rep(mailtxt, '$$CompanySupportEmailID$$', companysupportemail);
      mailtxt = rep(mailtxt, '$$CompanyURL$$', companyurl);
      mailtxt = rep(mailtxt, '$$CompanyDomain$$', companyurl);
      const result = await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
      if (result === 's') send = 1; else return;
    }
  } catch (exp) {
    console.error(exp.message); // ViewBag.Message = exp.Message
  }
}

async function SendConfirmationEmail(ToEmail, Username, Text) {
  let send = 0;
  try {
    const subject = `${CompanySettings.CompanyName} Support Center`;
    const Date_ = todayDMY();
    if (send === 0) {
      let mailtxt = mailShell(
        `<p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> Congratulations! . </p>
<p  style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'>This email is to confirm that Your KYC has been completed successfully.  Now you are a verified user of $$CompanyName$$. </p>`,
        socialLinks('javascript:void(0)', 'javascript:void(0)', 'javascript:void(0)', 'javascript:void(0)', 'javascript:void(0)'),
        'we will');
      mailtxt = rep(mailtxt, '$$lblname$$', Username);
      mailtxt = rep(mailtxt, '$$datetime$$', Date_);
      mailtxt = rep(mailtxt, '$$lblmessage$$', Text);
      mailtxt = rep(mailtxt, '$$CompanyName$$', CompanySettings.CompanyName);
      mailtxt = rep(mailtxt, '$$CompanySupportEmailID$$', CompanySettings.CompanySupportEmailId);
      mailtxt = rep(mailtxt, '$$CompanyURL$$', CompanySettings.CompanyURL);
      mailtxt = rep(mailtxt, '$$CompanyDomain$$', CompanySettings.CompanyDomain);
      const result = await SendMail.Send1('', ToEmail, '', '', subject, mailtxt);
      if (result === 's') send = 1; else return;
    }
  } catch (exp) {
    console.error(exp.message);
  }
}

async function getPortalLogin(plid) {
  return db.queryOne(DB, 'SELECT phone, emailid FROM portal_login WHERE plid=@plid LIMIT 1', { plid });
}

async function pendingKycRows(p, page) {
  const MaxRows = await UtilityClass.GridPageSize();
  return db.proc(DB, 'Usp_PendingKyc', {
    STARTROWINDEX: page,
    MAXROWS: MaxRows,
    NAME: p.UserName,
    MOBILE: p.Mobile,
    EMAIL: p.EmailID,
    FREEORPAID: -1,
    FROMDATE: p.RejApprfromDate,
    TODATE: p.RejApprtoDate,
    SUBMITTEDFROMDATE: p.SubmittedfromDate,
    SUBMITTEDTODATE: p.SubmittedtoDate,
    ORDERBY: p.ORDERBY,
    IsFirstTimeOrAfterRejectionParam: parseInt(p.SelectType, 10),
    LASTUPDATEDDATEBYUSERFROMDATE: p.fromDate,
    LASTUPDATEDDATEBYUSERTODATE: p.toDate,
    PROFILESTATUSParam: p.Status,
    KYCSTATUSParam: p.KYCStatus,
    MODE: p.mode,
    INDEX: 0,
    REGNUM: 0,
    BUSINESSKYCSTATUS: '-1',
  });
}

function normaliseParams(q) {
  const v = (x, d) => (x === undefined || x === null ? d : x);
  return {
    UserName: v(q.UserName, ''),
    btnexel: q.btnexel,
    EmailID: v(q.EmailID, ''),
    Mobile: v(q.Mobile, ''),
    ORDERBY: v(q.ORDERBY, 'desc'),
    KYCStatus: v(q.KYCStatus, '2'),
    UserType: v(q.UserType, '-1'),
    Status: v(q.Status, ''),
    SelectType: v(q.SelectType, '0'),
    SubmittedfromDate: v(q.SubmittedfromDate, ''),
    SubmittedtoDate: v(q.SubmittedtoDate, ''),
    RejApprfromDate: v(q.RejApprfromDate, ''),
    RejApprtoDate: v(q.RejApprtoDate, ''),
    fromDate: v(q.fromDate, ''),
    toDate: v(q.toDate, ''),
    mode: q.mode === undefined || q.mode === null || q.mode === '' ? 2 : parseInt(q.mode, 10),
    page: q.page === undefined || q.page === null || q.page === '' ? 1 : parseInt(q.page, 10),
  };
}

// Returns { sent:true } after streaming the .xls, or { message } when there is nothing to export
async function exportReport(res, p) {
  try {
    const rows = mapRows(await pendingKycRows(p, p.page), BUSSINESSKYC_PROPS);
    if (rows.length > 0) {
      let out = '';
      out += 'S.No. \t';
      out += 'Business name \t';
      out += 'Mobile \t';
      out += 'Email Id \t';
      out += 'Request date \t';
      out += 'Entity type \t';
      out += 'Kyc \t';
      for (const item of rows) {
        out += '\n';
        out += `${safeStr(item.ROWNUMBER)} \t`;
        out += `${safeStr(item.Businessname)} \t`;
        out += `${safeStr(item.MOBILE)} \t`;
        out += `${safeStr(item.EMAILID)} \t`;
        out += `${safeStr(item.LASTUPDATEDDATEBYUSER)} \t`;
        out += `${safeStr(item.Entitype)} \t`;
        out += `${safeStr(item.KYCSTATUS)} \t`;
      }
      // PORT-NOTE: legacy wrote /AllExcelSheets/businesskyc.xls and redirected to it; the same content is streamed as a download.
      res.setHeader('Content-Type', 'application/force-download');
      res.setHeader('Content-Disposition', 'attachment; filename=businesskyc.xls');
      res.send(out);
      return { sent: true };
    }
    return { message: 'There is no record in excel' };
  } catch (e) {
    return { filepath: e.message };
  }
}

// auth
router.all('/franchise/businesskyc/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const p = normaliseParams({ ...req.query, ...(req.body || {}), ...req.p });
  const DID = req.user.did;
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await db.proc(DB, 'USP_GET_INCOMPLETE_KYC', {
    STARTROWINDEX: p.page,
    MAXROWS: MaxRows,
    NAME: p.UserName,
    MOBILE: p.Mobile,
    EMAIL: p.EmailID,
    FROMDATE: p.RejApprfromDate,
    TODATE: p.RejApprtoDate,
  });
  const Bussineskyc = mapRows(rows, BUSSINESSKYC_PROPS);
  const TotalRecord = recordCount(rows);
  const ViewBag = {
    QUALIFICATIONlis: '',
    CurrentPage: p.page,
    GridPageSize: MaxRows,
    TotalRecord,
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    SearchField: '',
    SearchValue: '',
    fromDate: p.fromDate,
    toDate: p.toDate,
    SubmittedfromDate: p.RejApprfromDate,
    SubmittedtoDate: p.RejApprtoDate,
    ORDERBY: p.ORDERBY,
    Mobile: p.Mobile,
    EmailID: p.EmailID,
    UserName: p.UserName,
    KYCStatus: p.KYCStatus,
  };
  if (p.btnexel === 'Export Excel') {
    const r = await exportReport(res, p);
    if (r.sent) return undefined;
    if (r.message) ViewBag.Message = r.message;
    if (r.filepath) ViewBag.filepath = r.filepath;
  }
  return res.json({ Model: Bussineskyc, DID, ...ViewBag });
}));

// auth
router.all('/franchise/businesskyc/GetKycdetails{/:id}', auth, asyncHandler(async (req, res) => {
  const plid = parseInt(req.p.plid, 10);
  const mode = parseInt(req.p.mode, 10);
  const rows = await db.proc(DB, 'USP_GETKYCDETAILS', { mode, Plid: plid });
  res.json(mapRows(rows, BUSINESSDATA_PROPS));
}));

// auth
router.all('/franchise/businesskyc/GetBankdetails{/:id}', auth, asyncHandler(async (req, res) => {
  const plid = parseInt(req.p.plid, 10);
  const mode = parseInt(req.p.mode, 10);
  const Bankdetails = mapRows(await db.proc(DB, 'USP_GETKYCDETAILS', { mode, Plid: plid }), BANKDETAILS_PROPS);
  const busineskyc = mapRows(await db.query(DB,
    "Select to_char(DOI,'MM-DD-YYYY') As DOI,PANNO,EntityType,coalesce(Type,'') as Type From Tbl_BusinessKycDetails Where Active=1 and PLID=@plid", { plid }), BUSINESSKYCDETAILS_PROPS);
  if (busineskyc.length > 0) {
    sessionStore.set(req, 'EnityType', busineskyc[0].EntityType); // TempData["EnityType"]
  }
  res.json({ Bankdetails, busineskyc });
}));

// auth
router.all('/franchise/businesskyc/UpdateKyc{/:id}', auth, asyncHandler(async (req, res) => {
  const plid = parseInt(req.p.plid, 10);
  const Remark = req.p.Remark;
  const Id = parseInt(req.p.Id, 10);
  const Kycmode = parseInt(req.p.Kycmode, 10);
  let businessdata = 0, merchantkyc = 0;
  const mode = 1;
  const isapprove = Kycmode === 1 ? 1 : 3;

  await db.proc(DB, 'USP_KYC_APPROVAL_HISTORY', { MODE: mode, ID: Id, PLID: plid, REMARK: Remark, ISAPPROVE: isapprove });
  if (Kycmode === 1) {
    await db.exec(DB, 'update kyc set IsAprove=1,CommentOrRemark=@Remark where Regno=@plid and Id=@Id', { Remark, plid, Id });
    businessdata = 1;
  } else {
    await db.exec(DB, 'update kyc set IsAprove=3,CommentOrRemark=@Remark where Regno=@plid and Id=@Id', { Remark, plid, Id });
    businessdata = 2;
    await db.exec(DB, 'update portal_login set iskycapproved=2 where plid=@plid', { plid });
    let phone = '', emailid2 = '';
    const username2 = '';
    const row1 = await getPortalLogin(plid);
    if (row1) { phone = row1.phone; emailid2 = row1.emailid; }
    await SendRejectionEmail(emailid2, username2, 'Business KYC Rejected.');
    bg(() => UtilityClass.SendMsgOnMobile(phone, `Dear Sir/ Ma’am \r\n Sorry!\r\n Your Business KYC has been rejected. Please submit it again.\r\n ${CompanySettings.CompanyName} Team`));
  }
  let emailid = '', mobile = '';
  const username = '';
  const row = await getPortalLogin(plid);
  merchantkyc = await UtilityClass.updatemerchantkyc(plid);
  if (row) { emailid = row.emailid; mobile = row.phone; }
  if (merchantkyc === 1) {
    await SendConfirmationEmail(emailid, username, 'Business KYC Approved.');
    bg(() => UtilityClass.SendMsgOnMobile(mobile, `Dear Sir/ Ma’am \r\n Congratulations!\r\n Your KYC has been completed successfully.Now you are a verified user of ${CompanySettings.CompanyName}.\r\n ${CompanySettings.CompanyName} Team`));
  }
  res.json(businessdata);
}));

// auth
router.all('/franchise/businesskyc/UpdateBank{/:id}', auth, asyncHandler(async (req, res) => {
  const plid = parseInt(req.p.plid, 10);
  const Remark = req.p.Remark;
  const Kycmode = parseInt(req.p.Kycmode, 10);
  let businessdata = 0, merchantkyc = 0;
  const mode = 2, Id = 0;
  const isapprove = Kycmode === 1 ? 1 : 3;

  await db.proc(DB, 'USP_KYC_APPROVAL_HISTORY', { MODE: mode, ID: Id, PLID: plid, REMARK: Remark, ISAPPROVE: isapprove });
  if (Kycmode === 1) {
    await db.exec(DB, 'update BANK_ACCOUNTS_MERCHANT set IsAprove=1,CommentorRemark=@Remark where PLID=@plid and ACTIVE=1', { Remark, plid });
    businessdata = 1;
  } else {
    await db.exec(DB, 'update BANK_ACCOUNTS_MERCHANT set IsAprove=3,CommentorRemark=@Remark where PLID=@plid and ACTIVE=1', { Remark, plid });
    businessdata = 2;
    await db.exec(DB, 'update portal_login set iskycapproved=2 where plid=@plid', { plid });
    let phone1 = '', emailid1 = '';
    const username1 = '';
    const row2 = await getPortalLogin(plid);
    if (row2) { emailid1 = row2.emailid; phone1 = row2.phone; }
    await SendRejectionEmail(emailid1, username1, 'Business KYC Rejected.');
    bg(() => UtilityClass.SendMsgOnMobile(phone1, `Dear Sir/ Ma’am \r\n Sorry!\r\n Your Business KYC has been Rejected .Please submit it again .\r\n ${CompanySettings.CompanyName} Team`));
  }
  let emailid = '', mobile = '';
  const username = '';
  const row = await getPortalLogin(plid);
  merchantkyc = await UtilityClass.updatemerchantkyc(plid);
  if (merchantkyc === 1) {
    if (row) { emailid = row.emailid; mobile = row.phone; }
    await SendConfirmationEmail(emailid, username, 'Business KYC Completed.');
    bg(() => UtilityClass.SendMsgOnMobile(mobile, `Dear Sir/ Ma’am \r\n Congratulations!\r\n Your KYC has been completed successfully.Now you are a verified user of ${CompanySettings.CompanyName}.\r\n ${CompanySettings.CompanyName} Team`));
  }
  res.json(businessdata);
}));

// auth
router.all('/franchise/businesskyc/ExportReport{/:id}', auth, asyncHandler(async (req, res) => {
  const p = normaliseParams({ ...req.query, ...(req.body || {}), ...req.p });
  const r = await exportReport(res, p);
  if (r.sent) return undefined;
  return res.json({ ...(r.message ? { Message: r.message } : {}), ...(r.filepath ? { filepath: r.filepath } : {}) });
}));

module.exports = router;
