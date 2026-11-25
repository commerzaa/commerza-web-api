/** Exports: class Purchase_Bill (table tbl_purchase_bill; props SPRID, PrCode, SubPrCode, Qty, prodUnit, color, size, stockIn, stockOut, status, isnewoffer, isnewarrival, isbigsaving, isfestivaloffer, isquickshop, isOutOfStock, prodImages, shippingCharges, DiscountPer, TaxInc, TaxExc, vcid, Mvat, actualPrice, sellMRP, DAP, SpAmt, direct_amount, BV, PV, MaxCost, MGA, SComm, PaybleAmount, cat_OH_Perc, cat_OH_Amt, sessionID, minstock, give_level, SLCOMM, Wunit, IsDelete, BarCode, BatchNo, HSNCode, ExpiredOn, procuctName ; [NotMapped] procuctName)
 *   async Product_Sub_List() : Purchase_Bill[]  (= Product_Sub_Main_List())
 *   async Product_Sub_Main_List() : Purchase_Bill[]  (all tbl_purchase_bill rows; procuctName built from the Kit_Product_Master row whose PrCode == SubPrCode:
 *         NAME(UNIT 0.00-UNITID) --   [ (PRID : SubPrCode ) - ( Size -size ) - ( Qty prodUnit) - ( BatchNo - x) - ( Exp.Date - dd/MMM/yyyy) ])
 *   async Product_Sub_OnSubID(Int64 SPRID) : Purchase_Bill | null
 *   async Product_Sub_OnSubPrCode(string SubPrCode) : Purchase_Bill | null
 *   async Product_Sub_OnPrCode(string PrCode) : Purchase_Bill[]
 *   async Product_Sub_OnSubBarCode(string BarCode) : Purchase_Bill | null   (C# internal)
 */
'use strict';
const { query } = require('../../db');
const { defineModel, DB } = require('./_models');
const Kit_Product_Master = require('./Kit_Product_Master');

const Base = defineModel('Purchase_Bill', 'tbl_purchase_bill', { SPRID: 0, PrCode: null, SubPrCode: null, Qty: 0, prodUnit: null, color: null, size: null, stockIn: 0, stockOut: 0, status: false, isnewoffer: 0, isnewarrival: 0, isbigsaving: 0, isfestivaloffer: 0, isquickshop: 0, isOutOfStock: false, prodImages: null, shippingCharges: 0, DiscountPer: 0, TaxInc: 0, TaxExc: 0, vcid: 0, Mvat: 0, actualPrice: 0, sellMRP: 0, DAP: 0, SpAmt: 0, direct_amount: 0, BV: 0, PV: 0, MaxCost: 0, MGA: 0, SComm: 0, PaybleAmount: 0, cat_OH_Perc: 0, cat_OH_Amt: 0, sessionID: null, minstock: 0, give_level: false, SLCOMM: 0, Wunit: null, IsDelete: false, BarCode: null, BatchNo: null, HSNCode: null, ExpiredOn: null, procuctName: null }, ['procuctName']);

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');
const s = (v) => (v === null || v === undefined ? '' : String(v)); // C# string concatenation of null => ""
const isNullOrEmpty = (v) => v === null || v === undefined || v === '';

class Purchase_Bill extends Base {
  async Product_Sub_List() {
    const LiPC = await this.Product_Sub_Main_List();
    return LiPC;
  }

  async Product_Sub_Main_List() {
    const LiPC = Base.mapAll(await query(DB, 'select * from tbl_purchase_bill'));
    const LiMPC = Kit_Product_Master.mapAll(await query(DB, 'select * from tbl_kitproductmaster'));
    for (const dr of LiPC) {
      const row = LiMPC.find((l) => l.PrCode === dr.SubPrCode) || null;
      let prname = '';
      if (row !== null) {
        if (!isNullOrEmpty(row.UNITID) && !isNullOrEmpty(row.UNITID)) {
          prname = s(row.NAME) + '(' + Number(row.UNIT).toFixed(2) + '-' + row.UNITID.toString() + ')';
        } else {
          prname = s(row.NAME);
        }
        prname = prname + ' --   [ (PRID : ' + s(dr.SubPrCode) + ' ) ';
        if (dr.size !== '') {
          prname += '- ( Size -' + s(dr.size) + ' )';
        }
        if (Number(dr.Qty) > 0) {
          prname += ' - ( ' + s(dr.Qty) + ' ' + s(dr.prodUnit) + ')';
        }
        if (!isNullOrEmpty(dr.BatchNo)) {
          prname += ' - ( BatchNo - ' + dr.BatchNo + ')';
        }
        if (dr.ExpiredOn !== null && dr.ExpiredOn !== undefined) {
          const d = new Date(dr.ExpiredOn);
          prname += ' - ( Exp.Date - ' + pad(d.getDate()) + '/' + MON[d.getMonth()] + '/' + d.getFullYear() + ')';
        }
        prname += ' ]';
        dr.procuctName = prname;
      }
    }
    return LiPC;
  }

  async Product_Sub_OnSubID(SPRID) {
    return (await this.Product_Sub_Main_List()).find((a) => String(a.SPRID) === String(SPRID)) || null;
  }

  async Product_Sub_OnSubPrCode(SubPrCode) {
    return (await this.Product_Sub_Main_List()).find((a) => a.SubPrCode === SubPrCode) || null;
  }

  async Product_Sub_OnPrCode(PrCode) {
    return (await this.Product_Sub_Main_List()).filter((a) => a.PrCode === PrCode);
  }

  async Product_Sub_OnSubBarCode(BarCode) {
    return (await this.Product_Sub_Main_List()).find((a) => a.BarCode === BarCode) || null;
  }
}

module.exports = Purchase_Bill;
