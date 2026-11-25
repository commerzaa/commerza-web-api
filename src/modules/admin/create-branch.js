'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\create_branch.cs (class create_branchController => /admin/create_branch/...)
// Database: affiliate (Db_Affiliate).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { adminAuth } = require('./_shared/admin-session');
const B = require('./_shared/batch05-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'create_branch';

/** db._Member_Master.Where(m => m.LoginId.Equals(agentID) && m.status == true && m.Active == true).FirstOrDefault() */
const findAgent = (agentID) => db.queryOne(DB, `select regno from member_master where loginid = @agentID and status = true and active = true limit 1`, { agentID });

// ---------------------------------------------------------------- ActionResult Index(string reg)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Create-Branch" -> create_branch/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Create-Branch'], adminAuth, asyncHandler(async (req, res) => {
  void req.p.reg; // bound, unused
  return res.json({ view: '~/Views/AdminPanel/create_branch/Index.cshtml' });
}));

// ---------------------------------------------------------------- JsonResult validateAgentIDToMakeBranch(string agentID)
// auth (admin branch creation; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/validateAgentIDToMakeBranch{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const agentID = B.nStr(req.p.agentID);
  let mm = await findAgent(agentID);
  if (mm === null) return res.json('Invalid Agent ID');
  // PORT-NOTE: legacy re-ran the identical query and treated a hit as "already a branch" (so "ok" is practically unreachable) - kept.
  mm = await findAgent(agentID);
  if (mm !== null) return res.json('This ID is already a branch');
  return res.json('ok');
}));

// ---------------------------------------------------------------- JsonResult postCreateBranch(string agentID, string contactPerson, string mobile, string landline, string Email, string BrName, string BrAddress, int SID, int CTID, string Pincode)
// auth (admin branch creation; legacy had no session check - PORT-NOTE: protected with adminAuth)
router.all(`/admin/${C}/postCreateBranch{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const SID = B.reqInt(req.p.SID, 'SID');
  const CTID = B.reqInt(req.p.CTID, 'CTID');
  const s = (k) => B.nStr(req.p[k]);
  const agentID = s('agentID');
  let mm = await findAgent(agentID);
  if (mm === null) return res.json('Invalid Agent ID');
  mm = await findAgent(agentID);
  if (mm !== null) return res.json('This ID is already a branch');
  const row = await db.procOne(DB, 'usp_CreateNewBranch', {
    agentID, contactPerson: s('contactPerson'), mobile: s('mobile'), landline: s('landline'), Email: s('Email'), BrName: s('BrName'),
    BrAddress: s('BrAddress'), SID, CTID, Pincode: s('Pincode'),
  });
  const out = B.outStr(row, 'strresult'); // DBNull.ToString() => ""
  if (out.trim() !== 'ok') return res.json(out.trim());
  return res.json('ok');
}));

module.exports = router;
