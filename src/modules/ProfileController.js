'use strict';
// Port of Controllers/WebPanelCntrl/ProfileController.cs
const express = require('express');
const config = require('../config');
const { queryOne, scalar, exec, proc, procOne } = require('../db');
const { mapRow, mapRows } = require('../utils/shape');
const { auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const UtilityClass = require('../lib/UtilityClass');

const router = express.Router();

const str = (v) => (v === null || v === undefined ? '' : String(v));
const col = (row, name) => {
  if (!row) return undefined;
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase());
  return k === undefined ? undefined : row[k];
};
const nz = (v) => (v === undefined ? null : v);
const toInt = (v) => {
  const n = parseInt(v, 10);
  if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
};
/** Convert.ToDouble(string) */
const toDouble = (v) => {
  if (v === null || v === undefined) return 0;
  const n = Number(String(v).trim());
  if (Number.isNaN(n) || String(v).trim() === '') throw new Error('Input string was not in a correct format.');
  return n;
};

const PRODUCT_DETAIL_PROPS = ['Breadth_cms', 'CashOnDelivery', 'catid', 'DiscountPercentage', 'FullDesc', 'Height_cms',
  'IsOutOfStock', 'KeyFeatures', 'Length_cms', 'maincatid', 'MPRID', 'PaybleAmount', 'ProcurementSLA', 'ProdImages',
  'ProdTitle', 'ReplacementDay', 'rowNumber', 'SellerRating', 'sellMRP', 'ShippingCharges', 'shortDesc', 'SoldBy',
  'SPRID', 'StockIn', 'StockNet', 'StockOut', 'subcatid', 'Weight_kg', 'BV', 'PV', 'CASHBACK', 'Color', 'Size', 'Plid',
  'Sellercity', 'Specification', 'EXCHANGE', 'RETURN', 'INCLUDINGTAX', 'PrSKUCode', 'isPreview', 'ACTIVATIONPV_PER'];
const ALL_REVIEWS_PROPS = ['TOTALREVIEWS', 'TOTALRATINGS', 'AVERAGESTARS', 'FIVERATINGS', 'FOURRATINGS', 'THREERATINGS',
  'TWORATINGS', 'ONERATINGS', 'REMAININGSTARS'];
const REVIEWS_LIST_PROPS = ['PMID', 'NAME', 'REVIEWTITLE', 'REVIEWDESC', 'STARS', 'Reviewdate'];

/** ProfileController.All_Reviews (static) */
async function All_Reviews(Productid) {
  try {
    const rows = await proc('shopping', 'usp_total_avg_reviews', { productid: Productid });
    return mapRows(rows, ALL_REVIEWS_PROPS);
  } catch (ex) {
    return null;
  }
}

/** ProfileController.All_ReviewsList (static) */
async function All_ReviewsList(Productid) {
  try {
    const rows = await proc('shopping', 'usp_reviewslist', { productid: Productid });
    return mapRows(rows, REVIEWS_LIST_PROPS);
  } catch (ex) {
    return null;
  }
}

// auth
router.post('/api/UpdateimageDetails', auth, asyncHandler(async (req, res) => {
  // legacy read these from Request.Form (NullReference => 500 when missing)
  if (req.p.Plid === undefined || req.p.Plid === null) throw new Error('Object reference not set to an instance of an object.');
  if (req.p.Receiptfile === undefined || req.p.Receiptfile === null) throw new Error('Object reference not set to an instance of an object.');
  const Plid = String(req.p.Plid);
  const ImageName = String(req.p.Receiptfile);
  const responseData = [];
  let ResValue = '';
  try {
    let imgname = '';
    toDouble(Plid);
    const SavePaths = config.app.MemberImagePath;

    if (ImageName.includes('base64,')) {
      const mode = UtilityClass.ImageMode ? UtilityClass.ImageMode.Thumbnail : 'Thumbnail';
      const r = await UtilityClass.ImageUploadMasterMethod(ImageName, SavePaths, SavePaths, mode, 'Member_profile');
      imgname = str(r);
    } else {
      imgname = ImageName;
    }
    const out = await procOne('affiliate', 'usp_editimageprofile', { plid: Plid, imagename: imgname });
    ResValue = str(col(out, 'intresult'));
  } catch (ExpObj) {
    responseData.push({ status: 'false', message: 'Error', data: 'Some Error Occuered Sorry ' + ExpObj.message });
    return res.json(responseData);
  }
  responseData.push({ status: 'true', message: 'success', data: ResValue });
  return res.json(responseData);
}));

