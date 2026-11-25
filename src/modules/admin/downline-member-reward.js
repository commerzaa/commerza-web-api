'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Downline_Member_Reward.cs (class Downline_Member_RewardController, no namespace => /Downline_Member_Reward/...)
// Database: affiliate (Db_Affiliate). Procs USP_DOWNLINEBONANAZREWARD, USP_GETEXCELPERMISIONSTATUS, USP_EXCEL_LINK, USP_EXCEL_DOWNLOAD_HISTORY.
// Actions: Index (+ route-config "AdminPanel/downline-member-reward"), ExportReport - implemented in _shared/batch06_memberReward.js
const { buildMemberRewardRouter } = require('./_shared/batch06-member-reward');

module.exports = buildMemberRewardRouter({
  C: 'Downline_Member_Reward', proc: 'USP_DOWNLINEBONANAZREWARD', friendlyUrl: 'AdminPanel/downline-member-reward', word: 'Downline',
});
