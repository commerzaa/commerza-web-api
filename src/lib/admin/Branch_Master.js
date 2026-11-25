/** Exports: class Branch_Master (table tbl_branch_master; props BRID, BrType, BrCode, COM_CODE, BrName, BrAddress, StateName, CityName, Pincode, CommPer, Current_Balance, MLimit, CreateDate, Active, isDelete, brtid, ParentBrtid, modifydate, VatNo, CSTNo, GSTN, FCMID, Franchise_Amount, NewBrName, COM_TITLE ; [NotMapped] NewBrName, COM_TITLE)
 *          class Branch_MasterTemp (no table; props BRID, BrCode, COM_CODE, BrName, BrAddress, StateName, NewBrName, COM_TITLE, BrType_Name, brtid, Current_Balance, GSTN)
 *   async MainBranch_List() : Branch_Master[]  (Active && !isDelete, by BRID)
 *   async Branch_Dump_List() : Branch_Master[]  (= GetBrachList("", "dumplist"))
 *   async GetBrachList(string BrCode, string mode) : Branch_Master[]  (proc Usp_GetBranchList @BrCode,@mode -> Branch_MasterTemp rows;
 *         returns BrName, BRID, BrCode, BrAddress, StateName, COM_CODE, brtid, Current_Balance, GSTN and
 *         NewBrName = "BRID:" + BrCode + ": " + BrName + "-" + StateName + "(" + BrType_Name + ")")
 *   static async Attributes_With_CategoryDetilas(int BRID) : Branch_Master | null  (Active && !isDelete && BRID)
 *   static async Attributes_With_branchcode(string brcode) : Branch_Master | null  (!isDelete && BrCode)
 *   async City_List() : Branch_Master[]  (distinct CityName of active branches with non-empty trimmed CityName; only CityName set)
 *   async State_List() : Branch_Master[]  (distinct StateName of active branches with non-empty trimmed StateName; only StateName set)
 *   Branch_Master.Branch_MasterTemp : class (also ./Branch_MasterTemp)
 */
'use strict';
const { query, queryOne, proc } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Branch_Master', 'tbl_branch_master', { BRID: 0, BrType: null, BrCode: null, COM_CODE: null, BrName: null, BrAddress: null, StateName: null, CityName: null, Pincode: null, CommPer: 0, Current_Balance: 0, MLimit: 0, CreateDate: null, Active: false, isDelete: false, brtid: 0, ParentBrtid: 0, modifydate: null, VatNo: null, CSTNo: null, GSTN: null, FCMID: 0, Franchise_Amount: 0, NewBrName: null, COM_TITLE: null }, ['NewBrName', 'COM_TITLE']);
const Branch_MasterTemp = defineModel('Branch_MasterTemp', null, { BRID: 0, BrCode: null, COM_CODE: null, BrName: null, BrAddress: null, StateName: null, NewBrName: null, COM_TITLE: null, BrType_Name: null, brtid: 0, Current_Balance: 0, GSTN: null });

class Branch_Master extends Base {
  async MainBranch_List() {
    // legacy had an empty foreach over the list
    return Base.mapAll(await query(DB, 'select * from tbl_branch_master where active::int=1 and isdelete::int=0 order by brid'));
  }

  async Branch_Dump_List() {
    return this.GetBrachList('', 'dumplist');
  }

  async GetBrachList(BrCode, mode) {
    const LiBranch_Master = Branch_MasterTemp.mapAll(await proc(DB, 'usp_getbranchlist', { brcode: BrCode, mode }));
    const li = [];
    for (const item of LiBranch_Master) {
      const obj = new Branch_Master();
      obj.BrName = item.BrName;
      obj.BRID = item.BRID;
      obj.BrCode = item.BrCode;
      obj.BrAddress = item.BrAddress;
      obj.StateName = item.StateName;
      obj.COM_CODE = item.COM_CODE;
      obj.brtid = item.brtid;
      obj.Current_Balance = item.Current_Balance;
      obj.GSTN = item.GSTN;
      // legacy: item.BrCode.ToString() throws NullReferenceException when BrCode is NULL (same here)
      obj.NewBrName = 'BRID:' + item.BrCode.toString() + ': ' + item.BrName + '-' + item.StateName + '(' + item.BrType_Name + ')';
      li.push(obj);
    }
    return li;
  }

  static async Attributes_With_CategoryDetilas(BRID) {
    return Base.map(await queryOne(DB, 'select * from tbl_branch_master where active::int=1 and isdelete::int=0 and brid=@BRID limit 1', { BRID }));
  }

  static async Attributes_With_branchcode(brcode) {
    return Base.map(await queryOne(DB, 'select * from tbl_branch_master where isdelete::int=0 and brcode=@brcode limit 1', { brcode }));
  }

  async City_List() {
    const rows = await query(DB, "select distinct cityname from tbl_branch_master where active::int=1 and trim(cityname)<>''");
    return rows.map((item) => {
      const obj = new Branch_Master();
      obj.CityName = item.cityname;
      return obj;
    });
  }

  async State_List() {
    const rows = await query(DB, "select distinct statename from tbl_branch_master where active::int=1 and trim(statename)<>''");
    return rows.map((item) => {
      const obj = new Branch_Master();
      obj.StateName = item.statename;
      return obj;
    });
  }
}

module.exports = Branch_Master;
module.exports.Branch_MasterTemp = Branch_MasterTemp;
