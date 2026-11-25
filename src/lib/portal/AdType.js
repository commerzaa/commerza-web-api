/** Exports: class AdType (props ID, Title; not an EF entity)
 *   async AdType_List(int catid) : AdType[]                    (Master_Data.AdType() rows where CATID == catid; ID = row[0], Title = row[2])
 *   async AdType_List_OnSubCategory(int scatid) : AdType[]     (Master_Data.AdTypeOnSubCategory() rows where SCATID == scatid)
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

class AdType {
  async AdType_List(catid) {
    const Master_Data = require('./Master_Data');
    return selectIdTitle(await Master_Data.AdType(), 'CATID', catid);
  }

  async AdType_List_OnSubCategory(scatid) {
    const Master_Data = require('./Master_Data');
    return selectIdTitle(await Master_Data.AdTypeOnSubCategory(), 'SCATID', scatid);
  }
}
AdType.PROPS = ['ID', 'Title'];

module.exports = AdType;
