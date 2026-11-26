/** Exports (portal "Web References/TopUpServices/Reference.cs", namespace Eblaa_Web.TopUpServices; generated ASMX SOAP 1.1 client):
 *  class ApiService (EventEmitter)  -- `new ApiService()`; property Url (default config.app.Eblaa_Web_TopUpServices_ApiService || Settings.settings default)
 *    async Recharge(apiToken, mn, op, amt, reqid, field1, field2) : Result|null
 *    async GetBalance(apiToken) : string|null
 *    async GetBalanceNew(apiToken) : Wallet|null
 *    async GetOperator(mn) : MobileProvider|null
 *    async GetRechargeStatus(apiToken, reqid) : Result|null
 *    async RegisterComplaint(apiToken, reqid, reason) : string|null
 *    <Method>Async(...args, userState?) : emits '<Method>Completed' with { Result, Error, Cancelled, UserState } ; CancelAsync(userState)
 *  Result {reqid,status,remark,balance,mn,field1,ec,apirefid,amt} ; MobileProvider {code,provider,state,opid,cid} ; Wallet {main:decimal,dmr:decimal}
 *  Errors: SOAP fault => throws Error(faultstring) (SoapException); HTTP/network errors propagate (WebException).
 */
'use strict';
const { EventEmitter } = require('events');
const axios = require('axios');
const config = require('../../config');

const NS = 'http://tempuri.org/';
const DEFAULT_URL = 'http://www.mytopup.co.in/apiservice.asmx'; // Properties/Settings.settings default (not a secret)

const xmlEsc = (v) => String(v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const xmlUnesc = (v) => String(v)
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#x([0-9a-fA-F]+);/g, (m, h) => String.fromCodePoint(parseInt(h, 16)))
  .replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(parseInt(d, 10)))
  .replace(/&amp;/g, '&');

