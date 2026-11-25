'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/BTC_Wallet_Statement.cs (BTC_Wallet_StatementController)
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
const UtilityClass = require('../../lib/member/UtilityClass');
const BitCoinCoreDaemon = require('../../lib/member/BitCoinCoreDaemon');

const router = express.Router();
const DB = 'affiliate';

const STATEMENT_PROPS = ['RowNumber', 'ProcessDate', 'CrDrType', 'Cr_Amount', 'Dr_Amount', 'Remark', 'Old_Bal', 'Balance'];
const optInt = (v) => { if (v === undefined || v === null || String(v).trim() === '') return null; const n = parseInt(v, 10); return Number.isNaN(n) ? null : n; };
const uname = (req) => (req.user.username !== undefined ? req.user.username : req.user.userName);
const col = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };
// Convert.ToInt32(string)
const convInt = (v) => {
  if (v === undefined || v === null) return 0;
  if (!/^\s*[+-]?\d+\s*$/.test(String(v))) throw new Error('Input string was not in a correct format.');
  return parseInt(v, 10);
};
const regexItem = /^[a-zA-Z0-9 ]*$/;
// the injection-keyword blacklist the legacy code applied to each text input
const hasBad = (x) => {
  const l = x.toLowerCase();
  return l.includes('union') || l.includes('union all') || l.includes('insert') || l.includes('update') || l.includes('drop') || l.includes('delete') || l.includes('exec') || l.includes('select');
};
/** Applies the legacy "Validation Here" block to one input (null stays null). */
function sanitize(v) {
  if (v !== null && v !== undefined) {
    if (v.length > 100) v = '';
    if (hasBad(v)) v = '';
    if (!regexItem.test(v)) v = '';
  }
  return v;
}

/** ExportReport body. Returns true on success, false when the legacy code did Response.Redirect("/page-not-found"). */
async function exportReport(req, page, fromDate, toDate, CrDrType, TrType) {
  const MaxRows = 10000;
  if (page === null || page === undefined) page = 1;
  if (fromDate === null || fromDate === undefined) fromDate = '';
  if (toDate === null || toDate === undefined) toDate = '';
  if (CrDrType === null || CrDrType === undefined) CrDrType = '';
  if (TrType === null || TrType === undefined) TrType = '0';
  if (TrType === '') TrType = '0';
  try {
    const Plid = Number(req.user.plid);
    const UserName = uname(req);
    const rows = await db.proc(DB, 'usp_btc_transactionhistory', {
      plid: Plid, fromdate: fromDate, todate: toDate, startrowindex: page, maxrows: MaxRows, crdrtype: CrDrType, trtype: convInt(TrType),
    });
    const Obj = mapRows(rows, STATEMENT_PROPS);

    const dir = path.join(config.uploadDir, 'AllExcelSheets');
    fs.mkdirSync(dir, { recursive: true });
    const Filepath = path.join(dir, `BTC_Wallet_Statement_Of_${UserName}.xls`);
    if (fs.existsSync(Filepath)) fs.unlinkSync(Filepath);

    const sv = (v) => (v === null || v === undefined ? '' : String(v));
    let out = '';
    out += 'S.NO. \t';
    out += 'UserName \t';
    out += 'Process Date \t';
    out += 'Transaction Type \t';
    out += 'Cr Amount \t';
    out += 'Dr Amount \t';
    out += 'Particulars \t';
    out += 'Old Balance \t';
    out += 'Balance \t';
    for (const Item of Obj) {
      out += '\r\n';
      out += `${sv(Item.RowNumber)} \t`;
      out += `${sv(UserName)} \t`;
      out += `${sv(Item.ProcessDate)} \t`;
      out += `${sv(Item.CrDrType)} \t`;
      out += `${sv(Item.Cr_Amount)} \t`;
      out += `${sv(Item.Dr_Amount)} \t`;
      out += `${sv(Item.Remark)} \t`;
      out += `${sv(Item.Old_Bal)} \t`;
      out += `${sv(Item.Balance)} \t`;
    }
    fs.writeFileSync(Filepath, out, 'utf8');
    return true;
  } catch (e) {
    console.error('BTC_Wallet_Statement/ExportReport', e);
    return false;
  }
}

