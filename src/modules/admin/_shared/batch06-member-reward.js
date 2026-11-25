'use strict';
/**
 * Helpers private to admin port batch06: Direct_Member_Reward.cs and Downline_Member_Reward.cs are identical except for the controller
 * name, the procedure ([USP_DIRECTBONANAZREWARD] / [USP_DOWNLINEBONANAZREWARD]), the view folder and 3 Excel headers
 * ("Total/Left/Right Direct" vs "Total/Left/Right Downline"). Their model classes DirectMemberReward / DownlineMemberReward have the same properties.
 * Exports: buildMemberRewardRouter({ C, proc, friendlyUrl, word })
 */
const express = require('express');
const db = require('../../../db');
const asyncHandler = require('../../../middleware/asyncHandler');
const { mapRows } = require('../../../utils/shape');
const UtilityClass = require('../../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./admin-session');
const {
  nInt, nStr, col, str, cvtInt, inlinePerms, nowStamp, excelHistory, writeXlsExport, cellStr, tab,
} = require('./batch06-common');

const DB = 'affiliate';

/** public class DirectMemberReward / DownlineMemberReward */
const MEMBER_REWARD_PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'REWARDNAME', 'TOTALDIRECT', 'LEFTDIRECT', 'RIGHTDIRECT', 'TOTALBUSSINESS',
  'LEFTBUSSINESS', 'RIGHTBUSSINESS', 'ACHIVEDATE', 'TOTALREWARDAMOUNT', 'REWARDAMOUNT', 'ADMINCHARGE', 'TDSCHARGE', 'WALLETTYPE', 'STATUS'];

function buildMemberRewardRouter({ C, proc, friendlyUrl, word }) {
  const router = express.Router();
  // PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
  const S = { url: '', url1: '' };

  /** [proc] @REGNO,@STARTROWINDEX,@MAXROWS,@SEARCHFIELD,@SEARCHVALUE,@FROMDATE,TODATE,@TOTALCOUNT OUT
   *  PORT-NOTE: the legacy batch text has `TODATE` WITHOUT '@', so T-SQL passed the literal string 'TODATE' as that positional
   *  argument and the @TODATE SqlParameter was ignored; reproduced by sending 'TODATE'. */
  const callProc = (REGNO, STARTROWINDEX, MAXROWS, SEARCHFIELD, SEARCHVALUE, FROMDATE) => db.proc(DB, proc, {
    REGNO, STARTROWINDEX, MAXROWS, SEARCHFIELD, SEARCHVALUE, FROMDATE, TODATE: 'TODATE',
  });

  /** public void ExportReport(string FromDate, string ToDate, string SearchField, string SearchValue) */
  async function ExportReport(req, res, FromDate, ToDate, SearchField, SearchValue, ViewBag) {
    const userid = req.user.emp_id;
    const Filename = 'Direct_Member_Reward_' + userid + '_' + nowStamp(); // same prefix in both legacy controllers
    await excelHistory(userid, S.url, Filename);
    const MaxRows = await UtilityClass.GridPageSize();
    const list = mapRows(await callProc(cvtInt('0'), 1, MaxRows, SearchField, SearchValue, FromDate), MEMBER_REWARD_PROPS);
    if (list.length > 0) {
      return writeXlsExport({
        req, res, sheet: 'DirectMemberReward.xls', Filename, ViewBag, rows: list,
        headers: ['S.No.', 'Username', 'Membername', 'Rewardname', 'Achive Date', `Total ${word}`, `Left ${word}`, `Right ${word}`, 'Total Business',
          'Left Business', 'Right Business', 'RewardAmt', 'Total RewardAmt', 'Admin Charge', 'TDS Charge'],
        innerProc: 'getblockedMemberList', outerProc: 'usp_Blocked_memberList',
        cells: (item, w) => {
          w('\n');
          for (const k of ['ROWNUMBER', 'USERNAME', 'NAME', 'REWARDNAME', 'ACHIVEDATE', 'TOTALDIRECT', 'LEFTDIRECT', 'RIGHTDIRECT', 'TOTALBUSSINESS',
            'LEFTBUSSINESS', 'RIGHTBUSSINESS', 'REWARDAMOUNT', 'TOTALREWARDAMOUNT', 'ADMINCHARGE', 'TDSCHARGE']) {
            w(tab(cellStr(item, k)) + ' \t');
          }
        },
      });
    }
    return { sent: false };
  }

  // ---------------------------------------------------------------- ActionResult Index(int? dynamicpagging, string orderbydate, int? Page, string FromDate,
  //   string btnexel, string ToDate, string SearchValue, string SearchField)
  // auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
  // route-config: friendlyUrl -> <C>/Index
  router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, `/admin/${friendlyUrl}`], adminAuth, asyncHandler(async (req, res) => {
    let dynamicpagging = nInt(req.p.dynamicpagging);
    let orderbydate = nStr(req.p.orderbydate);
    let Page = nInt(req.p.Page);
    let FromDate = nStr(req.p.FromDate);
    let btnexel = nStr(req.p.btnexel);
    let ToDate = nStr(req.p.ToDate);
    let SearchValue = nStr(req.p.SearchValue);
    let SearchField = nStr(req.p.SearchField);
    S.url1 = legacyUrl(req).slice(1);
    S.url = '~' + S.url1;
    if (dynamicpagging === null) dynamicpagging = 100;
    if (orderbydate === null) orderbydate = '';
    if (FromDate === null) FromDate = '';
    if (btnexel === null) btnexel = '';
    if (ToDate === null) ToDate = '';
    if (SearchField === null) SearchField = '';
    if (SearchValue === null) SearchValue = '';
    const Employeeid = req.user.emp_id;
    const ViewBag = {};
    const perm = await inlinePerms(Employeeid, S.url);
    ViewBag.isactive = perm.isactive;
    ViewBag.isedit = perm.isedit;
    ViewBag.excelactive = perm.excelactive;
    const MaxRows = Number(dynamicpagging);
    if (Page === null) Page = 1;
    const rows = await callProc(0, Page, MaxRows, SearchField, SearchValue, FromDate);
    const list = mapRows(rows, MEMBER_REWARD_PROPS);
    const tc = str(col(rows[0], 'TOTALCOUNT'));
    const TotalRecord = cvtInt(tc === '' ? '0' : tc);
    ViewBag.CurrentPage = Page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.SearchField = '';
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.SearchValue = SearchValue;
    ViewBag.fromDate = FromDate;
    ViewBag.toDate = ToDate;
    if (btnexel === 'Export Excel') {
      const x = await ExportReport(req, res, FromDate, ToDate, SearchField, SearchValue, ViewBag);
      if (x.sent) return undefined;
    }
    return res.json({ view: `~/Views/AdminPanel/${C}/Index.cshtml`, Model: list, ...ViewBag });
  }));

  // ---------------------------------------------------------------- public void ExportReport(string FromDate, string ToDate, string SearchField, string SearchValue)
  // auth (public method => routable in legacy; reads Session["Admin_User"])
  router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
    const x = await ExportReport(req, res, nStr(req.p.FromDate), nStr(req.p.ToDate), nStr(req.p.SearchField), nStr(req.p.SearchValue), {});
    if (!x.sent) res.send(''); // void action => empty response
  }));

  return router;
}

module.exports = { buildMemberRewardRouter, MEMBER_REWARD_PROPS };
