/** Exports (static, all async, return raw response text or "" on failure): RegisterSender(RequestId, MobileNo, Name); SenderAvailableBalance(RequestId, MobileNo, Name); SenderExistRequest(RequestId, MobileNo, Name); AddBeneficiary(RequestId, MobileNo, BeneficiaryName, AccountNo, IFSCOrBankCode, BankName="NA"); GetBankDetails(RequestId, BankCode); AccountValidation(RequestId, MobileNo, AccountNo, BankCode, AadharNo="NA", PanNo="NA"); GetBeneficiaryDetails(RequestId, MobileNo); DeleteBeneficiary(RequestId, MobileNo, BeneficiaryCode); VerifyOTP(RequestId, VerifyReferenceId, OTP); ResendOTP(RequestId, VerifyReferenceId, OTP); MoneyTransfer(RequestId, MobileNo, BeneficiaryCode, Amount, TransType); TransactionEnquiry(RequestId, ClientRequestID); TransactionHistory(RequestId, MobileNo); GetTimestamp(value: Date) */
'use strict';
const config = require('../config');
const { postText } = require('./_http');

const BaseURI = 'http://180.179.20.116:8030/RemitMoney/mtransfer';

/** msg=<code>~<key>~<fields...>  posted as application/x-www-form-urlencoded raw string; failures return "". */
async function call(code, fields) {
  const PostData = 'msg=' + code + '~' + config.app.EzpayKey + '~' + fields.join('~');
  let StrResult = '';
  try {
    StrResult = await postText(BaseURI, PostData, { 'Content-Type': 'application/x-www-form-urlencoded' });
    return StrResult;
  } catch (e) {
    return StrResult;
  }
}

const RegisterSender = async (RequestId, MobileNo, Name) => call('E06003', [RequestId, MobileNo, Name, 'NA', 'NA']);
const SenderAvailableBalance = async (RequestId, MobileNo, Name) => call('E06005', [RequestId, MobileNo, 'NA', 'NA']);
const SenderExistRequest = async (RequestId, MobileNo, Name) => call('E06007', [RequestId, MobileNo, 'NA', 'NA']);
const AddBeneficiary = async (RequestId, MobileNo, BeneficiaryName, AccountNo, IFSCOrBankCode, BankName = 'NA') =>
  call('E06009', [RequestId, MobileNo, BeneficiaryName, AccountNo, IFSCOrBankCode, BankName, 'NA']);
const GetBankDetails = async (RequestId, BankCode) => call('E06029', [RequestId, BankCode, 'NA', 'NA']);
const AccountValidation = async (RequestId, MobileNo, AccountNo, BankCode, AadharNo = 'NA', PanNo = 'NA') =>
  call('E06031', [RequestId, MobileNo, AccountNo, BankCode, AadharNo, PanNo, 'NA', 'NA']);
const GetBeneficiaryDetails = async (RequestId, MobileNo) => call('E06011', [RequestId, MobileNo, 'NA', 'NA']);
const DeleteBeneficiary = async (RequestId, MobileNo, BeneficiaryCode) => call('E06013', [RequestId, MobileNo, BeneficiaryCode, 'NA', 'NA']);
const VerifyOTP = async (RequestId, VerifyReferenceId, OTP) => call('E06021', [RequestId, VerifyReferenceId, OTP, 'NA', 'NA']);
const ResendOTP = async (RequestId, VerifyReferenceId, OTP) => call('E06019', [RequestId, VerifyReferenceId, OTP, 'NA', 'NA']);
const MoneyTransfer = async (RequestId, MobileNo, BeneficiaryCode, Amount, TransType) =>
  call('E06015', [RequestId, MobileNo, BeneficiaryCode, Amount, TransType, 'NA', 'NA', 'NA', 'NA', 'NA']);
const TransactionEnquiry = async (RequestId, ClientRequestID) => call('E06017', [RequestId, ClientRequestID, 'NA', 'NA']);
const TransactionHistory = async (RequestId, MobileNo) => call('E06025', [RequestId, MobileNo, 'NA', 'NA']);

async function GetTimestamp(value) {
  const d = value instanceof Date ? value : new Date(value);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${p(d.getMilliseconds(), 3)}0`;
}

module.exports = {
  RegisterSender, SenderAvailableBalance, SenderExistRequest, AddBeneficiary, GetBankDetails, AccountValidation,
  GetBeneficiaryDetails, DeleteBeneficiary, VerifyOTP, ResendOTP, MoneyTransfer, TransactionEnquiry, TransactionHistory, GetTimestamp,
};
