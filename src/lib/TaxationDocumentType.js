/** Exports: class TaxationDocumentType (table tbl_pancardmaster; props PID, TITLE, Status, Active, CreadteOn)   async TaxationDocDropDowen() : TaxationDocumentType[] (Status true) */
'use strict';
const { query } = require('../db');
const { mapRows } = require('../utils/shape');

const PROPS = ['PID', 'TITLE', 'Status', 'Active', 'CreadteOn'];

class TaxationDocumentType {
  async TaxationDocDropDowen() {
    return mapRows(await query('affiliate', 'select * from tbl_pancardmaster where status::int=1'), PROPS);
  }
}

module.exports = TaxationDocumentType;
