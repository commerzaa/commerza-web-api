'use strict';
/**
 * Auto-mounts every module in src/modules/*.js at "/" (legacy [Route("api/...")] attributes are absolute).
 * A module must export an express.Router().
 *
 * Modules are loaded in the background (call `router.load()`, server.js does it right after listen) so the
 * server reports "listening" immediately instead of after ~10s of requires. Requests that arrive before
 * loading finishes wait for it, so nothing 404s during startup. Mount order is unchanged (sorted filenames).
 */
const fs = require('fs');
const path = require('path');
const express = require('express');

const router = express.Router();
const modules = express.Router();
const dir = path.join(__dirname, '..', 'modules');
const loaded = [];
let ready = false;
let loading = null;

function load() {
  if (loading) return loading;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.js')).sort();
  loading = (async () => {
    for (const f of files) {
      // Yield between modules so the event loop can accept connections while we load.
      await new Promise((r) => setImmediate(r));
      const mod = require(path.join(dir, f));
      const r = mod && mod.router ? mod.router : mod;
      if (typeof r !== 'function') throw new Error(`Module ${f} must export an express Router`);
      modules.use('/', r);
      loaded.push(f);
    }
    ready = true;
    return loaded;
  })();
  return loading;
}

// Hold requests until every module is mounted (starts loading if nobody has yet, e.g. app used without server.js).
router.use((req, res, next) => {
  if (ready) return next();
  load().then(() => next(), next);
});
router.use('/', modules);

router.loaded = loaded;
router.load = load;
module.exports = router;
