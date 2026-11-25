/** Exports: class News_Master (table tbl_news; props nid, title, type, descriptions, date, status, Imagename)
 *   async news() : News_Master[]  (status == 1) ; async ShowNewsList(string Type) : News_Master[]  (type == Type && status == 1, date desc)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('News_Master', 'tbl_news', { nid: 0, title: null, type: null, descriptions: null, date: null, status: 0, Imagename: null });

class News_Master extends Base {
  async news() {
    return Base.mapAll(await query(DB, 'select * from tbl_news where status=1'));
  }

  async ShowNewsList(Type) {
    return Base.mapAll(await query(DB, 'select * from tbl_news where type=@Type and status=1 order by date desc', { Type }));
  }
}

module.exports = News_Master;
