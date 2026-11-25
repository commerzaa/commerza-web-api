'use strict';
/**
 * Helpers private to admin port batch07 part D (Fund_Management.cs, Fund_Management_list.cs, Fund_Recieve_From_Agency.cs).
 * Not a router (lives in _shared/ so src/modules/admin.js does not mount it).
 * Exports: FUND_MANAGEMENT_LIST1_PROPS, FUND_MANAGEMENT_LIST_PROPS, STOCK_DETAILS_PROPS, gaCheck(empId, GAKEY, repeat),
 *          memberByUserName(Username), smsAction(id), emailAction(eid), need(obj), fireSms(...), fireEmail(...),
 *          totalCountOf(rows, name, strict), decStr(v), reqLong(v, name), getUsernameAndEmail(req, memberid, withWallets),
 *          approveReject(req, res)
 */
const db = require('../../../db');
const { mapRow } = require('../../../utils/shape');
const UtilityClass = require('../../../lib/admin/UtilityClass');
const Admin_Security_Key = require('../../../lib/admin/Admin_Security_Key');
const { errorInsert, isAdmin } = require('./admin-session');
const { col, str, nullRef, nInt, nStr } = require('./batch07-common');

const DB = 'affiliate';

/** class Fund_ManagementList1 (Fund_Management.cs) */
const FUND_MANAGEMENT_LIST1_PROPS = ['RowNumber', 'TFHID', 'RegNo', 'Mobile', 'Type', 'Amount', 'Date', 'ByUser', 'Remark', 'Status',
  'Username', 'EmailId', 'FullName', 'ByUserFullName', 'ByUsername', 'GeneratedBy', 'PaymentModeName', 'ChallanImage', 'BankName',
  'BranchName', 'ReferenceNumber', 'ReferenceDate', 'RemarkByMember', 'ApprovedOnDate', 'IsVerifiedByAdmin', 'ActivityByUserId',
  'IFSCCode', 'TransactionId', 'BTCADDRESS', 'PAYMENTMODE'];
/** class Fund_ManagementList (Fund_Management_list.cs) */
const FUND_MANAGEMENT_LIST_PROPS = [...FUND_MANAGEMENT_LIST1_PROPS, 'ANO', 'BK', 'PaymentStatus'];
/** class StockDetails (ManageStock.cs) */
const STOCK_DETAILS_PROPS = ['RowNumber', 'TKPMID', 'PLID', 'FRID', 'PRODUCTLIST', 'INSTOCK', 'OUTSTOCK', 'AVAILABLE', 'Username', 'EMAILID',
  'MRP', 'COUNTRY', 'STATE', 'ADDRESS', 'CITY', 'PINCODE', 'Prname', 'Code', 'Name', 'PRcode', 'TKPID', 'TransferStock', 'ATTRIBUTE'];

/**
 * "Authencation for google" block of AddFunds / ApproveReject.
 * repeat = number of nested Get_Security_Key(...) calls before Get_GA_Key (AddFunds: 3, ApproveReject: 1).
 * Returns the legacy error string or null.
 */
async function gaCheck(empId, GAKEY, repeat = 1) {
  let IsGoogleAuthenticated = '';
  const gaObj = await new Admin_Security_Key().Get_Security_Key(empId);
  if (gaObj !== null && gaObj !== undefined) {
    IsGoogleAuthenticated = '1';
    if (GAKEY === '') return 'Error^Enter your GA Key.'; // PORT-NOTE: MVC binds "" as null, so (like legacy) this rarely fires
  } else {
    IsGoogleAuthenticated = '0';
  }
  if (IsGoogleAuthenticated !== '0') {
    let objs = new Admin_Security_Key();
    for (let i = 0; i < repeat; i += 1) {
      objs = await objs.Get_Security_Key(empId);
      if (objs === null || objs === undefined) return null;
    }
    const ValidRandomNo = await objs.Get_GA_Key(empId);
    if (!(await objs.Check_GaKeyForEnableTime(empId, ValidRandomNo, GAKEY))) {
      if (GAKEY !== '') return 'Error^Invalid GA Key. Please enter a valid GA Key.';
    }
  }
  return null;
}

