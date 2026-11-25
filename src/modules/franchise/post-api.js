'use strict';
/** Ported from Franchise\Controllers\CustomerPanel\PostAPI.cs (PostAPIController) */
const express = require('express');
const { exec, scalar } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const P = '/franchise/PostAPI';

// auth // route-config: franchisee/Post-API
router.all([`${P}/Index{/:id}`, '/franchise/franchisee/Post-API'], auth, asyncHandler(async (req, res) => {
  const DID = Number(req.user.pmid);
  let BaseURL = req.p.BaseURL;
  if (BaseURL !== '' && BaseURL !== null && BaseURL !== undefined) {
    await exec('shopping', 'update TBL_COMPANYSETTINGS set APIURL=@u where PMID=@pmid', { u: BaseURL, pmid: DID });
  }
  const url = await scalar('shopping', 'select APIURL from TBL_COMPANYSETTINGS where PMID=@pmid limit 1', { pmid: DID });
  BaseURL = url;
  res.json({ url: url === undefined ? null : url });
}));

module.exports = router;
