/**
 * Exports: class ProductDal { async AddUpdateProduct(BranchId, Paymode, SPRID, MPRID, CompanyID, catid, subcatid, brandid, ProductCode, SubProductCode, prodTitle, fromdate, todate,
 *     shrtdesc, FullDesc, isAllowCoupon, minOrderQty, maxOrderQty, paymentmode, sellMRP, discountPer, quantity, prodUnit, color, size, Attributes, vcid, VATP, directAmt, DAP,
 *     shippingcharges, imageByteCode, KeyFeatures, StockIn, ReplacementDay, ProcurementSLA, CashOnDelivery, Pkg_Weight_Kg, Pkg_Length_cms, Pkg_Breadth_cms, Pkg_Height_cms,
 *     WarrentyInfoCare, DealsIds, GroupId, YWillRece, ismerchantstatus, productentry, packerdetail, importerdetail, manufacturedetail, hsn, luxurycess, procurementsla1,
 *     ddlseller, ddlprocurement, Specification, productSKUCode, BV, PV, CASHBACK, ActivationPv): string;
 *   async InsertBulkProductList(BranchId, XMLProductList): Excel_Product_Detail[]; async InsertBulkProduct(BranchId, XMLProductList): DataSet;
 *   async GetProudctDetail(SPRID, MPRID): ProductFullDetail|null; async Product_List(prid): Product_Master_Main[];
 *   async CategoryAttribute_DataSet(MainCatId, CatId, SubCatId, BranchId): DataSet; async CategoryAttribute_List(MainCatId, CatId, SubCatId): ddl_Master[];
 *   async Product_Listmaster(): Product_Master_Main[]; async Product_Main_OnMPRID(MPRID); async Product_Main_OnPrCode(PrCode); async ProductCodeCheck(ProductCode): ProcessResult;
 *   async ApproveAndNewSale(CheckIds, BranchId): string; async ChangeQCStatus(CheckIds, QCStatus, Reason): int; async DeleteQCProduct(CheckIds): int }
 * DataSet is returned as { Tables: [ rows[] ] } (PostgreSQL functions return a single result set; legacy DataSet tables beyond the first cannot be produced).
 * PORT-NOTE: Merchant DataBaseContext = Db_Shopping; legacy raw SqlConnection(AppSettings ConnectionString) calls also use 'shopping'.
 * PORT-NOTE: InsertBulkProductList: legacy command text referenced @strResult without passing it (SqlException swallowed => empty list in practice); the procedure is
 *   called with BranchId/XMLProductList and its rows are returned.
 * PORT-NOTE: CategoryAttribute_List passes CatId for @MainCatId (legacy typo) - preserved.
 */
'use strict';
const db = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');
const { isDbError } = require('../_libhelpers');

const D = 'shopping';
const Excel_Product_Detail = ['Id', 'MCID', 'CID', 'SCID', 'VCID', 'Code', 'ProductTitle', 'ShortDescription', 'FullDescription', 'KeyFeatures', 'UnitQty', 'Unit', 'StockIn',
  'WarrentyInfoCare', 'ProductImages', 'SellMRP', 'DAP', 'Discount', 'DealsIds', 'GroupId', 'ReplacementDay', 'ProcurementSLA', 'CashOnDelivery', 'ShippingCharges', 'Weight_kg',
  'Length_cms', 'Breadth_cms', 'Height_cms', 'ErrorReason', 'BranchId', 'CreatedDate', 'QCStatus', 'BranchName', 'MasterCategoryName', 'CategoryName', 'SubCategoryName',
  'VatCategoryName', 'VatValue', 'DealsName', 'GroupName'];
const ProductFullDetail = ['ActiveFrom', 'ActiveTo', 'ActualPrice', 'BranchId', 'Breadth_cms', 'CashOnDelivery', 'catid', 'Color', 'CompanyId', 'DAP', 'DiscountPercentage',
  'FullDescription', 'Height_cms', 'IsActive', 'IsAllowCoupon', 'IsLevel', 'IsOutOfStock', 'IsVerified', 'KeyFeatures', 'Length_cms', 'MainCategoryId', 'MainCategoryName',
  'MaxOrderQty', 'MinOrderQty', 'MPRID', 'Paymode', 'ProcurementSLA', 'WarrentyInfoCare', 'ProductCode', 'SubPrCode', 'ProductImages', 'ProductTitle', 'Qty', 'ReplacementDay',
  'SellMRP', 'ShippingCharges', 'ShotDescription', 'Size', 'SPRID', 'StockIn', 'StockOut', 'SubCategoryId', 'Unit', 'VatCategoryId', 'VatPercentage', 'Weight_kg', 'YWillRece'];
const Product_Master_Main = ['BranchId', 'catid', 'BrandId', 'CompanyId', 'CreatedDate', 'FullDescription', 'KeyFeatures', 'MainCategoryId', 'MaxOrderQty', 'MinOrderQty',
  'ModifyDate', 'MPRID', 'MVat', 'Paymode', 'ProductCode', 'ProductTitle', 'ShotDescription', 'SubCategoryId', 'VatCategoryId'];
