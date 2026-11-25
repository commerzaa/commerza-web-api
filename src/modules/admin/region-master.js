'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Region_MasterController.cs (class Region_MasterController => /admin/Region_Master/...)
// Database: affiliate (Db_Affiliate). Table: tbl_branch_master (EF DbSet _Branch_Master).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const State = require('../../lib/admin/State');
const CITY = require('../../lib/admin/City');
const District = require('../../lib/admin/District');
const { adminAuth } = require('./_shared/admin-session');
const { DB, nStr } = require('./_shared/batch12-common');

const router = express.Router();
const C = 'Region_Master';

/** public void Getviewcollectio() (public method of the controller => also an MVC action, see route below) */
function Getviewcollectio(ViewBag) {
  ViewBag.BRID = '';
  ViewBag.BrName = '';
  ViewBag.BrAddress = '';
  ViewBag.Pincode = '';
  ViewBag.CommPer = '';
  ViewBag.CTID = '';
  ViewBag.Cid = '';
  ViewBag.SID = '';
  ViewBag.brtypeid = '';
}

// ---------------------------------------------------------------- ActionResult Index(string BrId)
// auth (Session["Admin_User"] == null => RedirectToAction("Index","adminlogin"))
// route-config: "AdminPanel/Region-Master/{BrId}" -> Region_Master/Index (BrId optional)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Region-Master{/:BrId}'], adminAuth, asyncHandler(async (req, res) => {
  const ViewBag = {};
  Getviewcollectio(ViewBag);
  /** class branches */
  const obj = { LiState: null, LiBranch_Master: null, LiDistrict: null, LiCity: null, storess: null };
  let BrId = req.params && req.params.BrId !== undefined ? nStr(req.params.BrId) : nStr(req.p.BrId);
  if (BrId === null) BrId = '';
  if (BrId !== '') {
    obj.LiState = await new State().State_List_On_CID(96);
    obj.LiCity = await new CITY().City_List_On_CID(96);
    obj.LiDistrict = await new District().District_List();
    obj.LiCity.push({ Ctid: 0, Cid: 0, Sid: 0, CityName: 'Other City', Active: false });
    obj.LiDistrict.push({ DistId: 0, Sid: 0, Distname: 'Other District', DistActive: false });
    // db._Branch_Master.Where(a => a.BrName == BrId && a.Active == true).FirstOrDefault()
    const row = await db.queryOne(DB, 'select brid, parentbrtid from tbl_branch_master where brname = @BrId and active = true limit 1', { BrId });
    if (row) {
      ViewBag.ParentBrtid = row.parentbrtid;
      ViewBag.BRID = row.brid;
    }
  }
  return res.json({ view: '~/Views/AdminPanel/Region_Master/Index.cshtml', Model: obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void Getviewcollectio()
// public (legacy: public void method => routable, no session check; it only sets ViewBag values of its own request and returns an empty response)
router.all(`/admin/${C}/Getviewcollectio{/:id}`, (req, res) => {
  Getviewcollectio({});
  res.send('');
});

module.exports = router;
