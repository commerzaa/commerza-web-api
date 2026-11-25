'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\UploadOrderDetails.cs (class UploadOrderDetailsController => /admin/UploadOrderDetails/...)
// Database: affiliate (Db_Affiliate). Procs USP_UPDATEORDERSTATUS, usp_update_bankwithdrawalStatus_byExecll, USP_CHANGE_PAYMENT_STATUS.
// TempData => sessionStore key 'TempData' (tdSet/tdPeek/tdGet, see _shared/batch04-a-common.js); Session["OrderStatus"] => sessionStore 'OrderStatus'.
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const Utility = require('../../lib/admin/Utility');
const { adminAuth } = require('./_shared/admin-session');
const { DB, mapPath, cvtInt, cvtDec, outStr } = require('./_shared/batch11-common');
const { tdSet, tdGet } = require('./_shared/batch04-a-common');
const { hostAddress, cStr, cell, ticks } = require('./_shared/batch13-10-common');

const router = express.Router();
const C = 'UploadOrderDetails';
const upload = multer({ storage: multer.memoryStorage() });

// PORT-NOTE: `private static string url, url1` - declared but never used in this controller.

const NRE = () => new Error('Object reference not set to an instance of an object.');
/** Request.Files[name] (first file posted under that field name, null when absent) */
const fileByName = (req, name) => (req.files || []).find((f) => f.fieldname === name) || null;
/** Path.GetFileNameWithoutExtension */
const nameNoExt = (n) => path.basename(n, path.extname(n));

/**
 * Common upload prologue of Upload / Upload_Payment: saves Request.Files["FileUpload"] under ~/Content/Uploads and parses it.
 * Returns { valid: false } for an invalid extension, { skipped: true } when ContentLength == 0, else { dt }.
 */
async function saveAndParse(req) {
  const f = fileByName(req, 'FileUpload');
  if (!f) throw NRE(); // Request.Files["FileUpload"].ContentLength
  if (!(f.size > 0)) return { skipped: true };
  const randomNumber = ticks();
  const FileExtension = path.extname(f.originalname).toLowerCase();
  let ConnString = '';
  const validFileTypes = ['.xls', '.xlsx', '.csv'];
  const dir = mapPath('~/Content/Uploads');
  const PathForFile = `${dir}/${nameNoExt(f.originalname)}_${randomNumber}${FileExtension}`;
  tdSet(req, 'Excelut', PathForFile);
  fs.mkdirSync(dir, { recursive: true }); // if (!Directory.Exists(PathForFile)) => always true
  if (!validFileTypes.includes(FileExtension)) return { valid: false };
  let DtObjForFileUpload = [];
  if (fs.existsSync(PathForFile)) fs.unlinkSync(PathForFile);
  fs.writeFileSync(PathForFile, f.buffer);
  if (FileExtension === '.csv') {
    DtObjForFileUpload = await Utility.ConvertCSVtoDataTable(PathForFile); // ViewBag.Data (lost by the redirect)
  } else if (FileExtension.trim() === '.xlsx' || FileExtension.trim() === '.xls') {
    ConnString = 'Provider=Microsoft.ACE.OLEDB.12.0;Data Source=' + PathForFile + ';Extended Properties="Excel 12.0;HDR=NO;IMEX=1"';
    DtObjForFileUpload = await Utility.ConvertXSLXtoDataTable_orders(PathForFile, ConnString);
  }
  tdSet(req, 'ExcelFileName', nameNoExt(f.originalname) + '_' + randomNumber + FileExtension);
  return { dt: DtObjForFileUpload || [] };
}

// ---------------------------------------------------------------- ActionResult Index()
// auth (legacy had no session check; admin upload page => adminAuth)
// route-config: "AdminPanel/UploadOrderDetails" -> UploadOrderDetails/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/UploadOrderDetails'], adminAuth, (req, res) => {
  // The view reads TempData (Message / UploadedExcel / ExcelFileName / Excelut): returned here and consumed like a TempData read.
  res.json({
    view: '~/Views/AdminPanel/UploadOrderDetails/Index.cshtml',
    TempData: {
      Message: tdGet(req, 'Message'), UploadedExcel: tdGet(req, 'UploadedExcel'), ExcelFileName: tdGet(req, 'ExcelFileName'), Excelut: tdGet(req, 'Excelut'),
    },
  });
});

