'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Club_History.cs (class Club_HistoryController => /Club_History/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const Utility = require('../../lib/admin/Utility');
const { adminAuth, legacyUrl, errorInsert } = require('./_shared/adminSession');
const B = require('./_shared/batch04B_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Club_History';

/** class Club_History */
const PROPS = ['RowNumber', 'FileName', 'Date', 'ClubGroup', 'TotalRequest', 'TotalAmount', 'Total_tansaction', 'ProcessDate', 'ProcessBy',
  'ProcessStatus', 'ProcessIPAddress', 'CHID', 'BankName', 'TotalPaid', 'TotalReject', 'Transaction_no'];
// classes saerchparam_Clubhistory / searchparam_status: property bags not used by any action (not ported).

// PORT-NOTE: `private static string url, url1` kept as module variables.
let url = '';
let url1 = '';

/** Convert.ToInt16(string) (null => 0) */
const toInt16 = (v) => (v === undefined || v === null ? 0 : B.toInt32(v));

// ---------------------------------------------------------------- [SessionExpireCheck] Index(int? dynamicpagging, string orderbydate, string SearchField, string SearchValue, string fromDate, string toDate, string ByStatus, int? page, string OrderBy, string releasepayout, string btnexel, string Userdownlinemember, int? Side)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/Club-History" -> Club_History/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Club-History'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.ip(req, 'dynamicpagging');
  const orderbydate = B.sp(req, 'orderbydate');
  let SearchField = B.sp(req, 'SearchField');
  let SearchValue = B.sp(req, 'SearchValue');
  let fromDate = B.sp(req, 'fromDate');
  let toDate = B.sp(req, 'toDate');
  let ByStatus = B.sp(req, 'ByStatus');
  let page = B.ip(req, 'page');
  let OrderBy = B.sp(req, 'OrderBy');
  let Userdownlinemember = B.sp(req, 'Userdownlinemember');
  let Side = B.ip(req, 'Side');
  url1 = legacyUrl(req).slice(1);
  url = '~' + url1;
  // legacy computed loginid/phone/accountno/ifsccode/accountholdername/bankname/branchname/username from SearchField (all unused)
  if (SearchField === null || SearchValue === null) {
    SearchField = '';
    SearchValue = '';
  }
  if (Userdownlinemember === null) Userdownlinemember = '';
  if (OrderBy === null) OrderBy = '';
  if (fromDate === null) fromDate = '';
  if (toDate === null) toDate = '';
  if (ByStatus === null) ByStatus = '';
  if (page === null) page = 1;
  if (Side === null) Side = 0;
  const ViewBag = {};
  const perm = await B.pagePerm(req, url);
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = await B.excelActive(url);
  if (dynamicpagging === null) dynamicpagging = toInt16(config.app.DynamicPagging);
  const MaxRows = dynamicpagging;
  let obj1 = [];
  try {
    const rows = await db.proc(DB, 'usp_clubhistory_list', {
      STARTROWINDEX: page, MAXROWS: MaxRows, FromDate: fromDate, ToDate: toDate, status: '', SearchField, SearchValue,
    });
    obj1 = mapRows(rows, PROPS);
    const rc = B.str(B.outVal(rows, 'Totalrecord'));
    const TotalRecord = B.toInt32(rc === '' ? '0' : rc);
    ViewBag.dynamicpagging = dynamicpagging;
    ViewBag.orderbydate = orderbydate;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
    ViewBag.CurrentPage = page;
    ViewBag.Userdownlinemember = Userdownlinemember;
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.SearchField = SearchField;
    ViewBag.fromDate = fromDate;
    ViewBag.toDate = toDate;
    ViewBag.SearchValue = SearchValue;
    ViewBag.ByStatus = ByStatus;
    ViewBag.OrderBy = OrderBy;
    ViewBag.APIerror = 1;
    return res.json({ view: '~/Views/AdminPanel/Club_History/Index.cshtml', Model: obj1, ...ViewBag });
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Bank-Withdrawal-Pending-ByAPI');
    ViewBag.ErrorMessage = ExpObj.message;
    ViewBag.APIerror = 0;
    return res.json({ view: '~/Views/AdminPanel/Club_History/Index.cshtml', Model: obj1, ...ViewBag });
  }
}));

