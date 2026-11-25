/** Exports (C# Common/ToDataTable.cs, static class Common.Common.ToDataTable, MLM Admin):
 *   ListToDatatable(items, typeName?) : DataTable   [sync]
 *   DataTable representation (shared with ./Helper): an ARRAY of row objects (one key per column, column order = property order) carrying
 *   two non-enumerable properties: `TableName` (typeof(T).Name => `typeName` or 'Table') and `Columns` (string[] of column names).
 *   Helper.GenerateExcelReport recognises this shape as the DataTable overload.
 *   Also exports isDataTable(x).
 * No Member/API equivalent exists => ported.
 * PORT-NOTE: C# reflection over typeof(T) public instance properties => the keys of the objects in `items` (union, first-seen order). For an empty list
 *   the column set is unknown in JS (C# still had the typed columns); it only matters for the header row of an empty export, where Helper prints "Records not found." anyway.
 */
'use strict';

function ListToDatatable(items, typeName) {
  const list = items || [];
  const columns = [];
  const seen = new Set();
  for (const it of list) {
    if (!it || typeof it !== 'object') continue;
    for (const k of Object.keys(it)) {
      if (!seen.has(k)) { seen.add(k); columns.push(k); }
    }
  }
  const dataTable = list.map((item) => {
    const values = {};
    for (const c of columns) values[c] = item && item[c] !== undefined ? item[c] : null;
    return values;
  });
  Object.defineProperty(dataTable, 'TableName', { value: typeName || 'Table', enumerable: false, writable: true });
  Object.defineProperty(dataTable, 'Columns', { value: columns, enumerable: false, writable: true });
  return dataTable;
}

const isDataTable = (x) => Array.isArray(x) && Array.isArray(x.Columns);

module.exports = { ListToDatatable, isDataTable };
