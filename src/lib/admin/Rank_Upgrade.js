/** Exports: class Rank_Upgrade (no table; props RUID, Regno, RankID, Date, Active)
 *   Source Models/Rank_Upgrade.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const Rank_Upgrade = defineModel('Rank_Upgrade', 'rank_upgrades', // no [Table]: EF convention name (pluralised)
  { RUID: 0, Regno: 0, RankID: 0, Date: null, Active: false });

module.exports = Rank_Upgrade;