// auth
router.post('/api/UpdateUserDetails', auth, asyncHandler(async (req, res) => {
  const responseData = [];
  let ResValue = '';
  try {
    const p = req.p;
    const plid = p.plid;
    const Title = toInt(p.Title);
    const Fname = nz(p.Fname);
    const username = nz(p.username);
    const HighestQualification = nz(p.HighestQualification);
    const Country = toInt(p.Country);
    const State = toInt(p.State);
    const Pincode = nz(p.Pincode);
    const IsVerified = 0;

    const Plid = toDouble(plid);
    const d = (v, def) => (v === undefined || v === null ? def : v);
    const Qualification = d(p.Qualification, '0');
    const occupation = d(p.occupation, '0');
    const Lname = d(p.Lname, '');
    const DOB = d(p.DOB, '');
    const FatherOrMotherName = d(p.FatherOrMotherName, '');
    const Gender = d(p.Gender, '');
    const IdType = d(p.IdType, '');
    const IdRefNo = d(p.IdRefNo, '');
    const PANNO = d(p.PANNO, '');
    let Cityname = d(p.Cityname, '');
    const MarriageAnniversary = d(p.MarriageAnniversary, '');
    const NomineeName = d(p.NomineeName, '');
    const NomineeRelation = d(p.NomineeRelation, '');
    const NomineeDOB = d(p.NomineeDOB, '');
    const Address = d(p.Address, '');
    const MaritalStatus = d(p.MaritalStatus, '');
    const townpost = d(p.townpost, '');
    let CTName = d(p.CTName, '');

    if (username !== '') {
      const chk = await procOne('affiliate', 'usp_check_existsusernameforprofileupdate', { regno: Plid, username });
      let Retrnval = str(col(chk, 'retrunout'));
      if (Retrnval === '1') {
        Retrnval = '15';
        return res.json(Retrnval);
      }
    } else {
      return res.json('16');
    }

    if (Cityname === '' || Cityname === '-1') {
      Cityname = '0';
    } else {
      const ctid = toInt(Cityname);
      const cities = await queryOne('affiliate', 'select * from city where ctid = @ctid limit 1', { ctid });
      if (CTName === '') {
        if (!cities) throw new Error('Object reference not set to an instance of an object.');
        CTName = cities.cityname;
      }
    }
    const out = await procOne('affiliate', 'usp_editcontactdetails', {
      plid: Plid,
      cpertitle: Title,
      cpermobileno: '',
      cperemailid: '',
      firstname: Fname,
      lastname: Lname,
      username,
      dob: DOB,
      fatherormothername: FatherOrMotherName,
      gender: Gender,
      highestqualification: HighestQualification,
      mode: '2',
      isverified: IsVerified,
      idtype: IdType,
      idrefno: IdRefNo,
      panno: PANNO,
      cid: Country,
      ctid: Cityname,
      sid: State,
      cityname: CTName,
      marriageanniversary: MarriageAnniversary,
      remark: '',
      eid: 0,
      pincode: Pincode,
      nominnename: NomineeName,
      nomineerelation: NomineeRelation,
      nomineedob: NomineeDOB,
      address: Address,
      maritalstatus: MaritalStatus,
      townpost,
      qualificationid: Qualification,
      occupation,
    });
    ResValue = str(col(out, 'intresult'));
  } catch (ExpObj) {
    responseData.push({ status: 'false', message: 'Error', data: 'Some Error Occuered Sorry ' + ExpObj.message });
    return res.json(responseData);
  }
  responseData.push({ status: 'true', message: 'success', data: ResValue });
  return res.json(responseData);
}));

// auth
router.post('/api/PincodeCheck', auth, asyncHandler(async (req, res) => {
  const PRID = req.p.PRID;
  const RegNo = req.p.RegNo;
  const ReturnValue = new Array(4).fill(null);
  ReturnValue[0] = 'not found';
  const responseData = [];

  const Datacount = await scalar('shopping',
    "select count(1) from IMS_CustomerAddress where ToUserId = @RegNo and ToUserType = 'Customer'", { RegNo });
  if (Number(Datacount) === 1) {
    await exec('shopping',
      "update IMS_CustomerAddress set IsDefault = true where ToUserId = @RegNo and ToUserType = 'Customer'", { RegNo });
  }
  const adrs = await queryOne('shopping',
    "select * from IMS_CustomerAddress where ToUserId = @RegNo and ToUserType = 'Customer' and IsDefault = true limit 1", { RegNo });
  const sprid = toInt(await UtilityClass.Decryptword(PRID));
  // legacy loaded the sub product (pms) here; it is never used afterwards
  await queryOne('shopping', 'select * from IMS_SubProduct where SPRID = @sprid limit 1', { sprid });

  let pg = null;
  if (adrs) {
    pg = await queryOne('shopping', 'select * from TBL_COURIERPINCODES where PINCODE = @pin limit 1', { pin: adrs.pincode });
  }
  if (pg && adrs) {
    ReturnValue[0] = 'found';
    ReturnValue[1] = adrs.pincode;
  } else {
    ReturnValue[1] = '';
  }
  responseData.push({ status: 'true', message: 'success', data: ReturnValue });
  return res.json(responseData);
}));

// public
router.post('/api/PinCodeCheckInDetail', asyncHandler(async (req, res) => {
  const { PRID, PinCode } = req.p;
  const responseData = [];
  const out = await procOne('shopping', 'usp_check_pincode', { prid: nz(PRID), pincode: nz(PinCode) });
  const ReturnValue = str(col(out, 'stroutput'));
  const Cod = str(col(out, 'cod'));
  responseData.push({ status: 'true', message: 'success', data: ReturnValue, Cod });
  return res.json(responseData);
}));

