'use strict';
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row (0 when absent).
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : 0);
const s = (v) => (v === undefined || v === null ? '' : String(v));
const pg = (v) => { const n = parseInt(v, 10); return Number.isNaN(n) ? 1 : n; };
const os = require('os');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../../config');
// Port of Franchise\Controllers\CustomerPanel\Customer_bulk_payout.cs (3 actions)
// route-config: franchisee/Customer-Bulk-Payout -> Index
const PROPS = ['RowNumber', 'FileName', 'Date', 'ClubGroup', 'TotalRequest', 'TotalAmount', 'Total_tansaction', 'ProcessDate', 'ProcessBy', 'ProcessStatus', 'ProcessIPAddress', 'CHID', 'BankName', 'TotalPaid', 'TotalReject', 'Transaction_no', 'CANCELAMOUNT'];
const upload = multer({ storage: multer.memoryStorage() });

function hostIp() {
  const addrs = [];
  const ifs = os.networkInterfaces();
  for (const k of Object.keys(ifs)) for (const a of ifs[k]) addrs.push(a.address);
  return addrs.length > 1 ? addrs[1] : '';
}

// Utility.ConvertCSVtoDataTable equivalent: first line = header, comma separated, quotes supported
function parseCsv(text) {
  const rows = [];
  let row = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cur); cur = ''; } else if (c === '\n') { row.push(cur.replace(/\r$/, '')); rows.push(row); row = []; cur = ''; } else cur += c;
  }
  if (cur !== '' || row.length) { row.push(cur.replace(/\r$/, '')); rows.push(row); }
  return rows;
}
// PORT-NOTE: Utility.ConvertXSLXtoDataTable used OLEDB (Windows only). xls/xlsx are read with the optional 'xlsx' package (add to dependencies); first row = header names.
function parseExcel(buf) {
  const XLSX = require('xlsx');
  const wb = XLSX.read(buf, { type: 'buffer' });
  return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }).map((r) => r.map((v) => String(v)));
}

// auth
router.all(['/franchise/Customer_bulk_payout/Index{/:id}', '/franchise/franchisee/Customer-Bulk-Payout'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const SearchField = s(p.SearchField);
  const SearchValue = s(p.SearchValue);
  const fromDate = s(p.fromDate);
  const toDate = s(p.toDate);
  const DID = req.user.did;
  const MaxRows = await UtilityClass.GridPageSize();
  const page = p.page ? pg(p.page) : 1;
  const rows = await db.proc('shopping', 'usp_reseller_wise_customer_clubhistory_list', {
    STARTROWINDEX: page, MAXROWS: MaxRows, FromDate: fromDate, ToDate: toDate, status: '', SearchField, SearchValue, DID,
  });
  const TotalRecord = parseInt(outv(rows, 'Totalrecord'), 10) || 0;
  res.json({
    Model: mapRows(rows, PROPS),
    NoPerPage: await UtilityClass.GridNumbersPerPage(),
    CurrentPage: page,
    GridPageSize: MaxRows,
    TotalRecord,
    SearchField,
    fromDate,
    toDate,
    SearchValue,
    APIerror: 1,
  });
}));

// auth
router.post('/franchise/Customer_bulk_payout/Upload{/:id}', auth, upload.single('FileUpload'), asyncHandler(async (req, res) => {
  const GROUPNO = req.p.GROUPNO;
  const TempData = {};
  try {
    const f = req.file;
    if (f && f.size > 0) {
      const randomNumber = String(BigInt(Date.now()) * 10000n + 621355968000000000n);
      const FileExtension = path.extname(f.originalname).toLowerCase();
      const validFileTypes = ['.xls', '.xlsx', '.csv'];
      const dir = path.join(config.uploadDir, 'Content', 'Uploads');
      const baseName = path.basename(f.originalname, path.extname(f.originalname)) + '_' + randomNumber + FileExtension;
      const PathForFile = path.join(dir, baseName);
      TempData.Excelut = PathForFile;
      fs.mkdirSync(dir, { recursive: true });
      if (validFileTypes.includes(FileExtension)) {
        if (fs.existsSync(PathForFile)) fs.unlinkSync(PathForFile);
        fs.writeFileSync(PathForFile, f.buffer);
        let table = [];
        if (FileExtension === '.csv') table = parseCsv(f.buffer.toString('utf8'));
        else table = parseExcel(f.buffer);
        const head = (table[0] || []).map((h) => String(h).trim().toLowerCase());
        const col = (n) => head.indexOf(n.toLowerCase());
        const dt = table.slice(1).map((r) => {
          const o = {};
          head.forEach((h, i) => { o[h] = r[i] === undefined ? '' : r[i]; });
          return o;
        });
        TempData.ExcelFileName = baseName;
        const Empid = req.user.did;
        const IpAddress = hostIp();
        let str = '';
        for (let i = 0; i < dt.length; i++) {
          if (col('Status') < 0) throw new Error('Column \'Status\' does not belong to table .');
          if (col('accountno') < 0) throw new Error('Column \'accountno\' does not belong to table .');
          const status = dt[i].status !== '' ? String(dt[i].status) : '';
          const accountno = dt[i].accountno !== '' ? String(dt[i].accountno) : '';
          const r = await db.procOne('shopping', 'usp_update_resellerwise_customer_bankwithdrawalstatus_byexecll', {
            groupnumber: GROUPNO, accountNo: accountno, status, ProcessBy: Empid, ProcessIPAddress: IpAddress, Mode: 1,
          });
          str = r && r.strresult !== undefined && r.strresult !== null ? String(r.strresult) : '';
        }
        TempData.UploadedExcel = dt;
        return res.json({ redirect: 'Club_History/Index', TempData, strResult: str });
      }
      TempData.Message = 'Please Upload Files in .xls, .xlsx or .csv format';
    }
  } catch (Ex) {
    TempData.Message = 'Some error occured while performing the operation(s).' + Ex.message;
  }
  return res.json({ redirect: ' Uploaded_Bank_Excel_Customer_History/Index', TempData });
}));

// auth
router.all('/franchise/Customer_bulk_payout/cancel{/:id}', auth, asyncHandler(async (req, res) => {
  let str = '';
  try {
    const GROUPNO = req.p.GROUPNO;
    const IpAddress = hostIp();
    const Empid = req.user.did;
    const r = await db.procOne('shopping', 'usp_update_resellerwise_customer_bankwithdrawalstatus_byexecll', {
      groupnumber: GROUPNO, accountNo: '', status: '', ProcessBy: Empid, ProcessIPAddress: IpAddress, Mode: 2,
    });
    str = r && r.strresult !== undefined && r.strresult !== null ? String(r.strresult) : '';
    if (str === '1') str = 'success';
  } catch (ex) {
    return res.json('error');
  }
  return res.json(str);
}));

module.exports = router;
