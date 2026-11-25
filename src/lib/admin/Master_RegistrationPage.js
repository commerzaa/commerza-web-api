/** Exports: class Master_RegistrationPage (table tbl_detailspagemasterforregistration; props TDPMFRID, FIELDNAME, DISPLAYSHOW, SHOWACTIVE, VALIDATIONACTIVE, ISEDIT, STATUS, ACTIVE, ISADVANCE, ISSETTINGS, CONTROLNAME)
 *   async AllRoleList() : Master_RegistrationPage[]  (STATUS == 1 && TDPMFRID not in 25,27,23)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Master_RegistrationPage', 'tbl_detailspagemasterforregistration', { TDPMFRID: 0, FIELDNAME: null, DISPLAYSHOW: 0, SHOWACTIVE: 0, VALIDATIONACTIVE: 0, ISEDIT: 0, STATUS: 0, ACTIVE: 0, ISADVANCE: 0, ISSETTINGS: 0, CONTROLNAME: null });

class Master_RegistrationPage extends Base {
  async AllRoleList() {
    return Base.mapAll(await query(DB, 'select * from tbl_detailspagemasterforregistration where status=1 and tdpmfrid<>25 and tdpmfrid<>27 and tdpmfrid<>23'));
  }
}

module.exports = Master_RegistrationPage;
