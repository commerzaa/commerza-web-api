'use strict';
// Ported from Member\Controllers\CustomerPanel\WebsiteNews.cs (WebsiteNewsController) - database: affiliate (Db_Affiliate)
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const router = express.Router();
const DB = 'affiliate';
const NEWS = ['nid', 'title', 'type', 'descriptions', 'date', 'status', 'Imagename'];

// route-config: websitenews
// public
router.all(['/member/WebsiteNews/Index{/:id}', '/member/websitenews'], asyncHandler(async (req, res) => {
  const rows = await db.query(DB, "select * from tbl_news where status = 1 and type = 'Website' order by date desc limit 5");
  res.json({ ViewBag: { membernews: mapRows(rows, NEWS) } });
}));

module.exports = router;
