/** Exports: class Member_Master (table member_master, Db_Shopping)   async Get_member_details(Int64 plid) : Member_Master | null  (PLID == plid) */
'use strict';
const { queryOne } = require('../../db');
const { mapRow } = require('../../utils/shape');

const PROPS = ['REGNO', 'LOGINID', 'TITLE', 'FNAME', 'MNAME', 'LNAME', 'USERNAME', 'FATH_HUS_NAME', 'DOB', 'GENDER', 'MARITAL_STATUS', 'ADDRESS', 'CID', 'CTID', 'STATENAME', 'CITYNAME', 'PINCODE', 'PHONE', 'MOBILE', 'EMAILID', 'EPIN_NO', 'REGDATE', 'DOC', 'INTROREGNO', 'PARENTREGNO', 'IPADD', 'IMAGENAME', 'ACTIVE', 'STATUS', 'BANKNAME', 'BRANCHNAME', 'ACCOUNTNO', 'IFSCCODE', 'NOMNAME', 'NOMREL', 'NOMDOB', 'PANNO', 'SPONSERID', 'ROOTID', 'LEFTID', 'RIGHTID', 'OLD_DOC', 'KYCSTATUS', 'CHALLANIMAGE', 'CHALLANSUBMITTEDDATE', 'CHALLANVERIFYDATE', 'COMMENTORREMARK', 'PAYMENTMODENAME', 'MEMBER_UNIQUE_ID', 'PAYMENTREMARK', 'DTHCUSTOMERID', 'APPLICATION_FORMNO', 'KYCCOMMENT', 'PLID', 'ChequeNumber', 'ChequeDate', 'IS_PROFILE_STATUS', 'IsMobileSelfVerified', 'IsEmailSelfVerified', 'IsProfileSelfVerified', 'IsReferralAccepted', 'IsCustomerPanelAccepted', 'IsMerchantPanelAccepted', 'CustomerPanelAcceptedDate', 'MerchantPanelAcceptedDate'];

class Member_Master {
  async Get_member_details(plid) {
    return mapRow(await queryOne('shopping', 'select * from member_master where plid=@plid limit 1', { plid }), PROPS);
  }
}

module.exports = Member_Master;
