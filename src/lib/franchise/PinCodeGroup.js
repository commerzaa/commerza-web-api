/** Exports: class PinCodeGroup (table tbl_pincodegroup; props AreaIds, GroupName, Id, IsActive, IsDefault, ToUserId, ToUserType)
 *   async GetPinCodeGroupName(string Ids) : string   (same accumulate/reset semantics as the C#)
 */
'use strict';
const { queryOne } = require('../../db');
const { mapRow } = require('../../utils/shape');

function toInt32(s) {
  const t = String(s).trim();
  if (!/^[+-]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  return parseInt(t, 10);
}

class PinCodeGroup {
  async GetPinCodeGroupName(Ids) {
    let str = '';
    if (Ids !== null && Ids !== undefined && Ids !== '') {
      const arr = Ids.split(',');
      for (const Item of arr) {
        const id = toInt32(Item);
        const obj = mapRow(await queryOne('shopping', 'select * from tbl_pincodegroup where id=@id limit 1', { id }), ['AreaIds', 'GroupName', 'Id', 'IsActive', 'IsDefault', 'ToUserId', 'ToUserType']);
        if (obj !== null) {
          str += obj.GroupName + ',';
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

module.exports = PinCodeGroup;
