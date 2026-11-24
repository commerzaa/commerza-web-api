/** Exports: class Kyc (table kyc_distributor; props Regno, Type, Image, isAprove, dtm_date, dtm_Aprove, CommentOrRemark, IsDeleted, KYCTYPE, AddressType, AddressNumber, int_status[not mapped])
 *   async Kyc_list_member_wise(Int64 regno) : Kyc[]                    (_kyc_status @regno, @int_status out)
 *   async Kyc_list_member_wise_1(Int64 regno, string type) : Kyc|null   (_KYC_STATUS_REFER_DASHBORAD_reseller @regno, @title, @int_status out)
 */
'use strict';
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');

const PROPS = ['Regno', 'Type', 'Image', 'isAprove', 'dtm_date', 'dtm_Aprove', 'CommentOrRemark', 'IsDeleted', 'KYCTYPE', 'AddressType', 'AddressNumber'];
const withStatus = (rows) => mapRows(rows, PROPS).map((r) => ({ ...r, int_status: 0 }));

class Kyc {
  async Kyc_list_member_wise(regno) {
    return withStatus(await proc('shopping', '_kyc_status', { regno }));
  }

  async Kyc_list_member_wise_1(regno, type) {
    const rows = withStatus(await proc('shopping', '_kyc_status_refer_dashborad_reseller', { regno, title: type }));
    return rows[0] || null;
  }
}

module.exports = Kyc;
