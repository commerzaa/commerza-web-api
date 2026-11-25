'use strict';
/**
 * Helpers private to admin port batch08 (part D2: LeadershipBonusDetails, LeftDownLine_Member, Level_Business_Report, Level_DownLine,
 * Level_Income_Slab). Not a router (lives in _shared/).
 * Exports: outVal(rows, name), rootLoginId(), pagePerm(empId, url), excelLinkRaw(url), MEMBER_BUSINESS_PROPS, REFERRAL_BONUS_DETAILS_PROPS,
 *          ALL_DOWNLINE_LR_PROPS
 */
const db = require('../../../db');
const { DB, col, str } = require('./batch08-common');

/**
 * SqlParameter OUTPUT value `.Value.ToString()` of a proc that also returns a result set.
 * The PostgreSQL functions return OUT params as columns of every result row.
 * PORT-NOTE: when the result set is empty the OUT values are not available; '0' is used then (legacy got the real value,
 * normally 0 / the count). When a row exists, a NULL value gives "" exactly like DBNull.ToString().
 */
function outVal(rows, name) {
  if (!rows || rows.length === 0) return '0';
  return str(col(rows[0], name));
}

/** db._Member_Master.Where(a => a.regNo == 1).FirstOrDefault(): row != null => row.userName, else "" */
async function rootLoginId() {
  const row = await db.queryOne(DB, 'select username from member_master where regno = 1 limit 1', {});
  if (!row) return '';
  const v = col(row, 'username');
  return v === undefined ? null : v;
}

/**
 * Inline "USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out" (same SQL as BAL CheckPermissions.GetPageActionPermission)
 * => { isactive, isedit } (Convert.ToInt16(Value == "" ? "0" : Value)).
 */
async function pagePerm(empId, url) {
  const CheckPermissions = require('../../../lib/admin/CheckPermissions');
  const p = await CheckPermissions.GetPageActionPermission(url, empId);
  return { isactive: Number(p._opIsDownloadAllowed) || 0, isedit: Number(p._opIsEditAllowed) || 0 };
}

/** Inline "USP_EXCEL_LINK @url,@ISACTIVE out" => ISACTIVE (raw string). */
async function excelLinkRaw(url) {
  const row = await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  return str(col(row, 'isactive'));
}

/** class MemberBusinessReport (Controllers/AdminPanel/Member_Business_Report.cs) */
const MEMBER_BUSINESS_PROPS = ['ROWNUMBER', 'LEFTBUSINESS', 'RIGHTBUSINESS', 'USERNAME', 'Name', 'MOBILENUMBER', 'MOBILE', 'TOTALBUSINES', 'PBV'];

/** class ReferralBonusDetails (Controllers/AdminPanel/UserReferralBonusDetails.cs) */
const REFERRAL_BONUS_DETAILS_PROPS = ['RowNumber', 'PLID', 'USERNAME', 'EMAILID', 'LOGINID', 'Name', 'PHONE', 'DirectIncome', 'GrowthBonus',
  'FROMINCOME', 'LEVELINCOME', 'GrowthLeadershipBonus', 'GrowthDirectIncome'];

/** class AllDownlineMemberLeftRight (Controllers/AdminPanel/All_Downline_Member_List.cs) */
const ALL_DOWNLINE_LR_PROPS = ['ROWNUMBER', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status',
  'EmailID', 'DOC', 'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'sponser_username',
  'root_userName', 'LCount', 'RCount', 'SideName', 'DepositedATC', 'PARENTID'];

module.exports = { outVal, rootLoginId, pagePerm, excelLinkRaw, MEMBER_BUSINESS_PROPS, REFERRAL_BONUS_DETAILS_PROPS, ALL_DOWNLINE_LR_PROPS };
