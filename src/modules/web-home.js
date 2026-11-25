'use strict';
/**
 * Port of Controllers/WebPanelCntrl/HomeController.cs (class HomeController, 2 actions).
 * Named WebHomeController.js to avoid clashing with the root HomeController module.
 *  - BannerList      : no [Route]/verb attribute => conventional route api/Home/{id?}  (router.all)
 *  - FranchiseListing: [HttpGet] [Route("api/CrauselBanner")]
 * The model classes at the bottom of the C# file (LatestBlog, HomeBindList, product_Master_Custom, ShoppingCartData,
 * PackageOrder, Banner, ...) are plain property bags and are not ported as classes.
 */
const express = require('express');
const config = require('../config');
const { query, queryOne } = require('../db');
const { netDate } = require('../utils/shape');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// Banner model: ROWNUMBER is not selected by the queries, so it stays at its default (0)
function mapBanners(rows) {
  return (rows || []).map((r) => ({
    ROWNUMBER: 0,
    brId: r.brid,
    Title: r.title,
    Url: r.url,
    Status: r.status,
    CreateDate: r.createdate ? netDate(r.createdate) : null,
  }));
}

// public
router.all(['/api/Home', '/api/Home/:id'], asyncHandler(async (req, res) => {
  /* C# preamble: PageUrl = CompanySettings.CompanyDomain; Ref/sortBy/offer defaults ("" - Decryptword(offer) branch is
     unreachable because offer is always null at that point); WebsiteDetail.GetWebsiteInfo(15) result is only used by
     commented-out ViewBag code, and the method itself swallows its own exceptions. */
  try {
    await queryOne('affiliate',
      'Select Heading,Description,SeoTitle,SeoKeyword,SeoDescription From tbl_website_content_master Where wid = @wid', { wid: 15 });
  } catch (e) { /* WebsiteDetail.GetWebsiteInfo returns an empty result on error */ }

  // PORT-NOTE: tbl_HomePageBanners lives in Db_Shopping (the DataBaseContext connection resolved it there), so 'shopping' is used.
  const rows = await query('shopping',
    'select brId, Title, Url, Status, CreateDate from tbl_homepagebanners where status = 1');
  const banner = mapBanners(rows);
  return res.json(banner);
}));

// public
router.get('/api/CrauselBanner', asyncHandler(async (req, res) => {
  const baseUrl = String(config.app.AdminURLforImage) + '/BannerImages/';
  const result = { Status: true, Message: '', Data: null };
  try {
    const rows = await query('shopping',
      "select brId, Title, Url, Status, CreateDate from tbl_homepagebanners where status = 1 and target_source = 'android'");
    const banner = mapBanners(rows);
    if (banner && banner.length > 0) {
      const list = banner.map((x) => {
        x.Url = `${baseUrl}${x.Title}/${x.Url}`;
        return x;
      });
      result.Data = list;
    } else {
      result.Status = false;
      result.Message = 'Empty list found';
    }
    return res.json(result);
  } catch (ex) {
    result.Status = false;
    result.Message = 'Something Went Wrong!';
    return res.json(result);
  }
}));

module.exports = router;