// returns { found, nil, inner } for the first <[prefix:]name ...>...</[prefix:]name> (or self-closing) element
function element(xml, name) {
  const re = new RegExp('<(?:[\\w.-]+:)?' + name + '(\\s[^>]*)?(/>|>([\\s\\S]*?)</(?:[\\w.-]+:)?' + name + '\\s*>)');
  const m = re.exec(xml);
  if (!m) return { found: false, nil: true, inner: null };
  const attrs = m[1] || '';
  if (/\bnil\s*=\s*["']true["']/.test(attrs)) return { found: true, nil: true, inner: null };
  if (m[2] === '/>') return { found: true, nil: false, inner: '' };
  return { found: true, nil: false, inner: m[3] };
}
const str = (xml, name) => { const e = element(xml, name); return e.nil ? null : xmlUnesc(e.inner); };
function dec(xml, name) { // XmlSerializer decimal (minOccurs=1): missing => 0, bad => FormatException
  const e = element(xml, name);
  if (e.nil) return 0;
  const t = xmlUnesc(e.inner).trim();
  const n = Number(t);
  if (t === '' || Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
  return n;
}

const RESULT_PROPS = ['reqid', 'status', 'remark', 'balance', 'mn', 'field1', 'ec', 'apirefid', 'amt'];
const PROVIDER_PROPS = ['code', 'provider', 'state', 'opid', 'cid'];
const objOf = (xml, props) => { const o = {}; for (const p of props) o[p] = str(xml, p); return o; };

class ApiService extends EventEmitter {
  constructor() {
    super();
    this.Url = config.app.Eblaa_Web_TopUpServices_ApiService || DEFAULT_URL;
    this.Timeout = 100000; // SoapHttpClientProtocol default
    this._cancelled = new Set();
  }

  // SoapHttpClientProtocol.Invoke (document/literal, wrapped). null arguments are omitted (minOccurs=0).
  async _invoke(method, args) {
    let body = '';
    for (const [k, v] of args) if (v !== null && v !== undefined) body += '<' + k + '>' + xmlEsc(v) + '</' + k + '>';
    const envelope = '<?xml version="1.0" encoding="utf-8"?>'
      + '<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">'
      + '<soap:Body><' + method + ' xmlns="' + NS + '">' + body + '</' + method + '></soap:Body></soap:Envelope>';
    const r = await axios.post(this.Url, envelope, {
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: '"' + NS + method + '"' },
      responseType: 'text', transformResponse: [(d) => d], timeout: this.Timeout,
      validateStatus: (s) => (s >= 200 && s < 300) || s === 500,
    });
    const xml = String(r.data || '');
    const fault = element(xml, 'Fault');
    if (fault.found) {
      const err = new Error(str(fault.inner || '', 'faultstring') || 'SOAP fault');
      err.name = 'SoapException';
      throw err;
    }
    if (r.status === 500) throw new Error('The remote server returned an error: (500) Internal Server Error.');
    const resp = element(xml, method + 'Response');
    if (!resp.found) throw new Error('Client found response content type of \'' + (r.headers['content-type'] || '') + '\', but expected \'text/xml\'.');
    return element(resp.inner || '', method + 'Result');
  }

  async Recharge(apiToken, mn, op, amt, reqid, field1, field2) {
    const e = await this._invoke('Recharge', [['apiToken', apiToken], ['mn', mn], ['op', op], ['amt', amt], ['reqid', reqid], ['field1', field1], ['field2', field2]]);
    return e.nil ? null : objOf(e.inner, RESULT_PROPS);
  }

  async GetBalance(apiToken) {
    const e = await this._invoke('GetBalance', [['apiToken', apiToken]]);
    return e.nil ? null : xmlUnesc(e.inner);
  }

  async GetBalanceNew(apiToken) {
    const e = await this._invoke('GetBalanceNew', [['apiToken', apiToken]]);
    return e.nil ? null : { main: dec(e.inner, 'main'), dmr: dec(e.inner, 'dmr') };
  }

  async GetOperator(mn) {
    const e = await this._invoke('GetOperator', [['mn', mn]]);
    return e.nil ? null : objOf(e.inner, PROVIDER_PROPS);
  }

  async GetRechargeStatus(apiToken, reqid) {
    const e = await this._invoke('GetRechargeStatus', [['apiToken', apiToken], ['reqid', reqid]]);
    return e.nil ? null : objOf(e.inner, RESULT_PROPS);
  }

  async RegisterComplaint(apiToken, reqid, reason) {
    const e = await this._invoke('RegisterComplaint', [['apiToken', apiToken], ['reqid', reqid], ['reason', reason]]);
    return e.nil ? null : xmlUnesc(e.inner);
  }

  // InvokeAsync + <Method>Completed event
  _async(method, args, arity) {
    const userState = args.length > arity ? args[arity] : undefined;
    const callArgs = args.slice(0, arity);
    this[method](...callArgs).then(
      (Result) => this._complete(method, { Result, Error: null, UserState: userState }),
      (Error_) => this._complete(method, { Result: null, Error: Error_, UserState: userState }),
    );
  }
  _complete(method, e) {
    const Cancelled = userStateCancelled(this, e.UserState);
    this.emit(method + 'Completed', this, { ...e, Cancelled });
  }

  RechargeAsync(...a) { this._async('Recharge', a, 7); }
  GetBalanceAsync(...a) { this._async('GetBalance', a, 1); }
  GetBalanceNewAsync(...a) { this._async('GetBalanceNew', a, 1); }
  GetOperatorAsync(...a) { this._async('GetOperator', a, 1); }
  GetRechargeStatusAsync(...a) { this._async('GetRechargeStatus', a, 2); }
  RegisterComplaintAsync(...a) { this._async('RegisterComplaint', a, 3); }

  // PORT-NOTE: the HTTP request is not aborted; the completion event is flagged Cancelled.
  CancelAsync(userState) { this._cancelled.add(userState); }
}

function userStateCancelled(svc, us) {
  if (svc._cancelled.has(us)) { svc._cancelled.delete(us); return true; }
  return false;
}

ApiService.RESULT_PROPS = RESULT_PROPS;
ApiService.MOBILEPROVIDER_PROPS = PROVIDER_PROPS;
ApiService.WALLET_PROPS = ['main', 'dmr'];

module.exports = ApiService;
