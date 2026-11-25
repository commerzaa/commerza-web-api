/** Exports: class State (table state; props Sid, StateName, Cid, SActive, State_TinNo, State_CST)
 *   async State_List() : State[]  (SActive, by StateName)
 *   async State_List_On_CID(int CID) : State[]  (SActive && Cid, by StateName)
 *   async State_List_On_CID(string statename) : State | null  (SActive && StateName)  -- C# overload: dispatched on typeof argument (string => by name)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('State', 'state', { Sid: 0, StateName: null, Cid: 0, SActive: false, State_TinNo: null, State_CST: 0 });

class State extends Base {
  async State_List() {
    return Base.mapAll(await query(DB, 'select * from state where sactive::int=1 order by statename'));
  }

  async State_List_On_CID(arg) {
    if (typeof arg === 'string') {
      const statename = arg;
      return Base.map(await queryOne(DB, 'select * from state where sactive::int=1 and statename=@statename limit 1', { statename }));
    }
    const CID = arg;
    return Base.mapAll(await query(DB, 'select * from state where sactive::int=1 and cid=@CID order by statename', { CID }));
  }
}

module.exports = State;
