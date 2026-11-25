'use strict';
/** Ported from Franchise\Controllers\CustomerPanel\Customer_Bank_Transfer.cs (Customer_Bank_TransferController) */
const express = require('express');
const { scalar, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const UtilityClass = require('../../lib/franchise/UtilityClass');

const router = express.Router();
const P = '/franchise/Customer_Bank_Transfer';
const nz = (v, d) => (v === undefined || v === null ? d : v);
const outInt = (rows, name) => { const n = parseInt(((rows && rows[0]) || {})[name.toLowerCase()], 10); return Number.isNaN(n) ? 0 : n; };

// auth ([SessionExpireCheck]) // route-config: franchisee/Customer-Bank-Transfer
router.all([`${P}/Index{/:id}`, '/franchise/franchisee/Customer-Bank-Transfer'], auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const fromDate = nz(p.fromDate, '');
  const toDate = nz(p.toDate, '');
  const SearchField = nz(p.SearchField, '');
  const SearchValue = nz(p.SearchValue, '');
  const DID = req.user.did;
  const MaxRows = await UtilityClass.GridPageSize();
  const page = p.page === undefined || p.page === null || p.page === '' ? 1 : parseInt(p.page, 10);
  const rows = await proc('shopping', 'USP_RESELLERWISE_CUSTOMER_TRANSFER_BANK_HISTORY', {
    startrowindex: page, maxrows: MaxRows, searchfield: SearchField.trim(), searchvalue: SearchValue.trim(), fromdate: fromDate, todate: toDate,
    mode: 0, requestid: '', plid: 0, did: DID,
  });
  const _Customer_Bank_Transfer = mapRows(rows, ['ROWNUMBER', 'TCTTB', 'CLID', 'BANKNAME', 'FNAME', 'PHONE', 'EMAILID', 'ACCOUNTNO', 'TRANSACTIONID',
    'ACCOUNTHOLDERNAME', 'WITHDRAWALAMOUNT', 'IFSC', 'Loginid', 'BRANCHNAME', 'Status', 'WITHDRAWALDATE', 'RESELLERNAME']);
  const TotalRecord = outInt(rows, 'totalcount');
  res.json({
    Model: _Customer_Bank_Transfer,
    Sumofdata: outInt(rows, 'sumofdata'),
    CurrentPage: page,
    GridPageSize: MaxRows,
    SearchField,
    SearchValue,
    fromDate,
    toDate,
    TotalRecord,
    NoPerPage: UtilityClass.GridNumbersPerPage(),
  });
}));

// auth
router.all(`${P}/Check_accountdetails{/:id}`, auth, asyncHandler(async (req, res) => {
  try {
    const r = await scalar('shopping', "select case when filename!='' then 1 else 0 end from Tbl_Admin_BankDetails where TABDID=@id", { id: req.p.ID });
    return res.json(r === null || r === undefined ? 0 : r);
  } catch (ex) {
    return res.json(2);
  }
}));

// auth
router.all(`${P}/Transaction_Data{/:id}`, auth, asyncHandler(async (req, res) => {
  try {
    const DID = req.user.did;
    const rows = await proc('shopping', 'USP_RESELLERWISE_TRANSACTION_COUNT', {
      withdrawalfromdate: req.p.fromDate, withdrawaltodate: req.p.toDate, searchfield: '', searchvalue: '', did: DID,
    });
    return res.json(mapRows(rows, ['Request', 'NoOFTransaction', 'AMOUNT']));
  } catch (e) {
    return res.json('');
  }
}));

// auth
router.all(`${P}/showdata{/:id}`, auth, asyncHandler(async (req, res) => {
  const DID = req.user.did;
  const rows = await proc('shopping', 'USP_GET_LASTRECORD_RESELLERWISE_CUSTOMER_BANK_HISTORY', { tcttbid: req.p.wdid, did: DID });
  res.json(mapRows(rows, ['DATE', 'USERNAME', 'PHONE', 'ACCOUNTHOLDERNAME', 'ACCOUNTNO', 'BANKNAME', 'BRANCHNAME', 'IFSC', 'WithDrawlPoints', 'Atc_WalletAddress', 'STATUS']));
}));

const approveReject = (client, a) => proc('shopping', 'USP_APPROVEREJECT_CUSTOMERBANKTRANSFER', {
  mode: a.status, clid: a.clid, tranactionid: a.Transactionid, adminremarks: a.Remarks, paymode: a.PaidMode, paidtransactionid: a.Transaction, activityby: a.EMPID,
});

// auth
router.all(`${P}/IsapprovetransactionBulk{/:id}`, auth, asyncHandler(async (req, res) => {
  const { status, All_data, Remarks, PaidMode, Transaction } = req.p;
  let ret = '';
  try {
    const Data = String(All_data).split('~'); // NullReference in C# when All_data missing -> caught below
    await UtilityClass.TrackError(status);
    if (Data.length > 0) {
      for (let i = 0; i < Data.length - 1; i++) {
        const Allvalue = Data[i].split('^');
        const clid = Allvalue[1];
        const Transactionid = Allvalue[0];
        const EMPID = req.user.did;
        await approveReject(null, { status, clid, Transactionid, Remarks, PaidMode, Transaction, EMPID });
        await UtilityClass.TrackError('2');
        if (status === '1') ret = 'approve';
        if (status === '2') ret = 'reject';
      }
    }
    return res.json(ret);
  } catch (ex) {
    await UtilityClass.TrackError(String(ex.message));
    return res.json(ret);
  }
}));

// auth
router.all(`${P}/Isapprovetransaction{/:id}`, auth, asyncHandler(async (req, res) => {
  const { status, clid, Transactionid, remarks, PaidMode, Transaction } = req.p;
  let ret = '';
  try {
    const EMPID = req.user.did;
    await approveReject(null, { status, clid, Transactionid, Remarks: remarks, PaidMode, Transaction, EMPID });
    if (status === '1') ret = 'approve';
    if (status === '2') ret = 'reject';
    return res.json(ret);
  } catch (ex) {
    return res.json(ret);
  }
}));

module.exports = router;
