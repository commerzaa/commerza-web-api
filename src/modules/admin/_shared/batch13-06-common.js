'use strict';
/**
 * Helpers private to admin port batch13-06 (not a router; lives in _shared/ so src/modules/admin.js does not mount it).
 * Re-exports everything of ./batch11-common plus:
 *   need(params, names)   - EF SqlQuery/ExecuteSqlCommand with a null-valued SqlParameter => "expects the parameter ... not supplied"
 *   decParse(v)           - decimal.Parse(x.ToString()) / Convert.ToDouble(x.ToString()) on an OUT value ("" => FormatException)
 *   outDecOf(rows, name)  - decParse of an OUT param repeated as a result column. PORT-NOTE: no rows => 0.
 *   toInt16(v)            - Convert.ToInt16(decimal): banker's rounding, OverflowException outside Int16
 *   csSubstr(s, start, len) - C# string.Substring(start, length) with ArgumentOutOfRangeException
 *   UNILEVEL_TREE_MATRIX_PROPS, UNILEVEL_TREE_PROPS, FORCE_MATRICS_PROPS, DEBIT_CLOWD_STATEMENT_PROPS, FUND_TRANSFER_HISTORY_PROPS
 */
const B = require('./batch11-common');

/** text-command parameters whose value is C# null are "not supplied" (SqlParameter with Value == null is not sent) */
function need(params, names) {
  for (const n of names || Object.keys(params)) {
    if (params[n] === null || params[n] === undefined) {
      const e = new Error(`The parameterized query expects the parameter '@${n}', which was not supplied.`);
      throw e;
    }
  }
  return params;
}

/** decimal.Parse(string) / Convert.ToDouble(string): "" / invalid => FormatException */
function decParse(v) {
  const s = v === null || v === undefined ? '' : String(v).trim();
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseFloat(s);
}

/** decimal.Parse(<OUT param>.Value.ToString()) on a row-returning proc. PORT-NOTE: no rows => PG cannot return the OUT value => 0. */
function outDecOf(rows, name) {
  if (!rows || !rows.length) return 0;
  return decParse(B.str(B.col(rows[0], name)));
}

/** Convert.ToInt16(decimal) */
function toInt16(v) {
  const n = Number(v);
  const f = Math.floor(n);
  const d = n - f;
  let r;
  if (d > 0.5) r = f + 1;
  else if (d < 0.5) r = f;
  else r = (f % 2 === 0) ? f : f + 1;
  if (r > 32767 || r < -32768) throw new Error('Value was either too large or too small for an Int16.');
  return r;
}

/** C# string.Substring(start, length) */
function csSubstr(s, start, len) {
  if (start < 0 || len < 0 || start + len > s.length) {
    throw new Error('Index and length must refer to a location within the string.\r\nParameter name: length');
  }
  return s.substr(start, len);
}

/** class UnilevelTreeMatrix (Controllers/AdminPanel/MyCommunity_Matrix.cs) */
const UNILEVEL_TREE_MATRIX_PROPS = ['RegNo', 'LoginId', 'USERNAME', 'Name', 'ImageName', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID',
  'TotalDirectCount', 'TotalReferralCount', 'Membername', 'Activationdate', 'MOBILE', 'EMAILID', 'ACTIVE', 'STATUS', 'Downlinecount',
  'NoOfChild', 'SPONSOR', 'PBV'];

/** class UnilevelTree (Controllers/AdminPanel/Level_Tree.cs) */
const UNILEVEL_TREE_PROPS = ['RegNo', 'LoginId', 'Name', 'ImageName', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'PLID', 'TotalDirectCount',
  'TotalReferralCount', 'Membername', 'Activationdate', 'MOBILE', 'EMAILID', 'STATUS', 'ACTIVE', 'USERNAME'];

/** class ForceMatricsList (Controllers/AdminPanel/Force_Matrics_Downline.cs) */
const FORCE_MATRICS_PROPS = ['rownumber', 'LoginId', 'sponserID', 'rootID', 'EmpLevel', 'Name', 'Mobile', 'CityName', 'RegDate', 'status',
  'EmailID', 'DOC', 'TLBV', 'CLBV', 'TRBV', 'CRBV', 'PaidBV', 'userName', 'kitprice', 'kitname', 'regno', 'side', 'spounser_userName',
  'root_userName', 'LCount', 'RCount', 'SideName', 'TITLE'];

/** class Debit_Clowd_Statement (Controllers/AdminPanel/Debit_Clowd_StatementController.cs) */
const DEBIT_CLOWD_STATEMENT_PROPS = ['RowNumber', 'ProcessDate', 'CrDrType', 'Cr_Amount', 'Dr_Amount', 'Remark', 'Old_Bal', 'Balance',
  'USERNAME', 'Name', 'Particular'];

/** class Fund_Transfer_History (Controllers/AdminPanel/Fund_Transfer_History.cs) */
const FUND_TRANSFER_HISTORY_PROPS = ['RowNumber', 'FromPlid', 'ToPlid', 'FromUsername', 'ToUsername', 'ToEmail', 'ToFullName', 'Amount',
  'Date', 'Remark', 'Type', 'TransactionID', 'ID', 'reversed'];

module.exports = {
  ...B,
  need, decParse, outDecOf, toInt16, csSubstr,
  UNILEVEL_TREE_MATRIX_PROPS, UNILEVEL_TREE_PROPS, FORCE_MATRICS_PROPS, DEBIT_CLOWD_STATEMENT_PROPS, FUND_TRANSFER_HISTORY_PROPS,
};
