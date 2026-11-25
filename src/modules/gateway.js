'use strict';
/**
 * Mounts every router in src/modules/gateway/*.js (ported from the Payment Gateway MVC app,
 * C:\Users\MY ASUS\cluster\Payment Gateway\Payment Gateway\Shoping Portal Payment Gateway). Routes live under /gateway/...
 */
const fs = require('fs');
const path = require('path');
const express = require('express');

const router = express.Router();
const dir = path.join(__dirname, 'gateway');
if (fs.existsSync(dir)) {
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.js')) continue;
    const mod = require(path.join(dir, f));
    router.use('/', mod && mod.router ? mod.router : mod);
  }
}
module.exports = router;
