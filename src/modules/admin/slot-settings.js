'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\SlotSettings.cs (class SlotSettingsController => /admin/SlotSettings/...)
// Database: affiliate (Db_Affiliate).
// PORT-NOTE: table Tbl_SlotMaster is not in the schema dump (db/affilate.sql); columns taken from the C# model GetAllSlotSetting.
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nStr, need, at, splitCsv } = require('./_shared/batch13-06-common');

const router = express.Router();
const C = 'SlotSettings';

/** class GetAllSlotSetting */
const PROPS = ['rowNumber', 'SlotId', 'TSMID', 'IsActive'];

// ---------------------------------------------------------------- Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/SlotSettings" -> SlotSettings/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/SlotSettings'], adminAuth, asyncHandler(async (req, res) => {
  const rows = await db.query(DB, `select row_number() over (order by tsmid desc) as rownumber, tsmid, slotid, isactive
    from tbl_slotmaster where isactive = 1`, {});
  return res.json({ view: '~/Views/AdminPanel/SlotSettings/Index.cshtml', Model: mapRows(rows, PROPS) });
}));

// ---------------------------------------------------------------- JsonResult UpdateTransaction(string getid)
// auth (PORT-NOTE: legacy had no session check on this admin update - protected here)
router.all(`/admin/${C}/UpdateTransaction{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const getid = nStr(req.p.getid);
  // PORT-NOTE: legacy concatenated getid into the SQL (injection); parameterised. Missing getid was a SQL syntax error (500).
  need({ getid });
  const returnval = await db.exec(DB,
    'update tbl_transconditions set isstop = case when isstop = 1 then 0 else 1 end where tcid = cast(@getid as bigint)', { getid });
  if (returnval > 0) return res.json('ok');
  return res.json('error');
}));

// ---------------------------------------------------------------- JsonResult updatesetting(string getdata)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/updatesetting{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let returnval = 1;
  const splitfeild = splitCsv(nStr(req.p.getdata)); // getdata.Split(',') (null => NullReferenceException)
  for (const items of splitfeild) {
    if (items.trim() !== '') {
      if (returnval > 0) {
        const splitvalue = items.split(':');
        const getfield = String(at(splitvalue, 0)).trim();
        let getvalue = String(at(splitvalue, 1)).trim();
        if (getvalue.trim() === '') getvalue = '0.00';
        if (getfield.trim() !== '') {
          // "UPDATE Tbl_SlotMaster SET SlotId = '<getvalue>' where TSMID ='<getfield>'" (parameterised)
          returnval = await db.exec(DB, 'update tbl_slotmaster set slotid = @getvalue where tsmid = cast(@getfield as bigint)', { getvalue, getfield });
          const empcode = req.user.emp_code; void empcode; // read, unused (legacy)
        }
      }
    }
  }
  if (returnval > 0) return res.json('ok');
  return res.json('error');
}));

module.exports = router;
