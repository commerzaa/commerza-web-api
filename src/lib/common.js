'use strict';
/**
 * Exports: class common { SaveFavourite(pmid, plid, dealsid): int; GetProductReviewsAndComments(pmid, ReviewType): ListingDetails[];
 *   GetProductReviewsAndCommentsDEAL(DealID); InsertReviewsAndComments(pmid, RWID, NAME, EMAIL, RATE, TYPE, REVIEW, ReviewType);
 *   InsertReviewsAndCommentsDeals(DealID, RWID, NAME, EMAIL, RATE, TYPE, REVIEW); GetFavouriteListOfMember(double plid, int pageno, int pagesize): PortalDetails[];
 *   GetConfigInfo(string configNames): ConfigModel[]; RemoveFavourite(int pmid, double plid): string; RemoveFavouriteDeal(int dealid, double plid): string;
 *   UpdateReferrel(Int64 plid, string ReferrelId): int; UpdateReferrelSide(Int64 plid, string Side): int; IsDefault(Int64 plid, string ReferrelId): int;
 *   static GetIntroRegno(Int64 plid): Int64; static GetReferralAcceptence(Int64 plid): Int64; static GetCustomerPanelAcceptence(Int64 plid): Int64;
 *   static GetMerchantPanelAcceptence(Int64 plid): Int64 }   (all async)
 * PORT-NOTE: procedures/tables USP_SAVED_AD, SAVED_AD, USP_GETFAVLISTINGSOFMEMBER... exist only in the Db_Shopping dump; calls try Db_Affiliate (legacy
 * DataBaseContext) first and fall back to Db_Shopping when the object does not exist.
 * PORT-NOTE: EF SaveChanges() return value (0 when nothing changed) is reproduced by comparing current vs new values.
 */
const db = require('../db');
const { mapRows } = require('./../utils/shape');
const { out, errorInsert, withFallback, procFallback } = require('./_libhelpers');

const ListingDetails = ['rowNumber', 'rcid', 'name', 'title', 'rcdesc', 'rORc', 'rate', 'totalreviews', 'avgRate', 'date'];
const PortalDetails = ['ROWNUMBER', 'ACTIVE', 'COMPANYDESC', 'COMPANYNAME', 'COMPANYIMAGE', 'PMID', 'TITLE', 'MOBILENO', 'WEBSITEURL',
  'ADDRESS', 'ACCOUNTTYPE', 'COMEMAILID', 'YEAROFESTABLE', 'COMPLETEADDRESS', 'URL', 'ALLKEYWORD', 'AVGRATING', 'TOTALREVIEWS'];
const ConfigModel = ['TEXT', 'VALUE'];

const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const toInt32 = (s) => {
  const v = String(s).trim();
  if (!/^[+-]?\d+$/.test(v)) throw new Error('Input string was not in a correct format.');
  const n = parseInt(v, 10);
  if (n > 2147483647 || n < -2147483648) throw new Error('Value was either too large or too small for an Int32.');
  return n;
};

class common {
  async SaveFavourite(pmid, plid, dealsid) {
    const row = await procFallback('affiliate', 'usp_saved_ad', { pmid, plid, dealsid });
    const first = row[0];
    const v = out(first || null, 'intresult');
    if (v === null || v === undefined) throw NRE();
    return toInt32(v);
  }

  async GetProductReviewsAndComments(pmid, ReviewType) {
    // legacy SQL text only passes @PMID (the @REVIEWTYPE parameter is unused by the command text)
    const rows = await procFallback('affiliate', 'usp_getproductreviewsandcomments', { pmid });
    return mapRows(rows, ListingDetails);
  }

  async GetProductReviewsAndCommentsDEAL(DealID) {
    const rows = await procFallback('affiliate', 'usp_getproductreviewsandcommentsdeal', { dealid: DealID });
    return mapRows(rows, ListingDetails);
  }

  async InsertReviewsAndComments(pmid, RWID, NAME, EMAIL, RATE, TYPE, REVIEW, ReviewType) {
    const rows = await procFallback('affiliate', 'usp_insreviewsandcomments', {
      pmid, rwid: RWID, name: NAME, emailid: EMAIL, rate: RATE, reviewcommentdesc: REVIEW, type: TYPE, reviewtype: ReviewType,
    });
    return mapRows(rows, ListingDetails);
  }

  async InsertReviewsAndCommentsDeals(DealID, RWID, NAME, EMAIL, RATE, TYPE, REVIEW) {
    const rows = await procFallback('affiliate', 'usp_insreviewsandcommentsdeal', {
      dealid: DealID, rwid: RWID, name: NAME, emailid: EMAIL, rate: RATE, reviewcommentdesc: REVIEW, type: TYPE,
    });
    return mapRows(rows, ListingDetails);
  }

  async GetFavouriteListOfMember(plid, pageno, pagesize) {
    const rows = await procFallback('affiliate', 'usp_getfavlistingsofmember', { plid, pageno, pagesize });
    return mapRows(rows, PortalDetails);
  }

