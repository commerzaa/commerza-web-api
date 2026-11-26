'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/AllMobileList.cs (AllMobileListController, 8 actions). Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const DAL_AllMobileList = require('../../lib/portal/DAL_AllMobileList');
const ps = require('./_shared/portal-session');
const { DB, mvcStr, mvcIntN, mvcInt, mvcBool, nullRef, outOf, toInt32 } = require('./_shared/batch-03-common');

const router = express.Router();
const C = 'AllMobileList';
const EXPIRED = 'error^This page has been expired, Please login again';

/** class ALLMOBILELIST */
const ALLMOBILELIST_PROPS = ['RowNumber', 'TMCSMID', 'ShortMobile', 'Mobile', 'Status', 'GROUPNAME', 'CREATEDATE', 'REMARK', 'ISACTIVE', 'NoofMobiles'];

// ---------------------------------------------------------------- Index(string fromdate, string todate, string GroupName, int? page)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: merchant/all-mobilelist -> AllMobileList/Index
// route-config: "merchant/all-mobilelist/{TMCSMID}" points at action UPDATE, which is commented out in legacy (404) - not registered
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`, '/portal/merchant/all-mobilelist'], ps.customerAuth, asyncHandler(async (req, res) => {
  let fromdate = mvcStr(req, 'fromdate');
  let todate = mvcStr(req, 'todate');
  let GroupName = mvcStr(req, 'GroupName');
  let page = mvcIntN(req, 'page');
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (GroupName === null) GroupName = '';
  if (page === null) page = 1;
  const Plid = req.user.plid;
  const ViewBag = {};
  const MaxRows = 20; // UtilityClass.GridPageSize()
  // dbo.ALLMOBILELIST @PLID,@FromDate,@ToDate,@GroupName,@IntResult out,@STARTROWINDEX,@MAXROWS
  const rows = await db.proc(DB, 'allmobilelist', {
    plid: Plid, fromdate: fromdate.trim(), todate: todate.trim(), groupname: GroupName.trim(), startrowindex: page, maxrows: MaxRows,
  });
  // PORT-NOTE: @IntResult OUT is read from the first result row (0 when the function returns no row).
  const t = outOf(rows, 'intresult');
  const TotalRecord = t === undefined ? 0 : toInt32(t);
  ViewBag.CurrentPage = page;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.Status = GroupName;
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  //**For Binding the Dropdown for searching On Group Name**//
  const ObjGroupName = mapRows(await db.query(DB,
    'select distinct groupname from tbl_member_customer_mobile where plid = @plid', { plid: String(toInt32(req.user.plid)) }), ['GroupName']);
  ViewBag.GroupName = ObjGroupName;
  ViewBag.IsPopUpCheck = 1;
  return res.json({ view: '~/Views/CustomerPanel/AllMobileList/Index.cshtml', Model: mapRows(rows, ALLMOBILELIST_PROPS), ...ViewBag });
}));

// ---------------------------------------------------------------- ADDNEWMOBILE()
// public (legacy had no session check; returns the empty Add form)
router.all(`/portal/${C}/ADDNEWMOBILE{/:id}`, ps.portalSession, (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/AllMobileList/Add_Mobile.cshtml' });
});

// ---------------------------------------------------------------- JsonResult SAVE(string MOBILE, bool CHECK, string GroupName)
// auth (Session["Plid"] == null => Json(EXPIRED))
router.all(`/portal/${C}/SAVE{/:id}`, ...ps.customerOr(EXPIRED), asyncHandler(async (req, res) => {
  const CHECK = mvcBool(req, 'CHECK');
  let RESPONSE = '';
  const MOBILEList = new DAL_AllMobileList();
  const Plid = Number(req.user.plid);
  if (Plid > 0) {
    RESPONSE = await MOBILEList.Create(mvcStr(req, 'MOBILE'), CHECK, Plid, mvcStr(req, 'GroupName'));
    if (RESPONSE === 'Success') {
      return res.json(RESPONSE);
    }
  }
  return res.json(RESPONSE);
}));

// ---------------------------------------------------------------- Edit(int TMCSMID, string Mobile)
// auth (Session["Plid"] == null => Json(EXPIRED))
router.all(`/portal/${C}/Edit{/:id}`, ...ps.customerOr(EXPIRED), asyncHandler(async (req, res) => {
  const TMCSMID = mvcInt(req, 'TMCSMID');
  const Mobile = mvcStr(req, 'Mobile');
  const row = await db.queryOne(DB, 'select * from tbl_member_customer_mobile where tmcsmid = @TMCSMID limit 1', { TMCSMID });
  return res.json({
    view: '~/Views/CustomerPanel/AllMobileList/Add_Mobile.cshtml', TMCSMID, Mobile, Rowvalue: mapRow(row, ALLMOBILELIST_PROPS),
  });
}));

// ---------------------------------------------------------------- JsonResult MODIFY(int TMCSMID, string MOBILE, bool CHECK, string OldMobile)
// auth (Session["Plid"] == null => Json(EXPIRED))
router.all(`/portal/${C}/MODIFY{/:id}`, ...ps.customerOr(EXPIRED), asyncHandler(async (req, res) => {
  const TMCSMID = mvcInt(req, 'TMCSMID');
  const CHECK = mvcBool(req, 'CHECK');
  let RESPONSE = '';
  const MOBILEList = new DAL_AllMobileList();
  const Plid = Number(req.user.plid);
  if (Plid > 0) {
    RESPONSE = await MOBILEList.Modify(TMCSMID, mvcStr(req, 'MOBILE'), CHECK, Plid, mvcStr(req, 'OldMobile'));
    if (RESPONSE === 'Success') {
      return res.json(RESPONSE);
    }
  }
  return res.json(RESPONSE);
}));

// ---------------------------------------------------------------- JsonResult Reject(int TMCSMID, string MOBILE)
// auth (legacy cast (Login)Session["Plid"] without a null check; the exception was rethrown => 500)
router.all(`/portal/${C}/Reject{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const TMCSMID = mvcInt(req, 'TMCSMID');
  const MOBILE = mvcStr(req, 'MOBILE');
  let RESPONSE = '';
  // try { ... } catch (Exception Exp) { ViewBag.Message = Exp.Message; throw Exp; }  => errors propagate (500)
  const MOBILEList = new DAL_AllMobileList();
  const Plid = Number(req.user.plid);
  if (Plid > 0) {
    RESPONSE = await MOBILEList.Reject(TMCSMID, MOBILE, Plid);
    if (RESPONSE === 'Success') {
      return res.json(RESPONSE);
    }
  }
  return res.json(RESPONSE);
}));

