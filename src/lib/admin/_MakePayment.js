/** Exports: class _MakePayment (no table; props Name, Address, ContactNo, CityName, EmailId, State, Amount, Country, Remark, Pincode, RegNo, ProductInfo)
 *   Source Models/_MakePayment.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const _MakePayment = defineModel('_MakePayment', null, { Name: null, Address: null, ContactNo: null, CityName: null, EmailId: null, State: null, Amount: null, Country: null, Remark: null, Pincode: null, RegNo: null, ProductInfo: null });

module.exports = _MakePayment;
