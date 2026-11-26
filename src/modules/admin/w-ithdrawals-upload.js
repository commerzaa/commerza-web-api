'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\WIthdrawalsUpload.cs (class WIthdrawalsUploadController => /admin/WIthdrawalsUpload/...)
// Database: affiliate (Db_Affiliate).
// Class `commsioncharge` (property bag, unused by the actions) is not ported.
// RouteConfig "AdminPanel/WIthdrawals-Upload" -> WIthdrawalsUpload/Index: the controller has no Index action (legacy 404) => not registered.
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const Utility = require('../../lib/admin/Utility');
const DataUtility = require('../../lib/admin/DataUtility');
const { adminAuth, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch13-12-common');

const { DB } = B;
const router = express.Router();
const C = 'WIthdrawalsUpload';

// PORT-NOTE: `private static string Fullpath` / instance fields TOTALINVALIDRECORDS, datauploadmessage are never used.

/** DBO.usp_update_bankwithdrawalStatus_byExecll @groupnumber,@accountNo,@status,@ProcessBy,@ProcessIPAddress,@strResult out,@Mode[,@UTRNO] */
const updateStatus = (p) => db.proc(DB, 'usp_update_bankwithdrawalStatus_byExecll', p);

/** DataTable.Rows.Count on a null DataTable => NullReferenceException */
function rowsOf(dt) {
  if (dt === null || dt === undefined) throw B.nullRef();
  return dt;
}

// public void ICICIBANK(string GROUPNO, string accountno, string status, int Empid, string IpAddress)  (DataTable = TempData["data"])
async function ICICIBANK(DtObjForFileUpload, GROUPNO, accountno, status, Empid, IpAddress) {
  const dt = rowsOf(DtObjForFileUpload);
  for (let i = 17; i < dt.length; i++) {
    status = ''; accountno = '';
    if (B.dtIdx(dt[i], 8) !== '') status = B.dtIdx(dt[i], 8);
    if (B.dtIdx(dt[i], 6) !== '') accountno = B.dtIdx(dt[i], 6);
    await updateStatus({
      groupnumber: GROUPNO, accountNo: accountno, status, ProcessBy: Empid, ProcessIPAddress: IpAddress, Mode: 'changestatus',
    });
  }
}

// public void AXISBANK(string GROUPNO, string accountno, string status, int Empid, string IpAddress)  (DataTable = ViewBag.Data)
async function AXISBANK(DtObjForFileUpload, GROUPNO, accountno, status, Empid, IpAddress) {
  const dt = rowsOf(DtObjForFileUpload);
  let UTRNO = '';
  for (let i = 5; i < dt.length; i++) {
    status = ''; accountno = ''; UTRNO = '';
    if (B.dtIdx(dt[i], 8) !== '') status = B.dtIdx(dt[i], 8);
    if (B.dtIdx(dt[i], 1) !== '') accountno = B.dtIdx(dt[i], 1);
    if (B.dtIdx(dt[i], 7) !== '') UTRNO = B.dtIdx(dt[i], 7);
    await updateStatus({
      groupnumber: GROUPNO, accountNo: accountno, status, ProcessBy: Empid, ProcessIPAddress: IpAddress, Mode: 'changestatus', UTRNO,
    });
  }
}

// ---------------------------------------------------------------- ActionResult Upload(HttpPostedFileBase FileUpload, string GROUPNO, string BankName)
// auth (reads Session["Admin_User"]; no [HttpPost] attribute => any verb)
router.all(`/admin/${C}/Upload{/:id}`, adminAuth, B.upload(), asyncHandler(async (req, res) => {
  const GROUPNO = B.nStr(req.p.GROUPNO);
  const BankName = B.nStr(req.p.BankName);
  const TempData = {};
  const ViewBag = {};
  const ut = new DataUtility();
  try {
    const file = B.reqFile(req, 'FileUpload');
    if (!file) throw B.nullRef(); // Request.Files["FileUpload"].ContentLength on null
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
      await ut.ErrorInsert(0, 'Success', 'LIne 49', 49, '');
      if (validFileTypes.includes(FileExtension)) {
        let DtObjForFileUpload = [];
        await ut.ErrorInsert(0, 'Success', 'LIne 53', 53, '');
        if (fs.existsSync(PathForFile)) fs.unlinkSync(PathForFile);
        await ut.ErrorInsert(0, 'Success', 'LIne 56', 56, '');
        fs.writeFileSync(PathForFile, file.buffer);
        await ut.ErrorInsert(0, PathForFile, 'LIne 57', 57, '');
        await ut.ErrorInsert(0, 'Success', 'LIne 59', 59, '');
        if (FileExtension === '.csv') {
          DtObjForFileUpload = await Utility.ConvertCSVtoDataTable(PathForFile);
          ViewBag.Data = DtObjForFileUpload;
        } else if (FileExtension.trim() === '.xlsx' || FileExtension.trim() === '.xls') {
          await ut.ErrorInsert(0, 'Success', 'LIne 66', 68, '');
          ConnString = `Provider=Microsoft.ACE.OLEDB.12.0;Data Source=${PathForFile};Extended Properties="Excel 12.0;HDR=NO;IMEX=1"`;
          await ut.ErrorInsert(0, 'Success', ConnString, 69, '');
          DtObjForFileUpload = await Utility.ConvertXSLXtoDataTable(PathForFile, ConnString);
          await ut.ErrorInsert(0, 'Success', PathForFile, 71, '');
          ViewBag.Data = DtObjForFileUpload;
          TempData.data = DtObjForFileUpload;
          // TempData["data"].ToString() => DataTable.ToString() = TableName ("" for the unnamed table)
          await ut.ErrorInsert(0, 'Success', '', 71, '');
        }
        TempData.ExcelFileName = `${baseName}_${randomNumber}${FileExtension}`;
        const status = ''; const accountno = '';
        const Empid = req.user.emp_id;
        const IpAddress = B.serverIp(); // Dns.GetHostEntry(Dns.GetHostName()).AddressList[1] (PORT-NOTE: approximation)
        if (BankName === null) throw B.nullRef(); // BankName.ToString()
        if (BankName.toUpperCase() === 'ICICI BANK') {
          await ICICIBANK(TempData.data === undefined ? null : TempData.data, GROUPNO, accountno, status, Empid, IpAddress);
        }
        if (BankName.toUpperCase() === 'Axis Bank'.toUpperCase()) {
          await AXISBANK(ViewBag.Data === undefined ? null : ViewBag.Data, GROUPNO, accountno, status, Empid, IpAddress);
        }
        TempData.UploadedExcel = DtObjForFileUpload;
        return res.json({ redirect: '/Club_History/Index', TempData });
      }
      TempData.Message = 'Please Upload Files in .xls, .xlsx or .csv format';
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'Here');
    TempData.Message = 'Some error occured while performing the operation(s).' + ExpObj.message;
  }
  return res.json({ redirect: '/Club_History/Index', TempData });
}));