// public
router.post('/api/ProductFeature', asyncHandler(async (req, res) => {
  const PMID = req.p.PMID;
  const responseData = [];
  let objAll_Review = [];
  let All_Review = [];
  let product_detail_cutom = null;
  const listItems = [];

  const DID = 1;
  const row = await procOne('shopping', 'usp_product_detailing', { prcode: nz(PMID), did: DID });
  product_detail_cutom = mapRow(row, PRODUCT_DETAIL_PROPS);
  if (!product_detail_cutom) throw new Error('Object reference not set to an instance of an object.');
  objAll_Review = await All_Reviews(product_detail_cutom.SPRID);
  All_Review = await All_ReviewsList(product_detail_cutom.SPRID);

  const fullDescriptionHtml = product_detail_cutom.FullDesc;
  if (fullDescriptionHtml === null || fullDescriptionHtml === undefined) {
    throw new Error('Value cannot be null.\r\nParameter name: input');
  }
  const re = /<li>(.*?)<\/li>/g;
  let m;
  while ((m = re.exec(fullDescriptionHtml)) !== null) {
    listItems.push(m[1].replace(/<.*?>/g, ''));
  }

  responseData.push({
    status: 'true',
    message: 'success',
    Discription: listItems,
    data: product_detail_cutom,
    AllReview: objAll_Review,
    AllReviewList: All_Review,
  });
  return res.json(responseData);
}));

// public
router.post('/api/PrFeature', asyncHandler(async (req, res) => {
  const PMID = req.p.PMID;
  const responseData = [];
  const DID = 1;
  const row = await procOne('shopping', 'usp_product_detailing', { prcode: nz(PMID), did: DID });
  const product_detail_cutom = mapRow(row, ['SoldBy', 'Sellercity']);
  responseData.push({ status: 'true', message: 'success', data: product_detail_cutom });
  return res.json(responseData);
}));

// auth
router.post('/api/UpdateMobile', auth, asyncHandler(async (req, res) => {
  let intresult = '';
  const EmailId = '';
  const Mode = 1;
  const responseData = [];
  try {
    const Plid = req.p.Plid;
    const MobileNumber = nz(req.p.MobileNumber);
    if (Number.isNaN(Number(Plid)) || Plid === undefined) throw new Error('Input string was not in a correct format.');
    // legacy read OldMobile / verification flags (unused; the checks are commented out)
    await scalar('affiliate', 'select mobile from member_master where regno = @Plid limit 1', { Plid });
    await scalar('affiliate', "select count(1) from TBL_DETAILSPAGEMASTERFORPROFILEUPDATION where FIELDNAME='Mobile Verification' and SHOWACTIVE=1");
    await scalar('affiliate', "select count(1) from TBL_DETAILSPAGEMASTERFORPROFILEUPDATION where FIELDNAME='Email Verification' and SHOWACTIVE=1");

    const out = await procOne('affiliate', 'usp_changemobileandemailid', { plid: Plid, mobilenumber: MobileNumber, emailid: EmailId, mode: Mode });
    intresult = str(col(out, 'intresult'));
    if (intresult === '0') intresult = 'Mobile No. AllReady Exist !';
    else if (intresult === '1') intresult = 'Mobile No. Added!';
  } catch (ex) {
    console.error('UpdateMobile', ex.message);
  }
  responseData.push({ status: 'true', message: 'success', data: intresult });
  return res.json(responseData);
}));

// auth
router.post('/api/UpdateEmail', auth, asyncHandler(async (req, res) => {
  let intresult = '';
  const MobileNumber = '';
  const Mode = 2;
  const responseData = [];
  try {
    const Plid = req.p.Plid;
    const EmailId = nz(req.p.EmailId);
    if (Number.isNaN(Number(Plid)) || Plid === undefined) throw new Error('Input string was not in a correct format.');
    await scalar('affiliate', 'select mobile from member_master where regno = @Plid limit 1', { Plid });
    await scalar('affiliate', "select count(1) from TBL_DETAILSPAGEMASTERFORPROFILEUPDATION where FIELDNAME='Mobile Verification' and SHOWACTIVE=1");
    await scalar('affiliate', "select count(1) from TBL_DETAILSPAGEMASTERFORPROFILEUPDATION where FIELDNAME='Email Verification' and SHOWACTIVE=1");

    const out = await procOne('affiliate', 'usp_changemobileandemailid', { plid: Plid, mobilenumber: MobileNumber, emailid: EmailId, mode: Mode });
    intresult = str(col(out, 'intresult'));
    if (intresult === '0') intresult = 'Email ID . AllReady Exist !';
    else if (intresult === '1') intresult = 'Email ID Added!';
  } catch (ex) {
    console.error('UpdateEmail', ex.message);
  }
  responseData.push({ status: 'true', message: 'success', data: intresult });
  return res.json(responseData);
}));

module.exports = router;
