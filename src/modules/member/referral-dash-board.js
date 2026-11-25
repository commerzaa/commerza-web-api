'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/ReferralDashBoard.cs (ReferralDashBoardController)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const sessionStore = require('../../utils/sessionStore');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';

const WIDGET_PROPS = ['ROWNUMBER', 'WIDGETNAME', 'COLUMNAME', 'TABLENAME', 'ISCURRENCY', 'VALUE', 'WIDGETURL', 'CLASS'];
const SPONSER_PROPS = ['Name', 'UserName', 'Mobile', 'EmailID'];
const KYCACTIVE_PROPS = ['KTID', 'STATUS', 'TITLE', 'IMAGEICON', 'BUTTONID', 'COLSMCLASS', 'DATATARGET', 'SubmitButtonID'];
const NEWS_PROPS = ['HOURS', 'TITLE', 'DESCRIPTIONS'];
const PACKAGE_PROPS = ['SNO', 'TotalPayableAmount', 'AllPackageName', 'PuchaseDate', 'IsOrderCanceled', 'IsActive'];
const LOGINHISTORY_PROPS = ['IPADDRESS', 'ISSUCCESS', 'LOGINDATETIME'];
const TWOFA_PROPS = ['ROWNUMBER', 'TSTID', 'SECURITYTYPE', 'ACTIVE'];
const REWARD_PROPS = ['ROWNUMBER', 'REWARDNAME', 'ACHVEDMATCHING', 'LEFTBUSINESS', 'RIGHTBUSINESS', 'MATCHVOLUMNE', 'ACHIVEREWARD', 'Remaining', 'ACHIVEDATE', 'RANKNAME', 'CLBV',
  'CRBV', 'REWARDMATCHBV', 'CLAIMED', 'RAID', 'ApprovedDate'];
const COLOR_PROPS = ['COLOR'];
const KYCTYPE_PROPS = ['KTID', 'STATUS'];
const INCOMEGRAPH_PROPS = ['INCOMEDATE', 'BINARYINCOME', 'LEVELINCOME', 'DIRECTINCOME', 'ROIINCOME'];
const MEMBERGRAPH_PROPS = ['REGDATE', 'DIRECTMEMBER', 'TOTALMEMBER'];
const BINARYDATA_PROPS = ['PAYDATE', 'PAYBLEAMOUNT'];
const TOTALDOWNLINE_PROPS = ['TOTALCOUNT', 'REGDATE'];
const DASHROLE_PROPS = ['MDCID', 'SectionName', 'STATUS'];
const LINKS_PROPS = ['RLID', 'Title', 'Image', 'Url', 'Date', 'Active'];

const col = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };
const legacyPath = (req) => req.originalUrl.split('?')[0].replace(/^\/member/, '');
const npe = () => new Error('Object reference not set to an instance of an object.');
const first = (rows) => { const f = rows[0]; return f ? f[Object.keys(f)[0]] : null; }; // SqlQuery<scalar>().FirstOrDefault()
const firstInt = (rows) => { const v = first(rows); return v === null ? 0 : parseInt(v, 10); };
const firstStr = (rows) => { const v = first(rows); return v === null ? null : String(v); };

async function logErr(req, procName, e) {
  try { await new DataUtility().ErrorInsert(0, e.message, procName, 0, legacyPath(req)); } catch (x) { console.error(x); }
}

// ---- KYC helper methods (public void methods in legacy: set ViewBag values, swallow errors) -------------------------
async function checkKYCStatus(req, ViewBag) {
  try {
    const Plid = Number(req.user.plid);
    // PORT-NOTE: @Result OUT param is returned as a column of the result row; the first column is read like SqlQuery<int>().FirstOrDefault().
    const aprrovestatus = firstInt(await db.proc(DB, 'usp_insertmemberkycimages', { regno: Math.trunc(Plid), imagename: '', mode: 12 }));
    ViewBag.approvestatus = String(aprrovestatus);
    ViewBag.KYCNOTE = '';
    if (String(aprrovestatus) === '0') {
      ViewBag.KYCNOTE = 'Dear Customer, Your KYC Verification is Pending.';
      ViewBag.Classname = 'callout bg-pending kyc-pending-status';
    } else if (String(aprrovestatus) === '1') {
      ViewBag.KYCNOTE = 'Dear Customer, Your KYC has been Approved.';
      ViewBag.Classname = 'callout bg-aproved kyc-pending-status';
    } else if (String(aprrovestatus) === '2') {
      ViewBag.KYCNOTE = 'Dear Customer, Your KYC has been Rejected.';
      ViewBag.Classname = 'callout bg-reject kyc-pending-status';
    }
    if (String(aprrovestatus) === '3') {
      ViewBag.KYCNOTE = 'Dear Customer, Your KYC Verification is in-Process.';
      ViewBag.Classname = 'callout bg-process kyc-approve-status';
    }
  } catch (ex) {
    await logErr(req, 'usp_InsertMemberKYCImages', ex);
    ViewBag.filepath = ex.message;
  }
}

