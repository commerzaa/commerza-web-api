'use strict';
// Port of Controllers/WebPanelCntrl/ShopsController.cs
const express = require('express');
const { query, scalar, proc } = require('../db');
const { mapRows } = require('../utils/shape');
const asyncHandler = require('../middleware/asyncHandler');
const GetCountry = require('../lib/GetCountry');

const router = express.Router();

const str = (v) => (v === null || v === undefined ? '' : String(v));
const col = (row, name) => {
  if (!row) return undefined;
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? undefined : row[k];
};
const toInt = (v) => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
};
const nre = () => new Error('Object reference not set to an instance of an object.');
/** TextInfo(en-US).ToTitleCase approximation: all-upper words are kept (acronyms), others Capitalised. */
const toTitleCase = (s) => s.replace(/[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ']*/g, (w) =>
  (w.length > 1 && w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1).toLowerCase()));

const BUSINESS_LIST_PROPS = ['AVGRATING', 'Plid', 'COMEMAILID', 'COMPANYIMAGE', 'COMPLETEADDRESS', 'DETAILSURL', 'MOBILENO',
  'NOOFREC', 'PMID', 'ROWNUMBER', 'TITLE', 'TOTALREVIEWS', 'URL', 'COMPANYDESC'];

/** Common params of USP_PORTALMASTER_SEARCHING_M(_NEW); legacy passed the numeric ones as strings */
function searchParams(RandomNo, SearchText, City, Area) {
  return {
    mode: 's', searchtype: '', cid: '96', ctid: '0', aid: '', pincode: '0', pageno: '1', pagesize: '50',
    randnumber: RandomNo, searchtext: SearchText, city: City, area: Area,
  };
}
const randomNo = () => Math.floor(Math.random() * 998) + 1; // Random.Next(1, 999)

// public
router.post('/api/NearShops', asyncHandler(async (req, res) => {
  const rows = await proc('shopping', 'usp_portalmaster_searching_m_new', searchParams(randomNo(), '', '', ''));
  const liBusinessList = mapRows(rows, BUSINESS_LIST_PROPS);
  return res.json([{ status: 'true', message: 'success', data: liBusinessList }]);
}));

// public
router.post('/api/Store', asyncHandler(async (req, res) => {
  const MerchantRelatedTo = toInt(req.p.MerchantRelatedTo);
  const params = { ...searchParams(randomNo(), '', '', ''), storetypeid: MerchantRelatedTo };
  const rows = await proc('shopping', 'usp_portalmaster_searching_m', params);
  const list = mapRows(rows, BUSINESS_LIST_PROPS);
  return res.json([{ status: 'true', message: 'success', data: list }]);
}));

// public
router.post('/api/LocationSearch', asyncHandler(async (req, res) => {
  let SerachLocationText = req.p.Location;
  toInt(req.p.CountryID);
  if (SerachLocationText === undefined || SerachLocationText === null) throw nre();
  SerachLocationText = String(SerachLocationText).split('+apostopis').join("'");
  const CID = 96;
  const rows = await proc('shopping', 'usp_master_pincode_area_city_state_m', {
    keyupvalue: SerachLocationText.trim(), cid: String(CID).trim(),
  });
  let lst = '';
  for (const r of rows) {
    lst += str(col(r, 'LOCATION'));
    lst += str(col(r, 'AREANAME'));
  }
  return res.json([{ status: 'true', message: 'success', data: lst }]);
}));

// public
router.post('/api/DataSearch', asyncHandler(async (req, res) => {
  let { SearchText, SearchType } = req.p;
  toInt(req.p.CountryID);
  if (SearchText === undefined || SearchText === null) throw nre();
  SearchText = String(SearchText).split('+apostopis').join("'");
  if (SearchType === undefined || SearchType === null) throw nre();
  SearchType = String(SearchType).split('+apostopis').join("'");
  const CID = 96;
  const rows = await proc('shopping', 'usp_searchresult_m', {
    inputsearchtext: SearchText.trim(), ctid: '0', aid: '', cid: String(CID).trim(), searchtype: SearchType.trim(),
  });
  let lst = '';
  for (const r of rows) {
    lst += str(col(r, 'SEARCHRESULT'));
    lst += str(col(r, 'PMID'));
  }
  return res.json([{ status: 'true', message: 'success', data: lst }]);
}));

