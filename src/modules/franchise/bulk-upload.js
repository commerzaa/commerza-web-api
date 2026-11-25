'use strict';
/**
 * Port of Franchise/Controllers/CustomerPanel/BulkUpload.cs (BulkUploadController)
 * Prefix: /franchise   DB: Franchise DataBaseContext points at Db_Shopping => 'shopping'
 * Requires the `xlsx` package for .xls/.xlsx files (replacement for ACE.OLEDB reader + Excel interop).
 */
const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const config = require('../../config');
const { query, scalar, exec, procOne } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');

const router = express.Router();
const DB = 'shopping';
const upload = multer({ storage: multer.memoryStorage() });
const NRE = () => new TypeError('Object reference not set to an instance of an object.');

// private static string Fullpath (shared across requests, like the legacy static field)
let Fullpath = '';

// ---- DataTable helpers -----------------------------------------------------------------------------------
/** Convert.ToString(object): DBNull/null => "" */
const cvStr = (v) => (v === null || v === undefined ? '' : String(v));
/** banker's rounding like Convert.ToInt32(double) */
function bankers(x) {
  const f = Math.floor(x); const d = x - f;
  if (d < 0.5) return f; if (d > 0.5) return f + 1; return f % 2 === 0 ? f : f + 1;
}
/** Convert.ToInt32(object) (DBNull => InvalidCastException) */
function cvInt(v) {
  if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  if (typeof v === 'number') return bankers(v);
  if (typeof v === 'boolean') return v ? 1 : 0;
  const s = String(v).trim();
  if (!/^[+-]?\d+$/.test(s)) throw new Error('Input string was not in a correct format.');
  return parseInt(s, 10);
}
/** Convert.ToDecimal(object) */
function cvDec(v) {
  if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (s === '' || Number.isNaN(Number(s))) throw new Error('Input string was not in a correct format.');
  return Number(s);
}
function parseCsv(buf) {
  const lines = buf.toString('utf8').split(/\r?\n/);
  const headers = (lines.shift() || '').split(',');
  const rows = [];
  for (const line of lines) {
    if (line === '') continue;
    const r = line.split(',');
    if (r.length > 1) {
      const o = {};
      headers.forEach((h, i) => { o[h] = (r[i] === undefined ? '' : r[i]).trim(); });
      rows.push(o);
    }
  }
  return { columns: headers, rows };
}
/** Utility.ConvertXSLXtoDataTable: SELECT * FROM [Sheet1$] where [F6] IS NOT NULL and [F5] IS NOT NULL (HDR=NO => F1..Fn) */
function readSheet(file) {
  const XLSX = require('xlsx');
  const workbook = XLSX.readFile(file);
  const sheet = workbook.Sheets.Sheet1;
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: true });
  const width = aoa.reduce((m, r) => Math.max(m, r.length), 0);
  const table = { columns: Array.from({ length: width }, (_, i) => 'F' + (i + 1)), rows: [] };
  for (const r of aoa) {
    if (r[5] !== null && r[5] !== undefined && r[4] !== null && r[4] !== undefined) {
      const o = {};
      table.columns.forEach((c, i) => { o[c] = r[i] === undefined ? null : r[i]; });
      table.rows.push(o);
    }
  }
  return { table, workbook, XLSX };
}
const getCol = (table, row, name) => {
  if (!table.columns.includes(name)) throw new Error('Column \'' + name + '\' does not belong to table.');
  return row[name];
};
const pad = (n, l) => String(n).padStart(l, '0');
const ticks = () => (BigInt(Date.now()) * 10000n + 621355968000000000n).toString();
function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  if (k !== undefined) return row[k];
  const first = Object.keys(row)[0];
  return first === undefined ? null : row[first];
}

