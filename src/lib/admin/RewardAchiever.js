/** Exports: class RewardAchiever (table tbl_rewardachievers; props RCID, regNo, RMID, active, status, dtm_Reply_Date)
 *   Source Models/RewardAchiever.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const RewardAchiever = defineModel('RewardAchiever', 'tbl_rewardachievers', { RCID: 0, regNo: 0, RMID: 0, active: false, status: 0, dtm_Reply_Date: null });

module.exports = RewardAchiever;
