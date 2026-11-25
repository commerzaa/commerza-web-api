/** Exports: class Carrier_Master (table tbl_carriermaster; props Active, Address, Carrier_ID, Carrier_Name, CMID, ContactNo, Create_date)
 *   async AllCarrier_Master() : Carrier_Master[]   (Active == true; exceptions propagate)
 * PORT-NOTE: table dbo.tbl_CarrierMaster is not present in the Db_Shopping schema dump; the query keeps the EF entity's table/columns.
 */
'use strict';
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');

const PROPS = ['Active', 'Address', 'Carrier_ID', 'Carrier_Name', 'CMID', 'ContactNo', 'Create_date'];

class Carrier_Master {
  async AllCarrier_Master() {
    return mapRows(await query('shopping', 'select * from tbl_carriermaster where active::int=1'), PROPS);
  }
}
Carrier_Master.PROPS = PROPS;
Carrier_Master.TABLE = 'tbl_carriermaster';

module.exports = Carrier_Master;
