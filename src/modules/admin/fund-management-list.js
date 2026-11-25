'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Fund_Management_list.cs (class Fund_Management_listController => /Fund_Management_list/...)
// Database: affiliate (Db_Affiliate).
const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('../../config');
const db = require('../../db');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { adminAuth, isAdmin, legacyUrl, errorInsert } = require('./_shared/admin-session');
const B = require('./_shared/batch07-common');
const D = require('./_shared/batch07-d-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'Fund_Management_list';

// PORT-NOTE: `private static string url, url1` - static fields shared by all requests (ExportReport uses the url of the last Index call).
let url = '';
let url1 = '';

/** AMTTOTAL OUT declared as SqlDbType.Int (decimal proc param) => integer value; "" => 0 */
function amtTotalInt(rows) {
  const s = B.str(rows && rows.length ? B.col(rows[0], 'AMTTOTAL') : null);
  if (s === '') return 0;
  const n = Number(s);
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return Math.trunc(n);
}

/** [USP_FUND_TRANSFER] mode 2 list call of Index / ExportReport (null values => SqlParameter not sent => proc default) */
async function fundTransferList(o) {
  // @MODE,@REGNO,@BYUSERREGNO,@TYPE,@AMOUNT,@REMARK,@STRRESULT OUT,@TOTALCOUNT OUT,@FROMDATE,@TODATE,@STARTROWINDEX,@MAXROWS,@TFHID,@EMAILID,
  // @MINAMOUNT,@MAXAMOUNT,@ISVERIFIEDBYADMIN,@ORDERBYFIELD,@PaymentMode,@TransactionId,'',0,'',0,@DATE,@APROVETRANSACTIONID,@AMTTOTAL OUT,@EID,
  // @orderbydate,@SessionID,@REFERENCE_N0,@selectvalue   (CommandTimeout 1000)
  const p = {
    MODE: 2, REGNO: '0', BYUSERREGNO: '0', TYPE: 'Cr', AMOUNT: '0', REMARK: o.Username, FROMDATE: o.fromdate, TODATE: o.todate,
    STARTROWINDEX: o.page, MAXROWS: o.MaxRows, TFHID: 0, EMAILID: o.Mobile, MINAMOUNT: o.minamount, MAXAMOUNT: o.maxamount,
    ISVERIFIEDBYADMIN: o.IsVerifiedByAdmin, ORDERBYFIELD: o.OrderBy, PAYMENTMODE: o.Paymentmode, TransactionId: o.TransactionId,
    ACTIVITYBYUSER: '', ACTIVITY_BY_EMP_ID: 0, TXID: '', AmountBTC: 0, DATE: '', APROVETRANSACTIONID: '', EID: o.EID,
    orderbydate: o.orderbydate, SessionID: '0', REFERENCE_N0: o.REFERENCENUMBER, selectvalue: o.selectvalue,
  };
  for (const k of Object.keys(p)) if (p[k] === null || p[k] === undefined) delete p[k];
  return db.proc(DB, 'USP_FUND_TRANSFER', p);
}

/**
 * public void ExportReport(int? page, string fromdate, int? Paymentmode, string todate, string OrderBy, string Username, string Mobile,
 *   string minamount, string Mode, string maxamount, string IsVerifiedByAdmin, string ModeOpen, string TransactionId, string orderbydate,
 *   string REFERENCENUMBER, string selectvalue)
 * Returns { sent } (sent => the file was written to res, like the legacy Response.Redirect to ~/AllExcelSheets/Ewallet_Request_List.xls).
 */
async function ExportReport(req, res, a, ViewBag) {
  const userid = req.user.emp_id;
  const Filename = `Ewallet_Request_List${userid}_${B.nowStamp()}`;
  await B.excelHistory(userid, url, Filename); // [USP_EXCEL_DOWNLOAD_HISTORY] @ID,@DOWNLOADEDFROM,@FILENAME,@MODE='1',@STRRESULT OUT
  const MaxRows = 100;
  const rows = await fundTransferList({ ...a, MaxRows, EID: userid });
  const LiUserWiseIWalletStatementsController_Report = mapRows(rows, D.FUND_MANAGEMENT_LIST_PROPS);
  const TotalRecord = D.totalCountOf(rows, 'TotalCount', true); // Convert.ToInt32(TotalCount.Value.ToString()) (unused afterwards)
  void TotalRecord;
  const Totalamt = amtTotalInt(rows);
  if (LiUserWiseIWalletStatementsController_Report.length > 0) {
    ViewBag.CurrentPage = a.page;
    ViewBag.GridPageSize = MaxRows;
    try {
      const dir = path.join(config.uploadDir, 'AllExcelSheets');
      fs.mkdirSync(dir, { recursive: true });
      const filepath = path.join(dir, 'Ewallet_Request_List.xls');
      ViewBag.filepath = filepath;
      if (fs.existsSync(filepath)) fs.unlinkSync(filepath);
      let out = '';
      let closed = false;
      const w = (x) => { if (closed) throw new Error('Cannot write to a closed TextWriter.'); out += x; };
      for (const h of ['S.No.', 'Date', 'Username', 'Mobile No', 'Amount', 'ReferenceNo', 'transaction Id', 'PaymentMode', 'Status', 'ActionBy']) w(`${h} \t`);
      for (const item of LiUserWiseIWalletStatementsController_Report) {
        try {
          w('\n');
          w(`${B.tab(B.cellStr(item, 'RowNumber'))} \t`);
          w(`${B.tab(B.cellStr(item, 'Date'))} \t`);
          const name = B.cellStr(item, 'Username');
          w(`${B.tab(name.split(' ').join(''))} \t`);
          w(`${B.tab(B.cellStr(item, 'Mobile'))} \t`);
          w(`${B.tab(B.dec2(item.Amount))} \t`);
          w(`${B.tab(B.cellStr(item, 'ReferenceNumber'))} \t`);
          w(`${B.tab(B.cellStr(item, 'TransactionId'))} \t`);
          const PaymentModeName = B.cellStr(item, 'PaymentModeName');
          w(`${B.tab(PaymentModeName.split(' ').join(''))} \t`);
          const iv = Number(item.IsVerifiedByAdmin);
          w(`${B.tab(iv === 2 ? 'Rejected' : (iv === 0 ? (Number(item.GeneratedBy) === 1 ? 'Credited' : 'Pending') : 'Approved'))} \t`);
          const ActivityByUserId = B.cellStr(item, 'ActivityByUserId');
          w(`${B.tab(ActivityByUserId.split(' ').join(''))} \t`);
        } catch (ExpObj) {
          await errorInsert(req, ExpObj, 'USP_FUND_TRANSFER');
          closed = true; // wr.Close()
        }
      }
      w('\n');
      w(`${B.tab('')} \t`);
      w(`${B.tab('')} \t`);
      w(`${B.tab('TotalAmount:')} \t`);
      w(`${B.tab(Totalamt.toFixed(2))} \t`);
      fs.writeFileSync(filepath, out); // wr.Close()
      const dl = path.join(config.uploadDir, 'DownloadedExcel');
      fs.mkdirSync(dl, { recursive: true });
      const filepath1 = path.join(dl, `${Filename}.xls`);
      if (fs.existsSync(filepath1)) fs.unlinkSync(filepath1);
      // PORT-NOTE: legacy Response.Redirect("~/AllExcelSheets/Ewallet_Request_List.xls") aborted the thread before File.Copy(filepath, filepath1),
      // so the DownloadedExcel copy never happened; the file content is sent directly.
      res.set('Content-Type', 'application/force-download');
      res.set('Content-Disposition', 'attachment; filename=Ewallet_Request_List.xls');
      res.send(out);
      return { sent: true };
    } catch (ExpObj) {
      if (res.headersSent) return { sent: true };
      await errorInsert(req, ExpObj, 'LiUserWiseIWalletStatementsController_Report');
      ViewBag.filepath = ExpObj.message;
    }
  }
  return { sent: false };
}

// ---------------------------------------------------------------- [SessionExpireCheck] ActionResult Index(int? dynamicpagging, string orderbydate, int? page, string fromdate, int? Paymentmode, string DownloadProcessedExcel, string todate, string OrderBy, string Username, string Mobile, string minamount, string Mode, string maxamount, string IsVerifiedByAdmin, string ModeOpen, string DownloadProcessedExcelOpen, string TransactionId, string REFERENCENUMBER, string selectvalue, int? type)
// auth ([SessionExpireCheck])
// route-config: "AdminPanel/Ewallet-Request-List" -> Fund_Management_list/Index
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`, '/admin/AdminPanel/Ewallet-Request-List'], adminAuth, asyncHandler(async (req, res) => {
  let dynamicpagging = B.nInt(req.p.dynamicpagging);
  let orderbydate = B.nStr(req.p.orderbydate);
  let page = B.nInt(req.p.page);
  let fromdate = B.nStr(req.p.fromdate);
  let Paymentmode = B.nInt(req.p.Paymentmode);
  let DownloadProcessedExcel = B.nStr(req.p.DownloadProcessedExcel);
  let todate = B.nStr(req.p.todate);
  let OrderBy = B.nStr(req.p.OrderBy);
  let Username = B.nStr(req.p.Username);
  let Mobile = B.nStr(req.p.Mobile);
  let minamount = B.nStr(req.p.minamount);
  let Mode = B.nStr(req.p.Mode);
  let maxamount = B.nStr(req.p.maxamount);
  let IsVerifiedByAdmin = B.nStr(req.p.IsVerifiedByAdmin);
  let ModeOpen = B.nStr(req.p.ModeOpen);
  let DownloadProcessedExcelOpen = B.nStr(req.p.DownloadProcessedExcelOpen);
  let TransactionId = B.nStr(req.p.TransactionId);
  let REFERENCENUMBER = B.nStr(req.p.REFERENCENUMBER);
  let selectvalue = B.nStr(req.p.selectvalue);
  const type = B.nInt(req.p.type);

  url1 = legacyUrl(req).slice(1);
  url = `~${url1}`;
  if (OrderBy === null) OrderBy = '';
  if (Paymentmode === null) Paymentmode = 0;
  if (TransactionId === null || TransactionId === '') TransactionId = '0';
  if (REFERENCENUMBER === null || REFERENCENUMBER === '') REFERENCENUMBER = '0';
  if (dynamicpagging === null) dynamicpagging = 100;
  if (orderbydate === null) orderbydate = '';
  if (Mobile === null) Mobile = '';
  if (DownloadProcessedExcel === null) DownloadProcessedExcel = '';
  if (DownloadProcessedExcelOpen === null) DownloadProcessedExcelOpen = '';
  if (Mode === null) Mode = '';
  if (ModeOpen === null) ModeOpen = '';
  if (IsVerifiedByAdmin === null) IsVerifiedByAdmin = '-1';
  if (maxamount === null) maxamount = '0';
  if (maxamount === '') maxamount = '0';
  if (minamount === '') minamount = '0';
  if (minamount === null) minamount = '0';
  if (fromdate === null) fromdate = '';
  if (todate === null) todate = '';
  if (Username === null) Username = '';
  if (selectvalue === null) selectvalue = '';
  if (type === 1) {
    fromdate = await UtilityClass.Decryptword(fromdate);
    todate = await UtilityClass.Decryptword(todate);
  }
  if (type === 2) {
    selectvalue = 'UserName';
    Username = await UtilityClass.Decryptword(Username);
  }
  const MaxRows = Number(dynamicpagging);
  if (page === null) page = 1;

  const Empid = req.user.emp_id;
  const ViewBag = {};
  const perm = await B.perms(Empid, url); // CheckPermissions.GetPageActionPermission + GetExcelPermission
  ViewBag.isactive = perm.isactive;
  ViewBag.isedit = perm.isedit;
  ViewBag.excelactive = perm.excelactive;

  const args = {
    page, fromdate, Paymentmode, todate, OrderBy, Username, Mobile, minamount, Mode, maxamount, IsVerifiedByAdmin, ModeOpen, TransactionId,
    orderbydate, REFERENCENUMBER, selectvalue,
  };
  const rows = await fundTransferList({ ...args, MaxRows, EID: Empid });
  const Obj = mapRows(rows, D.FUND_MANAGEMENT_LIST_PROPS);
  const TotalRecord = D.totalCountOf(rows, 'TotalCount', false);
  const Totalamt = 0; // legacy: decimal Totalamt = 0; (AMTTOTAL read commented out)
  ViewBag.CurrentPage = page; ViewBag.dynamicpagging = dynamicpagging;
  ViewBag.orderbydate = orderbydate;
  ViewBag.GridPageSize = MaxRows;
  ViewBag.TotalRecord = TotalRecord;
  ViewBag.Totalamount = Totalamt;
  ViewBag.Paymentmode = Paymentmode;
  ViewBag.OrderBy = OrderBy;
  ViewBag.Username = Username;
  ViewBag.Mobile = Mobile;
  ViewBag.minamount = minamount === '0' ? '' : minamount;
  ViewBag.maxamount = maxamount === '0' ? '' : maxamount;
  ViewBag.IsVerifiedByAdmin = IsVerifiedByAdmin;
  ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();
  ViewBag.fromDate = fromdate;
  ViewBag.toDate = todate;
  if (DownloadProcessedExcelOpen === 'Export Excel') {
    const r = await ExportReport(req, res, args, ViewBag);
    if (r.sent) return undefined;
  }
  return res.json({ view: '~/Views/AdminPanel/Fund_Management_list/Index.cshtml', Model: Obj, ...ViewBag });
}));

// ---------------------------------------------------------------- public void ExportReport(...)
// auth (public method => routable in legacy; reads Session["Admin_User"])
router.all(`/admin/${C}/ExportReport{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  const s = (k) => B.nStr(req.p[k]);
  const args = {
    page: B.nInt(req.p.page), fromdate: s('fromdate'), Paymentmode: B.nInt(req.p.Paymentmode), todate: s('todate'), OrderBy: s('OrderBy'),
    Username: s('Username'), Mobile: s('Mobile'), minamount: s('minamount'), Mode: s('Mode'), maxamount: s('maxamount'),
    IsVerifiedByAdmin: s('IsVerifiedByAdmin'), ModeOpen: s('ModeOpen'), TransactionId: s('TransactionId'), orderbydate: s('orderbydate'),
    REFERENCENUMBER: s('REFERENCENUMBER'), selectvalue: s('selectvalue'),
  };
  const r = await ExportReport(req, res, args, {});
  if (!r.sent) res.send(''); // void action => empty response
}));

