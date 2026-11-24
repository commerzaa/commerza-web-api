'use strict';
/** Mounts every router in src/modules/franchise/*.js (ported from the Franchise MVC app). Routes live under /franchise/... */
const fs = require('fs');
const path = require('path');
const express = require('express');

const router = express.Router();
const dir = path.join(__dirname, 'franchise');
for (const f of fs.readdirSync(dir).sort()) {
  if (!f.endsWith('.js')) continue;
  const mod = require(path.join(dir, f));
  router.use('/', mod && mod.router ? mod.router : mod);
}
module.exports = router;
