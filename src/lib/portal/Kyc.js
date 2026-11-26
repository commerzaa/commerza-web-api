/** Exports: class Kyc (table kyc; props CLID, Type, Image, isAprove, dtm_date, CommentOrRemark, IsDeleted, KYCTYPE, AddressType, AddressNumber, int_status[not mapped])
 *   async Kyc_list_member_wise(Int64 regno) : Kyc[]                    (_kyc_status @regno, @int_status out)
 *   async Kyc_list_member_wise_1(Int64 regno, string type) : Kyc|null   (_kyc_status_Refer_dashborad @regno, @title, @int_status out)
 * Differs from ../merchant/Kyc: the portal entity's key property is CLID (not Regno) and it has no dtm_Aprove property.
 */
'use strict';
const { proc } = require('../../db');
const { mapRows } = require('../../utils/shape');

const PROPS = ['CLID', 'Type', 'Image', 'isAprove', 'dtm_date', 'CommentOrRemark', 'IsDeleted', 'KYCTYPE', 'AddressType', 'AddressNumber'];
// SqlQuery<Kyc> leaves non-returned non-nullable members at their default (CLID = 0); int_status is [NotMapped] (0)
const shape = (rows) => mapRows(rows, PROPS).map((r) => ({ ...r, CLID: r.CLID === null ? 0 : r.CLID, int_status: 0 }));

class Kyc {
  async Kyc_list_member_wise(regno) {
    return shape(await proc('shopping', '_kyc_status', { regno }));
  }

  async Kyc_list_member_wise_1(regno, type) {
    const rows = shape(await proc('shopping', '_kyc_status_refer_dashborad', { regno, title: type }));
    return rows[0] || null;
  }
}
Kyc.PROPS = PROPS;
Kyc.TABLE = 'kyc';

module.exports = Kyc;
