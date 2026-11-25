'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/PurchaseCoinForHold.cs (PurchaseCoinForHoldController)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 */
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');
const DataUtility = require('../../lib/member/DataUtility');
const Security_Key = require('../../lib/member/Security_Key');

const router = express.Router();
const DB = 'affiliate';

const legacyPath = (req) => req.originalUrl.split('?')[0].replace(/^\/member/, '');
const col = (row, name) => { if (!row) return null; const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase()); return k === undefined ? null : row[k]; };
// Math.Round(decimal) : banker's rounding (MidpointRounding.ToEven)
const roundEven = (x) => { const f = Math.floor(x); const d = x - f; if (d < 0.5) return f; if (d > 0.5) return f + 1; return f % 2 === 0 ? f : f + 1; };
// Convert.ToDecimal(string)
const toDecimal = (v) => {
  if (v === undefined || v === null || v === '') { if (v === '') throw new Error('Input string was not in a correct format.'); return 0; }
  const n = Number(String(v).trim());
  if (Number.isNaN(n) || String(v).trim() === '') throw new Error('Input string was not in a correct format.');
  return n;
};

const SUBSCRIPTION_PROPS = ['TSMID', 'SubscriptionHeading', 'SubscriptionDetails', 'NoOfDaysForActivation', 'IsSMSLIMITS', 'NoOfSms', 'IsEmailLimits', 'NoOfEmail',
  'IsWhatsupLimits', 'NoOfWhatsUpMessage', 'IsNoOfWebsiteLimits', 'NoOfWebsiteSelection', 'IsLeadLandingPageLimits', 'NoOfLeadLandingPage', 'Price',
  'ISDiscountApplicable', 'CommentOrRemark', 'IsActive', 'Status', 'IsTrailSubscription', 'TTSID', 'Discount', 'NetPayable', 'MININVESTMENT', 'MAXINVESTMENT',
  'SERVICE_TAX_PER', 'PackageColor', 'AmountColor', 'IMAGE', 'MRP', 'BV'];

// auth
// route-config: "referral/purchase-coin-for-hold" -> PurchaseCoinForHold/Index
router.all(['/member/PurchaseCoinForHold/Index{/:id}', '/member/referral/purchase-coin-for-hold'], auth, asyncHandler(async (req, res) => {
  const TempPlid = Math.trunc(Number(req.user.plid));
  const rows = await db.proc(DB, 'usp_managesubscription', { mode: '7', plid: TempPlid });
  const ObjGetAllData = {
    LiKitMaster: null,
    LiEmailPackMaster: null,
    LiSmsPackMaster: null,
    LiSubscriptionMaster: mapRows(rows, SUBSCRIPTION_PROPS),
    LiWhatsUpPackMaster: null,
    LiTrafficBoosterPackMaster: null,
    BankListadmin: null,
  };
  res.json({ view: '~/Views/CustomerPanel/PurchaseCoinForHold/Index.cshtml', Model: ObjGetAllData });
}));

// auth
router.all('/member/PurchaseCoinForHold/PurchaseAndHoldCoin{/:id}', auth, asyncHandler(async (req, res) => {
  let { TotalPayableAmount, PaymentMode, ModeName, CommentORRemark, UserName, GAKEY } = req.p;
  const { AllPackageId, AllPackageType, AllPackageAmount, AllPackageName } = req.p;
  let TransactionPassword = await UtilityClass.Encryptword(req.p.TransactionPassword);
  // CurrencySymbol (AppSettings) was read into an unused local
  const Rate = 1;
  const InvestMentInINR = roundEven(toDecimal(TotalPayableAmount) / Rate);
  let ReturnOutput = 'success';
  let RegNo = 0;
  const sessPlid = Math.trunc(Number(req.user.plid));
  if (UserName === '') {
    RegNo = sessPlid;
  } else {
    const RowSp = UserName === undefined || UserName === null
      ? await db.queryOne(DB, 'select plid from portal_login where username is null and active::int = 1 limit 1', {})
      : await db.queryOne(DB, 'select plid from portal_login where username = @username and active::int = 1 limit 1', { username: UserName });
    if (RowSp) {
      RegNo = Number(RowSp.plid);
    } else {
      return res.json('6^Invalid User Name Sorry.');
    }
  }
  {
    const Plid = sessPlid;
    let objs = new Security_Key();
    objs = await objs.Get_Security_Key(Plid);
    if (objs) {
      // PORT-NOTE: legacy passes GAKEY as the *secret* argument of Check_GaKey(plid, SecretKey, user2FACode = "") - kept as is.
      if (!(await objs.Check_GaKey(Plid, GAKEY))) {
        return res.json('Error^Please enter valid GA key !');
      }
    }
  }
  try {
    // loginid (Session LoginID) was read into an unused local
    const Plid = RegNo;
    // PORT-NOTE: @IntResult / @TranIds OUT params are read from the result row; Output rows (ExecuteSqlCommand count) only fed an empty try block.
    const out = await db.procOne(DB, 'usp_allcoinholdingmaster', {
      totalpayableamount: TotalPayableAmount,
      paymentmode: PaymentMode,
      modename: ModeName,
      commentorremark: CommentORRemark,
      regno: RegNo,
      transactionpassword: TransactionPassword,
      allpackageid: AllPackageId,
      allpackagetype: AllPackageType,
      allpackageamount: AllPackageAmount,
      plid: Plid,
      allpackagename: AllPackageName,
      processingfee: '0.00',
      noofatccoin: TotalPayableAmount,
      investmentininr: InvestMentInINR,
      fromregno: sessPlid,
    });
    const v = col(out, 'intresult');
    ReturnOutput = v === null ? '' : String(v);
    // Orderid (TranIds) was read but unused
  } catch (ExpObj) {
    try { await new DataUtility().ErrorInsert(0, ExpObj.message, 'PurchaseAndHoldCoin', 0, legacyPath(req)); } catch (e) { console.error(e); }
    ReturnOutput = `Error^Some Exception Occur : ${ExpObj.message}`;
  }
  return res.json(ReturnOutput);
}));

// auth
router.all('/member/PurchaseCoinForHold/checkusername{/:id}', auth, asyncHandler(async (req, res) => {
  const row = await db.queryOne(DB, "select coalesce(username, '') as username from portal_login where plid = @plid limit 1", { plid: Math.trunc(Number(req.user.plid)) });
  const USERNAME = row ? row.username : null;
  const ret = 'Success' + '^' + (USERNAME === null || USERNAME === undefined ? '' : USERNAME);
  res.json(ret);
}));

module.exports = router;
