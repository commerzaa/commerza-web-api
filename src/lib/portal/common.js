/**
 * Exports: class common { async SaveFavourite(int pmid, int plid, int dealsid): int; async GetProductReviewsAndComments(int pmid, int ReviewType): ListingDetails[];
 *   async GetProductReviewsAndCommentsDEAL(int DealID); async InsertReviewsAndComments(pmid, RWID, NAME, EMAIL, RATE, TYPE, REVIEW, ReviewType);
 *   async InsertReviewsAndCommentsDeals(DealID, RWID, NAME, EMAIL, RATE, TYPE, REVIEW); async GetFavouriteListOfMember(double plid, int pageno, int pagesize): PortalDetails[];
 *   async RemoveFavourite(int pmid, double plid): string; async RemoveFavouriteDeal(int dealid, double plid): string;
 *   async UpdateReferrel(Int64 plid, string ReferrelId): int; async UpdateReferrelSide(Int64 plid, string Side): int; async IsDefault(Int64 plid, string ReferrelId): int;
 *   static async GetIntroRegno(Int64 plid); GetReferralAcceptence; GetCustomerPanelAcceptence; GetMerchantPanelAcceptence (all Int64) }
 * Portal (ClusterofferShopingPortal DAL/common.cs) differences vs Merchant: GetMerchantPanelAcceptence reads Member_Master.IsMerchantPanelAccepted;
 *   no GetMerchantKycAcceptence / GetMerchantAggrementAcceptence / GetUserWalletBalance / GetPMID.
 * PORT-NOTE: Portal DataBaseContext = Db_Shopping. Entities: Portal_Login=portal_login(plid), Member_Master=member_master(plid col).
 * PORT-NOTE: EF SaveChanges() return value (0 when nothing changed) is reproduced by comparing current vs new values.
 */
'use strict';
const db = require('../../db');
const { mapRows } = require('../../utils/shape');

const ListingDetails = ['rowNumber', 'rcid', 'name', 'title', 'rcdesc', 'rORc', 'rate', 'totalreviews', 'avgRate', 'date'];
const PortalDetails = ['ROWNUMBER', 'ACTIVE', 'COMPANYDESC', 'COMPANYNAME', 'COMPANYIMAGE', 'PMID', 'TITLE', 'MOBILENO', 'WEBSITEURL',
  'ADDRESS', 'ACCOUNTTYPE', 'COMEMAILID', 'YEAROFESTABLE', 'COMPLETEADDRESS', 'URL', 'ALLKEYWORD', 'AVGRATING', 'TOTALREVIEWS'];

const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const toInt32 = (s) => {
  const v = String(s).trim();
  if (!/^[+-]?\d+$/.test(v)) throw new Error('Input string was not in a correct format.');
  const n = parseInt(v, 10);
  if (n > 2147483647 || n < -2147483648) throw new Error('Value was either too large or too small for an Int32.');
  return n;
};
const D = 'shopping';
const outv = (row, name) => {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase());
  if (k !== undefined) return row[k];
  const ks = Object.keys(row);
  return ks.length === 1 ? row[ks[0]] : null;
};
const asInt = (plid) => Math.trunc(Number(plid)); // Convert.ToInt32(plid)

class common {
  async SaveFavourite(pmid, plid, dealsid) {
    const row = await db.procOne(D, 'usp_saved_ad', { pmid, plid, dealsid });
    const v = outv(row, 'intresult');
    if (v === null || v === undefined) throw NRE();
    return toInt32(v);
  }

  async GetProductReviewsAndComments(pmid, ReviewType) {
    // legacy SQL text only passes @PMID (the @REVIEWTYPE parameter is unused by the command text)
    return mapRows(await db.proc(D, 'usp_getproductreviewsandcomments', { pmid }), ListingDetails);
  }

  async GetProductReviewsAndCommentsDEAL(DealID) {
    return mapRows(await db.proc(D, 'usp_getproductreviewsandcommentsdeal', { dealid: DealID }), ListingDetails);
  }

  async InsertReviewsAndComments(pmid, RWID, NAME, EMAIL, RATE, TYPE, REVIEW, ReviewType) {
    // legacy command text has 9 positional placeholders ending with @ReviewType
    return mapRows(await db.proc(D, 'usp_insreviewsandcomments', {
      pmid, rwid: RWID, name: NAME, emailid: EMAIL, rate: RATE, reviewcommentdesc: REVIEW, type: TYPE, reviewtype: ReviewType,
    }), ListingDetails);
  }

