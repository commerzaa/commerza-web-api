'use strict';
/**
 * Auto-mounts every module in src/modules/*.js at "/" (legacy [Route("api/...")] attributes are absolute).
 * A module must export an express.Router().
 */
const fs = require('fs');
const path = require('path');
const express = require('express');

const router = express.Router();
const dir = path.join(__dirname, '..', 'modules');
const loaded = [];

for (const f of fs.readdirSync(dir).sort()) {
  if (!f.endsWith('.js')) continue;
  const mod = require(path.join(dir, f));
  const r = mod && mod.router ? mod.router : mod;
  if (typeof r !== 'function') throw new Error(`Module ${f} must export an express Router`);
  router.use('/', r);
  loaded.push(f);
}
router.loaded = loaded;
module.exports = router;
