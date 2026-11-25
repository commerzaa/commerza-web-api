'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\DirectReward.cs (class DirectRewardController, no namespace => /DirectReward/...)
// Database: affiliate (Db_Affiliate). Actions Index, AddDirectReward, GetRewardById, UpdateDirectReward, DeleteRewardById are implemented
// in _shared/batch06_reward.js (shared with DownlineReward.cs, which differs only in proc/parameter names).
const { buildRewardRouter } = require('./_shared/batch06-reward');

/** public class GetAllReward */
const GET_ALL_REWARD_PROPS = ['RBID', 'ROWNUMBER', 'REWARDNAME', 'NOOFDIRECT', 'LEFTDIRECT', 'RIGHTDIRECT', 'TOTALBUSINESS', 'LEFTBUSINESS',
  'RIGHTBUSINESS', 'REWARDAMOUNT', 'ADMINCHARGE', 'TDS', 'WALLETTYPE', 'WALLETNAME', 'WITHINDAYS', 'DATE', 'ACTIVE', 'STATUS', 'FROMDATE', 'TODATE'];

module.exports = buildRewardRouter({
  C: 'DirectReward',
  friendlyUrl: 'AdminPanel/direct-reward', // route-config
  view: 'DirectReward',
  procAll: 'USP_GETALLREWARD',
  procSubmit: 'USP_SUBMITDIRECT_REWARD',
  procSubmitErrName: 'USP_SUBMITDIRECT_REWARD',
  procGetOne: 'USP_GETSINGLEREWARDBYID',
  procUpdate: 'USP_UPDATEREWARDBYID',
  procDelete: 'USP_DELETEREWARD_BYID',
  idParam: 'RBID',
  actionIdParam: 'Rbid',
  countNames: ['NOOFDIRECT', 'LEFTDIRECT', 'RIGHTDIRECT'],
  rewardProps: GET_ALL_REWARD_PROPS,
});
