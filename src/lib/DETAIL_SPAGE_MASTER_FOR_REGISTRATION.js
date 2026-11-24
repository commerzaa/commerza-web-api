/** Exports: class Bank_acount (Models/DETAIL_SPAGE_MASTER_FOR_REGISTRATION.cs; table bank_accounts)   async AllDetails(long regno) : Bank_acount[] (active, IsKycBankDetails = 0) */
'use strict';
const { query } = require('../db');
const { mapRows } = require('../utils/shape');

const PROPS = ['acid', 'regNo', 'accountHolderName', 'accountNo', 'bankName', 'branchName', 'ifscCode', 'SwiftCode', 'active', 'dtm_date', 'dtm_update_date', 'PancardNo', 'IsKycBankDetails', 'IsDMTVerified', 'IsEnable'];

class Bank_acount {
  async AllDetails(regno) {
    const sql = `SELECT IsKycBankDetails,IsDMTVerified,IsEnable,coalesce(ACID,0) AS ACID ,coalesce(REGNO,0) AS REGNO, coalesce(ACCOUNTHOLDERNAME,'') AS ACCOUNTHOLDERNAME ,
      coalesce(ACCOUNTNO,'') AS ACCOUNTNO,coalesce(BANKNAME,'')AS BANKNAME ,coalesce(BRANCHNAME,'') AS BRANCHNAME ,coalesce(IFSCCODE,'') AS IFSCCODE,
      coalesce(DTM_DATE,timestamp '1900-01-01') AS DTM_DATE,coalesce(DTM_UPDATE_DATE,timestamp '1900-01-01') AS DTM_UPDATE_DATE,ACTIVE,coalesce(PANCARDNO,'') AS PANCARDNO,coalesce(SWIFTCODE,'') AS SWIFTCODE
      FROM BANK_ACCOUNTS WHERE ACTIVE::int=1 AND ISKYCBANKDETAILS=0 AND REGNO=@regno`;
    return mapRows(await query('affiliate', sql, { regno }), PROPS);
  }
}

module.exports = Bank_acount;
