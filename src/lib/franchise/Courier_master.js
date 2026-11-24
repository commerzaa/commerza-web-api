/** Exports: class Courier_master (table tbl_couriermaster; props Active, Address, Carrier_ID, Carrier_Name, CMID, ContactNo, Create_date)   async AllCarrier_Master() : Courier_master[]  (Active == true) */
'use strict';
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');

class Courier_master {
  async AllCarrier_Master() {
    return mapRows(await query('shopping', 'select * from tbl_couriermaster where active::int=1'), ['Active', 'Address', 'Carrier_ID', 'Carrier_Name', 'CMID', 'ContactNo', 'Create_date']);
  }
}

module.exports = Courier_master;
