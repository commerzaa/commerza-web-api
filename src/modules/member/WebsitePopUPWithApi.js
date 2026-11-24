'use strict';
/** Ported from Member\Common\Controllers\CustomerPanel\WebsitePopUPWithApi.cs (WebsitePopUPWithApiController : ApiController) */
const express = require('express');
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const DB = 'affiliate';
const PROPS = ['name', 'Title', 'Type'];

// public ([HttpGet][HttpPost]); WebApiConfig route "api/apiwebsitepopup" -> WebsitePopUPWithApi/WebsitePopUPWithApi
router.all(['/member/WebsitePopUPWithApi/WebsitePopUPWithApi{/:id}', '/member/WebsitePopUPWithApi', '/member/api/apiwebsitepopup'], asyncHandler(async (req, res) => {
  try {
    const rows = await proc(DB, 'usp_memberpopupimage', {});
    const GalleryImages = mapRows(rows, PROPS);
    // OutPutSystemJObject { Flag, Message (JArray), ExceptionMessage, Response }
    res.json({ Flag: 'success', Message: GalleryImages, ExceptionMessage: '', Response: 1 });
  } catch (ExpObj) {
    // Message was never set in the legacy error branch => null
    res.json({ Flag: 'Error', Message: null, ExceptionMessage: ExpObj.message, Response: 0 });
  }
}));

module.exports = router;
