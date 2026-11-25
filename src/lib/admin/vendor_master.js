/** Exports: class vendor_master (table tbl_vendor_master; props vmid, vendor_id, vendor_type, vendor_name, vendor_email, vendor_mobile, vendor_panno, vendor_tinno, vendor_address, Pincode, vendor_sid, Vendor_ctid, vendor_password, vendor_createdate, credit_days, balance, funds_locked, monthly_purch, total_purch, ServiceTaxNo, active, isDelete, GST_No)
 *   async _vendor_list() : vendor_master[]  (active && !isDelete, by vendor_name; vendor_id and vendor_name = vendor_id + ": " + vendor_name)
 *   async _vendor_list_simple() : vendor_master[]  (active && !isDelete, by vendor_name)
 *   async _vendor_on_vendorid(string vendorid) : vendor_master | null  (active && !isDelete && vmid.ToString() == vendorid)
 *   async insertUpdateVendor(string vendorid, string vendortype, string vendorname, string emailaddress, string mobile, string panno, string tinno,
 *         string address, int state, string password, string city, string pincode, string servicetax, string GST_No) : string
 *         (proc usp_insert_update_vendor ... @strResult out, @GST_No, @ID out => strResult + "^" + ID; error => "Something went wrong. Please try later^")
 */
'use strict';
const { query, queryOne, procOne } = require('../../db');
const { defineModel, out, DB } = require('./_models');
const { toStr } = require('../_libhelpers');

const Base = defineModel('vendor_master', 'tbl_vendor_master', { vmid: 0, vendor_id: null, vendor_type: null, vendor_name: null, vendor_email: null, vendor_mobile: null, vendor_panno: null, vendor_tinno: null, vendor_address: null, Pincode: null, vendor_sid: 0, Vendor_ctid: null, vendor_password: null, vendor_createdate: null, credit_days: 0, balance: 0, funds_locked: false, monthly_purch: 0, total_purch: 0, ServiceTaxNo: null, active: false, isDelete: false, GST_No: null });

class vendor_master extends Base {
  async _vendor_list() {
    const Rows = await query(DB, 'select vendor_id, vendor_name from tbl_vendor_master where active::int=1 and isdelete::int=0 order by vendor_name');
    const li = [];
    for (const item of Rows) {
      const obj = new vendor_master();
      obj.vendor_id = item.vendor_id;
      obj.vendor_name = item.vendor_id + ': ' + item.vendor_name;
      li.push(obj);
    }
    return li;
    // (legacy unreachable second return statement not ported)
  }

  async _vendor_list_simple() {
    return Base.mapAll(await query(DB, 'select * from tbl_vendor_master where active::int=1 and isdelete::int=0 order by vendor_name'));
  }

  async _vendor_on_vendorid(vendorid) {
    return Base.map(await queryOne(DB, 'select * from tbl_vendor_master where active::int=1 and isdelete::int=0 and vmid::text=@vendorid limit 1', { vendorid }));
  }

  async insertUpdateVendor(vendorid, vendortype, vendorname, emailaddress, mobile, panno, tinno, address, state, password, city, pincode, servicetax, GST_No) {
    let OutputResult = '';
    let VID = '';
    try {
      const row = await procOne(DB, 'usp_insert_update_vendor', {
        vendorid, vendortype, vendorname, emailaddress, mobile, panno, tinno, address, state, pincode, city, servicetax, password, gst_no: GST_No,
      });
      OutputResult = toStr(out(row, 'strResult'));
      VID = toStr(row ? row.id : null);
    } catch (ex) {
      OutputResult = 'Something went wrong. Please try later';
    }
    return OutputResult + '^' + VID;
  }
}

module.exports = vendor_master;
