/** Exports (C# static class Utility in Models/ConvertUtility.cs; also available as ./Utility):
 *   ConvertCSVtoDataTable(string strFilePath) : object[]          (same code as ../franchise/ConvertUtility.js, reused)
 *   async ConvertXSLXtoDataTable(string strFilePath, string connString) : object[]          (SELECT * FROM [NEFT Converter$]; errors swallowed => [])
 *   async ConvertXSLXtoDataTable_orders(string strFilePath, string connString) : object[]   (SELECT * FROM [Sheet1$]; errors swallowed => [])
 *  A DataTable is returned as an array of row objects keyed by column name. Requires npm package xlsx (lazy).
 *  Differs from the Franchise Utility: no WHERE filters, no errorlogtable insert, exceptions are swallowed, sheet "NEFT Converter".
 */
'use strict';
const { ConvertCSVtoDataTable } = require('../franchise/ConvertUtility');

// PORT-NOTE: OleDb (ACE) is replaced by the xlsx package. connString is only inspected for HDR=YES|NO
// (admin callers pass HDR=NO => columns F1..Fn, every row including the first is data). A missing sheet throws => swallowed like the legacy catch.
function _readSheet(strFilePath, connString, sheetName) {
  const XLSX = require('xlsx');
  const wb = XLSX.readFile(strFilePath);
  const ws = wb.Sheets[sheetName];
  if (!ws) throw new Error(`'${sheetName}$' is not a valid name.`);
  const arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: false });
  const hdr = /HDR\s*=\s*YES/i.test(String(connString || ''));
  if (hdr) {
    const headers = (arr.shift() || []).map((h, i) => (h === null || h === undefined || h === '' ? 'F' + (i + 1) : String(h)));
    return arr.map((r) => {
      const o = {};
      headers.forEach((h, i) => { o[h] = r[i] === undefined ? null : r[i]; });
      return o;
    });
  }
  const width = arr.reduce((m, r) => Math.max(m, r.length), 0);
  return arr.map((r) => {
    const o = {};
    for (let i = 0; i < width; i++) o['F' + (i + 1)] = r[i] === undefined ? null : r[i];
    return o;
  });
}

async function ConvertXSLXtoDataTable(strFilePath, connString) {
  let dt = [];
  try {
    dt = _readSheet(strFilePath, connString, 'NEFT Converter');
  } catch (e) {
    // legacy: empty catch
  }
  return dt;
}

async function ConvertXSLXtoDataTable_orders(strFilePath, connString) {
  let dt = [];
  try {
    dt = _readSheet(strFilePath, connString, 'Sheet1');
  } catch (e) {
    // legacy: empty catch
  }
  return dt;
}

module.exports = { ConvertCSVtoDataTable, ConvertXSLXtoDataTable, ConvertXSLXtoDataTable_orders };
