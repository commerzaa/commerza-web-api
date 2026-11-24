/** Exports: class Product_Master_Sub (table ims_subproduct; ProductFullDetail is a plain property bag: not ported)
 *   async Product_Sub_List() ; async Product_Sub_ListOnMPRID(Int64) ; async Product_Sub_Main_List() (active rows + procuctName/BranchId from ims_masterproduct, ordered by procuctName)
 *   async Product_Sub_OnPrCode(string) ; async Product_Sub_OnSubMPRID(Int64) : obj|null ; async Product_Sub_OnSubSPRID(Int64) : obj|null ; async ProductStockIn(Int64 SPRID) : int
 *   async ProductListBy_MPRID(Int64) (dbo.usp_GetProductListBYMPRID)
 */
'use strict';
const { query, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');

const PROPS = ['ActiveFrom', 'ActiveTo', 'ActualPrice', 'Breadth_cms', 'BV', 'CashOnDelivery', 'Color', 'CreatedDate', 'DAP', 'DealsIds', 'DirectAmount', 'DiscountPercentage', 'GroupId', 'Height_cms', 'IsActive', 'IsAllowCoupon', 'IsLevel', 'IsOutOfStock', 'IsVerified', 'Length_cms', 'ModifyDate', 'MPRID', 'ProcurementSLA', 'ProductImages', 'PV', 'Qty', 'ReplacementDay', 'SellMRP', 'ShippingCharges', 'Size', 'SponsorAmount', 'WarrentyInfoCare', 'SPRID', 'StockIn', 'StockNet', 'StockOut', 'StoreComm', 'StoreLevelComm', 'SubPrCode', 'TaxExclusive', 'TaxInclusive', 'Unit', 'VatCategoryId', 'Weight_kg'];
const PROPS_MAIN = ['BranchId', 'MPRID', 'ProductTitle'];
const nm = (o) => ({ ...o, BranchId: 0, MVat: 0, procuctName: null }); // [NotMapped]
const s = (v) => (v === null || v === undefined ? '' : String(v)); // C# string concat of null

const byName = (a, b) => {
  const x = s(a.procuctName); const y = s(b.procuctName);
  return x.localeCompare(y);
};

class Product_Master_Sub {
  async Product_Sub_List() {
    return this.Product_Sub_Main_List();
  }

  async Product_Sub_ListOnMPRID(MPRID) {
    return (await this.Product_Sub_Main_List()).filter((a) => a.MPRID === MPRID);
  }

  async Product_Sub_Main_List() {
    const LiPC = mapRows(await query('shopping', 'select * from ims_subproduct where isactive::int=1'), PROPS).map(nm);
    const LiMPC = mapRows(await query('shopping', 'select * from ims_masterproduct'), [...PROPS_MAIN]);
    for (const dr of LiPC) {
      const row = LiMPC.find((l) => l.MPRID === dr.MPRID) || null;
      let prname = '';
      if (row !== null) {
        dr.BranchId = row.BranchId;
        prname = row.ProductTitle;
        if (dr.Size !== '') {
          prname += '- ( Size -' + s(dr.Size) + ' )';
        }
        if (dr.Qty > 0) {
          prname += ' - ( ' + dr.Qty + ' ' + s(dr.Unit) + ')';
        }
      }
      prname = s(prname) + ' - (PRID : ' + s(dr.SubPrCode) + ' ) ';
      dr.procuctName = prname;
    }
    return LiPC.sort(byName);
  }

  async Product_Sub_OnPrCode(PrCode) {
    return (await this.Product_Sub_Main_List()).filter((a) => a.SubPrCode === PrCode);
  }

  async Product_Sub_OnSubMPRID(MPRID) {
    return (await this.Product_Sub_Main_List()).find((a) => a.MPRID === MPRID) || null;
  }

  async Product_Sub_OnSubSPRID(SPRID) {
    return (await this.Product_Sub_Main_List()).filter((a) => a.SPRID === SPRID).sort(byName)[0] || null;
  }

  async ProductStockIn(SPRID) {
    const r = (await this.Product_Sub_Main_List()).find((a) => a.SPRID === SPRID);
    return r ? r.StockIn : 0;
  }

  async ProductListBy_MPRID(MPRID) {
    return mapRows(await proc('shopping', 'usp_getproductlistbymprid', { mprid: MPRID }), PROPS).map(nm);
  }
}

module.exports = Product_Master_Sub;
