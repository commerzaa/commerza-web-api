'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Member_RankList.cs (class Member_RankListController => /Member_RankList/...)
// Database: affiliate (Db_Affiliate). Proc: USP_ALLMEMBER_RANKLIST. Actions: Index, ExportReport (see _shared/batch09_ranklist.js).
const { buildRankList } = require('./_shared/batch09-ranklist');
const { tab, cellStr } = require('./_shared/batch09-common');

/** class MemberRankList */
const PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'UPDATEDDATE', 'RANKNAME', 'SPONSERID', 'MOBILE', 'REGDATE'];

module.exports = buildRankList({
  C: 'Member_RankList',
  routeConfig: '/admin/AdminPanel/Member-RankList', // route-config: "AdminPanel/Member-RankList" -> Member_RankList/Index
  proc: 'USP_ALLMEMBER_RANKLIST',
  props: PROPS,
  next: false,
  view: '~/Views/AdminPanel/Member_RankList/Index.cshtml',
  headers: ['S.No.', 'Username', 'Name', 'Rankname', 'Rank Date'],
  cells: (item, w) => {
    w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
    w(tab(cellStr(item, 'USERNAME')) + ' \t');
    w(tab(cellStr(item, 'NAME')) + ' \t');
    w(tab(cellStr(item, 'RANKNAME')) + ' \t');
    w(tab(cellStr(item, 'UPDATEDDATE')) + ' \t');
  },
});
