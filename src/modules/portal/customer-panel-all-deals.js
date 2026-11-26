'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/AllDeals.cs (AllDealsController, 2 actions). Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const { DB, mvcStr, toInt32 } = require('./_shared/batch-03-common');

const router = express.Router();
const C = 'AllDeals';

/** Models/Portal_Deal_Master.cs class AllDealsList */
const ALL_DEALS_PROPS = ['ROWNUMBER', 'ID', 'ACTIVESTATUS', 'IMAGENAME', 'TITLE', 'CREATEDATE', 'FROMDATE', 'EXPIRYDATE', 'OFFER', 'DESCRIPTIONS', 'Responses'];
/** AllDealsController.Portal_Deal */
const PORTAL_DEAL_PROPS = ['RowNumber', 'CCNAME', 'CCEMAILID', 'MOBILE', 'MESSAGE', 'IPCOUNTRY', 'IPSTATE', 'IPCITY'];

// ---------------------------------------------------------------- Index(string id)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: "merchant/alldeals" is commented out in RouteConfig.cs
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`], ps.customerAuth, asyncHandler(async (req, res) => {
  const id = mvcStr(req, 'id');
  const ViewBag = {};
  try {
    if (id !== null) {
      const ID = toInt32(String(await UtilityClass.Decryptword(id)));
      // Int32 Plid = Convert.ToInt32(Login.Plid) (unused)
      const result = await db.exec(DB,
        'update portal_deal_master set active = (case when active = 0 then 1 else 0 end) where dealid = @ID', { ID });
      if (result > 0) {
        return res.json({ redirect: `/portal/${C}/Index` });
      }
    }
  } catch (Exp) {
    ViewBag.Message = Exp.message;
  }
  const Plid = toInt32(req.user.plid);
  const rows = await db.proc(DB, 'usp_deal_details', { plid: Plid });
  return res.json({ view: '~/Views/CustomerPanel/AllDeals/Index.cshtml', Model: mapRows(rows, ALL_DEALS_PROPS), ...ViewBag });
}));

// ---------------------------------------------------------------- JsonResult GetDealsResponseData(string DealId)
// auth (PORT-NOTE: legacy had no session check; the deal inbox holds visitors' contact details, so a customer token is required)
router.all(`/portal/${C}/GetDealsResponseData{/:id}`, ps.customerAuth, asyncHandler(async (req, res) => {
  const DealID = toInt32(mvcStr(req, 'DealId'));
  const rows = await db.query(DB, `select row_number() over (order by dlid asc) as rownumber, ccname, ccemailid, mobile, message,
      ipcountry, ipstate, ipcity from portal_deal_inbox where dealid = @DealID`, { DealID });
  return res.json(mapRows(rows, PORTAL_DEAL_PROPS));
}));

module.exports = router;
