// PORT-NOTE: Franchise copy of ../ReferrelDal using the Db_Shopping connection (Franchise Web.config points everything at Db_Shopping).
'use strict';
/**
 * Exports: class ReferrelDal { GetEwalletAmount(double plid): ewalletAmount[]; GetEwalletDetails(double plid, string fromdate, string toDate, string pageno, string pagesize): EwalletReport[];
 *   GetReferralList(...): ReferalList[]; GetCouponList(...): CouponList[]; updatereamrk(double plid, string aid, string area): string;
 *   deleteCoupon(string cpid): string; GenerateCoupon(double plid, double price, double quantity): string; GenerateReferrel(string CatName, double plid): string }  (all async)
 * PORT-NOTE: these procedures exist in the Db_Shopping dump; calls try Db_Affiliate (legacy DataBaseContext) first and fall back to Db_Shopping.
 * PORT-NOTE: GenerateCoupon returned ExecuteSqlCommand's affected-row count; here it returns the number of rows the function produced as a string.
 */
const { mapRows } = require('../../utils/shape');
const { out, errorInsert, isDbError, procFallback } = require('../_libhelpers');

const ewalletAmount = ['TotalAmount', 'currentAmouunt', 'currencysymbol', 'RecordCount'];
const EwalletReport = ['rowNumber', 'poundAmount', 'amount', 'date', 'tranType', 'crdramount', 'RecordCount'];
const ReferalList = ['rowNumber', 'refral_id', 'LoginId', 'userName', 'doc', 'countryName', 'RecordCount'];
const CouponList = ['rowNumber', 'cpid', 'coupon_number', 'amount', 'status', 'currencysymbol', 'countryName', 'generatedate', 'RecordCount', 'remark'];

class ReferrelDal {
  async GetEwalletAmount(plid) {
    const rows = await procFallback('shopping', 'usp_getewalletdetails', { plid });
    return mapRows(rows, ewalletAmount);
  }

  async GetEwalletDetails(plid, fromdate, toDate, pageno, pagesize) {
    const rows = await procFallback('shopping', 'usp_ewllet_report_new', { fromdate, todate: toDate, pageno, pagesize, plid });
    return mapRows(rows, EwalletReport);
  }

  async GetReferralList(plid, fromdate, toDate, pageno, pagesize) {
    const rows = await procFallback('shopping', 'usp_refraldetails_new', { fromdate, todate: toDate, pageno, pagesize, plid });
    return mapRows(rows, ReferalList);
  }

  async GetCouponList(plid, fromdate, toDate, pageno, pagesize) {
    const rows = await procFallback('shopping', 'usp_coupon_list', { fromdate, todate: toDate, pageno, pagesize, plid });
    return mapRows(rows, CouponList);
  }

  async updatereamrk(plid, aid, area) {
    let ret = '0';
    try {
      const rows = await procFallback('shopping', 'usp_remarkcoupon', { cpid: aid, remark: area });
      const v = out(rows[0] || null, 'result');
      if (v === null || v === undefined) throw new TypeError('Object reference not set to an instance of an object.');
      ret = String(v);
      return ret;
    } catch (ExpObj) {
      if (!isDbError(ExpObj)) throw ExpObj;
      ret = 'error' + String(ExpObj.stack || ExpObj);
      await errorInsert('DisbaleGoogleAuthentication', 'DAL/ReferrelDal', ExpObj);
    }
    return ret;
  }

  async deleteCoupon(cpid) {
    let ret = '0';
    try {
      const rows = await procFallback('shopping', 'usp_deletegeneratedcoupon', { cpid });
      const v = out(rows[0] || null, 'result');
      if (v === null || v === undefined) throw new TypeError('Object reference not set to an instance of an object.');
      ret = String(v);
      return ret;
    } catch (ExpObj) {
      if (!isDbError(ExpObj)) throw ExpObj;
      ret = 'error' + String(ExpObj.stack || ExpObj);
      await errorInsert('deleteCoupon', 'DAL/ReferrelDal', ExpObj);
    }
    return ret;
  }

  async GenerateCoupon(plid, price, quantity) {
    let ret = '0';
    try {
      const rows = await procFallback('shopping', 'sp_generatecoupon_new', {
        plid,
        totalamount: Number(price) * Number(quantity),
        qty: Number(quantity),
        amount: Number(price),
      });
      ret = String(rows.length);
    } catch (ExpObj) {
      if (!isDbError(ExpObj)) throw ExpObj;
      ret = 'error' + String(ExpObj.stack || ExpObj);
      await errorInsert('GenerateCoupon', 'DAL/ReferrelDal', ExpObj);
    }
    return ret;
  }

  async GenerateReferrel(CatName, plid) {
    let ret = '0';
    try {
      let s = CatName;
      let referallink;
      if (s.includes(' ')) {
        s = s.split(' ').join('_');
        referallink = s;
      } else {
        referallink = s;
      }
      // @intresult is an OUTPUT parameter (not an input of the PostgreSQL function)
      await procFallback('shopping', 'usp_generatereferal', { referallink, plid });
    } catch (ExpObj) {
      if (!isDbError(ExpObj)) throw ExpObj;
      ret = 'error' + String(ExpObj.stack || ExpObj);
      await errorInsert('GenerateReferrel', 'DAL/ReferrelDal', ExpObj);
    }
    return ret;
  }
}

module.exports = ReferrelDal;