async function KYCActive(req, ViewBag) {
  try {
    const CHECKACTIVE = firstInt(await db.proc(DB, 'usp_insertmemberkycimages', { regno: 0, imagename: '', mode: 13 }));
    ViewBag.activekyc = String(CHECKACTIVE);
  } catch (ex) {
    await logErr(req, 'usp_InsertMemberKYCImages', ex);
    ViewBag.filepath = ex.message;
  }
}

async function checkKYCResetStatusAndApprovedAndCheckParentUser(req, ViewBag) {
  try {
    const Plid = Number(req.user.plid);
    const liststatus = (await db.proc(DB, 'usp_insertmemberkycimages', { regno: Math.trunc(Plid), imagename: '', mode: 15 }))[0] || null;
    if (liststatus === null) throw npe();
    ViewBag.REKYCtatus = col(liststatus, 'Resetkyc');
    ViewBag.ParentUser = col(liststatus, 'USERNAME');
    ViewBag.Approved = col(liststatus, 'APPROVALSTATUS');
  } catch (ex) {
    await logErr(req, 'usp_InsertMemberKYCImages', ex);
    ViewBag.filepath = ex.message;
  }
}

async function CheckKYCBulkSettingActive(req, ViewBag) {
  try {
    const active = firstInt(await db.proc(DB, 'usp_insertmemberkycimages', { regno: 0, imagename: '', mode: 21 }));
    ViewBag.ActiveBulkSetting = active;
  } catch (ex) {
    await logErr(req, 'usp_InsertMemberKYCImages', ex);
    ViewBag.filepath = ex.message;
  }
}

async function ReferalLinks() {
  return mapRows(await db.proc(DB, 'usp_referal_link', {}), LINKS_PROPS);
}

