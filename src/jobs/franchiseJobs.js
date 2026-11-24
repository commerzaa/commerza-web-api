'use strict';
/**
 * Replacement for the Franchise Global.asax cache-expiry jobs.
 *  - Auto_Franchisee_Settlement      : UtilityClass.Franchisee_Settlement()                  every 62 minutes
 *  - Auto_Update_Reseller_Comission  : UtilityClass.Auto_Update_Reseller_Comission_Process() every 24 hours
 * The legacy app ran each once at start-up, then repeated; errors were swallowed (here: logged).
 * These jobs MOVE MONEY, so they only start when FRANCHISE_JOBS=true. Run them on ONE instance only.
 * (Auto_Update_Merchant_Order_Process was defined in legacy but never started, so it is not scheduled.)
 */
const U = require('../lib/franchise/UtilityClass');

function every(ms, name, fn) {
  const run = async () => { try { await fn(); } catch (e) { console.error(`[job:${name}]`, e.message); } };
  run();
  return setInterval(run, ms).unref();
}

function start() {
  every(62 * 60 * 1000, 'Auto_Franchisee_Settlement', () => U.Franchisee_Settlement());
  every(24 * 60 * 60 * 1000, 'Auto_Update_Reseller_Comission', () => U.Auto_Update_Reseller_Comission_Process());
}
module.exports = { start };