/** Db._Member_Master.Where(a => a.userName == Username).FirstOrDefault() */
async function memberByUserName(Username) {
  const r = await db.queryOne(DB, 'select * from member_master where username = @Username limit 1', { Username });
  return r ? mapRow(r, ['regNo', 'userName', 'Emailid', 'mobile', 'FName', 'MName', 'LName', 'LoginId']) : null;
}
/** Db._TBL_SMSACTION.Where(a => a.ID == id).FirstOrDefault() */
async function smsAction(id) {
  const r = await db.queryOne(DB, 'select * from tbl_smsaction where id = @id limit 1', { id });
  return r ? mapRow(r, ['ID', 'ModuleId', 'Action_Name', 'Sms_Content', 'Action_Status', 'Sms_Send_Status', 'SMSCategory']) : null;
}
/** Db._tbl_emailaction.Where(a => a.EID == eid).FirstOrDefault() */
async function emailAction(eid) {
  const r = await db.queryOne(DB, 'select * from tbl_emailaction where eid = @eid limit 1', { eid });
  return r ? mapRow(r, ['EID', 'Action_Name', 'Email_Content', 'Email_Send_Status', 'Email_Subject']) : null;
}
/** member access on a possibly-null EF entity => NullReferenceException like the legacy code */
function need(obj) {
  if (obj === null || obj === undefined) throw nullRef();
  return obj;
}
/** new Thread(() => UtilityClass.SendSMSWithAPI(MemberDetails.mobile, Frommessg, "1")).Start() (only for SMSCategory "Transfer" + status 1) */
function fireSms(Frommsg, MemberDetails, Frommessg) {
  if (need(Frommsg).SMSCategory === 'Transfer') {
    if (Number(Frommsg.Sms_Send_Status) === 1) {
      Promise.resolve()
        .then(() => UtilityClass.SendSMSWithAPI(need(MemberDetails).mobile, Frommessg, '1'))
        .catch((e) => console.error('[admin] SendSMSWithAPI thread failed:', e.message));
    }
  }
}
/** new Thread(() => UtilityClass.SendEmailByApiSetting(userName,"","","","","",Emailid.ToLower(),Subject,msg,null)).Start() (status 1) */
function fireEmail(emailmsg, MemberDetails, DynamicMsg) {
  if (Number(need(emailmsg).Email_Send_Status) === 1) {
    const fileUploader = null;
    Promise.resolve()
      .then(() => {
        const m = need(MemberDetails);
        return UtilityClass.SendEmailByApiSetting(m.userName, '', '', '', '', '', String(need(m.Emailid)).toLowerCase(), emailmsg.Email_Subject, DynamicMsg, fileUploader);
      })
      .catch((e) => console.error('[admin] SendEmailByApiSetting thread failed:', e.message));
  }
}

/**
 * OUT parameter of a row-returning proc (the PostgreSQL port returns it as a column of every row).
 * strict: Convert.ToInt32(X.Value.ToString()) (DBNull => FormatException); otherwise "" => "0".
 * PORT-NOTE: with zero rows the OUT value is not observable in the PostgreSQL port => treated as DBNull.
 */
function totalCountOf(rows, name, strict) {
  const s = str(rows && rows.length ? col(rows[0], name) : null);
  if (s === '') {
    if (strict) throw new Error('Input string was not in a correct format.');
    return 0;
  }
  const n = parseInt(s, 10);
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
}

/** decimal.ToString() (keeps the column scale; pg numeric arrives as string) */
const decStr = (v) => (v === null || v === undefined ? '' : String(v));

/** non-nullable long action parameter: missing => ArgumentException (500) like MVC */
function reqLong(v, name) {
  const n = nInt(v);
  if (n === null) {
    const e = new Error(`The parameters dictionary contains a null entry for parameter '${name}' of non-nullable type 'System.Int64'`);
    e.status = 500;
    throw e;
  }
  return n;
}

/**
 * GetUsernameAndEmail(string memberid) of Fund_Management / Fund_Management_list (DataUtility.GetDataReader, string-concatenated
 * SQL in legacy => parameterised here). withWallets: Fund_Management variant (joins Member_Performance, 6 fields).
 */
