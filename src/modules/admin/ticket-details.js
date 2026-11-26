'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Ticket_Details.cs (class Ticket_DetailsController => /admin/Ticket_Details/...)
// Database: affiliate (Db_Affiliate). Tables tbl_ticketmaster, tbl_ticketreply, tbl_statusmaster, member_master, tbl_smsaction, tbl_emailaction;
// procs usp_SendTicket, sp_ticketreply, usp_changeTicketStatus.
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const DataUtility = require('../../lib/admin/DataUtility');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nStr, col, str, cvtInt, mapPath, cleanName, nullRef, decodeBase64Image } = require('./_shared/batch11-common');
const { tdSet, tdPeek } = require('./_shared/batch04-a-common');
const { viewRes, rnd, execSpRow, D100, fireAndForget, loadImage } = require('./_shared/batch13-08-common');

const router = express.Router();
const C = 'Ticket_Details';

/** class Ticket_List */
const TL_PROPS = ['message', 'ticketno', 'categoryname', 'lastupdate', 'imageurl', 'date', 'subject', 'status', 'name', 'username', 'phone'];
/** class SendReport */
const SR_PROPS = ['message', 'date', 'trid', 'imageurl', 'imgpr', 'adminUser'];

/** private static bool ThumbnailCallback() { throw new NotImplementedException(); } (GetThumbnailImageAbort delegate, never invoked) */
function ThumbnailCallback() { throw new Error('The method or operation is not implemented.'); }
void ThumbnailCallback;

/**
 * TempData["Account"].ToString(): read (kept for the rest of this request, removed when the request ends, like MVC TempData).
 * PORT-NOTE: TempData lives in sessionStore key 'TempData' per admin (see batch04-a-common tdSet/tdPeek).
 */
function account(req) {
  const v = tdPeek(req, 'Account');
  if (v === null || v === undefined) throw nullRef();
  return String(v);
}

/** Convert.ToInt32(objdut.GetScalar("select tmid from tbl_ticketmaster where ticketno='<TempData Account>'")) (parameterised) */
async function tmidOf(ticketno) {
  const t = await db.scalar(DB, 'select tmid from tbl_ticketmaster where ticketno = @ticketno', { ticketno });
  return t === null || t === undefined ? 0 : cvtInt(String(t));
}

/** public string ImageUploadMasterMethod(string ImageBase64Code, string SavePaths, string IdForAppend, string ImgPreviewTenth = "") */
async function ImageUploadMasterMethod(ImageBase64Code, SavePaths, IdForAppend, ImgPreviewTenth = '') {
  let RealImageName = '';
  if (ImageBase64Code === null || ImageBase64Code === undefined) throw nullRef();
  if (ImageBase64Code.trim() !== '') {
    let Base64String = '';
    if (ImageBase64Code !== '') {
      Base64String = ImageBase64Code;
      const Image = cleanName(String(rnd(100000, 1000000)));
      RealImageName = ImgPreviewTenth + Image + '-' + IdForAppend + '.jpg';
    } else {
      RealImageName = ' ';
    }
    const StrValidFullNameAndPath = path.join(mapPath(SavePaths), RealImageName);
    if (Base64String.includes('base64,')) {
      const IndexNo = Base64String.indexOf('/') + 1;
      const lastIndexNo = Base64String.indexOf(';');
      if (lastIndexNo - IndexNo < 0) throw new Error('Length cannot be less than zero.\r\nParameter name: length');
      const ByteArray = decodeBase64Image(Base64String.substring(Base64String.indexOf(',') + 1));
      const img = await loadImage(ByteArray); // Image.FromStream
      const filesize = ByteArray.length / 1024;
      if (fs.existsSync(StrValidFullNameAndPath)) fs.unlinkSync(StrValidFullNameAndPath);
      const scaleFactor = 1; // (.25 overwritten by 1 in legacy)
      const newWidth = Math.trunc(img.width * scaleFactor);
      const newHeight = Math.trunc(img.height * scaleFactor);
      fs.mkdirSync(path.dirname(StrValidFullNameAndPath), { recursive: true });
      if (filesize > 10) {
        // GetThumbnailImage(newWidth, newHeight) -> JPEG -> base64 round trip -> Image.FromStream -> Save(path)
        // PORT-NOTE: System.Drawing replaced by sharp (lazy require).
        const sharp = require('sharp');
        const jpeg = await sharp(ByteArray).resize(newWidth, newHeight, { fit: 'fill' }).jpeg().toBuffer();
        fs.writeFileSync(StrValidFullNameAndPath, jpeg);
      } else {
        fs.writeFileSync(StrValidFullNameAndPath, ByteArray); // Img.Save(path)
      }
    } else {
      RealImageName = ImageBase64Code.replace(/^\/+/, ''); // TrimStart('/')
    }
  }
  return RealImageName;
}

