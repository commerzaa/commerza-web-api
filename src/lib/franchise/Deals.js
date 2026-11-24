/** Exports: class Deals (table tbl_deals; props CreatedDate, DealType, DispalySorting, DisplayTimer, FromActive, Id, IsActive, Name, ToActive)
 *   async DealList() : Deals[] ; async GetDealsName(string Ids) : string   ("name," per id; "" when Ids empty or an id is not found - later ids may rebuild it, like the C#)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { mapRows, mapRow } = require('../../utils/shape');

const PROPS = ['CreatedDate', 'DealType', 'DispalySorting', 'DisplayTimer', 'FromActive', 'Id', 'IsActive', 'Name', 'ToActive'];

// Convert.ToInt32(string)
function toInt32(s) {
  const t = String(s).trim();
  if (!/^[+-]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  return parseInt(t, 10);
}

class Deals {
  async DealList() {
    return mapRows(await query('shopping', 'select * from tbl_deals'), PROPS);
  }

  async GetDealsName(Ids) {
    let str = '';
    if (Ids !== null && Ids !== undefined && Ids !== '') {
      const arr = Ids.replace(/^ +| +$/g, '').split(',');
      for (const Item of arr) {
        const id = toInt32(Item);
        const obj = mapRow(await queryOne('shopping', 'select * from tbl_deals where id=@id limit 1', { id }), PROPS);
        if (obj !== null) {
          str += obj.Name + ',';
        } else {
          str = '';
        }
      }
    } else {
      str = '';
    }
    return str;
  }
}

module.exports = Deals;