// ---------------------------------------------------------------- JsonResult Delete(int TMCSMID, string MOBILE)
// auth (PORT-NOTE: legacy had no session check; it edits the customer's mobile lists, so a customer token is required)
router.all(`/portal/${C}/Delete{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const TMCSMID = mvcInt(req, 'TMCSMID');
  const MOBILE = mvcStr(req, 'MOBILE');
  let RESPONSE = '';
  try {
    let UpdateMobile = '';
    const Obj = mapRow(await db.queryOne(DB,
      'select mobile from tbl_member_customer_mobile where tmcsmid = @TMCSMID limit 1', { TMCSMID }), ALLMOBILELIST_PROPS);
    if (Obj === null || Obj.Mobile === null) nullRef();
    const Mobile = String(Obj.Mobile);
    const Arr = Mobile.split(',');
    if (Arr.length > 1) {
      for (let i = 0; i < Arr.length; i++) {
        if (Arr[i] !== MOBILE) {
          UpdateMobile += Arr[i] + ',';
        }
      }
      UpdateMobile = UpdateMobile.replace(/,+$/, '');
      await db.exec(DB, 'update tbl_member_customer_mobile set mobile = @UpdateMobile where tmcsmid = @TMCSMID', { UpdateMobile, TMCSMID });
    } else {
      await db.exec(DB, 'update tbl_member_customer_mobile set isactive = false, isdeleted = true where tmcsmid = @TMCSMID', { TMCSMID });
    }
    RESPONSE = 'Mobile Deleted Successfully.';
  } catch (Exp) {
    // ViewBag.Message = Exp.Message;
    RESPONSE = 'Some Error Occured!';
    return res.json(RESPONSE);
  }
  return res.json(RESPONSE);
}));

// ---------------------------------------------------------------- JsonResult DeleteOneCompleteRow(int TMCSMID)
// auth (PORT-NOTE: legacy had no session check; it deletes a customer's mobile group, so a customer token is required)
router.all(`/portal/${C}/DeleteOneCompleteRow{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const TMCSMID = mvcInt(req, 'TMCSMID');
  let result = '';
  try {
    const Res = await db.exec(DB, 'update tbl_member_customer_mobile set isactive = false, isdeleted = true where tmcsmid = @TMCSMID', { TMCSMID });
    if (Res === 1) {
      result = 'Group Data Successfully deleted.';
    } else {
      result = 'Some error occured.';
    }
  } catch (Exp) {
    // ViewBag.Message = Exp.Message;  result = Exp.ToString();
    result = String(Exp.stack || Exp);
  }
  return res.json(result);
}));

module.exports = router;
