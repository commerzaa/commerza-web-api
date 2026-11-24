'use strict';
/**
 * Exports: class ManageOfferData { async GetOfferAvailableList(List<string> SPRID): OfferListModel[];
 *                                  async GetOfferProductList(): product_Master_Custom[] }
 * Uses the Db_Shopping connection (legacy CommonFunc.constr() = shoppingConnection).
 */
const db = require('../db');
const config = require('../config');
const { mapRows } = require('../utils/shape');

const OfferListModel = ['OPID', 'SPRID', 'PRODUCT_ID', 'PRODUCT_NAME', 'OFFER_MST_ID', 'OFFER_TITLE', 'OFFER_START', 'OFFER_END',
  'START_TIME', 'END_TIME', 'IS_ACTIVE', 'INSERTED_ON', 'OFFER_PRICE', 'OFFER_DIS_PERCENTAGE', 'TAG_LINE', 'OFFER_COUNT_DOWN',
  'OFFER_DESCIPTION'];

const product_Master_Custom = ['CashOnDelivery', 'CatId', 'CreatedDate', 'DAP', 'DealsIds', 'DiscountPercentage', 'FullDescription',
  'IsOutOfStock', 'KeyFeatures', 'MainCategoryId', 'ModifyDate', 'MPRID', 'ProcurementSLA', 'ProductCode', 'ProductImages',
  'ProductTitle', 'PrSKUCode', 'RatingStar', 'ReplacementDay', 'RowNo', 'SellMRP', 'ShippingCharges', 'ShotDescription', 'SPRID',
  'StockIn', 'StockNet', 'StockOut', 'SubCategoryId', 'BV', 'PV', 'CASHBACK', 'Main_Cat_Code', 'Sub_Cat_Code', 'Cat_Code',
  'INCLUDINGTAX', 'ACTIVATIONPV_PER'];

class ManageOfferData {
  async GetOfferAvailableList(SPRID) {
    let sb = '0';
    for (let i = 0; i < SPRID.length; i++) {
      sb += SPRID[i] + ','; // legacy builds "0" + "id," (no separator after the leading 0) - kept as is
    }
    const rows = await db.proc('shopping', 'usp_get_offer_list', { sprids: sb });
    return mapRows(rows, OfferListModel);
  }

  async GetOfferProductList() {
    const DID = parseInt(String(config.app.DID), 10);
    const rows = await db.proc('shopping', 'usp_get_offer_products', {
      maincatid: 0, catid: 0, subcatid: 0, sorting: '', querystring: '', pageno: 1, noofrows: 20, totalcount: 0, did: DID,
    });
    const LiAllproduct_Master_latest = mapRows(rows, product_Master_Custom).map((x) => ({ ...x, IS_OFFER: false, OfferDetails: null }));
    const sprids = LiAllproduct_Master_latest.map((x) => String(x.SPRID));
    const offer_list = await this.GetOfferAvailableList(sprids);
    for (const item of LiAllproduct_Master_latest) {
      const offer1 = offer_list.find((x) => x.SPRID !== null && x.SPRID !== undefined && Number(x.SPRID) === Number(item.SPRID)) || null;
      if (offer1 !== null) {
        item.IS_OFFER = true;
        item.OfferDetails = offer1;
      }
    }
    return LiAllproduct_Master_latest;
  }
}

module.exports = ManageOfferData;
