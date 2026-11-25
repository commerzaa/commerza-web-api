'use strict';
/**
 * Model property lists shared by batch10 part C tree controllers (not a router).
 * Exports: UNILEVEL_TREE_MATRIX_PROPS (MyCommunity_Matrix.cs class UnilevelTreeMatrix), UNILEVEL_TREE_PROPS (Level_Tree.cs class UnilevelTree)
 */
const UNILEVEL_TREE_MATRIX_PROPS = ['RegNo', 'LoginId', 'USERNAME', 'Name', 'ImageName', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'TotalDirectCount',
  'TotalReferralCount', 'Membername', 'Activationdate', 'MOBILE', 'EMAILID', 'ACTIVE', 'STATUS', 'Downlinecount', 'NoOfChild', 'SPONSOR', 'PBV'];
const UNILEVEL_TREE_PROPS = ['RegNo', 'LoginId', 'Name', 'ImageName', 'Regdate', 'PPV', 'PDAP', 'INTRO_REFID', 'PLID', 'TotalDirectCount',
  'TotalReferralCount', 'Membername', 'Activationdate', 'MOBILE', 'EMAILID', 'STATUS', 'ACTIVE', 'USERNAME'];
module.exports = { UNILEVEL_TREE_MATRIX_PROPS, UNILEVEL_TREE_PROPS };
