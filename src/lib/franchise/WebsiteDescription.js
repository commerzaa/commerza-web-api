/** Exports (C# static class WebsiteDetail in Models/WebsiteDescription.cs): all async, return WebsiteDescription{Heading,Description,SeoTitle,SeoKeyword,SeoDescription}|null
 *   GetWebsiteInfo(long WID) ; GetListPageDetails(string URL) ; GetListPageDetailsOfEComm(int Id, int Type) ; GetDealsPageDetails(string URL)
 *  (GetListPageDetailsOfEComm returns an all-null WebsiteDescription when Type is not 1..3). Exceptions propagate (no try/catch in the C#).
 *  Also exported as WebsiteDetail.
 */
'use strict';
const { queryOne } = require('../../db');
const { mapRow } = require('../../utils/shape');

const PROPS = ['Heading', 'Description', 'SeoTitle', 'SeoKeyword', 'SeoDescription'];
const emptyResult = () => ({ Heading: null, Description: null, SeoTitle: null, SeoKeyword: null, SeoDescription: null });
const one = async (sql, p) => mapRow(await queryOne('shopping', sql, p), PROPS);

async function GetWebsiteInfo(WID) {
  return one('Select Heading,Description,SeoTitle,SeoKeyword,SeoDescription From TBL_WEBSITE_CONTENT_MASTER Where WID=@WID limit 1', { WID });
}

async function GetListPageDetails(URL) {
  let Result = await one(`Select Heading,Description,SeoTitle,SeoKeyword,SeoDescription From TBL_CATEGORY_CONTENT_MASTER
    Where CATID In (Select CATID From PRODUCT_CATEGORY WHERE CATNAME =@URL AND CATACTIVE::int=1) limit 1`, { URL });
  if (Result === null) {
    Result = await one(`Select Heading,Description,SeoTitle,SeoKeyword,SeoDescription From TBL_KEYWORD_CONTENT_MASTER
      Where KID In (SELECT KMID FROM KEYWORD_MASTER WHERE KeyWordName =@URL AND KACTIVE::int=1) limit 1`, { URL });
  }
  return Result;
}

async function GetListPageDetailsOfEComm(Id, Type) {
  let Result = emptyResult();
  if (Type === 1) {
    Result = await one('Select Heading,Description,SeoTitle,SeoKeyword,SeoDescription From TBL_E_COM_CATEGORY_CONTENT_MASTER WHERE STATUS::int=1 AND CATID=@Id limit 1', { Id });
  } else if (Type === 2) {
    Result = await one('Select Heading,Description,SeoTitle,SeoKeyword,SeoDescription From TBL_E_COM_SUB_CATEGORY_CONTENT_MASTER WHERE STATUS::int=1 AND SUBCATID=@Id limit 1', { Id });
  } else if (Type === 3) {
    Result = await one('Select Heading,Description,SeoTitle,SeoKeyword,SeoDescription From TBL_E_COM_KEYWORD_CONTENT_MASTER WHERE STATUS::int=1 AND KMID=@Id limit 1', { Id });
  }
  return Result;
}

async function GetDealsPageDetails(URL) {
  let Result = await one(`Select Heading,Description,SeoTitle,SeoKeyword,SeoDescription From TBL_Deals_CATEGORY_CONTENT_MASTER
    Where CATID In (Select CATID From PRODUCT_CATEGORY WHERE CATNAME =@URL AND CATACTIVE::int=1) limit 1`, { URL });
  if (Result === null) {
    Result = await one(`Select Heading,Description,SeoTitle,SeoKeyword,SeoDescription From TBL_Deals_KEYWORD_CONTENT_MASTER
      Where KID In (SELECT KMID FROM KEYWORD_MASTER WHERE KeyWordName =@URL AND KACTIVE::int=1) limit 1`, { URL });
  }
  return Result;
}

const WebsiteDetail = { GetWebsiteInfo, GetListPageDetails, GetListPageDetailsOfEComm, GetDealsPageDetails };
module.exports = { ...WebsiteDetail, WebsiteDetail };
