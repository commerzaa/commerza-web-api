'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Create_Ticket_ToSupportController.cs
// (namespace Common.Controllers.AdminPanel, class Create_Ticket_ToSupportController => /admin/Create_Ticket_ToSupport/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const axios = require('axios');
const multer = require('multer');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch05-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Create_Ticket_ToSupport';
const upload = multer({ storage: multer.memoryStorage() });

/** #region Get File: public static String[] GetFilesFrom(String searchFolder, String[] filters, bool isRecursive) (static => not an action) */
function GetFilesFrom(searchFolder, filters, isRecursive) {
  const filesFound = [];
  if (!fs.existsSync(searchFolder)) {
    throw new Error(`Could not find a part of the path '${searchFolder}'.`); // DirectoryNotFoundException
  }
  const walk = (dir, ext) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (isRecursive) walk(full, ext); } else if (e.name.toLowerCase().endsWith('.' + ext)) filesFound.push(full);
    }
  };
  for (const filter of filters) walk(searchFolder, filter); // Directory.GetFiles(searchFolder, "*.<filter>", option) per filter
  return filesFound;
}

/** JProperty.Value.ToString() */
const jTokenString = (v) => {
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') return JSON.stringify(v, null, 2);
  return String(v);
};

/** WebClient.DownloadString + JObject.Parse + first "Message" property */
async function messageFrom(baseurl) {
  const resp = await axios.get(baseurl, { responseType: 'text', transformResponse: (x) => x });
  const Obj = JSON.parse(resp.data);
  if (Obj === null || typeof Obj !== 'object' || Array.isArray(Obj)) throw new Error('Error reading JObject from JsonReader.');
  for (const Name of Object.keys(Obj)) {
    if (Name === 'Message') return { found: true, ddl: jTokenString(Obj[Name]) };
  }
  return { found: false };
}

// ---------------------------------------------------------------- [HttpPost] ActionResult Index(List<HttpPostedFileBase> postedFiles)
// auth (file upload into the site; legacy had no session check - PORT-NOTE: protected with adminAuth)
// route-config: "AdminPanel/Create-Ticket-ToSupport" -> Create_Ticket_ToSupport/Index
router.post([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Create-Ticket-ToSupport'], adminAuth, upload.any(), asyncHandler(async (req, res) => {
  const p = B.mapPath('~/Uploads/');
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  const postedFiles = (req.files || []).filter((f) => f.fieldname.toLowerCase().startsWith('postedfiles'));
  let Message = null;
  for (const postedFile of postedFiles) {
    if (postedFile !== null) {
      const fileName = path.basename(postedFile.originalname); // Path.GetFileName
      fs.writeFileSync(path.join(p, fileName), postedFile.buffer);
      Message = (Message || '') + `<b>${fileName}</b> uploaded.<br />`;
    }
  }
  return res.json({ view: '~/Views/AdminPanel/Create_Ticket_ToSupport/Index.cshtml', Message });
}));

// ---------------------------------------------------------------- ActionResult Index(string url)   (non-POST)
// auth (admin page; legacy had no session check - PORT-NOTE: protected with adminAuth)
// route-config: "AdminPanel/Create-Ticket-ToSupport" -> Create_Ticket_ToSupport/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Create-Ticket-ToSupport'], adminAuth, asyncHandler(async (req, res) => {
  const url = B.nStr(req.p.url);
  let geturl = '';
  if (url === null) geturl = '';
  else geturl = '/Ticket_Details/' + url;
  const searchFolder = B.mapPath('/Ticket_Details');
  const filters = ['jpg', 'jpeg', 'png', 'gif', 'tiff', 'bmp'];
  const files = GetFilesFrom(searchFolder, filters, false);
  const ticketRequestLIst = { CatagoryName: null, subject: null, message: null, projectid: null, Clientregno: null, Clientname: null, ticketList: files };
  return res.json({
    view: '~/Views/AdminPanel/Create_Ticket_ToSupport/Index.cshtml', Model: ticketRequestLIst, imagename: ticketRequestLIst.ticketList, redirectURL: geturl,
  });
}));

// ---------------------------------------------------------------- [HttpPost] ActionResult GetProject()
// auth (calls the support-ticket API with the client id; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.post(`/admin/${C}/GetProject{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let CLIENTREGNO = 0;
  const v = await db.scalar(DB, "select (limits)::int as clientregno from settings where caption = 'CLIENTDETAILSFORTICKET' limit 1", {});
  CLIENTREGNO = v === null ? 0 : Number(v);
  try {
    const Ticketapiurl = config.app.Ticket_Apiurl || '';
    const baseurl = Ticketapiurl + '/GetProject?Clientid=' + CLIENTREGNO + '';
    const r = await messageFrom(baseurl);
    if (r.found) return res.json(r.ddl);
    return res.json('');
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Index');
    const error = ' Not Found';
    return res.json(error);
  }
}));

