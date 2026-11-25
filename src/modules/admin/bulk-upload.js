'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\BulkUpload.cs (class BulkUploadController => /admin/BulkUpload/...)
// Database: affiliate (Db_Affiliate).
// PORT-NOTE: BulkUpload.cs is NOT listed in Common.csproj (<Compile Include>) - it was never compiled into the legacy app (it would not
//   compile: Tbl_UploadedIWalletExcelLog has no Maincategorid/categoryid/Subcategoryid/TotalRecord/TotalerrorRecord/Requestid). Ported anyway.
// PORT-NOTE: Session["Plid"] (Login) is never set in the admin app => the import branch threw NullReferenceException at its first line
//   (caught: TempData["Message"] = "Some error occured ..." + message). Reproduced through sessionStore.get(req,'Plid') (undefined).
const fs = require('fs');
const path = require('path');
const express = require('express');
const multer = require('multer');
const config = require('../../config');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');
const Utility = require('../../lib/admin/Utility');
const { adminAuth } = require('./_shared/admin-session');
const { s, col, str, tdSet, tdPeek, tdGet } = require('./_shared/batch04-a-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'BulkUpload';
const upload = multer({ storage: multer.memoryStorage() });

// static string Fullpath (process-wide like the legacy static field)
let Fullpath = '';

const NRE = () => new Error('Object reference not set to an instance of an object.');
/** DataRow[col] : ArgumentException when the column does not exist */
function cell(row, k) {
  if (!row || !Object.prototype.hasOwnProperty.call(row, k)) throw new Error(`Column '${k}' does not belong to table .`);
  return row[k];
}
/** Convert.ToInt32(object) : DBNull => InvalidCastException ; string => Int32.Parse ; double => banker's rounding */
function cInt(v) {
  if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  if (typeof v === 'number') { const f = Math.floor(v); const d = v - f; return d === 0.5 ? (f % 2 === 0 ? f : f + 1) : Math.round(v); }
  const t = String(v).trim();
  if (!/^[-+]?\d+$/.test(t)) throw new Error('Input string was not in a correct format.');
  return parseInt(t, 10);
}
/** Convert.ToDecimal(object) */
function cDec(v) {
  if (v === null || v === undefined) throw new Error('Object cannot be cast from DBNull to other types.');
  if (typeof v === 'number') return v;
  const t = String(v).trim();
  if (t === '' || Number.isNaN(Number(t))) throw new Error('Input string was not in a correct format.');
  return Number(t);
}
/** Convert.ToString(object) : DBNull => "" */
const cStr = (v) => (v === null || v === undefined ? '' : (v instanceof Date ? v.toISOString() : String(v)));
/** DateTime.Now.Ticks */
const ticks = () => (BigInt(Date.now()) * 10000n + 621355968000000000n).toString();

// ---------------------------------------------------------------- ActionResult Index()
// auth (legacy had no session check; admin product bulk-upload page => protected)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], adminAuth, (req, res) => {
  res.json({ view: '~/Views/BulkUpload/Index.cshtml', TempData: { Message: tdGet(req, 'Message') } });
});

/**
 * public string ApproveReject(...)  (public => also an MVC action in legacy, see the route below)
 * state = { TOTALINVALIDRECORDS, datauploadmessage } (controller instance fields)
 */
