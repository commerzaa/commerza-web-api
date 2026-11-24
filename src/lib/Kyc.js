/** Exports: class Kyc (table kyc; props id, Regno, Type, Image, isAprove, dtm_date, dtm_Aprove, CommentOrRemark, IsDeleted, KYCTYPE, TKDID, int_status[not mapped])
 *   async Kyc_list_member_wise(long regno) : Kyc[]            (_kyc_status @regno, @int_status out)
 *   async Kyc_list_member_wise_1(long regno, string type) : Kyc | null  (_kyc_status_Refer_dashborad @regno, @title, @int_status out)
 */
'use strict';
const { proc } = require('../db');
const { mapRows } = require('../utils/shape');

const PROPS = ['id', 'Regno', 'Type', 'Image', 'isAprove', 'dtm_date', 'dtm_Aprove', 'CommentOrRemark', 'IsDeleted', 'KYCTYPE', 'TKDID'];
// int_status is [NotMapped] (the output parameter is not part of the entity)
const withStatus = (rows) => mapRows(rows, PROPS).map((r) => ({ ...r, int_status: 0 }));

class Kyc {
  async Kyc_list_member_wise(regno) {
    return withStatus(await proc('affiliate', '_kyc_status', { regno }));
  }

  async Kyc_list_member_wise_1(regno, type) {
    const rows = withStatus(await proc('affiliate', '_kyc_status_Refer_dashborad', { regno, title: type }));
    return rows[0] || null;
  }
}

module.exports = Kyc;