async function getUsernameAndEmail(req, memberid, withWallets) {
  let getval = 'Invalid';
  try {
    const sql = withWallets
      ? `select mm.regno, coalesce(mm.fname,'') || ' ' || coalesce(mm.mname,'') || ' ' || coalesce(mm.lname,'') as mmbername, mm.emailid,
           coalesce(mp.availablecommissionwallet,0) as availablecommissionwallet, coalesce(availablecoinwallet,0) as availablecoinwallet,
           coalesce(available_fund,0) as available_fund
         from member_master mm inner join member_performance mp on mp.regno = mm.regno where mm.username = @memberid limit 1`
      : `select mm.regno, coalesce(mm.fname,'') || ' ' || coalesce(mm.mname,'') || ' ' || coalesce(mm.lname,'') as mmbername, mm.emailid
         from member_master mm where mm.username = @memberid limit 1`;
    const dr = await db.queryOne(DB, sql, { memberid });
    if (dr) {
      getval = `${str(col(dr, 'regNo'))}^${str(col(dr, 'MMBERNAME'))}^${str(col(dr, 'EMAILID'))}`;
      if (withWallets) {
        getval += `^${str(col(dr, 'AVAILABLECOMMISSIONWALLET'))}^${str(col(dr, 'AvailableCoinWallet'))}^${str(col(dr, 'AVAILABLE_FUND'))}`;
      }
    } else {
      getval = 'Invalid';
    }
  } catch (ExpObj) {
    await errorInsert(req, ExpObj, 'GetUsernameAndEmail');
  }
  return getval;
}

/**
 * JsonResult ApproveReject(string GAKEY, long RegNo, long ID, string mode, string Remarks, string Date, string Approvetransactionid)
 * Identical in Fund_Management.cs and Fund_Management_list.cs.
 * Legacy: `if (Session["Admin_User"] == null) Response.Redirect("/")` (ends the response) => { redirect: '/' }.
 */
async function approveReject(req, res) {
  const RegNo = reqLong(req.p.RegNo, 'RegNo');
  const ID = reqLong(req.p.ID, 'ID');
  const GAKEY = nStr(req.p.GAKEY);
  const mode = nStr(req.p.mode);
  const Remarks = nStr(req.p.Remarks);
  const Date = nStr(req.p.Date);
  const Approvetransactionid = nStr(req.p.Approvetransactionid);
  if (!isAdmin(req)) return res.json({ redirect: '/' });
  const EmpId = req.user.emp_id;
  let ret = '';
  const ga = await gaCheck(EmpId, GAKEY, 1);
  if (ga) return res.json(ga);
  if (req.user.emp_code === null || req.user.emp_code === undefined) throw nullRef(); // Emp_Code.ToString()
  const ActivityByUser = `${req.user.emp_code} (${req.user.emp_name === null || req.user.emp_name === undefined ? '' : req.user.emp_name})`;
  // [Usp_Fund_Transfer] @Mode,@RegNo,@ByUserRegNo,@Type,@Amount,@Remark,@StrResult OUT,@TotalCount OUT,@FromDate,@ToDate,@StartRowIndex,
  //   @MaxRows,@TFHID,@emailid,@minamount,@maxamount,@IsVerifiedByAdmin,@ORDERBYFIELD,@PaymentMode,@TransactionId,@ActivityByUser,
  //   @Activity_By_Emp_Id,@TXID,@AmountBTC,@DATE,@APROVETRANSACTIONID   (CommandTimeout 1000)
  const row = await db.procOne(DB, 'Usp_Fund_Transfer', {
    Mode: '5', RegNo, ByUserRegNo: '0', Type: mode, Amount: '0', Remark: Remarks, FromDate: '', ToDate: '', StartRowIndex: 1, MaxRows: 100,
    TFHID: ID, EMAILID: '', MINAMOUNT: '0', MAXAMOUNT: '0', ISVERIFIEDBYADMIN: '-1', ORDERBYFIELD: 'AVDESC', PAYMENTMODE: '0',
    TransactionId: '0', ACTIVITYBYUSER: ActivityByUser, ACTIVITY_BY_EMP_ID: EmpId, TXID: '', AmountBTC: '0', DATE: Date,
    APROVETRANSACTIONID: Approvetransactionid,
  });
  ret = str(col(row, 'StrResult'));
  return res.json(ret);
}

module.exports = {
  FUND_MANAGEMENT_LIST1_PROPS, FUND_MANAGEMENT_LIST_PROPS, STOCK_DETAILS_PROPS, gaCheck, memberByUserName, smsAction, emailAction,
  need, fireSms, fireEmail, totalCountOf, decStr, reqLong, getUsernameAndEmail, approveReject,
};
