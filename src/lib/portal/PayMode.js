/** Exports: class PayMode (table pay_mode; props Active, Currency, Image, IsTesting, Name, Password, pm_code, pmid, Salt, UsedIn, UserID)
 *   async allpaymodes() : PayMode[]                     (all rows)
 *   async paymodeby_pmcode(string Pmcode) : PayMode|null (Active == 1 && pm_code == Pmcode, first row)
 * Note: Password/Salt are DB columns of the legacy entity (returned as the C# did); they are not secrets in code.
 */
'use strict';
const { query, queryOne } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');

const PROPS = ['Active', 'Currency', 'Image', 'IsTesting', 'Name', 'Password', 'pm_code', 'pmid', 'Salt', 'UsedIn', 'UserID'];

class PayMode {
  async allpaymodes() {
    return mapRows(await query('shopping', 'select * from pay_mode'), PROPS);
  }

  async paymodeby_pmcode(Pmcode) {
    const row = Pmcode === null || Pmcode === undefined
      ? await queryOne('shopping', 'select * from pay_mode where active::int=1 and pm_code is null limit 1')
      : await queryOne('shopping', 'select * from pay_mode where active::int=1 and pm_code=@Pmcode limit 1', { Pmcode });
    return mapRow(row, PROPS);
  }
}
PayMode.PROPS = PROPS;
PayMode.TABLE = 'pay_mode';

module.exports = PayMode;
