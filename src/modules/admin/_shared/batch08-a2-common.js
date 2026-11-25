'use strict';
/**
 * Helpers private to admin port batch08 part A2 (GrowthBonus, GrowthReferralBonus, GrowthReferralBonusDetails, Gst_Group, HelpingSetting).
 * Not a router (lives in _shared/).
 * Exports: GROWTH_BONUS_LIST_PROPS, GET_DETAILS_PROPS, GET_REFERAL_INCOME_PROPS, GET_EARNING_WALLET_HISTORY_PROPS, GST_GROUP_DETAIL_PROPS,
 *          GST_DDETAIL_PROPS, HELPING_SETTING_LIST_PROPS, writeXlsFileOnly(opts), sqlStyle0(d), netParseInt(s), netParseDec(s),
 *          netToBoolean(v), netDecimalString(v)
 */
const fs = require('fs');
const path = require('path');
const config = require('../../../config');
const { errorInsert } = require('./admin-session');
const { nullRef } = require('./batch08-common');

/** class GrowthBonusList (GrowthBonus.cs) */
const GROWTH_BONUS_LIST_PROPS = ['ROWNUMBER', 'INVEST_AMOUNT', 'DAILYGROWTH_RATE', 'INVEST_DATE', 'GROWTHDAYS', 'PAIDDAYS', 'CURRENTRETURN', 'KID',
  'RemainDays', 'USERNAME', 'REGNO', 'LAST_UPDATE', 'MAXRETURN', 'Name', 'Mobile'];
/** class GetDetails (GrowthBonus.cs) */
const GET_DETAILS_PROPS = ['REGNO', 'GROWTHAMOUNT', 'GROWTHDATE', 'KID', 'PRINCIPALAMOUNT', 'INTERESTAMOUNT', 'ADMINCH', 'TDS', 'TotalIncome'];
/** class GetReferalIncome (ReferralBonus.cs) */
const GET_REFERAL_INCOME_PROPS = ['ROWNUMBER', 'FROMID', 'TOID', 'INCOME', 'LEVEL', 'TYPE', 'DATE', 'COMM_PER', 'AMOUNT', 'TDS_PER', 'TDS_AMT',
  'ADMIN_AMT', 'ADMIN_PER', 'IncomeType', 'FROMUSERNAME', 'TOUSERNAME', 'TOTALAMOUNT', 'SystemProcessPer', 'SystemProcessAmount', 'Net', 'ISSKIP',
  'FROMNAME', 'TONAME'];
/** class GetEarningWalletHistory (ReferralBonus.cs) */
const GET_EARNING_WALLET_HISTORY_PROPS = ['ROWNUMBER', 'EarnedDate', 'EarnedMatchingPoints', 'EarnedDirectPoints', 'EarnedLevelPoints',
  'EarnedTaskLevelPoints', 'EarnedGrowthLevelPoints', 'TotalEarnedPoints', 'Royality', 'CashReward', 'Status', 'PayId', 'id',
  'EarnedBinaryLevelPoints', 'DAILYEARNEDROI', 'UserName'];
/** class GSTGroupDetail (Gst_Group.cs) */
const GST_GROUP_DETAIL_PROPS = ['RowNumber', 'GSTID', 'Name', 'Value', 'Active'];
/** class GSTddetail (Gst_Group.cs) */
const GST_DDETAIL_PROPS = ['TAXTYPE', 'TTTID', 'GSTID', 'Name', 'Value', 'Active'];
/** class HelpinhgSettingList (HelpingSetting.cs) */
const HELPING_SETTING_LIST_PROPS = ['ROWNUMBER', 'HSID', 'CONDITION', 'CONDITIONCODE', 'CONDITIONVALUE', 'ISEDITABLE', 'STATUS'];

/**
 * Tab-separated ".xls" written with a StreamWriter to ~/AllExcelSheets/<sheet> and NOT sent (the legacy Response.Redirect was commented out).
 * opts: { req, sheet, headers, rows, cells(item, w), innerProc, outerProc, ViewBag }
 */
async function writeXlsFileOnly(opts) {
  const { req, sheet, headers, rows, cells, innerProc, outerProc, ViewBag = {} } = opts;
  try {
    const dir = path.join(config.uploadDir, 'AllExcelSheets');
    fs.mkdirSync(dir, { recursive: true });
    const filepath = path.join(dir, sheet);
    ViewBag.filepath = filepath;
    if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
    let out = headers.map((h) => `${h} \t`).join('');
    let closed = false;
    for (const item of rows) {
      try {
        if (closed) throw new Error('Cannot write to a closed TextWriter.');
        await cells(item, (x) => { out += x; });
      } catch (ExpObj) {
        if (innerProc) await errorInsert(req, ExpObj, innerProc);
        closed = true;
      }
    }
    fs.writeFileSync(filepath, out);
  } catch (ExpObj) {
    if (outerProc) await errorInsert(req, ExpObj, outerProc);
    ViewBag.filepath = ExpObj.message;
  }
  return ViewBag;
}

/** SQL Server CONVERT(VARCHAR(100), <datetime>) (style 0: "mon dd yyyy hh:miAM", day/hour space padded) */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function sqlStyle0(d) {
  if (d === null || d === undefined) return null;
  const x = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(x.getTime())) return String(d);
  const H = x.getHours();
  const h12 = H % 12 === 0 ? 12 : H % 12;
  return `${MON[x.getMonth()]} ${String(x.getDate()).padStart(2, ' ')} ${x.getFullYear()} ${String(h12).padStart(2, ' ')}:`
    + `${String(x.getMinutes()).padStart(2, '0')}${H < 12 ? 'AM' : 'PM'}`;
}

/** int.Parse(string) (FormatException on "" / invalid) */
function netParseInt(s) {
  const t = String(s === null || s === undefined ? '' : s).trim();
  if (!/^[-+]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  return parseInt(t, 10);
}
/** decimal.Parse(string) (FormatException on "" / invalid) */
function netParseDec(s) {
  const t = String(s === null || s === undefined ? '' : s).trim();
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) throw new Error('Input string was not in a correct format.');
  return Number(t);
}
/** Convert.ToBoolean(string): null => false; "true"/"false" (trimmed, case-insensitive) else FormatException */
function netToBoolean(v) {
  if (v === null || v === undefined) return false;
  if (typeof v === 'boolean') return v;
  const t = String(v).trim().toLowerCase();
  if (t === 'true') return true;
  if (t === 'false') return false;
  throw new Error('String was not recognized as a valid Boolean.');
}
/** <decimal/bool value>.ToString() (bool => "True"/"False"; null => NullReferenceException) */
function netDecimalString(v) {
  if (v === null || v === undefined) throw nullRef();
  if (typeof v === 'boolean') return v ? 'True' : 'False';
  return String(v);
}

module.exports = {
  GROWTH_BONUS_LIST_PROPS, GET_DETAILS_PROPS, GET_REFERAL_INCOME_PROPS, GET_EARNING_WALLET_HISTORY_PROPS, GST_GROUP_DETAIL_PROPS,
  GST_DDETAIL_PROPS, HELPING_SETTING_LIST_PROPS, writeXlsFileOnly, sqlStyle0, netParseInt, netParseDec, netToBoolean, netDecimalString,
};