async function ApproveReject(req, state, sprid, mprid, CompanyID, CATID, SUBCATID, BRAND, PRCODE, SUBPRCODE, PRODTITLE, SHORTDESC, FULLDESC, SELLMRP,
  DISCOUNTPER, QTY, PRODUNIT, color, size, ProductImage, allAttributes, GSTGroup, DAP, KeyFeatures, StockIn, shippingcharges, CashOnDelivery, YWillRece,
  length, MRP, Weightkg, Length, Breadth, height, requestno, packerdetail, importerdetail, manufacturedetail, hsn, luxurycess, procurementsla1, ddlseller,
  ddlprocurement, Specification) {
  try {
    let StrMessage = '';
    state.datauploadmessage = '';
    const login = sessionStore.get(req, 'Plid'); // ((Login)Session["Plid"]).Plid - never set in admin => NRE
    if (!login) throw NRE();
    const Branchid = login.Plid;
    const row = await db.procOne(DB, 'IMS_USP_CREATEPRODUCT_Temp', {
      SPRID: sprid, MPRID: mprid, BRANCHID: Branchid, COMPANYID: CompanyID, CATID, SUBCATID, BRAND, PRCODE, SUBPRCODE, PRODTITLE,
      ACTIVEFROM: '', ACTIVETO: '', SHORTDESC, FULLDESC, ISALLOWCOUPON: false, MINORDERQTY: 0, MAXORDERQTY: 0, PAYMODE: '',
      SELLMRP: MRP, // legacy passes MRP as @SELLMRP
      DISCOUNTPER, QTY, PRODUNIT, COLOR: color, SIZE: size, PRODIMAGES: ProductImage, ALLATTRIBUTES: allAttributes, VCID: GSTGroup, VATP: 0,
      DIRECTAMT: 0, DAP, REPLACEMENTDAY: 0, KEYFEATURES: KeyFeatures, STOCKIN: StockIn, PROCUREMENTSLA: 0, SHIPPINGCHARGES: shippingcharges,
      CASHONDELIVERY: CashOnDelivery, PKG_WEIGHT_KG: Weightkg, PKG_LENGTH_CMS: Length, PKG_BREADTH_CMS: Breadth, PKG_HEIGHT_CMS: height,
      WARRENTYINFOCARE: 0, DEALSIDS: 0, GROUPID: 0, YWillRece, ismerchantstatus: 0, productentry: requestno, fullfillment: ddlseller,
      procurementtype: ddlprocurement, hsn, luxurycess, manufacturingdetail: manufacturedetail, importerdetail, packerdetail, countryorigin: 96,
      Specification,
    });
    StrMessage = str(col(row, 'strresult'));
    const arr = StrMessage.split('^');
    if (arr[0] !== 'ok') {
      state.TOTALINVALIDRECORDS += 1;
      if (arr.length < 2) throw new Error('Index was outside the bounds of the array.');
      state.datauploadmessage = String(arr[0] + arr[1]);
    }
  } catch (ex) {
    state.TOTALINVALIDRECORDS += 1;
    state.datauploadmessage = (ex.stack || String(ex)) + 'Some error occured while performing the operations.';
    return 'Some error occured while performing the operations.';
  }
  return state.datauploadmessage;
}

/** Microsoft.Office.Interop.Excel: write the row status into sheet "ProductDetails" of Fullpath (cell [J, alllength]). */
async function markExcelRow(J, alllength, Response) {
  // PORT-NOTE: Excel COM interop replaced by exceljs (lazy). exceljs reads/writes .xlsx only; a .xls/.csv Fullpath throws (legacy Excel opened them).
  if (!fs.existsSync(Fullpath)) throw NRE(); // mWorkBook stayed null => mWorkBook.Worksheets NRE
  const ExcelJS = require('exceljs');
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(Fullpath);
  const ws = wb.getWorksheet('ProductDetails');
  if (!ws) throw new Error('Invalid index. (Exception from HRESULT: 0x8002000B (DISP_E_BADINDEX))');
  const c = ws.getCell(J, alllength);
  c.value = Response !== '' ? Response : 'Uploaded';
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFA9A9A9' } }; // Color.DarkGray
  c.font = { ...(c.font || {}), color: { argb: Response !== '' ? 'FFFF0000' : 'FF008000' } }; // Red / Green
  await wb.xlsx.writeFile(Fullpath);
}

