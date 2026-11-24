'use strict';
// Ported from Merchant Panel/Controllers/CustomerPanel/AgreementController.cs  (DB: shopping - Db_Shopping)
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { query, queryOne, scalar, proc, procOne } = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const CompanySettings = require('../../lib/merchant/CompanySettings');
const SendMail = require('../../lib/merchant/SendMail');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const guard = [auth, requireType('merchant')];
const BASE = '/merchant/Agreement';
const AGREEMENTDETAILS = ['rownumber', 'regno', 'Name', 'fathername', 'address', 'packageamount', 'clickamount', 'upgradedate', 'selectvalues', 'maxamount', 'uploadimage', 'remark', 'status'];
const AGREEMENTLIST = ['rownumber', 'AGID', 'regno', 'username', 'Name', 'mobileno', 'fathername', 'address', 'packageamount', 'clickamount', 'senddate', 'selectvalues', 'status', 'coname', 'trackno', 'sendvia', 'printdate'];
const str = (v) => (v === null || v === undefined ? '' : String(v));
function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k !== undefined ? row[k] : null;
}
const outStr = (row, name) => { // spOutput.Value.ToString() (null => NullReferenceException)
  const v = outVal(row, name);
  if (v === null || v === undefined) throw new TypeError('Object reference not set to an instance of an object.');
  return String(v);
};

// "../Folder" style AppSettings path (MapPath) -> directory under config.uploadDir
const mapPath = (p) => path.join(config.uploadDir, String(p || '').replace(/^(~|\.\.)?[\\/]+/, ''));
const rand6 = () => String(Math.floor(100000 + Math.random() * 900000));

// public string SaveImageNmaeCurrent(int pdfimg, string getimagebytecode, string imgname, string strValidFullName, string documents_Exten)
// Converts the uploaded image into an A4 PDF (iTextSharp Document + Image.ScaleAbsolute(500f,700.25f)).
async function SaveImageNmaeCurrent(user, pdfimg, getimagebytecode, imgname, strValidFullName, documents_Exten) {
  if (getimagebytecode.includes('base64,')) {
    const Plid = user.plid;
    const File0 = rand6().trim();
    const File = File0.replace(/&amp;/g, 'And').replace(/&/g, ' And ').replace(/[^\w\d]/g, '').replace(/ /g, '-');
    imgname = path.basename(imgname, path.extname(imgname));
    imgname = imgname.replace(/[^0-9a-zA-Z]+/g, '') + '-' + File + '-' + Plid + '.' + 'pdf';
    strValidFullName = strValidFullName + '/' + imgname;
    const b = Buffer.from(getimagebytecode.substring(getimagebytecode.indexOf(',') + 1), 'base64');
    // PORT-NOTE: iTextSharp replaced by the npm package "pdfkit" (not installed; required lazily). A4, margins 50/50/40/40, image 500 x 700.25.
    const PDFDocument = require('pdfkit');
    fs.mkdirSync(path.dirname(strValidFullName), { recursive: true });
    await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A4', margins: { left: 50, right: 50, top: 40, bottom: 40 } });
      const ws = fs.createWriteStream(strValidFullName);
      ws.on('finish', resolve);
      ws.on('error', reject);
      doc.on('error', reject);
      doc.pipe(ws);
      try { doc.image(b, { width: 500, height: 700.25 }); } catch (e) { doc.end(); return reject(e); }
      doc.end();
    });
  }
  return path.basename(strValidFullName);
}

// public string savefile(string filename, string documents_Exten, string documents, string art_doucment)
async function savefile(user, filename, documents_Exten, documents, art_doucment) {
  if (filename == null) filename = '';
  if (documents_Exten == null) documents_Exten = '';
  if (art_doucment == null) art_doucment = '';
  if (documents == null) documents = '';
  let strValidFullName = '';
  if (documents.trim() !== '') {
    if (art_doucment.includes('base64,')) {
      strValidFullName = mapPath(config.app.AggrementImages);
      documents = await SaveImageNmaeCurrent(user, 0, art_doucment, documents, strValidFullName, documents_Exten);
    }
  }
  if (documents.trim() !== '') documents = path.basename(documents);
  return documents;
}

