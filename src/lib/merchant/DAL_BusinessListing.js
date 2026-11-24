/**
 * Exports (static class DAL_BusinessListing): async GetAreaList(string AreaName, int CID): string[]; async GetCity(long CID): City[];
 *   async GetKeyword(Int64 Plid): GetKeywordForBusinessListing[]; async GetPinCodeList(string Pincode, int CID): string[]; async GetSTATE(long CID): STATE[];
 *   async SaveBusinessListing(CompanyName, PhoneNo, Building, LandMark, ComemailId, StateName, CityName, Aid, YearOfEstable, CperWebSite, CatId, KeyId, Pincode,
 *     NoOfEmployee, Mode, ComDesc, Ismannual, PmidParam, companyimage, PLID, HeaderImageName, UserName, LoginID, ScatId, Pick_State, Pick_City, Pick_Area, Pick_Pincode,
 *     Pick_Address, Pick_LandMark, GST, TAN, CIN, Country="", Pick_Country="", ClassificationTypeID="", ClassificationDescription="", StoreTypeID=0,
 *     AllDeliveryPinCode="", Facebook="", Twitter="", Youtube="", Linkdin="", Telegram="", WhatsappGroupLink="", Instagram="", WeChat="", DistributorId=0): string
 * PORT-NOTE: Merchant DataBaseContext = Db_Shopping. Procedures return their OUT parameters (STRRESULT, MAXPMID) as columns of the single result row.
 */
'use strict';
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const { outValue } = require('../_http');

const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const T = (s) => {
  if (s === null || s === undefined) throw NRE();
  return String(s).trim();
};
const firstCol = (rows) => rows.map((r) => r[Object.keys(r)[0]]);

async function GetAreaList(AreaName, CID) {
  const rows = await db.proc('shopping', 'usp_searching_pincodeor_area_2', { keyupvalue: AreaName, cid: CID });
  const Result = firstCol(rows);
  if (Result.length > 0) return Result;
  Result.push('No Result Found..............');
  return Result;
}

async function GetCity(CID) {
  const rows = await db.query('shopping', 'select * from city where cid = @CID and active = true order by cityname', { CID });
  return mapRows(rows, ['CTID', 'CID', 'SID', 'CITYNAME', 'ACTIVE']);
}

async function GetKeyword(Plid) {
  const rows = await db.proc('shopping', 'usp_bindcatandkey', { plid: Plid });
  return mapRows(rows, ['ProductType', 'Prid', 'Catid', 'Scatid', 'Productname', 'Kmid']);
}

async function GetPinCodeList(Pincode, CID) {
  const rows = await db.proc('shopping', 'usp_searching_pincodeor_area', { keyupvalue: Pincode, cid: CID });
  const Result = firstCol(rows);
  if (Result.length > 0) return Result;
  Result.push('No Result Found..............');
  return Result;
}

async function GetSTATE(CID) {
  const rows = await db.query('shopping', 'select * from state where cid = @CID and sactive = true order by statename', { CID });
  return mapRows(rows, ['SID', 'CID', 'STATENAME', 'SCODE', 'SACTIVE']);
}

async function SaveBusinessListing(CompanyName, PhoneNo, Building, LandMark, ComemailId, StateName, CityName,
  Aid, YearOfEstable, CperWebSite, CatId, KeyId, Pincode, NoOfEmployee, Mode, ComDesc, Ismannual,
  PmidParam, companyimage, PLID, HeaderImageName, UserName, LoginID, ScatId, Pick_State, Pick_City,
  Pick_Area, Pick_Pincode, Pick_Address, Pick_LandMark, GST, TAN, CIN, Country = '', Pick_Country = '',
  ClassificationTypeID = '', ClassificationDescription = '', StoreTypeID = 0, AllDeliveryPinCode = '', Facebook = '', Twitter = '',
  Youtube = '', Linkdin = '', Telegram = '', WhatsappGroupLink = '', Instagram = '', WeChat = '', DistributorId = 0) {
  let RetResult = '';
  if (CompanyName === null || CompanyName === undefined || ComDesc === null || ComDesc === undefined) throw NRE();
  CompanyName = String(CompanyName).split('+opos').join("'");
  ComDesc = String(ComDesc).split('+opos').join("'");

  const row = await db.procOne('shopping', 'usp_businesslistingforportalpanel_new', {
    companyname: T(CompanyName),
    phoneno: T(PhoneNo),
    building: T(Building),
    landmark: T(LandMark),
    comemailid: T(ComemailId),
    statename: T(StateName),
    cityname: T(CityName),
    aid: T(Aid),
    yearofestable: T(YearOfEstable),
    cperwebsite: T(CperWebSite),
    noofemployee: T(NoOfEmployee),
    catid: T(CatId),
    pincode: T(Pincode),
    companyimage: T(companyimage),
    plid: T(PLID),
    comdesc: T(ComDesc),
    headerimagename: T(HeaderImageName),
    keyid: KeyId,
    ismannual: Ismannual,
    subcatid: T(ScatId),
    pick_state: Pick_State,
    pick_city: Pick_City,
    pick_area: Pick_Area,
    pick_pincode: Pick_Pincode,
    pick_address: Pick_Address,
    pick_landmark: Pick_LandMark,
    gstno: GST,
    tanno: TAN,
    cinno: CIN,
    country: Country,
    pick_country: Pick_Country,
    classificationtypeid: ClassificationTypeID,
    classificationdescription: ClassificationDescription,
    storetypeid: StoreTypeID,
    alldeliverypincode: AllDeliveryPinCode,
    facebook: Facebook,
    twitter: Twitter,
    youtube: Youtube,
    linkdin: Linkdin,
    telegram: Telegram,
    whatsappgrouplink: WhatsappGroupLink,
    instagram: Instagram,
    wechat: WeChat,
    distributorid: DistributorId,
  });
  RetResult = outValue(row, 'STRRESULT');

  // legacy: new Thread(...).Start() => fire and forget
  const SendRegisrtaionConfirmationMail = require('./SendRegisrtaionConfirmationMail');
  if (RetResult === 'Ok') {
    Promise.resolve().then(() => SendRegisrtaionConfirmationMail.AddNewListingMail(LoginID, UserName)).catch((e) => console.error('[AddNewListingMail]', e && e.message));
  } else if (RetResult === 'Updated') {
    Promise.resolve().then(() => SendRegisrtaionConfirmationMail.UpdateListingMail(LoginID, UserName)).catch((e) => console.error('[UpdateListingMail]', e && e.message));
  }
  // legacy second connection: result only used for an unused local (StrOutPut1)
  await db.procOne('shopping', 'usp_merchantcat_subcat_keywordmaster', {
    mode: '1', plid: T(PLID), tmcskmid: '0', category: T(CatId), subcategory: T(ScatId), keyword: '',
  });
  return RetResult;
}

module.exports = { GetAreaList, GetCity, GetKeyword, GetPinCodeList, GetSTATE, SaveBusinessListing };
