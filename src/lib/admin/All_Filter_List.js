/** Exports (C# BAL/All_Filter_List.cs, MLM Admin, database 'affiliate'): class All_Filter_List (static methods) + class SearchList
 *   static GetSearchBy() GetSearchbyFromToUserName() GetSearchBy1() GetAllStatusSearching() getActivationStatus() getddlSearchValueList()
 *   getProccessPaid() GetListWallet() getCrDrType() getMemberStatus() getMemberSide() getDateOrder() getOrder() getDateType() KYCStatus() KYCStas()
 *   GetStatus() Status() getStatusSendAndNotSend() GetLevelOrder() GetOrderbyAmountList() GetusedanduusedStatus() GetIsholdItem() GetPaydate()
 *   Getdatetype() GetPagenation() Getmonth() GetListItembonza() GetSearchingPurchaseWise()      : SearchList[] {Text, Value}  [sync]
 *   static async getPayMode() : Payment_Mode_New[] ; static async getPackage() : package[] {SUBSCRIPTIONHEADING, TSMID}
 * SearchList is also available as require('../../lib/admin/SearchList').
 * No Member/API equivalent exists => ported. Texts/values copied verbatim (incl. the leading TAB in "\tPROCESSED" and the typo "Auguest").
 */
'use strict';
const { query } = require('../../db');
const { mapRows } = require('../../utils/shape');

const DB = 'affiliate';

class SearchList {
  constructor(Text, Value) {
    this.Text = Text === undefined ? null : Text;
    this.Value = Value === undefined ? null : Value;
  }
}
const sl = (Text, Value) => new SearchList(Text, Value);

/** Models/Payment_Mode.cs class Payment_Mode_New (Process_fees is [NotMapped] => null). */
const PAYMENT_MODE_NEW_PROPS = ['pmoid', 'payMode', 'status', 'process_fee', 'pm_code', 'Image', 'UserID', 'UsedIn', 'MerchantID', 'merchant_token',
  'api_Key', 'Salt', 'Currency', 'Password', 'IsTesting', 'second_password', 'Secret_pin', 'Withdrawal_Status', 'ISTOPUPSTATUS_ENABLE',
  'ISWithdrawal_ENABLE', 'Active', 'ISADMINSHOW', 'TYPE', 'VariablePercenatgeForAutoApprove', 'Process_fees'];
/** Controllers/AdminPanel/SubscriptionRequests.cs class package */
const PACKAGE_PROPS = ['SUBSCRIPTIONHEADING', 'TSMID'];

class All_Filter_List {
  static GetSearchBy() {
    return [
      sl("-Search By-", ""),
      sl("Userid", "Loginid"),
      sl("Username", "USERNAME"),
      sl("Name", "Membername"),
      sl("Mobile", "Mobileno"),
      sl("EmailId", "Emailid"),
      sl("City", "Cityname"),
      sl("State", "Statename"),
    ];
  }

  static GetSearchbyFromToUserName() {
    return [
      sl("-Search By-", ""),
      sl("From Username", "FROMUSERNAME"),
      sl("To Username", "TOUSERNAME"),
      sl("Name", "Membername"),
      sl("Mobile", "Mobileno"),
      sl("EmailId", "Emailid"),
      sl("City", "Cityname"),
      sl("State", "Statename"),
    ];
  }

  static GetSearchBy1() {
    return [
      sl("-Search By-", ""),
      sl("Username", "USERNAME"),
      sl("Name", "Membername"),
      sl("Mobile", "Mobileno"),
      sl("EmailId", "Emailid"),
      sl("City", "Cityname"),
      sl("State", "Statename"),
      sl("Account No.", "Accountnumber"),
    ];
  }

  static GetAllStatusSearching() {
    return [
      sl("Search All Status", ""),
      sl("Pending", "0"),
      sl("Inprocess", "1"),
      sl("Approved", "2"),
      sl("Rejected", "3"),
    ];
  }

  static getActivationStatus() {
    return [
      sl("-Activation Status-", ""),
      sl("Free", "0"),
      sl("Paid", "1"),
    ];
  }

  static getddlSearchValueList() {
    return [
      sl("- Select -", ""),
      sl("Username", "Username"),
      sl("Paymode", "Paymode"),
    ];
  }

  static getProccessPaid() {
    return [
      sl("- Selects  Status-", ""),
      sl("\tPROCESSED", "Processed"),
      sl("PAID", "PAID"),
    ];
  }

  static GetListWallet() {
    return [
      sl("- Select Wallet Type--", ""),
      sl("Commission Wallet", "Working Wallet"),
      sl("Growth Wallet", "Cashback Wallet"),
      sl("E-Wallet", "I-Wallet"),
      sl("Shopping Wallet", "ShoppingWallet"),
    ];
  }

  static getCrDrType() {
    return [
      sl("-- Select--", ""),
      sl("Dr", "Dr"),
      sl("Cr", "Cr"),
    ];
  }

