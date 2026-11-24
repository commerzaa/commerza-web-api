'use strict';
/** Ported from Franchise\Controllers\CustomerPanel\approvedmerchant.cs (approvedmerchantController) */
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const { query, queryOne, exec, proc } = require('../../db');
const { mapRows, mapRow } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');
const CompanySettings = require('../../lib/franchise/CompanySettings');
const SendMail = require('../../lib/franchise/SendMail');

const router = express.Router();
const P = '/franchise/approvedmerchant';

const MERCHANT_PROPS = ['ROWNUMBER', 'PLID', 'LOGINID', 'DOC', 'PASSWORD', 'USERNAME', 'MEMBERNAME', 'IPADDRESS', 'EMAILID', 'PHONE',
  'iskycapproved', 'PMID', 'Sourcejoing', 'Sourceid', 'Active', 'status', 'IPAddressHistry', 'DateHistry', 'Name', 'ADDRESS'];

const nz = (v, d) => (v === undefined || v === null ? d : v);
const outInt = (rows, name) => {
  const r = (rows && rows[0]) || {};
  const v = r[name.toLowerCase()];
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? 0 : n;
};
const fire = (fn) => { Promise.resolve().then(fn).catch((e) => console.error(e)); }; // background SMS thread

function listArgs(a) {
  return {
    startrowindex: a.page, maxrows: a.MaxRows, orderbyfield: a.orderByField, asc: a.asc, searchfield: a.SearchField,
    searchvalue: a.SearchValue, cid: '', ctid: a.ddlCity, catid: '', keyid: '', fromdate: a.fromDate, todate: a.toDate,
    type: a.Type, isverified: a.ddlvarified, mode: 1, prop: a.ddlpro, pmfromdate: a.txtlistingfromdate,
    pmtodate: a.txtlistingtodate, status: a.ddlsearchbystatus,
  };
}

function normalise(p) {
  const a = {};
  a.btnexel = p.btnexel;
  a.ddlsearchbystatus = nz(p.ddlsearchbystatus, 'APPROVE');
  a.txtlistingtodate = nz(p.txtlistingtodate, '');
  a.txtlistingfromdate = nz(p.txtlistingfromdate, '');
  a.ddlpro = nz(p.ddlpro, '0');
  a.ddlvarified = nz(p.ddlvarified, '');
  a.Type = nz(p.Type, 'APPROVE');
  a.ddlCity = nz(p.ddlCity, '');
  a.SearchField = nz(p.SearchField, '');
  a.SearchValue = nz(p.SearchValue, '');
  a.fromDate = nz(p.fromDate, '');
  a.toDate = nz(p.toDate, '');
  a.asc = nz(p.asc, '1');
  a.mode = nz(p.mode, 0);
  a.orderByField = nz(p.orderByField, 'ID');
  if (a.ddlpro === '') a.ddlpro = '0';
  a.CID = nz(p.CID, '');
  a.page = p.page === undefined || p.page === null || p.page === '' ? 1 : parseInt(p.page, 10);
  return a;
}

// auth
router.all(`${P}/Index{/:id}`, auth, asyncHandler(async (req, res) => {
  const a = normalise(req.p);
  const DID = req.user.did;
  a.MaxRows = UtilityClass.GridPageSize();
  const rows = await proc('shopping', 'USP_get_merchant_list', listArgs(a));
  const addfreeList = mapRows(rows, MERCHANT_PROPS);
  const TotalRecord = outInt(rows, 'intresult');
  const TOTALUNIQUE = outInt(rows, 'totalunique');
  const TOTALITEM = outInt(rows, 'totalitem');
  const NoPerPage = UtilityClass.GridNumbersPerPage();

  if (a.btnexel === 'Export Excel') {
    const sent = await exportReport(a, res);
    if (sent) return;
  }
  res.json({
    Model: addfreeList,
    QUALIFICATIONlis: '',
    CurrentPage: a.page,
    GridPageSize: a.MaxRows,
    TotalRecord,
    NoPerPage,
    SearchField: a.SearchField,
    SearchValue: a.SearchValue,
    fromDate: a.fromDate,
    toDate: a.toDate,
    ORDERBY: '',
    TOTALUNIQUE,
    TOTALITEM,
    DID,
  });
}));

