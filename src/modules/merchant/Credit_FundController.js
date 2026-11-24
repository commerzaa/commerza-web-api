'use strict';
// Ported from Merchant Panel\Controllers\CustomerPanel\Credit_FundController.cs (Credit_FundController)  - DB: shopping (Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const PushNotificationRepo = require('../../lib/merchant/PushNotificationRepo');

const router = express.Router();
const DB = 'shopping';
const guard = [auth, requireType('merchant')];
const P = '/merchant/Credit_Fund';

function outVal(row, name) {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === String(name).toLowerCase());
  return k !== undefined ? row[k] : null;
}
const outStr = (row, name) => { // spOutput.Value.ToString() (null => NullReferenceException)
  const v = outVal(row, name);
  if (v === null || v === undefined) throw new TypeError('Object reference not set to an instance of an object.');
  return String(v);
};
const isNullOrEmpty = (v) => v === undefined || v === null || v === '';
// decimal.ToString() keeps the scale of the parsed text
function decimalToString(v) {
  if (v === undefined || v === null || String(v).trim() === '' || Number.isNaN(Number(v))) {
    throw new Error('The parameters dictionary contains a null entry for parameter \'Amount\' of non-nullable type \'System.Decimal\'.');
  }
  const t = String(v).trim();
  if (/^-?\d+(\.\d+)?$/.test(t)) return t.replace(/^(-?)0+(?=\d)/, '$1');
  return String(Number(t));
}

// public string Pushnotificationmessage(string name, string amount, ref string CompanyLogo)  - returns { message, CompanyLogo }
async function Pushnotificationmessage(Plid, name, amount) {
  let sb = '';
  const o = await db.procOne(DB, 'usp_checkall_cppoint', { mode: 1, username: name });
  const returnmessage = outStr(o, 'strresult');
  const a = returnmessage.split('^');
  const portaldata = await db.queryOne(DB, 'SELECT * FROM PORTAL_MASTER WHERE PLID = @plid LIMIT 1', { plid: Plid });
  if (!portaldata) throw new TypeError('Object reference not set to an instance of an object.');
  const CompanyLogo = portaldata.companyimage;
  if (a.length < 2) throw new RangeError('Index was outside the bounds of the array.');
  const nz = (v) => (v === null || v === undefined ? '' : String(v));
  sb += 'Congratulations... ' + a[1] + ' received ' + amount + ' C-Point as cash back from ' + nz(portaldata.companyname) + ' ' + nz(portaldata.address) + ' ' + nz(portaldata.city) + ' ' + nz(portaldata.city) + ' Thanks.';
  return { message: sb, CompanyLogo };
}

// auth  ; route-config: merchant/credit-fund-management
router.all([`${P}/Index{/:id}`, P, '/merchant/credit-fund-management'], ...guard, asyncHandler(async (req, res) => {
  const Plid = Number(req.user.plid);
  const ViewBag = {};
  ViewBag.TotalCPPoint = null;
  const v = await db.scalar(DB, 'SELECT coalesce(Available_FUND,0) FROM PORTAL_MASTER WHERE PLID = @plid LIMIT 1', { plid: Plid });
  const TotalAvaliableCP = v === null || v === undefined ? 0 : Number(v); // FirstOrDefault() => 0
  ViewBag.TotalCPPoint = TotalAvaliableCP;
  res.json({ ViewBag, ...ViewBag });
}));

// auth
router.all(`${P}/CreditFundByCustomer{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const { Username, Remark, OrderId } = req.p;
  if (isNullOrEmpty(OrderId)) return res.json('Please Enter Order Id');
  if (isNullOrEmpty(Username)) return res.json('Please Enter Customer Id');
  try {
    const AmountStr = decimalToString(req.p.Amount);
    const r = await db.procOne(DB, 'usp_fund_transfer_merchant_to_member', {
      mode: 1, regno: Number(req.user.plid), username: Username, type: 'CR', amount: Number(AmountStr), remark: Remark, orderid: OrderId,
    });
    const RetMessage = outStr(r, 'strresult');
    const _pnrepo = new PushNotificationRepo();
    const _model = {};
    let CompanyImage = '';
    if (RetMessage === 'success') {
      _model.Token = '';
      _model.sendtype = 'all';
      _model.Title = 'Got C-Point';
      const pm = await Pushnotificationmessage(Number(req.user.plid), Username, AmountStr);
      CompanyImage = pm.CompanyLogo;
      _model.body = pm.message;
      _model.subtitle = '';
      _model.icon = isNullOrEmpty(CompanyImage) ? 'https://member.clusteroffer.com/images/Admin-1.png' : 'https://partner.clusteroffer.com/Company_Logo/' + CompanyImage;
      _model.sound = 'default';
      _model.clickaction = '';
      await _pnrepo.sendPushnotification(_model);
    }
    return res.json(RetMessage);
  } catch (Exp) {
    return res.json(Exp.message);
  }
}));

// auth (public C# method, exposed as MVC action)
router.all(`${P}/Pushnotificationmessage{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const pm = await Pushnotificationmessage(Number(req.user.plid), req.p.name, req.p.amount);
  res.json(pm.message);
}));

// auth
router.all(`${P}/GetTotalCPPoint{/:id}`, ...guard, asyncHandler(async (req, res) => {
  const Username = req.p.Username;
  if (Username === undefined || Username === null) throw new TypeError('Object reference not set to an instance of an object.');
  if (String(Username).trim() === '') return res.json('Please Enter Customer Id');
  const o = await db.procOne(DB, 'usp_checkall_cppoint', { mode: 1, username: Username });
  res.json(outStr(o, 'strresult'));
}));

module.exports = router;
