'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/TellFriends.cs (TellFriendsController)
const express = require('express');

const router = express.Router();
const DB = 'shopping'; // eslint-disable-line no-unused-vars

// public (legacy had no session check; view only, no data). RouteConfig "referral/tellfriends" is commented out.
router.all(['/portal/TellFriends/Index{/:id}', '/portal/TellFriends'], (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/TellFriends/Index.cshtml' });
});

module.exports = router;
