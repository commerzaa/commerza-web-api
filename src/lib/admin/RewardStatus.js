/** Exports: class RewardStatus (table tbl_memberswithrewards; props RCID, mrid, rid, regNo, rewardType, reward, cashPrice, rewardDate, remarks, active, status)
 *   Source Models/RewardStatus.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const RewardStatus = defineModel('RewardStatus', 'tbl_memberswithrewards', { RCID: 0, mrid: 0, rid: 0, regNo: 0, rewardType: null, reward: null, cashPrice: 0, rewardDate: null, remarks: null, active: false, status: null });

module.exports = RewardStatus;