// auth
router.all(`${P}/GetKycdetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const { plid, mode } = req.p;
  const rows = await proc('shopping', 'USP_GETKYCDETAILS', { mode: parseInt(mode, 10), plid: parseInt(plid, 10) });
  res.json(rows);
}));

// auth
router.all(`${P}/GetBankdetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const { plid, mode } = req.p;
  const Bankdetails = await proc('shopping', 'USP_GETKYCDETAILS', { mode: parseInt(mode, 10), plid: parseInt(plid, 10) });
  const kyc = await query('shopping',
    "Select to_char(DOI,'MM-DD-YYYY') As DOI,PANNO,EntityType,coalesce(Type,'') as Type From Tbl_BusinessKycDetails Where Active=1 and PLID=@plid",
    { plid: parseInt(plid, 10) });
  const busineskyc = mapRows(kyc, ['DOI', 'PANNO', 'EntityType', 'Type']);
  const out = { Bankdetails, busineskyc };
  if (busineskyc.length > 0) out.TempData = { EnityType: busineskyc[0].EntityType }; // TempData["EnityType"]
  res.json(out);
}));

async function sendConfirmationEmail(ToEmail, Username, Text) {
  let send = 0;
  try {
    const subject = `${CompanySettings.CompanyName} Support Center`;
    const date = (() => { const d = new Date(); const z = (n) => String(n).padStart(2, '0'); return `${z(d.getDate())}-${z(d.getMonth() + 1)}-${d.getFullYear()}`; })();
    if (send === 0) {
      let mailtxt = `<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px; padding-bottom:10px;'>
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
<p style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> Congratulations! . </p>
<p  style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'>This email is to confirm that Your KYC has been completed successfully.  Now you are a verified user of $$CompanyName$$. </p>
</div>
<div style='clear: both'></div>
<div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>
<h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>
<p style = 'font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'> For more information, approach us at anytime.  
we will be happy to help you. You can contact us on <a href = 'mailto:$$CompanySupportEmailID$$' target = '_blank' style = 'color:#00a0a8;'> $$CompanySupportEmailID$$ </a></p>
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
<a href = 'javascript:void(0)' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = 'http://$$CompanyURL$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

<a href = 'javascript:void(0)' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = 'http://$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

<a href = 'javascript:void(0)' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = 'http://$$CompanyURL$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>

<a href = 'javascript:void(0)' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = 'http://$$CompanyURL$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>

<a href = 'javascript:void(0)' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = 'http://$$CompanyURL$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>
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
      const rep = (k, v) => { mailtxt = mailtxt.split(k).join(v == null ? '' : v); };
      rep('$$lblname$$', Username);
      rep('$$datetime$$', date);
      rep('$$lblmessage$$', Text);
      rep('$$CompanyName$$', CompanySettings.CompanyName);
      rep('$$CompanySupportEmailID$$', CompanySettings.CompanySupportEmailId);
      rep('$$CompanyURL$$', CompanySettings.CompanyURL);
      rep('$$CompanyDomain$$', CompanySettings.CompanyDomain);
      const result = await SendMail.Send('', ToEmail, '', '', subject, mailtxt);
      if (result === 's') send = 1; else return;
    }
  } catch (exp) {
    console.error(exp); // ViewBag.Message = exp.Message
  }
}

const getPortalRow = (plid) => queryOne('shopping', 'select * from portal_login where plid=@plid limit 1', { plid });

// auth
router.all(`${P}/UpdateKyc{/:id}`, auth, asyncHandler(async (req, res) => {
  const plid = parseInt(req.p.plid, 10);
  const Remark = req.p.Remark;
  const Id = parseInt(req.p.Id, 10);
  const Kycmode = parseInt(req.p.Kycmode, 10);
  let businessdata = 0; let merchantkyc = 0; const mode = 1; let isapprove = 0;
  isapprove = Kycmode === 1 ? 1 : 3;

  await proc('shopping', 'USP_KYC_APPROVAL_HISTORY', { mode, id: Id, plid, remark: Remark, isapprove });
  if (Kycmode === 1) {
    await exec('shopping', 'update kyc set IsAprove=1,CommentOrRemark=@Remark where Regno=@plid and Id=@Id', { Remark, plid, Id });
    businessdata = 1;
  } else {
    await exec('shopping', 'update kyc set IsAprove=3,CommentOrRemark=@Remark where Regno=@plid and Id=@Id', { Remark, plid, Id });
    await exec('shopping', 'update portal_login set iskycapproved=2 where plid=@plid', { plid });
    businessdata = 2;
    let phone = '';
    const row1 = await getPortalRow(plid);
    if (row1) phone = row1.phone;
    fire(() => UtilityClass.SendMsgOnMobile(phone, `Dear Sir/ Ma’am \r\n Sorry!\r\n Your Business KYC has been rejected .Please submit it again .\r\n ${CompanySettings.CompanyName} Team`));
  }
  let emailid = ''; let mobile = ''; const username = '';
  const row = await getPortalRow(plid);
  merchantkyc = await UtilityClass.updatemerchantkyc(plid);
  if (row) { emailid = row.emailid; mobile = row.phone; }
  if (merchantkyc === 1) {
    await sendConfirmationEmail(emailid, username, 'Business KYC Approved.');
    fire(() => UtilityClass.SendMsgOnMobile(mobile, `Dear Sir/ Ma’am \r\n Congratulations!\r\n Your KYC has been completed successfully.Now you are a verified user of ${CompanySettings.CompanyName}.\r\n ${CompanySettings.CompanyName} Team`));
  }
  res.json(businessdata);
}));

// auth
router.all(`${P}/UpdateBank{/:id}`, auth, asyncHandler(async (req, res) => {
  const plid = parseInt(req.p.plid, 10);
  const Remark = req.p.Remark;
  const Kycmode = parseInt(req.p.Kycmode, 10);
  let businessdata = 0; let merchantkyc = 0; const mode = 2; let isapprove = 0; const Id = 0;
  isapprove = Kycmode === 1 ? 1 : 3;

  await proc('shopping', 'USP_KYC_APPROVAL_HISTORY', { mode, id: Id, plid, remark: Remark, isapprove });
  if (Kycmode === 1) {
    await exec('shopping', 'update BANK_ACCOUNTS_MERCHANT set IsAprove=1,CommentorRemark=@Remark where PLID=@plid and ACTIVE=1', { Remark, plid });
    businessdata = 1;
  } else {
    await exec('shopping', 'update BANK_ACCOUNTS_MERCHANT set IsAprove=3,CommentorRemark=@Remark where PLID=@plid and ACTIVE=1', { Remark, plid });
    await exec('shopping', 'update portal_login set iskycapproved=2 where plid=@plid', { plid });
    businessdata = 2;
    let phone1 = '';
    const row2 = await getPortalRow(plid);
    if (row2) phone1 = row2.phone;
    fire(() => UtilityClass.SendMsgOnMobile(phone1, `Dear Sir/ Ma’am \r\n Sorry!\r\n Your Business KYC has been Rejected .Please submit it again .\r\n ${CompanySettings.CompanyName} Team`));
  }
  let emailid = ''; let mobile = ''; const username = '';
  const row = await getPortalRow(plid);
  merchantkyc = await UtilityClass.updatemerchantkyc(plid);
  if (merchantkyc === 1) {
    if (row) { emailid = row.emailid; mobile = row.phone; }
    await sendConfirmationEmail(emailid, username, 'Business KYC Completed.');
    fire(() => UtilityClass.SendMsgOnMobile(mobile, `Dear Sir/ Ma’m \r\n Congratulations!\r\n Your KYC has been completed successfully.Now you are a verified user of ${CompanySettings.CompanyName}.\r\n ${CompanySettings.CompanyName} Team`));
  }
  res.json(businessdata);
}));

const spFirst = async (sp, pmid, props) => {
  const rows = await proc('shopping', sp, { pmid });
  return mapRow(rows[0] || null, props);
};

// auth
router.all(`${P}/showdetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await proc('shopping', 'ups_getsubscriptiondetails', { pmid: req.p.pmid });
  res.json(rows[0] || null); // ListingDetails (columns as returned)
}));

