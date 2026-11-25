/** Exports: class Kit_Master (table kit_master; props kid, PCode, Title, Image, Type, Amount, DAP, PV, BV, DistAmount, VatInPer, CMGAmount, DirectIncome, BinaryIncome, Epin_Commission, EveryDayTaskIncome, Capping, SurfingSlot, Status, ROI, NoOfMonth, Decription, vat)
 *          class BindKitMasterAndFEature (no table; props LiKit_Master)
 *   async GetKitList() : Kit_Master[]  (Status == 1; only kid, Amount and Title = Title + " ( Rs " + Amount + " )")
 *   async GetKitList(int kid) : Kit_Master[]  (Status == 1 && kid)
 *   async GetKitList(string PlanName) : Kit_Master[]  (Status == 1 && Type == PlanName)
 *       -- C# overloads: no argument / number => kid / string => PlanName
 *   async GetallKitList() : Kit_Master[]  (kid desc)
 *   async GetAllKitList(string searchfield, string searchvalue) : Kit_Master[]  (proc usp_Kit_Master @SearchField,@SearchValue)
 *   async PlanList() : string[]  (distinct Type)
 *   async epinRequert(double RegNo, string getepinType, string numofEpin, string paymode, string paydate, string bankName, string branchname,
 *         string remarks, string ReqType, double Epin_reqID, double NumofTranEpin, string referral, string getimagebytecode, string bankReffNo,
 *         string totalAmount, string servicetax, string IFSCcode) : string  (proc SP_RequestEpin ... @varResult out)
 *   async UpdateKits(string Mode, string KID, string PCODE, string TITLE, string MININVESTMENT, string MAXINVESTMENT, string SUBSCRIPTIONDETAILS,
 *         string ISACTIVE, string PackageColor, string AmountColor, string MRP, string IMAGE, string GST, string PACKAGEYPE, string PAUTOCODE,
 *         string PURCHASEPRICETYPE, string directincome, string Type) : string  (proc [DBO].[USP_CREATE_NEW_PIN] ... @STRRESULT out)
 *   async amcepinRequert(string numofEpin) : string  (proc SP_generate_amc_Epin; errors => "Something went wrong. Please try later")
 *   async amcEpinTransfer(double regNo, string numofEpin, string remarks) : string  (proc usp_transferAMCEpins; errors => same message)
 *   async AddOrUpdateFeature(string FeatureShortExplanation, string FeatureBreifExplanation, int Status, int Mode, int TFMID, int Quantity,
 *         int IsEditable, int IsShowProductList, int IsAutoRedeem) : string  (proc [DBO].[Usp_ManageKitFeatureMaster] ... @STRRESULT out)
 *   async AddOrUpdateProduct(string ProductName, string ProductCode, string ProductDescription, int Status, int Mode, int TKPMID) : string
 *         (proc [DBO].[Usp_ManageKitProductMaster] ... @STRRESULT out)
 *   Kit_Master.BindKitMasterAndFEature : model class (also ./BindKitMasterAndFEature)
 */
'use strict';
const { query, proc, procOne } = require('../../db');
const { defineModel, out, DB } = require('./_models');
const { toStr } = require('../_libhelpers');

const Base = defineModel('Kit_Master', 'kit_master', { kid: 0, PCode: null, Title: null, Image: null, Type: null, Amount: 0, DAP: 0, PV: 0, BV: 0, DistAmount: 0, VatInPer: 0, CMGAmount: 0, DirectIncome: 0, BinaryIncome: 0, Epin_Commission: 0, EveryDayTaskIncome: 0, Capping: 0, SurfingSlot: 0, Status: 0, ROI: 0, NoOfMonth: 0, Decription: null, vat: 0 });
const BindKitMasterAndFEature = defineModel('BindKitMasterAndFEature', null, { LiKit_Master: null });

// Convert.ToDecimal(string): throws FormatException on invalid input, null => 0
function toDecimal(s) {
  if (s === null || s === undefined) return 0;
  const t = String(s).trim();
  if (!/^[+-]?(\d+(,\d{3})*)?(\.\d+)?$/.test(t) || t === '' || t === '.' ) {
    const e = new Error('Input string was not in a correct format.');
    e.name = 'FormatException';
    throw e;
  }
  return Number(t.replace(/,/g, ''));
}

class Kit_Master extends Base {
  async GetKitList(...args) {
    if (args.length === 0) {
      const Rows = await query(DB, "select kid, (title || ' ( Rs ' || amount::text || ' )') as title, amount from kit_master where status=1");
      const LI = [];
      for (const item of Rows) {
        const km = new Kit_Master();
        km.Title = item.title;
        km.kid = item.kid;
        km.Amount = item.amount;
        LI.push(km);
      }
      return LI;
    }
    const a = args[0];
    if (typeof a === 'string') {
      const PlanName = a;
      return Base.mapAll(await query(DB, 'select * from kit_master where status=1 and type=@PlanName', { PlanName }));
    }
    const kid = a;
    return Base.mapAll(await query(DB, 'select * from kit_master where status=1 and kid=@kid', { kid }));
  }

