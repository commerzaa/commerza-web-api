/** Exports: class YouWantTo (props ID, Title; static PROPS)
 *   async YouWantTo_List(int catid) : YouWantTo[]  (rows of Master_Data.YouWantTo() where CATID == catid -> {ID: row[0], Title: row[2]}) */
'use strict';
// Master_Data (Models/Master_Data.cs) is ported by another lib agent; required lazily so this module always loads.
const getMasterData = () => require('./Master_Data');

const col = (row, name, i) => (Array.isArray(row) ? row[i] : (row[name] !== undefined ? row[name] : Object.values(row)[i]));

class YouWantTo {
  async YouWantTo_List(catid) {
    const dt = await getMasterData().YouWantTo();
    const Data = (dt || []).filter((row) => Number(col(row, 'CATID', 1)) === Number(catid));
    return Data.map((row) => ({ ID: parseInt(col(row, 'ID', 0), 10), Title: col(row, 'Title', 2) == null ? '' : String(col(row, 'Title', 2)) }));
  }
}
YouWantTo.PROPS = ['ID', 'Title'];

module.exports = YouWantTo;
