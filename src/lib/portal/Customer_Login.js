/** Exports: class Customer_Login (table tbl_customerlogin; props: see Customer_Login.PROPS)
 *   async Get_member_details(Int64 plid) : Customer_Login|null   (row with CLID == plid)
 *   async GetUserMobileStatus(Int64 plid) : int                   (COUNT of rows with CLID == plid AND PHONE IS NULL)
 */
'use strict';
const { queryOne, scalar } = require('../../db');
const { mapRow } = require('../../utils/shape');

const PROPS = ['CLID', 'CommunitySide', 'REGNO', 'PMID', 'LOGINID', 'PASSWORD', 'LASTLOGIN', 'ACTIVE', 'QPAYREGNO', 'REFRAL_ID', 'INTRO_REFID', 'DOC',
  'CURRENCYSYMBOL', 'CID', 'USERNAME', 'IPADDRESS', 'TITLE', 'FNAME', 'LNAME', 'PHONE', 'DESIGNATION', 'CPER_EMAILID', 'LASTMAILDATE',
  'SUBSCRIPTION_MASTER', 'TBL_NEWSLETTEREMAILID', 'EMAILID', 'USERID', 'TPASSWORD', 'CURRENCY', 'INTRO_PLID', 'IsActive', 'ReferalCode',
  'DefaultLandingUrl', 'MultiLandingUrl', 'IMAGENAME', 'TLPMID', 'IsReferralAccepted'];

class Customer_Login {
  async Get_member_details(plid) {
    return mapRow(await queryOne('shopping', 'select * from tbl_customerlogin where clid=@plid limit 1', { plid }), PROPS);
  }

  // PORT-NOTE: legacy concatenated plid into the SQL; now a bound parameter.
  async GetUserMobileStatus(plid) {
    let isMobileActive = 0;
    isMobileActive = Number(await scalar('shopping', 'select coalesce(count(1),0) from tbl_customerlogin where clid=@plid and phone is null', { plid })) || 0;
    return isMobileActive;
  }
}
Customer_Login.PROPS = PROPS;
Customer_Login.TABLE = 'tbl_customerlogin';

module.exports = Customer_Login;
