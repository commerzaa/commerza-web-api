/**
 * Exports (static class RegistrationConfirmation): async Verification(string StrPLID, string StrEmailID, string HtmlMailPath): string;
 *   async updatemember(int PLID, string EmailID, string mode, string HtmlMailPath): void;
 *   EncryptFunction(string number): string; Decrypt(string input): string
 * Portal: calls USP_CHECKING_EMAIL_CLICK_VISITOR / USP_UPDATEVISITOR_bak05102017 (Merchant used USP_UPDATEVISITOR); both exist in Db_Shopping dump.
 */
'use strict';
const db = require('../../db');
const CustomEncriptionAndDecription = require('./CustomEncriptionAndDecription');
const SendConfirmationMail = require('./SendConfirmationMail');

const pick = (row, name) => {
  if (!row) return undefined;
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase());
  return k !== undefined ? row[k] : row[Object.keys(row)[0]];
};

async function Verification(StrPLID, StrEmailID, HtmlMailPath) {
  let PLID = 0;
  let IntResult = 0;
  try {
    StrPLID = Decrypt(StrPLID);
    const posA = StrPLID.lastIndexOf('=');
    const adjustedPosA = posA + 'a'.length;
    const ID = StrPLID.substring(adjustedPosA);
    const IsValid = /^\s*[+-]?\d+\s*$/.test(ID) && Math.abs(parseInt(ID, 10)) <= 2147483647;
    if (IsValid) {
      PLID = parseInt(ID, 10);
      const row = await db.procOne('shopping', 'usp_checking_email_click_visitor', { plid: PLID, emailid: StrEmailID });
      const v = pick(row, 'intresult');
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
  } catch (e) {
    return 'Some Error Here.';
  }
  return 'All Ok';
}

async function updatemember(PLID, EmailID, mode, HtmlMailPath) {
  let IntResult = 0;
  let matplid = 0;
  const row = await db.procOne('shopping', 'usp_updatevisitor_bak05102017', { plid: PLID });
  const r = pick(row, 'intresult');
  const m = row ? (Object.keys(row).find((x) => x.toLowerCase() === 'maxplid') !== undefined ? row[Object.keys(row).find((x) => x.toLowerCase() === 'maxplid')] : undefined) : undefined;
  if (r === null || r === undefined || m === null || m === undefined) throw new Error('Object reference not set to an instance of an object.');
  IntResult = parseInt(String(r), 10);
  matplid = parseInt(String(m), 10);
  if (Number.isNaN(IntResult) || Number.isNaN(matplid)) throw new Error('Input string was not in a correct format.');
  if (IntResult === 1) {
    if (mode === 'Direct') {
      // empty in legacy
    }
    // legacy: new Thread(...).Start() => fire and forget
    Promise.resolve().then(() => SendConfirmationMail.SendMail(matplid, EmailID, HtmlMailPath)).catch((e) => console.error('[SendMail]', e && e.message));
  }
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
