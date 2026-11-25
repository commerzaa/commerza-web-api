/** Exports: class QuestionCategory (table tbl_questioncategorymaster; props TQCID, CATEGORYNAME, ISACTIVE)
 *   async QuestionCategoryList() : QuestionCategory[]  (ISACTIVE == 1, by TQCID)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('QuestionCategory', 'tbl_questioncategorymaster', { TQCID: 0, CATEGORYNAME: null, ISACTIVE: 0 });

class QuestionCategory extends Base {
  async QuestionCategoryList() {
    return Base.mapAll(await query(DB, 'select * from tbl_questioncategorymaster where isactive=1 order by tqcid'));
  }
}

module.exports = QuestionCategory;
