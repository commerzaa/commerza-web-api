/** Exports: class Admin_Bank_DetailsPage (table tbl_admin_bankdetails; props TABDID, EmpId, AccountHolderName, AccountNo, BankName, BranchName, IFSCCode, Date, UpdateDate, Status, Active, BANKID, PurposeFor, CorporateID)
 *   async AllDetails() : Admin_Bank_DetailsPage[]   (raw SELECT on tbl_admin_bankdetails, Status=1 and Active=1)
 */
'use strict';
const { query } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Admin_Bank_DetailsPage', 'tbl_admin_bankdetails', { TABDID: 0, EmpId: 0, AccountHolderName: null, AccountNo: null, BankName: null, BranchName: null, IFSCCode: null, Date: null, UpdateDate: null, Status: 0, Active: 0, BANKID: 0, PurposeFor: null, CorporateID: null });

class Admin_Bank_DetailsPage extends Base {
  async AllDetails() {
    // T-SQL isnull(datetime,'') => 1900-01-01
    const rows = await query(DB, "select coalesce(empid,0) as empid, coalesce(tabdid,0) as tabdid, coalesce(accountholdername,'') as accountholdername, coalesce(accountno,'') as accountno, coalesce(bankname,'') as bankname, coalesce(branchname,'') as branchname, coalesce(ifsccode,'') as ifsccode, coalesce(date,'1900-01-01'::timestamp) as date, coalesce(updatedate,'1900-01-01'::timestamp) as updatedate, status, active, bankid, purposefor, corporateid from tbl_admin_bankdetails where status=1 and active=1");
    return Base.mapAll(rows);
  }
}

module.exports = Admin_Bank_DetailsPage;
