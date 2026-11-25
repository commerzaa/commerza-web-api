'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Member_Rank_Reward.cs (class Member_Rank_RewardController => /Member_Rank_Reward/...)
// Database: affiliate (Db_Affiliate). Proc: USP_MEMBER_RANKREWARD. Actions: Index, ExportReport (see _shared/batch09_reward.js).
const { buildRewardReport } = require('./_shared/batch09-reward');

/** class MemberRankReward */
const PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'REWARDNAME', 'TOTALDIRECT', 'LEFTDIRECT', 'RIGHTDIRECT', 'TOTALBUSSINESS', 'LEFTBUSSINESS', 'RIGHTBUSSINESS',
  'ACHIVEDATE', 'TOTALREWARDAMOUNT', 'REWARDAMOUNT', 'ADMINCHARGE', 'TDSCHARGE', 'WALLETTYPE', 'STATUS'];

module.exports = buildRewardReport({
  C: 'Member_Rank_Reward',
  routeConfig: '/admin/AdminPanel/member_rank_reward', // route-config: "AdminPanel/member_rank_reward" -> Member_Rank_Reward/Index
  proc: 'USP_MEMBER_RANKREWARD',
  props: PROPS,
  view: '~/Views/AdminPanel/Member_Rank_Reward/Index.cshtml',
  sheet: 'MemberRankReward.xls',
  headers: ['Total Business', 'Left Business', 'Right Business', 'RewardAmt', 'Total RewardAmt', 'Admin Charge', 'TDS Charge'],
  cols: ['TOTALBUSSINESS', 'LEFTBUSSINESS', 'RIGHTBUSSINESS', 'REWARDAMOUNT', 'TOTALREWARDAMOUNT', 'ADMINCHARGE', 'TDSCHARGE'],
});
