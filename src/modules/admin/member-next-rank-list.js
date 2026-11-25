'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Member_NEXT_RankList.cs (class Member_NEXT_RankListController => /Member_NEXT_RankList/...)
// Database: affiliate (Db_Affiliate). Proc: USP_NEXTRANKACHIVERLIST. Actions: Index, ExportReport (see _shared/batch09_ranklist.js).
// (`private string regno = ""` instance field is never used.)
const { buildRankList } = require('./_shared/batch09-ranklist');
const { tab, cellStr, netFormat, col } = require('./_shared/batch09-common');

/** class Member_NEXT_RankList */
const PROPS = ['ROWNUMBER', 'USERNAME', 'NAME', 'RANKNAME', 'MOBILE', 'REGDATE', 'NEXTRANKNAME', 'UPDATEDDATE'];

module.exports = buildRankList({
  C: 'Member_NEXT_RankList',
  routeConfig: '/admin/AdminPanel/Member-next-ranklist', // route-config: "AdminPanel/Member-next-ranklist" -> Member_NEXT_RankList/Index
  proc: 'USP_NEXTRANKACHIVERLIST',
  props: PROPS,
  next: true,
  view: '~/Views/AdminPanel/Member_NEXT_RankList/Index.cshtml',
  headers: ['S.No.', 'Username', 'Name', 'Joining Date', 'Mobile No.', 'Rankname', 'Next Rankname'],
  cells: (item, w) => {
    w(tab(cellStr(item, 'ROWNUMBER')) + ' \t');
    w(tab(cellStr(item, 'USERNAME')) + ' \t');
    w(tab(cellStr(item, 'NAME')) + ' \t');
    w(tab(netFormat(col(item, 'REGDATE'), 'dd-MMM-yyyy')) + ' \t');
    w(tab(cellStr(item, 'MOBILE')) + ' \t');
    w(tab(cellStr(item, 'RANKNAME')) + ' \t');
    w(tab(cellStr(item, 'NEXTRANKNAME')) + ' \t');
  },
});
