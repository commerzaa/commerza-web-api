'use strict';
// Ported from ClusterofferShopingPortal/Controllers/CustomerPanel/CampaignList.cs (CampaignListController, 1 action). Database: shopping (Db_Shopping).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const { DB, mvcStr, toInt32 } = require('./_shared/batch-03-common');

const router = express.Router();
const C = 'CampaignList';

/** class CampaignList */
const CAMPAIGN_PROPS = ['TATBID', 'PLID', 'UrlType', 'URL', 'TVHMID', 'FromDate', 'ToDate', 'IsPublished', 'IsSaved', 'IsActive', 'Status',
  'AddedDate', 'TotalNoOfHits', 'TotalNoOfUniqueHits', 'ActualStatus', 'CampaignType', 'TargetedAudience', 'SaveStatus', 'NoOfClicks'];

// ---------------------------------------------------------------- Index(string id)
// auth (Session["Plid"] == null => RedirectToAction("Index","Home"))
// route-config: merchant/campaign-list -> CampaignList/Index
router.all([`/portal/${C}/Index{/:id}`, `/portal/${C}`, '/portal/merchant/campaign-list'], ps.customerAuth, asyncHandler(async (req, res) => {
  const id = mvcStr(req, 'id');
  const ViewBag = {};
  const Plid = toInt32(req.user.plid);
  try {
    if (id !== null) {
      const ID = toInt32(String(await UtilityClass.Decryptword(id)));
      const result = await db.exec(DB,
        'update tbl_addtrafficbooster set status = (case when status = 0 then 1 else 0 end) where tatbid = @ID', { ID });
      if (result > 0) {
        return res.json({ redirect: `/portal/${C}/Index` });
      }
    }
  } catch (Exp) {
    ViewBag.Message = Exp.message;
  }
  // [DBO].[Usp_ManageTrafficBooster] @Mode,@TATBID,@PLID
  const rows = await db.proc(DB, 'usp_managetrafficbooster', { mode: '1', tatbid: '0', plid: Plid });
  return res.json({ view: '~/Views/CustomerPanel/CampaignList/Index.cshtml', Model: mapRows(rows, CAMPAIGN_PROPS), ...ViewBag });
}));

module.exports = router;
