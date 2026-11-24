/**
 * Exports (C# file DAL/AddressDAL.cs, class CustomerAddressDal; the commented-out AddressDal is not ported):
 *   class CustomerAddressDal { async CreateAddress(CustomerAddress adrs, string IPAddress): ProcessResult;
 *     async GetAddress(Int64 ToUserID): CustomerAddress|null; async GetAddressList(CustomerAddress adrs): GetCustomerAddressInfoList[];
 *     async IsActive_Address(adrs, IPAddress): ProcessResult; async IsDefault_Address(adrs, IPAddress): ProcessResult;
 *     async IsVerified_Address(adrs, IPAddress): ProcessResult }
 * ProcessResult = { Message, ReturnValue, Success }.
 * PORT-NOTE: legacy called the procedures with positional EXEC text; named parameters are used here (same values).
 * PORT-NOTE: Franchise DataBaseContext = Db_Shopping (Web.config), so 'shopping' is used.
 */
'use strict';
const db = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');

const CustomerAddress = ['AddressGuid', 'AddressType', 'CityId', 'CityName', 'CountryId', 'CountryName', 'CreatedDate', 'CurrencyId', 'DistrictName',
  'Email1', 'Email2', 'FaxNo1', 'FaxNo2', 'Id', 'IsActive', 'IsDefault', 'IsVerified', 'LandMark', 'LogId', 'PhoneNo1', 'PhoneNo2', 'PinCode',
  'Remarks', 'ShortAddress', 'StateId', 'StateName', 'ToUserId', 'ToUserType', 'VillageName'];

const str = (v) => (v === null || v === undefined ? '' : String(v)); // ToStringOrEmpty
const colVal = (row, name) => {
  if (!row) return null;
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? null : row[k];
};
const toBool = (v) => {
  if (v === true || v === false) return v;
  if (v === 1 || v === '1' || String(v).toLowerCase() === 'true') return true;
  if (v === 0 || v === '0' || String(v).toLowerCase() === 'false') return false;
  throw new Error('String was not recognized as a valid Boolean.');
};
const cs = (v) => (v === null || v === undefined ? '' : String(v)); // Convert.ToString

function toPR(row) {
  const pb = { Message: null, ReturnValue: null, Success: null };
  pb.ReturnValue = cs(colVal(row, 'sqlresult'));
  pb.Success = toBool(colVal(row, 'success'));
  pb.Message = cs(colVal(row, 'message'));
  return pb;
}

async function simple(procName, a, IPAddress) {
  const pb = { Message: null, ReturnValue: null, Success: null };
  try {
    const row = await db.procOne('shopping', procName, {
      addressguid: a.AddressGuid, touserid: a.ToUserId, tousertype: a.ToUserType, ipaddress: IPAddress,
    });
    return toPR(row);
  } catch (ex) {
    pb.ReturnValue = '';
    pb.Success = false;
    pb.Message = String(ex && ex.message);
    return pb;
  }
}

class CustomerAddressDal {
  async CreateAddress(adrs, IPAddress) {
    let pb = { Message: null, ReturnValue: null, Success: null };
    try {
      const row = await db.procOne('shopping', 'ims_usp_createcustomeraddress', {
        id: adrs.Id,
        pincode: str(adrs.PinCode),
        shortaddress: str(adrs.ShortAddress),
        landmark: str(adrs.LandMark),
        countryid: adrs.CountryId,
        cityname: str(adrs.CityName),
        countryname: '',
        phoneno1: str(adrs.PhoneNo1),
        phoneno2: str(adrs.PhoneNo2),
        email1: str(adrs.Email1),
        remarks: 'Its Created Directly.',
        addresstype: adrs.AddressType,
        touserid: adrs.ToUserId,
        tousertype: adrs.ToUserType,
        ipaddress: IPAddress,
      });
      pb = toPR(row);
    } catch (ex) {
      pb.ReturnValue = '';
      pb.Success = false;
      pb.Message = String(ex && ex.message);
    }
    return pb;
  }

  async GetAddress(ToUserID) {
    const row = await db.queryOne('shopping', 'select * from ims_customeraddress where touserid = @ToUserID and isdefault = true limit 1', { ToUserID });
    return mapRow(row, CustomerAddress);
  }

  async GetAddressList(adrs) {
    const rows = await db.proc('shopping', 'ims_usp_getall_customeraddress', {
      addressguid: adrs.AddressGuid, touserid: adrs.ToUserId, tousertype: adrs.ToUserType,
    });
    // GetCustomerAddressInfoList : ProcessResult (+ AddressInfoList, whose setter is a no-op => stays empty)
    return mapRows(rows, ['Message', 'ReturnValue', 'Success']).map((r) => ({ ...r, AddressInfoList: [] }));
  }

  async IsActive_Address(a, IPAddress) {
    return simple('ims_usp_isactive_customeraddress', a, IPAddress);
  }

  async IsDefault_Address(adrs, IPAddress) {
    return simple('ims_usp_isdefault_customeraddress', adrs, IPAddress);
  }

  async IsVerified_Address(a, IPAddress) {
    return simple('ims_usp_isverified_customeraddress', a, IPAddress);
  }
}

module.exports = CustomerAddressDal;
