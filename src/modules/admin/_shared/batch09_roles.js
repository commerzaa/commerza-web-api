'use strict';
/**
 * batch09 private helper: List_Admin_Role / List_Franchise_Role / List_Member_Role share the same action set
 * (Index(btnexel), public void ExportReport(), JsonResult UpdateStatus(strrid)); every per-controller difference is a parameter.
 * Exports: buildRoleList(cfg) => express.Router
 */
const express = require('express');
const db = require('../../../db');
const { optionalAuth } = require('../../../middleware/auth');
const asyncHandler = require('../../../middleware/asyncHandler');
const UtilityClass = require('../../../lib/admin/UtilityClass');
const { adminAuth, isAdmin, errorInsert, legacyUrl } = require('./adminSession');
const {
  DB, nStr, excelLink, inlinePerms, excelHistory, nowStamp, writeXlsExport, tab, cellStr, cvtInt, outStr,
} = require('./batch09_common');

/**
 * cfg: { C, routeConfig, lib (class), allRoleListArg(req) , view, filename(userid), sheet, downloadName, headers, cells(item,w,RowNumber),
 *        innerProc, outerProc, excelLinkFirst (bool), urlBeforeSessionCheck (bool), proc, procParams(Empid, rid), errProc }
 */
function buildRoleList(cfg) {
  const router = express.Router();
  const { C } = cfg;
  // PORT-NOTE: `private static string url, url1` - static fields shared by all requests (set by Index, read by ExportReport).
  let url = '';
  let url1 = '';

  async function ExportReport(req, res, ViewBag) {
    const userid = req.user.emp_id;
    const Filename = cfg.filename(userid, nowStamp());
    await excelHistory(userid, url, Filename);
    const rm = new cfg.lib();
    const list = await rm.AllRoleList(cfg.libArg ? req : undefined);
    if (list.length > 0) {
      let RowNumber = 1;
      return writeXlsExport({
        req, res, ViewBag, sheet: cfg.sheet, downloadName: cfg.downloadName, Filename, headers: cfg.headers, rows: list,
        innerProc: cfg.innerProc, outerProc: cfg.outerProc,
        cells: (item, w) => {
          w('\n');
          cfg.cells(item, w, RowNumber);
          RowNumber += 1;
        },
      });
    }
    return { sent: false };
  }

  // ---------------------------------------------------------------- Index(string btnexel)
  // auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
  // route-config: see cfg.routeConfig
  router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, cfg.routeConfig], (req, res, next) => {
    if (cfg.urlBeforeSessionCheck) { url1 = legacyUrl(req).slice(1); url = '~' + url1; } // (set even without a session, like legacy)
    next();
  }, adminAuth, asyncHandler(async (req, res) => {
    let btnexel = nStr(req.p.btnexel);
    if (!cfg.urlBeforeSessionCheck) { url1 = legacyUrl(req).slice(1); url = '~' + url1; }
    const ViewBag = {};
    const Employeeid = req.user.emp_id;
    if (cfg.excelLinkFirst) ViewBag.excelactive = await excelLink(url);
    if (btnexel === null) btnexel = '';
    const p = await inlinePerms(Employeeid, url);
    ViewBag.isactive = p.isactive;
    ViewBag.isedit = p.isedit;
    if (!cfg.excelLinkFirst) ViewBag.excelactive = await excelLink(url);
    const rm = new cfg.lib();
    if (btnexel === 'Export Excel') {
      const r = await ExportReport(req, res, ViewBag);
      if (r.sent) return undefined;
    }
    return res.json({ view: cfg.view, Model: await rm.AllRoleList(cfg.libArg ? req : undefined), ...ViewBag });
  }));

  // ---------------------------------------------------------------- public void ExportReport()
  // auth (public method => routable in legacy; reads Session["Admin_User"])
  router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
    const r = await ExportReport(req, res, {});
    if (!r.sent) res.send('');
  }));

  // ---------------------------------------------------------------- JsonResult UpdateStatus(string strrid)
  // auth-by-check (legacy returned Json("Session Expired. Please login again") - contract kept)
  router.all(`/admin/${C}/UpdateStatus{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
    if (!isAdmin(req)) return res.json('Session Expired. Please login again');
    try {
      const rid = cvtInt(await UtilityClass.Decryptword(nStr(req.p.strrid)));
      const empcode = req.user.emp_code; // (unused by legacy)
      void empcode;
      const Empid = req.user.emp_id;
      const row = await db.procOne(DB, cfg.proc, cfg.procParams(Empid, rid));
      return res.json(outStr(row, 'strresult'));
    } catch (ExpObj) {
      await errorInsert(req, ExpObj, cfg.errProc);
      return res.json('Error occurred. Please try later');
    }
  }));

  return router;
}

module.exports = { buildRoleList };
