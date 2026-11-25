/** Exports: class FAQ (table faq; props id, Title, Question, Answer, boxid, status)
 *          class FAQdetails (no table; props Title, boxid)
 *   async FAQDetails(string adminlogin) : FAQdetails[]  (distinct Title, boxid; all when adminlogin == "1" else status=1; boxid asc)
 *   async FAQ_Sub_Details(int boxid, string adminlogin) : FAQ[]  (boxid; plus status when adminlogin != "1")
 *   FAQ.FAQdetails : class (also ./FAQdetails)
 */
'use strict';
const { query } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('FAQ', 'faq', { id: 0, Title: null, Question: null, Answer: null, boxid: 0, status: false });
const FAQdetails = defineModel('FAQdetails', null, { Title: null, boxid: 0 });

class FAQ extends Base {
  async FAQDetails(adminlogin) {
    let row;
    if (adminlogin === '1') {
      row = await query(DB, 'select distinct title, boxid from faq order by boxid asc');
    } else {
      row = await query(DB, 'select distinct title, boxid from faq where status::int=1 order by boxid asc');
    }
    return FAQdetails.mapAll(row);
  }

  async FAQ_Sub_Details(boxid, adminlogin) {
    let row;
    if (adminlogin === '1') {
      row = await query(DB, 'select * from faq where boxid=@boxid', { boxid });
    } else {
      row = await query(DB, 'select * from faq where status::int=1 and boxid=@boxid', { boxid });
    }
    return Base.mapAll(row);
  }
}

module.exports = FAQ;
module.exports.FAQdetails = FAQdetails;