// auth
// route-config: "referral/dashboard" -> ReferralDashBoard/Index
router.all(['/member/ReferralDashBoard/Index{/:id}', '/member/referral/dashboard'], auth, asyncHandler(async (req, res) => {
  let PROCEDURENAME = '';
  const ViewBag = {};
  const VIEW = '~/Views/CustomerPanel/ReferralDashBoard/Index.cshtml';
  // int? page (default 0), int? ActivationStatus (default 0): accepted but unused by the legacy action
  try {
    const Plid = Number(req.user.plid);
    // (legacy read Session UserName into an unused local)

    // ONLINE KYC APPROVED/REJECT CALL FOR PROCEDURE
    if (Plid > 0) {
      await db.proc(DB, 'usp_memberkyc_statusimg', { mode: 0, regno: Math.trunc(Plid) });
    }

    PROCEDURENAME = 'USP_GETDYNAMICDASHBORD_WIDGET';
    // PORT-NOTE: @STRESULT OUT param is returned as a column of the result row (unused by legacy).
    ViewBag.DynamicWidget = mapRows(await db.proc(DB, 'usp_getdynamicdashbord_widget', { regno: Math.trunc(Plid) }), WIDGET_PROPS);

    const strcount = legacyPath(req).substring(1);
    const tdr = await db.scalar(DB, 'select tdid from tbl_dashboards where url = @url and actine::int = 1 limit 1', { url: strcount });
    const Tdid = tdr === null ? 0 : parseInt(tdr, 10);
    sessionStore.set(req, 'Url', strcount);
    sessionStore.set(req, 'Tdid', Tdid);
    ViewBag.links = await ReferalLinks();
    const GalleryImages = await db.queryOne(DB, 'select name, title, type from tbl_flyermanagement where status::int = 1 and isactive::int = 1 and contenttype::int = 2 limit 1', {});
    if (GalleryImages !== null) {
      if (GalleryImages.name === null || GalleryImages.title === null || GalleryImages.type === null) throw npe();
      ViewBag.FlayerImages = String(GalleryImages.name);
      ViewBag.ImageTitle = String(GalleryImages.title);
      ViewBag.Type = String(GalleryImages.type);
    }

    ViewBag.Sideactive = firstInt(await db.proc(DB, 'usp_scalerdata', { mode: 5 }));

    const ObjSponser = mapRows(await db.proc(DB, 'usp_sponserandachivelevel', { plid: Plid }), SPONSER_PROPS);
    ViewBag.SponserDetails = ObjSponser;

    const regno = Math.trunc(Plid);
    ViewBag.TotalDownline = firstInt(await db.proc(DB, 'usp_getnofodirectmember_anddownlinemember', { mode: 1, regno }));
    ViewBag.TotalDirectMember = firstInt(await db.proc(DB, 'usp_getnofodirectmember_anddownlinemember', { mode: 2, regno }));
    ViewBag.LastUpdateEwallet = firstStr(await db.proc(DB, 'usp_getnofodirectmember_anddownlinemember', { mode: 3, regno }));
    ViewBag.LastUpdatedDepositHistory = firstStr(await db.proc(DB, 'usp_getnofodirectmember_anddownlinemember', { mode: 5, regno }));
    ViewBag.LastMakeInvestmentHistory = firstStr(await db.proc(DB, 'usp_getnofodirectmember_anddownlinemember', { mode: 6, regno }));
    ViewBag.RankName = firstStr(await db.proc(DB, 'usp_getnofodirectmember_anddownlinemember', { mode: 7, regno }));

    ViewBag.active = mapRows(await db.proc(DB, 'usp_insertmemberkycimages', { regno: 0, imagename: '', mode: 11 }), KYCACTIVE_PROPS);

    await checkKYCStatus(req, ViewBag);
    await KYCActive(req, ViewBag);
    await CheckKYCBulkSettingActive(req, ViewBag);
    await checkKYCResetStatusAndApprovedAndCheckParentUser(req, ViewBag);

    ViewBag.NewsDetails = mapRows(await db.proc(DB, 'usp_get_newsfordashboard', { mode: 1 }), NEWS_PROPS);
    ViewBag.PackagePurchase = mapRows(await db.proc(DB, 'usp_get_packagepurchase', { regno }), PACKAGE_PROPS);
    ViewBag.LoginHistory = mapRows(await db.proc(DB, 'usp_logindetails', { regno }), LOGINHISTORY_PROPS);
    ViewBag.TwoFADetails = mapRows(await db.proc(DB, 'usp_get2fasecurity', {}), TWOFA_PROPS);
    // PORT-NOTE: @TOTALCOUNT OUT param is returned as a column of the result row (unused by legacy).
    ViewBag.Rewardlist = mapRows(await db.proc(DB, 'usp_all_life_timerewardachivers', { regno, startrowindex: 1, maxrows: 100, fromdate: '', todate: '' }), REWARD_PROPS);
    ViewBag.DashboardColor = mapRows(await db.proc(DB, 'usp_get_newsfordashboard', { mode: 2 }), COLOR_PROPS);

    sessionStore.set(req, 'Photo', null);
    sessionStore.set(req, 'pan', null);
    sessionStore.set(req, 'bank', null);
    sessionStore.set(req, 'ID', null);

    ViewBag.KycTypeActive = mapRows(await db.proc(DB, 'usp_scalerdata', { mode: 6 }), KYCTYPE_PROPS);

    return res.json({ view: VIEW, Model: ObjSponser, ViewBag });
  } catch (ExpObj) {
    ViewBag.ErrorMessage = ExpObj.message;
    await logErr(req, PROCEDURENAME, ExpObj);
    return res.json({ view: VIEW, ViewBag });
  }
}));

