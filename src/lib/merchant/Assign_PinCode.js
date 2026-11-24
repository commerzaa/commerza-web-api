/** Exports: C# file Models/Assign_PinCode.cs contains the MVC controller `Assign_PinCodeController` (+ plain view-model classes AreaList, CityList, CountryList, PinCodeGroupList, SellingPinCodeViewModel, StateList: not ported).
 *   Assign_PinCodeController = { AssignGroup(int GroupId, Int64 PRID) : bool ;
 *     Index(string PRID, string ZoneId, user, tempData?) : { redirect } | { PRID, Success?, Error?, Model(SellingPinCodeViewModel) } ;
 *     SelectedAIDS(string AIDs, Int64 PRID, user) : "ok" | "Session Expired. Please login again" }
 *   `user` is the JWT payload (req.user; session Login.DID => user.plid), `tempData` = { Success?, Error? }. Also exported at top level.
 *  PORT-NOTE: this controller sits in Models/ and is NOT exposed as a route here (it is dead code in the legacy app: its view path is ~/Views/merchant/...); the coordinator can mount it if required.
 */
'use strict';
const { queryOne, exec } = require('../../db');
const UtilityClass = require('./UtilityClass');

async function AssignGroup(GroupId, PRID) {
  const row = await queryOne('shopping', 'select sprid from ims_subproduct where sprid=@PRID limit 1', { PRID });
  if (row === null) throw new TypeError('Object reference not set to an instance of an object.');
  await exec('shopping', 'update ims_subproduct set groupid=@GroupId where sprid=@PRID', { GroupId, PRID });
  return true;
}

async function Index(PRID, ZoneId, user, tempData) {
  const ProductId = parseInt(UtilityClass.Decryptword(PRID), 10);
  if (Number.isNaN(ProductId)) throw new Error('Input string was not in a correct format.');
  const out = { PRID: ProductId };
  if (tempData && tempData.Success !== undefined && tempData.Success !== null) out.Success = tempData.Success;
  if (tempData && tempData.Error !== undefined && tempData.Error !== null) out.Error = tempData.Error;
  if (ZoneId === null || ZoneId === undefined || ZoneId === '') ZoneId = '0';
  if (!user) return { redirect: 'Home/Index' }; // RedirectToAction("Index", "Home")
  const Plid = user.plid;
  const BranchId = Number(Plid);
  const CategoryDAL = require('./CategoryDal');
  out.Model = await new CategoryDAL().GetSelectedPinCode(BranchId, ZoneId);
  out.View = '~/Views/merchant/Assign_PinCode/Index.cshtml';
  return out;
}

async function SelectedAIDS(AIDs, PRID, user) {
  if (!user) return 'Session Expired. Please login again';
  const BranchId = user.plid;
  const str = 'Recent Used ' + PRID;
  await exec('shopping', 'insert into tbl_pincodegroup(areaids,groupname,isactive,isdefault,touserid,tousertype) values(@AreaIds,@GroupName,true,false,@ToUserId,@ToUserType)',
    { AreaIds: AIDs.replace(/^,+|,+$/g, ''), GroupName: str, ToUserId: BranchId, ToUserType: 'Branch' }); // UtilityClass.SeclectUserType.Branch.ToString()
  const g = await queryOne('shopping', 'select id from tbl_pincodegroup where groupname=@str limit 1', { str });
  if (g === null) throw new TypeError('Object reference not set to an instance of an object.');
  const pms = await queryOne('shopping', 'select sprid from ims_subproduct where sprid=@PRID limit 1', { PRID });
  if (pms === null) throw new TypeError('Object reference not set to an instance of an object.');
  await exec('shopping', 'update ims_subproduct set groupid=@GroupId where sprid=@PRID', { GroupId: g.id, PRID });
  return 'ok';
}

const Assign_PinCodeController = { AssignGroup, Index, SelectedAIDS };
module.exports = { ...Assign_PinCodeController, Assign_PinCodeController };
