'use strict';
/**
 * Shared helpers for portal batch 15 (visitor-signup, web-site-builder, what-is-eblaa, whatsapp-marketing).
 * Exports: pageUrl(req), seoViewBag(ViewBag, wid), outerPageIndex(wid, viewName)
 * Not a router: lives in _shared/ so src/modules/portal.js does not mount it.
 */
const asyncHandler = require('../../../middleware/asyncHandler');
const WebsiteDetail = require('../../../lib/portal/WebsiteDetail');

/** HttpContext.Request.Url.ToString() (absolute URL of the current request). */
function pageUrl(req) {
  return `${req.protocol}://${req.get('host')}${req.originalUrl}`;
}

/**
 * ViewBag.Title = ""; ViewBag.MetaDesc = ""; ViewBag.MetaKeyword = "";
 * ObjWebsiteDescription = WebsiteDetail.GetWebsiteInfo(wid); if (!= null) { Title/MetaDesc/MetaKeyword = Seo* }
 */
async function seoViewBag(ViewBag, wid) {
  ViewBag.Title = '';
  ViewBag.MetaDesc = '';
  ViewBag.MetaKeyword = '';
  const ObjWebsiteDescription = await WebsiteDetail.GetWebsiteInfo(wid);
  if (ObjWebsiteDescription != null) {
    ViewBag.Title = ObjWebsiteDescription.SeoTitle;
    ViewBag.MetaDesc = ObjWebsiteDescription.SeoDescription;
    ViewBag.MetaKeyword = ObjWebsiteDescription.SeoKeyword;
  }
  return ViewBag;
}

/**
 * The identical outer "landing page" Index() of WebSiteBuilder / what_is_ATCShopping / whatsappmarketing:
 * the "Domain Management" try block only reads Request.Url into unused locals (its catch, ViewBag.Message = Exp.Message,
 * cannot fire), then ViewBag.Canonical = page url + SEO values of TBL_WEBSITE_CONTENT_MASTER row `wid`, then return View.
 */
function outerPageIndex(wid, viewName) {
  return asyncHandler(async (req, res) => {
    const ViewBag = {};
    try {
      // CompleteUrl / CompletePath / CompleteHostName: unused (redirect logic commented out in legacy)
      pageUrl(req);
    } catch (Exp) {
      ViewBag.Message = Exp.message;
    }
    ViewBag.Canonical = pageUrl(req);
    await seoViewBag(ViewBag, wid);
    return res.json({ View: viewName, ViewBag });
  });
}

module.exports = { pageUrl, seoViewBag, outerPageIndex };
