'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/AllEmailsList.cs (AllEmailsListController, 8 actions). Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow, mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const DAL_AllemailList = require('../../lib/portal/DAL_AllemailList');
const ps = require('./_shared/portal-session');
const { DB, mvcStr, mvcIntN, mvcInt, mvcBool, nullRef, outOf, toInt32 } = require('./_shared/batch-03-common');

const router = express.Router();
const C = 'AllEmailsList';
const EXPIRED = 'error^This page has been expired, Please login again';

/** class ALLEMAILLIST */
const ALLEMAILLIST_PROPS = ['RowNumber', 'TMCEMID', 'ShortEmail', 'FullEmail', 'Status', 'GROUPNAME', 'CREATEDATE', 'REMARK', 'ISACTIVE', 'EMAIL', 'NoofEmails'];

// ---------------------------------------------------------------- Index(string fromdate, string todate, string GroupName, int? page)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: merchant/all-emailsList -> AllEmailsList/Index
// route-config: "merchant/all-emailslist/{TMCEMID}" points at action UPDATE, which is commented out in legacy (404) - not registered
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`, '/portal/merchant/all-emailsList'], ps.customerAuth, asyncHandler(async (req, res) => {
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
  // DBO.ALLMAILLIST @PLID,@FromDate,@ToDate,@GroupName,@IntResult out,@STARTROWINDEX,@MAXROWS
  const rows = await db.proc(DB, 'allmaillist', {
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
    'select distinct groupname from tbl_member_customer_email where plid = @plid', { plid: String(toInt32(req.user.plid)) }), ['GroupName']);
  ViewBag.GroupName = ObjGroupName;
  ViewBag.IsPopUpCheck = 1;
  return res.json({ view: '~/Views/CustomerPanel/AllEmailsList/Index.cshtml', Model: mapRows(rows, ALLEMAILLIST_PROPS), ...ViewBag });
}));

// ---------------------------------------------------------------- ADDNEWEMAIL()
// public (legacy had no session check; returns the empty Add form)
router.all(`/portal/${C}/ADDNEWEMAIL{/:id}`, ps.portalSession, (req, res) => {
  res.json({ view: '~/Views/CustomerPanel/AllEmailsList/Add_Email.cshtml' });
});

// ---------------------------------------------------------------- JsonResult SAVE(string EMAIL, bool CHECK, string GroupName)
// auth (Session["Plid"] == null => Json(EXPIRED))
router.all(`/portal/${C}/SAVE{/:id}`, ...ps.customerOr(EXPIRED), asyncHandler(async (req, res) => {
  const CHECK = mvcBool(req, 'CHECK');
  let RESPONSE = '';
  const emailList = new DAL_AllemailList();
  const Plid = Number(req.user.plid);
  if (Plid > 0) {
    RESPONSE = await emailList.Create(mvcStr(req, 'EMAIL'), CHECK, Plid, mvcStr(req, 'GroupName'));
    if (RESPONSE === 'Success') {
      return res.json(RESPONSE);
    }
  }
  return res.json(RESPONSE);
}));

// ---------------------------------------------------------------- Edit(int TMCEMID, string EMAIL)
// auth (Session["Plid"] == null => Json(EXPIRED))
router.all(`/portal/${C}/Edit{/:id}`, ...ps.customerOr(EXPIRED), asyncHandler(async (req, res) => {
  const TMCEMID = mvcInt(req, 'TMCEMID');
  const EMAIL = mvcStr(req, 'EMAIL');
  const row = await db.queryOne(DB, 'select * from tbl_member_customer_email where tmcemid = @TMCEMID limit 1', { TMCEMID });
  return res.json({
    view: '~/Views/CustomerPanel/AllEmailsList/Add_Email.cshtml', TMCEMID, Email: EMAIL, Rowvalue: mapRow(row, ALLEMAILLIST_PROPS),
  });
}));

// ---------------------------------------------------------------- JsonResult MODIFY(int TMCEMID, string EMAIL, bool CHECK, string OldEmail)
// auth (Session["Plid"] == null => Json(EXPIRED))
router.all(`/portal/${C}/MODIFY{/:id}`, ...ps.customerOr(EXPIRED), asyncHandler(async (req, res) => {
  const TMCEMID = mvcInt(req, 'TMCEMID');
  const CHECK = mvcBool(req, 'CHECK');
  let RESPONSE = '';
  const emailList = new DAL_AllemailList();
  const Plid = Number(req.user.plid);
  if (Plid > 0) {
    RESPONSE = await emailList.Modify(TMCEMID, mvcStr(req, 'EMAIL'), CHECK, Plid, mvcStr(req, 'OldEmail'));
    if (RESPONSE === 'Success') {
      return res.json(RESPONSE);
    }
  }
  return res.json(RESPONSE);
}));

// ---------------------------------------------------------------- JsonResult Reject(int TMCEMID, string EMAIL)
// auth (legacy cast (Login)Session["Plid"] without a null check; the exception was rethrown => 500)
router.all(`/portal/${C}/Reject{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const TMCEMID = mvcInt(req, 'TMCEMID');
  const EMAIL = mvcStr(req, 'EMAIL');
  let RESPONSE = '';
  // try { ... } catch (Exception Exp) { ViewBag.Message = Exp.Message; throw Exp; }  => errors propagate (500)
  const emailList = new DAL_AllemailList();
  const Plid = Number(req.user.plid);
  if (Plid > 0) {
    RESPONSE = await emailList.Reject(TMCEMID, EMAIL, Plid);
    if (RESPONSE === 'Success') {
      return res.json(RESPONSE);
    }
  }
  return res.json(RESPONSE);
}));

