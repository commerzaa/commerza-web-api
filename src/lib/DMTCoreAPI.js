/** Exports (static, all async, all return the raw response text, or the request JSON if the HTTP call failed): CheckAPIStatus(); GetStatesList(); GetBankList(); AgentRegister(Agent_Id, Agent_Msisdn, Agent_Name, Agent_Cname, Agent_Address, Agent_City, Agent_State_Code, Agent_Pincode); AgentRegisterOTP(CustomerMobileNumber, Trans_Id, Otp); CustomerRegistration(CustomerMobileNumber, CompleteName, CompleteAddress, City, StateCode, Pincode); GetCustomerDetails(CustomerMobileNumber); GetCustomerDetailsOTP(CustomerMobileNumber, Trans_Id, Otp); ManageBeneficiary(CustomerMobileNumber, Type, Beneficiary_Id, Beneficiary_Account_No, Beneficiary_Ifsc_Code, Beneficiary_Bank_Code, Beneficiary_Name); ManageBeneficiaryOTP(CustomerMobileNumber, Trans_Id, Otp); Transfer(CustomerMobileNumber, Client_Trans_Id, Amount, Transfer_Type, Beneficiary_Id, Beneficiary_Account_No, Beneficiary_Ifsc_Code, Beneficiary_Bank_Code, Beneficiary_Name); TransferOTP(CustomerMobileNumber, Trans_Id, Otp); GetBalance(); GetTimestamp(value: Date) */
'use strict';
const config = require('../config');
const { postJson, jsSerialize } = require('./_http');

const HOST = 'https://api.goprocessing.in/';
const goid = () => config.app.DMTGoId;
const apikey = () => config.app.DMTApiKey;

/** POST JSON; swallow failures and return the request JSON (legacy behaviour). */
async function call(path, payload) {
  let StrPostData = jsSerialize(payload);
  try {
    StrPostData = await postJson(HOST + path, StrPostData);
  } catch (e) { /* swallowed in legacy */ }
  return StrPostData;
}

// Property order below equals the declaration order of the legacy payload classes (JavaScriptSerializer order).
const CheckAPIStatus = async () => call('getServiceData.go', { goid: goid(), apikey: apikey(), rtype: 'json' });
const GetStatesList = async () => call('getServiceData.go', { goid: goid(), apikey: apikey(), rtype: 'json', type: 'states' });
const GetBankList = async () => call('getServiceData.go', { goid: goid(), apikey: apikey(), rtype: 'json', type: 'bank' });

const AgentRegister = async (Agent_Id, Agent_Msisdn, Agent_Name, Agent_Cname, Agent_Address, Agent_City, Agent_State_Code, Agent_Pincode) =>
  call('agent/agentRegister.go', {
    goid: goid(), apikey: apikey(), rtype: 'json', apimode: 'live',
    agent_id: Agent_Id, agent_msisdn: Agent_Msisdn, agent_name: Agent_Name, agent_cname: Agent_Cname,
    agent_address: Agent_Address, agent_city: Agent_City, agent_state_code: Agent_State_Code, agent_pincode: Agent_Pincode,
  });

const AgentRegisterOTP = async (CustomerMobileNumber, Trans_Id, Otp) =>
  call('agent/agentRegisterOTP.go', {
    goid: goid(), apikey: apikey(), rtype: 'json', apimode: 'live',
    agent_msisdn: CustomerMobileNumber, trans_id: Trans_Id, otp: Otp,
  });

const dmtBase = () => ({ goid: goid(), apikey: apikey(), rtype: 'json', apimode: 'live', service_family: '25', agent_id: 'HITMYAD' });

const CustomerRegistration = async (CustomerMobileNumber, CompleteName, CompleteAddress, City, StateCode, Pincode) =>
  call('dmt/moneyRegister.go', {
    ...dmtBase(), msisdn: CustomerMobileNumber, user_name: CompleteName, user_address: CompleteAddress,
    user_city: City, user_state_code: StateCode, user_pincode: Pincode,
  });

const GetCustomerDetails = async (CustomerMobileNumber) =>
  call('dmt/moneyGetDetails.go', { ...dmtBase(), msisdn: CustomerMobileNumber });

const GetCustomerDetailsOTP = async (CustomerMobileNumber, Trans_Id, Otp) =>
  call('dmt/moneyGetDetailsOTP.go', { ...dmtBase(), msisdn: CustomerMobileNumber, trans_id: Trans_Id, otp: Otp });

// NOTE: legacy always sent beneficiary_bank_code = "" here (the Beneficiary_Bank_Code argument is ignored)
const ManageBeneficiary = async (CustomerMobileNumber, Type, Beneficiary_Id, Beneficiary_Account_No, Beneficiary_Ifsc_Code, Beneficiary_Bank_Code, Beneficiary_Name) =>
  call('dmt/moneyBeneficiary.go', {
    ...dmtBase(), msisdn: CustomerMobileNumber, type: Type, beneficiary_id: Beneficiary_Id,
    beneficiary_account_no: Beneficiary_Account_No, beneficiary_ifsc_code: Beneficiary_Ifsc_Code,
    beneficiary_bank_code: '', beneficiary_name: Beneficiary_Name,
  });

const ManageBeneficiaryOTP = async (CustomerMobileNumber, Trans_Id, Otp) =>
  call('dmt/moneyBeneficiaryOTP.go', { ...dmtBase(), msisdn: CustomerMobileNumber, trans_id: Trans_Id, otp: Otp });

const Transfer = async (CustomerMobileNumber, Client_Trans_Id, Amount, Transfer_Type, Beneficiary_Id, Beneficiary_Account_No, Beneficiary_Ifsc_Code, Beneficiary_Bank_Code, Beneficiary_Name) =>
  call('dmt/moneyTransfer.go', {
    ...dmtBase(), msisdn: CustomerMobileNumber, client_trans_id: Client_Trans_Id, amount: Amount,
    transfer_type: Transfer_Type, beneficiary_id: Beneficiary_Id, beneficiary_account_no: Beneficiary_Account_No,
    beneficiary_ifsc_code: Beneficiary_Ifsc_Code, beneficiary_bank_code: Beneficiary_Bank_Code, beneficiary_name: Beneficiary_Name,
  });

const TransferOTP = async (CustomerMobileNumber, Trans_Id, Otp) =>
  call('dmt/moneyTransferOTP.go', { ...dmtBase(), msisdn: CustomerMobileNumber, trans_id: Trans_Id, otp: Otp });

const GetBalance = async () => call('getBalance.go', { goid: goid(), apikey: apikey(), rtype: 'json' });

async function GetTimestamp(value) {
  const d = value instanceof Date ? value : new Date(value);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}${p(d.getMilliseconds(), 3)}0`;
}

module.exports = {
  CheckAPIStatus, GetStatesList, GetBankList, AgentRegister, AgentRegisterOTP, CustomerRegistration, GetCustomerDetails,
  GetCustomerDetailsOTP, ManageBeneficiary, ManageBeneficiaryOTP, Transfer, TransferOTP, GetBalance, GetTimestamp,
};