// ---------------------------------------------------------------- [HttpPost] Upload(HttpPostedFileBase FileUpload, string GROUPNO)
// auth (reads Session["Admin_User"])
router.post(`/admin/${C}/Upload{/:id}`, adminAuth, B.upload(), asyncHandler(async (req, res) => {
  const GROUPNO = B.sp(req, 'GROUPNO');
  const TempData = {};
  let str = '';
  try {
    const file = B.reqFile(req, 'FileUpload');
    if (!file) throw B.NRE(); // Request.Files["FileUpload"].ContentLength on null
    if (file.size > 0) {
      const randomNumber = B.ticks();
      const FileExtension = path.extname(file.originalname).toLowerCase();
      let ConnString = '';
      const validFileTypes = ['.xls', '.xlsx', '.csv'];
      const uploadsDir = path.join(config.uploadDir, 'Content', 'Uploads');
      const baseName = path.basename(file.originalname, path.extname(file.originalname));
      const PathForFile = `${uploadsDir}/${baseName}_${randomNumber}${FileExtension}`;
      TempData.Excelut = PathForFile;
      fs.mkdirSync(uploadsDir, { recursive: true }); // !Directory.Exists(PathForFile) is always true
      if (validFileTypes.includes(FileExtension)) {
        let DtObjForFileUpload = [];
        if (fs.existsSync(PathForFile)) fs.unlinkSync(PathForFile);
        fs.writeFileSync(PathForFile, file.buffer);
        const ViewBag = {};
        if (FileExtension === '.csv') {
          DtObjForFileUpload = await Utility.ConvertCSVtoDataTable(PathForFile);
          ViewBag.Data = DtObjForFileUpload;
        } else if (FileExtension.trim() === '.xlsx' || FileExtension.trim() === '.xls') {
          ConnString = `Provider=Microsoft.ACE.OLEDB.12.0;Data Source=${PathForFile};Extended Properties="Excel 12.0;HDR=NO;IMEX=1"`;
          DtObjForFileUpload = await Utility.ConvertXSLXtoDataTable(PathForFile, ConnString);
          ViewBag.Data = DtObjForFileUpload;
        }
        TempData.ExcelFileName = `${baseName}_${randomNumber}${FileExtension}`;
        let status = '';
        let accountno = '';
        const Empid = req.user.emp_id;
        const IpAddress = B.serverIp();
        for (let i = 0; i < DtObjForFileUpload.length; i++) {
          status = ''; accountno = '';
          const st = B.str(B.dtCell(DtObjForFileUpload[i], 'Status'));
          if (st !== '') status = st;
          const ac = B.str(B.dtCell(DtObjForFileUpload[i], 'accountno'));
          if (ac !== '') accountno = ac;
          const out = await db.proc(DB, 'usp_update_bankwithdrawalStatus_byExecll', {
            groupnumber: GROUPNO, accountNo: accountno, status, ProcessBy: Empid, ProcessIPAddress: IpAddress, Mode: 'changestatus',
          });
          str = B.str(B.outVal(out, 'strResult'));
        }
        TempData.UploadedExcel = DtObjForFileUpload;
        return res.json({ redirect: '/Club_History/Index', TempData });
      }
      TempData.Message = 'Please Upload Files in .xls, .xlsx or .csv format';
    }
  } catch (Ex) {
    TempData.Message = 'Some error occured while performing the operation(s).' + Ex.message;
  }
  return res.json({ redirect: '/Club_History/Index', TempData });
}));

// ---------------------------------------------------------------- JsonResult cancel(string GROUPNO)
// auth (reads Session["Admin_User"]; without a session legacy hit the catch => "error")
router.all(`/admin/${C}/cancel{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  let str = '';
  try {
    const IpAddress = B.serverIp();
    const Empid = req.user.emp_id;
    const out = await db.proc(DB, 'usp_update_bankwithdrawalStatus_byExecll', {
      groupnumber: B.sp(req, 'GROUPNO'), accountNo: '', status: '', ProcessBy: Empid, ProcessIPAddress: IpAddress, Mode: 'cancel',
    });
    str = B.str(B.outVal(out, 'strResult'));
    if (str === '1') str = 'success';
  } catch (ex) {
    return res.json('error');
  }
  return res.json(str);
}));

module.exports = router;
