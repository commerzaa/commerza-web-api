/** Exports: class stock_from_vendor (table tbl_stock_from_vendor; props sfaid, ref_no, BrCode, vendorid, challanno, challandate, IsVatInc, Total_Cortage, total_PuchaseCost, ShipChg, Gst_vat, FRID)
 *   get strchallandate : string  ([NotMapped] read-only: "" when challandate null else dd-MM-yyyy)
 *   async stock_from_vendor_details(string ChallanNo, string ChallanDate, string venderid) : stock_from_vendor | null
 *       (challanno == ChallanNo && challandate == Convert.ToDateTime(this.challandate) && vendorid == venderid, sfaid desc)
 */
'use strict';
const { queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('stock_from_vendor', 'tbl_stock_from_vendor', { sfaid: 0, ref_no: null, BrCode: null, vendorid: null, challanno: null, challandate: null, IsVatInc: 0, Total_Cortage: 0, total_PuchaseCost: 0, ShipChg: 0, Gst_vat: null, FRID: 0 });

const pad = (n) => String(n).padStart(2, '0');
function fmtDMY(d) {
  const x = d instanceof Date ? d : new Date(d);
  return `${pad(x.getDate())}-${pad(x.getMonth() + 1)}-${x.getFullYear()}`;
}

class stock_from_vendor extends Base {
  get strchallandate() {
    if (this.challandate === null || this.challandate === undefined) {
      return '';
    } else {
      return fmtDMY(this.challandate);
    }
  }

  async stock_from_vendor_details(ChallanNo, ChallanDate, venderid) {
    // PORT-NOTE: legacy compares with Convert.ToDateTime(challandate) - the challandate PROPERTY of the instance the method is
    // called on (null => DateTime.MinValue), NOT the ChallanDate parameter, which is unused. Kept as-is. (EF6 may also have
    // thrown NotSupportedException for Convert.ToDateTime inside the LINQ query.)
    const cd = this.challandate === null || this.challandate === undefined ? '0001-01-01T00:00:00' : this.challandate;
    const row = await queryOne(DB, 'select * from tbl_stock_from_vendor where challanno=@ChallanNo and challandate=@cd and vendorid=@venderid order by sfaid desc limit 1', { ChallanNo, cd, venderid });
    if (!row) return null;
    const o = new stock_from_vendor(Base.map(row));
    return { ...o, strchallandate: o.strchallandate };
  }
}

module.exports = stock_from_vendor;
