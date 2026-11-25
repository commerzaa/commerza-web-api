/** Exports: class BranchWallet (table tbl_branchwallet; props Bwid, totalCredit, totalDebit, usedInAgeny, totalUsed, remainBalance, BrCode, IsActive)
 *   Source Models/BranchWallet.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const BranchWallet = defineModel('BranchWallet', 'tbl_branchwallet', { Bwid: 0, totalCredit: null, totalDebit: null, usedInAgeny: null, totalUsed: null, remainBalance: null, BrCode: null, IsActive: false });

module.exports = BranchWallet;