// ---------------------------------------------------------------- JsonResult Delete(int TMCEMID, string EMAIL)
// auth (PORT-NOTE: legacy had no session check; it edits the customer's e-mail lists, so a customer token is required)
router.all(`/portal/${C}/Delete{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const TMCEMID = mvcInt(req, 'TMCEMID');
  const EMAIL = mvcStr(req, 'EMAIL');
  let RESPONSE = '';
  try {
    let UpdateEmail = '';
    const Obj = mapRow(await db.queryOne(DB,
      'select email as fullemail from tbl_member_customer_email where tmcemid = @TMCEMID limit 1', { TMCEMID }), ALLEMAILLIST_PROPS);
    if (Obj === null || Obj.FullEmail === null) nullRef();
    const Email = String(Obj.FullEmail);
    const Arr = Email.split(',');
    if (Arr.length > 1) {
      for (let i = 0; i < Arr.length; i++) {
        if (Arr[i] !== EMAIL) {
          UpdateEmail += Arr[i] + ',';
        }
      }
      UpdateEmail = UpdateEmail.replace(/,+$/, '');
      await db.exec(DB, 'update tbl_member_customer_email set email = @UpdateEmail where tmcemid = @TMCEMID', { UpdateEmail, TMCEMID });
    } else {
      await db.exec(DB, 'update tbl_member_customer_email set isactive = false, isdeleted = true where tmcemid = @TMCEMID', { TMCEMID });
    }
    RESPONSE = 'Successfully Deleted!';
  } catch (Exp) {
    // ViewBag.Message = Exp.Message;
    RESPONSE = 'Some Error Occured!';
    return res.json(RESPONSE);
  }
  return res.json(RESPONSE);
}));

// ---------------------------------------------------------------- JsonResult DeleteOneCompleteRow(int TMCEMID)
// auth (PORT-NOTE: legacy had no session check; it deletes a customer's e-mail group, so a customer token is required)
router.all(`/portal/${C}/DeleteOneCompleteRow{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const TMCEMID = mvcInt(req, 'TMCEMID');
  let result = '';
  try {
    const Res = await db.exec(DB, 'update tbl_member_customer_email set isactive = false, isdeleted = true where tmcemid = @TMCEMID', { TMCEMID });
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