// ---- ApproveReject ---------------------------------------------------------------------------------------
/** state = { datauploadmessage, TOTALINVALIDRECORDS } (legacy controller instance fields) */
async function ApproveReject(state, req, a) {
  try {
    let StrMessage = '';
    state.datauploadmessage = '';
    const Branchid = req.user.did;
    const r = await procOne(DB, 'ims_usp_createproduct_temp', {
      sprid: a.sprid, mprid: a.mprid, branchid: Branchid, companyid: a.CompanyID, catid: a.CATID, subcatid: a.SUBCATID, brand: a.BRAND, productcode: a.PRCODE,
      subprcode: a.SUBPRCODE, prodtitle: a.PRODTITLE, activefrom: '', activeto: '', shortdesc: a.SHORTDESC, fulldesc: a.FULLDESC, isallowcoupon: false,
      minorderqty: 0, maxorderqty: 0, paymode: '', sellmrp: a.MRP, discountper: a.DISCOUNTPER, qty: a.QTY, produnit: a.PRODUNIT, color: a.color, size: a.size,
      prodimages: a.ProductImage, allattributes: a.allAttributes, vcid: a.GSTGroup, vatp: 0, directamt: 0, dap: a.DAP, replacementday: 0,
      keyfeatures: a.KeyFeatures, stockin: a.StockIn, procurementsla: 0, shippingcharges: a.shippingcharges, cashondelivery: a.CashOnDelivery,
      pkg_weight_kg: a.Weightkg, pkg_length_cms: a.Length, pkg_breadth_cms: a.Breadth, pkg_height_cms: a.height, warrentyinfocare: 0, dealsids: 0, groupid: 0,
      ywillrece: a.YWillRece, ismerchantstatus: 0, productentry: a.requestno, fullfillment: a.ddlseller, procurementtype: a.ddlprocurement, hsn: a.hsn,
      luxurycess: a.luxurycess, manufacturingdetail: a.manufacturedetail, importerdetail: a.importerdetail, packerdetail: a.packerdetail, countryorigin: 96,
    });
    const v = outVal(r, 'strresult');
    if (v === null || v === undefined) throw NRE();
    StrMessage = String(v);
    const arr = StrMessage.split('^');
    if (arr[0] !== 'ok') {
      state.TOTALINVALIDRECORDS += 1;
      if (arr[1] === undefined) throw new RangeError('Index was outside the bounds of the array.');
      state.datauploadmessage = (arr[0] + arr[1]).toString();
    }
  } catch (ex) {
    state.TOTALINVALIDRECORDS += 1;
    return 'Some error occured while performing the operations.';
  }
  return state.datauploadmessage;
}

// ---- Index ---------------------------------------------------------------------------------------------
// auth
router.all('/franchise/BulkUpload/Index{/:id}', auth, asyncHandler(async (req, res) => {
  const Message = sessionStore.get(req, 'Message');
  sessionStore.set(req, 'Message', null);
  return res.json({ view: '~/Views/BulkUpload/Index.cshtml', TempData: { Message: Message === undefined ? null : Message } });
}));

// ---- ApproveReject (public action) ------------------------------------------------------------------------
// auth
router.all('/franchise/BulkUpload/ApproveReject{/:id}', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const n = (v) => { const x = Number(v); return v === undefined || v === null || v === '' || Number.isNaN(x) ? 0 : x; };
  const s = (v) => (v === undefined || v === null ? null : String(v));
  const state = { datauploadmessage: '', TOTALINVALIDRECORDS: 0 };
  const out = await ApproveReject(state, req, {
    sprid: n(p.sprid), mprid: n(p.mprid), CompanyID: n(p.CompanyID), CATID: n(p.CATID), SUBCATID: n(p.SUBCATID), BRAND: n(p.BRAND), PRCODE: s(p.PRCODE),
    SUBPRCODE: s(p.SUBPRCODE), PRODTITLE: s(p.PRODTITLE), SHORTDESC: s(p.SHORTDESC), FULLDESC: s(p.FULLDESC), SELLMRP: n(p.SELLMRP), DISCOUNTPER: n(p.DISCOUNTPER),
    QTY: n(p.QTY), PRODUNIT: s(p.PRODUNIT), color: s(p.color), size: s(p.size), ProductImage: s(p.ProductImage), allAttributes: s(p.allAttributes),
    GSTGroup: n(p.GSTGroup), DAP: n(p.DAP), KeyFeatures: s(p.KeyFeatures), StockIn: n(p.StockIn), shippingcharges: n(p.shippingcharges),
    CashOnDelivery: n(p.CashOnDelivery), YWillRece: n(p.YWillRece), length: n(p.length), MRP: n(p.MRP), Weightkg: n(p.Weightkg), Length: n(p.Length),
    Breadth: n(p.Breadth), height: n(p.height), requestno: s(p.requestno), packerdetail: s(p.packerdetail), importerdetail: s(p.importerdetail),
    manufacturedetail: s(p.manufacturedetail), hsn: s(p.hsn), luxurycess: n(p.luxurycess), procurementsla1: s(p.procurementsla1), ddlseller: n(p.ddlseller),
    ddlprocurement: n(p.ddlprocurement),
  });
  return res.type('text/plain').send(out);
}));

