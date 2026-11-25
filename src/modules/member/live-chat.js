'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/LiveChat.cs (LiveChatController)
 * Prefix: /member   DB: affiliate (no DB access in this controller)
 */
const express = require('express');

const router = express.Router();

// ---- Index ---------------------------------------------------------------------------------------------
// public (legacy action has no session check)
router.all('/member/LiveChat/Index{/:id}', (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/LiveChat/Index.cshtml' });
});

module.exports = router;
