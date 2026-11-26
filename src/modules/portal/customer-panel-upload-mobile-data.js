// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/UploadMobileData.cs (UploadMobileDataController => /portal/UploadMobileData/...)
'use strict';
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const ps = require('./_shared/portal-session');
const { DB, s, outCol, view, multerAny, readExcelFirstTable, rowValue } = require('./_shared/batch-24-common');

const router = express.Router();
const P = '/portal/UploadMobileData';
const VIEW = '~/Views/CustomerPanel/UploadMobileNoData/Index.cshtml';

// ---------------------------------------------------------------- Index()
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: merchant/uploadmobiledata -> UploadMobileData/Index
router.all([`${P}/Index{/:id}`, P, '/portal/merchant/uploadmobiledata{/:id}'], ps.customerAuth, asyncHandler(async (req, res) => view(res, VIEW)));

// ---------------------------------------------------------------- Upload(HttpPostedFileBase upload, string GroupName, string Remark, string DDLGroupName)
// auth ([HttpPost]; Session["Plid"] == null => RedirectToAction("Index","Home"))
// PORT-NOTE: [ValidateAntiForgeryToken] has no equivalent (the JWT bearer token replaces the cookie session, so there is no CSRF vector).
router.post(`${P}/Upload{/:id}`, ps.customerAuth, multerAny(), asyncHandler(async (req, res) => {
  const str = (v) => (v === undefined || v === '' ? null : v);
  const GroupName = str(req.p.GroupName); const Remark = str(req.p.Remark); const DDLGroupName = str(req.p.DDLGroupName);
  const upload = (req.files || []).find((f) => String(f.fieldname).toLowerCase() === 'upload') || null;
  const ModelState = {};
  let Group = GroupName == null ? '' : (GroupName === '' ? '' : GroupName);
  if (Group === '') {
    Group = DDLGroupName == null ? '' : (DDLGroupName === '' ? '' : DDLGroupName);
  }
  if (Group === '') {
    ModelState.Group = ['Please enter or select Group Name'];
    return view(res, VIEW, undefined, { ModelState });
  }
  let results = ''; // eslint-disable-line no-unused-vars
  if (upload != null && upload.size > 0) {
    let IsCorrectFormat = false;
    const fileName = String(upload.originalname || '');
    if (!fileName.endsWith('.xls') && !fileName.endsWith('.xlsx')) {
      ModelState.File = ['This File Format Is Not Supported'];
      return view(res, VIEW, undefined, { ModelState });
    }
    // reader.IsFirstRowAsColumnNames = true; DataSet result = reader.AsDataSet();
    const result = readExcelFirstTable(upload.buffer, fileName);
    for (const Columns of result.columns) {
      if (Columns.toLowerCase() === 'mobile') IsCorrectFormat = true;
    }
    if (IsCorrectFormat === false) {
      ModelState.File = ['This Excel sheet Is Not in Correct Format.'];
      return view(res, VIEW, undefined, { ModelState });
    }
    // #region ForInsert
    let Str = '';
    for (let i = 0; i < result.rows.length; i++) {
      Str = Str + ',' + rowValue(result.rows[i], 'MOBILE');
    }
    const Plid = Number(req.user.plid);
    if (Str !== '') {
      Str = Str.substring(1);
    }
    const r = await db.procOne(DB, 'usp_add_mobile', { PLID: Plid, MOBILE: Str, CHECK: 1, GroupName: Group, Remark });
    results = s(outCol(r, 'message'));
    // #endregion ForInsert
    // return View(..., result.Tables[0]) - the DataTable is returned as its column names + rows
    return view(res, VIEW, { Columns: result.columns, Rows: result.rows });
  }
  ModelState.File = ['Please Upload Your File'];
  return view(res, VIEW, undefined, { ModelState });
}));

module.exports = router;