// ---------------------------------------------------------------- ActionResult Index(string TicketNo)
// auth (legacy had no session check; admin ticket page (marks the ticket attended) => adminAuth)
// route-config: "AdminPanel/Ticket-Details" -> Ticket_Details/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Ticket-Details'], adminAuth, asyncHandler(async (req, res) => {
  const TicketNo = nStr(req.p.TicketNo);
  if (TicketNo === null) return res.json({ redirect: '/All_Ticket/Index' });
  const AcNo = await UtilityClass.Decryptword(TicketNo);
  if (AcNo === '') return res.json({ redirect: '/AdminPanel/All-Ticket' }); // Response.Redirect (ends the request)
  // db._Ticket_Details.Where(a => a.ticketno == AcNo).FirstOrDefault()
  const Row = await db.queryOne(DB, 'select ticketno, status, isattend from tbl_ticketmaster where ticketno = @AcNo limit 1', { AcNo });
  if (!Row) return res.json({ redirect: '/All_Ticket/Index' });
  if (str(col(Row, 'status')) === '1') {
    // Row.status = "3"; Row.isattend = 1; db.SaveChanges()  ([Key] ticketno)
    await db.exec(DB, "update tbl_ticketmaster set status = '3', isattend = 1 where ticketno = @AcNo", { AcNo });
  }
  const ViewBag = {};
  ViewBag.AccountNo = AcNo;
  tdSet(req, 'Account', AcNo); // TempData["Account"] = AcNo
  const objd = new DataUtility(); void objd;
  // PORT-NOTE: legacy concatenated AcNo into the SQL; parameterised.
  const count1 = str(await db.scalar(DB, `select count(1) from tbl_ticketreply trm
    left outer join tbl_ticketmaster tm on trm.tmid = tm.tmid where tm.ticketno = @AcNo`, { AcNo }));
  ViewBag.rwocount = count1;
  const rr = await db.query(DB, `select tm.message, tm.ticketno, tm.tmid, tm.active, tm.categoryname,
      ${D100('tm.lastupdate')} as lastupdate,
      case tm.tmimage when '' then '' else '' || tm.tmimage end as imageurl,
      ${D100('tm.date')} as date, tm.subject, ts.name as status, (pl.fname || ' (' || coalesce(pl.emailid, '') || ')') as name,
      pl.username, coalesce(pl.mobile, '''') as phone
    from tbl_ticketmaster tm left join tbl_statusmaster ts on ts.id::text = tm.status::text, member_master pl
    where pl.regno = tm.fromplid and tm.ticketno = @AcNo limit 1`, { AcNo });
  const Rows = rr.length ? mapRow(rr[0], TL_PROPS) : null;
  ViewBag.CustomerDetail = Rows;
  const Idetail = {
    _Installment_List: mapRows(await db.proc(DB, 'usp_SendTicket', { ticketno: AcNo }), SR_PROPS),
    _TicketList: Rows,
  };
  return viewRes(res, '~/Views/AdminPanel/Ticket_Details/Index1.cshtml', Idetail, ViewBag, { TempData: { Account: AcNo } });
}));

