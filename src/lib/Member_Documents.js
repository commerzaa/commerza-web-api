/** Exports: class Member_Documents (table tbl_member_doc)   async AddUploadDoc(string Doctype, long regno, string DocName) : string  (usp_AddUpdate_MemberDoc, @strResult out) */
'use strict';
const { procOne } = require('../db');
const { out, toStr } = require('./_libhelpers');

class Member_Documents {
  async AddUploadDoc(Doctype, regno, DocName) {
    const row = await procOne('affiliate', 'usp_AddUpdate_MemberDoc', { Doctype, regno, DocName });
    return toStr(out(row, 'strResult'));
  }
}

module.exports = Member_Documents;