/** GetAreaName / GetCityName share one stored procedure with output columns */
async function areaCityProc(cityname) {
  const rows = await proc('shopping', 'usp_makingsessionof_area_city', { citynameparam: cityname, cid: 96 });
  return rows[0] || null;
}
async function GetAreaName(cityname) { return str(col(await areaCityProc(cityname), 'areaname')); }
async function GetCityName(cityname) { return str(col(await areaCityProc(cityname), 'cityname')); }

// public
router.post('/api/all_listingProfessional', asyncHandler(async (req, res) => {
  let { keywordid, city, area } = req.p;
  const Sessionid = req.p.Sessionid;
  let Heading = ''; // eslint-disable-line no-unused-vars
  let CityUrl = '';
  let areaUrl = '';
  const IsShowCategory = '1';
  keywordid = keywordid === undefined || keywordid === null ? '' : keywordid;
  city = city === undefined || city === null ? '' : city;
  area = area === undefined || area === null ? '' : area;

  // COUNTRYID is always "96" in legacy, so only the else branch (SettingVisitor(Sessionid)) ever ran
  try {
    await GetCountry.SettingVisitor(Sessionid);
  } catch (ex) { /* ignored like legacy */ }

  // Domain / SEO management block: only its side effects on keywordid / CityUrl / areaUrl matter
  try {
    keywordid = String(keywordid);
    keywordid = keywordid.split('-').join(' ');
    keywordid = keywordid.split('(').join('');
    keywordid = keywordid.split(')').join('');
    keywordid = keywordid.trim();
    // PORT-NOTE: SEO title/meta/canonical locals (and WebsiteDetail.GetListPageDetails, only reachable when city and
    // area are null - never the case here) were unused by the API response and are not ported.
    if (city !== null) {
      city = await GetCityName(city);
      CityUrl = toTitleCase(city.split('-').join(' '));
    }
    if (area !== null) {
      area = await GetAreaName(area);
      areaUrl = toTitleCase(area.split('-').join(' '));
    }
  } catch (ex) { /* swallowed like legacy (var Message = ex.Message) */ }

  const kw = keywordid === null ? '' : String(keywordid).trim();
  const rows = await proc('shopping', 'usp_portalmaster_searching_m',
    searchParams(randomNo(), kw, CityUrl.trim(), areaUrl.trim()));
  const ObjBusinessList = mapRows(rows, BUSINESS_LIST_PROPS);

  let ObjRelatedKeywords = [];
  if (IsShowCategory === '1') {
    const r = await query('shopping',
      'select catid as kmid, catname as keywordname from product_category where catactive = true and categoryrelatedto = 1');
    ObjRelatedKeywords = mapRows(r, ['KMID', 'KEYWORDNAME']).map((x) => ({ KEYWORDNAME: x.KEYWORDNAME, KMID: x.KMID }));
  }
  // (IsShowCategory == "0" branch is unreachable: IsShowCategory is always "1")
  const ObjBusinessListLi = { LiBusinessList: ObjBusinessList, LiRelatedKeywords: ObjRelatedKeywords };
  return res.json([{ status: 'true', message: 'success', data: ObjBusinessListLi }]);
}));

// public
router.post('/api/DetailProfessional', asyncHandler(async (req, res) => {
  const title = req.p.title;
  const objProductImageList = [];
  if (title !== undefined && title !== null && title !== '') {
    const t = String(title).replace(/-/g, ' ').trim();
    let Pmid = await scalar('shopping', 'select pmid from portal_master where active = true and title = @t limit 1', { t });
    Pmid = Pmid === null || Pmid === undefined ? 0 : Pmid;
    // Plid query (unused in legacy, still executed)
    await scalar('shopping', 'select plid from portal_master where active = true and title = @t limit 1', { t });

    const rows = await proc('shopping', 'usp_showproductimage', { pmid: Pmid });
    const details = mapRows(rows, ['rowNumber', 'imageUrl', 'imageTitle']);
    if (details.length === 0) {
      throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.\r\nParameter name: index');
    }
    const strImageWithTitle = str(details[0].imageUrl).split(',');
    let Getimagecount = 0;
    for (const item of strImageWithTitle) {
      if (item.trim() !== '') {
        const s = item.split('!');
        Getimagecount += 1;
        if (s.length < 2) throw new Error('Index was outside the bounds of the array.');
        objProductImageList.push({ rowNumber: Getimagecount, imageUrl: s[0], imageTitle: s[1] });
      }
    }
  }
  return res.json([{ status: 'true', message: 'success', data: objProductImageList }]);
}));

module.exports = router;