// ---------------------------------------------------------------- [HttpPost] ActionResult Upload(HttpPostedFileBase FileUpload, string GROUPNO)
// auth (reads Session["Admin_User"])
router.post(`/admin/${C}/Upload{/:id}`, adminAuth, upload.any(), asyncHandler(async (req, res) => {
  let str = ''; // eslint-disable-line no-unused-vars
  try {
    const r = await saveAndParse(req);
    if (r.valid === false) {
      tdSet(req, 'Message', 'Please Upload Files in .xls, .xlsx or .csv format');
    } else if (!r.skipped) {
      const DtObjForFileUpload = r.dt;
      let Status = ''; let OrderNo = ''; let ProductCode = ''; let shipby = ''; let TrackNo = ''; let OrderDate = ''; let Name = ''; let Amount = '';
      const Empid = req.user.emp_id; // eslint-disable-line no-unused-vars
      const IpAddress = hostAddress(1); // eslint-disable-line no-unused-vars
      const LOGINID = req.user.emp_id;
      for (let i = 1; i < DtObjForFileUpload.length; i++) {
        const row = DtObjForFileUpload[i];
        Status = ''; OrderNo = ''; ProductCode = ''; shipby = ''; TrackNo = '';
        // (OrderDate / Name / Amount are NOT reset per row in legacy)
        if (cStr(cell(row, 'F2')) !== '') OrderNo = cStr(cell(row, 'F2'));
        if (cStr(cell(row, 'F3')) !== '') OrderDate = cStr(cell(row, 'F3'));
        if (cStr(cell(row, 'F4')) !== '') Name = cStr(cell(row, 'F4'));
        if (cStr(cell(row, 'F5')) !== '') Amount = cStr(cell(row, 'F5'));
        if (cStr(cell(row, 'F9')) !== '') ProductCode = cStr(cell(row, 'F9'));
        if (cStr(cell(row, 'F10')) !== '') TrackNo = cStr(cell(row, 'F10'));
        if (cStr(cell(row, 'F11')) !== '') shipby = cStr(cell(row, 'F11'));
        if (cStr(cell(row, 'F12')) !== '') Status = cStr(cell(row, 'F12'));
        // DBO.USP_UPDATEORDERSTATUS @ORDERNO,@ORDERDATE,@CUSTOMERNAME,@TOTALAMOUNT,@PRODUCTCODE,@TRACKNO,@SHIPBY,@STATUS,@strResult out,@LOGINID
        // (one call per row, no transaction: TransactionalBehavior.DoNotEnsureTransaction)
        const TOTALAMOUNT = cvtDec(Amount); // Convert.ToDecimal(Amount) ("" => FormatException)
        const o = await db.procOne(DB, 'USP_UPDATEORDERSTATUS', {
          ORDERNO: OrderNo, ORDERDATE: OrderDate, CUSTOMERNAME: Name, TOTALAMOUNT, PRODUCTCODE: ProductCode, TRACKNO: TrackNo, SHIPBY: shipby,
          STATUS: Status, LOGINID,
        });
        str = outStr(o, 'strresult');
      }
      tdSet(req, 'UploadedExcel', DtObjForFileUpload);
      return res.json({ redirect: '/UploadOrderDetails/Index' }); // RedirectToAction("Index","UploadOrderDetails")
    }
  } catch (Ex) {
    tdSet(req, 'Message', 'Some error occured while performing the operation(s).' + Ex.message);
  }
  return res.json({ redirect: '/UploadOrderDetails/Index', TempData: { Message: tdPeekMsg(req) } });
}));

/** TempData["Message"] value travelling with the redirect (still kept for the next Index read) */
function tdPeekMsg(req) {
  const o = sessionStore.get(req, 'TempData') || {};
  return o.Message === undefined ? null : o.Message;
}

