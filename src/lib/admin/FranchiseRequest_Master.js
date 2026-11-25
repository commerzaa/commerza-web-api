/** Exports: class FranchiseRequest_Master (table tbl_franchiserequest; props FRID, FPMID, PLID, NAME, MRP, COUNTRY, STATE, CITY, ADDRESS, DATE, PINCODE, IPADDRESS, DESCRIPTION, STATUS, ACTIVE, Remark, Taluk, District, Circle, Region, ApprovalDate, FRCode, SPONSORID, Emailid, Mobile, PassWord, StoreType, GST, TinNo, NewFRName ; [NotMapped] NewFRName)
 *          class FranchiseRequest_Master_Temp (no table; props FRID, NAME, COUNTRY, STATE, CITY, ADDRESS, STATUS, ACTIVE, FRCode, Emailid, Mobile, GST, TinNo)
 *   async GetFranchiseList(string mode) : FranchiseRequest_Master[]  (proc USP_GETFRANCHISELIST @mode -> FranchiseRequest_Master_Temp rows;
 *         returns NAME, FRID, FRCode, ADDRESS, STATE, GST and NewFRName = "DW:" + FRCode + ": " + NAME + "-" + STATE)
 *   async Franchise_Dump_List() : FranchiseRequest_Master[]  (= GetFranchiseList("dumplist"))
 *   FranchiseRequest_Master.FranchiseRequest_Master_Temp : nested model class (also ./FranchiseRequest_Master_Temp)
 */
'use strict';
const { proc } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('FranchiseRequest_Master', 'tbl_franchiserequest', { FRID: 0, FPMID: 0, PLID: 0, NAME: null, MRP: 0, COUNTRY: null, STATE: null, CITY: null, ADDRESS: null, DATE: null, PINCODE: null, IPADDRESS: null, DESCRIPTION: null, STATUS: 0, ACTIVE: 0, Remark: null, Taluk: null, District: null, Circle: null, Region: null, ApprovalDate: null, FRCode: null, SPONSORID: 0, Emailid: null, Mobile: null, PassWord: null, StoreType: null, GST: null, TinNo: null, NewFRName: null }, ['NewFRName']);
const FranchiseRequest_Master_Temp = defineModel('FranchiseRequest_Master_Temp', null, { FRID: 0, NAME: null, COUNTRY: null, STATE: null, CITY: null, ADDRESS: null, STATUS: 0, ACTIVE: 0, FRCode: null, Emailid: null, Mobile: null, GST: null, TinNo: null });

class FranchiseRequest_Master extends Base {
  async GetFranchiseList(mode) {
    const LiFranchiseRequest_Master = FranchiseRequest_Master_Temp.mapAll(await proc(DB, 'usp_getfranchiselist', { mode }));
    const li = [];
    for (const item of LiFranchiseRequest_Master) {
      const obj = new FranchiseRequest_Master();
      obj.NAME = item.NAME;
      obj.FRID = item.FRID;
      obj.FRCode = item.FRCode;
      obj.ADDRESS = item.ADDRESS;
      obj.STATE = item.STATE;
      obj.GST = item.GST;
      // legacy: item.FRCode.ToString() throws NullReferenceException when FRCode is NULL (same here)
      obj.NewFRName = 'DW:' + item.FRCode.toString() + ': ' + item.NAME + '-' + item.STATE;
      li.push(obj);
    }
    return li;
  }

  async Franchise_Dump_List() {
    return this.GetFranchiseList('dumplist');
  }
}

module.exports = FranchiseRequest_Master;
module.exports.FranchiseRequest_Master_Temp = FranchiseRequest_Master_Temp;
