'use strict';
/** Model property lists (C# classes declared in Controllers/AdminPanel/All_Member_List.cs) shared by batch03 controllers. Not a router. */
/** class Payload */
const PAYLOAD_PROPS = ['fromLang', 'toLang', 'text'];
/** class cityname */
const CITYNAME_PROPS = ['CTID', 'CITYNAME'];
/** class MemberDetails */
const MEMBERDETAILS_PROPS = ['regNo', 'LoginId', 'Password', 'FName', 'MName', 'LName', 'mobile', 'Emailid', 'dob', 'gender', 'pincode', 'address', 'ctid', 'cityname', 'Panno', 'spounserId', 'RespounserName', 'Regdate', 'name', 'relation', 'Accountno', 'Bankname', 'branchName', 'IfscCode', 'addres', 'gpv', 'status', 'Kycstatus', 'Active', 'DTHCustomerId', 'Application_FormNo', 'BitCoinWalletAddress', 'AcHolderName', 'PaypalEmail', 'MoneygarmName', 'MoneygarmAddress', 'HighestQualification', 'USERNAME', 'Title', 'GaKeyStatus', 'SID', 'parentid', 'CID', 'Atc_WalletAddress'];
/** class AllMemberList */
const ALLMEMBERLIST_PROPS = ['rowNumber', 'ROWNUMBERS', 'Regno', 'LoginId', 'Membername', 'mobile', 'respounserId', 'RESPOUNSEREMAILID', 'RespounserName', 'Regdate', 'ppv', 'gpv', 'Panno', 'PBV', 'CityName', 'Accountno', 'Bankname', 'BRANCHNAME', 'IfscCode', 'Active', 'Activestatus', 'PV', 'LID', 'RID', 'rootID', 'TLBV', 'TRBV', 'PaidBV', 'ADDRESS', 'addres', 'Kycstatus', 'Status', 'ChallanStatus', 'IsPanVerified', 'ChallanVerifiedOrNot', 'Member_Unique_Id', 'DOC', 'Package', 'Password', 'MemType', 'Username', 'sponsername', 'TPASSWORD', 'JoiningType', 'EMAILID', 'STATENAME', 'PARENTID'];
/** class Purchase_Info */
const PURCHASE_INFO_PROPS = ['REGNO', 'ROWNUMBER', 'PayItForward', 'PuchaseDate', 'AllPackageAmount', 'AllPackageName'];
/** class Basic_Info */
const BASIC_INFO_PROPS = ['Name', 'EMAILID', 'MOBILE', 'USERNAME', 'COUNTRYNAME', 'STATENAME', 'CITYNAME', 'BANKNAME', 'BRANCHNAME', 'ACCOUNTNO', 'IFSCCODE', 'REGDATE', 'E_Wallet', 'Coin_Wallet', 'commission_wallet', 'Shopping_Wallet', 'PANNO', 'KYCSTATUS', 'PASSWORD', 'TPASSWORD', 'Address', 'pincode', 'AcHolderName', 'CID', 'SID', 'CTID', 'Status', 'IsVisibleE', 'IsVisibleS', 'IsVisibleC', 'IsVisibleCO', 'Remarks', 'GaKeyStatus', 'SPONSOR', 'LOGINID', 'IMAGENAME'];
/** class Withdrawal_Info */
const WITHDRAWAL_INFO_PROPS = ['ROWNUMBER', 'TDS', 'ADMINCHARGE', 'WITHDRAWAMOUNT', 'PAYBLEAMOUNT', 'PayModeName', 'REGNO', 'DATE', 'ProcessDate'];
/** class kyc_detail_with_status */
const KYC_DETAIL_WITH_STATUS_PROPS = ['ROWNUMBER', 'Dtm_date', 'Dtm_Aprove', 'IsAprove', 'Type'];
/** class BV_Info */
const BV_INFO_PROPS = ['CLBV', 'CRBV', 'PaidBV', 'FlushBV', 'TRBV', 'TLBV', 'DLBV', 'DRBV'];
/** class wallets */
const WALLETS_PROPS = ['WalletTypeName', 'IsVisible', 'TWTID'];

module.exports = { PAYLOAD_PROPS, CITYNAME_PROPS, MEMBERDETAILS_PROPS, ALLMEMBERLIST_PROPS, PURCHASE_INFO_PROPS, BASIC_INFO_PROPS, WITHDRAWAL_INFO_PROPS, KYC_DETAIL_WITH_STATUS_PROPS, BV_INFO_PROPS, WALLETS_PROPS };
