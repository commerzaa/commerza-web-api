/**
 * Exports: class ClassifiedAds {
 *   async PostNewAd(Seller_Name, Seller_Email, Seller_ContactNo, Seller_Address, int Seller_Cid, int Seller_ctid, int SCatID, YourAre, Ad_Title, Ad_Price, Ad_Type,
 *     YouWantTo, int IsCertifiedAd, Certified_Image_Name, int IsFeaturedAd, Condition, Ad_Images, Ad_Description, Ad_CID, Ad_Area, Ad_Pincode, Ad_CTID, Ad_AID,
 *     Attributes, VCode, Pr_Type, Brand, Model, imageByteCode, int Selected_Pay_Value, PostAd_PayMode, PostAd_BankName, PostAd_DDChNo, PostAd_ChDate,
 *     PostAd_PayRemark, PostAd_PayLoginID, PostAd_PayPassword, double Plid, int Optid): string[3];
 *   async Product_Cat_And_SubCat_List(): Product_Cat_And_SubCat }
 * Portal DataBaseContext = Db_Shopping.
 * PORT-NOTE: usp_postNewAd is NOT in the Db_Shopping schema dump (must be created). PostgreSQL functions do not report "rows affected";
 *   a returned result row is treated as affectedRows > 0. In that branch the legacy code wrote ret[3] into a 3-element array, which threw
 *   IndexOutOfRangeException - reproduced (RangeError) after ret[0]/ret[1] are set.
 */
'use strict';
const db = require('../../db');

const col = (row, name) => {
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase());
  return k !== undefined ? row[k] : undefined;
};

class ClassifiedAds {
  // eslint-disable-next-line no-unused-vars
  async PostNewAd(Seller_Name, Seller_Email, Seller_ContactNo, Seller_Address, Seller_Cid, Seller_ctid, SCatID, YourAre, Ad_Title, Ad_Price, Ad_Type,
    YouWantTo, IsCertifiedAd, Certified_Image_Name, IsFeaturedAd, Condition, Ad_Images, Ad_Description, Ad_CID, Ad_Area, Ad_Pincode, Ad_CTID, Ad_AID,
    Attributes, VCode, Pr_Type, Brand, Model, imageByteCode, Selected_Pay_Value, PostAd_PayMode, PostAd_BankName, PostAd_DDChNo, PostAd_ChDate,
    PostAd_PayRemark, PostAd_PayLoginID, PostAd_PayPassword, Plid, Optid) {
    const ret = [null, null, null];
    const rows = await db.proc('shopping', 'usp_postnewad', {
      plid: Plid,
      seller_name: Seller_Name,
      seller_email: Seller_Email,
      seller_contactno: Seller_ContactNo,
      seller_address: Seller_Address,
      seller_cid: Seller_Cid,
      seller_ctid: Seller_ctid,
      scatid: SCatID,
      yourare: YourAre,
      ad_title: Ad_Title,
      ad_price: Ad_Price,
      ad_type: Ad_Type,
      youwantto: YouWantTo,
      iscertifiedad: IsCertifiedAd,
      certified_image_name: Certified_Image_Name,
      isfeaturedad: IsFeaturedAd,
      condition: Condition,
      ad_images: Ad_Images,
      ad_description: Ad_Description,
      ad_cid: Ad_CID,
      ad_area: Ad_Area,
      ad_pincode: Ad_Pincode,
      ad_ctid: Ad_CTID,
      ad_aid: Ad_AID,
      optid: Optid,
      extraattr: Attributes,
      ipaddress: '',
      pr_type: Pr_Type,
      brand: Brand,
      model: Model,
      selected_pay_value: Selected_Pay_Value,
      postad_paymode: PostAd_PayMode,
      postad_bankname: PostAd_BankName,
      postad_ddchno: PostAd_DDChNo,
      postad_chdate: PostAd_ChDate,
      postad_payremark: PostAd_PayRemark,
      postad_payloginid: PostAd_PayLoginID,
      postad_paypassword: PostAd_PayPassword,
      intresult: 0,
    });
    const affectedRows = rows.length;
    if (affectedRows > 0) {
      const row = rows[0];
      const adId = col(row, 'ad_id');
      if (adId === null || adId === undefined) throw new TypeError('Object reference not set to an instance of an object.');
      ret[0] = String(adId);
      const sr = col(row, 'strresult');
      ret[1] = sr === null || sr === undefined ? '' : String(sr);
      throw new RangeError('Index was outside the bounds of the array.'); // legacy: ret[3] = TransID on a string[3]
    }
    return ret;
  }

  async Product_Cat_And_SubCat_List() {
    const Product_Cat_And_SubCat = require('./Product_Cat_And_SubCat');
    const objCatAndSubCat = typeof Product_Cat_And_SubCat === 'function' ? new Product_Cat_And_SubCat() : Product_Cat_And_SubCat;
    return objCatAndSubCat.Product_Cat_And_SubCat_List();
  }
}

module.exports = ClassifiedAds;