  static getMemberStatus() {
    return [
      sl("-ID Status-", ""),
      sl("Blocked", "0"),
      sl("Un-Block", "1"),
    ];
  }

  static getMemberSide() {
    return [
      sl("-Select Side-", ""),
      sl("Left", "1"),
      sl("Right", "2"),
    ];
  }

  static getDateOrder() {
    return [
      sl("-Order By Date-", ""),
      sl("Order By desc", "desc"),
      sl("Order By asc", "asc"),
    ];
  }

  static getOrder() {
    return [
      sl("-Order By-", ""),
      sl("Order By desc", "desc"),
      sl("Order By asc", "asc"),
    ];
  }

  static getDateType() {
    return [
      sl("-Date Type-", ""),
      sl("Joining Date", "Joining Date"),
      sl("Activation Date", "Activation Date"),
    ];
  }

  static KYCStatus() {
    return [
      sl("-KYC Status-", ""),
      sl("Approved", "Approved"),
      sl("Rejected", "Rejected"),
      sl("Process", "Process"),
    ];
  }

  static KYCStas() {
    return [
      sl("-KYC Status-", ""),
      sl("Approved", "2"),
      sl("Rejected", "3"),
      sl("Process", "1"),
    ];
  }

  static GetStatus() {
    return [
      sl("- Select All Status -", "-1"),
      sl("Pending", "0"),
      sl("Approved", "1"),
      sl("Rejected", "2"),
    ];
  }

  static Status() {
    return [
      sl("- Status -", ""),
      sl("Active", "1"),
      sl("Deactive ", "0"),
    ];
  }

  static getStatusSendAndNotSend() {
    return [
      sl("- Status -", "-1"),
      sl("Send", "1"),
      sl("Send Failed ", "2"),
    ];
  }

  static GetLevelOrder() {
    return [
      sl("-Order By Level-", ""),
      sl("Order By desc", "0"),
      sl("Order By asc", "1"),
    ];
  }

  static GetOrderbyAmountList() {
    return [
      sl("- Order by -", ""),
      sl("Amount Asc.", "AVASC"),
      sl("Amount Desc.", "AVDESC"),
    ];
  }

  static GetusedanduusedStatus() {
    return [
      sl("-- Select Status--", ""),
      sl("Used", "0"),
      sl("Un-used", "1"),
    ];
  }

  static GetIsholdItem() {
    return [
      sl("--Search By--", "0"),
      sl("Ishold", "1"),
      sl("not hold", "0"),
    ];
  }

  static GetPaydate() {
    return [
      sl("- Search Option -", ""),
      sl("Paydate", "1"),
      sl("Last Release Date", "2"),
    ];
  }

  static Getdatetype() {
    return [
      sl("-- Select Status--", ""),
      sl("Registration Date", "Registration Date"),
      sl("Activation Date", "Activation Date"),
    ];
  }

  static GetPagenation() {
    return [
      sl("-Select Paging-", "100"),
      sl("10", "10"),
      sl("20", "20"),
      sl("30", "30"),
      sl("50", "50"),
      sl("100", "100"),
      sl("200", "200"),
      sl("500", "500"),
    ];
  }

  static Getmonth() {
    return [
      sl("-- Select Month--", "0"),
      sl("January", "1"),
      sl("February", "2"),
      sl("March", "3"),
      sl("April", "4"),
      sl("May", "5"),
      sl("June", "6"),
      sl("July", "7"),
      sl("Auguest", "8"),
      sl("September", "9"),
      sl("October", "10"),
      sl("November", "11"),
      sl("December", "12"),
    ];
  }

  static GetListItembonza() {
    return [
      sl("-- Bonanza Name--", "0"),
      sl("1st Time", "1"),
      sl("2nd Time", "2"),
      sl("3rd Time", "3"),
    ];
  }

  static GetSearchingPurchaseWise() {
    return [
      sl("--Select--", ""),
      sl("Payit Forword", "PayItForward"),
      sl("Self TopUp", "SelfTopup"),
    ];
  }

  /** Legacy: select STATUS,PAYMODE,* from tbl_paymode where status=1 */
  static async getPayMode() {
    const rows = await query(DB, 'select status, paymode, * from tbl_paymode where status::int = 1', {});
    return mapRows(rows, PAYMENT_MODE_NEW_PROPS);
  }

  /** Legacy: select TSMID,SUBSCRIPTIONHEADING from TBL_SUBSCRIPTIONMASTER where ISACTIVE=1 */
  static async getPackage() {
    const rows = await query(DB, 'select tsmid, subscriptionheading from tbl_subscriptionmaster where isactive::int = 1', {});
    return mapRows(rows, PACKAGE_PROPS);
  }
}

All_Filter_List.SearchList = SearchList;

module.exports = All_Filter_List;
module.exports.SearchList = SearchList;