// protected void SendConfirmationEmailAggrement(string ToEmail, string Username, string Text, string attachment) - not an action
async function SendConfirmationEmailAggrement(ToEmail, Username, Text, attachment) {
  let send = 0;
  try {
    const subject = '' + CompanySettings.CompanyName + ' Support Center';
    let mailtxt = '';
    const d = new Date();
    const Date_ = String(d.getDate()).padStart(2, '0') + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + d.getFullYear();
    if (send === 0) {
      mailtxt = `
<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px; padding-bottom:10px;'>
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
<p  style='font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: Arial, Helvetica, sans-serif;  color: #000'>We have received your agreement. It is in consideration with our concerned team. Further notification will be send, when our team takes any action
We have even attached your agreement copy, uploaded by you.
</p>
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
<a href = '$$FacebookShare$$' style = 'color:#3b5998; border: none; text-decoration:none; text-decoration:none; border:0; outline:none; ' target = '8SE_b89lng5GVbx5a7NZME9'> <img src = '$$CompanyURL$$/images/mailer-facebook.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>
           
<a href = '$$TwitterShare$$' style = 'color:#55acee; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'e3PP7S0O2rDcb5kT5Qxvkl9'> <img src = '$$CompanyURL$$/images/mailer-twitter.png' style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>
           
<a href = '$$GoogleplusShare$$' style = 'color:#dd4b39; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'k_lu77WHdSxxe84MTtrgPlD'> <img src = '$$CompanyURL$$/images/mailer-gplus.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'> </a>
          
<a href = '$$LinkedinShare$$' style = 'color: #0072a4; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = '1QtmtsX-zlkY3NH-RX8bXJB'> <img src = '$$CompanyURL$$/images/mailer-linkeden.jpg'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;'></a>
           
<a href = '$$PinterestShare$$' style = 'color:#cb2027; border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none;' target = 'FTivBEnhJ2wIlo_i9yYL1Xk'> <img src = '$$CompanyURL$$/images/mailer-pintrest.png'  style = 'border: none; text-decoration: none; text-decoration:none; text-decoration:none; border:0; outline:none; '></a>
</div>
</td>
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
<p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>© 2018-2019 All Rights Reserved | $$CompanyURL$$</p>
</div>`;
      const rep = (k, v) => { mailtxt = mailtxt.split(k).join(str(v)); };
      rep('$$lblname$$', Username);
      rep('$$datetime$$', Date_);
      rep('$$lblmessage$$', Text);
      rep('$$CompanyName$$', CompanySettings.CompanyName);
      rep('$$CompanySupportEmailID$$', CompanySettings.CompanySupportEmailId);
      rep('$$CompanyURL$$', CompanySettings.CompanyURL);
      rep('$$CompanyDomain$$', CompanySettings.CompanyDomain);
      rep('$$FacebookShare$$', CompanySettings.FacebookShare);
      rep('$$GoogleplusShare$$', CompanySettings.GoogleplusShare);
      rep('$$TwitterShare$$', CompanySettings.TwitterShare);
      rep('$$LinkedinShare$$', CompanySettings.LinkedinShare);
      rep('$$PinterestShare$$', CompanySettings.PinterestShare);
      const result = await SendMail.Sendemailwithattachment('', ToEmail, '', '', subject, mailtxt, attachment);
      if (result === 's') {
        send = 1;
      } else {
        return;
      }
    }
  } catch (exp) {
    // ViewBag.Message = exp.Message;
  }
}

// auth ; route-config: merchant/add-Agreement
router.all([`${BASE}/Index{/:id}`, BASE, '/merchant/add-Agreement'], ...guard, asyncHandler(async (req, res) => {
  const Regno = Number(req.user.plid);
  const ViewBag = {};
  ViewBag.check = Number(await scalar(DB, 'select coalesce(count(1),0) from tbl_agreement_details where regno = @regno and status != 2', { regno: String(Regno) })) || 0;
  let agreement;
  if (ViewBag.check === 0) {
    agreement = mapRows(await proc(DB, 'usp_agreementdetails', { regno: Regno, mode: '1' }), AGREEMENTDETAILS);
  } else {
    agreement = mapRows(await proc(DB, 'usp_agreementdetails', { regno: Regno, mode: 2 }), AGREEMENTDETAILS);
  }
  if (sessionStore.get(req, 'LoginwithMobile') != null) {
    ViewBag.sessionshow = 'show';
  } else {
    ViewBag.sessionshow = '';
  }
  res.json({ Model: agreement, ViewBag, ...ViewBag });
}));

