'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\DownlineReward.cs (class DownlineRewardController, no namespace => /DownlineReward/...)
// Database: affiliate (Db_Affiliate). Actions Index, AddDirectReward, GetRewardById, UpdateDirectReward, DeleteRewardById are implemented
// in _shared/batch06_reward.js (shared with DirectReward.cs).
const { buildRewardRouter } = require('./_shared/batch06-reward');

/** public class GetDownlineReward */
const GET_DOWNLINE_REWARD_PROPS = ['DRBID', 'ROWNUMBER', 'REWARDNAME', 'NOOFDOWNLINE', 'LEFTDOWNLINE', 'RIGHTDOWNLINE', 'TOTALBUSINESS',
  'LEFTBUSINESS', 'RIGHTBUSINESS', 'REWARDAMOUNT', 'ADMINCHARGE', 'TDS', 'WALLETTYPE', 'WALLETNAME', 'WITHINDAYS', 'DATE', 'ACTIVE', 'STATUS',
  'FROMDATE', 'TODATE'];

module.exports = buildRewardRouter({
  C: 'DownlineReward',
  friendlyUrl: 'AdminPanel/downline-reward', // route-config
  view: 'DownlineReward',
  procAll: 'USP_GETDOWNLINEREWARD',
  procSubmit: 'USP_SUBMITDOWNLINE_REWARD',
  procSubmitErrName: 'USP_SUBMITDIRECT_REWARD', // legacy PROCEDURENAME string was not renamed
  procGetOne: 'USP_GETSINGLEDOWNLINEREWARDBYID',
  procUpdate: 'USP_UPDATEDOWNLINEREWARDBYID',
  procDelete: 'USP_DELETEDOWNLINEREWARD_BYID',
  idParam: 'DRBID',
  actionIdParam: 'Drbid',
  countNames: ['NOOFDOWNLINE', 'LEFTDOWNLINE', 'RIGHTDOWNLINE'],
  rewardProps: GET_DOWNLINE_REWARD_PROPS,
});
