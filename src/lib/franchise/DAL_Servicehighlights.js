/**
 * Exports: class DAL_Servicehighlights { returnstringpmid(string encryptvalue): string; async GetAllSuggestedServices(string catstringid): GetAllRecords[] }
 * PORT-NOTE: GetAllRecords model class is not in the DAL sources; rows are returned with the lower-case column names of Get_Suggested_Serives.
 */
'use strict';
const db = require('../../db');
const UtilityClass = require('./UtilityClass');

class DAL_Servicehighlights {
  returnstringpmid(encryptvalue) {
    let pmidstr = '';
    try {
      pmidstr = UtilityClass.Decryptword(encryptvalue);
    } catch (ex) {
      pmidstr = '';
    }
    return pmidstr;
  }

  async GetAllSuggestedServices(catstringid) {
    return db.proc('shopping', 'get_suggested_serives', { catstringid });
  }
}

module.exports = DAL_Servicehighlights;
