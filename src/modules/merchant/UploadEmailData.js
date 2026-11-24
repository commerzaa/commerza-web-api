'use strict';
// Ported from Merchant Panel\Controllers\CustomerPanel\UploadEmailData.cs  (database: shopping — Db_Shopping)
const express = require('express');
const multer = require('multer');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'shopping';
const P = '/merchant/UploadEmailData';
const upload = multer({ storage: multer.memoryStorage() });

const str = (v) => (v === undefined || v === null ? '' : String(v));

// auth
router.all(P + '/Index{/:id}', auth, requireType('merchant'), asyncHandler(async (req, res) => {
  res.json({});
}));

// auth. [HttpPost][ValidateAntiForgeryToken]  (PORT-NOTE: anti-forgery token is replaced by the JWT; the file field is "upload")
router.post(P + '/Upload{/:id}', auth, requireType('merchant'), upload.single('upload'), asyncHandler(async (req, res) => {
  const { GroupName, Remark, DDLGroupName } = req.p;
  const ModelState = {};
  const view = (extra) => res.json({ ModelState, ...(extra || {}) });
  let Group = GroupName == null ? '' : (GroupName === '' ? '' : GroupName);
  if (Group === '') {
    Group = DDLGroupName == null ? '' : (DDLGroupName === '' ? '' : DDLGroupName);
  }
  if (Group === '') {
    ModelState.Group = 'Please enter or select Group Name';
    return view();
  }
  const file = req.file;
  if (file != null && file.size > 0) {
    let IsCorrectFormat = false;
    const name = String(file.originalname);
    // PORT-NOTE: ExcelDataReader is replaced by the `xlsx` package (required lazily; not in package.json).
    if (!(name.endsWith('.xls') || name.endsWith('.xlsx'))) {
      ModelState.File = 'This File Format Is Not Supported';
      return view();
    }
    const XLSX = require('xlsx');
    const wb = XLSX.read(file.buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false }); // IsFirstRowAsColumnNames = true
    const columns = (aoa[0] || []).map((c) => str(c));
    let emailCol = null;
    for (const Columns of columns) {
      if (Columns.toLowerCase() === 'email') {
        IsCorrectFormat = true;
        emailCol = columns.indexOf(Columns);
      }
    }
    if (IsCorrectFormat === false) {
      ModelState.File = 'This Excel sheet Is Not in Correct Format.';
      return view();
    }
    const dataRows = aoa.slice(1);
    let Str = '';
    for (let i = 0; i < dataRows.length; i++) {
      Str = Str + ',' + str(dataRows[i][emailCol]);
    }
    const Plid = Number(req.user.plid);
    if (Str !== '') Str = Str.substring(1);
    const r = await db.procOne(DB, 'usp_add_email', { plid: Plid, email: Str, check: 1, groupname: Group, remark: Remark });
    const results = str(r ? (('message' in r) ? r.message : r[Object.keys(r)[0]]) : null); // @Message OUT (unused by the view)
    // result.Tables[0] as the view model
    const Model = dataRows.map((row) => {
      const o = {};
      columns.forEach((c, i) => { o[c] = row[i] === undefined ? null : row[i]; });
      return o;
    });
    return view({ Model, Message: results });
  }
  ModelState.File = 'Please Upload Your File';
  return view();
}));

module.exports = router;
