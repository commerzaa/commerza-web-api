/** Exports: class Distributor (table distributor_master; props pmId, CompanyName, MOBILENO, ADDRESS, TITLE, AREANAME, PINCODE, LANKMARK)
 *   async BindDistributor() : Distributor[]
 *   async GetDistributor(int Id) : Distributor|null
 *   async GetDistributorsBySearch(string search) : Distributor[]
 */
'use strict';
const { query, queryOne } = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');

const PROPS = ['pmId', 'CompanyName', 'MOBILENO', 'ADDRESS', 'TITLE', 'AREANAME', 'PINCODE', 'LANKMARK'];

class Distributor {
  async BindDistributor() {
    return mapRows(await query('shopping', 'select pmid, companyname from distributor_master where active::int=1'), PROPS);
  }

  async GetDistributor(Id) {
    return mapRow(await queryOne('shopping',
      'select pmid::int as pmid, companyname, mobileno, address, title, areaname, pincode, lankmark from distributor_master where pmid=@PMID limit 1', { PMID: Id }), PROPS);
  }

  async GetDistributorsBySearch(search) {
    // string.IsNullOrWhiteSpace
    if (search === null || search === undefined || String(search).trim() === '') {
      return mapRows(await query('shopping', 'select pmid::int as pmid, companyname from distributor_master where active::int=1'), PROPS);
    }
    // PORT-NOTE: SQL Server LIKE is case-insensitive under the default collation => ILIKE.
    return mapRows(await query('shopping',
      "select pmid::int as pmid, companyname from distributor_master where active::int=1 and companyname ilike '%' || @search || '%'", { search }), PROPS);
  }
}

module.exports = Distributor;
