/** Exports (static, all async, return raw response text or "" on failure): GetCustomerDetails(CustomerMobile); CustomerRegistration(CustomerName, CustomerPincode, CustomerMobile); CustomerVerification(CustomerMobile, OTP); AddBeneficiary(CustomerMobile, BeneficiaryName, BeneficiaryMobileNumber, BeneficiaryAccountNumber, IFSCCode); VerifyBeneficiary(CustomerMobile, OTP, BeneficiaryId); BeneficiaryValidation(CustomerMobile, BeneficiaryAccountNumber, IFSCCode, URID); TransferMoney(CustomerMobile, Amount, BeneficiaryId, URID); DeleteBeneficiary(CustomerMobile, BeneficiaryId); DeleteBeneficiaryOtp(CustomerMobile, BeneficiaryId, OTP); GetTimestamp(value: Date) */
'use strict';
const config = require('../config');
const { getText } = require('./_http');

const base = (page) => 'http://api.rechapi.com/moneyTransfer/' + page + '?format=json&token=' + config.app.NewDMTToken;

/** GET; failures return "" (legacy swallowed them). Values are concatenated raw, exactly like the legacy URL building. */
async function get(url) {
  let StrResponse = '';
  try {
    StrResponse = await getText(url, { 'Content-Type': 'application/json' });
  } catch (e) { /* swallowed in legacy */ }
  return StrResponse;
}

const GetCustomerDetails = async (CustomerMobile) =>
  get(base('cusDetails.php') + '&customerMobile=' + CustomerMobile + '&demo=0&version=1.1');

const CustomerRegistration = async (CustomerName, CustomerPincode, CustomerMobile) =>
  get(base('customerRegistration.php') + '&customerName=' + CustomerName + '&customerPincode=' + CustomerPincode + '&customerMobile=' + CustomerMobile + '&demo=0&version=1.1');

const CustomerVerification = async (CustomerMobile, OTP) =>
  get(base('customerVerify.php') + '&customerMobile=' + CustomerMobile + '&otp=' + OTP + '&demo=0&version=1.1');

const AddBeneficiary = async (CustomerMobile, BeneficiaryName, BeneficiaryMobileNumber, BeneficiaryAccountNumber, IFSCCode) =>
  get(base('addBeneficiary.php') + '&customerMobile=' + CustomerMobile + '&beneficiaryName=' + BeneficiaryName + '&beneficiaryMobileNumber=' + BeneficiaryMobileNumber + '&beneficiaryAccountNumber=' + BeneficiaryAccountNumber + '&ifscCode=' + IFSCCode + '&demo=0&version=1.1');

// (the legacy endpoint name is spelled "beneficiaryVerifiy.php")
const VerifyBeneficiary = async (CustomerMobile, OTP, BeneficiaryId) =>
  get(base('beneficiaryVerifiy.php') + '&customerMobile=' + CustomerMobile + '&otp=' + OTP + '&beneficiaryId=' + BeneficiaryId + '&demo=0&version=1.1');

const BeneficiaryValidation = async (CustomerMobile, BeneficiaryAccountNumber, IFSCCode, URID) =>
  get(base('beneficiaryValidate.php') + '&customerMobile=' + CustomerMobile + '&beneficiaryAccountNumber=' + BeneficiaryAccountNumber + '&ifscCode=' + IFSCCode + '&urid=' + URID + '&demo=0&version=1.1');

const TransferMoney = async (CustomerMobile, Amount, BeneficiaryId, URID) =>
  get(base('sendMoney.php') + '&customerMobile=' + CustomerMobile + '&amount=' + Amount + '&beneficiaryId=' + BeneficiaryId + '&urid=' + URID + '&demo=0&version=1.1');

const DeleteBeneficiary = async (CustomerMobile, BeneficiaryId) =>
  get(base('deleteBeneficiary.php') + '&customerMobile=' + CustomerMobile + '&beneficiaryId=' + BeneficiaryId + '&demo=0&version=1.1');

// PORT-NOTE: the legacy URL for this call contains a run of spaces after "?" and a doubled "&&" before customerMobile; reproduced as-is (spaces are percent-encoded by safeUrl, like .NET Uri did)
const DeleteBeneficiaryOtp = async (CustomerMobile, BeneficiaryId, OTP) =>
  get('http://api.rechapi.com/moneyTransfer/deleteBeneficiaryVerifiy.php?                             format=json&token=' + config.app.NewDMTToken + '&&customerMobile=' + CustomerMobile + '&beneficiaryId=' + BeneficiaryId + '&otp=' + OTP + '&demo=0&version=1.1');

async function GetTimestamp(value) {
  const d = value instanceof Date ? value : new Date(value);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${p(d.getMilliseconds(), 3)}0`;
}

module.exports = {
  GetCustomerDetails, CustomerRegistration, CustomerVerification, AddBeneficiary, VerifyBeneficiary,
  BeneficiaryValidation, TransferMoney, DeleteBeneficiary, DeleteBeneficiaryOtp, GetTimestamp,
};
