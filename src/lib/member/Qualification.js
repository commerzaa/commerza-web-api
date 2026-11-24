/** Exports: class Qualification (Models/Qualification.cs; table tbl_QualificationMaster; props TQMID, QualiNmae, addedby, addedDate, isActive)
 *   async BindQualification() : Qualification[]
 */
'use strict';
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');

const DB = 'affiliate';
const PROPS = ['TQMID', 'QualiNmae', 'addedby', 'addedDate', 'isActive'];

class Qualification {
  async BindQualification() {
    const rows = await query(DB,
      "select tqmid, qualinmae, addedby, addeddate, isactive::int as isactive from tbl_QualificationMaster where isactive::int=1 " +
      "union all select 0, 'Other', '', '2023-07-22 19:14:46.790'::timestamp, 0");
    const QualiMaster = mapRows(rows, PROPS);
    for (const q of QualiMaster) q.isActive = !!q.isActive; // C# bool (bit)
    return QualiMaster;
  }
}

module.exports = Qualification;
