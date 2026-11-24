'use strict';
/**
 * Exports: class SchedulerData { async AutoPayout(): boolean }
 * PORT-NOTE: legacy set CommandTimeout=180 on the EF context; the shared db layer has no per-call timeout.
 */
const db = require('../db');
const { out, errorInsert } = require('./_libhelpers');

class SchedulerData {
  async AutoPayout() {
    let status = false;
    try {
      const row = await db.procOne('affiliate', 'usp_manage_auto_process', { flag: 'execute', jobname: 'AutoPayout' });
      const OutResult = out(row, 'out_result');
      if (OutResult === null || OutResult === undefined) throw new Error('Object reference not set to an instance of an object.');
      if (String(OutResult).toLowerCase() === 'success') {
        status = true;
      }
    } catch (ExpObj) {
      await errorInsert('RemoveFavouriteDeal', 'Dal/common', ExpObj);
    }
    return status;
  }
}

module.exports = SchedulerData;
