/** Exports: class CMS_Master (table tbl_cms_master; props cmsid, Value, Type, Name, Emailid, PhoneNo, Address, Active)
 *   async UpdateCMS(string Name, string Email, string mobile, string address, string value, string type) : string
 *       (proc usp_InsertUpdateCMS @Name,@Email,@mobile,@address,@value,@type,@strResult out,@mode=1 -> @strResult;
 *        on error: ErrorInsert(proc "usp_InsertUpdateCMS", url "Controllers/Model/CMS_Master") and "Error occurred. Please try later")
 */
'use strict';
const { procOne } = require('../../db');
const { defineModel, errorInsert, out, DB } = require('./_models');
const { toStr } = require('../_libhelpers');

const Base = defineModel('CMS_Master', 'tbl_cms_master', { cmsid: 0, Value: null, Type: null, Name: null, Emailid: null, PhoneNo: null, Address: null, Active: false });

class CMS_Master extends Base {
  async UpdateCMS(Name, Email, mobile, address, value, type) {
    let ret = 'ok';
    try {
      const row = await procOne(DB, 'usp_insertupdatecms', { name: Name, email: Email, mobile, address, value, type, mode: 1 });
      ret = toStr(out(row, 'strResult'));
    } catch (ExpObj) {
      await errorInsert(0, ExpObj.message, 'usp_InsertUpdateCMS', 0, 'Controllers/Model/CMS_Master');
      ret = 'Error occurred. Please try later';
    }
    return ret;
  }
}

module.exports = CMS_Master;
