'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Master_kyc.cs (class Master_kycController => /Master_kyc/...)
// Database: affiliate (Db_Affiliate). Procs: USP_MASTERKYC, USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK. Table: tbl_master_offlinekyc.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, legacyUrl } = require('./_shared/adminSession');
const {
  DB, nInt, nStr, reqInt, cvtInt, inlinePerms, excelLink, excelHistory, nowStamp, writeXlsExport, tab, cellStr, outStr, outIntOf, errorView,
} = require('./_shared/batch09_common');

const router = express.Router();
const C = 'Master_kyc';

/** class MasterKyc */
const PROPS = ['KTID', 'TITLE', 'DESCRIPTION', 'STATUS', 'KYC_ACTIVE'];

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (set by Index, read by ExportReport).
let url = '';
let url1 = '';

// public void ExportReport(int? mode)
async function ExportReport(req, res, mode, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = 'Master_Kyc' + userid + '_' + nowStamp();
  await excelHistory(userid, url, Filename);
  const list = mapRows(await db.proc(DB, 'USP_MASTERKYC', {
    STARTROWINDEX: 1, MAXROWS: 9999999, MODE: mode, KYCNAME: '', KYCDISCRIPTION: '', KYCSTATUS: '', KYCACTIVE: '', TKDID: '0',
  }), PROPS);
  if (list.length > 0) {
    let srno = 1;
    return writeXlsExport({
      req, res, ViewBag, sheet: 'Master_Kyc.xls', downloadName: ' Master_Kyc.xls', Filename,
      headers: ['S.No.', 'KYC NAME', 'KYC DESCRIPTION', 'KYC STATUS'],
      rows: list, innerProc: 'ExportReport', outerProc: 'USP_BANKWITHDRAWLREQUESTREPORT',
      cells: (item, w) => {
        w('\n');
        w(tab(String(srno)) + ' \t');
        w(tab(cellStr(item, 'TITLE')) + ' \t');
        w(tab(cellStr(item, 'DESCRIPTION')) + ' \t');
        w(tab(item.STATUS === true ? 'Active' : 'DeActive') + ' \t');
        srno += 1;
      },
    });
  }
  return { sent: false };
}

// ---------------------------------------------------------------- Index(int? page, int? mode, string btnexel)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Master-kyc" -> Master_kyc/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Master-kyc'], adminAuth, asyncHandler(async (req, res) => {
  let mode = nInt(req.p.mode); if (mode === null) mode = 1;
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  const ViewBag = {};
  const p = await inlinePerms(req.user.emp_id, url);
  ViewBag.isactive = p.isactive;
  ViewBag.isedit = p.isedit;
  ViewBag.excelactive = await excelLink(url);
  let btnexel = nStr(req.p.btnexel); if (btnexel === null) btnexel = '';
  let page = nInt(req.p.page);
  try {
    const MaxRows = await UtilityClass.GridPageSize();
    if (page === null) page = 1;
    // USP_MASTERKYC @STARTROWINDEX,@MAXROWS,@MODE,@KYCNAME,@KYCDISCRIPTION,@KYCSTATUS,@KYCACTIVE,@TKDID,@INTRESULT OUT,@INTCOUNT OUT
    const rows = await db.proc(DB, 'USP_MASTERKYC', {
      STARTROWINDEX: page, MAXROWS: MaxRows, MODE: mode, KYCNAME: '', KYCDISCRIPTION: '', KYCSTATUS: '', KYCACTIVE: '', TKDID: '0',
    });
    const MasterKycDetails = mapRows(rows, PROPS);
    const TotalRecord = outIntOf(rows, 'intcount');
    Object.assign(ViewBag, { CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage() });
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, mode, ViewBag);
      if (r.sent) return undefined;
    }
    return res.json({ view: '~/Views/AdminPanel/Master_kyc/Index.cshtml', Model: MasterKycDetails, ...ViewBag });
  } catch (ExpObj) {
    return errorView(req, res, ExpObj, 'USP_MASTERKYC');
  }
}));

// ---------------------------------------------------------------- public void ExportReport(int? mode)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const r = await ExportReport(req, res, nInt(req.p.mode), {});
  if (!r.sent) res.send('');
}));

// ---------------------------------------------------------------- JsonResult UpdateKyc(int Tkid, string Kycname, string KycDiscription, string status)
// auth (PORT-NOTE: legacy had no session check on this admin write - protected)
router.all(`/admin/${C}/UpdateKyc{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Tkid = reqInt(req.p.Tkid, 'Tkid');
  const row = await db.procOne(DB, 'USP_MASTERKYC', {
    STARTROWINDEX: '1', MAXROWS: '100', MODE: '2', KYCNAME: nStr(req.p.Kycname), KYCDISCRIPTION: nStr(req.p.KycDiscription), KYCSTATUS: '',
    KYCACTIVE: nStr(req.p.status), TKDID: Tkid,
  });
  return res.json(outStr(row, 'intresult'));
}));

// ---------------------------------------------------------------- JsonResult UpdateOfflineKycStatus(string KYCStatus)
// auth (PORT-NOTE: legacy had no session check on this admin write - protected)
router.all(`/admin/${C}/UpdateOfflineKycStatus{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Staus = cvtInt(nStr(req.p.KYCStatus));
  let Message = '';
  // IF EXISTS(SELECT 1 FROM TBL_MASTER_OFFLINEKYC WHERE MOKID=1) Update ... Set STATUS=<Staus> Where MOKID=1
  // ELSE Insert into TBL_MASTER_OFFLINEKYC(KYCNAME,STATUS) values('Offline Kyc',<Staus>)   (parameterised)
  const resCount = await db.tx(DB, async (t) => {
    const ex = await t.queryOne('select 1 as x from tbl_master_offlinekyc where mokid = 1 limit 1', {});
    if (ex) return t.exec('update tbl_master_offlinekyc set status = @Staus where mokid = 1', { Staus });
    return t.exec("insert into tbl_master_offlinekyc (kycname, status) values ('Offline Kyc', @Staus)", { Staus });
  });
  if (resCount === 1) {
    Message = 'success';
    return res.json(Message);
  }
  Message = 'some error occurred';
  return res.json(Message);
}));

module.exports = router;
