'use strict';
/**
 * Mounts every router in src/modules/admin/*.js (ported from the MLM_Adminpanel MVC app,
 * C:\Users\MY ASUS\cluster\MLM_Adminpanel\Common). Routes live under /admin/...
 */
const fs = require('fs');
const path = require('path');
const express = require('express');

const router = express.Router();
const dir = path.join(__dirname, 'admin');
if (fs.existsSync(dir)) {
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.js')) continue;
    const mod = require(path.join(dir, f));
    router.use('/', mod && mod.router ? mod.router : mod);
  }
}
module.exports = router;
