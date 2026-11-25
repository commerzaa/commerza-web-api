/** Exports: class Map_Attributer_With_SubCategory (props ASCID, ATID, Title, Alias, ControlID, Type, SetFrom, Value, OnChange, Position, IsMandetory; not an EF entity)
 *   async Map_Attributer_With_SubCategory_List(int SCatID) : Map_Attributer_With_SubCategory[]
 *     (tbl_attributemaster AM JOIN tbl_attributewithsubcategory MA ON AM.Atid = MA.Atid WHERE AM.Status AND MA.Sctid = SCatID ORDER BY MA.Position)
 * PORT-NOTE: tables dbo.tbl_AttributeMaster / dbo.tbl_AttributeWithSubCategory are not present in the Db_Shopping schema dump; the query keeps the EF entities' tables/columns.
 */
'use strict';
const { query } = require('../../db');

const PROPS = ['ASCID', 'ATID', 'Title', 'Alias', 'ControlID', 'Type', 'SetFrom', 'Value', 'OnChange', 'Position', 'IsMandetory'];

class Map_Attributer_With_SubCategory {
  async Map_Attributer_With_SubCategory_List(SCatID) {
    const Data = await query('shopping',
      `select am.atid, ma.ascid, am.title, am.alias, am.controlid, am.type, am.setfrom, am.value, am.onchange, ma.position, ma.ismandetory
         from tbl_attributemaster am
         inner join tbl_attributewithsubcategory ma on am.atid = ma.atid
        where am.status::int=1 and ma.sctid=@SCatID
        order by ma.position asc`,
      { SCatID });
    return Data.map((Row) => ({
      ASCID: Row.ascid,
      ATID: Row.atid,
      Title: Row.title,
      Alias: Row.alias,
      ControlID: Row.controlid,
      Type: Row.type,
      SetFrom: Row.setfrom,
      Value: Row.value,
      OnChange: Row.onchange,
      Position: Row.position,
      IsMandetory: Row.ismandetory === null || Row.ismandetory === undefined ? null : !!Number(Row.ismandetory),
    }));
  }
}
Map_Attributer_With_SubCategory.PROPS = PROPS;

module.exports = Map_Attributer_With_SubCategory;
