'use strict';
/** Port of Controllers/AppRequiredController.cs (3 routes, all public). */
const express = require('express');
const { query, queryOne, exec } = require('../db');
const { mapRow } = require('../utils/shape');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

const APP_PROPS = ['id', 'currentVersion', 'createdate', 'isActive']; // legacy class `app`
const npe = () => new TypeError('Object reference not set to an instance of an object.');

// public
router.post('/api/getAppVersion', asyncHandler(async (req, res) => {
  const res_ = [];
  const row = await queryOne('affiliate', 'select * from tbl_AppLatestVersion order by CreateDate desc limit 1');
  const data = mapRow(row, APP_PROPS);
  if (data && data.createdate instanceof Date) data.createdate = data.createdate.toISOString().replace(/\.\d{3}Z$/, '');
  res_.push({ status: 'true', message: 'Success', versiondata: data });
  res.json(res_);
}));

// public
router.post('/api/SavefcmToken', asyncHandler(async (req, res) => {
  const plid = req.p.plid === undefined ? null : req.p.plid;
  const token = req.p.token === undefined ? null : req.p.token;
  const out = [];
  try {
    // legacy concatenated plid/token into SQL; now bound parameters
    const r1 = await queryOne('affiliate', 'select PN_Token from tbl_pushNotification where PN_Token = @token and PLID = @plid limit 1', { token, plid });
    const d = r1 ? r1.pn_token : null;
    if (d === null || d === undefined || d === '') {
      const r2 = await queryOne('affiliate', 'select PN_Token from tbl_pushNotification where PLID = @plid limit 1', { plid });
      const userexist = r2 ? r2.pn_token : null;
      if (userexist !== null && userexist !== undefined) {
        const i = await exec('affiliate', 'update tbl_pushNotification set PN_Token = @token, updatedOn = now() where PLID = @plid', { token, plid });
        if (i >= 1) out.push({ status: 'true', message: 'Token Updated !!' });
        else out.push({ status: 'true', message: 'token not Updated !!' });
      } else {
        const i = await exec('affiliate', "insert into tbl_pushNotification(PLID, PN_Token, CreatedOn, isActive) values(@plid, @token, now(), '1')", { plid, token });
        if (i >= 1) out.push({ status: 'true', message: 'Saved token' });
        else out.push({ status: 'false', message: 'token not Saved' });
      }
    } else {
      out.push({ status: 'true', message: 'token already Saved ' });
    }
  } catch (ex) {
    out.length = 0;
    out.push({ status: 'False', message: 'Something went wrong', error: ex.message });
  }
  res.json(out);
}));

// public
router.get('/api/updateVersion', asyncHandler(async (req, res) => {
  const version = req.p.version;
  if (version === undefined || version === null) throw npe(); // legacy: version.Split on null => NullReferenceException (500)
  const v = String(version).split('-');
  if (v.length > 1) {
    if (v[1] === 'choco') {
      // legacy: $"... currentVersion={v[0]}" raw-concatenated; now bound as a parameter (no WHERE clause, as legacy)
      const i = await exec('affiliate', 'update tbl_AppLatestVersion set currentVersion = @currentVersion', { currentVersion: v[0] });
      if (i >= 1) return res.json({ status: true, Message: 'Updated Success!' });
      return res.json({ status: false, Message: 'Something Went wrong' });
    }
    return res.json({ status: false, Message: 'version will not update' });
  }
  return res.json({ status: false, Message: 'invalid Version' });
}));

module.exports = router;
