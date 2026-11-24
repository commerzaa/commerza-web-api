/** Exports (static, all async): sp_RechargeCondition(trackid, mobile, amount, mobileoperator, reference, apiid, RechargeType, provider_id, paymentID, gatewayAmount): StatusModel{status,message}|null; Serviceprovider(type): tbl_serviceProviders[]; GetPendingRecharge(trackid): tbl_recharge[]; updateRechargeSatus(id, status, RechareType): void; GetRechargeReport(trackid): tbl_recharge[] */
'use strict';
const { query, procOne, proc } = require('../db');
const { mapRow, mapRows } = require('../utils/shape');

const RECHARGE_PROPS = ['id', 'operator', 'mobile', 'amount', 'trackid', 'recharge_date', 'status', 'wallet', 'referenceno', 'apiid', 'report', 'message', 'prebal', 'curbal', 'RechargeType', 'Deductedamount'];
const SERVICE_PROVIDER_PROPS = ['id', 'Name', 'SPKEy', 'Type', 'status', 'commissionType', 'commissionValue', 'chargetype', 'chargevalue'];

async function sp_RechargeCondition(trackid, mobile, amount, mobileoperator, reference, apiid, RechargeType, provider_id, paymentID, gatewayAmount) {
  const row = await procOne('affiliate', 'sp_rechargecondition', {
    trackid, amount, mobile, operator: mobileoperator, reference, apiid: apiid == null ? null : String(apiid),
    rechargetype: RechargeType, operatorid: provider_id, paymentid: paymentID, gatewayamount: gatewayAmount,
  });
  return mapRow(row, ['status', 'message']); // StatusModel (null when no row, like FirstOrDefault)
}

async function Serviceprovider(type) {
  // Legacy SQL aliased the last column "chargetype" too (so chargevalue was never filled and stayed 0).
  const rows = await query('affiliate',
    "select id, Name, SPKEy, Type, status, coalesce(commissionType,'0') as commissionType, coalesce(commissionValue,0) as commissionValue, coalesce(chargetype,'0') as chargetype, 0 as chargevalue from tbl_serviceProviders where type=@type",
    { type });
  return mapRows(rows, SERVICE_PROVIDER_PROPS);
}

async function GetPendingRecharge(trackid) {
  const rows = await query('affiliate', "select * from tbl_recharge where status='Response waiting' and trackid=@trackid", { trackid });
  return mapRows(rows, RECHARGE_PROPS);
}

async function updateRechargeSatus(id, status, RechareType) {
  await proc('affiliate', 'sp_rechargestatus', { status, id, rechareType: RechareType });
}

async function GetRechargeReport(trackid) {
  const rows = await query('affiliate', 'select * from tbl_recharge where trackid=@trackid order by id desc', { trackid });
  return mapRows(rows, RECHARGE_PROPS);
}

module.exports = { sp_RechargeCondition, Serviceprovider, GetPendingRecharge, updateRechargeSatus, GetRechargeReport };
