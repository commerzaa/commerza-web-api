'use strict';
// Ported from Member\Controllers\CustomerPanel\ViewAgreement.cs (2 actions) - database: affiliate (Db_Affiliate)
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();
const config = require('../../config');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const UtilityClass = require('../../lib/member/UtilityClass');
const DB = 'affiliate';
const upload = multer({ storage: multer.memoryStorage() });

// auth
// route-config: referral/u_slash_z63m_plus_zPFrcOg6YzDMSLwVV -> Index
router.all(['/member/ViewAgreement/Index{/:id}', '/member/referral/u_slash_z63m_plus_zPFrcOg6YzDMSLwVV'], auth, asyncHandler(async (req, res) => {
  res.json({});
}));

// auth
router.post('/member/ViewAgreement/UploadFiles{/:id}', auth, upload.any(), asyncHandler(async (req, res) => {
  const out = {};
  let url = '';
  const Plid = String(req.user.plid);
  const Timespand = await UtilityClass.GetTimestamp(new Date());
  const files = (req.files || []).filter((f) => f.fieldname === 'files' || f.fieldname === 'files[]');
  const dir = path.join(config.uploadDir, 'Agreement_Image');
  for (const file of files) {
    if (file) {
      const InputFileName = path.basename(String(file.originalname || '').replace(/\\/g, '/'));
      const saved = Plid + '_' + Timespand + '_' + InputFileName;
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, saved), file.buffer);
      out.UploadStatus = files.length + ' files uploaded successfully.';
      url = url !== '' ? url + '^' + saved : saved;
    }
  }
  const o = await db.procOne(DB, 'USP_Agreement_INSERT', { PLID: Number(Plid), Attachement: url });
  const k = o && Object.keys(o).find((x) => x.toLowerCase() === 'strresult');
  out.Result = k && o[k] !== null ? String(o[k]) : '';
  res.json(out);
}));

module.exports = router;
