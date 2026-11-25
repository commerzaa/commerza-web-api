'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Media_Admin.cs (class Media_AdminController => /Media_Admin/...)
// Database: affiliate (Db_Affiliate). Table: tbl_media (lib Media).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const Media = require('../../lib/admin/Media');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nStr, reqInt, col, nullRef } = require('./_shared/batch09-common');

const router = express.Router();
const C = 'Media_Admin';

// ---------------------------------------------------------------- Index()
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Media-Admin" -> Media_Admin/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Media-Admin'], adminAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  const h = await db.queryOne(DB, 'select heading from tbl_media where status = 1 limit 1', {});
  ViewBag.heading = h ? col(h, 'heading') : null;
  const M = new Media();
  return res.json({ view: '~/Views/AdminPanel/Media_Admin/Index.cshtml', Model: await M.MediaDetails(), ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult DeleteMedia(int Id)
// auth (PORT-NOTE: legacy had no session check on this admin write - protected)
router.all(`/admin/${C}/DeleteMedia{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Id = reqInt(req.p.Id, 'Id');
  const row = await db.queryOne(DB, 'select id from tbl_media where id = @Id limit 1', { Id });
  if (!row) throw nullRef();
  await db.exec(DB, 'update tbl_media set status = 0 where id = @Id', { Id });
  return res.json('Delete');
}));

// ---------------------------------------------------------------- JsonResult SubmitMedia(string Heading, string Title, string description, string Url, int Mode, int id)
// auth (PORT-NOTE: legacy had no session check on this admin write - protected)
router.all(`/admin/${C}/SubmitMedia{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Mode = reqInt(req.p.Mode, 'Mode');
  const id = reqInt(req.p.id, 'id');
  const v = { Heading: nStr(req.p.Heading), Title: nStr(req.p.Title), description: nStr(req.p.description), Url: nStr(req.p.Url) };
  let ret = '';
  await db.tx(DB, async (t) => { // db.SaveChanges() (one unit of work)
    if (Mode === 1) {
      await t.exec(`insert into tbl_media (heading, title, description, url, status, date)
        values (@Heading, @Title, @description, @Url, 1, now())`, v); // obj.date = DateTime.Now
      ret = 'Insert';
    }
    if (Mode === 2) {
      const row = await t.queryOne('select id from tbl_media where id = @id limit 1', { id });
      if (!row) throw nullRef();
      await t.exec('update tbl_media set heading = @Heading, title = @Title, description = @description, url = @Url, status = 1 where id = @id', { ...v, id });
      ret = 'Update';
    }
  });
  return res.json(ret);
}));

// ---------------------------------------------------------------- JsonResult mediadetails(int Id)
// auth (PORT-NOTE: legacy had no session check - protected)
router.all(`/admin/${C}/mediadetails{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Id = reqInt(req.p.Id, 'Id');
  const row = await db.queryOne(DB, 'select * from tbl_media where status = 1 and id = @Id limit 1', { Id });
  return res.json(row ? Media.map(row) : null);
}));

module.exports = router;
