/** Exports (C# Common/Helper.cs `public class Helper` (namespace Common.Common), MLM Admin): class Helper (instance)
 *   AddHeader(name, value = "") : void   [sync]  (NameValueCollection.Add: same name twice => values joined with ",")
 *   async GenerateExcelReport(_filepath, _sheetName, _dtOrList) : void
 *     - DataTable overload  GenerateExcelReport(string, string, DataTable)       when _dtOrList is a DataTable from ./ToDataTable.ListToDatatable (or null):
 *         header lines merged over A..E
 *     - generic overload    GenerateExcelReport<T>(string, string, IEnumerable<T>) for any other array of objects: header lines merged over A..C
 *     Also callable explicitly: GenerateExcelReportDataTable(_filepath, _sheetName, _dt) / GenerateExcelReportList(_filepath, _sheetName, _list).
 * NOT the API's ../Helper (Repository/Helper.cs) - different class => ported. Uses exceljs (installed; required lazily) instead of ClosedXML.
 * Legacy caller (All_Member_List): dt = ToDataTable.ListToDatatable(list); helper.GenerateExcelReport(HostingEnvironment.MapPath("~/DownloadedExcel/<name>.xlsx"), "All_Member_List", dt)
 *   => JS: path.join(config.uploadDir, 'DownloadedExcel', name + '.xlsx').
 * PORT-NOTE: ClosedXML InsertTable => exceljs addTable (name "Table1", theme TableStyleMedium2 = ClosedXML default, header row with filter buttons, row stripes).
 * PORT-NOTE: Columns().AdjustToContents() => width = longest text in the column + 2 (approximation of the font metrics ClosedXML uses).
 * PORT-NOTE: wb.Style.Alignment.Horizontal = Center / wb.Style.Font.Bold = true (applied after filling) => center + bold on every written cell.
 * PORT-NOTE: the parent folder of _filepath is created if missing (ClosedXML would throw DirectoryNotFoundException).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { isDataTable } = require('./ToDataTable');

const THIN = { style: 'thin' };

function cellValue(v) {
  if (v === undefined || v === null) return null;
  if (v instanceof Date || typeof v === 'number' || typeof v === 'boolean' || typeof v === 'string') return v;
  if (Buffer.isBuffer(v)) return v.toString('base64');
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

class Helper {
  constructor() {
    this.Headers = new Map(); // NameValueCollection (insertion ordered; Add appends)
  }

  AddHeader(name, value = '') {
    if (!this.Headers.has(name)) this.Headers.set(name, []);
    if (value !== null && value !== undefined) this.Headers.get(name).push(String(value));
  }

  /** NameValueCollection[key]: values joined with ",", null when none. */
  _headerValue(key) {
    const arr = this.Headers.get(key);
    return arr && arr.length ? arr.join(',') : null;
  }

  _writeHeaders(ws, lastCol) {
    const keys = [...this.Headers.keys()];
    for (let i = 0; i < keys.length; i++) {
      const r = i + 1;
      ws.mergeCells(`A${r}:${lastCol}${r}`);
      const cols = ['A', 'B', 'C', 'D', 'E'].slice(0, lastCol.charCodeAt(0) - 64);
      cols.forEach((c, idx) => {
        const b = { top: THIN, bottom: THIN };
        if (idx === 0) b.left = THIN;
        if (idx === cols.length - 1) b.right = THIN;
        ws.getCell(`${c}${r}`).border = b;
      });
      const cell = ws.getCell(`A${r}`);
      cell.font = { size: 14 };
      const val = this._headerValue(keys[i]);
      if (val !== null && val !== '') cell.value = (keys[i] + ' : ' + val).trim();
      else cell.value = keys[i];
    }
    let new_row = 0;
    if (keys.length > 0) {
      new_row = keys.length + 1;
      // ws.Row(new_row).Style.Border.* = None : the spacer row has no borders (nothing to do in exceljs)
    }
    return new_row;
  }

  static _insertTable(ws, startRow, columns, rows) {
    ws.addTable({
      name: 'Table1',
      ref: `A${startRow}`,
      headerRow: true,
      totalsRow: false,
      style: { theme: 'TableStyleMedium2', showRowStripes: true },
      columns: columns.map((c) => ({ name: String(c), filterButton: true })),
      rows: rows.map((r) => columns.map((c) => cellValue(r[c]))),
    });
  }

  static async _finish(wb, ws, _filepath) {
    // wb.Worksheet(1).Columns().AdjustToContents();
    const widths = {};
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (cell, col) => {
        if (cell.isMerged && cell.master !== cell) return;
        const v = cell.value;
        const len = v instanceof Date ? 19 : String(v === null || v === undefined ? '' : (v.richText ? v.richText.map((t) => t.text).join('') : v)).length;
        if (!cell.isMerged) widths[col] = Math.max(widths[col] || 0, len);
      });
    });
    for (const [col, w] of Object.entries(widths)) ws.getColumn(Number(col)).width = Math.min(w + 2, 255);
    // wb.Style.Alignment.Horizontal = Center; wb.Style.Font.Bold = true;
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: true }, (cell) => {
        cell.alignment = { ...(cell.alignment || {}), horizontal: 'center' };
        cell.font = { ...(cell.font || {}), bold: true };
      });
    });
    fs.mkdirSync(path.dirname(_filepath), { recursive: true });
    await wb.xlsx.writeFile(_filepath);
  }

  /** GenerateExcelReport(string _filepath, string _sheetName, DataTable _dt) */
  async GenerateExcelReportDataTable(_filepath, _sheetName, _dt) {
    const ExcelJS = require('exceljs');
    const aCode = 65;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(_sheetName);
    let new_row = 0;
    let columns;
    let rows;
    if (_dt === null || _dt === undefined || _dt.length === 0) {
      columns = ['Result'];
      rows = [{ Result: 'Records not found.' }];
    } else {
      new_row = this._writeHeaders(ws, String.fromCharCode(aCode + 4));
      columns = Array.isArray(_dt.Columns) ? _dt.Columns : Object.keys(_dt[0]);
      rows = _dt;
    }
    Helper._insertTable(ws, new_row + 1, columns, rows);
    await Helper._finish(wb, ws, _filepath);
  }

  /** GenerateExcelReport<T>(string _filepath, string _sheetName, IEnumerable<T> _list) */
  async GenerateExcelReportList(_filepath, _sheetName, _list) {
    const ExcelJS = require('exceljs');
    const aCode = 65;
    const wb = new ExcelJS.Workbook();
    let ws;
    if (_list === null || _list === undefined || _list.length === 0) {
      ws = wb.addWorksheet(_sheetName);
      Helper._insertTable(ws, 1, ['Result'], [{ Result: 'Records not found.' }]);
    } else {
      ws = wb.addWorksheet(_sheetName);
      const new_row = this._writeHeaders(ws, String.fromCharCode(aCode + 2));
      const columns = [];
      const seen = new Set();
      for (const it of _list) for (const k of Object.keys(it || {})) if (!seen.has(k)) { seen.add(k); columns.push(k); }
      Helper._insertTable(ws, new_row + 1, columns, _list);
    }
    await Helper._finish(wb, ws, _filepath);
  }

  /** Overload dispatcher (C# picks the overload at compile time; here: DataTable shape => DataTable overload). */
  async GenerateExcelReport(_filepath, _sheetName, _dtOrList) {
    if (_dtOrList === null || _dtOrList === undefined || isDataTable(_dtOrList)) {
      return this.GenerateExcelReportDataTable(_filepath, _sheetName, _dtOrList);
    }
    return this.GenerateExcelReportList(_filepath, _sheetName, _dtOrList);
  }
}

module.exports = Helper;
