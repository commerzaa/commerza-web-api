'use strict';
/**
 * PostgreSQL access layer (replaces EF6 DbContext / SqlQuery / ExecuteSqlCommand / SqlParameter).
 *
 * Two existing databases are used, exactly like the legacy app:
 *   'affiliate' -> legacy DataBaseContext / DefaultConnection  (Db_Affiliate)
 *   'shopping'  -> legacy Cart_Entity / shoppingConnection      (Db_Shopping)
 *
 * Usage (T-SQL "@name" parameters are kept, they are converted to $1..$n safely):
 *   const { query, queryOne, scalar, exec, proc, procOne, tx } = require('../db');
 *   const rows = await query('shopping', 'select * from tbl_customerlogin where username = @u', { u });
 *   const row  = await queryOne('affiliate', '...', {...});
 *   const val  = await scalar('affiliate', 'select count(*) from member_master where plid=@plid', { plid });
 *   const n    = await exec('affiliate', 'update ... where ...', {...});          // rowCount
 *   const rows = await proc('shopping', 'usp_portalmaster_searching_m_new', { mode: 's', cid: 96 });
 *
 * Identifiers are NOT quoted, so PostgreSQL folds them to lower case (the normal result of
 * migrating a SQL Server schema). If your migrated schema keeps mixed-case quoted identifiers,
 * adapt the SQL in the modules accordingly.
 */
const { Pool, types } = require('pg');
const config = require('../config');

// Return bigint / numeric as JS numbers (legacy API returned numbers, not strings)
types.setTypeParser(20, (v) => (v === null ? null : Number(v)));       // int8
types.setTypeParser(1700, (v) => (v === null ? null : parseFloat(v))); // numeric
// Keep timestamps as Date objects (JSON serialises to ISO strings)

const pools = {};
function getPool(name) {
  if (!pools[name]) {
    const c = config.pg[name];
    if (!c) throw new Error(`Unknown database "${name}" (use 'affiliate' or 'shopping')`);
    pools[name] = new Pool({ ...c, max: config.pg.max, ssl: config.pg.ssl, options: '-c search_path=dbo,public' });
    pools[name].on('error', (e) => console.error(`[pg:${name}] idle client error`, e.message));
  }
  return pools[name];
}

/**
 * Converts "@name" placeholders to "$n" and builds the values array.
 * Skips string literals, comments and "@@" (T-SQL globals). Same name reused => same $n.
 */
function bind(sql, params = {}) {
  if (Array.isArray(params)) return { text: sql, values: params };
  const values = [];
  const index = {};
  let out = '';
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "'") { // string literal
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") break;
        else j++;
      }
      out += sql.slice(i, j + 1); i = j + 1; continue;
    }
    if (ch === '-' && sql[i + 1] === '-') { // line comment
      let j = sql.indexOf('\n', i); if (j === -1) j = sql.length;
      out += sql.slice(i, j); i = j; continue;
    }
    if (ch === '@' && /[A-Za-z_]/.test(sql[i + 1] || '') && sql[i - 1] !== '@') {
      let j = i + 1;
      while (j < sql.length && /[A-Za-z0-9_]/.test(sql[j])) j++;
      const name = sql.slice(i + 1, j);
      const key = Object.keys(params).find((k) => k.toLowerCase() === name.toLowerCase());
      if (key === undefined) throw new Error(`SQL parameter @${name} was not supplied`);
      if (!(key in index)) { values.push(normalise(params[key])); index[key] = values.length; }
      out += '$' + index[key]; i = j; continue;
    }
    out += ch; i++;
  }
  return { text: out, values };
}

function normalise(v) {
  if (v === undefined) return null;
  if (v === '' ) return v;
  return v;
}

async function run(db, sql, params, client) {
  const { text, values } = bind(sql, params);
  const target = client || getPool(db);
  try {
    return await target.query(text, values);
  } catch (e) {
    e.sql = text;
    throw e;
  }
}

const query = async (db, sql, params) => (await run(db, sql, params)).rows;
const queryOne = async (db, sql, params) => (await run(db, sql, params)).rows[0] || null;
const exec = async (db, sql, params) => (await run(db, sql, params)).rowCount;
async function scalar(db, sql, params) {
  const r = (await run(db, sql, params)).rows[0];
  if (!r) return null;
  return r[Object.keys(r)[0]];
}

/**
 * Stored procedure call. SQL Server stored procedures are expected to exist as PostgreSQL
 * functions/procedures with the same name and (lower-cased) parameter names. Uses named notation:
 *   select * from usp_name(mode => $1, cid => $2)
 * Output parameters (@x OUT) should be columns of the function's result row.
 * >>> If your migrated functions use another naming/positional convention change ONLY this function. <<<
 */
function procSql(name, params = {}) {
  const keys = Object.keys(params);
  // Parameter names are double-quoted so reserved words (e.g. "check") work in named notation
  const args = keys.map((k, i) => `"${k.replace(/^@/, '').toLowerCase()}" => $${i + 1}`).join(', ');
  return { text: `select * from ${name.replace(/^\[?dbo\]?\.\[?|\]$/gi, '').replace(/[\[\]]/g, '').toLowerCase()}(${args})`, values: keys.map((k) => normalise(params[k])) };
}
async function proc(db, name, params = {}, client) {
  const { text, values } = procSql(name, params);
  try { return (await (client || getPool(db)).query(text, values)).rows; }
  catch (e) { e.sql = text; throw e; }
}
const procOne = async (db, name, params, client) => (await proc(db, name, params, client))[0] || null;
/** For procedures that return nothing / only affect rows (EXECUTE semantic) */
async function procExec(db, name, params = {}, client) {
  const rows = await proc(db, name, params, client);
  return rows;
}

/** Transaction helper: await tx('shopping', async (t) => { await t.exec(sql, params); ... }) */
async function tx(db, fn) {
  const client = await getPool(db).connect();
  const t = {
    query: async (sql, p) => (await run(db, sql, p, client)).rows,
    queryOne: async (sql, p) => (await run(db, sql, p, client)).rows[0] || null,
    scalar: async (sql, p) => { const r = (await run(db, sql, p, client)).rows[0]; return r ? r[Object.keys(r)[0]] : null; },
    exec: async (sql, p) => (await run(db, sql, p, client)).rowCount,
    proc: (name, p) => proc(db, name, p, client),
    procOne: (name, p) => procOne(db, name, p, client),
  };
  try {
    await client.query('BEGIN');
    const result = await fn(t);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
    throw e;
  } finally {
    client.release();
  }
}

async function ping() {
  const out = {};
  for (const n of ['affiliate', 'shopping']) {
    try { await getPool(n).query('select 1'); out[n] = 'ok'; } catch (e) { out[n] = 'error: ' + e.message; }
  }
  return out;
}

async function closeAll() { await Promise.all(Object.values(pools).map((p) => p.end())); }

module.exports = { getPool, bind, query, queryOne, scalar, exec, proc, procOne, procExec, tx, ping, closeAll };