  async InsertReviewsAndCommentsDeals(DealID, RWID, NAME, EMAIL, RATE, TYPE, REVIEW) {
    return mapRows(await db.proc(D, 'usp_insreviewsandcommentsdeal', {
      dealid: DealID, rwid: RWID, name: NAME, emailid: EMAIL, rate: RATE, reviewcommentdesc: REVIEW, type: TYPE,
    }), ListingDetails);
  }

  async GetFavouriteListOfMember(plid, pageno, pagesize) {
    return mapRows(await db.proc(D, 'usp_getfavlistingsofmember', { plid, pageno, pagesize }), PortalDetails);
  }

  async RemoveFavourite(pmid, plid) {
    let ret = '0';
    try {
      ret = String(await db.exec(D, 'delete from saved_ad where pmid = @pmid and plid = @plid', { pmid, plid }));
    } catch (ex) {
      ret = ex.message;
    }
    return ret;
  }

  async RemoveFavouriteDeal(dealid, plid) {
    let ret = '0';
    try {
      ret = String(await db.exec(D, 'delete from saved_ad where plid = @plid and dealsid = @dealid', { plid, dealid }));
    } catch (ex) {
      ret = ex.message;
    }
    return ret;
  }

  async UpdateReferrel(plid, ReferrelId) {
    let ret = 0;
    if (ReferrelId === null || ReferrelId === undefined || ReferrelId === '') {
      ret = 2;
      return ret;
    }
    let portallogin = await db.queryOne(D, 'select plid from portal_login where plid <> @plid and refral_id = @ReferrelId limit 1', { plid, ReferrelId });
    if (portallogin !== null) {
      ret = 3;
      return ret;
    }
    portallogin = await db.queryOne(D, 'select plid, refral_id from portal_login where plid = @plid limit 1', { plid });
    if (portallogin === null) throw NRE();
    if (portallogin.refral_id !== ReferrelId) {
      ret = await db.exec(D, 'update portal_login set refral_id = @ReferrelId where plid = @plid', { ReferrelId, plid });
    } else {
      ret = 0;
    }
    return ret;
  }

  async UpdateReferrelSide(plid, Side) {
    let ret = 0;
    if (Side === null || Side === undefined || Side === '' || Side === 'undefined') {
      ret = 2;
      return ret;
    }
    let portallogin = await db.queryOne(D, 'select plid from portal_login where plid <> @plid limit 1', { plid });
    if (portallogin !== null) {
      portallogin = await db.queryOne(D, 'select plid, communityside from portal_login where plid = @plid limit 1', { plid });
      if (portallogin === null) throw NRE();
      const side = toInt32(Side);
      if (portallogin.communityside !== side) {
        ret = await db.exec(D, 'update portal_login set communityside = @side where plid = @plid', { side, plid });
      } else {
        ret = 0;
      }
    }
    return ret;
  }

  async IsDefault(plid, ReferrelId) {
    const portallogin = await db.queryOne(D, 'select plid, defaultlandingurl, tlpmid from portal_login where plid = @plid limit 1', { plid });
    if (portallogin === null) throw NRE();
    const tlpmid = toInt32(ReferrelId);
    if (portallogin.defaultlandingurl !== 0 || portallogin.tlpmid !== tlpmid) {
      return db.exec(D, 'update portal_login set defaultlandingurl = 0, tlpmid = @tlpmid where plid = @plid', { tlpmid, plid });
    }
    return 0;
  }

  static async GetIntroRegno(plid) {
    const PLID_T = asInt(plid);
    const row = await db.queryOne(D, 'select introregno from member_master where plid = @PLID_T limit 1', { PLID_T });
    return row === null ? 0 : row.introregno;
  }

  static async GetReferralAcceptence(plid) {
    const PLID_T = asInt(plid);
    const row = await db.queryOne(D, 'select isreferralaccepted from member_master where plid = @PLID_T limit 1', { PLID_T });
    return row === null ? 0 : row.isreferralaccepted;
  }

  static async GetCustomerPanelAcceptence(plid) {
    const PLID_T = asInt(plid);
    const row = await db.queryOne(D, 'select iscustomerpanelaccepted from member_master where plid = @PLID_T limit 1', { PLID_T });
    return row === null ? 0 : row.iscustomerpanelaccepted;
  }

  static async GetMerchantPanelAcceptence(plid) {
    const PLID_T = asInt(plid);
    const row = await db.queryOne(D, 'select ismerchantpanelaccepted from member_master where plid = @PLID_T limit 1', { PLID_T });
    return row === null ? 0 : row.ismerchantpanelaccepted;
  }
}

module.exports = common;
