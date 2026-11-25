'use strict';
// Ported from Franchise\Controllers\CustomerPanel\CampaignList.cs (database: shopping - Franchise DataBaseContext = Db_Shopping)
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const P = '/franchise/CampaignList';
const PROPS = ['TATBID', 'PLID', 'UrlType', 'URL', 'TVHMID', 'FromDate', 'ToDate', 'IsPublished', 'IsSaved', 'IsActive', 'Status', 'AddedDate',
  'TotalNoOfHits', 'TotalNoOfUniqueHits', 'ActualStatus', 'CampaignType', 'TargetedAudience', 'SaveStatus', 'NoOfClicks'];

// auth
router.all([P + '/Index{/:id}'], auth, asyncHandler(async (req, res) => {
  const id = req.p.id;
  const Plid = parseInt(req.user.did, 10);
  const ViewBag = {};
  try {
    if (id != null) {
      const dec = String(await UtilityClass.Decryptword(id));
      if (!/^[+-]?\d+$/.test(dec.trim())) throw new Error('Input string was not in a correct format.');
      const ID = parseInt(dec, 10);
      const result = await db.exec('shopping', 'Update Tbl_AddTrafficBooster Set Status = (Case When Status=0 Then 1 Else 0 End) Where TATBID = @id', { id: ID });
      if (result > 0) return res.json({ redirect: 'CampaignList/Index' });
    }
  } catch (Exp) {
    ViewBag.Message = Exp.message;
  }
  const rows = await db.proc('shopping', 'usp_managetrafficbooster', { Mode: '1', TATBID: '0', PLID: Plid });
  res.json({ Model: mapRows(rows, PROPS), ViewBag, ...ViewBag });
}));

module.exports = router;
