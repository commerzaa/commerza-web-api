/** Exports: class Product_Master_Sub (table ims_subproduct) -- all methods inherited from ../merchant/Product_Master_Sub (Product_Master_Sub class C# is identical):
 *   async Product_Sub_List() ; Product_Sub_ListOnMPRID(Int64) ; Product_Sub_Main_List() ; Product_Sub_OnPrCode(string) ; Product_Sub_OnSubMPRID(Int64)
 *   async Product_Sub_OnSubSPRID(Int64) ; ProductStockIn(Int64 SPRID) : int ; ProductListBy_MPRID(Int64)
 *   static ProductFullDetail = { PROPS }  (portal C# property bag; the Merchant version has 8 more properties, the portal one does not)
 */
'use strict';
const Base = require('../merchant/Product_Master_Sub');

class Product_Master_Sub extends Base {}
Product_Master_Sub.TABLE = 'ims_subproduct';
Product_Master_Sub.ProductFullDetail = {
  PROPS: ['ActiveFrom', 'ActiveTo', 'ActualPrice', 'BranchId', 'Breadth_cms', 'CashOnDelivery', 'catid', 'Color', 'CompanyId', 'DAP', 'DiscountPercentage',
    'FullDescription', 'Height_cms', 'IsActive', 'IsAllowCoupon', 'IsLevel', 'IsOutOfStock', 'IsVerified', 'KeyFeatures', 'Length_cms', 'MainCategoryId',
    'MainCategoryName', 'MaxOrderQty', 'MinOrderQty', 'MPRID', 'Paymode', 'ProcurementSLA', 'WarrentyInfoCare', 'ProductCode', 'SubPrCode', 'ProductImages',
    'ProductTitle', 'Qty', 'ReplacementDay', 'SellMRP', 'ShippingCharges', 'ShotDescription', 'Size', 'SPRID', 'StockIn', 'StockOut', 'SubCategoryId', 'Unit',
    'VatCategoryId', 'VatPercentage', 'Weight_kg'],
};

module.exports = Product_Master_Sub;
