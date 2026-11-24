'use strict';
// Ported from Merchant Panel\Controllers\CustomerPanel\CampaignList.cs (database: shopping - Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth, requireType } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/merchant/UtilityClass');

const router = express.Router();
const DB = 'shopping';
const guard = [auth, requireType('merchant')];
const P = '/merchant/CampaignList';
const PROPS = ['TATBID', 'PLID', 'UrlType', 'URL', 'TVHMID', 'FromDate', 'ToDate', 'IsPublished', 'IsSaved', 'IsActive', 'Status', 'AddedDate',
  'TotalNoOfHits', 'TotalNoOfUniqueHits', 'ActualStatus', 'CampaignType', 'TargetedAudience', 'SaveStatus', 'NoOfClicks'];

// auth
router.all([P + '/Index{/:id}', '/merchant/campaign-list'], ...guard, asyncHandler(async (req, res) => { // route-config: merchant/campaign-list
  const id = req.p.id;
  const Plid = parseInt(req.user.plid, 10);
  const ViewBag = {};
  try {
    if (id != null) {
      const dec = String(await UtilityClass.Decryptword(id));
      if (!/^[+-]?\d+$/.test(dec.trim())) throw new Error('Input string was not in a correct format.');
      const ID = parseInt(dec, 10);
      const result = await db.exec(DB, 'Update Tbl_AddTrafficBooster Set Status = (Case When Status=0 Then 1 Else 0 End) Where TATBID = @id', { id: ID });
      if (result > 0) return res.json({ redirect: 'CampaignList/Index' });
    }
  } catch (Exp) {
    ViewBag.Message = Exp.message;
  }
  const rows = await db.proc(DB, 'usp_managetrafficbooster', { Mode: '1', TATBID: '0', PLID: Plid });
  res.json({ Model: mapRows(rows, PROPS), ViewBag, ...ViewBag });
}));

module.exports = router;
