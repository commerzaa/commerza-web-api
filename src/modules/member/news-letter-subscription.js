'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\NewsLetterSubscription.cs (NewsLetterSubscriptionController) - 2 actions: Index, insert_email_newsletter */
const express = require('express');
const { proc } = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const DataUtility = require('../../lib/member/DataUtility');
const GetCountry = require('../../lib/member/GetCountry');

const router = express.Router();
const DB = 'affiliate';
const P = '/member/NewsLetterSubscription';
const outv = (rows, name) => { const r = rows && rows[0]; if (!r) return undefined; const k = Object.keys(r).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? undefined : r[k]; };

// public
router.all(`${P}/Index{/:id}`, asyncHandler(async (req, res) => {
  res.json({});
}));

// public
router.all(`${P}/insert_email_newsletter{/:id}`, asyncHandler(async (req, res) => {
  const emaild = req.p.emaild;
  let Result = '';
  if (sessionStore.get(req, 'COUNTRYID') == null) {
    try {
      const Sessionid = String(req.ip);
      await GetCountry.SettingVisitor(Sessionid);
      // PORT-NOTE: GetCountry.InitializeVisitorCountrySession fills a plain session object; its keys are mirrored into the session store
      const sess = {};
      await GetCountry.InitializeVisitorCountrySession(sess);
      for (const k of Object.keys(sess)) sessionStore.set(req, k, sess[k]);
    } catch (ExpObj) {
      try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'insert_email_newsletter', 0, req.path); } catch (_) { /* ignore */ }
    }
  }
  const CountryName = sessionStore.get(req, 'COUNTRYNAME').toString(); // null => TypeError (legacy NullReferenceException => 500)
  const IPAddress = sessionStore.get(req, 'IPADDRESS').toString();
  if (emaild.trim() !== '') { // emaild null => TypeError (legacy NullReferenceException)
    const rows = await proc(DB, 'usp_subscribenewsletter', { emailid: emaild, ipaddress: IPAddress, ipcountry: CountryName });
    const o = outv(rows, 'strresult');
    Result = o === undefined || o === null ? null : String(o);
    if (Result === null) throw new TypeError('Object reference not set to an instance of an object.');
  }
  // else: legacy built Json("Enter Email ID ") but discarded it
  res.json(Result);
}));

module.exports = router;
