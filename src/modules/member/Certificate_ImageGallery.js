'use strict';
/**
 * Port of Member/Common/Controllers/Certificate_ImageGallery.cs (Certificate_ImageGalleryController, 1 action: Index)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 * route-config: CertificateImageGallery -> Certificate-ImageGallery
 */
const express = require('express');
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'affiliate';
const C = 'Certificate_ImageGallery';

// ---- Index ------------------------------------------------------------------------------------------------------
// public
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`, '/member/Certificate-ImageGallery'], asyncHandler(async (req, res) => {
  const rows = await query(DB, 'select images,imageurl from tbl_certificategallery WHERE status=1 AND isactive=1');
  res.json({ Model: mapRows(rows, ['Images', 'ImageUrl']) });
}));

module.exports = router;
