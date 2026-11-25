'use strict';
/** Port of Member/Controllers/CustomerPanel/MyAds.cs (MyAdsController). Prefix /member. No DB access. */
const express = require('express');

const router = express.Router();

// public (legacy had no session check; the action only returned the view)
router.all('/member/MyAds/Index{/:id}', (req, res) => res.json({ view: '~/Views/CustomerPanel/MyAds/Index.cshtml' }));

module.exports = router;
