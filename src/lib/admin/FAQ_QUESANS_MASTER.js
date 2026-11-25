/** Exports: class FAQ_QUESANS_MASTER (table faq_quesans_master; props FQID, FTID, FAQQUE, FAQANS, ACTIVE)
 *   async GetAllFAQ() : FAQ_QUESANS_MASTER[]  (all rows)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('FAQ_QUESANS_MASTER', 'faq_quesans_master', { FQID: 0, FTID: 0, FAQQUE: null, FAQANS: null, ACTIVE: false });

class FAQ_QUESANS_MASTER extends Base {
  async GetAllFAQ() {
    return Base.mapAll(await query(DB, 'select * from faq_quesans_master'));
  }
}

module.exports = FAQ_QUESANS_MASTER;
