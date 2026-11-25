'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Binary_Income_SlabController.cs
// (namespace Common.Controllers.AdminPanel, class Binary_Income_SlabController => /Binary_Income_Slab/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const { DB, sv, toInt32, toDecimal, nullRef } = require('./_shared/batch03-common');

const router = express.Router();
const C = 'Binary_Income_Slab';

/** class GetBinarylevelslabsetting1 */
const PROPS = ['TBISID', 'LeftVolume', 'RightVolume', 'MatchingVolume', 'Type', 'TypeDescription', 'Active', 'Status', 'Row', 'Emp_Name',
  'RIGHTNOOFMEMBER', 'LEFTNOOFMEMBER', 'BINARYINCOME', 'ActivityReport'];

/** C# string.Trim('^') */
const trimCaret = (s) => s.replace(/^\^+|\^+$/g, '');
/** string[i] on a Split result: IndexOutOfRangeException when missing */
const part = (arr, i) => { if (i >= arr.length) throw new Error('Index was outside the bounds of the array.'); return arr[i]; };

// ---------------------------------------------------------------- Index()
// auth
// route-config: "AdminPanel/Binary-Income-Slab" -> Binary_Income_Slab/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Binary-Income-Slab'], adminAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const Count = Number(await db.scalar(DB, 'select count(payid) from payout', {})) || 0;
  ViewBag.Count = Count;
  const GetBinary = mapRows(await db.query(DB, `select tbisid, typedescription, leftvolume, rightvolume, matchingvolume, type, active, status,
    leftnoofmember, rightnoofmember, binaryincome from tbl_binary_income_slab`, {}), PROPS);
  ViewBag.BinaryIncomeLevel = GetBinary;
  const BinarySlab1 = mapRows(await db.query(DB, `select row_number() over (order by bis.tblsid desc) as row, bis.typedescription, bis.leftvolume,
    bis.rightvolume, bis.matchingvolume, em.emp_name, bis.activityreport, leftnoofmember, rightnoofmember, binaryincome
    from tbl_binary_income_slab_history bis left join tbl_employee_master em on bis.userid = em.emp_id order by bis.activityreport desc`, {}), PROPS);
  return res.json({ view: '~/Views/AdminPanel/Binary_Income_Slab/Index.cshtml', Model: BinarySlab1, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult UpdateBinaryLevelIncomSlab(string AlData, string HAlData)
// auth (reads Session["Admin_User"] outside the try => legacy NullReference without a session)
router.all(`/admin/${C}/UpdateBinaryLevelIncomSlab{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let AlData = sv(req.p.AlData);
  let HAlData = sv(req.p.HAlData);
  let returnval = 1;
  if (AlData === null || HAlData === null) nullRef();
  AlData = trimCaret(AlData);
  HAlData = trimCaret(HAlData);
  const userid = req.user.emp_id;
  const MainSpit = AlData.split('^');
  const MHAlData = HAlData.split('^');
  try {
    for (const MainItem of MHAlData) {
      const Part = MainItem.split(',');
      // eslint-disable-next-line no-unused-vars
      const id = toInt32(part(Part, 0));
      const Leftvolume = toDecimal(part(Part, 1));
      const RightVoulme = toDecimal(part(Part, 2));
      const MatchingVoulme = toDecimal(part(Part, 3));
      const Description = part(Part, 4);
      const Lmember = toInt32(part(Part, 5));
      const Rmember = toInt32(part(Part, 6));
      const binaryincome = toDecimal(part(Part, 7));
      // insert into Tbl_Binary_Income_Slab_History VALUES('<Description>',L,R,M,userid,Getdate(),1,Lm,Rm,bi)  (parameterised, explicit columns)
      await db.exec(DB, `insert into tbl_binary_income_slab_history (typedescription, leftvolume, rightvolume, matchingvolume, userid, activityreport,
        status, leftnoofmember, rightnoofmember, binaryincome) values (@Description, @Leftvolume, @RightVoulme, @MatchingVoulme, @userid, now(), 1,
        @Lmember, @Rmember, @binaryincome)`, { Description, Leftvolume, RightVoulme, MatchingVoulme, userid, Lmember, Rmember, binaryincome });
    }
    for (const MainItems of MainSpit) {
      const PartSplit = MainItems.split(',');
      const id = toInt32(part(PartSplit, 0));
      const Leftvolume = toDecimal(part(PartSplit, 1));
      const RightVoulme = toDecimal(part(PartSplit, 2));
      const MatchingVoulme = toDecimal(part(PartSplit, 3));
      // eslint-disable-next-line no-unused-vars
      const Description = part(PartSplit, 4);
      const Lmember = toInt32(part(PartSplit, 5));
      const Rmember = toInt32(part(PartSplit, 6));
      const binaryincome = toDecimal(part(PartSplit, 7));
      // Db._TBL_BINARY_INCOME_SLAB.Where(a => a.TBISID == id).FirstOrDefault() ... SaveChanges()
      const Row = await db.queryOne(DB, 'select tbisid from tbl_binary_income_slab where tbisid = @id limit 1', { id });
      if (Row) {
        await db.exec(DB, `update tbl_binary_income_slab set leftvolume = @Leftvolume, rightvolume = @RightVoulme, matchingvolume = @MatchingVoulme,
          leftnoofmember = @Lmember, rightnoofmember = @Rmember, binaryincome = @binaryincome where tbisid = @id`,
        { id, Leftvolume, RightVoulme, MatchingVoulme, Lmember, Rmember, binaryincome });
        returnval = 1;
      }
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'UpdateBinaryLevelIncomSlab');
    returnval = 0;
  }
  return res.json(String(returnval));
}));

module.exports = router;
