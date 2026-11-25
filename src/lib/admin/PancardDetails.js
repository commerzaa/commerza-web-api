/** Exports: class PancardDetails (table tbl_pancarddetails; props pdid, RegNo, Name, PanNo, DOB, Image, Status)
 *   async PancardsDetail(double regno, string name, string panno, string dob, string image, int status) : string
 *       (dob "-" => "/"; proc usp_InsertPancardDetails @Regno,@Name,@Pancardno,@Dob,@Image,@Status,@Result out)
 */
'use strict';
const { procOne } = require('../../db');
const { defineModel, out, DB } = require('./_models');
const { toStr } = require('../_libhelpers');

const Base = defineModel('PancardDetails', 'tbl_pancarddetails', { pdid: 0, RegNo: 0, Name: null, PanNo: null, DOB: null, Image: null, Status: 0 });

// Convert.ToInt64(double): banker's rounding
function toInt64(d) {
  const n = Number(d);
  const f = Math.floor(n);
  const diff = n - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

class PancardDetails extends Base {
  async PancardsDetail(regno, name, panno, dob, image, status) {
    if (dob.includes('-')) {
      dob = dob.split('-').join('/');
    }
    const row = await procOne(DB, 'usp_insertpancarddetails', { regno: toInt64(regno), name, pancardno: panno, dob, image, status });
    const OutputResult = toStr(out(row, 'Result'));
    return OutputResult.toString();
  }
}

module.exports = PancardDetails;
