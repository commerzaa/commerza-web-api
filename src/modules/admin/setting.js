'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Setting.cs (class SettingController, no namespace => /admin/Setting/...)
// Database: affiliate (Db_Affiliate). Tables settings, tbl_rollup_income_slab, tbl_direct_income_slab, tbl_binary_income_slab,
// level_income_slab, growth_level_income_slab, tbl_binary_level_income_slab, tbl_pairincomeslab, tbl_transconditions;
// proc Usp_ManageATCANDWithDrawalSettings (never reached, see below).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const DataUtility = require('../../lib/admin/DataUtility');
const { adminAuth } = require('./_shared/admin-session');
const { nStr, reqInt, reqDec, splitCsv, nullRef, cvtInt, cvtDec, at } = require('./_shared/batch06-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Setting';
const ERROR_URL = 'Controllers/AdminPanel/SettingController';

/** public class GetAllSetting */
const GET_ALL_SETTING_PROPS = ['caption', 'CLUBDESC', 'Value', 'Symbol'];
/** public class GetRollupIncome */
const GET_ROLLUP_INCOME_PROPS = ['TRISID', 'InvestmentFromSlot', 'InvestmentToSlot', 'RollupIncomePercentage'];
/** public class GetDirectIncomeSlab */
const GET_DIRECT_INCOME_SLAB_PROPS = ['TKSMID', 'InvestmentFromSlot', 'InvestmentToSlot', 'ReferralIncomePercentage'];
/** public class GetBinarylevelslabsetting */
const GET_BINARY_LEVEL_SLAB_SETTING_PROPS = ['TBISID', 'LeftVolume', 'RightVolume', 'MatchingVolume', 'Type', 'TypeDescription', 'Active', 'Status'];

/** "#region For ErrorInsert" with the fixed ErrorURL "Controllers/AdminPanel/SettingController" */
async function errorInsertFixed(ExpObj, PROCEDURENAME) {
  try {
    const code = (ExpObj && typeof ExpObj.errno === 'number') ? ExpObj.errno : 0;
    const m = ExpObj && ExpObj.stack ? /:(\d+):\d+\)?\s*$/m.exec(ExpObj.stack.split('\n')[1] || '') : null;
    const line = m ? Number(m[1]) : 0;
    await new DataUtility().ErrorInsert(code, ExpObj ? ExpObj.message : '', PROCEDURENAME, line, ERROR_URL);
  } catch (e) {
    console.error('[admin] Setting ErrorInsert failed:', e.message);
  }
}

/** AlData.Trim('^') (null => NullReferenceException) */
function trimCaret(v) {
  if (v === null || v === undefined) throw nullRef();
  return String(v).replace(/^\^+|\^+$/g, '');
}

