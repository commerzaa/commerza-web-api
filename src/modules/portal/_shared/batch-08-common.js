'use strict';
/**
 * Small helpers shared by the batch-08 portal controller ports (not a router: lives in _shared/).
 * Exports: DB, nn(v), isEmpty(v), outCol(row, name), toInt(v, name), toDbl(v), toLong(v), csBool(v), boolStr(v),
 *          LIST_ITEMS_SMS(), masterpageshow(req), sqlServerDate100(col), csReplace(s, a, b)
 */
const ps = require('./portal-session');

const DB = 'shopping';

/** string null -> "" */
const nn = (v) => (v === undefined || v === null ? '' : String(v));
/** v == null || v == "" */
const isEmpty = (v) => v === undefined || v === null || v === '';

/** OUTPUT parameter of a ported proc: column `name` (case-insensitive) of the result row; null when missing. */
function outCol(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k === undefined ? null : row[k];
}

/** Convert.ToInt32 / int binding: throws FormatException-like error on bad input. */
function toInt(v, name) {
  if (v === undefined || v === null || v === '') {
    if (name) throw Object.assign(new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Int32'.`), { status: 500 });
    return 0;
  }
  const n = Number(String(v).trim());
  if (!Number.isFinite(n)) throw new Error('Input string was not in a correct format.');
  return Math.trunc(n);
}
/** Convert.ToDouble(string) (null -> 0) */
function toDbl(v) {
  if (v === undefined || v === null) return 0;
  if (typeof v === 'number') return v;
  const n = Number(String(v).trim());
  if (String(v).trim() === '' || !Number.isFinite(n)) throw new Error('Input string was not in a correct format.');
  return n;
}
/** Convert.ToInt64(object) (null -> 0) */
function toLong(v) {
  if (v === undefined || v === null) return 0;
  return toInt(v);
}
/** bool model binding ("true"/"false"/"on"...). */
const csBool = (v) => v === true || ['true', 'on', '1'].includes(String(v).toLowerCase().split(',')[0]);
/** bool.ToString() */
const boolStr = (v) => ((v === true || v === 1 || v === '1' || v === 't' || v === 'true') ? 'True' : 'False');

const LIST_ITEMS_SMS = () => [{ Text: 'Transactional', Value: '1' }, { Text: 'Promotional', Value: '2' }];

/** if (Session["LoginwithMobile"] != null) ViewBag.masterpageshow = "MobileLogin"; else ""; */
const masterpageshow = (req) => (ps.sessionGet(req, 'LoginwithMobile') !== null ? 'MobileLogin' : '');

/** CONVERT(VARCHAR(30), col, 100)  => "Mon dd yyyy hh:miAM" */
const sqlServerDate100 = (col) => `(to_char(${col}, 'Mon ') || lpad(extract(day from ${col})::int::text, 2, ' ') || to_char(${col}, ' YYYY ') || lpad(to_char(${col}, 'FMHH12'), 2, ' ') || to_char(${col}, ':MIAM'))`;

/** C# string.Replace (all occurrences, literal). */
const csReplace = (s, a, b) => String(s).split(a).join(b);

module.exports = { DB, nn, isEmpty, outCol, toInt, toDbl, toLong, csBool, boolStr, LIST_ITEMS_SMS, masterpageshow, sqlServerDate100, csReplace };

/**
 * Controllers/CustomerPanel/AddTicket.cs AddTicketController.ImageUploadMasterMethod(string ImageBase64Code, string SavePaths, string IdForAppend)
 * (used by SupportRequest.PostAReplyOnTicket via `new AddTicketController()`). Saves under config.uploadDir/<SavePaths>.
 * PORT-NOTE: System.Drawing Image.FromStream validation and the scale-1 GetThumbnailImage JPEG re-encode are skipped; the decoded
 * bytes are written unchanged under the same name.
 */
function ImageUploadMasterMethod(ImageBase64Code, SavePaths, IdForAppend) {
  const fs = require('fs');
  const path = require('path');
  const config = require('../../../config');
  if (ImageBase64Code === undefined || ImageBase64Code === null) throw new TypeError('Object reference not set to an instance of an object.');
  let RealImageName = '';
  if (ImageBase64Code.trim() !== '') {
    let Base64String = '';
    if (ImageBase64Code !== '') {
      Base64String = ImageBase64Code;
      let Image = String(100000 + Math.floor(Math.random() * 900000));
      Image = Image.trim();
      Image = csReplace(Image, '&amp;', 'And');
      Image = csReplace(Image, '&', ' And ');
      Image = Image.replace(/[^\w\d]/g, '');
      Image = csReplace(Image, ' ', '-');
      RealImageName = Image + '-' + IdForAppend + '.jpg';
    } else {
      RealImageName = ' ';
    }
    const dir = path.join(config.uploadDir, String(SavePaths || '').replace(/^~?[\\/]+/, ''));
    const full = path.join(dir, RealImageName);
    if (Base64String.includes('base64,')) {
      Base64String = Base64String.substring(Base64String.indexOf(',') + 1);
      const bytes = Buffer.from(Base64String, 'base64');
      fs.mkdirSync(dir, { recursive: true });
      if (fs.existsSync(full)) fs.unlinkSync(full);
      fs.writeFileSync(full, bytes);
    } else {
      RealImageName = ImageBase64Code.replace(/^\/+/, '');
    }
  }
  return RealImageName;
}

module.exports.ImageUploadMasterMethod = ImageUploadMasterMethod;

/** decimal model binding / Convert.ToDecimal(string): plain decimal text -> number; throws on bad input (null/"" -> throws unless allowEmpty). */
function toDecimal(v) {
  if (typeof v === 'number') return v;
  const t = String(v === undefined || v === null ? '' : v).trim();
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(t)) throw new Error('Input string was not in a correct format.');
  return Number(t);
}
/** Convert.ToString(decimal) for a decimal bound from text: keeps the scale of the input ("100.50" -> "100.50", "007" -> "7"). */
function decimalText(raw, num) {
  const t = String(raw === undefined || raw === null ? '' : raw).trim().replace(/^\+/, '');
  const m = /^(-?)(\d*)(?:\.(\d*))?$/.exec(t);
  if (!m || (m[2] === '' && (m[3] === undefined || m[3] === ''))) return String(num);
  const intPart = (m[2] || '0').replace(/^0+(?=\d)/, '');
  const neg = m[1] && (Number(t) !== 0) ? '-' : '';
  return neg + intPart + (m[3] !== undefined && m[3] !== '' ? '.' + m[3] : '');
}
/** Convert.ToInt32(decimal): banker's rounding. */
function bankersRound(n) {
  const f = Math.floor(n);
  const d = n - f;
  if (d > 0.5) return f + 1;
  if (d < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

module.exports.toDecimal = toDecimal;
module.exports.decimalText = decimalText;
module.exports.bankersRound = bankersRound;
