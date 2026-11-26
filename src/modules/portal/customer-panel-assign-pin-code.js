'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Assign_PinCode.cs (Assign_PinCodeController, 3 actions). Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/portal/UtilityClass');
const CategoryDAL = require('../../lib/portal/CategoryDal');
const ps = require('./_shared/portal-session');
const { DB, mvcStr, mvcInt, nullRef, toInt64 } = require('./_shared/batch-03-common');

const router = express.Router();
const C = 'Assign_PinCode';

// ---------------------------------------------------------------- JsonResult AssignGroup(int GroupId, Int64 PRID)
// auth (PORT-NOTE: legacy had no session check; it changes a merchant product's pin-code group, so a customer token is required)
router.all(`/portal/${C}/AssignGroup{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const GroupId = mvcInt(req, 'GroupId');
  const PRID = mvcInt(req, 'PRID');
  let Return = false;
  // db._Product_Master_Sub.Where(a => a.SPRID == PRID).FirstOrDefault(); row.GroupId = GroupId; SaveChanges()
  const row = await db.queryOne(DB, 'select sprid from ims_subproduct where sprid = @PRID limit 1', { PRID });
  if (row === null) nullRef();
  await db.exec(DB, 'update ims_subproduct set groupid = @GroupId where sprid = @PRID', { GroupId, PRID });
  Return = true;
  return res.json(Return);
}));

// ---------------------------------------------------------------- Index(string PRID, string ZoneId)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`], ps.customerAuth, asyncHandler(async (req, res) => {
  const PRID = mvcStr(req, 'PRID');
  let ZoneId = mvcStr(req, 'ZoneId');
  const ViewBag = {};
  const ProductId = toInt64(await UtilityClass.Decryptword(PRID));
  ViewBag.PRID = ProductId;
  const Success = ps.tempDataGet(req, 'Success');
  if (Success !== null) ViewBag.Success = Success;
  const Error = ps.tempDataGet(req, 'Error');
  if (Error !== null) ViewBag.Error = Error;
  if (ZoneId === null || ZoneId === '') ZoneId = '0';
  const BranchId = toInt64(req.user.plid); // ((Employee)Session["Admin_User"]).BranchId in the original merchant code
  const dal = new CategoryDAL();
  const objModel = await dal.GetSelectedPinCode(BranchId, ZoneId);
  return res.json({ view: '~/Views/merchant/Assign_PinCode/Index.cshtml', Model: objModel, ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult SelectedAIDS(string AIDs, Int64 PRID)
// auth (Session["Plid"] == null => Json("Session Expired. Please login again"))
router.all(`/portal/${C}/SelectedAIDS{/:id}`, ...ps.customerOr('Session Expired. Please login again'), asyncHandler(async (req, res) => {
  const AIDs = mvcStr(req, 'AIDs');
  const PRID = mvcInt(req, 'PRID');
  const BranchId = req.user.plid;
  const str = 'Recent Used ' + PRID;
  if (AIDs === null) nullRef();
  // PinCodeGroup pg = { Id = 0, AreaIds = AIDs.Trim(','), GroupName = str, IsActive = true, IsDefault = false, ToUserId = BranchId,
  //                     ToUserType = SeclectUserType.Branch.ToString() }; db._PinCodeGroup.Add(pg); SaveChanges()
  await db.exec(DB, `insert into tbl_pincodegroup (groupname, areaids, isactive, isdefault, touserid, tousertype)
      values (@GroupName, @AreaIds, true, false, @ToUserId, @ToUserType)`, {
    GroupName: str, AreaIds: AIDs.replace(/^,+|,+$/g, ''), ToUserId: BranchId, ToUserType: UtilityClass.SeclectUserType[UtilityClass.SeclectUserType.Branch],
  });
  // ((PinCodeGroup)db._PinCodeGroup.Where(a => a.GroupName == str).FirstOrDefault()).Id
  const g = await db.queryOne(DB, 'select id from tbl_pincodegroup where groupname = @str order by id limit 1', { str });
  if (g === null) nullRef();
  const GroupId = g.id;
  const pms = await db.queryOne(DB, 'select sprid from ims_subproduct where sprid = @PRID limit 1', { PRID });
  if (pms === null) nullRef();
  await db.exec(DB, 'update ims_subproduct set groupid = @GroupId where sprid = @PRID', { GroupId, PRID });
  return res.json('ok');
}));

module.exports = router;
