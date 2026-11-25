/** Exports: class FAQ_TOPICMASTER (table faq_topicmaster; props FTID, TOPICNAME, ACTIVE)
 *   async GetAllActiveFAQTopic() : FAQ_TOPICMASTER[]  (ACTIVE) ; async GetAllFAQTopic() : FAQ_TOPICMASTER[]  (all)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('FAQ_TOPICMASTER', 'faq_topicmaster', { FTID: 0, TOPICNAME: null, ACTIVE: false });

class FAQ_TOPICMASTER extends Base {
  async GetAllActiveFAQTopic() {
    return Base.mapAll(await query(DB, 'select * from faq_topicmaster where active::int=1'));
  }

  async GetAllFAQTopic() {
    return Base.mapAll(await query(DB, 'select * from faq_topicmaster'));
  }
}

module.exports = FAQ_TOPICMASTER;
