/**
 * Exports (static class DAL_VideoGallery): async InsertingVideo(string Title, string Vcode, string Vdid, string Pmid): string;
 *   async Login_Check(double Plid): VIDEODATA[]   (VIDEODATA = { ID, NAME, DATA, STATUS, PMID })
 * PORT-NOTE: Franchise DataBaseContext = Db_Shopping.
 */
'use strict';
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const { outValue } = require('../_http');

async function InsertingVideo(Title, Vcode, Vdid, Pmid) {
  const row = await db.procOne('shopping', 'usp_uploadzone', {
    pmid: Pmid.trim(), vdid: Vdid.trim(), name: Title.trim(), data: Vcode.trim(),
  });
  return outValue(row, 'INTRESULT'); // @INTRESULT OUT
}

async function Login_Check(Plid) {
  const r = await db.queryOne('shopping', 'select pmid from portal_master where plid = @Plid and active = 1 limit 1', { Plid });
  const Pmid = r ? r.pmid : 0; // FirstOrDefault<Int64> => 0
  const rows = await db.query('shopping', 'select id, name, data, status, pmid from videodata where pmid = @Pmid and status = 1', { Pmid });
  return mapRows(rows, ['ID', 'NAME', 'DATA', 'STATUS', 'PMID']);
}

module.exports = { InsertingVideo, Login_Check };
