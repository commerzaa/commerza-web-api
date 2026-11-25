/** Exports: class OfferManagerDAL { async GetOfferAvailableList(List<string> SPRID): OfferListModel[] } */
'use strict';
// Ported from ClusterofferShopingPortal DAL/OfferManagerDAL.cs. Same logic as ClusterOfferAPI OfferManagerDAL, but the
// portal DataBaseContext is Db_Shopping (the API version tries Db_Affiliate first), so it is ported here with 'shopping'.
const db = require('../../db');
const { mapRows } = require('../../utils/shape');

const OfferListModel = ['OPID', 'SPRID', 'PRODUCT_ID', 'PRODUCT_NAME', 'OFFER_MST_ID', 'OFFER_TITLE', 'OFFER_START', 'OFFER_END',
  'START_TIME', 'END_TIME', 'IS_ACTIVE', 'INSERTED_ON', 'OFFER_PRICE', 'OFFER_DIS_PERCENTAGE', 'TAG_LINE', 'OFFER_COUNT_DOWN',
  'OFFER_DESCIPTION'];

class OfferManagerDAL {
  async GetOfferAvailableList(SPRID) {
    let sb = '';
    for (let i = 0; i < SPRID.length; i++) {
      sb += SPRID[i] + ',';
    }
    const rows = await db.proc('shopping', 'usp_get_offer_list', { sprids: sb });
    return mapRows(rows, OfferListModel);
  }
}

module.exports = OfferManagerDAL;
