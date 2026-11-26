/** Exports: class Tbl_Mobile_SP_Master (table tbl_mobile_sp_master; static PROPS, static TABLE)
 *   async GetAllMobileOperators() : Tbl_Mobile_SP_Master[]  (Status == true) */
'use strict';
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');

const PROPS = ['TMSPM', 'ProviderImage', 'ProviderName', 'Code', 'Commission', 'Status', 'ImageName', 'RedeemJpPointPercentage', 'RedeemEwalletPercenatge', 'EarnBvPercentage'];

class Tbl_Mobile_SP_Master {
  async GetAllMobileOperators() {
    return mapRows(await query('shopping', 'select * from tbl_mobile_sp_master where status::int=1'), PROPS);
  }
}
Tbl_Mobile_SP_Master.PROPS = PROPS;
Tbl_Mobile_SP_Master.TABLE = 'tbl_mobile_sp_master';

module.exports = Tbl_Mobile_SP_Master;
