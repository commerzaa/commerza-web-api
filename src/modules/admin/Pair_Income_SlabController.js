'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Pair_Income_SlabController.cs (class Pair_Income_SlabController => /admin/Pair_Income_Slab/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const { nStr, cvtInt, at, nullRef, firstCol } = require('./_shared/batch11_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Pair_Income_Slab';

/** Models/PairIncomeSlab.cs class Tbl_PairIncomeSlab */
const SLAB_PROPS = ['TPISID', 'Pair', 'Status', 'IsFlush', 'INSERTEDDATE', 'UPDATEDDATE'];
/** class pair (this file) */
const PAIR_PROPS = ['Row', 'flushname', 'Pair', 'ActivityReport', 'Emp_Name', 'IsFlush'];

/** string.Trim('^') */
const trimCaret = (s) => String(s).replace(/^\^+|\^+$/g, '');
/** Convert.ToInt16(int) (OverflowException outside Int16 range) */
function toInt16(v) {
  if (v < -32768 || v > 32767) throw new Error('Value was either too large or too small for an Int16.');
  return v;
}

// ---------------------------------------------------------------- ActionResult Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Pair-Cutting" -> Pair_Income_Slab/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Pair-Cutting'], adminAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const Count = firstCol(await db.query(DB, 'select count(payid) from payout'));
  ViewBag.Count = Count === null || Count === undefined ? 0 : Number(Count);
  const pairslb = mapRows(await db.query(DB, 'select * from tbl_pairincomeslab where status = 1'), SLAB_PROPS);
  const Pair = mapRows(await db.query(DB,
    `select row_number() over (order by bis.tblisid desc) as row, bis.pair, bis.isflush, em.emp_name, bis.activityreport, bis.flushname
       from tbl_pairincomeslab_history bis left join tbl_employee_master em on bis.userid = em.emp_id order by bis.activityreport desc`), PAIR_PROPS);
  ViewBag.pair = Pair;
  return res.json({ view: '~/Views/AdminPanel/Pair_Income_Slab/Index.cshtml', Model: pairslb, ...ViewBag });
}));

// ---------------------------------------------------------------- ActionResult UpdatePair(string Alldata, string AlHData)
// auth (reads Session["Admin_User"].Emp_ID; writes data)
router.all(`/admin/${C}/UpdatePair{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let Alldata = nStr(req.p.Alldata);
  let AlHData = nStr(req.p.AlHData);
  let returnval = 1;
  let Pid = 0;
  let value = 0;
  let flushpair = '';
  let ismultiple = 0;
  if (Alldata === null) throw nullRef(); // outside the try in legacy => unhandled (500)
  Alldata = trimCaret(Alldata);
  const MainSpits = Alldata.split('^');
  const userid = req.user.emp_id;
  let count = 0;
  if (AlHData === null) throw nullRef();
  AlHData = trimCaret(AlHData);
  const MainSpit = AlHData.split('^');
  try {
    for (const MainItem of MainSpit) {
      const PartSplits = MainItem.split(',');
      Pid = cvtInt(at(PartSplits, 0));
      value = cvtInt(at(PartSplits, 1));
      flushpair = at(PartSplits, 2);
      ismultiple = cvtInt(at(PartSplits, 3));
      await db.exec(DB, `insert into tbl_pairincomeslab_history (pair, isflush, userid, status, flushname, ismultiple)
                         values (@value, 1, @userid, 1, @flushpair, @ismultiple)`, { value, userid, flushpair, ismultiple });
    }
    for (const MainItems of MainSpits) {
      const PartSplit = MainItems.split(',');
      Pid = cvtInt(at(PartSplit, 0));
      value = cvtInt(at(PartSplit, 1));
      ismultiple = cvtInt(at(PartSplit, 3));
      const Row = (await db.query(DB, 'select * from tbl_pairincomeslab where tpisid = @Pid and status = 1 limit 1', { Pid }))[0];
      const c = firstCol(await db.query(DB, 'select count(1) from tbl_pairincomeslab where pair = @value', { value }));
      count = c === null || c === undefined ? 0 : Number(c);
      if (count === 0) {
        if (Row) {
          // Row.Pair = Convert.ToInt16(value); Row.IsFlush = 1; Db.SaveChanges();
          await db.exec(DB, 'update tbl_pairincomeslab set pair = @pair, isflush = 1 where tpisid = @Pid', { pair: toInt16(value), Pid });
          returnval = 1;
        }
      } else {
        returnval = 0;
      }
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'UpdatePair');
    returnval = 0;
  }
  return res.json(String(returnval));
}));

module.exports = router;