// ---------------------------------------------------------------- [HttpPost] ActionResult Upload(HttpPostedFileBase upload, string buttontype)
// auth (legacy had no session check; creates products / writes files => protected)
router.post(`/admin/${C}/Upload{/:id}`, adminAuth, upload.any(), asyncHandler(async (req, res) => {
  const buttontype = s(req.p.buttontype);
  const state = { TOTALINVALIDRECORDS: 0, datauploadmessage: '' };
  const redirect = () => res.json({ redirect: '/BulkUpload/Index', TempData: { Message: tdPeek(req, 'Message') } });
  try {
    const file = (req.files || []).find((f) => f.fieldname === 'FileUpload');
    if (!file) throw NRE(); // Request.Files["FileUpload"].ContentLength
    if (file.size > 0) {
      const randomNumber = ticks();
      const FileExtension = path.extname(file.originalname).toLowerCase();
      let ConnString = '';
      const validFileTypes = ['.xls', '.xlsx', '.csv'];
      const dir = path.join(config.uploadDir, 'Content', 'Uploads');
      const PathForFile = path.join(dir, path.basename(file.originalname, path.extname(file.originalname)) + '_' + randomNumber + FileExtension);
      tdSet(req, 'Excelut', PathForFile);
      if (!fs.existsSync(PathForFile)) fs.mkdirSync(dir, { recursive: true });
      if (validFileTypes.includes(FileExtension)) {
        let DtObjForFileUpload = [];
        const ViewBag = {};
        if (fs.existsSync(PathForFile)) fs.unlinkSync(PathForFile);
        fs.writeFileSync(PathForFile, file.buffer);
        if (FileExtension === '.csv') {
          DtObjForFileUpload = await Utility.ConvertCSVtoDataTable(PathForFile);
          ViewBag.Data = DtObjForFileUpload;
        } else if (FileExtension.trim() === '.xlsx' || FileExtension.trim() === '.xls') {
          ConnString = 'Provider=Microsoft.ACE.OLEDB.12.0;Data Source=' + PathForFile + ';Extended Properties="Excel 12.0;HDR=NO;IMEX=1"';
          DtObjForFileUpload = await Utility.ConvertXSLXtoDataTable(PathForFile, ConnString);
          ViewBag.Data = DtObjForFileUpload;
        }
        tdSet(req, 'ExcelFileName', path.basename(file.originalname, path.extname(file.originalname)) + '_' + randomNumber + FileExtension);
        if (buttontype === null) throw NRE(); // buttontype.ToLower()
        if (buttontype.toLowerCase() === 'upload') {
          tdSet(req, 'UploadedExcel', DtObjForFileUpload);
          return res.json({ view: '~/Views/BulkUpload/Index.cshtml', Model: DtObjForFileUpload, ...ViewBag });
        }
      } else {
        tdSet(req, 'Message', 'Please Upload Files in .xls, .xlsx or .csv format');
      }
    } else if (tdPeek(req, 'UploadedExcel') !== null) {
      // PORT-NOTE: legacy branch is only reached with an empty FileUpload part (ContentLength == 0).
      const login = sessionStore.get(req, 'Plid'); // ((Login)Session["Plid"]) - never set in admin => NRE (caught below)
      if (!login) throw NRE();
      const ActivityByUser = login.Plid + ' ' + '(' + login.UserName + ')';
      let categoryid = 0; let subcategoryid = 0; let Totalrecord = 0; let mcid = 0;
      const DtExcel = tdGet(req, 'UploadedExcel');
      const requestid = String(Math.floor(Math.random() * 999999)).padStart(6, '0'); // generator.Next(0, 999999).ToString("D6")
      const requestno = 'REQ' + requestid;
      Fullpath = cStr(tdGet(req, 'Excelut'));
      if (DtExcel.length > 0) {
        const z = DtExcel.length - 1;
        const columns = Object.keys(DtExcel[0]);
        for (let i = 1; i < DtExcel.length; i++) {
          const sprid = 0; const mprid = 0;
          let KeyFeturesvalue = [];
          let CATID = 0; let SUBCATID = 0; let GSTGroup = 0; let QTY = 0; let StockIn = 0; let CashOnDelivery = 0; let start = 33; let alllength = 0;
          let ddlseller = 0; let ddlprocurement = 0;
          const CompanyID = 0; const BRAND = 0;
          const PRCODE = ''; const color = ''; const size = '';
          let SUBPRCODE = ''; let PRODTITLE = ''; let SHORTDESC = ''; let FULLDESC = ''; let PRODUNIT = ''; let GSTgroupname = '';
          let ProductImage = ''; let allAttributes = ''; let KeyFeatures = ''; let AllKeydata = ''; let CODelivery = ''; let packerdetail = ''; let ddlseller1 = '';
          let importerdetail = ''; let manufacturedetail = ''; let hsn = ''; let procurementsla1 = ''; let ddlprocurement1 = ''; let Specification = '';
          let SELLMRP = 0; let DISCOUNTPER = 0; let shippingcharges = 0; let MRP = 0; let Admincharge = 0; let deleverycharge = 0; let handlingcharge = 0;
          let Fixedcharge = 0; let admindiscountamt = 0; let YWillRece = 0; const length = 0; let DAP = 0; let Weightkg = 0; let Length = 0; let Breadth = 0;
          let height = 0; let luxurycess = 0;
          const r = DtExcel[i];
          for (let k = 0; k < columns.length; k++) {
            if (cStr(DtExcel[0][columns[k]]) !== '') alllength++;
          }
          mcid = cInt(cell(r, 'F2'));
          CATID = cInt(cell(r, 'F3'));
          SUBCATID = cInt(cell(r, 'F4'));
          categoryid = CATID;
          subcategoryid = SUBCATID;
          // select AdminCharge,DelieveryCharge,HandlingCharge,FixedFee from TBL_SUB_CATEGORY where SUBCATID=<SUBCATID> and status=1
          const crow = await db.query(DB, 'select admincharge, delieverycharge, handlingcharge, fixedfee from tbl_sub_category where subcatid = @SUBCATID and status = 1', { SUBCATID });
          if (crow.length > 0) {
            Admincharge = cDec(str(col(crow[0], 'admincharge')));
            deleverycharge = cDec(str(col(crow[0], 'delieverycharge')));
            handlingcharge = cDec(str(col(crow[0], 'handlingcharge')));
            Fixedcharge = cDec(str(col(crow[0], 'fixedfee')));
          }
          GSTgroupname = cStr(cell(r, 'F5'));
          if (GSTgroupname !== '') {
            // Select isnull(VCID,0) from tbl_Vat_Categories where VatTitle='<GSTgroupname>'  (FirstOrDefault => 0)
            const g = await db.scalar(DB, 'select coalesce(vcid, 0) from tbl_vat_categories where vattitle = @GSTgroupname limit 1', { GSTgroupname });
            GSTGroup = g === null || g === undefined ? 0 : Number(g);
          }
          SUBPRCODE = cStr(cell(r, 'F6'));
          PRODTITLE = cStr(cell(r, 'F7'));
          MRP = cDec(cell(r, 'F8'));
          DISCOUNTPER = cDec(cell(r, 'F9'));
          SELLMRP = (MRP * DISCOUNTPER) / 100;
          DAP = MRP - SELLMRP;
          admindiscountamt = (DAP * Admincharge) / 100;
          YWillRece = (DAP - admindiscountamt - deleverycharge - handlingcharge - Fixedcharge);
          QTY = cInt(cell(r, 'F12'));
          StockIn = cInt(cell(r, 'F12'));
          ProductImage = cStr(cell(r, 'F13'));
          shippingcharges = cDec(cell(r, 'F14'));
          CODelivery = cStr(cell(r, 'F15'));
          CashOnDelivery = CODelivery === 'Available' ? 1 : 0;
          SHORTDESC = cStr(cell(r, 'F16'));
          AllKeydata = cStr(cell(r, 'F17'));
          KeyFeturesvalue = AllKeydata.split('^');
          for (let k = 0; k < KeyFeturesvalue.length; k++) KeyFeatures += '<li>' + KeyFeturesvalue[k] + '</li>';
          KeyFeatures = '<ul>' + KeyFeatures + '</ul>';
          FULLDESC = cStr(cell(r, 'F18'));
          PRODUNIT = cStr(cell(r, 'F19'));
          Weightkg = cDec(cell(r, 'F20'));
          Length = cDec(cell(r, 'F21'));
          Breadth = cDec(cell(r, 'F22'));
          height = cDec(cell(r, 'F23'));
          manufacturedetail = cStr(cell(r, 'F24'));
          importerdetail = cStr(cell(r, 'F25'));
          packerdetail = cStr(cell(r, 'F26'));
          hsn = cStr(cell(r, 'F27'));
          luxurycess = cDec(cell(r, 'F28'));
          ddlseller1 = cStr(cell(r, 'F29'));
          if (ddlseller1 === '' || ddlseller1 === 'Seller') ddlseller = 1;
          ddlprocurement1 = cStr(cell(r, 'F30'));
          if (ddlprocurement1 === '' || ddlprocurement1 === 'Instock') ddlprocurement = 1;
          procurementsla1 = cStr(cell(r, 'F31'));
          Specification = cStr(cell(r, 'F32'));
          if (start <= alllength - 1) {
            while (start <= alllength - 1) {
              allAttributes = allAttributes + '^' + cStr(cell(DtExcel[0], 'F' + start)) + '~' + cStr(cell(r, 'F' + start));
              start++;
            }
            allAttributes = allAttributes.substring(1);
          }
          await ApproveReject(req, state, sprid, mprid, CompanyID, CATID, SUBCATID, BRAND, PRCODE, SUBPRCODE, PRODTITLE, SHORTDESC, FULLDESC, SELLMRP,
            DISCOUNTPER, QTY, PRODUNIT, color, size, ProductImage, allAttributes, GSTGroup, DAP, KeyFeatures, StockIn, shippingcharges, CashOnDelivery,
            YWillRece, length, MRP, Weightkg, Length, Breadth, height, requestno, packerdetail, importerdetail, manufacturedetail, hsn, luxurycess,
            procurementsla1, ddlseller, ddlprocurement, Specification);
          const Response = state.datauploadmessage;
          await markExcelRow(i + 2, alllength, Response);
        }
        tdSet(req, 'UploadedExcel', null);
        Totalrecord = z - state.TOTALINVALIDRECORDS;
        // Tbl_UploadedIWalletExcelLog insert (EF Add + SaveChanges)
        const ActivityDate = await db.scalar(DB, 'select fun_getcurrentdate()', {});
        const ExcelFileName = tdGet(req, 'ExcelFileName');
        if (ExcelFileName === null) throw NRE(); // TempData["ExcelFileName"].ToString()
        await db.exec(DB, `insert into tbl_uploadediwalletexcellog
            (activitybyuser, activitydate, excelfile, status, activitybyuserid, maincategorid, categoryid, subcategoryid, totalrecord, totalerrorrecord, requestid)
          values (@ActivityByUser, @ActivityDate, @ExcelFile, 1, @ActivityByUserId, @mcid, @categoryid, @subcategoryid, @Totalrecord, @TOTALINVALIDRECORDS, @requestno)`, {
          ActivityByUser, ActivityDate, ExcelFile: String(ExcelFileName), ActivityByUserId: String(login.Plid), mcid, categoryid, subcategoryid, Totalrecord,
          TOTALINVALIDRECORDS: state.TOTALINVALIDRECORDS, requestno,
        });
        tdSet(req, 'Message', 'Successfully performed the operation(s).');
      } else {
        tdSet(req, 'Message', 'No Data Found in the Excel Sheet.');
      }
    }
  } catch (Ex) {
    tdSet(req, 'Message', 'Some error occured while performing the operation(s).' + Ex.message);
    return redirect();
  }
  return redirect();
}));

