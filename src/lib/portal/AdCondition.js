/** Exports: class AdCondition (props ID, Title; not an EF entity)
 *   async AdCondition_List(int catid) : AdCondition[]               (Master_Data.Condition() rows where CATID == catid; ID = row[0], Title = row[2])
 *   async AdCondition_ListOnSubCategory(int scatid) : AdCondition[] (Master_Data.ConditionOnSubCategory() rows where SCATID == scatid)
 */
'use strict';
// emulates DataTable.Select("<COL>=" + value) + { ID = Convert.ToInt32(row[0]), Title = Convert.ToString(row[2]) }
function selectIdTitle(dt, column, value) {
  const rows = (dt || []).filter((r) => Number(r[column]) === Number(value));
  return rows.map((row) => {
    const v = Array.isArray(row) ? row : Object.values(row);
    const id = parseInt(v[0], 10);
    if (Number.isNaN(id)) throw new Error('Input string was not in a correct format.');
    return { ID: id, Title: v[2] === null || v[2] === undefined ? '' : String(v[2]) };
  });
}

class AdCondition {
  async AdCondition_List(catid) {
    const Master_Data = require('./Master_Data');
    return selectIdTitle(await Master_Data.Condition(), 'CATID', catid);
  }

  async AdCondition_ListOnSubCategory(scatid) {
    const Master_Data = require('./Master_Data');
    return selectIdTitle(await Master_Data.ConditionOnSubCategory(), 'SCATID', scatid);
  }
}
AdCondition.PROPS = ['ID', 'Title'];

module.exports = AdCondition;
