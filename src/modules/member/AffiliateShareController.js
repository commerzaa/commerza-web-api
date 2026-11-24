'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/AffiliateShareController.cs (AffiliateShareController)
 * Prefix: /member   DB: affiliate (DataBaseContext => Db_Affiliate)
 */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const config = require('../../config');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';

const SHARE_PROPS = ['SHARE_BY_ID', 'SHARE_TO_ID', 'SHARE_TO_NAME', 'BONUS_VALUE', 'SPRID', 'CREATED_ON', 'LAST_UPDATED_ON', 'COMPLETE_FLAG', 'REMARK', 'REDEEM_FLAG',
  'PRODUCTTITLE', 'FNAME', 'LINK', 'READY_FOR_REDEEM_ON', 'ADMIN_RECEIVE_AMT', 'USER_RECEIVE_AMT'];
const PRODUCT_PROPS = ['PRODUCT_TITLE', 'SPRID', 'SellMRP', 'PRODUCTCODE', 'MPRID', 'Bonus_type', 'redeem_days', 'User_bonus', 'bonus_value', 'EncSPRID', 'Share_Link', 'TOTALRECORD'];
const toInt = (v, d) => { const n = parseInt(v, 10); return Number.isNaN(n) ? d : n; };
const isEmpty = (v) => v === undefined || v === null || v === '';

// ---- ShareReport ---------------------------------------------------------------------------------------
// auth
router.all('/member/AffiliateShare/ShareReport{/:id}', auth, asyncHandler(async (req, res) => {
  const { ClickDate, SearchBy, SearchText } = req.p;
  const ddlcustpage = toInt(req.p.ddlcustpage, null); // int? ddlcustpage
  let page = toInt(req.p.page, null);
  let MaxRows = ddlcustpage === null ? 0 : ddlcustpage; // Convert.ToInt32(int?) => 0 when null
  if (page === null) page = 1;
  if (MaxRows === 0) MaxRows = 50;
  const rows = await proc(DB, 'affiliate_share_report', {
    page, maxrow: MaxRows, plid: Number(req.user.plid), searchtext: SearchText === undefined || SearchText === null ? '' : String(SearchText).trim(),
    clicked_date: ClickDate === undefined || ClickDate === null ? '' : String(ClickDate).trim(), status: SearchBy === undefined || SearchBy === null ? '' : String(SearchBy),
  });
  const AllFreeEpinList = mapRows(rows, SHARE_PROPS);
  const TotalRecord = 0;
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(), SearchText: SearchText === undefined ? null : SearchText,
    ClickedDate: ClickDate === undefined ? null : ClickDate, status: SearchBy === undefined ? null : SearchBy, ddlcustpage,
  };
  return res.json({ view: '~/Views/AffiliateShare/ShareReport.cshtml', Model: AllFreeEpinList, ViewBag });
}));

// ---- Products ------------------------------------------------------------------------------------------
// auth
router.all('/member/AffiliateShare/Products{/:id}', auth, asyncHandler(async (req, res) => {
  const { ProductPrice, ProductName, SearchBy } = req.p;
  const ddlcustpage = toInt(req.p.ddlcustpage, null);
  let page = toInt(req.p.page, null);
  let MaxRows = ddlcustpage === null ? 0 : ddlcustpage;
  if (page === null) page = 1;
  if (MaxRows === 0) MaxRows = 50;
  const Plid = Number(req.user.plid);
  const encPlid = await UtilityClass.Encryptword(String(Plid));
  let price = 0.0;
  if (!isEmpty(ProductPrice)) {
    price = Number(ProductPrice);
    if (Number.isNaN(price)) throw new Error('Input string was not in a correct format.');
  }
  let searchBy = 0;
  if (!isEmpty(SearchBy)) {
    searchBy = parseInt(SearchBy, 10);
    if (Number.isNaN(searchBy)) throw new Error('Input string was not in a correct format.');
  }
  const rows = await proc(DB, 'usp_get_affiliate_products', {
    page, maxrow: MaxRows, plid: Plid, productprice: price, productname: isEmpty(ProductName) ? '' : String(ProductName).trim(), searchby: searchBy,
  });
  let AllFreeEpinList = mapRows(rows, PRODUCT_PROPS);
  const baseUrl = String(config.app.ShoppingSite || '');
  const list = [];
  for (const x of AllFreeEpinList) {
    x.EncSPRID = await UtilityClass.Encryptword(String(x.SPRID));
    x.Share_Link = `${baseUrl}/p/${x.PRODUCT_TITLE}/${x.EncSPRID}/${encPlid}`;
    list.push(x);
  }
  AllFreeEpinList = list;
  let TotalRecord = 0;
  if (AllFreeEpinList.length > 0) {
    TotalRecord = parseInt(AllFreeEpinList[0].TOTALRECORD, 10);
    if (Number.isNaN(TotalRecord)) TotalRecord = 0;
  }
  const ViewBag = {
    CurrentPage: page, GridPageSize: MaxRows, TotalRecord, NoPerPage: await UtilityClass.GridNumbersPerPage(),
    ProductPrice: ProductPrice === undefined ? null : ProductPrice, ProductName: ProductName === undefined ? null : ProductName,
    SearchBy: SearchBy === undefined ? null : SearchBy, ddlcustpage,
  };
  return res.json({ view: '~/Views/AffiliateShare/Products.cshtml', Model: AllFreeEpinList, ViewBag });
}));

module.exports = router;
