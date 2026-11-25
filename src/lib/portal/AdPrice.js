/** Exports: class AdPrice (props ID, Title; not an EF entity)
 *   async AdPrice_List(int catid) : AdPrice[]   (Master_Data.AdPrice() rows where CATID == catid; ID = row[0], Title = row[2])
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

class AdPrice {
  async AdPrice_List(catid) {
    const Master_Data = require('./Master_Data');
    return selectIdTitle(await Master_Data.AdPrice(), 'CATID', catid);
  }
}
AdPrice.PROPS = ['ID', 'Title'];

module.exports = AdPrice;
