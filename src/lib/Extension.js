'use strict';
/**
 * Exports (C# extension methods, called as functions with the value as first arg):
 *   ToStringOrEmpty(value:object):string      ToIntOrZero(value:object):int
 *   ToCurrency(value:decimal|int):string      ToCurrencyWithoutSymbol(value:decimal|int):string
 *   ToCurrencyInt(value:object):string        ToCurrencyWithoutSymbolInt(value:object):string
 *   TimeAgo(dt:Date):string
 */

// .NET "C" format with en-US culture: $1,234.56 / negatives ($1,234.56); rounding away from zero
function cFormat(n) {
  const abs = Math.abs(n);
  const rounded = Math.round((abs + Number.EPSILON) * 100) / 100;
  const body = '$' + rounded.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 && rounded !== 0 ? '(' + body + ')' : body;
}

// Convert.ToInt64 / ToInt32 semantic: banker's rounding for floating values, parse for strings
function bankers(x) {
  const f = Math.floor(x);
  const d = x - f;
  if (d < 0.5) return f;
  if (d > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}
function convertToInt(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'string') {
    const s = value.trim();
    if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
    return parseInt(s, 10);
  }
  const n = Number(value);
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return bankers(n);
}
function toDecimal(value) {
  const n = Number(value);
  if (value === null || value === undefined || Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
}

function ToStringOrEmpty(value) {
  return value === null || value === undefined ? '' : String(value);
}

function ToIntOrZero(value) {
  return value === null || value === undefined ? 0 : convertToInt(value);
}

function ToCurrency(values) {
  return cFormat(toDecimal(values));
}

// PORT-NOTE: legacy removes the first 2 chars (written for "Rs. "-like prefixes); with en-US "$" this also drops the
// first digit. Reproduced exactly as in the C# source.
function ToCurrencyWithoutSymbol(values) {
  return cFormat(toDecimal(values)).substring(2).trim();
}

function ToCurrencyInt(values) {
  const str = cFormat(convertToInt(values));
  const i = str.indexOf('.');
  return str.substring(0, i) + str.substring(i + 3);
}

function ToCurrencyWithoutSymbolInt(values) {
  let str = cFormat(convertToInt(values));
  const i = str.indexOf('.');
  str = str.substring(0, i) + str.substring(i + 3);
  return str.substring(2).trim();
}

function TimeAgo(dt) {
  const ms = Date.now() - new Date(dt).getTime();
  const t = Math.trunc;
  const days = t(ms / 86400000);
  const hours = t(ms / 3600000) % 24;
  const minutes = t(ms / 60000) % 60;
  const seconds = t(ms / 1000) % 60;
  if (days > 365) {
    let years = t(days / 365);
    if (days % 365 !== 0) years += 1;
    return `${years} ${years === 1 ? 'year' : 'years'} ago`;
  }
  if (days > 30) {
    let months = t(days / 30);
    if (days % 31 !== 0) months += 1;
    return `${months} ${months === 1 ? 'month' : 'months'} ago`;
  }
  if (days > 0) return `${days} ${days === 1 ? 'day' : 'days'} ago`;
  if (hours > 0) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  if (minutes > 0) return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  if (seconds > 5) return `${seconds} seconds ago`;
  if (seconds <= 5) return 'just now';
  return '';
}

module.exports = {
  ToStringOrEmpty, ToIntOrZero, ToCurrency, ToCurrencyWithoutSymbol,
  ToCurrencyInt, ToCurrencyWithoutSymbolInt, TimeAgo,
};
