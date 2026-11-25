/** Exports: class TBL_COMPANYMASTER (table tbl_companymaster; props COMID, SOFTWARE_URL, NAME, LOGO)
 *   async CompanyMaster_Ddl() : TBL_COMPANYMASTER[]  (COMID, NAME, LOGO, SOFTWARE_URL; by NAME)
 *   async CompanyMaster() : TBL_COMPANYMASTER | null  (first row)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('TBL_COMPANYMASTER', 'tbl_companymaster', { COMID: 0, SOFTWARE_URL: null, NAME: null, LOGO: null });

class TBL_COMPANYMASTER extends Base {
  async CompanyMaster_Ddl() {
    const Rows = await query(DB, 'select comid, name, logo, software_url from tbl_companymaster order by name');
    const li = [];
    for (const item of Rows) {
      const obj = new TBL_COMPANYMASTER();
      obj.COMID = item.comid;
      obj.NAME = item.name;
      obj.LOGO = item.logo;
      obj.SOFTWARE_URL = item.software_url;
      li.push(obj);
    }
    return li;
  }

  async CompanyMaster() {
    return Base.map(await queryOne(DB, 'select * from tbl_companymaster limit 1'));
  }
}

module.exports = TBL_COMPANYMASTER;