// ---- Upload ----------------------------------------------------------------------------------------------
// auth
router.post('/franchise/BulkUpload/Upload{/:id}', auth, upload.any(), asyncHandler(async (req, res) => {
  const state = { datauploadmessage: '', TOTALINVALIDRECORDS: 0 };
  const redirectTo = () => {
    const Message = sessionStore.get(req, 'Message');
    sessionStore.set(req, 'Message', null);
    return res.json({ redirect: '/franchise/BulkUpload/Index', TempData: { Message: Message === undefined ? null : Message } });
  };
  try {
    const files = req.files || [];
    const file = files.find((f) => f.fieldname === 'FileUpload');
    // PORT-NOTE: legacy Request.Files["FileUpload"] is never null for the form; a missing/empty part is treated as ContentLength == 0
    const buttontype = req.p.buttontype;
    const uploaded = sessionStore.get(req, 'UploadedExcel');
    if (file && file.size > 0) {
      const randomNumber = ticks();
      const FileExtension = path.extname(file.originalname).toLowerCase();
      const validFileTypes = ['.xls', '.xlsx', '.csv'];
      const dir = path.join(config.uploadDir, 'Content', 'Uploads');
      const PathForFile = path.join(dir, path.basename(file.originalname, path.extname(file.originalname)) + '_' + randomNumber + FileExtension);
      Fullpath = PathForFile;
      fs.mkdirSync(dir, { recursive: true });
      if (validFileTypes.includes(FileExtension)) {
        let DtObjForFileUpload = { columns: [], rows: [] };
        if (fs.existsSync(PathForFile)) fs.unlinkSync(PathForFile);
        fs.writeFileSync(PathForFile, file.buffer);
        if (FileExtension === '.csv') {
          DtObjForFileUpload = parseCsv(file.buffer);
        } else if (FileExtension.trim() === '.xlsx' || FileExtension.trim() === '.xls') {
          DtObjForFileUpload = readSheet(PathForFile).table;
        }
        sessionStore.set(req, 'ExcelFileName', randomNumber + '_' + file.originalname);
        if (buttontype === undefined || buttontype === null) throw NRE();
        if (String(buttontype).toLowerCase() === 'upload') {
          sessionStore.set(req, 'UploadedExcel', DtObjForFileUpload);
          return res.json({ view: '~/Views/BulkUpload/Index.cshtml', Model: DtObjForFileUpload, ViewBag: { Data: DtObjForFileUpload } });
        }
      } else {
        sessionStore.set(req, 'Message', 'Please Upload Files in .xls, .xlsx or .csv format');
      }
    } else if (uploaded !== undefined && uploaded !== null) {
      const ActivityByUser = req.user.did + ' (' + req.user.userName + ')';
      let categoryid = 0, subcategoryid = 0, Totalrecord = 0, mcid = 0;
      const DtExcel = uploaded;
      const requestno = 'REQ' + pad(Math.floor(Math.random() * 999999), 6);
      if (DtExcel.rows.length > 0) {
        const z = DtExcel.rows.length - 1;
        // legacy Interop wrote the result into the uploaded workbook; reproduced with `xlsx` for .xls/.xlsx
        let wb = null, XLSX = null;
        if (Fullpath && /\.xlsx?$/i.test(Fullpath) && fs.existsSync(Fullpath)) {
          XLSX = require('xlsx');
          wb = XLSX.readFile(Fullpath);
        }
        for (let i = 1; i < DtExcel.rows.length; i++) {
          const row = DtExcel.rows[i];
          const col = (name) => getCol(DtExcel, row, name);
          let sprid = 0, mprid = 0;
          let KeyFeatures = '', allAttributes = '';
          let CompanyID = 0, CATID = 0, SUBCATID = 0, BRAND = 0, QTY = 0, GSTGroup = 0, StockIn = 0, CashOnDelivery = 0, start = 32, alllength = 0, ddlseller = 0, ddlprocurement = 0;
          const PRCODE = '', color = '', size = '';
          let Admincharge = 0, deleverycharge = 0, handlingcharge = 0, Fixedcharge = 0;
          const length = 0;

          for (let k = 0; k < DtExcel.columns.length; k++) {
            if (cvStr(DtExcel.rows[0][DtExcel.columns[k]]) !== '') alllength++;
          }
          mcid = cvInt(col('F2'));
          CATID = cvInt(col('F3'));
          SUBCATID = cvInt(col('F4'));
          categoryid = CATID;
          subcategoryid = SUBCATID;
          const crow = await query(DB, 'select admincharge, delieverycharge, handlingcharge, fixedfee from tbl_sub_category where subcatid = @subcatid and status = 1', { subcatid: SUBCATID });
          if (crow.length > 0) {
            const nz = (v) => { if (v === null || v === undefined) throw NRE(); return Number(v); };
            Admincharge = nz(crow[0].admincharge);
            deleverycharge = nz(crow[0].delieverycharge);
            handlingcharge = nz(crow[0].handlingcharge);
            Fixedcharge = nz(crow[0].fixedfee);
          }
          const GSTgroupname = cvStr(col('F5'));
          if (GSTgroupname !== '') {
            const g = await scalar(DB, 'Select coalesce(vcid,0) from tbl_vat_categories where vattitle = @t LIMIT 1', { t: GSTgroupname });
            GSTGroup = g === null || g === undefined ? 0 : g;
          }
          const SUBPRCODE = cvStr(col('F6'));
          const PRODTITLE = cvStr(col('F7'));
          const MRP = cvDec(col('F8'));
          const DISCOUNTPER = cvDec(col('F9'));
          const SELLMRP = (MRP * DISCOUNTPER) / 100;
          const DAP = MRP - SELLMRP;
          const admindiscountamt = (DAP * Admincharge) / 100;
          const YWillRece = (DAP - admindiscountamt - deleverycharge - handlingcharge - Fixedcharge);

          QTY = cvInt(col('F12'));
          StockIn = cvInt(col('F12'));
          const ProductImage = cvStr(col('F13'));
          const shippingcharges = cvDec(col('F14'));
          const CODelivery = cvStr(col('F15'));
          CashOnDelivery = CODelivery === 'Available' ? 1 : 0;
          const SHORTDESC = cvStr(col('F16'));
          const AllKeydata = cvStr(col('F17'));
          const KeyFeturesvalue = AllKeydata.split('^');
          for (let k = 0; k < KeyFeturesvalue.length; k++) KeyFeatures += '<li>' + KeyFeturesvalue[k] + '</li>';
          KeyFeatures = '<ul>' + KeyFeatures + '</ul>';

          const FULLDESC = cvStr(col('F18'));
          const PRODUNIT = cvStr(col('F19'));
          const Weightkg = cvDec(col('F20'));
          const Length = cvDec(col('F21'));
          const Breadth = cvDec(col('F22'));
          const height = cvDec(col('F23'));

          const manufacturedetail = cvStr(col('F24'));
          const importerdetail = cvStr(col('F25'));
          const packerdetail = cvStr(col('F26'));
          const hsn = cvStr(col('F27'));
          const luxurycess = cvDec(col('F28'));
          const ddlseller1 = cvStr(col('F29'));
          if (ddlseller1 === '' || ddlseller1 === 'Seller') ddlseller = 1;
          const ddlprocurement1 = cvStr(col('F30'));
          if (ddlprocurement1 === '' || ddlprocurement1 === 'Instock') ddlprocurement = 1;
          const procurementsla1 = cvStr(col('F31'));

          if (start <= alllength - 1) {
            while (start <= alllength - 1) {
              allAttributes = allAttributes + '^' + cvStr(getCol(DtExcel, DtExcel.rows[0], 'F' + start)) + '~' + cvStr(col('F' + start));
              start++;
            }
            allAttributes = allAttributes.substring(1);
          }

          await ApproveReject(state, req, {
            sprid, mprid, CompanyID, CATID, SUBCATID, BRAND, PRCODE, SUBPRCODE, PRODTITLE, SHORTDESC, FULLDESC, SELLMRP, DISCOUNTPER, QTY,
            PRODUNIT, color, size, ProductImage, allAttributes, GSTGroup, DAP, KeyFeatures, StockIn, shippingcharges, CashOnDelivery, YWillRece, length,
            MRP, Weightkg, Length, Breadth, height, requestno, packerdetail, importerdetail, manufacturedetail, hsn, luxurycess, procurementsla1, ddlseller, ddlprocurement,
          });

          const Response = state.datauploadmessage;
          if (wb) {
            // PORT-NOTE: Excel interop cell colouring (DarkGray fill, red/green font) is not available in `xlsx`; only the status text is written.
            const sheet = wb.Sheets.Sheet1;
            const J = i + 2;
            const addr = XLSX.utils.encode_cell({ r: J - 1, c: alllength - 1 });
            sheet[addr] = { t: 's', v: Response !== '' ? Response : 'Uploaded' };
            const ref = XLSX.utils.decode_range(sheet['!ref']);
            if (J - 1 > ref.e.r) ref.e.r = J - 1;
            if (alllength - 1 > ref.e.c) ref.e.c = alllength - 1;
            sheet['!ref'] = XLSX.utils.encode_range(ref);
            XLSX.writeFile(wb, Fullpath);
          }
        }
        sessionStore.set(req, 'UploadedExcel', null);
        Totalrecord = z - state.TOTALINVALIDRECORDS;
        const efn = sessionStore.get(req, 'ExcelFileName');
        if (efn === undefined || efn === null) throw NRE();
        const now = await scalar(DB, 'SELECT fun_getcurrentdate()');
        await exec(DB, `INSERT INTO tbl_uploadediwalletexcellog (activitybyuser, activitydate, excelfile, status, activitybyuserid, totalrecord, categoryid,
          subcategoryid, totalerrorrecord, maincategorid, requestid) VALUES (@activitybyuser, @activitydate, @excelfile, @status, @activitybyuserid,
          @totalrecord, @categoryid, @subcategoryid, @totalerrorrecord, @maincategorid, @requestid)`, {
          activitybyuser: ActivityByUser, activitydate: now || new Date(), excelfile: String(efn), status: 1, activitybyuserid: String(req.user.did),
          totalrecord: Totalrecord, categoryid, subcategoryid, totalerrorrecord: state.TOTALINVALIDRECORDS, maincategorid: mcid, requestid: requestno,
        });
        sessionStore.set(req, 'Message', 'Successfully performed the operation(s).');
      } else {
        sessionStore.set(req, 'Message', 'No Data Found in the Excel Sheet.');
      }
    }
  } catch (Ex) {
    sessionStore.set(req, 'Message', 'Some error occured while performing the operation(s).' + Ex.message);
    return redirectTo();
  }
  return redirectTo();
}));

module.exports = router;
