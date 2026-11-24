'use strict';
/**
 * PostgreSQL returns lower-case column names, while the legacy API serialised C# class property names
 * (PascalCase, as declared in the model class). Use these to keep the JSON contract identical.
 *
 *   mapRow(row, ['Plid','UserName','Email'])      -> { Plid, UserName, Email }  (missing => null)
 *   mapRows(rows, ['Plid', ...])
 *   mapRows(rows)                                  -> keys unchanged (when the SQL already aliases with quoted names)
 */
function mapRow(row, props) {
  if (!row) return null;
  if (!props) return row;
  const lower = {};
  for (const k of Object.keys(row)) lower[k.toLowerCase()] = row[k];
  const out = {};
  for (const p of props) out[p] = p.toLowerCase() in lower ? lower[p.toLowerCase()] : null;
  return out;
}
const mapRows = (rows, props) => (rows || []).map((r) => mapRow(r, props));

/** .NET DateTime JSON style "2020-01-31T10:20:30" (no zone / millis). */
function netDate(d) {
  if (!d) return null;
  const x = d instanceof Date ? d : new Date(d);
  return x.toISOString().replace(/\.\d{3}Z$/, '');
}

module.exports = { mapRow, mapRows, netDate };
