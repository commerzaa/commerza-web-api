'use strict';
/**
 * Shopping-site customer sign-up / sign-in by mobile OTP.
 *
 * Customers are stored in db_shopping.dbo.tbl_customerlogin (the legacy customer table) and OTPs in
 * dbo.tbl_customers_otp. The legacy stored procedures for this flow (usp_visitor_signup_customer_temp,
 * usp_portallogin_m_customer) do not run on the migrated PostgreSQL database, so the same tables are
 * written here directly.
 *
 *   POST /api/CustomerSendOTP  { MobileNo, Mode: 'signup' | 'login' }
 *   POST /api/CustomerSignUp   { FullName, MobileNo, EmailId?, Otp }
 *   POST /api/CustomerSignIn   { MobileNo, Otp }
 *
 * Signed-in customer (Authorization: Bearer <token from sign-up / sign-in>). The customer is always taken
 * from the token, never from the request body. Addresses are stored in dbo.ims_customeraddress with
 * tousertype 'Customer' and touserid = clid, the same convention checkout (ChecoutController) reads.
 *   POST /api/CustomerProfile             {}
 *   POST /api/CustomerUpdateProfile       { FullName, EmailId? }
 *   POST /api/CustomerAddressList         {}
 *   POST /api/CustomerAddressMeta         {}   (public: delivery country + states from dbo.country / dbo.state)
 *   POST /api/CustomerSaveAddress         { AddressId?, Label, Name, MobileNo, House, Area, Landmark?, City, StateId (or State name), Pincode, IsDefault }
 *                                         (StreetAddress may replace House + Area; on invalid input `errors` maps field -> message)
 *   POST /api/CustomerDeleteAddress       { AddressId }
 *   POST /api/CustomerSetDefaultAddress   { AddressId }
 *
 * No SMS gateway is configured yet, so outside production CustomerSendOTP returns the OTP in the
 * response (`Otp`) so it can be shown on screen. Remove that once SMS sending is in place.
 */
const crypto = require('crypto');
const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const config = require('../config');
const { signToken, auth, requireType } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const GetIP = require('../lib/GetIP');

const router = express.Router();
// same call shape as the db.tx() helpers, bound to db_shopping
const shop = {
  query: (sql, p) => db.query('shopping', sql, p),
  queryOne: (sql, p) => db.queryOne('shopping', sql, p),
  scalar: (sql, p) => db.scalar('shopping', sql, p),
};

const OTP_VALID_MINUTES = 10;
const OTP_RESEND_SECONDS = 30;
const PROCESS = { signup: 'CUSTOMER_SIGNUP', login: 'CUSTOMER_LOGIN' };
const DID = parseInt(config.app.DID, 10) || 1;
const DEFAULT_CID = 96; // India: legacy default country id for customer registration
const SHOW_OTP_IN_RESPONSE = config.env !== 'production';

const str = (v) => (v === undefined || v === null ? '' : String(v).trim());
const fail = (res, message, code = 200) => res.status(code).json({ status: 'false', message });
const isMobile = (v) => /^\d{10}$/.test(v);
/* Profile rules. The website form (src/utils/profileValidation.ts) applies the same rules. */
const EMAIL_PROVIDERS = {
  gmail: ['gmail.com'],
  googlemail: ['googlemail.com'],
  yahoo: ['yahoo.com', 'yahoo.co.in', 'yahoo.in'],
  outlook: ['outlook.com', 'outlook.in'],
  hotmail: ['hotmail.com'],
  live: ['live.com', 'live.in'],
  rediffmail: ['rediffmail.com'],
  icloud: ['icloud.com'],
};