// auth
router.all('/member/ReferralDashBoard/DefaultSponserSide{/:id}', auth, asyncHandler(async (req, res) => {
  const side = req.p.side;
  const plid = Math.trunc(Number(req.user.plid));
  let Regno = 0;
  const Member_Master = require('../../lib/member/Member_Master');
  const member_details = await new Member_Master().Get_member_details(plid);
  if (member_details) Regno = Number(member_details.REGNO !== undefined ? member_details.REGNO : member_details.regno);
  // PORT-NOTE: legacy concatenated `side` into the SQL text; it is bound as a parameter here.
  const Ret = await db.exec(DB, 'update member_master set defaultsponserside = @side where regno = @regno', { side, regno: Regno });
  res.json(Ret);
}));

// auth
router.all('/member/ReferralDashBoard/Monthlyincomechart{/:id}', auth, asyncHandler(async (req, res) => {
  try {
    const plid = Math.trunc(Number(req.user.plid)) || 0;
    res.json(mapRows(await db.proc(DB, 'usp_incomechart', { regno: plid }), INCOMEGRAPH_PROPS));
  } catch (Ex) {
    res.json(Ex.message);
  }
}));

// auth
router.all('/member/ReferralDashBoard/MonthlyMemberchart{/:id}', auth, asyncHandler(async (req, res) => {
  try {
    const plid = Math.trunc(Number(req.user.plid)) || 0;
    res.json(mapRows(await db.proc(DB, 'usp_teamchart', { regno: plid }), MEMBERGRAPH_PROPS));
  } catch (Ex) {
    res.json(Ex.message);
  }
}));

// public (no session check in legacy; dashboard section master data only)
router.all('/member/ReferralDashBoard/MemberDashboardDetail{/:id}', asyncHandler(async (req, res) => {
  const rows = await db.query(DB, `select tcdd.mdcid, tmdc.sectionname
    from tbl_customerdashboarddetails tcdd inner join tbl_memberdashboard_content tmdc on tcdd.mdcid = tmdc.mdcid
    where tcdd.status::int = 1 and tmdc.status::int = 1`, {});
  res.json(mapRows(rows, DASHROLE_PROPS));
}));

// auth (public helper method of the legacy controller: MVC exposed it as an action)
router.all('/member/ReferralDashBoard/ReferalLinks{/:id}', auth, asyncHandler(async (req, res) => { res.json(await ReferalLinks()); }));

// auth (public void helper methods of the legacy controller; they only filled ViewBag, so the ViewBag values are returned)
router.all('/member/ReferralDashBoard/checkKYCStatus{/:id}', auth, asyncHandler(async (req, res) => { const ViewBag = {}; await checkKYCStatus(req, ViewBag); res.json({ ViewBag }); }));
router.all('/member/ReferralDashBoard/KYCActive{/:id}', auth, asyncHandler(async (req, res) => { const ViewBag = {}; await KYCActive(req, ViewBag); res.json({ ViewBag }); }));
router.all('/member/ReferralDashBoard/checkKYCResetStatusAndApprovedAndCheckParentUser{/:id}', auth, asyncHandler(async (req, res) => {
  const ViewBag = {}; await checkKYCResetStatusAndApprovedAndCheckParentUser(req, ViewBag); res.json({ ViewBag });
}));
router.all('/member/ReferralDashBoard/CheckKYCBulkSettingActive{/:id}', auth, asyncHandler(async (req, res) => { const ViewBag = {}; await CheckKYCBulkSettingActive(req, ViewBag); res.json({ ViewBag }); }));

// auth
router.all('/member/ReferralDashBoard/GetbinarydataforDashboard{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Math.trunc(Number(req.user.plid));
  res.json(mapRows(await db.proc(DB, 'usp_getdataforbinarychartat_dashboard', { regno: Plid, mode: 1 }), BINARYDATA_PROPS));
}));

// auth
router.all('/member/ReferralDashBoard/GetTotalDownLineMemberByDate{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Math.trunc(Number(req.user.plid));
  res.json(mapRows(await db.proc(DB, 'usp_getdataforbinarychartat_dashboard', { regno: Plid, mode: 2 }), TOTALDOWNLINE_PROPS));
}));

// auth
router.all('/member/ReferralDashBoard/GetTotalDirectDownLineMemberByDate{/:id}', auth, asyncHandler(async (req, res) => {
  const Plid = Math.trunc(Number(req.user.plid));
  res.json(mapRows(await db.proc(DB, 'usp_getdataforbinarychartat_dashboard', { regno: Plid, mode: 3 }), TOTALDOWNLINE_PROPS));
}));

