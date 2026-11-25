'use strict';
// Ported from ClusterofferShopingPortal\Controllers\video_gallery.cs (class video_galleryController => /portal/video_gallery/...)
// Database: none used.
const express = require('express');

const router = express.Router();
const C = 'video_gallery';

// ---------------------------------------------------------------- ActionResult Index()
// public (no session check)
// route-config: "video_gallery" -> video_gallery/Index (same as the conventional URL)
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`], (req, res) => {
  res.json({ view: '~/Views/video_gallery/Index.cshtml' });
});

module.exports = router;
