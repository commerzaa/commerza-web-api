/** Exports: class News_Master (Models/News_Event.cs; table tbl_news; props nid, title, type, descriptions, date, status, Imagename)
 *   async news() : News_Master[] (status 1) ; async ShowNewsList(string Type) : News_Master[] (type == Type, status 1, date desc)
 *   (News_Event / eventNews is a pure property bag and is not ported.)
 */
'use strict';
const { query } = require('../db');
const { mapRows } = require('../utils/shape');

const PROPS = ['nid', 'title', 'type', 'descriptions', 'date', 'status', 'Imagename'];

class News_Master {
  async news() {
    return mapRows(await query('affiliate', 'select * from tbl_news where status=1'), PROPS);
  }

  async ShowNewsList(Type) {
    return mapRows(await query('affiliate', 'select * from tbl_news where lower(type)=lower(@Type) and status=1 order by date desc', { Type }), PROPS);
  }
}

module.exports = News_Master;
