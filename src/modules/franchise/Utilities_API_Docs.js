'use strict';
/** Ported from Franchise\Controllers\CustomerPanel\Utilities_API_Docs.cs (Utilities_API_DocsController) */
const express = require('express');
const { scalar } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const P = '/franchise/Utilities_API_Docs';

// auth // route-config: franchisee/Utilities-API
router.all([`${P}/Index{/:id}`, '/franchise/franchisee/Utilities-API'], auth, asyncHandler(async (req, res) => {
  const DID = Number(req.user.pmid);
  const out = { pmid: DID };
  if (DID !== 0) {
    const url = await scalar('shopping', 'select APIURL from TBL_COMPANYSETTINGS where PMID=@pmid limit 1', { pmid: DID });
    out.url = url === undefined ? null : url;
  }
  res.json(out);
}));

module.exports = router;
