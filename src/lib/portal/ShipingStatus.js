/** Exports: class ShipingStatus (table tbl_shipingstatus; props Description, IsActive, SHID, SrNo, Title)
 *   async ShipingStatusList() : ShipingStatus[]   (IsActive, ordered by SrNo)
 */
'use strict';
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');

const PROPS = ['Description', 'IsActive', 'SHID', 'SrNo', 'Title'];

class ShipingStatus {
  async ShipingStatusList() {
    return mapRows(await query('shopping', 'select * from tbl_shipingstatus where isactive::int=1 order by srno'), PROPS);
  }
}
ShipingStatus.PROPS = PROPS;
ShipingStatus.TABLE = 'tbl_shipingstatus';

module.exports = ShipingStatus;
