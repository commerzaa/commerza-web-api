/** Exports: class KYC (table kyc; props id, Regno, Type, Image, isAprove, IsDeleted, Country, LastUpdatedDate, IsFirstTimeOrAfterRejection, KYCTYPE, IDType, imagedoc2, IdNo, dtm_date, dtm_Aprove, CommentOrRemark)
 *   async kycList(int regno, string type) : KYC | null  (Regno && Type, first by id)
 *   async Get_VerificationStatus(Int64 regno) : int  (0 if a pending (isAprove 0) row exists, else 1 if an approved row exists, else 2; errors => 2)
 *   async Get_Pending_kyc_status() : int  (count of distinct IdNo with isAprove == 0; errors => 0)
 *   async Get_Pending_kyc_status_By_RegNo(Int64 regno) : bool  (member_master.kycstatus == true; null/missing/errors => false)
 */
'use strict';
const { queryOne, scalar } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('KYC', 'kyc', { id: 0, Regno: 0, Type: null, Image: null, isAprove: 0, IsDeleted: 0, Country: null, LastUpdatedDate: null, IsFirstTimeOrAfterRejection: 0, KYCTYPE: 0, IDType: null, imagedoc2: null, IdNo: null, dtm_date: null, dtm_Aprove: null, CommentOrRemark: null });

class KYC extends Base {
  async kycList(regno, type) {
    return Base.map(await queryOne(DB, 'select * from kyc where regno=@regno and type=@type order by id limit 1', { regno, type }));
  }

  async Get_VerificationStatus(regno) {
    let returnval = 2;
    try {
      let row = await queryOne(DB, 'select isaprove from kyc where isaprove=0 and regno=@regno order by id limit 1', { regno });
      if (row !== null) {
        returnval = row.isaprove;
        return returnval;
      }
      row = await queryOne(DB, 'select isaprove from kyc where isaprove=1 and regno=@regno order by id limit 1', { regno });
      if (row !== null) {
        returnval = row.isaprove;
        return returnval;
      }
    } catch (ex) {
      // legacy: swallowed
    }
    return returnval;
  }

  async Get_Pending_kyc_status() {
    let returnval = 0;
    try {
      const row = await scalar(DB, 'select count(*) from (select distinct idno from kyc where isaprove=0) t');
      if (row !== null) {
        returnval = Number(row);
      }
    } catch (ex) {
      // legacy: swallowed
    }
    return returnval;
  }

  async Get_Pending_kyc_status_By_RegNo(regno) {
    try {
      const row = await queryOne(DB, 'select kycstatus from member_master where regno=@regno limit 1', { regno });
      if (row !== null) {
        if (row.kycstatus === null || row.kycstatus === undefined) {
          return false;
        }
        if (row.kycstatus === true || Number(row.kycstatus) === 1) {
          return true;
        } else {
          return false;
        }
      } else {
        return false;
      }
    } catch (ex) {
      return false;
    }
  }
}

module.exports = KYC;
