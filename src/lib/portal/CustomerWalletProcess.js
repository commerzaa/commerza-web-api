/**
 * Exports (C# file DAL/CustomerWalletProcess.cs, static class CutomerWalletProcess - exported under both names):
 *   async GetUserWalletBalance(int CLID): decimal; async GetCustomerWalletStatements(int CLID): TBL_CUSTOMERWALLET_STATEMENTS[];
 *   async GetCustomerBankAccountDetails(int CLID): CustomerBankAccount|null; async GetUserMobileNoByCLID(int CLID): string;
 *   async CheckUserPassCode(int CLID): int; async GetUserPasscodeByCLID(int CLID): Int64; async VerifyUserPasscodeByCLID(int CLID, Int64 passCode): Int64;
 *   async GetAadhaarNoByCLID(int CLID): string;
 *   async CompleteBankTransfer(int CLID, ACCOUNTNO, BANKNAME, BRANCHNAME, IFSCCODE, ACCOUNTHOLDER, decimal Amount): { TransResult, TransRefNo }  (C# out params)
 * Portal DataBaseContext = Db_Shopping.
 * PORT-NOTE: GetUserMobileNoByCLID - legacy ran the SELECT with ExecuteSqlCommand, which returns -1 for a SELECT, so it returned "-1" (not the phone)
 *   whenever CLID != 0; reproduced.
 * PORT-NOTE: GetUserPasscodeByCLID - legacy read the bigint PASSCODE via SqlQuery<int>, which throws an invalid-cast exception (caught => 0) whenever a
 *   row exists; reproduced (always 0).
 * PORT-NOTE: USP_GETCUSTOMERBANKDETAILS is not in the Db_Shopping schema dump.
 */
'use strict';
const db = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');

const DB = 'shopping';
const firstCol = (row) => (row ? row[Object.keys(row)[0]] : undefined);
const col = (row, name) => {
  if (!row) return undefined;
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase());
  return k !== undefined ? row[k] : undefined;
};

const TBL_CUSTOMERWALLET_STATEMENTS = ['TCWSID', 'CLID', 'PROCESSDATE', 'CRDRTYPE', 'CRAMT', 'DRAMT', 'OLD_BALANCE', 'BALANCE', 'REMARKS', 'TRACENO', 'STATUS'];
const CustomerBankAccount = ['CLID', 'MOBILENO', 'ACCOUNTHOLDERNAME', 'ACCOUNTNO', 'BANKNAME', 'BRANCHNAME', 'IFSCCODE', 'ADDRESS'];

async function GetUserWalletBalance(CLID) {
  let userWallet = 0;
  const row = await db.procOne(DB, 'usp_getcustomerwallet', { clid: CLID });
  const v = firstCol(row); // SqlQuery<decimal>().FirstOrDefault()
  userWallet = v === undefined || v === null ? 0 : Number(v);
  return userWallet;
}

async function GetCustomerWalletStatements(CLID) {
  const rows = await db.proc(DB, 'usp_getcustomerwallet_statements', { clid: CLID });
  return mapRows(rows, TBL_CUSTOMERWALLET_STATEMENTS);
}

async function GetCustomerBankAccountDetails(CLID) {
  const row = await db.procOne(DB, 'usp_getcustomerbankdetails', { clid: CLID });
  return row ? mapRow(row, CustomerBankAccount) : null;
}

async function GetUserMobileNoByCLID(CLID) {
  let MobileNo = '';
  try {
    if (CLID !== 0) {
      await db.query(DB, "select coalesce(phone, '') as mobileno from tbl_customerlogin where clid = @CLID", { CLID });
      MobileNo = '-1'; // ExecuteSqlCommand(SELECT ...).ToString()
    }
    return MobileNo;
  } catch (Exp) {
    return MobileNo;
  }
}

async function CheckUserPassCode(CLID) {
  let passcodeCount = 0;
  try {
    if (CLID !== 0) {
      const v = await db.scalar(DB, 'select coalesce(count(1), 0)::int from tbl_customerpasscodes where clid = @CLID and active = 1', { CLID });
      passcodeCount = v === null || v === undefined ? 0 : Number(v);
    }
    return passcodeCount;
  } catch (Exp) {
    return passcodeCount;
  }
}

async function GetUserPasscodeByCLID(CLID) {
  let passcode = 0;
  try {
    if (CLID !== 0) {
      const rows = await db.query(DB, 'select coalesce(passcode, 0) as passcode from tbl_customerpasscodes where clid = @CLID and active = 1', { CLID });
      if (rows.length > 0) throw new Error("The specified cast from a materialized 'System.Int64' type to the 'System.Int32' type is not valid.");
      passcode = 0;
    }
    return passcode;
  } catch (Exp) {
    return passcode;
  }
}

async function VerifyUserPasscodeByCLID(CLID, passCode) {
  let passcode = 0;
  try {
    if (CLID !== 0) {
      const v = await db.scalar(DB, 'select 1 from tbl_customerpasscodes where clid = @CLID and passcode = @passCode and active = 1', { CLID, passCode });
      passcode = v === null || v === undefined ? 0 : Number(v);
    }
    return passcode;
  } catch (Exp) {
    return passcode;
  }
}

async function GetAadhaarNoByCLID(CLID) {
  let passcode = '';
  try {
    if (CLID !== 0) {
      const rows = await db.query(DB, "select coalesce(right(addressnumber, 4), '0') as v from tbl_customer_kyc where type = 'Address-Proof' and clid = @CLID", { CLID });
      passcode = rows.length ? rows[0].v : null; // FirstOrDefault() => null when no row
    }
    return passcode;
  } catch (Exp) {
    return passcode;
  }
}

async function CompleteBankTransfer(CLID, ACCOUNTNO, BANKNAME, BRANCHNAME, IFSCCODE, ACCOUNTHOLDER, Amount) {
  let ResultOutput = '';
  let TransactionId = '';
  const row = await db.procOne(DB, 'usp_customer_transfertobank', {
    clid: CLID,
    amount: Amount,
    accountholdername: ACCOUNTHOLDER,
    accountno: ACCOUNTNO,
    bankname: BANKNAME,
    branchname: BRANCHNAME,
    ifsc: IFSCCODE,
  });
  const so = col(row, 'stroutput');
  const ti = col(row, 'transactionid');
  if (so === null || so === undefined || ti === null || ti === undefined) throw new TypeError('Object reference not set to an instance of an object.');
  ResultOutput = String(so);
  TransactionId = String(ti);
  const TransRefNo = TransactionId;
  const TransResult = ResultOutput;
  return { TransResult, TransRefNo };
}

const CutomerWalletProcess = {
  GetUserWalletBalance, GetCustomerWalletStatements, GetCustomerBankAccountDetails, GetUserMobileNoByCLID, CheckUserPassCode,
  GetUserPasscodeByCLID, VerifyUserPasscodeByCLID, GetAadhaarNoByCLID, CompleteBankTransfer,
};
module.exports = { ...CutomerWalletProcess, CutomerWalletProcess };
