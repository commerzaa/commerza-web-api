/** Exports (static class WebsiteDetail, defined in Models/WebsiteDescription.cs; also available as ./WebsiteDetail):
 *   async GetWebsiteInfo(long WID) : WebsiteDescription{Heading,Description,SeoTitle,SeoKeyword,SeoDescription} | null
 *   async GetListPageDetails(string URL) : WebsiteDescription | null
 *   async GetListPageDetailsOfEComm(int Id, int Type) : WebsiteDescription | null
 *   async GetDealsPageDetails(string URL) : WebsiteDescription | null
 *   WebsiteDescription : the property list
 * PORT-NOTE: on any exception the legacy code returned an empty WebsiteDescription (all properties null) before the ErrorInsert block (unreachable) - same here.
 */
'use strict';
const { queryOne } = require('../db');
const { mapRow } = require('../utils/shape');

const PROPS = ['Heading', 'Description', 'SeoTitle', 'SeoKeyword', 'SeoDescription'];
const emptyResult = () => ({ Heading: null, Description: null, SeoTitle: null, SeoKeyword: null, SeoDescription: null });
const one = async (sql, p) => mapRow(await queryOne('affiliate', sql, p), PROPS);

async function GetWebsiteInfo(WID) {
  let Result = emptyResult();
  try {
    Result = await one('Select Heading,Description,SeoTitle,SeoKeyword,SeoDescription From TBL_WEBSITE_CONTENT_MASTER Where WID=@WID limit 1', { WID });
    return Result;
  } catch (ExpObj) {
    return Result;
  }
}

async function GetListPageDetails(URL) {
  let Result = emptyResult();
  try {
    Result = await one(`Select Heading,Description,SeoTitle,SeoKeyword,SeoDescription From TBL_CATEGORY_CONTENT_MASTER
      Where CATID In (Select CATID From PRODUCT_CATEGORY WHERE CATNAME =@URL AND CATACTIVE::int=1) limit 1`, { URL });
    if (Result === null) {
      Result = await one(`Select Heading,Description,SeoTitle,SeoKeyword,SeoDescription From TBL_KEYWORD_CONTENT_MASTER
        Where KID In (SELECT KMID FROM KEYWORD_MASTER WHERE KeyWordName =@URL AND KACTIVE::int=1) limit 1`, { URL });
    }
    return Result;
  } catch (ExpObj) {
    return Result;
  }
}

async function GetListPageDetailsOfEComm(Id, Type) {
  let Result = emptyResult();
  try {
    if (Type === 1) {
      Result = await one('Select Heading,Description,SeoTitle,SeoKeyword,SeoDescription From TBL_E_COM_CATEGORY_CONTENT_MASTER WHERE STATUS::int=1 AND CATID=@Id limit 1', { Id });
    } else if (Type === 2) {
      Result = await one('Select Heading,Description,SeoTitle,SeoKeyword,SeoDescription From TBL_E_COM_SUB_CATEGORY_CONTENT_MASTER WHERE STATUS::int=1 AND SUBCATID=@Id limit 1', { Id });
    } else if (Type === 3) {
      Result = await one('Select Heading,Description,SeoTitle,SeoKeyword,SeoDescription From TBL_E_COM_KEYWORD_CONTENT_MASTER WHERE STATUS::int=1 AND KMID=@Id limit 1', { Id });
    }
    return Result;
  } catch (ExpObj) {
    return Result;
  }
}

async function GetDealsPageDetails(URL) {
  let Result = emptyResult();
  try {
    Result = await one(`Select Heading,Description,SeoTitle,SeoKeyword,SeoDescription From TBL_Deals_CATEGORY_CONTENT_MASTER
      Where CATID In (Select CATID From PRODUCT_CATEGORY WHERE CATNAME =@URL AND CATACTIVE::int=1) limit 1`, { URL });
    if (Result === null) {
      Result = await one(`Select Heading,Description,SeoTitle,SeoKeyword,SeoDescription From TBL_Deals_KEYWORD_CONTENT_MASTER
        Where KID In (SELECT KMID FROM KEYWORD_MASTER WHERE KeyWordName =@URL AND KACTIVE::int=1) limit 1`, { URL });
    }
    return Result;
  } catch (ExpObj) {
    return Result;
  }
}

module.exports = { GetWebsiteInfo, GetListPageDetails, GetListPageDetailsOfEComm, GetDealsPageDetails, WebsiteDescription: PROPS };
