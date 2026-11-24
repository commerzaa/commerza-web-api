'use strict';
// Ported from Member/Common/Controllers/CustomerPanel/PopupTestimonial.cs  (PopupTestimonialController, 1 action)
// DB: Member DataBaseContext = Db_Affiliate => 'affiliate'
const express = require('express');
const router = express.Router();
const { query } = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');

const DB = 'affiliate';
const BASE = '/member/PopupTestimonial';
const TESTIMONIAL_PROPS = ['TID', 'Name', 'Descriptions', 'Image', 'Date', 'Status', 'City', 'Regno', 'Title', 'Stars'];

// Index: no session check in the C# -> public
// route-config: popuptestimonial
// public
router.all([`${BASE}/Index{/:id}`, BASE, '/member/popuptestimonial'], asyncHandler(async (req, res) => {
  // _TBL_TESTIMONIAL.Where(Status == 1).OrderByDescending(Date).Take(5)
  const rows = await query(DB, 'select * from tbl_testimonial where status = 1 order by "date" desc limit 5');
  res.json({ view: '~/Views/CustomerPanel/PopupTestimonial/Index.cshtml', ViewBag: { testimonial: mapRows(rows, TESTIMONIAL_PROPS) } });
}));

module.exports = router;
