'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Level_DownLine.cs (Level_DownLineController, 2 actions: Index, ExportExcel)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 * route-config: LevelDownLine -> referral/zjsX5hxG67C43TWtO7L4HA==
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { queryOne, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');

const router = express.Router();
const DB = 'affiliate';
const C = 'Level_DownLine';

const s = (v) => (v === null || v === undefined ? '' : String(v));
const nz = (v) => (v === undefined || v === null ? '' : v);
const optInt = (v) => (v === undefined || v === null || v === '' ? null : parseInt(v, 10));
const toInt = (v) => { if (v === undefined || v === null) return 0; const n = parseInt(v, 10); if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.'); return n; };
const totalOf = (rows, n = 'totalcount') => { const r = rows && rows[0]; if (!r) return 0; const k = Object.keys(r).find((x) => x.toLowerCase() === n); return k === undefined ? 0 : Number(r[k] || 0); };
async function errIns(req, e, proc_) {
  try { await new DataUtility().ErrorInsert(0, e && e.message, proc_, 0, req.path); } catch (_) { /* ignore */ }
}
const pad = (n) => String(n).padStart(2, '0');
function nowStamp() { // ddMMyyyyhhmmss
  const d = new Date();
  const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
  return pad(d.getDate()) + pad(d.getMonth() + 1) + d.getFullYear() + pad(h12) + pad(d.getMinutes()) + pad(d.getSeconds());
}
const tabClean = (v) => s(v).replace(/\t/g, '    ');
const P_LEVELDOWNLINE = ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status', 'EmailID', 'ACTIVATEDON', 'TLBV', 'CLBV', 'TRBV', 'CRBV',
  'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'spounser_userName', 'root_userName', 'LCount', 'RCount', 'SideName', 'PARENTID', 'RANKNAME'];

async function loginOf(plid) {
  const row = await queryOne(DB, 'select * from member_master where regno=@plid limit 1', { plid });
  return row ? row.username : '';
}

// ---- Index ------------------------------------------------------------------------------------------------------
// auth
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`, '/member/referral/zjsX5hxG67C43TWtO7L4HA=='], auth, asyncHandler(async (req, res) => {
  let { fromdate, todate, Username, EmailID, SponserID, Name, Level, Fromlevel, Tolevel, ActivationStatus, btnExcel } = req.p;
  let page = optInt(req.p.page);
  let Side = optInt(req.p.Side);
  let RANKID = optInt(req.p.RANKID);
  fromdate = nz(fromdate); todate = nz(todate); Username = nz(Username); EmailID = nz(EmailID); SponserID = nz(SponserID); Name = nz(Name);
  if (Side === null) Side = 0;
  Level = nz(Level); Fromlevel = nz(Fromlevel); Tolevel = nz(Tolevel);
  if (RANKID === null) RANKID = 0;
  if (ActivationStatus === undefined || ActivationStatus === null) ActivationStatus = '0';
  btnExcel = nz(btnExcel);

  const Plid = Number(req.user.plid);
  const loginid = await loginOf(Plid);
  const MaxRows = 100;
  if (page === null) page = 1;
  // PORT-NOTE: @TotalCount / @TotalLRBV / @TOTALLRINCOME OUT params are read from the same-named columns of the first result row (0 when empty)
  const raw = await proc(DB, 'usp_leveldownline', {
    loginid, startrowindex: page, maxrows: MaxRows, searchfield: '', searchvalue: '', fromdate: fromdate.trim(), todate: todate.trim(),
    level: toInt(Level === '' ? '0' : Level), levenumberfrom: toInt(Fromlevel === '' ? '0' : Fromlevel), levenumberto: toInt(Tolevel === '' ? '0' : Tolevel), side: Side,
    name: Name.trim(), username: Username.trim(), emailid: EmailID.trim(), sponserid: SponserID.trim(), checkadminside: 0, activationstatus: toInt(ActivationStatus),
    orderbydate: 'desc', rankid: RANKID,
  });
  const LRMember = mapRows(raw, P_LEVELDOWNLINE);
  const TotalRecord = totalOf(raw);
  const ViewBag = {};
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.rankid = RANKID;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  ViewBag.Name = Name;
  ViewBag.Username = Username;
  ViewBag.side = Side;
  ViewBag.SponserID = SponserID;
  ViewBag.Level = Level;
  ViewBag.ActivationStatus = ActivationStatus;
  if (btnExcel === 'Export Excel') {
    const r = await ExportExcel(req, res, fromdate, todate, Username, EmailID, SponserID, page, Name, Side, Level, ActivationStatus, RANKID);
    if (r.sent) return;
    Object.assign(ViewBag, r.ViewBag);
  }
  res.json({ Model: LRMember, ViewBag });
}));

// ---- ExportExcel (public void action; also called from Index) ----------------------------------------------------
async function ExportExcel(req, res, fromdate, todate, Username, EmailID, SponserID, page, Name, Side, Level, ActivationStatus, RANKID) {
  const FileName = 'Voucher_LevelDownLine_Report' + '_' + nowStamp();
  const ViewBag = {};
  const Plid = Number(req.user.plid);
  const loginid = await loginOf(Plid);
  const MaxRows = 99999999;
  if (page === null || page === undefined) page = 1;
  const raw = await proc(DB, 'usp_leveldownline', {
    loginid, startrowindex: page, maxrows: MaxRows, searchfield: '', searchvalue: '', fromdate: s(fromdate).trim(), todate: s(todate).trim(),
    levenumber: toInt(s(Level) === '' ? '0' : Level), side: Side, name: s(Name).trim(), username: s(Username).trim(), emailid: s(EmailID).trim(), sponserid: s(SponserID).trim(),
    checkadminside: 0, activationstatus: toInt(ActivationStatus), levenumberto: 0, orderbydate: 'desc', rankid: RANKID,
  });
  const LRMember = mapRows(raw, P_LEVELDOWNLINE);
  try {
    let out = 'S.No. \t' + 'Name \t' + 'Username \t' + 'Sponsor \t' + 'Parent \t' + 'Join \t' + 'Rank \t' + 'Level \t';
    for (const item of LRMember) {
      try {
        out += '\n';
        out += tabClean(item.rownumber) + ' \t';
        out += tabClean(item.Name) + ' \t';
        out += tabClean(item.userName) + ' \t';
        out += tabClean(item.spounser_userName) + ' \t';
        out += tabClean(item.PARENTID) + ' \t';
        out += tabClean(item.RegDate) + ' \t';
        out += tabClean(item.RANKNAME) + ' \t';
        out += tabClean(item.EmpLevel) + ' \t';
      } catch (ExpObj) {
        await errIns(req, ExpObj, 'AllEPinRequestsList');
      }
    }
    const dir = path.join(config.uploadDir, 'AllExcelSheets');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'Voucher_LevelDownLine_Report.xls'), out);
    void FileName; // legacy only touched DownloadedExcel/<FileName>.xls (copy never reached after Response.Redirect)
    res.setHeader('Content-Type', 'application/force-download');
    res.setHeader('Content-Disposition', 'attachment; filename=Voucher_LevelDownLine_Report.xls');
    res.send(Buffer.from(out, 'utf8'));
    return { sent: true };
  } catch (ExpObj) {
    await errIns(req, ExpObj, 'usp_All_memberList_paid');
    ViewBag.filepath = ExpObj.message;
  }
  return { sent: false, ViewBag };
}

// auth
router.all(`/member/${C}/ExportExcel{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const r = await ExportExcel(req, res, nz(p.fromdate), nz(p.todate), nz(p.Username), nz(p.EmailID), nz(p.SponserID), optInt(p.page), nz(p.Name), optInt(p.Side), nz(p.Level), p.ActivationStatus, optInt(p.RANKID));
  if (r.sent) return;
  res.json(r.ViewBag);
}));

module.exports = router;
