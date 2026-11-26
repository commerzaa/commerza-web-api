'use strict';
// Ported from ClusterofferShopingPortal\Controllers\PromosAndAdvertisement.cs (class PromosAndAdvertisementController, [CheckResellerTimeout] = no check)
// Database: shopping (Db_Shopping; legacy DataBaseContext).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/portal/UtilityClass');
const ps = require('./_shared/portal-session');
const { DB, toInt32, outOf, str } = require('./_shared/batch-13-common');

const router = express.Router();
const C = 'PromosAndAdvertisement';

/** C# model classes declared in PromosAndAdvertisement.cs */
const PROMOS_PROPS = ['TATBID', 'PLID', 'UrlType', 'URL', 'TVHMID', 'FromDate', 'ToDate', 'IsPublished', 'IsSaved', 'IsActive', 'Status',
  'AddedDate', 'TotalNoOfHits', 'TotalNoOfUniqueHits', 'IsShareType', 'ShareTypeID', 'CATID', 'KID', 'CTID', 'NoOfClicks', 'CampaignType',
  'ShareSource', 'TargetedCountry', 'TargetedCity', 'TargetedArea', 'ImageName', 'IsApprovedBYAdmin', 'IsAddedByAdmin', 'Title', 'Description',
  'ViewButton', 'ShareButton', 'ViewPoint', 'SharePoint'];
const DATEWISE_PROPS = ['MaxNoOfClicksPerDayForView', 'MaxNoOfLinkPerDayForShare', 'MaxNoOfBlogPerDay', 'MaxNoOfClassifiedPerDay',
  'MaxNoOfBusinessListingPerDay'];
const LIMITS_PROPS = ['Limits', 'CAPTION'];
const MEMBERWISE_PROPS = ['TotalClicked', 'TotalShared', 'SubmittedNoOfBlog', 'SubmittedNoOfClassified', 'SubmittedNoOfBusinessListing'];
const CHECK_PROPS = ['URL', 'TATBID', 'ACTIVITYTYPE'];

// ---------------------------------------------------------------- Index(string page)
// public (session optional: Plid = 0 when not logged in)
// route-config: "promos-and-advertisement/{id}" -> PromosAndAdvertisement/Index
router.all([`/portal/${C}`, `/portal/${C}/Index{/:id}`, '/portal/promos-and-advertisement{/:id}'], ps.CheckResellerTimeout,
  asyncHandler(async (req, res) => {
    let page = req.p.page;
    if (page === undefined) page = null;
    if (page != null) {
      page = await UtilityClass.Decryptword(page);
    }
    const ObjGetAllData = {};
    let Plid = 0;
    const MaxRows = 50;
    if (ps.isCustomer(req)) {
      Plid = toInt32(req.user.plid);
    } else {
      Plid = 0;
    }
    if (page == null) {
      page = '1';
    }
    const ViewBag = {};
    const rows = await db.proc(DB, 'Usp_ClickManagements', {
      Mode: 1, Plid, MemberPLID: 1, TATBID: 2, StartRowIndex: toInt32(page), MaxRows,
    });
    ObjGetAllData.PromosAndAdvertisement = mapRows(rows, PROMOS_PROPS);
    const TotalRecord = toInt32(str(outOf(rows, 'TotalCount')));
    ViewBag.CurrentPage = toInt32(page);
    ViewBag.GridPageSize = MaxRows;
    ViewBag.TotalRecord = TotalRecord;
    ViewBag.NoPerPage = await UtilityClass.GridNumbersPerPage();

    ObjGetAllData.PromoAndAdvertisementDateWiseDetails = mapRows(
      await db.proc(DB, 'USP_PromosAndAdvertisementDetails', { Mode: 1 }), DATEWISE_PROPS);
    ObjGetAllData.PromoAndAdvertisementeMemberWiseDetails = mapRows(
      await db.proc(DB, 'USP_PromosAndAdvertisementDetails', { Mode: 2, PLID: Plid }), MEMBERWISE_PROPS);
    ObjGetAllData.PromoAndAdvertisementLimitsDetails = mapRows(
      await db.proc(DB, 'USP_PromosAndAdvertisementDetails', { Mode: 3 }), LIMITS_PROPS);
    return res.json({ view: `~/Views/${C}/Index.cshtml`, Model: ObjGetAllData, ...ViewBag });
  }));

// ---------------------------------------------------------------- ManageHistoryOfSessionForEachUser(string TATBID, string PLID)
// auth (Session["Plid"] == null => Json("Ok"))
router.all(`/portal/${C}/ManageHistoryOfSessionForEachUser{/:id}`, ...ps.customerOr('Ok'), asyncHandler(async (req, res) => {
  const { TATBID, PLID } = req.p;
  let ReturnOutPut = '';
  const MemberPLID = toInt32(req.user.plid);
  const rows = await db.proc(DB, 'Usp_ClickManagements', {
    Mode: 3, PLID: PLID ?? null, MemberPLID, TATBID: TATBID ?? null,
  });
  // SpOutput.Value.ToString() (DBNull => "")
  ReturnOutPut = str(outOf(rows, 'StrResult'));
  return res.json(ReturnOutPut);
}));

// ---------------------------------------------------------------- GetDataByDate()
// public (empty list when not logged in)
router.all(`/portal/${C}/GetDataByDate{/:id}`, ps.portalSession, asyncHandler(async (req, res) => {
  let ObjCheckUncheckPromosData = [];
  if (ps.isCustomer(req)) {
    const rows = await db.query(DB,
      `select url, tbl_membertaskincomedetails.tatbid, coalesce(activitytype, 1) as activitytype
         from tbl_membertaskincomedetails
        inner join tbl_addtrafficbooster on tbl_addtrafficbooster.tatbid = tbl_membertaskincomedetails.tatbid
        where tbl_membertaskincomedetails.plid = @plid
          and tbl_membertaskincomedetails.date::date = fun_getcurrentdate()::date`,
      { plid: toInt32(req.user.plid) });
    ObjCheckUncheckPromosData = mapRows(rows, CHECK_PROPS);
  }
  return res.json(ObjCheckUncheckPromosData);
}));

module.exports = router;
