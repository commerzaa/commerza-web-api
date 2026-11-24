/** Exports (C# static class Utility in Models/ConvertUtility.cs): ConvertCSVtoDataTable(string strFilePath) : object[] ;
 *  async ConvertXSLXtoDataTable(string strFilePath, string connString) : object[] ; async ConvertXSLXtoDataTableMerchantorder(string strFilePath, string connString) : object[]
 *  A DataTable is returned as an array of row objects keyed by column name (CSV: header names; XLSX: F1..Fn like OleDb HDR=NO).
 *  Requires npm package: xlsx  (for the two XLSX functions only)
 */
'use strict';
const fs = require('fs');
const { exec } = require('../../db');

// PORT-NOTE: StreamReader.ReadLine splits on \r\n, \n or \r.
function ConvertCSVtoDataTable(strFilePath) {
  const dt = [];
  const lines = fs.readFileSync(strFilePath, 'utf8').replace(/^\uFEFF/, '').split(/\r\n|\n|\r/);
  if (lines.length && lines[lines.length - 1] === '') lines.pop(); // EndOfStream
  if (!lines.length) throw new TypeError('Object reference not set to an instance of an object.'); // ReadLine() == null
  const headers = lines[0].split(',');
  const seen = new Set();
  for (const h of headers) {
    if (seen.has(h)) throw new Error("A column named '" + h + "' already belongs to this DataTable.");
    seen.add(h);
  }
  for (let li = 1; li < lines.length; li++) {
    const rows = lines[li].split(',');
    if (rows.length > 1) {
      const dr = {};
      for (let i = 0; i < headers.length; i++) {
        if (i >= rows.length) throw new RangeError('Index was outside the bounds of the array.');
        dr[headers[i]] = rows[i].trim();
      }
      dt.push(dr);
    }
  }
  return dt;
}

// Emulates: SELECT * FROM [Sheet1$] where [Fa] IS NOT NULL and [Fb] IS NOT NULL   (OleDb, HDR=NO => columns F1..Fn)
async function _readSheet1(strFilePath, a, b) {
  let dt = [];
  try {
    const XLSX = require('xlsx');
    const wb = XLSX.readFile(strFilePath);
    const ws = wb.Sheets.Sheet1 || wb.Sheets[wb.SheetNames[0]];
    const arr = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, blankrows: true });
    const rows = arr.map((r) => {
      const o = {};
      r.forEach((v, i) => { o['F' + (i + 1)] = v === undefined ? null : v; });
      return o;
    });
    const res = rows.filter((r) => r[a] != null && r[b] != null);
    if (res.length > 0) dt = res;
  } catch (Ex) {
    await exec('shopping', 'insert into errorlogtable values(420, now())');
    throw Ex;
  }
  return dt;
}

// connString (OleDb provider string) is not needed: the file is read directly.
async function ConvertXSLXtoDataTable(strFilePath, connString) {
  return _readSheet1(strFilePath, 'F6', 'F5');
}

async function ConvertXSLXtoDataTableMerchantorder(strFilePath, connString) {
  return _readSheet1(strFilePath, 'F2', 'F3');
}

module.exports = { ConvertCSVtoDataTable, ConvertXSLXtoDataTable, ConvertXSLXtoDataTableMerchantorder };