// image magic-number check (System.Drawing.Image.FromStream throws "Parameter is not valid." for non-image data)
function looksLikeImage(b) {
  if (b.length < 4) return false;
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true; // png
  if (b[0] === 0xff && b[1] === 0xd8) return true; // jpeg
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return true; // gif
  if (b[0] === 0x42 && b[1] === 0x4d) return true; // bmp
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a) || (b[0] === 0x4d && b[1] === 0x4d && b[3] === 0x2a)) return true; // tiff
  return false;
}

// auth
router.all('/member/ReferralDashBoard/CreateTicket{/:id}', auth, asyncHandler(async (req, res) => {
  const { category, subject, message, popupimg, CategoryName } = req.p;
  let msg = '';
  let strValidFullName = '';
  try {
    let imgname = '';
    if (popupimg.trim() !== '') { // NullReferenceException when popupimg is null (caught below)
      let base64String = '';
      const count = Number(await db.scalar(DB, 'select count(1) from tbl_ticketmaster', {}));
      if (popupimg !== '') {
        base64String = popupimg;
        let ProfileImage = 'TicketImage' + String(count);
        ProfileImage = ProfileImage.trim();
        ProfileImage = ProfileImage.split('&amp;').join('And');
        ProfileImage = ProfileImage.split('&').join(' And ');
        ProfileImage = ProfileImage.replace(/[^\w\d]/g, '');
        ProfileImage = ProfileImage.split(' ').join('-');
        imgname = ProfileImage + '.jpg';
      } else {
        imgname = '';
      }
      // Server.MapPath("../TicketCenterImage") => <upload root>/TicketCenterImage
      const dir = path.join(config.uploadDir, 'TicketCenterImage');
      strValidFullName = path.join(dir, imgname);
      if (base64String.includes('base64,')) {
        const IndexNo1 = base64String.indexOf(',') + 1;
        base64String = base64String.substring(IndexNo1);
      }
      const b = Buffer.from(base64String, 'base64');
      // PORT-NOTE: System.Drawing.Image.FromStream/Save replaced by an image-signature check and writing the original bytes.
      if (!looksLikeImage(b)) throw new Error('Parameter is not valid.');
      fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
      fs.writeFileSync(strValidFullName, b);
      imgname = '/TicketCenterImage/' + imgname;
    } else {
      imgname = '';
    }
    const toRegNo = Number(req.user.plid);
    await db.scalar(DB, 'select categoryname from categorymaster where catid = @catid', { catid: category }); // catname: unused in legacy

    // PORT-NOTE: OUT params (@INTRESULT1,@MEMBEREMAILID,@TICKETID) are read from the result row.
    const out = await db.procOne(DB, 'sp_createaticket', {
      fromplid: String(toRegNo), categoryname: CategoryName.split('`').join("'"), catid: category,
      subject: subject.split('`').join("'"), message: message.split('`').join("'"), image: imgname,
    });
    const m = col(out, 'intresult1');
    msg = m === null ? '' : String(m);
    const tid = col(out, 'ticketid');
    if (tid === null) throw npe(); // Param[8].Value.ToString()
    const TicketID = String(tid);
    if (msg.toLowerCase() === 'ok') {
      try {
        const Obj = await db.queryOne(DB, "select coalesce(phone, '') as phone, emailid, username from portal_login where plid = @plid limit 1", { plid: Math.trunc(toRegNo) });
        if (Obj !== null) {
          // legacy SMS / confirmation e-mail calls are commented out
          void `Dear ${Obj.username},Your ticket, reference no. - ${TicketID} has been created successfully.`;
        }
      } catch (ExpObj) {
        await logErr(req, 'CreateTicket', ExpObj);
      }
    }
    // PORT-NOTE: legacy tested ExecuteSqlCommand's affected-row count (> 0 == the INSERT inside the proc succeeded); "Ok" output is used here.
    const ret = msg.toLowerCase() === 'ok' ? 1 : 0;
    if (ret > 0) {
      msg = 'ok';
    } else if (strValidFullName.trim() !== '') {
      if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    }
    return res.json(msg);
  } catch (ex) {
    if (strValidFullName.trim() !== '') {
      try { if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName); } catch (e) { console.error(e); }
    }
    await logErr(req, 'SP_CREATEATICKET', ex);
    return res.json(msg);
  }
}));

module.exports = router;
