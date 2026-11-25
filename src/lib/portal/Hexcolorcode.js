/** Exports: class Hexcolorcode (table tbl_hexacolrcode; props Colorid, Colorname, Colorcode, Status)
 *   static async GetColorCodebyColorName(string Colorname) : string  (Colorcode of the first row with that name and Status == 1, else "")
 */
'use strict';
const { queryOne } = require('../../db');

const PROPS = ['Colorid', 'Colorname', 'Colorcode', 'Status'];

class Hexcolorcode {
  static async GetColorCodebyColorName(Colorname) {
    let colorcode = '';
    // EF: a.Colorname == Colorname (null => IS NULL)
    const data = Colorname === null || Colorname === undefined
      ? await queryOne('shopping', 'select colorcode from tbl_hexacolrcode where colorname is null and status=1 limit 1')
      : await queryOne('shopping', 'select colorcode from tbl_hexacolrcode where colorname=@Colorname and status=1 limit 1', { Colorname });
    if (data) {
      colorcode = data.colorcode;
    }
    return colorcode;
  }
}
Hexcolorcode.PROPS = PROPS;
Hexcolorcode.TABLE = 'tbl_hexacolrcode';

module.exports = Hexcolorcode;