// auth
router.all(`${P}/setstatus{/:id}`, auth, asyncHandler(async (req, res) => {
  let ret = '';
  const rows = await proc('shopping', 'usp_updatestatusoflisting', { pmid: req.p.pmid });
  const result = outInt(rows, 'result');
  if (result === 1) ret = 'This listing Blocked successfully.';
  else if (result === 2) ret = 'This listing Activated successfully.';
  else ret = 'Some error occured.';
  res.json(ret);
}));

// auth
router.all(`${P}/verify{/:id}`, auth, asyncHandler(async (req, res) => {
  let ret = '';
  const rows = await proc('shopping', 'usp_varifyListing_Admin', { pmid: req.p.pmid });
  const result = outInt(rows, 'strresult');
  if (result === 1) ret = 'Listing Successfully Verified and Email sent.';
  else ret = 'Some error occured.';
  res.json(ret);
}));

// auth
router.all(`${P}/GetListingDetails{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await proc('shopping', 'UPS_GETLISTINGDETAILS', { pmid: req.p.pmid });
  res.json(rows[0] || null);
}));

// auth
router.all(`${P}/photo{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(await spFirst('usp_showProductallimage', req.p.pmid, ['image']));
}));

// auth
router.all(`${P}/VideoData{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(await spFirst('USP_SHOWPRODUCTALLVIDEO', req.p.pmid, ['VIDEOURL']));
}));

// auth
router.all(`${P}/BindWorkingHours{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(await spFirst('USP_BindWorkingHours', req.p.pmid, ['ID', 'DAYID', 'STATUS', 'OPENINGTIME', 'BREAKTIME', 'CLOSINGTIME', 'OFFICEDAY']));
}));