/** Convert.ToInt32(decimal): banker's rounding */
function decToInt32(d) {
  const n = Number(d);
  const f = Math.floor(n);
  const diff = n - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

/** SQL Server `datetime` range check (EF inserted DateTime.MinValue for unset non-nullable DateTime properties). */
function sqlDateTime(d) {
  if (d.getUTCFullYear() < 1753) {
    throw new Error('The conversion of a datetime2 data type to a datetime data type resulted in an out-of-range value.\r\nThe statement has been terminated.');
  }
  return d;
}

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Setting" -> Setting/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Setting{/:id}'], adminAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  // select CAPTION,CLUBDESC,Convert(Decimal(10,2),LIMITS)As Value,SYMBOL from Settings where Active=1 and EDITABLE = 1
  const settings = mapRows(await db.query(DB, `select caption, clubdesc, (limits)::numeric(10,2) as value, symbol from settings
    where (active)::int = 1 and (editable)::int = 1`, {}), GET_ALL_SETTING_PROPS);
  const GetRollupIncome = mapRows(await db.query(DB, `select trisid, investmentfromslot, investmenttoslot, rollupincomepercentage
    from tbl_rollup_income_slab where active = 1`, {}), GET_ROLLUP_INCOME_PROPS);
  ViewBag.RollupIncome = GetRollupIncome;
  const GetDirectIncome = mapRows(await db.query(DB, `select tksmid, investmentfromslot, investmenttoslot, referralincomepercentage
    from tbl_direct_income_slab where active = 1`, {}), GET_DIRECT_INCOME_SLAB_PROPS);
  ViewBag.DirectIncome = GetDirectIncome;
  const GetBinary = mapRows(await db.query(DB, `select tbisid, typedescription, leftvolume, rightvolume, matchingvolume, type, active, status
    from tbl_binary_income_slab`, {}), GET_BINARY_LEVEL_SLAB_SETTING_PROPS);
  ViewBag.BinaryIncomeLevel = GetBinary;
  return res.json({ view: '~/Views/AdminPanel/Setting/Index.cshtml', Model: settings, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult UpdateTransaction(string getid)
// auth (PORT-NOTE: legacy had no session check; admin settings mutation => adminAuth)
router.all(`/admin/${C}/UpdateTransaction{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const getid = nStr(req.p.getid);
  let returnval = 1;
  // PORT-NOTE: the legacy string concat lacks a space ("UPDATE TBL_TRANSCONDITIONS" + "SET ...") => "TBL_TRANSCONDITIONSSET": the statement is
  // a syntax error and DataUtility.ExecuteSql throws (unhandled => 500). Kept as-is (parameterised); PostgreSQL rejects it the same way.
  const sqlquery = 'UPDATE TBL_TRANSCONDITIONS' + 'SET ISSTOP=CASE WHEN ISSTOP=1 THEN 0 ELSE 1 END WHERE TCID=@getid';
  returnval = await db.exec(DB, sqlquery, { getid });
  if (returnval > 0) return res.json('ok');
  return res.json('error');
}));

// ---------------------------------------------------------------- JsonResult updatesetting(string getdata)
// auth (reads Session["Admin_User"].Emp_Code)
router.all(`/admin/${C}/updatesetting{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const getdata = nStr(req.p.getdata);
  let returnval = 1;
  const splitfeild = splitCsv(getdata);
  for (const items of splitfeild) {
    if (items.trim() !== '') {
      if (returnval > 0) {
        const splitvalue = items.split(':');
        const getfield = at(splitvalue, 0).trim();
        let getvalue = at(splitvalue, 1).trim();
        if (getvalue.trim() === '') getvalue = '0.00';
        if (getfield.trim() !== '') {
          // PORT-NOTE: legacy concatenated the values into the SQL (injection); parameterised here. LIMITS was a numeric literal.
          returnval = await db.exec(DB, 'update settings set limits = (@getvalue)::numeric where caption = @getfield', { getvalue, getfield });
          const empcode = req.user.emp_code; // read but unused (legacy); `new UtilityClass()` was a no-op
          void empcode;
        }
      }
    }
  }
  if (returnval > 0) return res.json('ok');
  return res.json('error');
}));

/** Shared body of UpdateDirectIncome / UpdateRollupSlab (and the EF slab updates): split "^"-separated rows of ","-separated fields. */
async function slabUpdate(req, res, procName, perRow) {
  let AlData = nStr(req.p.AlData);
  let returnval = 1;
  AlData = trimCaret(AlData);
  const MainSpit = AlData.split('^');
  try {
    for (const MainItems of MainSpit) {
      const PartSplit = MainItems.split(',');
      returnval = await perRow(PartSplit);
    }
    returnval = 1;
  } catch (ExpObj) {
    await errorInsertFixed(ExpObj, procName);
    returnval = 0;
  }
  return res.json(String(returnval));
}

// ---------------------------------------------------------------- JsonResult UpdateDirectIncome(string AlData)
// auth (PORT-NOTE: legacy had no session check; admin settings mutation => adminAuth)
router.all(`/admin/${C}/UpdateDirectIncome{/:id}`, adminAuth, asyncHandler(async (req, res) => slabUpdate(req, res, 'UpdateDirectIncome', async (PartSplit) => {
  const id = cvtInt(at(PartSplit, 0));
  const From = cvtDec(at(PartSplit, 1));
  const To = cvtDec(at(PartSplit, 2));
  const Percentage = cvtDec(at(PartSplit, 3));
  // PORT-NOTE: legacy concatenated the values into the SQL; parameterised here.
  return db.exec(DB, `update tbl_direct_income_slab set investmentfromslot = @From, investmenttoslot = @To, referralincomepercentage = @Percentage
    where tksmid = @id`, { From, To, Percentage, id });
})));

// ---------------------------------------------------------------- JsonResult UpdateRollupSlab(string AlData)
// auth (PORT-NOTE: legacy had no session check; admin settings mutation => adminAuth)
router.all(`/admin/${C}/UpdateRollupSlab{/:id}`, adminAuth, asyncHandler(async (req, res) => slabUpdate(req, res, 'UpdateRollupSlab', async (PartSplit) => {
  const id = cvtInt(at(PartSplit, 0));
  const From = cvtDec(at(PartSplit, 1));
  const To = cvtDec(at(PartSplit, 2));
  const Percentage = cvtDec(at(PartSplit, 3));
  // PORT-NOTE: legacy concatenated the values into the SQL; parameterised here.
  return db.exec(DB, `update tbl_rollup_income_slab set investmentfromslot = @From, investmenttoslot = @To, rollupincomepercentage = @Percentage
    where trisid = @id`, { From, To, Percentage, id });
})));

// ---------------------------------------------------------------- JsonResult UpdateLevelIncomSlab(string AlData)
// auth (PORT-NOTE: legacy had no session check; admin settings mutation => adminAuth)
router.all(`/admin/${C}/UpdateLevelIncomSlab{/:id}`, adminAuth, asyncHandler(async (req, res) => slabUpdate(req, res, 'UpdateLevelIncomSlab', async (PartSplit) => {
  const id = cvtInt(at(PartSplit, 0));
  const Income = cvtDec(at(PartSplit, 1));
  const NumberofMembers = cvtInt(at(PartSplit, 2)); // Convert.ToInt64
  // Db._LEVEL_INCOME_SLAB.Where(a => a.LISID == id).FirstOrDefault(); Row.INCOME = Income; Row.NoOfDownlineMember = n; SaveChanges()
  return db.exec(DB, 'update level_income_slab set income = @Income, noofdownlinemember = @NumberofMembers where lisid = @id',
    { Income, NumberofMembers, id });
})));

// ---------------------------------------------------------------- JsonResult UpdateGrowthLevelIncomSlab(string AlData)
// auth (PORT-NOTE: legacy had no session check; admin settings mutation => adminAuth)
router.all(`/admin/${C}/UpdateGrowthLevelIncomSlab{/:id}`, adminAuth, asyncHandler(async (req, res) => slabUpdate(req, res, 'UpdateGrowthLevelIncomSlab',
  async (PartSplit) => {
    const id = cvtInt(at(PartSplit, 0));
    const Income = cvtDec(at(PartSplit, 1));
    const NumberofMembers = cvtInt(at(PartSplit, 2)); // Convert.ToInt64
    // Db._GROWTH_LEVEL_INCOME_SLAB.Where(a => a.GLISID == id).FirstOrDefault(); Row.INCOME / Row.NoOfDownlineMember; SaveChanges()
    return db.exec(DB, 'update growth_level_income_slab set income = @Income, noofdownlinemember = @NumberofMembers where glisid = @id',
      { Income, NumberofMembers, id });
  })));

// ---------------------------------------------------------------- JsonResult UpdateATCRateAndWithdrawalSettings(string ATCRate, string MinWithdrawal, string MaxWithdrawal)
// auth (PORT-NOTE: legacy had no session check; admin settings mutation => adminAuth)
router.all(`/admin/${C}/UpdateATCRateAndWithdrawalSettings{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const ATCRate = nStr(req.p.ATCRate); // eslint-disable-line no-unused-vars
  const MinWithdrawal = nStr(req.p.MinWithdrawal); // eslint-disable-line no-unused-vars
  const MaxWithdrawal = nStr(req.p.MaxWithdrawal); // eslint-disable-line no-unused-vars
  // [Usp_ManageATCANDWithDrawalSettings] @ATCRate,@MinWithdrawal,@MaxWithdrawal,@UserId,@Mode,@IntResult OUT  (UserId "0", Mode "2")
  // PORT-NOTE: the proc has no @ATCRate parameter; the positional EXEC therefore passed @IntResult OUT in the 6th position (@AdminWithKyc,
  // not an OUTPUT parameter) and SQL Server rejected the call (error 8162) before executing anything; no try/catch => 500.
  // Reproduced without calling the function.
  const e = new Error('The formal parameter "@AdminWithKyc" was not declared as an OUTPUT parameter, but the actual parameter passed in requested output.');
  e.status = 500;
  throw e;
}));

// ---------------------------------------------------------------- JsonResult UpdateBinaryLevelIncomSlab(string AlData)
// auth (PORT-NOTE: legacy had no session check; admin settings mutation => adminAuth)
router.all(`/admin/${C}/UpdateBinaryLevelIncomSlab{/:id}`, adminAuth, asyncHandler(async (req, res) => slabUpdate(req, res, 'UpdateBinaryLevelIncomSlab',
  async (PartSplit) => {
    const id = cvtInt(at(PartSplit, 0));
    const Leftvolume = cvtDec(at(PartSplit, 1));
    const RightVoulme = cvtInt(at(PartSplit, 2)); // Convert.ToInt64 (decimal target)
    const MatchingVoulme = cvtInt(at(PartSplit, 3)); // Convert.ToInt64 (decimal target)
    // Db._TBL_BINARY_INCOME_SLAB.Where(a => a.TBISID == id).FirstOrDefault(); LeftVolume / RightVolume / MatchingVolume; SaveChanges()
    return db.exec(DB, `update tbl_binary_income_slab set leftvolume = @Leftvolume, rightvolume = @RightVoulme, matchingvolume = @MatchingVoulme
      where tbisid = @id`, { Leftvolume, RightVoulme, MatchingVoulme, id });
  })));

// ---------------------------------------------------------------- JsonResult UpdateBinaryLevelIncome(string AlData)
// auth (PORT-NOTE: legacy had no session check; admin settings mutation => adminAuth)
router.all(`/admin/${C}/UpdateBinaryLevelIncome{/:id}`, adminAuth, asyncHandler(async (req, res) => slabUpdate(req, res, 'UpdateBinaryLevelIncome',
  async (PartSplit) => {
    const id = cvtInt(at(PartSplit, 0));
    const Income = cvtDec(at(PartSplit, 1));
    const NumberofMembers = cvtInt(at(PartSplit, 2)); // Convert.ToInt32
    // Db._TBL_BINARYLevel_INCOME_SLAB.Where(a => a.TBLISID == id).FirstOrDefault(); Row.Income / Row.NoOfDownlineMember; SaveChanges()
    return db.exec(DB, 'update tbl_binary_level_income_slab set income = @Income, noofdownlinemember = @NumberofMembers where tblisid = @id',
      { Income, NumberofMembers, id });
  })));

// ---------------------------------------------------------------- JsonResult AddPair(int pair, int flush)
// auth (PORT-NOTE: legacy had no session check; admin settings mutation => adminAuth)
router.all(`/admin/${C}/AddPair{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const pair = reqInt(req.p.pair, 'pair');
  const flush = reqInt(req.p.flush, 'flush');
  let returnval = 1;
  try {
    // new Tbl_PairIncomeSlab { Pair = pair, Status = 1, IsFlush = flush } ; Db._Tbl_PairIncomeSlab.Add(PS); Db.SaveChanges()
    // PORT-NOTE: EF also inserted the unset non-nullable INSERTEDDATE/UPDATEDDATE as DateTime.MinValue into SQL `datetime` columns, which
    // SQL Server rejects (out-of-range) => the legacy action always ended in the catch ("0"). The same range check is applied here.
    const MinValue = new Date(Date.UTC(1, 0, 1));
    MinValue.setUTCFullYear(1);
    const INSERTEDDATE = sqlDateTime(MinValue);
    const UPDATEDDATE = sqlDateTime(MinValue);
    await db.exec(DB, `insert into tbl_pairincomeslab (pair, status, isflush, inserteddate, updateddate)
      values (@pair, 1, @flush, @INSERTEDDATE, @UPDATEDDATE)`, { pair, flush, INSERTEDDATE, UPDATEDDATE });
    returnval = 1;
  } catch (ExpObj) {
    await errorInsertFixed(ExpObj, 'AddPair');
    returnval = 0;
  }
  return res.json(String(returnval));
}));

// ---------------------------------------------------------------- ActionResult UpdatePair(decimal pair, decimal Flush, decimal PairId)
// auth (PORT-NOTE: legacy had no session check; admin settings mutation => adminAuth)
router.all(`/admin/${C}/UpdatePair{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const pair = reqDec(req.p.pair, 'pair');
  const Flush = reqDec(req.p.Flush, 'Flush');
  const PairId = reqDec(req.p.PairId, 'PairId');
  let returnval = 0;
  try {
    // Db._Tbl_PairIncomeSlab.Where(a => a.TPISID == PairId && a.Status == 1).FirstOrDefault(); Row.Pair / Row.IsFlush; SaveChanges()
    const Row = await db.queryOne(DB, 'select tpisid from tbl_pairincomeslab where tpisid = @PairId and status = 1 limit 1', { PairId });
    if (Row !== null) {
      await db.exec(DB, 'update tbl_pairincomeslab set pair = @p, isflush = @f where tpisid = @id',
        { p: decToInt32(pair), f: decToInt32(Flush), id: Row.tpisid });
      returnval = 1;
    }
  } catch (ExpObj) {
    await errorInsertFixed(ExpObj, 'UpdatePair');
    returnval = 0;
  }
  return res.json(String(returnval));
}));

module.exports = router;
