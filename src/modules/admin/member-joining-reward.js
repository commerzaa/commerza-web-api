'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Member_Joining_Reward.cs (class Member_Joining_RewardController => /Member_Joining_Reward/...)
// Database: affiliate (Db_Affiliate). Proc: USP_MEMBER_JOININGREWARD. Actions: Index, ExportReport (see _shared/batch09_reward.js).
const { buildRewardReport } = require('./_shared/batch09-reward');

/** class MemberJoiningReward */
const PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'REWARDNAME', 'TOTALDIRECT', 'LEFTDIRECT', 'RIGHTDIRECT', 'TOTALDOWNLINE', 'LEFTDOWNLINE', 'RIGHTDOWNLINE',
  'ACHIVEDATE', 'STATUS'];

module.exports = buildRewardReport({
  C: 'Member_Joining_Reward',
  routeConfig: '/admin/AdminPanel/member-joining-reward', // route-config: "AdminPanel/member-joining-reward" -> Member_Joining_Reward/Index
  proc: 'USP_MEMBER_JOININGREWARD',
  props: PROPS,
  view: '~/Views/AdminPanel/Member_Joining_Reward/Index.cshtml',
  sheet: 'MemberJoiningReward.xls',
  headers: ['Total Downline', 'Left Downline', 'Right Downline'],
  cols: ['TOTALDOWNLINE', 'LEFTDOWNLINE', 'RIGHTDOWNLINE'],
});
