/** Exports (static class SendMail, all async, return "s" on success or the error message):
 *   Send(Int64 plid, string from, string to, string cc, string bcc, string subject, string body, string SenderName = "") : string
 *   Send1(string from, string to, string cc, string bcc, string subject, string body, int DID = 0, string Type = "") : string
 *   Sendemailwithattachment(string from, string to, string cc, string bcc, string subject, string body, string attachment) : string  (attachment = comma separated URLs, downloaded and attached)
 *  Also exported: class EmailAuthentication (props COMPANYINFOEMAILID, COMPANYMAILPASSOWRD, COMPANYMAILSERVER; plain bag).
 *  Merchant differences vs Franchise: Send looks up tbl_emailmembermaster (per-member SMTP account, falls back to CompanySettings), SMTP always authenticates with
 *  CompanySupportEmailId/CompanyMailPassword on CompanyMailServer:587; Send1 reads tbl_companysettings (PMID=1) when Type/DID are given; no hard-coded BCC / sender.
 */
'use strict';
const path = require('path');
const axios = require('axios');
const { query, queryOne } = require('../../db');
const CompanySettings = require('./CompanySettings');
const { mailAddress, addrList, smtpSend } = require('../franchise/_mailhelpers');
const { safeUrl } = require('../_http');

function buildMessage({ from, SenderName, to, cc, bcc, subject, body }) {
  const msg = { subject, html: body };
  msg.from = SenderName === '' || SenderName === undefined ? mailAddress(from) : mailAddress(from, SenderName);
  if (to !== '') msg.to = addrList(to);
  if (cc !== '') msg.cc = addrList(cc);
  if (bcc !== '') msg.bcc = addrList(bcc);
  return msg;
}

async function Send(plid, from, to, cc, bcc, subject, body, SenderName = '') {
  from = '';
  // _EmailMemberMaster.Where(PLID == plid && ISACTIVE.Equals(1)).FirstOrDefault()   (Db_Shopping)
  const obj = await queryOne('shopping', 'select * from tbl_emailmembermaster where plid=@plid and isactive::int=1 limit 1', { plid });
  if (obj !== null) {
    from = obj.emailid;
  } else {
    from = '' + CompanySettings.CompanyInfoEmailId + '';
  }
  const message = buildMessage({ from, SenderName, to, cc, bcc, subject, body });
  mailAddress(from); // MailAddress ad = new MailAddress(from)
  // legacy always authenticates with the company support account on port 587 (member credentials/host are not used)
  return smtpSend({ host: CompanySettings.CompanyMailServer, port: 587, user: CompanySettings.CompanySupportEmailId, pass: CompanySettings.CompanyMailPassword, message });
}

async function Send1(from, to, cc, bcc, subject, body, DID = 0, Type = '') {
  let username = '';
  let pass = '';
  let host = '';
  from = '';
  const Consmtp = CompanySettings.CompanyMailServerPort; // Convert.ToInt32(AppSettings["CompanyMailServerPort"])
  if (Type !== '' && DID !== 0) {
    const rows = await query('shopping', 'select companyinfoemailid, companymailserver, companymailpassoword from tbl_companysettings where pmid=1');
    for (const item of rows) {
      username = item.companyinfoemailid;
      pass = item.companymailpassoword;
      host = item.companymailserver;
      from = item.companyinfoemailid;
    }
  } else {
    username = '' + CompanySettings.CompanyInfoEmailId + '';
    pass = '' + CompanySettings.CompanyMailPassword + '';
    host = '' + CompanySettings.CompanyMailServer + '';
    from = '' + CompanySettings.CompanyInfoEmailId + '';
  }
  const message = buildMessage({ from, SenderName: '', to, cc, bcc, subject, body });
  mailAddress(from);
  return smtpSend({ host, port: Consmtp, user: username, pass, message });
}

async function Sendemailwithattachment(from, to, cc, bcc, subject, body, attachment) {
  const username = CompanySettings.CompanyInfoEmailId;
  const pass = CompanySettings.CompanyMailPassword;
  const host = CompanySettings.CompanyMailServer;
  from = CompanySettings.CompanyInfoEmailId;
  const msg = buildMessage({ from, SenderName: '', to, cc, bcc, subject, body });
  const paths = attachment.split(',');
  const attachments = [];
  for (let i = 0; i < paths.length; i++) {
    if (paths[i] !== '') {
      const Filename = path.win32.basename(paths[i]); // Path.GetFileName
      const r = await axios.get(safeUrl(paths[i]), { responseType: 'arraybuffer' }); // WebClient.OpenRead (errors propagate)
      attachments.push({ filename: Filename, content: Buffer.from(r.data) });
    }
  }
  msg.attachments = attachments;
  mailAddress(from);
  // SmtpClient(host): default port 25
  return smtpSend({ host, port: 25, user: username, pass, message: msg });
}

class EmailAuthentication {
  constructor() { this.COMPANYINFOEMAILID = null; this.COMPANYMAILPASSOWRD = null; this.COMPANYMAILSERVER = null; }
}

module.exports = { Send, Send1, Sendemailwithattachment, EmailAuthentication };