// ---------------------------------------------------------------- JsonResult CreateTicket(string category, string message, string popupimg, string CategoryName, string ImgPreviewFirst ... string ImgPreviewTenth)
// auth (legacy had no session check; admin reply on a ticket + TempData per admin => adminAuth)
router.all(`/admin/${C}/CreateTicket{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const s = (k) => nStr(req.p[k]);
  const category = s('category');
  const message = s('message');
  const popupimg = s('popupimg');
  void s('CategoryName');
  const imgs = ['ImgPreviewFirst', 'ImgPreviewSecond', 'ImgPreviewThird', 'ImgPreviewFourth', 'ImgPreviewFifth', 'ImgPreviewSixth',
    'ImgPreviewSeventh', 'ImgPreviewEightth', 'ImgPreviewNineth', 'ImgPreviewTenth'];
  const I = {}; for (const k of imgs) I[k] = s(k);
  try {
    const tmid = await tmidOf(account(req));
    const Plid = tmid;
    let AllImageName = '';
    let OneByOneImageName = '';
    const AdminpanelURL = config.app.AdminMainURL === undefined || config.app.AdminMainURL === null ? '' : String(config.app.AdminMainURL);
    const PanImage = popupimg; void PanImage;
    const TicketImage = config.app.TicketImage === undefined || config.app.TicketImage === null ? '' : String(config.app.TicketImage);
    const count = str(await db.scalar(DB, 'select count(1) from tbl_ticketreply', {})); void count;
    const cs = (v) => (v === null ? '' : v); // Convert.ToString
    // #region First Image
    if (cs(I.ImgPreviewFirst) !== '') {
      try {
        AllImageName = await ImageUploadMasterMethod(I.ImgPreviewFirst, TicketImage, String(Plid), 'ImgPreviewFirst');
        if (AllImageName !== '') AllImageName = AdminpanelURL + '/Create_Member_Ticket/' + AllImageName;
      } catch (expObj) {
        AllImageName = AdminpanelURL + '/Create_Member_Ticket/' + expObj.message;
      }
    }
    // #region Second .. Ninth Image
    for (const k of imgs.slice(1, 9)) {
      if (cs(I[k]) !== '') {
        try {
          OneByOneImageName = await ImageUploadMasterMethod(I[k], TicketImage, String(Plid), k);
          if (OneByOneImageName !== '') {
            OneByOneImageName = AdminpanelURL + '/Create_Member_Ticket/' + OneByOneImageName;
            AllImageName = AllImageName + (OneByOneImageName !== '' ? ',' : '') + (OneByOneImageName === '' ? '' : OneByOneImageName);
          }
        } catch (expObj) {
          AllImageName = AllImageName + AdminpanelURL + '/Create_Member_Ticket/' + expObj.message;
        }
      }
    }
    // #region Tenth Image
    if (cs(I.ImgPreviewTenth) !== '') {
      try {
        OneByOneImageName = await ImageUploadMasterMethod(I.ImgPreviewTenth, TicketImage, String(Plid), 'ImgPreviewTenth');
        // PORT-NOTE: legacy never appended the tenth image name to AllImageName - kept.
        if (OneByOneImageName !== '') OneByOneImageName = AdminpanelURL + '/Create_Member_Ticket/' + OneByOneImageName;
      } catch (expObj) {
        AllImageName = AllImageName + AdminpanelURL + '/Create_Member_Ticket/' + expObj.message;
      }
    }
    if (AllImageName !== '') AllImageName = AllImageName.replace(/^,+/, '');
    const UD = 0;
    let msg = '';
    // [sp_ticketreply] via DataUtility.ExecuteSqlSP (+ OUT @MOBILE, @EMAIL, @MEMBER_NAME)
    const { ret, row } = await execSpRow({
      tmid: Number(tmid), replyFrom: UD, message, status: category, fromtype: 1, image: AllImageName,
    }, 'sp_ticketreply');
    const Mobile = str(col(row, 'mobile'));
    const Emailid = str(col(row, 'email'));
    const Name = str(col(row, 'member_name'));
    if (ret === 1) {
      const ticketstatus = category === '4' ? 'Solved' : 'Inprocess';
      const dynamicSms = await db.queryOne(DB, 'select * from tbl_smsaction where id = 19 limit 1', {});
      if (!dynamicSms) throw nullRef();
      const Mobilestatus = col(dynamicSms, 'sms_send_status');
      const emailmsg = await db.queryOne(DB, 'select * from tbl_emailaction where eid = 16 limit 1', {});
      if (!emailmsg) throw nullRef();
      const Emailstatus = col(emailmsg, 'email_send_status');
      const TicketID = account(req);
      const TicketMobileMsg = await UtilityClass.FindingSmsContentWithUserIdPassword(Name, col(dynamicSms, 'sms_content'), message, TicketID, 6);
      const TokenEmailMsg = await UtilityClass.FindingEmailContentWithUserIdPassword(Name, col(emailmsg, 'email_content'), message, TicketID, 8, ticketstatus);
      if (Number(Mobilestatus) === 1) {
        fireAndForget(() => UtilityClass.SendSMSWithAPI(Mobile, TicketMobileMsg, '1'));
      }
      if (Number(Emailstatus) === 1) {
        fireAndForget(async () => {
          if (Emailid !== null || Emailid !== '') { // (always true in legacy)
            await UtilityClass.SendEmailByApiSetting(Name, '', '', '', '', '', Emailid, col(emailmsg, 'email_subject'), TokenEmailMsg, null, '', '');
          }
        });
      }
      msg = 'ok';
    }
    return res.json(msg);
  } finally {
    tdSet(req, 'Account', null); // TempData value read in this request => removed at the end of it
  }
}));

// ---------------------------------------------------------------- public string ImageUploadMasterMethod(...)
// auth (public method => routable in legacy, no session check; writes files => adminAuth)
router.all(`/admin/${C}/ImageUploadMasterMethod{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const tenth = nStr(req.p.ImgPreviewTenth);
  const r = await ImageUploadMasterMethod(nStr(req.p.ImageBase64Code), nStr(req.p.SavePaths), nStr(req.p.IdForAppend), tenth === null ? '' : tenth);
  res.type('text/html').send(r);
}));

// ---------------------------------------------------------------- JsonResult ChangeStatus(string category)
// auth (legacy had no session check; admin-only write + TempData per admin => adminAuth)
router.all(`/admin/${C}/ChangeStatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const category = nStr(req.p.category);
  try {
    const objdut = new DataUtility();
    const tmid = await tmidOf(account(req));
    const UD = 0; // ((Employee)Session["Admin_User"]).EmpID (commented out)
    const ret = await objdut.ExecuteSqlSP([
      DataUtility.SqlParameter('@tmid', tmid),
      DataUtility.SqlParameter('@catid', cvtInt(category)),
      DataUtility.SqlParameter('@uid', UD),
      DataUtility.SqlParameter('@intResult', 0, 'Output'),
    ], 'usp_changeTicketStatus');
    return res.json(ret);
  } finally {
    tdSet(req, 'Account', null); // TempData value read in this request => removed at the end of it
  }
}));

module.exports = router;
