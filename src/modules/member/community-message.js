'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/CommunityMessage.cs (CommunityMessageController)
 * Prefix: /member   DB: affiliate (DataBaseContext => Db_Affiliate)
 */
const express = require('express');
const { proc, queryOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth, optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';

const PROPS = ['ADID', 'ROWNUMBER', 'From', 'To', 'Date', 'Subject', 'Message', 'USERNAME', 'REGNO', 'CMID'];
const toInt = (v, d) => { const n = parseInt(v, 10); return Number.isNaN(n) ? d : n; };
const outOf = (rows, name) => {
  const f = rows && rows[0];
  if (!f) return '';
  const k = Object.keys(f).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined || f[k] === null || f[k] === undefined ? '' : String(f[k]);
};

// ---- Index ---------------------------------------------------------------------------------------------
// route-config: referral/Community-Message and referral/View-Message  (CommunityMessage / Index)
// public-ish: the legacy action had no session check when `From` is supplied; without `From` it needs the logged-in member (Session["plid"]).
router.all(['/member/CommunityMessage/Index{/:id}', '/member/referral/Community-Message', '/member/referral/View-Message'], optionalAuth, asyncHandler(async (req, res) => {
  let CMID = req.p.CMID;
  const From = req.p.From;
  const mode = 1;
  let Plid = 0;
  let cmid = 0;
  if (CMID !== undefined && CMID !== null) {
    cmid = parseInt(await UtilityClass.Decryptword(CMID), 10);
    if (Number.isNaN(cmid)) throw new Error('Input string was not in a correct format.');
  } else {
    CMID = '0';
  }
  const custPage = toInt(req.p.custPage, 100);
  const page = toInt(req.p.page, 1);
  if (From !== undefined && From !== null) {
    const id = await UtilityClass.Decryptword(From);
    const frmid = await queryOne(DB, 'SELECT PLID FROM Portal_Login WHERE USERNAME = @id LIMIT 1', { id: String(id).trim() });
    if (!frmid) throw new Error('Object reference not set to an instance of an object.');
    Plid = frmid.plid;
  } else {
    if (!req.user) throw new Error('Object reference not set to an instance of an object.'); // Session["plid"] was null
    Plid = Number(req.user.plid);
  }
  // PORT-NOTE: @STRINRESULT OUT is read from the first result row (column strinresult).
  const rows = await proc(DB, 'usp_communitymessage', {
    startrowindex: page, maxrows: custPage, mode, from: Plid, to: '0', cmid, subject: '', message: '',
  });
  const _ObjFlyerManagement = mapRows(rows, PROPS);
  const strResult = outOf(rows, 'strinresult');
  const TotalRecord = parseInt(strResult === '' ? '0' : strResult, 10);
  if (Number.isNaN(TotalRecord)) throw new Error('Input string was not in a correct format.');
  const ViewBag = {
    CurrentPage: page, GridPageSize: custPage, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), message: strResult,
  };
  if (CMID === '0') {
    return res.json({ view: '~/Views/CustomerPanel/CommunityMessage/Index.cshtml', Model: _ObjFlyerManagement, ViewBag });
  }
  return res.json({ view: '~/Views/CustomerPanel/ViewMessage/ViewMessage.cshtml', Model: _ObjFlyerManagement, ViewBag });
}));

// ---- CreateNewMsg --------------------------------------------------------------------------------------
// route-config: referral/CreateNew-Message  (CommunityMessage / CreateNewMsg)
// public (legacy action has no session check and no logic)
router.all(['/member/CommunityMessage/CreateNewMsg{/:id}', '/member/referral/CreateNew-Message'], (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/CreateNewMsg/Index.cshtml' });
});

// ---- InsetMSg ------------------------------------------------------------------------------------------
// auth
router.all('/member/CommunityMessage/InsetMSg{/:id}', auth, asyncHandler(async (req, res) => {
  const To = req.p.To;
  const Subject = req.p.Subject;
  const Message = req.p.Message;
  const ToUserDetails = await queryOne(DB, 'SELECT PLID FROM Portal_Login WHERE USERNAME = @To LIMIT 1', { To: String(To === undefined || To === null ? '' : To).trim() });
  const Plid = Number(req.user.plid);
  if (!ToUserDetails) throw new Error('Object reference not set to an instance of an object.'); // ToUserDetails.PLID on null
  const rows = await proc(DB, 'usp_communitymessage', {
    startrowindex: '0', maxrows: '0', mode: '2', from: Plid, to: ToUserDetails.plid, subject: Subject, message: Message, cmid: '0',
  });
  const result = outOf(rows, 'strinresult');
  return res.json(result);
}));

module.exports = router;