// ---------------------------------------------------------------- JsonResult cancel(string GROUPNO)
// auth (reads Session["Admin_User"])
router.all(`/admin/${C}/cancel{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const GROUPNO = req.p.GROUPNO === undefined || req.p.GROUPNO === '' ? null : String(req.p.GROUPNO);
  let str = '';
  try {
    const IpAddress = hostAddress(1); // Dns.GetHostEntry(Dns.GetHostName()).AddressList[1] when Length > 1
    const Empid = req.user.emp_id;
    // DBO.usp_update_bankwithdrawalStatus_byExecll @groupnumber,@accountNo,@status,@ProcessBy,@ProcessIPAddress,@strResult out,@Mode
    const o = await db.procOne(DB, 'usp_update_bankwithdrawalStatus_byExecll', {
      groupnumber: GROUPNO, accountNo: '', status: '', ProcessBy: Empid, ProcessIPAddress: IpAddress, Mode: 'cancel',
    });
    str = outStr(o, 'strresult');
    if (str === '1') str = 'success';
  } catch (ex) {
    return res.json('error');
  }
  return res.json(str);
}));

// ---------------------------------------------------------------- [HttpPost] ActionResult Upload_Payment(HttpPostedFileBase FileUpload, string Paytype)
// auth (reads Session["Admin_User"] before the try)
router.post(`/admin/${C}/Upload_Payment{/:id}`, adminAuth, upload.any(), asyncHandler(async (req, res) => {
  const Paytype = req.p.Paytype === undefined || req.p.Paytype === '' ? null : String(req.p.Paytype);
  let str = ''; // eslint-disable-line no-unused-vars
  const LOGINID = req.user.emp_id;
  try {
    const r = await saveAndParse(req);
    if (r.valid === false) {
      tdSet(req, 'Message', 'Please Upload Files in .xls, .xlsx or .csv format');
    } else if (!r.skipped) {
      const DtObjForFileUpload = r.dt;
      let status = ''; let OrderNo = ''; let PrevStatus = ''; let Confirmation_date = ''; let Remark = '';
      const Empid = req.user.emp_id; // eslint-disable-line no-unused-vars
      const IpAddress = hostAddress(1); // eslint-disable-line no-unused-vars
      for (let i = 1; i < DtObjForFileUpload.length; i++) {
        const row = DtObjForFileUpload[i];
        status = ''; OrderNo = ''; PrevStatus = ''; Confirmation_date = ''; Remark = '';
        if (cStr(cell(row, 'F10')) !== '') status = cStr(cell(row, 'F10'));
        if (cStr(cell(row, 'F2')) !== '') OrderNo = cStr(cell(row, 'F2'));
        if (cStr(cell(row, 'F9')) !== '') PrevStatus = cStr(cell(row, 'F9'));
        if (Paytype === '2') {
          if (cStr(cell(row, 'F11')) !== '') Confirmation_date = cStr(cell(row, 'F11'));
          if (cStr(cell(row, 'F12')) !== '') Remark = cStr(cell(row, 'F12'));
        }
        // DBO.USP_CHANGE_PAYMENT_STATUS @LOGINID,@ORDERNO,@STATUS,@PREVSTATUS,@STRRESULT out,@Confirmation_date,@Remark,@Type
        const Type = cvtInt(Paytype); // Convert.ToInt32(Paytype) (null => 0)
        const o = await db.procOne(DB, 'USP_CHANGE_PAYMENT_STATUS', {
          LOGINID, ORDERNO: OrderNo, STATUS: status, PREVSTATUS: PrevStatus, Confirmation_date, Remark, Type,
        });
        str = outStr(o, 'strresult');
      }
      tdSet(req, 'UploadedExcel', DtObjForFileUpload);
      sessionStore.set(req, 'OrderStatus', Paytype); // Session["OrderStatus"] = Paytype
      return res.json({ redirect: '/OrderPaymentConformation/Index' }); // RedirectToAction("Index","OrderPaymentConformation")
    }
  } catch (Ex) {
    tdSet(req, 'Message', 'Some error occured while performing the operation(s).' + Ex.message);
  }
  return res.json({ redirect: '/OrderPaymentConformation/Index', TempData: { Message: tdPeekMsg(req) } });
}));

module.exports = router;