// ---------------------------------------------------------------- public void ICICIBANK(string GROUPNO, string accountno, string status, int Empid, string IpAddress)
// auth (PORT-NOTE: legacy had no session check; admin withdrawal status update => adminAuth). Called directly, TempData["data"] is
// null in a fresh request => NullReferenceException (500), reproduced.
router.all(`/admin/${C}/ICICIBANK{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Empid = B.reqInt(req.p.Empid, 'Empid');
  await ICICIBANK(B.tdPeek(req, 'data'), B.nStr(req.p.GROUPNO), B.nStr(req.p.accountno), B.nStr(req.p.status), Empid, B.nStr(req.p.IpAddress));
  res.send('');
}));

// ---------------------------------------------------------------- public void AXISBANK(string GROUPNO, string accountno, string status, int Empid, string IpAddress)
// auth (PORT-NOTE: legacy had no session check; admin withdrawal status update => adminAuth). Called directly, ViewBag.Data is
// null => NullReferenceException (500), reproduced.
router.all(`/admin/${C}/AXISBANK{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const Empid = B.reqInt(req.p.Empid, 'Empid');
  await AXISBANK(null, B.nStr(req.p.GROUPNO), B.nStr(req.p.accountno), B.nStr(req.p.status), Empid, B.nStr(req.p.IpAddress));
  res.send('');
}));

module.exports = router;
