// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/Selling_PinCode.cs (class Selling_PinCodeController; DB: Db_Shopping)
// Table: tbl_pincodegroup (_PinCodeGroup); CategoryDAL.GetSelectedPinCode
'use strict';
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const c = require('./_shared/batch-05-common');
const b = require('./_shared/batch-23-common');
const UtilityClass = require('../../lib/portal/UtilityClass');
const CategoryDAL = require('../../lib/portal/CategoryDal');

const router = express.Router();
const DB = 'shopping';
const P = '/portal/Selling_PinCode';

// auth ([SessionExpireCheck] [ValidateInput(false)])
router.all(`${P}/DeletedGroup{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const GroupId = c.bindInt(req, 'GroupId');
  let Return = false;
  const BranchId = c.toInt32(req.user.plid);
  void BranchId;
  // var row = db._PinCodeGroup.Where(a => a.Id == GroupId).FirstOrDefault(); db._PinCodeGroup.Remove(row); db.SaveChanges();
  const row = await db.queryOne(DB, 'select id from tbl_pincodegroup where id = @id limit 1', { id: GroupId });
  if (!row) throw new Error('Value cannot be null.\r\nParameter name: entity'); // DbSet.Remove(null)
  await db.exec(DB, 'delete from tbl_pincodegroup where id = @id', { id: row.id });
  Return = true;
  res.json(Return);
}));

// auth ([SessionExpireCheck] [ValidateInput(false)])
// route-config: merchant/selling-pincode -> Selling_PinCode/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/selling-pincode'], ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  let ZoneId = b.mvcStr(req, 'ZoneId');
  if (ZoneId === null || ZoneId === '') ZoneId = '0';
  const ViewBag = {};
  const Success = ps.tempDataGet(req, 'Success');
  if (Success !== null && Success !== undefined) ViewBag.Success = Success;
  const Error_ = ps.tempDataGet(req, 'Error');
  if (Error_ !== null && Error_ !== undefined) ViewBag.Error = Error_;
  let objModel = {};
  const Plid = Number(req.user.plid);
  const dal = new CategoryDAL();
  objModel = await dal.GetSelectedPinCode(Plid, ZoneId);
  return c.viewJson(res, '~/Views/CustomerPanel/Selling_PinCode/Index.cshtml', objModel, ViewBag);
}));

// auth ([SessionExpireCheck] [ValidateInput(false)])
router.all(`${P}/SelectedAIDS{/:id}`, ps.SessionExpireCheck, asyncHandler(async (req, res) => {
  const GroupId = c.bindInt(req, 'GroupId');
  const AIDs = b.mvcStr(req, 'AIDs');
  const GroupName = b.mvcStr(req, 'GroupName');
  const Plid = c.toInt32(req.user.plid);
  if (GroupId === 0) {
    const pg = {
      Id: 0, AreaIds: b.trimChar(AIDs, ','), GroupName, IsActive: true, IsDefault: false, ToUserId: Plid,
      ToUserType: UtilityClass.SeclectUserType[UtilityClass.SeclectUserType.Merchant], // SeclectUserType.Merchant.ToString() => "Merchant"
    };
    await db.exec(DB, `insert into tbl_pincodegroup (groupname, areaids, isactive, isdefault, touserid, tousertype)
                       values (@GroupName, @AreaIds, @IsActive, @IsDefault, @ToUserId, @ToUserType)`, pg);
  } else {
    const pg = await db.queryOne(DB, 'select id from tbl_pincodegroup where id = @id limit 1', { id: GroupId });
    if (!pg) throw c.NRE();
    const AreaIds = b.trimChar(AIDs, ',');
    await db.exec(DB, 'update tbl_pincodegroup set areaids = @AreaIds, groupname = @GroupName where id = @id', { AreaIds, GroupName, id: pg.id });
  }
  res.json('ok');
}));

module.exports = router;
