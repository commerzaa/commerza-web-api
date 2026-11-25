'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Change_KycMode_ListController.cs (class Change_KycMode_ListController => /admin/Change_KycMode_List/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const { s, ni, col, str, cvtInt } = require('./_shared/batch04A_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Change_KycMode_List';

/** class MemberKYC_List (Controllers/AdminPanel/Member_KYC_ListController.cs) */
const KYC_PROPS = ['ROWNUMBER', 'REGNO', 'USERNAME', 'LOGINID', 'MOBILE', 'EMAILID', 'PHOTOIMAGE', 'PTITLE', 'PHOTOSTATUS', 'IDFRUNTIMGTITLE',
  'IDFRUNTIMGTYPETITLE', 'IDFRUNTIMGNO', 'FRUNTIMG', 'BACKIMG', 'IDFRUNTIMGSTATUS', 'PCTITLE', 'PCIDTYPETITLE', 'PCIDNO', 'PANCARDIMG', 'PANSTATUS',
  'BANKIMG', 'TBIDTITLE', 'ACCOUNTNO', 'ACCOUNTHOLDERNAME', 'IFSCCODE', 'BANKNAME', 'BRANCHNAME', 'BANKSTATUS', 'ALLSTATUS', 'ISPROFILESTATUS',
  'CREATEDATE', 'ALLAPPROVEDDATE', 'KYCMODE', 'PRIVIOUSMODE', 'KYCATTEMPT'];

// private static string url, url1 (process-wide; only assigned)
let url = '';
let url1 = '';

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(Int32? dynamicpagging, string username, string FromDate, string SearchAllStatus, string ToDate, Int32? page)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/change-kycmode-report" -> Change_KycMode_List/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/change-kycmode-report'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = ni(req.p.dynamicpagging); const username = s(req.p.username); let FromDate = s(req.p.FromDate);
  const SearchAllStatus = s(req.p.SearchAllStatus); let ToDate = s(req.p.ToDate); let page = ni(req.p.page);
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  let AllStatus = 0;
  let DcryptUsername = '';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (username === null) DcryptUsername = '';
  else DcryptUsername = await UtilityClass.Decryptword(username);
  if (FromDate === null) FromDate = '';
  if (ToDate === null) ToDate = '';
  if (SearchAllStatus === '' || SearchAllStatus === null) AllStatus = 10;
  else AllStatus = cvtInt(SearchAllStatus);
  const ViewBag = {};
  ViewBag.User = DcryptUsername;
  // DB._Member_Master.Where(x => x.userName == DcryptUsername).Select(p => p.regNo).FirstOrDefault()  (double, default 0)
  const r = await db.scalar(DB, 'select regno from member_master where username = @DcryptUsername limit 1', { DcryptUsername });
  const regno = r === null || r === undefined ? 0 : Number(r);
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;
  // [Dbo].[USP_MEMBERKYC_DETAILS_REPORT_APPEMT] @REGNO,@STARTROWINDEX,@MAXROWS,@SEARCHFIELD,SEARCHVALUE,@FROMDATE,@TODATE,@SERACHALLSTATUS,@TOTALCOUNT OUT
  // PORT-NOTE: the legacy command text has `SEARCHVALUE` without '@' => T-SQL passed the literal string 'SEARCHVALUE' as @SEARCHVALUE; kept.
  const raw = await db.proc(DB, 'USP_MEMBERKYC_DETAILS_REPORT_APPEMT', {
    REGNO: regno, STARTROWINDEX: page, MAXROWS: MaxRows, SEARCHFIELD: '', SEARCHVALUE: 'SEARCHVALUE', FROMDATE: FromDate, TODATE: ToDate,
    SERACHALLSTATUS: AllStatus,
  });
  const ListKyc_Deatils = mapRows(raw, KYC_PROPS);
  const tc = str(col(raw[0], 'totalcount'));
  const TotalRecod = parseInt(tc === '' ? '0' : tc, 10);
  ViewBag.CurrentPage = page;
  ViewBag.TotalRecord = TotalRecod;
  ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.UserName = username;
  ViewBag.FromDate = FromDate;
  ViewBag.ToDate = ToDate;
  ViewBag.SearchAllStatus = SearchAllStatus;
  return res.json({ view: '~/Views/AdminPanel/Change_KycMode_List/Index.cshtml', Model: ListKyc_Deatils, ...ViewBag });
}));

module.exports = router;
