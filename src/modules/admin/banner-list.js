'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\banner_list.cs (class banner_listController => /banner_list/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const DataUtility = require('../../lib/admin/DataUtility');
const { adminAuth } = require('./_shared/admin-session');
const { DB, col, str, sv, reqInt, toInt32, nullRef } = require('./_shared/batch03-common');

const router = express.Router();
const C = 'banner_list';

/** Server.MapPath(virtualPath) => <uploadDir>/<path without ~ and leading slashes> */
const mapPath = (v) => path.join(config.uploadDir, String(v || '').replace(/^~?[\/]*/, ''));
const s = (v) => (v === null || v === undefined ? '' : String(v)); // DataRow[x].ToString() (DBNull => "")

// private static bool ThumbnailCallback() { throw new NotImplementedException(); }  - never called; kept for completeness.
// eslint-disable-next-line no-unused-vars
function ThumbnailCallback() { throw new Error('The method or operation is not implemented.'); }

// ---------------------------------------------------------------- Index()
// auth
// route-config: "AdminPanel/banner-list" -> banner_list/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/banner-list'], adminAuth, (req, res) => {
  res.json({ view: '~/Views/AdminPanel/banner_list/Index.cshtml' });
});

// ---------------------------------------------------------------- JsonResult SubmitPaymentMethodDetails(int pmid, string paymentlogo, int Mathodcode, string mode, string randomstring, string Type)
// auth (PORT-NOTE: legacy had NO session check on this banner insert/update + file write - protected here)
router.all(`/admin/${C}/SubmitPaymentMethodDetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const pmid = reqInt(req.p.pmid, 'pmid');
  const paymentlogo = sv(req.p.paymentlogo);
  const Mathodcode = reqInt(req.p.Mathodcode, 'Mathodcode');
  const mode = sv(req.p.mode);
  let randomstring = sv(req.p.randomstring);
  const Type = sv(req.p.Type);
  if (paymentlogo === null) nullRef(); // paymentlogo.Trim()
  if (paymentlogo.trim() !== '') {
    let base64String = paymentlogo;
    const SavePaths = config.app.BannerImagePath || '';
    const imgname = randomstring;
    const strValidFullName = path.join(mapPath(SavePaths), s(imgname)); // MapPath(SavePaths) + "/" + imgname
    if (base64String.includes('base64,')) {
      const IndexNo1 = base64String.indexOf(',') + 1;
      base64String = base64String.substring(IndexNo1);
    }
    const b = Buffer.from(base64String, 'base64'); // Convert.FromBase64String
    // System.Drawing.Image.FromStream (validates it is an image) + img.Save(path) (raw format kept)
    // PORT-NOTE: decoding/validation via sharp (lazy require); the decoded bytes are written unchanged.
    try {
      const sharp = require('sharp'); // eslint-disable-line global-require
      await sharp(b).metadata();
    } catch (e) {
      if (e && e.code === 'MODULE_NOT_FOUND') { /* sharp missing: skip validation */ } else throw new Error('Parameter is not valid.');
    }
    fs.mkdirSync(path.dirname(strValidFullName), { recursive: true });
    if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    fs.writeFileSync(strValidFullName, b);
  } else {
    randomstring = '';
  }
  const row = await db.procOne(DB, 'usp_insertupdate_banner', { id: pmid, mathodlogo: randomstring, status: Mathodcode, mode, Type });
  const OutputResult = str(col(row, 'strresult'));
  return res.json(OutputResult);
}));

// ---------------------------------------------------------------- JsonResult PayMethodDetails()
// public (legacy had no session check; banner list)
router.all(`/admin/${C}/PayMethodDetails{/:id}`, asyncHandler(async (req, res) => {
  const ds = await new DataUtility().GetDataSetSP('usp_banner_list_image');
  const rows = (ds && ds.Tables && ds.Tables[0]) || [];
  const Paymethod = rows.map((dtrow) => ({
    // class PaymentMethoddDetails (nested): rowNumber, pmid, paymentlogo, Mathodcode (never set => null), Status, Type
    rowNumber: s(col(dtrow, 'rowNumber')),
    pmid: toInt32(col(dtrow, 'pmid')),
    paymentlogo: s(col(dtrow, 'paymentlogo')),
    Mathodcode: null,
    Status: s(col(dtrow, 'Status')),
    Type: s(col(dtrow, 'Type')),
  }));
  return res.json(Paymethod);
}));

// ---------------------------------------------------------------- JsonResult EditPaymentMethod(string pmid)
// public (legacy had no session check; read-only banner row)
router.all(`/admin/${C}/EditPaymentMethod{/:id}`, asyncHandler(async (req, res) => {
  const pmid = toInt32(sv(req.p.pmid)); // Convert.ToInt32(pmid)
  // select id as pmid,bannername as paymentlogo,status as Mathodcode,Type from bannerlist where id=<pmid>  (parameterised)
  const rows = await db.query(DB, 'select id as pmid, bannername as paymentlogo, status as mathodcode, type from bannerlist where id = @pmid', { pmid });
  const PayDetails = [];
  for (const dtrow of rows) {
    // class EditPayMethod (nested): pmid, paymentlogo, Mathodcode, Status (never set => null), Type
    PayDetails.push({
      pmid: toInt32(s(col(dtrow, 'pmid'))),
      paymentlogo: s(col(dtrow, 'paymentlogo')),
      Mathodcode: s(col(dtrow, 'Mathodcode')),
      Status: null,
      Type: s(col(dtrow, 'Type')),
    });
  }
  return res.json(PayDetails);
}));

// ---------------------------------------------------------------- JsonResult DeletePaytail(int pmid)
// auth (PORT-NOTE: legacy had NO session check on this delete - protected here)
router.all(`/admin/${C}/DeletePaytail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const pmid = reqInt(req.p.pmid, 'pmid');
  const row = await db.procOne(DB, 'usp_insertupdate_banner', { id: pmid, mathodlogo: '', status: 0, mode: 'Delete', Type: '' });
  return res.json(str(col(row, 'strresult')));
}));

module.exports = router;
