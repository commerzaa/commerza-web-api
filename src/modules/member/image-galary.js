'use strict';
// Ported from Member/Common/Controllers/ImageGalary.cs  (ImageGalaryController, 1 action)
// DB: Member DataBaseContext = Db_Affiliate => 'affiliate'
const express = require('express');
const router = express.Router();
const { query } = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const DB = 'affiliate';
const BASE = '/member/ImageGalary';

// Index: no session check in the C# -> public. SqlQuery<ImageGalary> maps only Images / ImageUrl / Title.
// route-config: ImageGalary
// public
router.all([`${BASE}/Index{/:id}`, BASE], asyncHandler(async (req, res) => {
  const rows = await query(DB, 'SELECT images, * FROM tbl_imagegallery WHERE status = 1 AND isactive = 1');
  const ImageGalary = mapRows(rows, ['Images', 'ImageUrl', 'Title']);
  res.json({ view: '~/Views/ImageGalary/Index.cshtml', Model: ImageGalary });
}));

module.exports = router;
