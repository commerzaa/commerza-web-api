'use strict';
/** Exports: class OfferManagerDAL { async GetOfferAvailableList(List<string> SPRID): OfferListModel[] } */
const { procFallback } = require('./_libhelpers');
const { mapRows } = require('../utils/shape');

const OfferListModel = ['OPID', 'SPRID', 'PRODUCT_ID', 'PRODUCT_NAME', 'OFFER_MST_ID', 'OFFER_TITLE', 'OFFER_START', 'OFFER_END',
  'START_TIME', 'END_TIME', 'IS_ACTIVE', 'INSERTED_ON', 'OFFER_PRICE', 'OFFER_DIS_PERCENTAGE', 'TAG_LINE', 'OFFER_COUNT_DOWN',
  'OFFER_DESCIPTION'];

class OfferManagerDAL {
  async GetOfferAvailableList(SPRID) {
    let sb = '';
    for (let i = 0; i < SPRID.length; i++) {
      sb += SPRID[i] + ',';
    }
    // PORT-NOTE: procedure exists in the Db_Shopping dump; procFallback tries Db_Affiliate (legacy DataBaseContext) first.
    const rows = await procFallback('affiliate', 'usp_get_offer_list', { sprids: sb });
    return mapRows(rows, OfferListModel);
  }
}

module.exports = OfferManagerDAL;
