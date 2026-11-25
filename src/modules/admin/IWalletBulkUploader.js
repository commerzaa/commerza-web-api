'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\IWalletBulkUploader.cs (class IWalletBulkUploaderController => /admin/IWalletBulkUploader/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const config = require('../../config');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const Utility = require('../../lib/admin/Utility');
const { adminAuth, errorInsert } = require('./_shared/adminSession');
const B = require('./_shared/batch08_common');
const { tdSet, tdPeek, tdGet, ticks, cvtLongObj, cellReq, cvtStrObj } = require('./_shared/batch08C_common');

const router = express.Router();
const DB = 'affiliate';
const C = 'IWalletBulkUploader';
const upload = multer({ storage: multer.memoryStorage() });

/**
 * public JsonResult ApproveReject(long RegNo, long TFHID, string Mode, string Remarks) - shared by the action and Upload().
 * Returns the Json payload (StrResult, or the error message after ErrorInsert "Usp_Fund_Transfer").
 */
async function ApproveReject(req, RegNo, TFHID, Mode, Remarks) {
  try {
    let StrMessage = '';
    const Emp_Master = req.user && req.user.userType === 'admin' ? req.user : null; // (Employee_Master)Session["Admin_User"]
    if (!Emp_Master) throw B.nullRef();
    const ActivityByUser = (Emp_Master.emp_code === null || Emp_Master.emp_code === undefined ? (() => { throw B.nullRef(); })() : String(Emp_Master.emp_code))
      + ' ' + '(' + (Emp_Master.emp_name === null || Emp_Master.emp_name === undefined ? '' : Emp_Master.emp_name) + ')';
    const row = await db.procOne(DB, 'Usp_Fund_Transfer', {
      Mode: '5', RegNo, ByUserRegNo: '0', Type: Mode, Amount: '0', Remark: Remarks, FromDate: '', ToDate: '', StartRowIndex: '1',
      MaxRows: '100', TFHID, emailid: '', minamount: '0', maxamount: '0', IsVerifiedByAdmin: '-1', ORDERBYFIELD: 'AVDESC', PaymentMode: '0',
      ActivityByUser, Activity_By_Emp_Id: Emp_Master.emp_id,
    });
    StrMessage = B.outStr(row, 'StrResult'); // SpOutPut.Value.ToString() (DBNull => "")
    return StrMessage;
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Usp_Fund_Transfer');
    return 'Some error occured while performing the operations.';
  }
}

// ---------------------------------------------------------------- Index()
// public (legacy had no session check); optionalAuth so TempData["Message"] is read from the admin's store
// route-config: "adminpanel/upload-i-wallet-payment-request" -> IWalletBulkUploader/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/adminpanel/upload-i-wallet-payment-request'], optionalAuth, asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/AdminPanel/IWalletBulkUploader/Index.cshtml', TempData: { Message: tdGet(req, 'Message') } });
}));

