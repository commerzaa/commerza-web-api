'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\TellFriends.cs (TellFriendsController) */
const express = require('express');

const router = express.Router();
const P = '/member/TellFriends';

// public (legacy action had no session check and no server-side logic; the view had no model)
router.all(`${P}/Index{/:id}`, (req, res) => {
  res.json({});
});

module.exports = router;
