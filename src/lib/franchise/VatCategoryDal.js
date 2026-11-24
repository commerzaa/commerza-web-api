/**
 * Exports: class VatCategoryDal { async AddVatCategories(int vcid, string vatTitle, decimal vatPercValue, string mode, Int64 Plid, char Status): string;
 *   async GetAllVatCategory(Int64 BranchId): VatCategoriesDetail[]; async GetVatCategory(Int32 VCID): VatCategoriesDetail|null;
 *   async IsActive_VatCategory(VatCategoriesDetail v, string IPAddress): ProcessResult; async Vat_Categories_List(): VatCat[];
 *   async Vat_Categories_ListByBranch(Int64 BranchId): VatCategory[]; async Vat_Categories_OnVCID(int vcid): VatCategory|null; async VatCategorydelete(int vcid): int }
 * PORT-NOTE: Franchise DataBaseContext = Db_Shopping. ims_usp_IsActive_VatCategory is marked "not found in the local" in the C# source.
 */
'use strict';
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const { isDbError } = require('../_libhelpers');

const D = 'shopping';
const VatCategoriesDetail = ['active', 'BranchId', 'Rownumber', 'StateName', 'vatPercValue', 'vatTitle', 'vcid'];
const VatCat = ['active', 'vatPercValue', 'vatTitle', 'vcid', 'prodCount', 'vatNewTitle'];
const VatCategory = ['active', 'BranchId', 'vatPercValue', 'vatTitle', 'vcid', 'prodCount', 'vatNewTitle'];
const outv = (row, name) => {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? null : row[k];
};
const cs = (v) => (v === null || v === undefined ? '' : String(v));
const toBool = (v) => {
  if (v === true || v === false) return v;
  if (v === 1 || v === '1' || String(v).toLowerCase() === 'true') return true;
  if (v === 0 || v === '0' || String(v).toLowerCase() === 'false') return false;
  throw new Error('String was not recognized as a valid Boolean.');
};
const emptyDetail = () => ({ active: false, BranchId: 0, Rownumber: 0, StateName: null, ToUserId: null, ToUserType: 0, vatPercValue: 0, vatTitle: null, vcid: 0 });
const withDetailDefaults = (r) => ({ ...r, ToUserId: null, ToUserType: 0 });

class VatCategoryDal {
  async AddVatCategories(vcid, vatTitle, vatPercValue, mode, Plid, Status) {
    const row = await db.procOne(D, 'usp_tbl_addvatcategory', {
      vcid, branchid: Plid, vattitle: vatTitle, vatpercvalue: vatPercValue, mode, status: Status,
    });
    const v = outv(row, 'STRRESULT');
    if (v === null || v === undefined) throw new TypeError('Object reference not set to an instance of an object.');
    return String(v);
  }

  async GetAllVatCategory(BranchId) {
    let vatlist = [];
    try {
      const rows = await db.proc(D, 'gettotalvatcategory', { branchid: BranchId });
      vatlist = mapRows(rows, VatCategoriesDetail).map(withDetailDefaults);
    } catch (ex) {
      if (!isDbError(ex)) throw ex; // legacy swallowed SqlException only
    }
    return vatlist;
  }

  async GetVatCategory(VCID) {
    let vat = emptyDetail();
    try {
      const rows = await db.proc(D, 'ims_usp_getvatcategorydetail', { vcid: VCID });
      const m = mapRows(rows, VatCategoriesDetail).map(withDetailDefaults);
      vat = m.length > 0 ? m[0] : null;
    } catch (ex) {
      if (!isDbError(ex)) throw ex;
    }
    return vat;
  }

  async IsActive_VatCategory(v, IPAddress) {
    const pb = { Message: null, ReturnValue: null, Success: null };
    try {
      const row = await db.procOne(D, 'ims_usp_isactive_vatcategory', {
        vatcategoryid: v.vcid, touserid: v.ToUserId, tousertype: v.ToUserType, ipaddress: IPAddress,
      });
      pb.ReturnValue = cs(outv(row, 'SqlResult'));
      pb.Success = toBool(outv(row, 'Success'));
      pb.Message = cs(outv(row, 'Message'));
    } catch (ex) {
      if (!isDbError(ex)) throw ex;
      pb.ReturnValue = '';
      pb.Success = false;
      pb.Message = String(ex.message);
    }
    return pb;
  }

  async Vat_Categories_List() {
    return mapRows(await db.proc(D, 'usp_get_category_prodcut_count', {}), VatCat);
  }

  async Vat_Categories_ListByBranch(BranchId) {
    const list = mapRows(await db.proc(D, 'usp_get_category_prodcut_count', {}), VatCategory);
    return list.filter((c) => Number(c.BranchId) === Number(BranchId));
  }

  async Vat_Categories_OnVCID(vcid) {
    const list = mapRows(await db.proc(D, 'usp_get_category_prodcut_count', {}), VatCategory);
    return list.find((c) => c.vcid === vcid) || null;
  }

  async VatCategorydelete(vcid) {
    const row = await db.procOne(D, 'ims_usp_deletevatcategory', { vcid });
    const v = outv(row, 'strResult');
    if (v === null || v === undefined) return 0; // Convert.ToInt32(DBNull/null) => 0 for null object
    return parseInt(String(v), 10);
  }
}

module.exports = VatCategoryDal;
