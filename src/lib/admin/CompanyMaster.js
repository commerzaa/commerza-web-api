/** Exports: class CompanyMaster (table tbl_companymaster; props COM_ID, COMID, COM_CODE, COM_TITLE, COM_NAME, NAME, COM_ADDRESS, COM_Country, COM_StateName, COM_CityName, COM_Pincode, COM_Currency, SOFTWARE_URL, CreateDate, Status, IsDelete, Reg_No, Reg_Date, Vat_No, Pan_No, Phone1, Phone2, EmailID, FaxNo, Logo, WebAddress, StoreComm, Description, InvoiceFooter, Com_Code_title, GST_No, CST_No, Area, LOcationType, StoreLevel_Comm, LOGOBACKGROUND)
 *   async Company_List() : CompanyMaster[]  (Status == 1 && !IsDelete, by COM_ID)
 */
'use strict';
const { query } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('CompanyMaster', 'tbl_companymaster', { COM_ID: 0, COMID: 0, COM_CODE: null, COM_TITLE: null, COM_NAME: null, NAME: null, COM_ADDRESS: null, COM_Country: null, COM_StateName: null, COM_CityName: null, COM_Pincode: null, COM_Currency: null, SOFTWARE_URL: null, CreateDate: null, Status: 0, IsDelete: false, Reg_No: null, Reg_Date: null, Vat_No: null, Pan_No: null, Phone1: null, Phone2: null, EmailID: null, FaxNo: null, Logo: null, WebAddress: null, StoreComm: 0, Description: null, InvoiceFooter: null, Com_Code_title: null, GST_No: null, CST_No: null, Area: null, LOcationType: null, StoreLevel_Comm: 0, LOGOBACKGROUND: null });

class CompanyMaster extends Base {
  async Company_List() {
    return Base.mapAll(await query(DB, 'select * from tbl_companymaster where status=1 and isdelete::int=0 order by com_id'));
  }
}

module.exports = CompanyMaster;