// ---------------------------------------------------------------- [HttpPost] ActionResult GetCategory()
// auth (legacy had no session check - PORT-NOTE: protected with adminAuth)
router.post(`/admin/${C}/GetCategory{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  try {
    const Ticketapiurl = config.app.Ticket_Apiurl || '';
    const baseurl = Ticketapiurl + '/GetCategory/';
    const r = await messageFrom(baseurl);
    if (r.found) return res.json(r.ddl);
    return res.json('');
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Index');
    const error = ' Not Found';
    return res.json(error);
  }
}));

// ---------------------------------------------------------------- JsonResult ImageToBase64(string path)
// auth (reads a server file; legacy had no session check - PORT-NOTE: protected with adminAuth and confined to the upload root)
router.all(`/admin/${C}/ImageToBase64{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const p = B.nStr(req.p.path);
  const full = path.resolve(B.mapPath(p));
  // Server.MapPath refused paths leaving the application root ("Cannot use a leading .. to exit above the top directory.")
  if (!full.startsWith(path.resolve(config.uploadDir))) throw new Error('Cannot use a leading .. to exit above the top directory.');
  const imageArray = fs.readFileSync(full);
  const base64ImageRepresentation = imageArray.toString('base64');
  return res.json(base64ImageRepresentation);
}));

// ---------------------------------------------------------------- [HttpPost] ActionResult CreateTicketForClient(string CatagoryName, string subject, string message, string projectid, string Clientregno, string Clientname, string IMAGE)
// auth (reads Session["Admin_User"])
router.post(`/admin/${C}/CreateTicketForClient{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const s = (k) => B.nStr(req.p[k]);
  const CatagoryName = s('CatagoryName'); const subject = s('subject'); const message = s('message'); const projectid = s('projectid');
  const Clientregno = s('Clientregno'); const Clientname = s('Clientname'); const IMAGE = s('IMAGE');
  // #region TicketImage
  let regNo = req.user.emp_id;
  const loginid = req.user.emp_loginid;
  const Vcode = 100000 + Math.floor(Math.random() * (555555 - 100000)); // new Random().Next(100000, 555555)
  regNo = Vcode;
  let imgname = '';
  if (IMAGE === null) throw B.nullRef();
  if (IMAGE.trim() !== '') {
    let base64String = '';
    const SavePaths = config.app.CompanyLogoImage; // AppSettings["CompanyLogoImage"]
    if (IMAGE !== '') {
      base64String = IMAGE;
      imgname = B.cleanName(loginid) + '-' + regNo + '.png';
    } else {
      imgname = ' ';
    }
    const strValidFullName = path.join(B.mapPath(SavePaths), imgname);
    const b = B.decodeBase64Image(base64String);
    const sharp = require('sharp');
    await sharp(b).metadata(); // Image.FromStream
    if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    const oldimage = '';
    if (oldimage !== '') {
      const o = path.join(B.mapPath(SavePaths), oldimage);
      if (fs.existsSync(o)) fs.unlinkSync(o);
    } else {
      fs.mkdirSync(path.dirname(strValidFullName), { recursive: true });
      fs.writeFileSync(strValidFullName, b); // img.Save(path)
    }
  }
  // #endregion TicketImage
  const Ticketapiurl = config.app.SupportTicketCreateToAwapal || '';
  const Obj = { CatagoryName, subject, message, projectid, Clientregno, Clientname, ticketList: null };
  const rel = 'api/GenerateClientTicket?CatagoryName=' + CatagoryName + '&subject=' + subject + '&message=' + message + '&projectid=' + projectid
    + '&Clientregno=' + Clientregno + '&Clientname=' + Clientname;
  // HttpClient.BaseAddress + relative uri (PostAsJsonAsync) - PORT-NOTE: values are concatenated unencoded like the legacy (Uri escapes spaces etc.).
  const target = new URL(encodeURI(rel), Ticketapiurl).toString();
  const PaymentServiceResponse = await axios.post(target, Obj, { validateStatus: () => true });
  const JObjectObj = typeof PaymentServiceResponse.data === 'string' ? JSON.parse(PaymentServiceResponse.data) : PaymentServiceResponse.data;
  if (!JObjectObj || JObjectObj.Message === undefined) throw B.nullRef(); // JObjectObj["Message"].ToString()
  const StrObj = jTokenString(JObjectObj.Message);
  if (StrObj === 'Ok') return res.json(StrObj);
  return res.json('');
}));

void GetFilesFrom;
module.exports = router;