const ddl_Master = ['CategoryId', 'Create_Date', 'ddl_ID', 'ddl_Name', 'ddl_Name_ID', 'ddl_Text', 'ddl_Value', 'isActive', 'MainCategoryId', 'parent_ddl_ID', 'SubCategoryId'];

const outv = (row, name) => {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? null : row[k];
};
const cs = (v) => (v === null || v === undefined ? '' : String(v));
const toBool = (v) => {
  if (v === true || v === false) return v;
  if (v === 1 || v === '1' || String(v).toLowerCase() === 'true') return true;
  if (v === 0 || v === '0' || String(v).toLowerCase() === 'false') return false;
  throw new Error('String was not recognized as a valid Boolean.');
};

class ProductDal {
  async AddUpdateProduct(BranchId, Paymode, SPRID, MPRID, CompanyID, catid, subcatid, brandid,
    ProductCode, SubProductCode, prodTitle, fromdate, todate, shrtdesc, FullDesc,
    isAllowCoupon, minOrderQty, maxOrderQty, paymentmode,
    sellMRP, discountPer, quantity, prodUnit, color, size, Attributes, vcid,
    VATP, directAmt, DAP, shippingcharges, imageByteCode, KeyFeatures, StockIn,
    ReplacementDay, ProcurementSLA, CashOnDelivery, Pkg_Weight_Kg, Pkg_Length_cms,
    Pkg_Breadth_cms, Pkg_Height_cms, WarrentyInfoCare, DealsIds, GroupId, YWillRece, ismerchantstatus, productentry, packerdetail, importerdetail, manufacturedetail, hsn, luxurycess, procurementsla1, ddlseller, ddlprocurement, Specification, productSKUCode, BV, PV, CASHBACK, ActivationPv) {
    const common = {
      sprid: SPRID, mprid: MPRID, branchid: BranchId, companyid: CompanyID, catid, subcatid, brand: brandid, prcode: ProductCode, subprcode: SubProductCode,
      prodtitle: prodTitle, activefrom: fromdate, activeto: todate, shortdesc: shrtdesc, fulldesc: FullDesc, isallowcoupon: isAllowCoupon,
      minorderqty: minOrderQty, maxorderqty: maxOrderQty, paymode: Paymode, sellmrp: sellMRP, discountper: discountPer, qty: quantity, produnit: prodUnit,
      color, size, prodimages: imageByteCode, allattributes: Attributes, vcid, vatp: VATP, directamt: directAmt, dap: DAP, replacementday: ReplacementDay,
      keyfeatures: KeyFeatures, stockin: StockIn,
    };
    let row;
    if (ismerchantstatus === 'Draft' || ismerchantstatus === 'SendtoQC') {
      let Mstatus = 0;
      if (ismerchantstatus === 'SendtoQC') {
        Mstatus = 4;
      }
      if (luxurycess === '') {
        luxurycess = String(0);
      }
      if (Specification === null || Specification === undefined || Specification === 'undefined') {
        Specification = '';
      }
      row = await db.procOne(D, 'ims_usp_createproduct_temp', {
        ...common,
        sprid: 0,
        mprid: 0,
        procurementsla: procurementsla1,
        shippingcharges,
        cashondelivery: CashOnDelivery,
        pkg_weight_kg: Pkg_Weight_Kg,
        pkg_length_cms: Pkg_Length_cms,
        pkg_breadth_cms: Pkg_Breadth_cms,
        pkg_height_cms: Pkg_Height_cms,
        warrentyinfocare: WarrentyInfoCare,
        dealsids: DealsIds,
        groupid: GroupId,
        ywillrece: YWillRece,
        ismerchantstatus: Mstatus,
        productentry,
        fullfillment: ddlseller,
        procurementtype: ddlprocurement,
        hsn,
        luxurycess,
        manufacturingdetail: manufacturedetail,
        importerdetail,
        packerdetail,
        countryorigin: 96,
        specification: Specification,
        productskucode: productSKUCode,
        bv: BV,
        pv: PV,
        cashback: CASHBACK,
        activationpv: ActivationPv,
      });
    } else {
      row = await db.procOne(D, 'ims_usp_createproduct', {
        ...common,
        procurementsla: ProcurementSLA,
        shippingcharges,
        cashondelivery: CashOnDelivery,
        pkg_weight_kg: Pkg_Weight_Kg,
        pkg_length_cms: Pkg_Length_cms,
        pkg_breadth_cms: Pkg_Breadth_cms,
        pkg_height_cms: Pkg_Height_cms,
        warrentyinfocare: WarrentyInfoCare,
        dealsids: DealsIds,
        groupid: GroupId,
        ywillrece: YWillRece,
        specification: Specification,
        productskucode: productSKUCode,
        bv: BV,
        pv: PV,
        cashback: CASHBACK,
        activationpv: ActivationPv,
      });
    }
    const v = outv(row, 'STRRESULT');
    if (v === null || v === undefined) throw new TypeError('Object reference not set to an instance of an object.');
    return String(v);
  }

