'use strict';
/** Port of Member/Controllers/CustomerPanel/PartiallyBrandedUrl.cs (PartiallyBrandedUrlController). Prefix /member. No DB access. */
const express = require('express');

const router = express.Router();

// public (legacy had no session check; the action only returned the view)
router.all('/member/PartiallyBrandedUrl/Index{/:id}', (req, res) => res.json({ view: '~/Views/CustomerPanel/PartiallyBrandedUrl/Index.cshtml' }));

module.exports = router;