// ---------------------------------------------------------------- public string ApproveReject(...)  (public method => MVC action in legacy)
// auth (creates a product)
router.all(`/admin/${C}/ApproveReject{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const p = req.p;
  const num = (v) => (v === undefined || v === null || v === '' ? NaN : Number(v));
  const need = ['sprid', 'mprid', 'CompanyID', 'CATID', 'SUBCATID', 'BRAND', 'SELLMRP', 'DISCOUNTPER', 'QTY', 'GSTGroup', 'DAP', 'StockIn', 'shippingcharges',
    'CashOnDelivery', 'YWillRece', 'length', 'MRP', 'Weightkg', 'Length', 'Breadth', 'height', 'luxurycess', 'ddlseller', 'ddlprocurement'];
  for (const k of need) {
    if (Number.isNaN(num(p[k]))) {
      const e = new Error(`The parameters dictionary contains a null entry for parameter '${k}' of non-nullable type.`);
      e.status = 500; throw e;
    }
  }
  const state = { TOTALINVALIDRECORDS: 0, datauploadmessage: '' };
  const r = await ApproveReject(req, state, num(p.sprid), num(p.mprid), num(p.CompanyID), num(p.CATID), num(p.SUBCATID), num(p.BRAND), s(p.PRCODE),
    s(p.SUBPRCODE), s(p.PRODTITLE), s(p.SHORTDESC), s(p.FULLDESC), num(p.SELLMRP), num(p.DISCOUNTPER), num(p.QTY), s(p.PRODUNIT), s(p.color), s(p.size),
    s(p.ProductImage), s(p.allAttributes), num(p.GSTGroup), num(p.DAP), s(p.KeyFeatures), num(p.StockIn), num(p.shippingcharges), num(p.CashOnDelivery),
    num(p.YWillRece), num(p.length), num(p.MRP), num(p.Weightkg), num(p.Length), num(p.Breadth), num(p.height), s(p.requestno), s(p.packerdetail),
    s(p.importerdetail), s(p.manufacturedetail), s(p.hsn), num(p.luxurycess), s(p.procurementsla1), num(p.ddlseller), num(p.ddlprocurement), s(p.Specification));
  res.type('text/html').send(r === null || r === undefined ? '' : String(r)); // string action result => Content(text)
}));

module.exports = router;
