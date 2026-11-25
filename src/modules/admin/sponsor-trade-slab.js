'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Sponsor_Trade_Slab.cs
// (class Common.Controllers.AdminPanel.Sponsor_Trade_SlabController => /admin/Sponsor_Trade_Slab/...)
// Database: affiliate (Db_Affiliate). Tables payout, tbl_sponsortradeprofit, tbl_sponsortradeprofit_history, tbl_employee_master; function fun_getcurrentdate().
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const { DB, nStr, cvtInt, cvtDec, at, trimS, firstCol } = require('./_shared/batch11-common');
const { roundHalfEven } = require('./_shared/batch13-07-common');

const router = express.Router();
const C = 'Sponsor_Trade_Slab';

/** public class Sponsor_Trade_Slab */
const SLAB_PROPS = ['STPID', 'INVESTMENTFROM', 'INVESTMENTTO', 'STPPERCENTAGE', 'ACTIVE', 'ACTIVEMEMBER', 'SELFACTIVE', 'Row', 'Emp_Name', 'Date', 'UserId'];

/** string.Trim('^') */
const trimCaret = (s) => trimS(s).replace(/^\^+|\^+$/g, '');

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Sponsor-Trade-Slab" -> Sponsor_Trade_Slab/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Sponsor-Trade-Slab'], adminAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  // select count(PAYID) from PAYOUT
  const Count = Number(firstCol(await db.query(DB, 'select count(payid)::int as count from payout', {})) || 0);
  ViewBag.Count = Count;
  // select STPID,INVESTMENTFROM,INVESTMENTTO,STPPERCENTAGE,ACTIVE,ActiveMember,SelfActive from TBL_SPONSORTRADEPROFIT
  const BinaryLevel = mapRows(await db.query(DB,
    'select stpid, investmentfrom, investmentto, stppercentage, active, activemember, selfactive from tbl_sponsortradeprofit', {}), SLAB_PROPS);
  ViewBag.BinaryIncomeLevel = BinaryLevel;
  // ROW_NUMBER() over(order by STPID desc) as Row, ..., isnull(ActiveMember,'') (INT => 0), isnull(Date,'') (DATETIME => 1900-01-01)
  const BinaryLevel1 = mapRows(await db.query(DB,
    'select row_number() over (order by h.stpid desc) as row, h.userid, h.investmentfrom, h.investmentto, h.stppercentage, h.active, '
    + "coalesce(h.activemember, 0) as activemember, h.selfactive, em.emp_name, coalesce(h.date, '1900-01-01'::timestamp) as date "
    + 'from tbl_sponsortradeprofit_history h left join tbl_employee_master em on h.userid = em.emp_id order by h.stpid desc', {}), SLAB_PROPS);
  return res.json({ view: '~/Views/AdminPanel/Sponsor_Trade_Slab/Index.cshtml', Model: BinaryLevel1, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult UpdateBinaryLevelIncome(string AlData, string AlDatas)
// auth (PORT-NOTE: legacy had no session check but dereferences Session["Admin_User"] (inside its try => returnval 0) => adminAuth)
router.all(`/admin/${C}/UpdateBinaryLevelIncome{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let AlData = nStr(req.p.AlData);
  let AlDatas = nStr(req.p.AlDatas);
  let returnval = 1;
  let id = 0;
  let invesmentfrom = 0;
  let INVESTMENTTO = 0;
  let STPPERCENTAGE = 0;
  let SELFACTIVE = 0;
  AlData = trimCaret(AlData); // null => NullReferenceException (outside the try, like legacy)
  const MainSpit = AlData.split('^');
  AlDatas = trimCaret(AlDatas);
  const MainSpits = AlDatas.split('^');
  try {
    const userid = req.user.emp_id;
    for (const MainItems of MainSpit) {
      const PartSplit = MainItems.split(',');
      if (PartSplit[0] !== '') {
        id = cvtInt(at(PartSplit, 0));
        STPPERCENTAGE = cvtDec(at(PartSplit, 1));
        invesmentfrom = cvtDec(at(PartSplit, 2));
        INVESTMENTTO = cvtDec(at(PartSplit, 3));
        SELFACTIVE = cvtInt(at(PartSplit, 4));
        // insert into [TBL_SPONSORTRADEPROFIT_HISTORY](INVESTMENTFROM,INVESTMENTTO,STPPERCENTAGE,UserId,SelfActive,ACTIVE,Date)
        //   values(<decimal>, Convert.ToInt32(INVESTMENTTO), Convert.ToInt64(STPPERCENTAGE), userid, SELFACTIVE, 1, dbo.FUN_GETCURRENTDATE())
        await db.exec(DB, 'insert into tbl_sponsortradeprofit_history (investmentfrom, investmentto, stppercentage, userid, selfactive, active, date) '
          + 'values (@f, @t, @p, @u, @s, 1, fun_getcurrentdate())', {
          f: invesmentfrom, t: roundHalfEven(INVESTMENTTO), p: roundHalfEven(STPPERCENTAGE), u: userid, s: SELFACTIVE,
        });
      }
    }
    for (const MainItems of MainSpits) {
      const PartSplit = MainItems.split(',');
      id = cvtInt(at(PartSplit, 0));
      STPPERCENTAGE = cvtDec(at(PartSplit, 1));
      invesmentfrom = cvtDec(at(PartSplit, 2));
      INVESTMENTTO = cvtDec(at(PartSplit, 3));
      SELFACTIVE = cvtInt(at(PartSplit, 4));
      // update TBL_SPONSORTRADEPROFIT set INVESTMENTFROM=<PartSplit[2] raw>,INVESTMENTTO=..,STPPERCENTAGE=..,SelfActive=.. where STPID=id
      // (the raw text was concatenated into the SQL; it is bound as a parameter here - it already parsed as a decimal above)
      await db.exec(DB, 'update tbl_sponsortradeprofit set investmentfrom = @f::numeric, investmentto = @t, stppercentage = @p, selfactive = @s where stpid = @id', {
        f: String(PartSplit[2]).trim(), t: INVESTMENTTO, p: STPPERCENTAGE, s: SELFACTIVE, id,
      });
    }
    returnval = 1;
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'TBL_SPONSORTRADEPROFIT_HISTORY');
    returnval = 0;
  }
  return res.json(String(returnval));
}));

module.exports = router;
