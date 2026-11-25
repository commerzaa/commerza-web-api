/** Exports: PROPS-only descriptors of the C# property bag(s) in Models/CustomerAddress.cs: CustomerAddress (table ims_customeraddress), GetCustomerAddressInfoList
 *   { PROPS: [PascalCase property names], TABLE?: '<EF table>', NOT_MAPPED?: [...] } per class name; use mapRows(rows, X.PROPS). No methods in C#. */
'use strict';
const CustomerAddress = {"PROPS":["AddressGuid","AddressType","AddressTypes","CityId","CityName","CountryId","CountryName","CreatedDate","CurrencyId","DistrictName","Email1","Email2","FaxNo1","ADDRESSTYPE1","CNAME","FaxNo2","Id","IsActive","IsDefault","IsVerified","LandMark","LogId","PhoneNo1","PhoneNo2","PinCode","Remarks","ShortAddress","StateId","StateName","ToUserId","ToUserType","ToUserTypes","VillageName"],"TABLE":"ims_customeraddress","NOT_MAPPED":["AddressTypes","ToUserTypes"]};
const GetCustomerAddressInfoList = {"PROPS":["AddressInfoList"]};
module.exports = { ...CustomerAddress, CustomerAddress, GetCustomerAddressInfoList };