// auth
router.all(`${BASE}/AddCourierDetails{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const Regno = Number(req.user.plid);
  const ViewBag = {};
  const chk = await queryOne(DB, 'select selectvalues from tbl_agreement_details where regno = @regno and status = 1 order by agid desc limit 1', { regno: String(Regno) });
  ViewBag.check = chk ? chk.selectvalues : null;
  const MaxRows = await UtilityClass.GridPageSize();
  // Usp_AgreementList @RegNo,@Mode,@StartRowIndex,@MaxRows,@Status(<-@SearchField),@mobileno(<-@SearchValue),@fromDate,@ToDate,@TotalCount out
  const rows = await proc(DB, 'usp_agreementlist', {
    regno: Regno, mode: '1', startrowindex: 1, maxrows: 1000, status: '', mobileno: '', fromdate: '', todate: '',
  });
  const BlogList = mapRows(rows, AGREEMENTLIST);
  // PORT-NOTE: @TotalCount OUT read from the 'totalcount' column of the first row
  const TotalRecord = rows.length && rows[0].totalcount != null ? parseInt(rows[0].totalcount, 10) : 0;
  ViewBag.CurrentPage = 1;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.SearchField = '';
  ViewBag.SearchValue = '';
  res.json({ Model: BlogList, ViewBag, ...ViewBag });
}));

// auth
router.all(`${BASE}/saveagreement{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const Regno = Number(req.user.plid);
  const { value, name, fathername, address } = req.p;
  const row = await procOne(DB, 'usp_add_agreemnnt', {
    selectvalues: value, updatedate: '', name, fathername, address, regno: Regno, packamt: Number(req.p.packamt), clkamt: Number(req.p.clkamt),
    mode: 1, uploadimage: '',
  });
  // @StrResult OUT => 'strresult' column
  res.json(outStr(row, 'strresult').trim());
}));

// auth
router.all(`${BASE}/updateagreement{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const Regno = Number(req.user.plid);
  const row = await procOne(DB, 'usp_update_agreemnnt', {
    sendvia: req.p.sendvia, trackno: req.p.trackno, comname: req.p.comname, regno: Regno, senddate: req.p.fromdate,
  });
  res.json(outStr(row, 'strresult').trim());
}));

// auth
router.all(`${BASE}/AggrementImages{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const p = req.p;
  let pdfname = '';
  let AllImageName = '';
  const merchanturl = config.app.CompanyMerchantURL || '';
  const Plid = Number(req.user.plid);
  // both branches (extension != "pdf" / pdf) run the same savefile call
  AllImageName = p.ImgPreviewFirst;
  pdfname = await savefile(req.user, '', p.extension, p.extentionname, AllImageName);
  AllImageName = pdfname;

  const row0 = await procOne(DB, 'usp_add_agreemnnt', {
    selectvalues: '', updatedate: '', name: '', fathername: '', address: '', regno: Plid, packamt: 0, clkamt: 0,
    mode: 2, uploadimage: AllImageName,
  });
  const Results = outStr(row0, 'strresult').trim();
  const attachment = merchanturl + '/AggrementImages/' + AllImageName;
  const row = await queryOne(DB, 'select emailid, username from portal_login where plid = @plid limit 1', { plid: Plid });
  if (row != null) {
    // new Thread(...) => fire and forget
    SendConfirmationEmailAggrement(row.emailid, row.username, Results, attachment).catch((e) => console.error(e.message));
  }
  res.json(Results);
}));

// auth - public string savefile(...) (exposed as MVC action)
router.all(`${BASE}/savefile{/:id}`, ...guard, asyncHandler(async (req, res) => {
  res.json(await savefile(req.user, req.p.filename, req.p.documents_Exten, req.p.documents, req.p.art_doucment));
}));

// auth - public string SaveImageNmaeCurrent(...) (exposed as MVC action)
router.all(`${BASE}/SaveImageNmaeCurrent{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const p = req.p;
  if (p.getimagebytecode == null) throw new TypeError('Object reference not set to an instance of an object.');
  res.json(await SaveImageNmaeCurrent(req.user, parseInt(p.pdfimg, 10), str(p.getimagebytecode), str(p.imgname), str(p.strValidFullName), str(p.documents_Exten)));
}));

module.exports = router;