// ---------------------------------------------------------------- JsonResult AddFunds(string Username, decimal Amount, long Id, string Remark, string GAKEY)
// auth-by-check (legacy: Session null => Response.Redirect("/"))
router.all(`/admin/${C}/AddFunds{/:id}`, optionalAuth, asyncHandler(async (req, res) => {
  const Amount = B.reqDec(req.p.Amount, 'Amount');
  const Id = D.reqLong(req.p.Id, 'Id');
  const Username = B.nStr(req.p.Username);
  const Remark = B.nStr(req.p.Remark);
  const GAKEY = B.nStr(req.p.GAKEY);
  if (!isAdmin(req)) return res.json({ redirect: '/' });
  const EmpId = req.user.emp_id;
  let ret = '';
  if (Username === '') return res.json('Error^Username cannot be left blank.');
  if (Amount <= 0) return res.json('Error^Amount should be a non negative number.');
  if (Id <= 0) return res.json('Error^Some error occured.Try typing username again.');
  const ga = await D.gaCheck(EmpId, GAKEY, 3); // Get_Security_Key nested 3 times in legacy
  if (ga) return res.json(ga);
  // [Usp_Fund_Transfer] @Mode,@RegNo,@ByUserRegNo,@Type,@Amount,@Remark,@StrResult OUT,@TotalCount OUT,@FromDate,@ToDate,@StartRowIndex,@MaxRows
  const row = await db.procOne(DB, 'Usp_Fund_Transfer', {
    Mode: '1', RegNo: Id, ByUserRegNo: '0', Type: 'Cr', Amount, Remark, FromDate: '', ToDate: '', StartRowIndex: '1', MaxRows: '100',
  });
  ret = B.outStr(row, 'StrResult');
  return res.json(ret);
}));

// ---------------------------------------------------------------- JsonResult ApproveReject(string GAKEY, long RegNo, long ID, string mode, string Remarks, string Date, string Approvetransactionid)
// auth-by-check (legacy: Session null => Response.Redirect("/"))
router.all(`/admin/${C}/ApproveReject{/:id}`, optionalAuth, asyncHandler(D.approveReject));

// ---------------------------------------------------------------- JsonResult GetUsernameAndEmail(string memberid)
// auth (PORT-NOTE: legacy had no session check; returns member e-mail => protected)
router.all(`/admin/${C}/GetUsernameAndEmail{/:id}`, adminAuth, asyncHandler(async (req, res) => {
  res.json(await D.getUsernameAndEmail(req, B.nStr(req.p.memberid), false));
}));

module.exports = router;
