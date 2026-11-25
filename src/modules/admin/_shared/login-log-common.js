'use strict';
/**
 * Shared logic of Controllers/AdminPanel/AdminLoginLog.cs and MemberLoginLog.cs (identical structure, different proc / columns).
 * Exports: LOG_PROPS, pagePermissions(empId, url), excelLink(url), netFormatLoginDate(d), toNullableInt(v), exportTsv(...)
 * Not a router (lives in _shared/).
 */
const fs = require('fs');
const path = require('path');
const db = require('../../../db');
const config = require('../../../config');
const { errorInsert } = require('./admin-session');

const DB = 'affiliate';

/** class AdminLoginLog (Controllers/AdminPanel/AdminLoginLog.cs) */
const LOG_PROPS = ['ROWNUMBER', 'LOGID', 'EMP_NAME', 'EMAIL', 'IPADDRESS', 'ISSUCCESS', 'LOGINDATETIME', 'MOBILE', 'OTP',
  'PASSWORDATTEMPT', 'COUNTRY_NAME', 'STATE', 'MACADDRESS', 'SYSTEMNAME'];

const col = (row, name) => {
  if (!row) return undefined;
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? undefined : row[k];
};
const str = (v) => (v === null || v === undefined ? '' : String(v)); // OutputParameter.Value.ToString() (DBNull => "")

/** USP_GETEXCELPERMISIONSTATUS @EMPID,@HERF,@EXCELSTATUS out,@ISEDIT out (inline in the legacy controllers) */
async function pagePermissions(empId, url) {
  const row = await db.procOne(DB, 'USP_GETEXCELPERMISIONSTATUS', { EMPID: empId, HERF: url });
  const e = str(col(row, 'excelstatus'));
  const i = str(col(row, 'isedit'));
  return { isactive: parseInt(e === '' ? '0' : e, 10), isedit: parseInt(i === '' ? '0' : i, 10) };
}

/** USP_EXCEL_LINK @url,@ISACTIVE out => Convert.ToInt32(v == "0" ? "0" : v)  (DBNull => "" => FormatException, like legacy) */
async function excelLink(url) {
  const row = await db.procOne(DB, 'USP_EXCEL_LINK', { url });
  const v = str(col(row, 'isactive'));
  const n = parseInt(v === '0' ? '0' : v, 10);
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
}

/** int? model binding: missing / empty / invalid => null */
function toNullableInt(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isInteger(n) ? n : null;
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const p2 = (n) => String(n).padStart(2, '0');
/** DateTime.ToString("dd-MMM-yyyy hh:mm:ss, tt ") (throws on null, like a non-nullable DateTime from DBNull) */
function netFormatLoginDate(d) {
  if (d === null || d === undefined) throw new Error('Object reference not set to an instance of an object.');
  const x = d instanceof Date ? d : new Date(d);
  const h = x.getHours() % 12 === 0 ? 12 : x.getHours() % 12;
  return `${p2(x.getDate())}-${MON[x.getMonth()]}-${x.getFullYear()} ${p2(h)}:${p2(x.getMinutes())}:${p2(x.getSeconds())}, ${x.getHours() < 12 ? 'AM' : 'PM'} `;
}
/** DateTime.Now.ToString("ddMMyyyyhhmmss") */
function nowStamp() {
  const x = new Date();
  const h = x.getHours() % 12 === 0 ? 12 : x.getHours() % 12;
  return `${p2(x.getDate())}${p2(x.getMonth() + 1)}${x.getFullYear()}${p2(h)}${p2(x.getMinutes())}${p2(x.getSeconds())}`;
}

const tab = (v) => String(v).replace(/\t/g, '    '); // Regex.Replace(x, "\t", "    ")

/**
 * public void ExportReport(fromdate, todate, SearchField, SearchValue) body.
 * opts: { req, res, userid, url, prefix ('AdminLoginLog'|'MemberLoginLog'), procName, headers[], cells(item, write) (writes each cell, may throw) }
 * Returns { sent: true } when the download was written to `res`, else { sent: false, ViewBag }.
 */
async function exportTsv(opts) {
  const { req, res, userid, url, prefix, procName, headers, cells, fromdate, todate, SearchField, SearchValue } = opts;
  const ViewBag = {};
  const Filename = `${prefix}_${userid}_${nowStamp()}`;
  await db.proc(DB, 'USP_EXCEL_DOWNLOAD_HISTORY', { ID: userid, DOWNLOADEDFROM: url, FILENAME: Filename, MODE: '1' });
  // [proc] without @orderbydate (legacy passed 7 parameters here)
  const AllFreeEpinList = await db.proc(DB, procName, {
    STARTROWINDEX: 1, MAXROWS: 999999, FROMDATE: fromdate, TODATE: todate, SEARCHFIEL: str(SearchField).trim(), SEARCHVALUE: str(SearchValue).trim(),
  });
  if (AllFreeEpinList.length > 0) {
    try {
      const dir = path.join(config.uploadDir, 'AllExcelSheets');
      fs.mkdirSync(dir, { recursive: true });
      const filepath = path.join(dir, `${prefix}.xls`);
      ViewBag.filepath = filepath;
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      let out = headers.map((h) => `${h} \t`).join('');
      let closed = false; // StreamWriter closed by the inner catch => every further write throws ObjectDisposedException
      for (const item of AllFreeEpinList) {
        try {
          if (closed) throw new Error('Cannot write to a closed TextWriter.');
          out += '\n';
          await cells(item, (x) => { out += x; }); // written field by field: partial lines are kept, like the StreamWriter
        } catch (ExpObj) {
          await errorInsert(req, ExpObj, 'getblockedMemberList');
          closed = true;
        }
      }
      // wr.Close() => file written
      fs.writeFileSync(filepath, out);
      const dl = path.join(config.uploadDir, 'DownloadedExcel');
      fs.mkdirSync(dl, { recursive: true });
      const filepath1 = path.join(dl, `${Filename}.xls`);
      if (fs.existsSync(filepath1)) fs.unlinkSync(filepath1);
      // PORT-NOTE: legacy Response.Redirect("~/AllExcelSheets/<prefix>.xls") aborted the thread (ThreadAbortException,
      // logged by the catch via ErrorInsert) BEFORE File.Copy(filepath, filepath1) - so the DownloadedExcel copy never happened
      // and is not made here either. The file content is sent directly as the download.
      res.set('Content-Type', 'application/force-download');
      res.set('Content-Disposition', `attachment; filename=${prefix}.xls`);
      res.send(out);
      return { sent: true };
    } catch (ExpObj) {
      await errorInsert(req, ExpObj, 'usp_Blocked_memberList');
      ViewBag.filepath = ExpObj.message;
    }
  }
  return { sent: false, ViewBag };
}

module.exports = { LOG_PROPS, pagePermissions, excelLink, netFormatLoginDate, toNullableInt, exportTsv, col, str, tab };
