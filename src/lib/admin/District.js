/** Exports: class District (table district; props DistId, Sid, Distname, DistActive)
 *   async District_List_On_SID(int SID) : District[]  (DistActive && Sid, by Distname)
 *   async District_List() : District[]  (DistActive, by Distname)
 */
'use strict';
const { query } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('District', 'district', { DistId: 0, Sid: 0, Distname: null, DistActive: false });

class District extends Base {
  async District_List_On_SID(SID) {
    return Base.mapAll(await query(DB, 'select * from district where distactive::int=1 and sid=@SID order by distname', { SID }));
  }

  async District_List() {
    return Base.mapAll(await query(DB, 'select * from district where distactive::int=1 order by distname'));
  }
}

module.exports = District;
