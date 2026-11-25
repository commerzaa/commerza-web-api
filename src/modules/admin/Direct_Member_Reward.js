'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Direct_Member_Reward.cs (class Direct_Member_RewardController, no namespace => /Direct_Member_Reward/...)
// Database: affiliate (Db_Affiliate). Procs USP_DIRECTBONANAZREWARD, USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK, USP_EXCEL_DOWNLOAD_HISTORY.
// Actions: Index (+ route-config "AdminPanel/direct-member-reward"), ExportReport - implemented in _shared/batch06_memberReward.js
const { buildMemberRewardRouter } = require('./_shared/batch06_memberReward');

module.exports = buildMemberRewardRouter({
  C: 'Direct_Member_Reward', proc: 'USP_DIRECTBONANAZREWARD', friendlyUrl: 'AdminPanel/direct-member-reward', word: 'Direct',
});