  async GetallKitList() {
    return Base.mapAll(await query(DB, 'select * from kit_master order by kid desc'));
  }

  async GetAllKitList(searchfield, searchvalue) {
    return Base.mapAll(await proc(DB, 'usp_kit_master', { searchfield, searchvalue }));
  }

  async PlanList() {
    const rows = await query(DB, 'select distinct type from kit_master');
    return rows.map((r) => r.type);
  }

  async epinRequert(RegNo, getepinType, numofEpin, paymode, paydate, bankName, branchname, remarks, ReqType, Epin_reqID, NumofTranEpin, referral, getimagebytecode, bankReffNo, totalAmount, servicetax, IFSCcode) {
    let getountput = '';
    const row = await procOne(DB, 'sp_requestepin', {
      epin_reqid: Epin_reqID,
      loginid: '',
      regno: RegNo,
      kid: getepinType,
      reqpinqty: numofEpin,
      paymode,
      bankname: bankName,
      branchname,
      branchcode: '',
      ddchequeno: '',
      ddchequedate: paydate,
      reqdate: '',
      comment: remarks,
      reqtype: ReqType,
      transpinqty: NumofTranEpin,
      receipt: getimagebytecode,
      bankreff: bankReffNo,
      from_brcode: '',
      from_emp_code: '',
      to_brcode: '',
      totalamount: toDecimal(totalAmount),
      servicetax: toDecimal(servicetax),
      transid: '',
      ifsccode: IFSCcode.toUpperCase(),
    });
    getountput = toStr(out(row, 'varResult'));
    return getountput.toString();
  }

  async UpdateKits(Mode, KID, PCODE, TITLE, MININVESTMENT, MAXINVESTMENT, SUBSCRIPTIONDETAILS, ISACTIVE, PackageColor, AmountColor, MRP, IMAGE, GST, PACKAGEYPE, PAUTOCODE, PURCHASEPRICETYPE, directincome, Type) {
    const row = await procOne(DB, 'usp_create_new_pin', {
      mode: Mode,
      kid: KID,
      pcode: PCODE,
      title: TITLE,
      mininvestment: MININVESTMENT,
      maxinvestment: MAXINVESTMENT,
      subscriptiondetails: SUBSCRIPTIONDETAILS,
      isactive: ISACTIVE,
      packagecolor: PackageColor,
      amountcolor: AmountColor,
      mrp: MRP,
      image: IMAGE,
      service_tax_per: GST,
      iscompound: 0,
      packageype: PACKAGEYPE,
      pautocode: PAUTOCODE,
      purchasepricetype: PURCHASEPRICETYPE,
      directincome,
      type: Type,
    });
    const Ret = toStr(out(row, 'STRRESULT'));
    return Ret;
  }

  async amcepinRequert(numofEpin) {
    let getountput = '';
    try {
      const row = await procOne(DB, 'sp_generate_amc_epin', { transpinqty: numofEpin });
      getountput = toStr(out(row, 'varResult'));
      return getountput.toString();
    } catch (e) {
      getountput = 'Something went wrong. Please try later';
      return getountput.toString();
    }
  }

  async amcEpinTransfer(regNo, numofEpin, remarks) {
    let getountput = '';
    try {
      const row = await procOne(DB, 'usp_transferamcepins', { regno: regNo, transpinqty: numofEpin, remarks });
      getountput = toStr(out(row, 'varResult'));
      return getountput.toString();
    } catch (ex) {
      getountput = 'Something went wrong. Please try later';
      return getountput.toString();
    }
  }

  async AddOrUpdateFeature(FeatureShortExplanation, FeatureBreifExplanation, Status, Mode, TFMID, Quantity, IsEditable, IsShowProductList, IsAutoRedeem) {
    const row = await procOne(DB, 'usp_managekitfeaturemaster', {
      featureshortexplanation: FeatureShortExplanation,
      featurebreifexplanation: FeatureBreifExplanation,
      kitid: '0',
      allfeatureid: '',
      status: Status,
      mode: Mode,
      addedbyuserid: '0',
      tfmid: TFMID,
      quantity: Quantity,
      iseditable: IsEditable,
      isshowproductlist: IsShowProductList,
      isautoredeem: IsAutoRedeem,
    });
    const Ret = toStr(out(row, 'STRRESULT'));
    return Ret;
  }

  async AddOrUpdateProduct(ProductName, ProductCode, ProductDescription, Status, Mode, TKPMID) {
    const row = await procOne(DB, 'usp_managekitproductmaster', {
      productname: ProductName,
      productcode: ProductCode,
      productdescription: ProductDescription,
      status: Status,
      mode: Mode,
      tkpmid: TKPMID,
    });
    const Ret = toStr(out(row, 'STRRESULT'));
    return Ret;
  }
}

module.exports = Kit_Master;
module.exports.BindKitMasterAndFEature = BindKitMasterAndFEature;
