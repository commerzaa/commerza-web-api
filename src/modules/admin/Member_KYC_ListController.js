'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Member_KYC_ListController.cs (class Member_KYC_ListController => /Member_KYC_List/...)
// Database: affiliate (Db_Affiliate). Procs: USP_MEMBERKYC_DETAILS_REPORT, USP_MEMBERKYC_STATUSIMG. Table: tbl_companymaster.
// Config: MemberKYCURL (folder prefix of the member KYC ".txt" base64 image files).
const fs = require('fs');
const path = require('path');
const express = require('express');
const db = require('../../db');
const config = require('../../config');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows, mapRow } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const {
  DB, nInt, nStr, s0, reqInt, cvtInt, perms, excelHistory, nowStamp, writeXlsExport, tab, cellStr, netFormat, col, firstCol, nullRef, outOf,
} = require('./_shared/batch09_common');

const router = express.Router();
const C = 'Member_KYC_List';

/** class GetAllImage */
const GET_ALL_IMAGE = ['PHOTOIMAGE', 'FRUNTIMG', 'BACKIMG', 'PANCARDIMG', 'BANKIMG'];
/** class KYCTYPE */
const KYCTYPE = ['KTID', 'TITLE'];
/** class MemberKYC_List */
const MEMBER_KYC_LIST = ['ROWNUMBER', 'REGNO', 'USERNAME', 'LOGINID', 'MOBILE', 'EMAILID', 'PHOTOIMAGE', 'PTITLE', 'PHOTOSTATUS', 'IDFRUNTIMGTITLE',
  'IDFRUNTIMGTYPETITLE', 'IDFRUNTIMGNO', 'FRUNTIMG', 'BACKIMG', 'IDFRUNTIMGSTATUS', 'PCTITLE', 'PCIDTYPETITLE', 'PCIDNO', 'PANCARDIMG', 'PANSTATUS',
  'BANKIMG', 'TBIDTITLE', 'ACCOUNTNO', 'ACCOUNTHOLDERNAME', 'IFSCCODE', 'BANKNAME', 'BRANCHNAME', 'BANKSTATUS', 'ALLSTATUS', 'ISPROFILESTATUS',
  'CREATEDATE', 'ALLAPPROVEDDATE', 'KYCMODE', 'PRIVIOUSMODE', 'KYCATTEMPT'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (set by Index, read by ExportReport).
let url = '';
let url1 = '';

const kycReport = (p) => db.proc(DB, 'USP_MEMBERKYC_DETAILS_REPORT', {
  STARTROWINDEX: p.page, MAXROWS: p.MaxRows, SEARCHFIELD: p.SearchField, SEARCHVALUE: p.SearchValue, FROMDATE: p.FromDate, TODATE: p.ToDate,
  SERACHALLSTATUS: p.AllStatus, KYCATTEMP: p.Userkycattempt,
});

// public void ExportReport(int? dynamicpagging, int? page, string SearchField, int AllStatus, string SearchValue, string FromDate, string ToDate, int Userkycattempt)
async function ExportReport(req, res, dynamicpagging, page, SearchField, AllStatus, SearchValue, FromDate, ToDate, Userkycattempt, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'All_MemberKYC_List_' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const ListKycType = mapRows(await db.proc(DB, 'USP_MEMBERKYC_STATUSIMG', { MODE: 5, REGNO: 0 }), KYCTYPE);
  const MaxRows = dynamicpagging === null ? 0 : dynamicpagging; // Convert.ToInt32(int?) (null => 0)
  if (page === null) page = 1;
  const list = mapRows(await kycReport({ page, MaxRows, SearchField, SearchValue, FromDate, ToDate, AllStatus, Userkycattempt }), MEMBER_KYC_LIST);
  if (list.length > 0) {
    let header = 'Sr.No. \tUser Name \tMobile No \tEmail \tCreated Date \tKYC Mode \t';
    for (const item of ListKycType) {
      if (item.TITLE === 'ID Proof') header += 'ID Proof \t';
      if (item.TITLE === 'Residential Proof') header += 'Residential Proof \t';
      if (item.TITLE === 'Taxation Document') header += 'Taxation Document  \t';
      if (item.TITLE === 'Bank') header += 'Bank  \t';
      if (item.TITLE === 'Profile') header += 'Profile  \t';
    }
    header += 'All Status \tAll Approved Date \t';
    return writeXlsExport({
      req, res, ViewBag, sheet: 'All_MemberKYC_List_.xls', Filename, rawHeaders: header, rows: list, innerProc: 'ExportReport', rethrow: true,
      cells: (item, w) => {
        w('\n');
        w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
        w(tab(cellStr(item, 'USERNAME')) + ' \t');
        w(tab(cellStr(item, 'MOBILE')) + ' \t');
        w(tab(cellStr(item, 'EMAILID')) + ' \t');
        w(tab(netFormat(col(item, 'CREATEDATE'), 'dd-MMM-yyyy')) + ' \t');
        if (Number(item.KYCMODE) === 1) w(tab('Offline') + ' \t');
        else if (Number(item.KYCMODE) === 2) w(tab('Online') + ' \t');
        else w(tab('NA') + ' \t');
        for (const item1 of ListKycType) {
          if (item1.TITLE === 'ID Proof') w(tab(cellStr(item, 'PHOTOSTATUS')) + ' \t');
          if (item1.TITLE === 'Residential Proof') w(tab(cellStr(item, 'IDFRUNTIMGSTATUS')) + ' \t');
          if (item1.TITLE === 'Taxation Document') w(tab(cellStr(item, 'PANSTATUS')) + ' \t');
          if (item1.TITLE === 'Bank') w(tab(cellStr(item, 'BANKSTATUS')) + ' \t');
          if (item1.TITLE === 'Profile') w(tab(cellStr(item, 'ISPROFILESTATUS')) + ' \t');
        }
        w(tab(cellStr(item, 'ALLSTATUS')) + ' \t');
        if (netFormat(col(item, 'ALLAPPROVEDDATE'), 'yyyy-MM-dd') !== '1900-01-01') w(tab(netFormat(col(item, 'ALLAPPROVEDDATE'), 'dd-MMM-yyyy')) + ' \t');
        else w(tab('NA') + ' \t');
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] Index(Int32? dynamicpagging, string SearchField, string SearchValue, string SearchAllStatus,
//   string FromDate, string ToDate, Int32? page, string btnexel, string KYCAttempt)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/Member-KYC-List/{SearchAllStatus}" -> Member_KYC_List/Index (SearchAllStatus optional)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Member-KYC-List{/:SearchAllStatus}'], adminAuth, asyncHandler(async (req, res) => {
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let AllStatus = 0;
  let Userkycattempt = 0;
  let dynamicpagging = nInt(req.p.dynamicpagging); if (dynamicpagging === null) dynamicpagging = 100;
  const SearchField = s0(req.p.SearchField);
  const KYCAttempt = nStr(req.p.KYCAttempt);
  if (KYCAttempt === null) Userkycattempt = 0;
  else Userkycattempt = cvtInt(KYCAttempt);
  const SearchAllStatus = nStr(req.p.SearchAllStatus);
  if (SearchAllStatus === '' || SearchAllStatus === null) AllStatus = 10;
  else AllStatus = cvtInt(SearchAllStatus);
  const SearchValue = s0(req.p.SearchValue);
  const FromDate = s0(req.p.FromDate);
  const ToDate = s0(req.p.ToDate);
  const btnexel = s0(req.p.btnexel);
  let page = nInt(req.p.page);
  const ViewBag = {};
  Object.assign(ViewBag, await perms(req.user.emp_id, url));
  const MaxRows = dynamicpagging;
  if (page === null) page = 1;
  const rows = await kycReport({ page, MaxRows, SearchField, SearchValue, FromDate, ToDate, AllStatus, Userkycattempt });
  const ListKyc_Deatils = mapRows(rows, MEMBER_KYC_LIST);
  const tc = outOf(rows, 'totalcount');
  const TotalRecod = parseInt(tc === '' ? '0' : tc, 10);
  Object.assign(ViewBag, {
    CurrentPage: page, TotalRecord: TotalRecod, dynamicpagging, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchValue, SearchField,
    SearchAllStatus, FromDate, ToDate,
  });
  if (btnexel === 'Export Excel') {
    const r = await ExportReport(req, res, dynamicpagging, page, SearchField, AllStatus, SearchValue, FromDate, ToDate, Userkycattempt, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Member_KYC_List/Index.cshtml', Model: ListKyc_Deatils, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(int? dynamicpagging, int? page, string SearchField, int AllStatus, string SearchValue,
//   string FromDate, string ToDate, int Userkycattempt)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const AllStatus = reqInt(req.p.AllStatus, 'AllStatus');
  const Userkycattempt = reqInt(req.p.Userkycattempt, 'Userkycattempt');
  const r = await ExportReport(req, res, nInt(req.p.dynamicpagging), nInt(req.p.page), nStr(req.p.SearchField), AllStatus, nStr(req.p.SearchValue),
    nStr(req.p.FromDate), nStr(req.p.ToDate), Userkycattempt, {});
  if (!r.sent) res.send('');
}));

/** Path.GetExtension (null => null; no extension => "") */
const getExt = (p) => (p === null || p === undefined ? null : path.extname(String(p)));
const IMG_EXT = ['.jpg', '.png', '.gif', '.jpeg', '.bmp'];
/** File.OpenText(MemberURL + name).ReadLine() (first line or null).
 * PORT-NOTE: MemberKYCURL is read from config.app.MemberKYCURL (legacy Windows path prefix). */
function readFirstLine(MemberURL, name) {
  const txt = fs.readFileSync(String(MemberURL === undefined || MemberURL === null ? '' : MemberURL) + String(name), 'utf8');
  if (txt.length === 0) return null;
  return txt.split(/\r\n|\n|\r/)[0];
}
async function kycImage(Regno, MODE) {
  const WebsiteUrls = firstCol(await db.query(DB, 'select software_url from tbl_companymaster where comid = 1', {}));
  const rows = await db.proc(DB, 'USP_MEMBERKYC_STATUSIMG', { MODE, REGNO: Regno });
  if (!rows.length) throw nullRef(); // lstimg.X on a null row
  return { WebsiteUrls: WebsiteUrls === null ? '' : WebsiteUrls, lstimg: mapRow(rows[0], GET_ALL_IMAGE) };
}

/** shared body of GetPhotoStatusIMG / GetPanCradIMG / GetBankIMG */
function singleImage(MODE, field) {
  return asyncHandler(async (req, res) => {
    const Regno = reqInt(req.p.Regno, 'Regno');
    // if (Regno != null) - always true for an int (the "some error occurred" branch is unreachable)
    let NewStrmImge = '';
    const MemberURL = config.app.MemberKYCURL;
    const { WebsiteUrls, lstimg } = await kycImage(Regno, MODE);
    const img = lstimg[field];
    const Extension = getExt(img);
    if (Extension === '.txt') {
      if (img !== '') {
        const GetImg = readFirstLine(MemberURL, img);
        if (GetImg !== null) NewStrmImge = GetImg;
      }
    }
    if (IMG_EXT.includes(Extension)) {
      if (img !== '') NewStrmImge = WebsiteUrls + '/KYC_Images/' + img;
    }
    return res.json(NewStrmImge);
  });
}

// ---------------------------------------------------------------- JsonResult GetPhotoStatusIMG(int Regno)
// auth (PORT-NOTE: legacy had no session check on member KYC images - protected)
router.all(`/admin/${C}/GetPhotoStatusIMG{/:id}`, adminAuth, singleImage(1, 'PHOTOIMAGE'));

// ---------------------------------------------------------------- JsonResult GetPanCradIMG(int Regno)
// auth (PORT-NOTE: legacy had no session check on member KYC images - protected)
router.all(`/admin/${C}/GetPanCradIMG{/:id}`, adminAuth, singleImage(3, 'PANCARDIMG'));

// ---------------------------------------------------------------- JsonResult GetBankIMG(int Regno)
// auth (PORT-NOTE: legacy had no session check on member KYC images - protected)
router.all(`/admin/${C}/GetBankIMG{/:id}`, adminAuth, singleImage(4, 'BANKIMG'));

// ---------------------------------------------------------------- JsonResult GetFruntBackIMG(int Regno)
// auth (PORT-NOTE: legacy had no session check on member KYC images - protected)
router.all(`/admin/${C}/GetFruntBackIMG{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Regno = reqInt(req.p.Regno, 'Regno');
  let NewReadStrmfruntImge = ''; let FruntImg = ''; let BackImg = '';
  const MemberURL = config.app.MemberKYCURL;
  const { WebsiteUrls, lstimg } = await kycImage(Regno, 2);
  const ExtFrunt = getExt(lstimg.FRUNTIMG);
  const ExtBack = getExt(lstimg.BACKIMG);
  if (ExtFrunt === '.txt' || ExtBack === '.txt') {
    if (lstimg.FRUNTIMG !== '' && lstimg.BACKIMG !== '') {
      let GetImg = readFirstLine(MemberURL, lstimg.FRUNTIMG);
      if (GetImg !== null) FruntImg = GetImg;
      GetImg = readFirstLine(MemberURL, lstimg.BACKIMG);
      if (GetImg !== null) BackImg = GetImg;
      NewReadStrmfruntImge = FruntImg + '^' + BackImg;
    }
  }
  if (IMG_EXT.includes(ExtFrunt)) {
    if (lstimg.FRUNTIMG !== '') FruntImg = WebsiteUrls + '/KYC_Images/' + lstimg.FRUNTIMG;
    if (IMG_EXT.includes(ExtBack)) {
      if (lstimg.BACKIMG !== '') BackImg = WebsiteUrls + '/KYC_Images/' + lstimg.BACKIMG;
      NewReadStrmfruntImge = FruntImg + '^' + BackImg;
    }
  }
  return res.json(NewReadStrmfruntImge);
}));

module.exports = router;
