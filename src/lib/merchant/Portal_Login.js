/** Exports: class Portal_Login (table portal_login)   async Get_member_details(Int64 plid) : Portal_Login | null  (PLID == plid) */
'use strict';
const { queryOne } = require('../../db');
const { mapRow } = require('../../utils/shape');

const PROPS = ['PLID', 'CommunitySide', 'PMID', 'LOGINID', 'PASSWORD', 'LASTLOGIN', 'ACTIVE', 'QPAYREGNO', 'REFRAL_ID', 'INTRO_REFID', 'DOC', 'CURRENCYSYMBOL', 'CID', 'USERNAME', 'IPADDRESS', 'TITLE', 'FNAME', 'LNAME', 'PHONE', 'DESIGNATION', 'CPER_EMAILID', 'LASTMAILDATE', 'SUBSCRIPTION_MASTER', 'TBL_NEWSLETTEREMAILID', 'EMAILID', 'USERID', 'TPASSWORD', 'CURRENCY', 'INTRO_PLID', 'IsActive', 'ReferalCode', 'DefaultLandingUrl', 'MultiLandingUrl', 'IMAGENAME', 'TLPMID', 'IsReferralAccepted', 'IsMerchantPanelAccepted', 'iskycapproved'];

class Portal_Login {
  async Get_member_details(plid) {
    return mapRow(await queryOne('shopping', 'select * from portal_login where plid=@plid limit 1', { plid }), PROPS);
  }
}

module.exports = Portal_Login;
