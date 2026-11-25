/** Exports: class Carrier_Master (table tbl_carriermaster; props CMID, Carrier_ID, Carrier_Name, Address, ContactNo, Create_date, Active)
 *   async AllCarrier_Master() : Carrier_Master[]  (Active)
 */
'use strict';
const { query } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Carrier_Master', 'tbl_carriermaster', { CMID: 0, Carrier_ID: null, Carrier_Name: null, Address: null, ContactNo: null, Create_date: null, Active: false });

class Carrier_Master extends Base {
  async AllCarrier_Master() {
    return Base.mapAll(await query(DB, 'select * from tbl_carriermaster where active::int=1'));
  }
}

module.exports = Carrier_Master;
