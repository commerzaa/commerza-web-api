'use strict';
const config = require('./config');
const app = require('./app');
const db = require('./db');
const routes = require('./routes');

const server = app.listen(config.port, () => {
  console.log(`commerza-web-api listening on :${config.port} (${config.env}) - loading modules...`);
  const t = Date.now();
  routes.load().then(
    (loaded) => console.log(`${loaded.length} modules ready in ${((Date.now() - t) / 1000).toFixed(1)}s`),
    (e) => { console.error('Failed to load route modules:', e); process.exit(1); }
  );
});

// Franchise money jobs (legacy Global.asax timers). Opt-in, run on ONE instance only.
if (process.env.FRANCHISE_JOBS === 'true') require('./jobs/franchiseJobs').start();

const shutdown = async () => { server.close(async () => { await db.closeAll(); process.exit(0); }); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('unhandledRejection', (e) => console.error('unhandledRejection', e));
