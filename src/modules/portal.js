'use strict';
/**
 * Mounts every router in src/modules/portal/*.js (ported from the ClusterofferShopingPortal MVC app,
 * C:\Users\MY ASUS\cluster\ClusterofferShopingPortal\ClusterofferShopingPortal). Routes live under /portal/...
 */
const fs = require('fs');
const path = require('path');
const express = require('express');

const router = express.Router();
const dir = path.join(__dirname, 'portal');
if (fs.existsSync(dir)) {
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.js')) continue;
    const mod = require(path.join(dir, f));
    const r = mod && mod.router ? mod.router : mod;
    if (typeof r === 'function') router.use('/', r);
  }
}
module.exports = router;
