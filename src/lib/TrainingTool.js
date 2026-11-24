/** Exports: class TrainingTool (table training_tool; props TLID, Type, Title, Desp, VUrl, Active, Date)
 *   async VideosFileCollection() : TrainingTool[] (Active, TLID desc) ; async DeleteT(int TLID) : int (rows deleted; throws when the row does not exist, like EF Remove(null))
 */
'use strict';
const { query, queryOne, exec } = require('../db');
const { mapRows } = require('../utils/shape');

const PROPS = ['TLID', 'Type', 'Title', 'Desp', 'VUrl', 'Active', 'Date'];

class TrainingTool {
  async VideosFileCollection() {
    return mapRows(await query('affiliate', 'select * from training_tool where active::int=1 order by tlid desc'), PROPS);
  }

  async DeleteT(TLID) {
    const row = await queryOne('affiliate', 'select tlid from training_tool where tlid=@TLID limit 1', { TLID });
    if (row === null) throw new TypeError("Value cannot be null. (Parameter 'entity')");
    return exec('affiliate', 'delete from training_tool where tlid=@TLID', { TLID });
  }
}

module.exports = TrainingTool;
