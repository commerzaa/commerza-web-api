/** Exports (C# Common.BAL.Exceldownloadhistory, MLM Admin, database 'affiliate'): class Exceldownloadhistory with
 *   static async Excel_history(int userid, string url, string Filename) : void
 * Legacy: [USP_EXCEL_DOWNLOAD_HISTORY] @ID,@DOWNLOADEDFROM,@FILENAME,@MODE ,@STRRESULT OUT  (@MODE = "1"; @STRRESULT is a result column, unused)
 * No Member/API equivalent exists => ported. Exceptions propagate like the legacy code (no try/catch).
 */
'use strict';
const { proc } = require('../../db');

const DB = 'affiliate';

class Exceldownloadhistory {
  static async Excel_history(userid, url, Filename) {
    await proc(DB, 'usp_excel_download_history', {
      id: userid,
      downloadedfrom: url,
      filename: Filename,
      mode: '1',
    });
  }
}

module.exports = Exceldownloadhistory;