// auth
router.all(`${P}/BindServicesHighlights{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(await spFirst('USP_ServicesHighlights', req.p.pmid, ['PPID', 'PRODUCTNAME']));
}));

// auth
router.all(`${P}/BindPaymentMethod{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(await spFirst('USP_PaymentMethod', req.p.pmid, ['PTMID', 'PAYMENTMATHOD', 'PAYMENTLOGO', 'MATHODCODE']));
}));

// auth
router.all(`${P}/BindLocationInformation{/:id}`, auth, asyncHandler(async (req, res) => {
  res.json(await spFirst('USP_LocationInfo', req.p.pmid, ['AREANAME', 'CITYNAME', 'LONGITUDE', 'LATITUDE', 'DISCRIPTION']));
}));

// auth
router.all(`${P}/UpdateActive{/:id}`, auth, asyncHandler(async (req, res) => {
  const PLID = req.p.PLID;
  await exec('shopping', 'UPDATE PORTAL_LOGIN SET STATUS=3  WHERE PLID=@PLID', { PLID });
  await proc('shopping', 'USP_UPDATE_PRODUCTCOUNT_INACTIVE', { plid: PLID });
  res.json('OK');
}));

// auth
router.all(`${P}/GetName{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await query('shopping', 'select COMPANYNAME as MemberName from PORTAL_MASTER where PLID=@id', { id: req.p.editSPRID });
  res.json(mapRows(rows, MERCHANT_PROPS)); // getmerchantlist (only MemberName populated)
}));

// auth
router.all(`${P}/GetIPaddress{/:id}`, auth, asyncHandler(async (req, res) => {
  const rows = await query('shopping',
    "select IPAddress,to_char(date,'Mon DD YYYY HH12:MI:SS:MSAM') as date from tbl_LoginHistory where PLID=@id", { id: req.p.editSPRID });
  res.json(mapRows(rows, ['LHID', 'Plid', 'date', 'IPAddress', 'status']));
}));

// ExportReport (public void in C#, also reachable as an action) - returns true when a file was sent
async function exportReport(a, res) {
  const MaxRows = await UtilityClass.GridPageSize();
  const rows = await proc('shopping', 'USP_get_merchant_list', listArgs({ ...a, MaxRows }));
  const addfreeList = mapRows(rows, MERCHANT_PROPS);
  if (addfreeList.length === 0) return false; // ViewBag.Message = "There is no record in excel"
  const tab = (v) => String(v == null ? '' : v).replace(/\t/g, '    ') + ' \t';
  let out = '';
  out += 'S.No. \t';
  out += 'Name \t';
  out += 'Merchant Code \t';
  out += 'Mobile \t';
  out += 'Email Id \t';
  out += 'Registration date \t';
  out += 'Active Product \t';
  out += 'Total Item \t';
  for (const item of addfreeList) {
    out += '\n';
    out += tab(item.ROWNUMBER);
    out += tab(item.MEMBERNAME);
    out += 'EM' + tab(item.LOGINID);
    out += tab(item.PHONE);
    out += tab(item.EMAILID);
    out += tab(item.DOC);
    const Totalactiveproduct = await require('../../db').scalar('shopping',
      'select count(1) from IMS_SUBPRODUCT SM LEFT JOIN IMS_MASTERPRODUCT PM ON SM.MPRID=PM.MPRID LEFT JOIN PORTAL_LOGIN PL ON PL.PLID= PM.BranchId where SM.ISVERIFIED=1 AND PL.LOGINID=@l', { l: item.LOGINID });
    const cr = await proc('shopping', 'USP_COUNT_PRODUCT', { merchant: item.LOGINID });
    out += tab(outInt(cr, 'data'));
    out += tab(Totalactiveproduct || 0);
  }
  const dir = path.join(config.uploadDir || path.join(process.cwd(), 'uploads'), 'AllExcelSheets');
  fs.mkdirSync(dir, { recursive: true });
  const filepath = path.join(dir, 'approvedmerchant.xls');
  fs.writeFileSync(filepath, out);
  res.setHeader('Content-Type', 'application/force-download');
  res.setHeader('Content-Disposition', 'attachment; filename=approvedmerchant.xls');
  res.send(out);
  return true;
}

// auth
router.all(`${P}/ExportReport{/:id}`, auth, asyncHandler(async (req, res) => {
  const a = normalise(req.p);
  const sent = await exportReport(a, res);
  if (!sent) res.json({ Message: 'There is no record in excel' });
}));

// route-config: none for this controller
module.exports = router;
