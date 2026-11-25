/** Exports: { NewSaleDetails, CartList, NewSaleAtt } - class NewSaleDetails (no table; props CartList, BrCode, clients, remarks, paymode, LoginID, AgencyNo, Password, OTP, Distbv, EpinNo)
 *          class CartList (no table; props PRID, PRNAME, QTY, DAP, TDAP)
 *          class NewSaleAtt (no table; props LiCustomer_Paymodes)
 *   Source Models/Common_Classes.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const NewSaleDetails = defineModel('NewSaleDetails', null, { CartList: null, BrCode: null, clients: null, remarks: null, paymode: null, LoginID: null, AgencyNo: null, Password: null, OTP: null, Distbv: null, EpinNo: null });
const CartList = defineModel('CartList', null, { PRID: null, PRNAME: null, QTY: 0, DAP: 0, TDAP: 0 });
const NewSaleAtt = defineModel('NewSaleAtt', null, { LiCustomer_Paymodes: null });

module.exports = { NewSaleDetails, CartList, NewSaleAtt };