// ---------------------------------------------------------------- [HttpPost] ActionResult Upload(HttpPostedFileBase upload, string buttontype)
// auth (reads Session["Admin_User"] in the import branch; posts fund-transfer approvals)
router.post(`/admin/${C}/Upload{/:id}`, adminAuth, upload.any(), asyncHandler(async (req, res) => {
  const buttontype = B.nStr(req.p.buttontype);
  const randomNumber = ticks();
  const redirect = () => res.json({ redirect: '/IWalletBulkUploader/Index', TempData: { Message: tdPeek(req, 'Message') } });
  try {
    const file = (req.files || []).find((f) => f.fieldname === 'FileUpload');
    if (!file) throw B.nullRef(); // Request.Files["FileUpload"].ContentLength
    if (file.size > 0) {
      // PORT-NOTE: path.basename() strips any client path from the file name (legacy used FileName verbatim: path traversal risk).
      const FileName = path.basename(String(file.originalname || ''));
      const FileExtension = path.extname(FileName).toLowerCase();
      let ConnString = '';
      const validFileTypes = ['.xls', '.xlsx', '.csv'];
      const dir = path.join(config.uploadDir, 'Content', 'Uploads');
      const PathForFile = path.join(dir, randomNumber + '_' + FileName);
      if (!fs.existsSync(PathForFile)) fs.mkdirSync(dir, { recursive: true }); // Directory.Exists(<file path>) is always false
      if (validFileTypes.includes(FileExtension)) {
        let DtObjForFileUpload = [];
        const ViewBag = {};
        if (fs.existsSync(PathForFile)) fs.unlinkSync(PathForFile);
        fs.writeFileSync(PathForFile, file.buffer);
        if (FileExtension === '.csv') {
          DtObjForFileUpload = await Utility.ConvertCSVtoDataTable(PathForFile);
          ViewBag.Data = DtObjForFileUpload;
        } else if (FileExtension.trim() === '.xlsx' || FileExtension.trim() === '.xls') {
          ConnString = 'Provider=Microsoft.ACE.OLEDB.12.0;Data Source=' + PathForFile + ';Extended Properties="Excel 12.0;HDR=Yes;IMEX=2"';
          DtObjForFileUpload = await Utility.ConvertXSLXtoDataTable(PathForFile, ConnString);
          ViewBag.Data = DtObjForFileUpload;
        }
        tdSet(req, 'ExcelFileName', randomNumber + '_' + FileName);
        if (buttontype === null) throw B.nullRef(); // buttontype.ToLower()
        if (buttontype.toLowerCase() === 'upload') {
          tdSet(req, 'UploadedExcel', DtObjForFileUpload);
          return res.json({ view: '~/Views/AdminPanel/IWalletBulkUploader/Index.cshtml', Model: DtObjForFileUpload, ...ViewBag });
        }
      } else {
        tdSet(req, 'Message', 'Please Upload Files in .xls, .xlsx or .csv format');
      }
    } else if (tdPeek(req, 'UploadedExcel') !== null) {
      // PORT-NOTE: this branch is only reached with an empty FileUpload part (ContentLength == 0), as in legacy.
      //** Maintaing the Log for Uploaded Excel Sheet **//
      const Emp_Master = req.user;
      if (Emp_Master.emp_code === null || Emp_Master.emp_code === undefined) throw B.nullRef(); // Emp_Code.ToString()
      const ActivityByUser = String(Emp_Master.emp_code) + ' ' + '(' + (Emp_Master.emp_name === null || Emp_Master.emp_name === undefined ? '' : Emp_Master.emp_name) + ')';
      const DtExcel = tdGet(req, 'UploadedExcel');
      if (DtExcel.length > 0) {
        for (let i = 0; i < DtExcel.length; i++) {
          if (cvtStrObj(cellReq(DtExcel[i], 'PAYMENT STATUS')) !== '') {
            let RegNo = 0; let TFHID = 0; let Mode = ''; let Remarks = '';
            RegNo = cvtLongObj(cellReq(DtExcel[i], 'REGNO'));
            TFHID = cvtLongObj(cellReq(DtExcel[i], 'TFHID'));
            Mode = cvtStrObj(cellReq(DtExcel[i], 'PAYMENT STATUS'));
            Remarks = cvtStrObj(cellReq(DtExcel[i], 'YOUR REMARK'));
            await ApproveReject(req, RegNo, TFHID, Mode, Remarks); // result ignored (errors swallowed inside, like legacy)
          }
        }
        tdSet(req, 'UploadedExcel', null);
        const ActivityDate = await db.scalar(DB, 'select fun_getcurrentdate()', {});
        const ExcelFileName = tdGet(req, 'ExcelFileName');
        if (ExcelFileName === null) throw B.nullRef(); // TempData["ExcelFileName"].ToString()
        // Db._Tbl_UploadedIWalletExcelLog.Add(ObjLog); Db.SaveChanges();
        await db.exec(DB, `insert into tbl_uploadediwalletexcellog (activitydate, activitybyuser, excelfile, status, activitybyuserid)
          values (@ActivityDate, @ActivityByUser, @ExcelFile, @Status, @ActivityByUserId)`, {
          ActivityDate, ActivityByUser, ExcelFile: String(ExcelFileName), Status: 1, ActivityByUserId: Emp_Master.emp_code,
        });
        tdSet(req, 'Message', 'Successfully performed the operation(s).');
      } else {
        tdSet(req, 'Message', 'No Data Found in the Excel Sheet.');
      }
    }
  } catch (ExpObj) {
    if (res.headersSent) return undefined;
    await errorInsert(req, ExpObj, 'Upload');
    tdSet(req, 'Message', 'Some error occured while performing the operation(s).');
    return redirect();
  }
  return redirect();
}));

// ---------------------------------------------------------------- JsonResult ApproveReject(long RegNo, long TFHID, string Mode, string Remarks)
// auth (reads Session["Admin_User"]; legacy without a session hit the NRE catch => "Some error occured while performing the operations.")
router.all(`/admin/${C}/ApproveReject{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const p = req.p;
  // non-nullable long parameters: model binding error (500) when missing
  const RegNo = B.reqInt(p.RegNo, 'RegNo');
  const TFHID = B.reqInt(p.TFHID, 'TFHID');
  res.json(await ApproveReject(req, RegNo, TFHID, B.nStr(p.Mode), B.nStr(p.Remarks)));
}));

module.exports = router;
