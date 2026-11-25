'use strict';
// Ported from Shoping Portal Merchant Panel\Controllers\MerchantConfiguratioController.cs  - DB: shopping (via lib ManageAffiliateData)
// The C# had no session attribute but dereferences ((Login)Session["Plid"]).Plid => auth.
const express = require('express');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const ManageAffiliateData = require('../../lib/merchant/ManageAffiliateData');

const router = express.Router();
const DB = 'shopping'; // eslint-disable-line no-unused-vars
const P = '/merchant/MerchantConfiguratio';
const FORM_CONFIGURATION = ['ColumnName', 'Value', 'Description', 'ValueType', 'CSSClass'];

// Convert.ToInt32(Int64) => OverflowException outside the int range
function toInt32(v) {
  const n = Number(v);
  if (!Number.isFinite(n) || n > 2147483647 || n < -2147483648) throw new Error('Value was either too large or too small for an Int32.');
  return Math.trunc(n);
}

// GenericFunction.ConvertDataTableToList<FormConfiguration>: column -> property by name (IgnoreCase); DBNull skipped; Convert.ChangeType(..., string)
function ConvertDataTableToList(rows, props) {
  return (rows || []).map((row) => {
    const obj = {};
    for (const p of props) obj[p] = null;
    for (const c of Object.keys(row)) {
      const prop = props.find((p) => p.toLowerCase() === c.toLowerCase());
      if (prop && row[c] !== null && row[c] !== undefined) obj[prop] = row[c] instanceof Date ? row[c].toString() : String(row[c]);
    }
    return obj;
  });
}

// _obj = new ManageAffiliateData() (constructor)
const newObj = () => new ManageAffiliateData();

// Index()
// auth
router.all(`${P}/Index{/:id}`, auth, asyncHandler(async (req, res) => {
  const _obj = newObj();
  const PLID = toInt32(req.user.plid);
  const dt = await _obj.GetConfigForm(String(PLID));
  const model = ConvertDataTableToList(dt, FORM_CONFIGURATION);
  res.json({ Model: model });
}));

// [HttpPost] UpdateField(string field, string value)
// auth
router.post(`${P}/UpdateField{/:id}`, auth, asyncHandler(async (req, res) => {
  const _obj = newObj();
  const { field, value } = req.p;
  // string query = $"UPDATE MC_MASTER SET {field} = @value WHERE MCID = 1";  -- built but never executed in the C# (not ported as SQL)
  const PLID = Number(req.user.plid);
  const model = {
    FLAG: '',
    MERCHANT_ID: PLID | 0, // (int)PLID (unchecked cast)
    VALUE: value === undefined ? null : value,
    COLUMN_NAME: field === undefined ? null : field,
  };
  const response = await _obj.UpdateConfiguration(model);
  res.json(response);
}));

module.exports = router;
