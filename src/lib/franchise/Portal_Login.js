/** Exports: class Portal_Login (table tbl_distributor)   async Get_member_details(Int64 plid) : Portal_Login | null  (DID == plid) */
'use strict';
const { queryOne } = require('../../db');
const { mapRow } = require('../../utils/shape');

const PROPS = ['DID', 'CommunitySide', 'PMID', 'LOGINID', 'PASSWORD', 'LASTLOGIN', 'ACTIVE', 'REFRAL_ID', 'INTRO_REFID', 'DOC', 'CURRENCYSYMBOL', 'CID', 'USERNAME', 'IPADDRESS', 'TITLE', 'FNAME', 'LNAME', 'PHONE', 'DESIGNATION', 'EMAILID', 'USERID', 'TPASSWORD', 'CURRENCY', 'INTRO_PLID', 'ReferalCode', 'DefaultLandingUrl', 'IMAGENAME', 'TLPMID', 'IsReferralAccepted', 'IsDISTRIBUTORPanelAccepted', 'iskycapproved'];

class Portal_Login {
  async Get_member_details(plid) {
    return mapRow(await queryOne('shopping', 'select * from tbl_distributor where did=@plid limit 1', { plid }), PROPS);
  }
}

module.exports = Portal_Login;
