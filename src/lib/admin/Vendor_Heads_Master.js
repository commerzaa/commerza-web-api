/** Exports: class Vendor_Heads_Master (table tbl_vendor_heads; props VHID, Vtype, Description, Date, Active, isDelete)
 *   async List_VendorHeads() : Vendor_Heads_Master[]  (!isDelete, VHID desc)
 *   async AddVendor_Head(string Heads, string desc, bool status) : string  ("Insert" (revives a deleted head or inserts) | "Exist")
 *   async UpdateVendor_Head(string Heads, string desc, bool status, int VHID) : string  ("Exist" | "Update")
 */
'use strict';
const { query, queryOne, scalar, exec } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Vendor_Heads_Master', 'tbl_vendor_heads', { VHID: 0, Vtype: null, Description: null, Date: null, Active: false, isDelete: false });

class Vendor_Heads_Master extends Base {
  async List_VendorHeads() {
    return Base.mapAll(await query(DB, 'select * from tbl_vendor_heads where isdelete::int=0 order by vhid desc'));
  }

  async AddVendor_Head(Heads, desc, status) {
    let Result = '';
    const checkhead = Number(await scalar(DB, 'select count(*) from tbl_vendor_heads where vtype=@Heads and isdelete::int=1', { Heads }));
    const isexist = Number(await scalar(DB, 'select count(*) from tbl_vendor_heads where vtype=@Heads', { Heads }));
    if (checkhead > 0) {
      const row = await queryOne(DB, 'select vhid from tbl_vendor_heads where vtype=@Heads and isdelete::int=1 limit 1', { Heads });
      await exec(DB, 'update tbl_vendor_heads set isdelete=false, description=@desc, active=@status where vhid=@vhid', { desc, status: !!status, vhid: row.vhid });
      Result = 'Insert';
      return Result;
    } else if (isexist > 0) {
      Result = 'Exist';
      return Result;
    } else {
      await exec(DB, 'insert into tbl_vendor_heads (vtype, description, date, active, isdelete) values (@Heads, @desc, now(), @status, false)', { Heads, desc, status: !!status });
      Result = 'Insert';
      return Result;
    }
  }

  async UpdateVendor_Head(Heads, desc, status, VHID) {
    let Result = '';
    const isexist = Number(await scalar(DB, 'select count(*) from tbl_vendor_heads where vtype=@Heads and isdelete::int=0 and vhid<>@VHID', { Heads, VHID }));
    if (isexist > 0) {
      Result = 'Exist';
      return Result;
    } else {
      const row = await queryOne(DB, 'select vhid from tbl_vendor_heads where vhid=@VHID limit 1', { VHID });
      if (row === null) throw new TypeError('Object reference not set to an instance of an object.'); // legacy NullReferenceException
      await exec(DB, 'update tbl_vendor_heads set vtype=@Heads, description=@desc, active=@status where vhid=@VHID', { Heads, desc, status: !!status, VHID });
      Result = 'Update';
      return Result;
    }
  }
}

module.exports = Vendor_Heads_Master;
