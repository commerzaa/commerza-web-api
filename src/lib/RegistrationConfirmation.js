'use strict';
/**
 * Exports: Verification(string StrPLID, string StrEmailID, string HtmlMailPath): string;
 *   updatemember(int Regno, string EmailID, string mode, string HtmlMailPath): void;
 *   EncryptFunction(string number): string; Decrypt(string input): string
 */
const db = require('../db');
const CustomEncriptionAndDecription = require('./CustomEncriptionAndDecription');
const { out } = require('./_libhelpers');

async function Verification(StrPLID, StrEmailID, HtmlMailPath) {
  let PLID = 0;
  let IntResult = 0;
  try {
    const posA = StrPLID.lastIndexOf('=');
    const adjustedPosA = posA + 'a'.length;
    const ID = StrPLID.substring(adjustedPosA);
    const parsed = /^\s*[+-]?\d+\s*$/.test(ID) ? parseInt(ID, 10) : NaN;
    const IsValid = Number.isInteger(parsed) && parsed >= -2147483648 && parsed <= 2147483647;
    if (IsValid) {
      PLID = parsed;
      const row = await db.procOne('affiliate', 'usp_checking_email_click_visitor', { plid: PLID, emailid: StrEmailID });
      const v = out(row, 'intresult');
      if (v === null || v === undefined) throw new Error('Object reference not set to an instance of an object.');
      IntResult = parseInt(String(v), 10);
      if (Number.isNaN(IntResult)) throw new Error('Input string was not in a correct format.');
      if (IntResult === 1) {
        return 'Your Email Id is Already Verified.';
      }
      if (IntResult === 2) {
        return 'Page Not Found Sorry.';
      }
      if (IntResult === 3) {
        await updatemember(PLID, StrEmailID, 'Direct', HtmlMailPath);
      }
      if (IntResult === 4) {
        return 'Your Verfication Link Has Been Expired.';
      }
    }
  } catch (ExpObj) {
    return 'Some Error Here.';
  }
  return 'All Ok';
}

async function updatemember(Regno, EmailID, mode, HtmlMailPath) {
  const row = await db.procOne('affiliate', 'usp_memberemailverification', { regno: Regno, isplacedinstucture: 1 });
  // eslint-disable-next-line no-unused-vars
  const Result = String(out(row, 'result'));
}

function EncryptFunction(number) {
  const p = new CustomEncriptionAndDecription();
  return p.encryption(number);
}

function Decrypt(input) {
  const p = new CustomEncriptionAndDecription();
  return p.decryption(input);
}

module.exports = { Verification, updatemember, EncryptFunction, Decrypt };
