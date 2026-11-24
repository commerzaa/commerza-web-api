'use strict';
/** Mounts every router in src/modules/merchant/*.js (ported from the Merchant MVC app). Routes live under /merchant/... */
const fs = require('fs');
const path = require('path');
const express = require('express');

const router = express.Router();
const dir = path.join(__dirname, 'merchant');
for (const f of fs.readdirSync(dir).sort()) {
  if (!f.endsWith('.js')) continue;
  const mod = require(path.join(dir, f));
  router.use('/', mod && mod.router ? mod.router : mod);
}
module.exports = router;
