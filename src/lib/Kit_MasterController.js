/** Exports: class Kit_Master (Models/Kit_MasterController.cs; table kit_master;
 *   props kid, PCode, Title, Image, Type, Amount, DAP, PV, BV, DistAmount, VatInPer, CMGAmount, DirectIncome, BinaryIncome, Epin_Commission, Status)
 *   async GetKitList() : Kit_Master[]           -> active kits, only kid/Title("<Title> ( Rs <Amount> )")/Amount filled
 *   async GetKitList(int kid) : Kit_Master[]    -> active kit with that kid          (number argument)
 *   async GetKitList(string PlanName) : Kit_Master[] -> active kits of that Type     (string argument)
 *   async GetallKitList() : Kit_Master[] ; async GetAllKitList(string searchfield, string searchvalue) : Kit_Master[] (usp_Kit_Master)
 *   async PlanList() : string[] ; async epinRequert(RegNo, getepinType, numofEpin, paymode, paydate, bankName, branchname, remarks, ReqType, Epin_reqID, NumofTranEpin, referral, getimagebytecode, bankReffNo) : string
 *   async InsertKits(kittype, title, amount, dap, pv, bv, distAmount, directincome, storecommission) : string
 *   async UpdateKits(kid, KitName, KitPrice, matchpoint, imagename, mode, status, DAP, BV, Capping) : string
 *   async amcepinRequert(string numofEpin) : string ; async amcEpinTransfer(regNo, numofEpin, remarks) : string
 */
'use strict';
const { query, proc, procOne } = require('../db');
const { mapRows } = require('../utils/shape');
const { out, toStr } = require('./_libhelpers');

const PROPS = ['kid', 'PCode', 'Title', 'Image', 'Type', 'Amount', 'DAP', 'PV', 'BV', 'DistAmount', 'VatInPer', 'CMGAmount', 'DirectIncome', 'BinaryIncome', 'Epin_Commission', 'Status'];

class Kit_Master {
  async GetKitList(arg) {
    if (arguments.length === 0 || arg === undefined) {
      const Rows = await query('affiliate', "select kid, coalesce(title,'') || ' ( Rs ' || amount::text || ' )' as title, amount from kit_master where status=1");
      const LI = [];
      for (const item of Rows) {
        const km = { kid: 0, PCode: null, Title: null, Image: null, Type: null, Amount: 0, DAP: 0, PV: 0, BV: 0, DistAmount: 0, VatInPer: 0, CMGAmount: 0, DirectIncome: 0, BinaryIncome: 0, Epin_Commission: 0, Status: 0 };
        km.Title = item.title;
        km.kid = item.kid;
        km.Amount = item.amount;
        LI.push(km);
      }
      return LI;
    }
    if (typeof arg === 'number') {
      return mapRows(await query('affiliate', 'select * from kit_master where status=1 and kid=@kid', { kid: arg }), PROPS);
    }
    // string PlanName
    return mapRows(await query('affiliate', 'select * from kit_master where status=1 and lower(type)=lower(@PlanName)', { PlanName: arg }), PROPS);
  }

  async GetallKitList() {
    return mapRows(await query('affiliate', 'select * from kit_master order by kid desc'), PROPS);
  }

  async GetAllKitList(searchfield, searchvalue) {
    return mapRows(await proc('affiliate', 'usp_Kit_Master', { SearchField: searchfield, SearchValue: searchvalue }), PROPS);
  }

  async PlanList() {
    const rows = await query('affiliate', 'select distinct type from kit_master');
    return rows.map((r) => r.type);
  }

  async epinRequert(RegNo, getepinType, numofEpin, paymode, paydate, bankName, branchname, remarks, ReqType, Epin_reqID, NumofTranEpin, referral, getimagebytecode, bankReffNo) {
    const row = await procOne('affiliate', 'SP_RequestEpin', {
      Epin_reqID,
      regNo: RegNo,
      kid: getepinType,
      ReqPinQty: numofEpin,
      paymode,
      bankName,
      BranchName: branchname,
      BranchCode: '',
      ddChequeNo: '',
      ddChequeDate: paydate,
      reqDate: '',
      Comment: remarks,
      reqType: ReqType,
      transPinQty: NumofTranEpin,
      Receipt: getimagebytecode,
      bankReff: bankReffNo,
    });
    return toStr(out(row, 'varResult'));
  }

  async InsertKits(kittype, title, amount, dap, pv, bv, distAmount, directincome, storecommission) {
    const row = await procOne('affiliate', 'usp_Create_New_Pin', {
      kid: 0,
      mode: 'Add',
      kittype,
      title,
      amount,
      dap,
      pv,
      bv,
      distAmount,
      directincome,
      storecommission,
      Capping: 0,
    });
    return toStr(out(row, 'strResult'));
  }

  async UpdateKits(kid, KitName, KitPrice, matchpoint, imagename, mode, status, DAP, BV, Capping) {
    if (kid === 0) {
      mode = 'Add';
    }
    const row = await procOne('affiliate', 'usp_Create_New_Pin', {
      kid,
      mode,
      kittype: 'Joining Pin',
      title: KitName,
      amount: KitPrice,
      dap: DAP,
      pv: matchpoint,
      bv: BV,
      distAmount: '0.00',
      directincome: '0.00',
      storecommission: '0.00',
      Capping,
      imagename,
    });
    return toStr(out(row, 'strResult'));
  }

  async amcepinRequert(numofEpin) {
    let getountput = '';
    try {
      const row = await procOne('affiliate', 'SP_generate_amc_Epin', { transPinQty: numofEpin });
      getountput = toStr(out(row, 'varResult'));
      return getountput;
    } catch (ExpObj) {
      getountput = 'Something went wrong. Please try later';
      return getountput;
    }
  }

  async amcEpinTransfer(regNo, numofEpin, remarks) {
    let getountput = '';
    try {
      const row = await procOne('affiliate', 'usp_transferAMCEpins', { regNo, transPinQty: numofEpin, remarks });
      getountput = toStr(out(row, 'varResult'));
      return getountput;
    } catch (ExpObj) {
      getountput = 'Something went wrong. Please try later';
      return getountput;
    }
  }
}

module.exports = Kit_Master;
