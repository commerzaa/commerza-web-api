/** Exports (portal Global.asax.cs, class Eblaa_Web.MvcApplication):
 *  Application_Start() : starts the recurring background jobs (call ONCE at server start-up; the MVC/WebApi/route/bundle registration is done by Express)
 *  Application_End()   : clears the job timers (no C# equivalent; for graceful shutdown/tests)
 *  AddTask_AutoCampaignSuite(name, seconds) ; Kyc_Auto_Mail(name, seconds) ; BusinessKyc_Auto_Mail(name, seconds) ; Auto_Recharge_Process(name, seconds)
 *  CacheItemRemoved_AutoPayout(k, v, r) ; CacheItemRemoved_Auto_Mail(k, v, r) ; CacheItemRemove_BusinessKYC_Auto_Mail(k, v, r) ; CacheItemRemove_Auto_Recharge_Process(k, v, r)
 *  GetIpAddress() : string ; GetCompCode() : string
 *  Jobs started by Application_Start (same as the C#): Kyc_Auto_Mail("Auto",300), BusinessKyc_Auto_Mail("BusinessKYCAuto",300),
 *  Auto_Recharge_Process("Auto_Recharge_Process",5). AddTask_AutoCampaignSuite and RemoveRecentlyViewedItems were commented out.
 *  PORT-NOTE: HttpRuntime.Cache absolute expiration + CacheItemRemovedCallback (re-insert => recurring task) => setTimeout per task name
 *  (unref'd, one pending timer per name). The task body runs, then the next run is scheduled `seconds` later, like Cache.Insert after the call.
 *  PORT-NOTE: RemoveRecentlyViewedItems (only referenced from a commented-out line) is not ported: it needed HttpContext.Current.Session and
 *  Product_DetailController inside a timer (no request), so it always threw and was swallowed in the legacy app.
 */
'use strict';
const os = require('os');
const dns = require('dns');

const timers = new Map();

// HttpRuntime.Cache.Insert(name, seconds, null, Now+seconds, NoSlidingExpiration, NotRemovable, callback)
function cacheInsert(name, seconds, callback) {
  if (timers.has(name)) clearTimeout(timers.get(name)); // Cache.Insert replaces the existing entry
  const t = setTimeout(() => {
    timers.delete(name);
    Promise.resolve()
      .then(() => callback(name, seconds, 'Expired'))
      .catch((e) => console.error('[portal Global ' + name + ']', e && e.message));
  }, Number(seconds) * 1000);
  if (t.unref) t.unref();
  timers.set(name, t);
}

async function runTask(fn) {
  let ErrorMessage = '';
  try {
    await fn();
  } catch (exp) {
    ErrorMessage = exp && exp.message;
  }
  return ErrorMessage;
}

async function AddTask_AutoCampaignSuite(name, seconds) {
  await runTask(() => require('./UtilityClass').BlastCampaign());
  cacheInsert(name, seconds, CacheItemRemoved_AutoPayout);
}
async function CacheItemRemoved_AutoPayout(k, v, r) {
  await AddTask_AutoCampaignSuite(k, Number(v));
}

async function Kyc_Auto_Mail(name, seconds) {
  await runTask(() => require('./UtilityClass').Auto_Mail());
  cacheInsert(name, seconds, CacheItemRemoved_Auto_Mail);
}
async function CacheItemRemoved_Auto_Mail(k, v, r) {
  await Kyc_Auto_Mail(k, Number(v));
}

async function BusinessKyc_Auto_Mail(name, seconds) {
  await runTask(() => require('./UtilityClass').BusinessKYC_Auto_Mail());
  cacheInsert(name, seconds, CacheItemRemove_BusinessKYC_Auto_Mail);
}
async function CacheItemRemove_BusinessKYC_Auto_Mail(k, v, r) {
  await BusinessKyc_Auto_Mail(k, Number(v));
}

// Auto Recharge Process (RechargeAutoProcess.AutoRechargeProcess runs synchronously before the next schedule)
async function Auto_Recharge_Process(name, seconds) {
  await runTask(() => require('./RechargeAutoProcess').AutoRechargeProcess());
  cacheInsert(name, seconds, CacheItemRemove_Auto_Recharge_Process);
}
async function CacheItemRemove_Auto_Recharge_Process(k, v, r) {
  await Auto_Recharge_Process(k, Number(v));
}

// Get Computer Name
function GetCompCode() {
  return os.hostname();
}

// Get IP Address: Dns.GetHostEntry(hostname).AddressList[1] (IndexOutOfRange when < 2 addresses)
async function GetIpAddress() {
  const addr = await dns.promises.lookup(GetCompCode(), { all: true });
  if (addr.length < 2) throw new RangeError('Index was outside the bounds of the array.');
  return String(addr[1].address);
}

let started = false;
async function Application_Start() {
  if (started) return;
  started = true;
  // AddTask_AutoCampaignSuite("Auto", 300);  (commented out in the C#)
  await Kyc_Auto_Mail('Auto', 300);
  await BusinessKyc_Auto_Mail('BusinessKYCAuto', 300);
  await Auto_Recharge_Process('Auto_Recharge_Process', 5);
  // RemoveRecentlyViewedItems("RemoveRecentlyViewedItemsByCurrentUser", 3000);  (commented out in the C#)
}

function Application_End() {
  for (const t of timers.values()) clearTimeout(t);
  timers.clear();
  started = false;
}

module.exports = {
  Application_Start, Application_End,
  AddTask_AutoCampaignSuite, CacheItemRemoved_AutoPayout, Kyc_Auto_Mail, CacheItemRemoved_Auto_Mail,
  BusinessKyc_Auto_Mail, CacheItemRemove_BusinessKYC_Auto_Mail, Auto_Recharge_Process, CacheItemRemove_Auto_Recharge_Process,
  GetIpAddress, GetCompCode,
};
