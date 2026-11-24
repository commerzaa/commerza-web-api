/** Exports: class Member_Master (table member_master)   async Get_member_details(long plid) : Member_Master | null  (REGNO == plid) */
'use strict';
const { queryOne } = require('../db');
const { mapRow } = require('../utils/shape');

const PROPS = ['REGNO', 'LOGINID', 'RANKID', 'TITLE', 'FNAME', 'MNAME', 'LNAME', 'USERNAME', 'FATH_HUS_NAME', 'DOB', 'GENDER', 'MARITAL_STATUS', 'ADDRESS', 'CID', 'CTID', 'STATENAME', 'CITYNAME', 'PINCODE', 'MOBILE', 'EMAILID', 'EPIN_NO', 'REGDATE', 'DOC', 'INTROREGNO', 'PARENTREGNO', 'IPADD', 'IMAGENAME', 'ACTIVE', 'STATUS', 'NOMNAME', 'NOMREL', 'NOMDOB', 'PANNO', 'SPONSERID', 'ROOTID', 'LEFTID', 'RIGHTID', 'KYCSTATUS', 'KYCCOMMENT', 'KITPRICE', 'IsMobileSelfVerified', 'IsEmailSelfVerified', 'IsProfileSelfVerified', 'IsReferralAccepted', 'DefaultSponserSide', 'side'];

class Member_Master {
  async Get_member_details(plid) {
    return mapRow(await queryOne('affiliate', 'select * from member_master where regno=@plid limit 1', { plid }), PROPS);
  }
}

module.exports = Member_Master;