function validateFullName(v) {
  if (!v) return 'Please enter your name.';
  if (v.length < 2 || v.length > 100) return 'Name must be 2 to 100 characters.';
  if (!/^[A-Za-z][A-Za-z .'-]*$/.test(v)) return 'Name can only contain letters, spaces, dots, apostrophes and hyphens.';
  return undefined;
}

/** `email` is already trimmed and lower-cased. Empty is allowed (email is optional). */
function validateEmail(email) {
  if (!email) return undefined;
  if (email.length > 50) return 'Email address must be 50 characters or fewer.';
  const m = /^([a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*)@((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+([a-z]{2,24}))$/.exec(email);
  if (!m) return 'Please enter a valid email address, like name@example.com.';
  const domain = m[2];
  const known = EMAIL_PROVIDERS[domain.split('.')[0]];
  if (known && !known.includes(domain)) return `Please check the email domain. Did you mean ${m[1]}@${known[0]}?`;
  return undefined;
}

const limiter = (max) => rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: max,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  validate: { trustProxy: false }, // app sets trust proxy for legacy GetIP
  handler: (req, res) => fail(res, 'Too many attempts. Please wait a few minutes and try again.', 429),
});
const sendLimiter = limiter(10);
const verifyLimiter = limiter(20);

/** Random numeric code of `length` digits that does not start with 0 and is unused in `column`. */
async function uniqueNumber(t, column, length) {
  for (let i = 0; i < 20; i++) {
    const n = String(crypto.randomInt(10 ** (length - 1), 10 ** length));
    const taken = await t.scalar(`select 1 from dbo.tbl_customerlogin where ${column} = @n limit 1`, { n });
    if (!taken) return n;
  }
  throw new Error(`Could not generate a unique ${column}`);
}

async function findCustomerByMobile(q, mobile) {
  return q.queryOne(
    'select clid, loginid, username, fname, lname, phone, emailid, referalcode, doc, active from dbo.tbl_customerlogin where phone = @mobile and did = @did order by clid limit 1',
    { mobile, did: DID });
}

/** Marks the matching active, unexpired OTP as used. Returns true when it matched. */
async function consumeOtp(t, mobile, mode, otp) {
  const row = await t.queryOne(
    `update dbo.tbl_customers_otp set active = 0
      where tcoid = (select tcoid from dbo.tbl_customers_otp
                      where mobileno = @mobile and process = @process and active = 1
                        and createddate > localtimestamp - make_interval(mins => @mins)
                      order by tcoid desc limit 1)
        and otp = @otp
      returning tcoid`,
    { mobile, process: PROCESS[mode], mins: OTP_VALID_MINUTES, otp });
  return !!row;
}

async function recordLogin(t, clid, ip) {
  await t.exec('update dbo.tbl_customerlogin set lastlogin = current_date where clid = @clid', { clid });
  await t.exec('update dbo.tbl_customerloginhistory set status = 0 where plid = @clid', { clid });
  await t.exec(
    'insert into dbo.tbl_customerloginhistory (plid, date, ipaddress, status, regno) values (@clid, localtimestamp, @ip, 1, @regno)',
    { clid, regno: clid, ip: ip.slice(0, 150) });
}

function customerResponse(c) {
  const name = [str(c.fname), str(c.lname)].filter(Boolean).join(' ');
  const user = {
    id: String(c.clid),
    name: name || 'Customer',
    phone: str(c.phone),
    email: str(c.emailid) || undefined,
    loginId: str(c.loginid),
    referralCode: str(c.referalcode),
    createdAt: c.doc ? new Date(c.doc).toISOString() : undefined,
  };
  const token = signToken({ plid: c.clid, clid: c.clid, userName: user.phone, userType: 'customer' });
  return { user, token };
}

// public
router.post('/api/CustomerSendOTP', sendLimiter, asyncHandler(async (req, res) => {
  const mobile = str(req.p.MobileNo);
  const mode = str(req.p.Mode).toLowerCase();
  if (!PROCESS[mode]) return fail(res, "Mode must be 'signup' or 'login'.");
  if (!isMobile(mobile)) return fail(res, 'Please enter a valid 10-digit mobile number.');

  const existing = await findCustomerByMobile(shop, mobile);
  if (mode === 'signup' && existing) return fail(res, 'This mobile number is already registered. Please sign in.');
  if (mode === 'login' && !existing) return fail(res, 'No account found for this mobile number. Please sign up first.');
  if (mode === 'login' && existing.active !== 1) return fail(res, 'This account is inactive. Please contact support.');

  const recent = await shop.scalar(
    `select 1 from dbo.tbl_customers_otp where mobileno = @mobile and process = @process
       and createddate > localtimestamp - make_interval(secs => @secs) limit 1`,
    { mobile, process: PROCESS[mode], secs: OTP_RESEND_SECONDS });
  if (recent) return fail(res, `Please wait ${OTP_RESEND_SECONDS} seconds before requesting another OTP.`);

  const otp = String(crypto.randomInt(100000, 1000000));
  await db.tx('shopping', async (t) => {
    await t.exec('update dbo.tbl_customers_otp set active = 0 where mobileno = @mobile and process = @process and active = 1',
      { mobile, process: PROCESS[mode] });
    await t.exec('insert into dbo.tbl_customers_otp (mobileno, otp, process, createddate, active) values (@mobile, @otp, @process, localtimestamp, 1)',
      { mobile, otp, process: PROCESS[mode] });
  });

  // TODO: send the OTP by SMS once a gateway is configured (SMS_API / COMPANY_SMS_API are empty).
  const body = { status: 'true', message: `OTP sent to +91 ${mobile}. It is valid for ${OTP_VALID_MINUTES} minutes.` };
  if (SHOW_OTP_IN_RESPONSE) body.Otp = otp;
  return res.json(body);
}));

// public
router.post('/api/CustomerSignUp', verifyLimiter, asyncHandler(async (req, res) => {
  const fullName = str(req.p.FullName).replace(/\s+/g, ' ');
  const mobile = str(req.p.MobileNo);
  const email = str(req.p.EmailId).toLowerCase();
  const otp = str(req.p.Otp);

  const nameError = validateFullName(fullName);
  if (nameError) return fail(res, nameError);
  if (!isMobile(mobile)) return fail(res, 'Please enter a valid 10-digit mobile number.');
  const emailError = validateEmail(email);
  if (emailError) return fail(res, emailError);
  if (!/^\d{6}$/.test(otp)) return fail(res, 'Please enter the 6-digit OTP.');

  const ip = await GetIP.GetLocalIP(req);
  const [fname, ...rest] = fullName.split(' ');
  const lname = rest.join(' ');

  const result = await db.tx('shopping', async (t) => {
    // serialise sign-ups for the same number (tbl_customerlogin has no unique constraint on phone)
    await t.exec('select pg_advisory_xact_lock(hashtext(@key))', { key: 'customer-signup:' + mobile });
    if (await findCustomerByMobile(t, mobile)) return { error: 'This mobile number is already registered. Please sign in.' };
    if (email && await t.scalar('select 1 from dbo.tbl_customerlogin where lower(emailid) = @email and did = @did limit 1', { email, did: DID })) {
      return { error: 'This email address is already registered.' };
    }
    if (!(await consumeOtp(t, mobile, 'signup', otp))) return { error: 'Invalid or expired OTP. Please request a new one.' };

    const loginid = await uniqueNumber(t, 'loginid', 8);
    const referalcode = await uniqueNumber(t, 'referalcode', 6);
    const customer = await t.queryOne(
      `insert into dbo.tbl_customerlogin
         (loginid, userid, username, password, fname, lname, phone, emailid, active, isactive, doc,
          cid, currencysymbol, currency, ipaddress, did, referalcode, pmid, defaultlandingurl, usersource)
       values
         (@loginid, @userid, @username, null, @fname, @lname, @mobile, @email, 1, true, localtimestamp,
          @cid, 'Rs', 'INR', @ip, @did, @referalcode, 0, 1, 1)
       returning clid, loginid, username, fname, lname, phone, emailid, referalcode, doc, active`,
      { loginid, userid: loginid, username: mobile, mobile, fname: fname.slice(0, 100), lname: lname.slice(0, 100), email: email || null, cid: DEFAULT_CID,
        ip: ip.slice(0, 100), did: DID, referalcode });
    await t.exec('update dbo.tbl_customerlogin set regno = clid where clid = @clid', { clid: customer.clid });
    await recordLogin(t, customer.clid, ip);
    return { customer };
  });

  if (result.error) return fail(res, result.error);
  return res.json({ status: 'true', message: 'Account created successfully.', ...customerResponse(result.customer) });
}));

// public
router.post('/api/CustomerSignIn', verifyLimiter, asyncHandler(async (req, res) => {
  const mobile = str(req.p.MobileNo);
  const otp = str(req.p.Otp);
  if (!isMobile(mobile)) return fail(res, 'Please enter a valid 10-digit mobile number.');
  if (!/^\d{6}$/.test(otp)) return fail(res, 'Please enter the 6-digit OTP.');

  const ip = await GetIP.GetLocalIP(req);
  const result = await db.tx('shopping', async (t) => {
    const customer = await findCustomerByMobile(t, mobile);
    if (!customer) return { error: 'No account found for this mobile number. Please sign up first.' };
    if (customer.active !== 1) return { error: 'This account is inactive. Please contact support.' };
    if (!(await consumeOtp(t, mobile, 'login', otp))) return { error: 'Invalid or expired OTP. Please request a new one.' };
    await recordLogin(t, customer.clid, ip);
    return { customer };
  });

  if (result.error) return fail(res, result.error);
  return res.json({ status: 'true', message: 'Signed in successfully.', ...customerResponse(result.customer) });
}));

/* ---------------------------------------------------------------- signed-in customer: profile */

const customerAuth = [auth, requireType('customer')];
const clidOf = (req) => {
  const clid = Number(req.user && req.user.clid);
  if (!Number.isInteger(clid) || clid <= 0) throw Object.assign(new Error('Invalid customer token'), { status: 401 });
  return clid;
};
const CUSTOMER_COLUMNS = 'clid, loginid, username, fname, lname, phone, emailid, referalcode, doc, active';

async function loadCustomer(q, clid) {
  return q.queryOne(`select ${CUSTOMER_COLUMNS} from dbo.tbl_customerlogin where clid = @clid and did = @did limit 1`, { clid, did: DID });
}

// auth (customer)
router.post('/api/CustomerProfile', customerAuth, asyncHandler(async (req, res) => {
  const customer = await loadCustomer(shop, clidOf(req));
  if (!customer || customer.active !== 1) return fail(res, 'Account not found or inactive. Please sign in again.', 401);
  return res.json({ status: 'true', message: 'success', user: customerResponse(customer).user });
}));

// auth (customer)
router.post('/api/CustomerUpdateProfile', customerAuth, asyncHandler(async (req, res) => {
  const clid = clidOf(req);
  const fullName = str(req.p.FullName).replace(/\s+/g, ' ');
  const email = str(req.p.EmailId).toLowerCase();
  const errors = {};
  const nameError = validateFullName(fullName);
  const emailError = validateEmail(email);
  if (nameError) errors.name = nameError;
  if (emailError) errors.email = emailError;
  if (nameError || emailError) return res.json({ status: 'false', message: nameError || emailError, errors });
  const [fname, ...rest] = fullName.split(' ');

  const result = await db.tx('shopping', async (t) => {
    if (email && await t.scalar(
      'select 1 from dbo.tbl_customerlogin where lower(emailid) = @email and did = @did and clid <> @clid limit 1',
      { email, did: DID, clid })) {
      const message = 'This email address is already used by another account.';
      return { error: message, errors: { email: message } };
    }
    const customer = await t.queryOne(
      `update dbo.tbl_customerlogin set fname = @fname, lname = @lname, emailid = @email
        where clid = @clid and did = @did and active = 1 returning ${CUSTOMER_COLUMNS}`,
      { fname: fname.slice(0, 100), lname: rest.join(' ').slice(0, 100), email: email || null, clid, did: DID });
    return customer ? { customer } : { error: 'Account not found or inactive. Please sign in again.' };
  });
  if (result.error) return res.json({ status: 'false', message: result.error, ...(result.errors ? { errors: result.errors } : {}) });
  return res.json({ status: 'true', message: 'Profile updated.', user: customerResponse(result.customer).user });
}));

/* -------------------------------------------------------------- signed-in customer: addresses */
// public: country + state list for the address form
//   POST /api/CustomerAddressMeta  {}  ->  { country: { id, name, isdCode }, states: [{ id, name, code }] }

const ADDRESS_LABELS = ['Home', 'Work', 'Other'];

/** The delivery country (dbo.country, cid = DEFAULT_CID) and its active states (dbo.state). */
async function loadCountry(q) {
  return q.queryOne('select cid, countryname, isdcode from dbo.country where cid = @cid and cactive = true limit 1', { cid: DEFAULT_CID });
}

/** Resolves the state by id (website form) or by name (checkout); null when it is not an active state of the country. */
async function resolveState(q, stateId, stateName) {
  const sid = Number(stateId);
  if (Number.isInteger(sid) && sid > 0) {
    return q.queryOne('select sid, statename from dbo.state where sid = @sid and cid = @cid and sactive = true limit 1', { sid, cid: DEFAULT_CID });
  }
  if (!stateName) return null;
  return q.queryOne('select sid, statename from dbo.state where lower(statename) = lower(@name) and cid = @cid and sactive = true limit 1',
    { name: stateName, cid: DEFAULT_CID });
}

/**
 * Column use (ims_customeraddress): shortaddress = full street line "House, Area" (what legacy order code reads),
 * villagename = area on its own (so the two can be edited separately), landmark = landmark, phoneno1 = 10-digit mobile.
 */
function toAddress(r) {
  const line1 = str(r.shortaddress);
  const area = str(r.villagename);
  const suffix = area ? ', ' + area : '';
  const house = suffix && line1.endsWith(suffix) ? line1.slice(0, -suffix.length) : line1;
  return {
    id: String(r.id),
    label: str(r.addresstype) || 'Home',
    name: str(r.name) || str(r.cname),
    phone: str(r.phoneno1),
    line1,
    house,
    area: house === line1 && suffix ? '' : area,
    landmark: str(r.landmark),
    city: str(r.cityname),
    state: str(r.statename),
    stateId: r.stateid ? String(r.stateid) : '',
    pincode: str(r.pincode),
    isDefault: r.isdefault === true,
  };
}

/** Same rules as the website form (src/utils/addressValidation.ts). Returns { address, errors }. */
function validateAddress(p) {
  const clean = (v) => str(v).replace(/\s+/g, ' ');
  let phone = str(p.MobileNo).replace(/[\s()-]/g, '');
  phone = phone.replace(/^(\+?91|0)(?=\d{10}$)/, '');
  const a = {
    label: ADDRESS_LABELS.includes(str(p.Label)) ? str(p.Label) : 'Home',
    name: clean(p.Name),
    phone,
    house: clean(p.House),
    area: clean(p.Area),
    landmark: clean(p.Landmark),
    city: clean(p.City),
    state: clean(p.State),
    stateId: str(p.StateId),
    pincode: str(p.Pincode),
    isDefault: String(p.IsDefault).toLowerCase() === 'true',
  };
  // Checkout sends a single street line instead of House + Area
  if (!a.house && !a.area && str(p.StreetAddress)) a.house = clean(p.StreetAddress);

  const e = {};
  if (!a.name) e.name = 'Please enter a name.';
  else if (a.name.length < 2 || a.name.length > 100) e.name = 'Name must be 2 to 100 characters.';
  else if (!/^[A-Za-z][A-Za-z .'-]*$/.test(a.name)) e.name = 'Name can only contain letters, spaces, dots, apostrophes and hyphens.';

  if (!a.phone) e.phone = 'Please enter a mobile number.';
  else if (!/^[6-9]\d{9}$/.test(a.phone)) e.phone = 'Please enter a valid 10-digit Indian mobile number.';

  if (!a.pincode) e.pincode = 'Please enter a PIN code.';
  else if (!/^[1-9]\d{5}$/.test(a.pincode)) e.pincode = 'Please enter a valid 6-digit PIN code.';

  if (!a.house) e.house = 'Please enter flat, house no., building or company.';
  else if (a.house.length > 150) e.house = 'Must be 150 characters or fewer.';

  if (str(p.StreetAddress) && !str(p.House) && !str(p.Area)) {
    // single-line address from checkout: area is optional
  } else if (!a.area) e.area = 'Please enter area, street, sector or village.';
  else if (a.area.length > 100) e.area = 'Must be 100 characters or fewer.';

  if (a.landmark.length > 100) e.landmark = 'Must be 100 characters or fewer.';

  if (!a.city) e.city = 'Please enter a town or city.';
  else if (a.city.length > 100 || !/^[A-Za-z][A-Za-z .'-]*$/.test(a.city)) e.city = 'Please enter a valid town or city name.';

  // checked against dbo.state by the caller (resolveState)
  if (!a.state && !a.stateId) e.state = 'Please select a state.';

  a.line1 = [a.house, a.area].filter(Boolean).join(', ');
  return { address: a, errors: e };
}

async function listAddresses(q, clid) {
  const rows = await q.query(
    `select id, addresstype, name, cname, phoneno1, shortaddress, villagename, landmark, cityname, stateid, statename, pincode, isdefault
       from dbo.ims_customeraddress where tousertype = 'Customer' and touserid = @clid
      order by isdefault desc, id`, { clid });
  return rows.map(toAddress);
}

/** Makes `addressId` the only default; when null, keeps the current default or promotes the oldest address. */
async function normaliseDefault(t, clid, addressId) {
  if (addressId) {
    await t.exec(`update dbo.ims_customeraddress set isdefault = (id = @id) where tousertype = 'Customer' and touserid = @clid`,
      { id: addressId, clid });
    return;
  }
  const hasDefault = await t.scalar(
    `select 1 from dbo.ims_customeraddress where tousertype = 'Customer' and touserid = @clid and isdefault = true limit 1`, { clid });
  if (!hasDefault) {
    await t.exec(
      `update dbo.ims_customeraddress set isdefault = true where id = (select min(id) from dbo.ims_customeraddress
        where tousertype = 'Customer' and touserid = @clid)`, { clid });
  }
}

const addressIdOf = (v) => {
  const id = Number(str(v));
  return Number.isInteger(id) && id > 0 ? id : null;
};

// public
router.post('/api/CustomerAddressMeta', asyncHandler(async (req, res) => {
  const country = await loadCountry(shop);
  if (!country) return fail(res, 'Delivery country is not configured (dbo.country). Run database/seed_country_state.sql.');
  const states = await shop.query(
    'select sid, statename, scode from dbo.state where cid = @cid and sactive = true order by statename', { cid: country.cid });
  return res.json({
    status: 'true',
    message: 'success',
    country: { id: String(country.cid), name: str(country.countryname), isdCode: str(country.isdcode) || '+91' },
    states: states.map((s) => ({ id: String(s.sid), name: str(s.statename), code: str(s.scode) })),
  });
}));

// auth (customer)
router.post('/api/CustomerAddressList', customerAuth, asyncHandler(async (req, res) => {
  return res.json({ status: 'true', message: 'success', data: await listAddresses(shop, clidOf(req)) });
}));

// auth (customer)
router.post('/api/CustomerSaveAddress', customerAuth, asyncHandler(async (req, res) => {
  const clid = clidOf(req);
  const p = req.p;
  const addressId = str(p.AddressId) ? addressIdOf(p.AddressId) : null;
  if (str(p.AddressId) && !addressId) return fail(res, 'Invalid address.');
  const { address: a, errors } = validateAddress(p);
  const country = await loadCountry(shop);
  if (!country) return fail(res, 'Delivery country is not configured. Please contact support.');
  if (!errors.state) {
    const state = await resolveState(shop, a.stateId, a.state);
    if (!state) errors.state = 'Please select a state from the list.';
    else { a.stateId = state.sid; a.state = str(state.statename); }
  }
  const firstError = Object.values(errors)[0];
  if (firstError) return res.json({ status: 'false', message: firstError, errors });

  const result = await db.tx('shopping', async (t) => {
    const params = {
      label: a.label, name: a.name, cname: a.name, phone: a.phone, line1: a.line1, area: a.area || null,
      landmark: a.landmark || null, city: a.city, stateid: a.stateId, state: a.state, pincode: a.pincode, clid,
      cid: country.cid, countryname: str(country.countryname),
    };
    let id = addressId;
    if (id) {
      const updated = await t.queryOne(
        `update dbo.ims_customeraddress set addresstype = @label, name = @name, cname = @cname, phoneno1 = @phone,
            shortaddress = @line1, villagename = @area, landmark = @landmark, cityname = @city,
            stateid = @stateid, statename = @state, countryid = @cid, countryname = @countryname, pincode = @pincode
          where id = @id and tousertype = 'Customer' and touserid = @clid returning id`,
        { ...params, id });
      if (!updated) return { error: 'Address not found.' };
    } else {
      const inserted = await t.queryOne(
        `insert into dbo.ims_customeraddress
           (addresstype, name, cname, phoneno1, shortaddress, villagename, landmark, cityname, stateid, statename, pincode,
            countryid, countryname, isactive, isdefault, isverified, createddate, addressguid, tousertype, touserid)
         values (@label, @name, @cname, @phone, @line1, @area, @landmark, @city, @stateid, @state, @pincode,
            @cid, @countryname, true, false, false, localtimestamp, gen_random_uuid(), 'Customer', @clid)
         returning id`,
        params);
      id = inserted.id;
    }
    await normaliseDefault(t, clid, a.isDefault ? id : null);
    return { id, list: await listAddresses(t, clid) };
  });
  if (result.error) return fail(res, result.error);
  return res.json({ status: 'true', message: 'Address saved.', addressId: String(result.id), data: result.list });
}));

// auth (customer)
router.post('/api/CustomerDeleteAddress', customerAuth, asyncHandler(async (req, res) => {
  const clid = clidOf(req);
  const id = addressIdOf(req.p.AddressId);
  if (!id) return fail(res, 'Invalid address.');
  const result = await db.tx('shopping', async (t) => {
    const n = await t.exec(`delete from dbo.ims_customeraddress where id = @id and tousertype = 'Customer' and touserid = @clid`, { id, clid });
    if (!n) return { error: 'Address not found.' };
    await normaliseDefault(t, clid, null);
    return { list: await listAddresses(t, clid) };
  });
  if (result.error) return fail(res, result.error);
  return res.json({ status: 'true', message: 'Address removed.', data: result.list });
}));

// auth (customer)
router.post('/api/CustomerSetDefaultAddress', customerAuth, asyncHandler(async (req, res) => {
  const clid = clidOf(req);
  const id = addressIdOf(req.p.AddressId);
  if (!id) return fail(res, 'Invalid address.');
  const result = await db.tx('shopping', async (t) => {
    const owned = await t.scalar(`select 1 from dbo.ims_customeraddress where id = @id and tousertype = 'Customer' and touserid = @clid`, { id, clid });
    if (!owned) return { error: 'Address not found.' };
    await normaliseDefault(t, clid, id);
    return { list: await listAddresses(t, clid) };
  });
  if (result.error) return fail(res, result.error);
  return res.json({ status: 'true', message: 'Default address updated.', data: result.list });
}));

module.exports = router;