// auth ([SessionExpireCheck])
// route-config: "referral/btc-wallet-statement" -> BTC_Wallet_Statement/Index
router.all(['/member/BTC_Wallet_Statement/Index{/:id}', '/member/referral/btc-wallet-statement'], auth, asyncHandler(async (req, res) => {
  let page = optInt(req.p.page);
  let fromDate = req.p.fromDate === undefined ? null : req.p.fromDate;
  let toDate = req.p.toDate === undefined ? null : req.p.toDate;
  let CrDrType = req.p.CrDrType === undefined ? null : req.p.CrDrType;
  let TrType = req.p.TrType === undefined ? null : req.p.TrType;
  let GenerateExcel = req.p.GenerateExcel === undefined ? null : req.p.GenerateExcel;

  // Auto approval of BTC node deposits (fire-and-forget thread in legacy)
  const RegNoBg = Number(req.user.plid);
  Promise.resolve().then(() => BitCoinCoreDaemon.PaymentAutoClearificationBTCNode(RegNoBg)).catch((e) => console.error('PaymentAutoClearificationBTCNode', e));

  // ---- Validation Here ----
  if (GenerateExcel !== null) {
    if (GenerateExcel.length > 100) GenerateExcel = '';
    // legacy tests TrType.ToLower() here too (throws when TrType is null, as the NullReferenceException did)
    const ge = GenerateExcel.toLowerCase();
    if (ge.includes('union') || ge.includes('union all') || ge.includes('insert') || ge.includes('update') || ge.includes('drop') || ge.includes('delete') || ge.includes('exec') || TrType.toLowerCase().includes('select')) GenerateExcel = '';
    if (!regexItem.test(GenerateExcel)) GenerateExcel = '';
  }
  TrType = sanitize(TrType);
  CrDrType = sanitize(CrDrType);
  toDate = sanitize(toDate);
  fromDate = sanitize(fromDate);

  const MaxRows = await UtilityClass.GridPageSize();
  if (page === null) page = 1;
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (CrDrType === null) CrDrType = '';
  if (TrType === null) TrType = '0';
  if (TrType === '') TrType = '0';
  let Obj = [];
  const ViewBag = {};
  try {
    const Plid = Number(req.user.plid);
    ViewBag.UserName = uname(req);
    // PORT-NOTE: OUT params (@StrResult,@TotalCount) are read from columns of the first result row.
    const rows = await db.proc(DB, 'usp_btc_transactionhistory', {
      plid: Plid, fromdate: fromDate, todate: toDate, startrowindex: page, maxrows: MaxRows, crdrtype: CrDrType, trtype: convInt(TrType),
    });
    Obj = mapRows(rows, STATEMENT_PROPS);
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.CrDrType = CrDrType;
    ViewBag.TrType = TrType;
    const tc = col(rows[0], 'totalcount');
    const TotalRecord = tc === null ? 0 : parseInt(tc, 10);
    ViewBag.CurrentPage = page;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  } catch (e) {
    console.error('BTC_Wallet_Statement/Index', e);
    return res.json({ redirect: '/page-not-found' });
  }

  // ---- For Download Excel ----
  if (GenerateExcel !== null && GenerateExcel === 'Generate Excel') {
    if (!(await exportReport(req, page, fromDate, toDate, CrDrType, TrType))) {
      return res.json({ redirect: '/page-not-found' });
    }
  }
  return res.json({ view: '~/Views/CustomerPanel/BTC_Wallet_Statement/Index.cshtml', Model: Obj, ViewBag });
}));

// auth. public void ExportReport(int? page, fromDate, toDate, CrDrType, TrType): writes the .xls file on the server, returns an empty response.
router.all('/member/BTC_Wallet_Statement/ExportReport{/:id}', auth, asyncHandler(async (req, res) => {
  const ok = await exportReport(req, optInt(req.p.page), req.p.fromDate === undefined ? null : req.p.fromDate, req.p.toDate === undefined ? null : req.p.toDate,
    req.p.CrDrType === undefined ? null : req.p.CrDrType, req.p.TrType === undefined ? null : req.p.TrType);
  if (!ok) return res.json({ redirect: '/page-not-found' });
  return res.end();
}));

module.exports = router;
