/** Exports: class Franchise_Catogory_Master (table tbl_franchise_catogory_master; props FCMID, Name, Amount, Security_Per, Security_Amount, Commission_Per, Status, all_name ; [NotMapped] all_name)
 *   static async AllFranchise_Catogory() : Franchise_Catogory_Master[]  (Status == 1; all_name = Name + " ( " + Amount.ToString("Rs0.00") + ")")
 */
'use strict';
const { query } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Franchise_Catogory_Master', 'tbl_franchise_catogory_master', { FCMID: 0, Name: null, Amount: 0, Security_Per: 0, Security_Amount: 0, Commission_Per: 0, Status: 0, all_name: null }, ['all_name']);

// decimal.ToString("Rs0.00"): "Rs" literal, 2 decimals, sign in front
function fmtRs(v) {
  const n = Number(v || 0);
  return (n < 0 ? '-' : '') + 'Rs' + Math.abs(n).toFixed(2);
}

class Franchise_Catogory_Master extends Base {
  static async AllFranchise_Catogory() {
    const LiFranchise_Catogory = Base.mapAll(await query(DB, 'select * from tbl_franchise_catogory_master where status=1'));
    const li = [];
    for (const item of LiFranchise_Catogory) {
      const obj = new Franchise_Catogory_Master(item);
      obj.all_name = item.Name + ' ( ' + fmtRs(item.Amount) + ')';
      li.push(obj);
    }
    return li;
  }
}

module.exports = Franchise_Catogory_Master;