  // get configuration value with multiple config_name
  async GetConfigInfo(configNames) {
    // legacy: [Db_Shopping].[DBO].[USP_GET_COFIG_DATA]
    const rows = await db.proc('shopping', 'usp_get_cofig_data', { config_name: configNames });
    return mapRows(rows, ConfigModel);
  }

  async RemoveFavourite(pmid, plid) {
    let ret = '0';
    try {
      const n = await withFallback('affiliate', (d) => db.exec(d, 'delete from saved_ad where pmid = @pmid and plid = @plid', { pmid, plid }));
      ret = String(n);
    } catch (ExpObj) {
      ret = ExpObj.message;
      await errorInsert('RemoveFavourite', 'Dal/common', ExpObj);
    }
    return ret;
  }

  async RemoveFavouriteDeal(dealid, plid) {
    let ret = '0';
    try {
      const n = await withFallback('affiliate', (d) => db.exec(d, 'delete from saved_ad where plid = @plid and dealsid = @dealid', { plid, dealid }));
      ret = String(n);
    } catch (ExpObj) {
      ret = ExpObj.message;
      await errorInsert('RemoveFavouriteDeal', 'Dal/common', ExpObj);
    }
    return ret;
  }

  async UpdateReferrel(plid, ReferrelId) {
    let ret = 0;
    if (ReferrelId === null || ReferrelId === undefined || ReferrelId === '') {
      ret = 2;
      return ret;
    }
    return withFallback('affiliate', async (d) => {
      let portallogin = await db.queryOne(d, 'select plid from portal_login where plid <> @plid and refral_id = @ReferrelId limit 1', { plid, ReferrelId });
      if (portallogin !== null) {
        ret = 3;
        return ret;
      }
      portallogin = await db.queryOne(d, 'select plid, refral_id from portal_login where plid = @plid limit 1', { plid });
      if (portallogin === null) throw NRE();
      if (portallogin.refral_id !== ReferrelId) {
        ret = await db.exec(d, 'update portal_login set refral_id = @ReferrelId where plid = @plid', { ReferrelId, plid });
      } else {
        ret = 0;
      }
      return ret;
    });
  }

  async UpdateReferrelSide(plid, Side) {
    let ret = 0;
    if (Side === null || Side === undefined || Side === '' || Side === 'undefined') {
      ret = 2;
      return ret;
    }
    return withFallback('affiliate', async (d) => {
      let portallogin = await db.queryOne(d, 'select plid from portal_login where plid <> @plid limit 1', { plid });
      if (portallogin !== null) {
        portallogin = await db.queryOne(d, 'select plid, communityside from portal_login where plid = @plid limit 1', { plid });
        if (portallogin === null) throw NRE();
        const side = toInt32(Side);
        if (portallogin.communityside !== side) {
          ret = await db.exec(d, 'update portal_login set communityside = @side where plid = @plid', { side, plid });
        } else {
          ret = 0;
        }
      }
      return ret;
    });
  }

  async IsDefault(plid, ReferrelId) {
    return withFallback('affiliate', async (d) => {
      const portallogin = await db.queryOne(d, 'select plid, defaultlandingurl, tlpmid from portal_login where plid = @plid limit 1', { plid });
      if (portallogin === null) throw NRE();
      const tlpmid = toInt32(ReferrelId);
      if (portallogin.defaultlandingurl !== 0 || portallogin.tlpmid !== tlpmid) {
        return db.exec(d, 'update portal_login set defaultlandingurl = 0, tlpmid = @tlpmid where plid = @plid', { tlpmid, plid });
      }
      return 0;
    });
  }

  static async GetIntroRegno(plid) {
    const PLID_T = Math.trunc(Number(plid));
    const row = await db.queryOne('affiliate', 'select introregno from member_master where regno = @PLID_T limit 1', { PLID_T });
    if (row === null) {
      return 0;
    }
    return row.introregno;
  }

  static async GetReferralAcceptence(plid) {
    const PLID_T = Math.trunc(Number(plid));
    const row = await db.queryOne('affiliate', 'select isreferralaccepted from member_master where regno = @PLID_T limit 1', { PLID_T });
    if (row === null) {
      return 0;
    }
    return row.isreferralaccepted;
  }

  static async GetCustomerPanelAcceptence(plid) {
    const PLID_T = Math.trunc(Number(plid));
    const row = await db.queryOne('affiliate', 'select regno from member_master where regno = @PLID_T limit 1', { PLID_T });
    return row === null ? 0 : 1;
  }

  static async GetMerchantPanelAcceptence(plid) {
    const PLID_T = Math.trunc(Number(plid));
    const row = await db.queryOne('affiliate', 'select regno from member_master where regno = @PLID_T limit 1', { PLID_T });
    return row === null ? 0 : 1;
  }
}

module.exports = common;
