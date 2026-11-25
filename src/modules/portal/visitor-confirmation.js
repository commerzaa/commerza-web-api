'use strict';
// Ported from ClusterofferShopingPortal\Controllers\VisitorConfirmation.cs (class VisitorConfirmationController => /portal/VisitorConfirmation/...)
// Database: shopping (Db_Shopping), via RegistrationConfirmation.Verification.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const RegistrationConfirmation = require('../../lib/portal/RegistrationConfirmation');
const { fullUrl, mapPath, NRE } = require('./_shared/batch-14-common');

const router = express.Router();
const C = 'VisitorConfirmation';

// ---------------------------------------------------------------- ActionResult Index(string emailid, string vmid)
// public (e-mail verification link, no session check)
// route-config: "Regisrtration-Confirmation/{action}" -> VisitorConfirmation/Index
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`, '/portal/Regisrtration-Confirmation', '/portal/Regisrtration-Confirmation/Index'],
  asyncHandler(async (req, res) => {
    const emailid = req.p.emailid;
    const vmid = req.p.vmid;
    const ViewBag = {};
    ViewBag.Canonical = fullUrl(req);
    ViewBag.Title = '';
    ViewBag.MetaDesc = '';
    ViewBag.MetaKeyword = '';
    if (emailid !== undefined && emailid !== null && emailid !== '' && vmid !== undefined && vmid !== null && vmid !== '') {
      // Request.QueryString["vmid"].ToString(): values that came only from the form/route threw NullReferenceException
      if (req.query.vmid === undefined || req.query.emailid === undefined) throw NRE();
      // PORT-NOTE: Server.MapPath("visitor_confirm.html") (relative to the request folder) => config.uploadDir/visitor_confirm.html
      ViewBag.Message = await RegistrationConfirmation.Verification(String(req.query.vmid), String(req.query.emailid), mapPath('visitor_confirm.html'));
    } else {
      ViewBag.Message = "Please Don't Play With URL.!!!";
    }
    return res.json({ view: '~/Views/VisitorConfirmation/Index.cshtml', ...ViewBag });
  }));

module.exports = router;