  async InsertBulkProductList(BranchId, XMLProductList) {
    let obj = [];
    try {
      const rows = await db.proc(D, 'usp_insertbulkproduct', { branchid: BranchId, xmlproductlist: XMLProductList });
      obj = mapRows(rows, Excel_Product_Detail);
    } catch (ex) {
      if (!isDbError(ex)) throw ex;
    }
    return obj;
  }

  async InsertBulkProduct(BranchId, XMLProductList) {
    let ds = { Tables: [] };
    try {
      const rows = await db.proc(D, 'usp_insertbulkproduct', { branchid: BranchId, xmlproductlist: XMLProductList });
      ds = { Tables: [rows] };
    } catch (ex) {
      if (!isDbError(ex)) throw ex;
    }
    return ds;
  }

  async GetProudctDetail(SPRID, MPRID) {
    let obj = {}; // legacy: new ProductFullDetail() (defaults) unless the query succeeds
    try {
      const rows = await db.proc(D, 'ims_usp_getproductdetail', { sprid: SPRID, mprid: MPRID });
      obj = rows.length > 0 ? mapRow(rows[0], ProductFullDetail) : null;
    } catch (ex) {
      if (!isDbError(ex)) throw ex;
    }
    return obj;
  }

  async Product_List(prid) {
    const rows = await db.query(D, 'select * from ims_masterproduct where mprid = @prid', { prid });
    return mapRows(rows, Product_Master_Main);
  }

  async CategoryAttribute_DataSet(MainCatId, CatId, SubCatId, BranchId) {
    let ds = { Tables: [] };
    try {
      const rows = await db.proc(D, 'uspgetattributeforexcel', { maincatid: MainCatId, catid: CatId, subcatid: SubCatId, branchid: BranchId });
      ds = { Tables: [rows] };
    } catch (ex) {
      if (!isDbError(ex)) throw ex;
    }
    return ds;
  }

  async CategoryAttribute_List(MainCatId, CatId, SubCatId) {
    let obj = [];
    try {
      const rows = await db.proc(D, 'usp_getattributelist', { maincatid: CatId, catid: CatId, subcatid: SubCatId });
      obj = mapRows(rows, ddl_Master);
    } catch (ex) {
      if (!isDbError(ex)) throw ex;
    }
    return obj;
  }

  async Product_Listmaster() {
    return mapRows(await db.query(D, 'select * from ims_masterproduct', {}), Product_Master_Main);
  }

  async Product_Main_OnMPRID(MPRID) {
    return mapRow(await db.queryOne(D, 'select * from ims_masterproduct where mprid = @MPRID limit 1', { MPRID }), Product_Master_Main);
  }

  async Product_Main_OnPrCode(PrCode) {
    return mapRow(await db.queryOne(D, 'select * from ims_masterproduct where productcode = @PrCode limit 1', { PrCode }), Product_Master_Main);
  }

  async ProductCodeCheck(ProductCode) {
    const pb = { Message: null, ReturnValue: null, Success: null };
    try {
      const row = await db.procOne(D, 'ims_usp_productcodeexist', { productcode: ProductCode });
      pb.ReturnValue = cs(outv(row, 'SqlResult'));
      pb.Success = toBool(outv(row, 'Success'));
      pb.Message = cs(outv(row, 'Message'));
    } catch (ex) {
      if (!isDbError(ex)) throw ex;
      pb.ReturnValue = '';
      pb.Success = false;
      pb.Message = String(ex.message);
    }
    return pb;
  }

  async ApproveAndNewSale(CheckIds, BranchId) {
    let OutputResult = '';
    try {
      const row = await db.procOne(D, 'usp_multipleapproveandnewsale', { checkids: CheckIds, branchid: BranchId });
      const v = outv(row, 'strResult');
      if (v === null || v === undefined) throw new TypeError('Object reference not set to an instance of an object.');
      OutputResult = String(v);
    } catch (ex) {
      OutputResult = ex.message;
    }
    return OutputResult;
  }

  async ChangeQCStatus(CheckIds, QCStatus, Reason) {
    let ret = 0;
    try {
      await db.proc(D, 'usp_changeqcstatus', { checkids: CheckIds, qcstatus: QCStatus, errorreason: Reason });
      ret = 1;
    } catch (ex) {
      // legacy: empty catch
    }
    return ret;
  }

  async DeleteQCProduct(CheckIds) {
    let ret = 0;
    try {
      await db.proc(D, 'usp_deleteqcproduct', { checkids: CheckIds });
      ret = 1;
    } catch (ex) {
      // legacy: empty catch
    }
    return ret;
  }
}

module.exports = ProductDal;
