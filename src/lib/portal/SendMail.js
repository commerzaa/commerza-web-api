/** Exports (C# class SendMail with static methods; EmailParam property bag):
 *   async Send(Int64 plid, string from, string to, string cc, string bcc, string subject, string body, string SenderName = "") : string  ("success")
 *   async CallBackAddress(string ToEmailId, string Subject, string EmailContent) : string   ("success" or the exception message)
 *   async Send1(string from, string to, string cc, string bcc, string subject, string body) : string  ("success")
 *   EmailParam = { PROPS: [ToEmailId, Subject, EmailContent, APIKEY, FromEmailId, FromName] }
 * Differs from ../merchant/SendMail and ../SendMail: the portal posts every mail to the SendGrid relay https://email.go1000.club/api/v1/send-grid-email.
 * PORT-NOTE: the SendGrid APIKEY was hard-coded in C#; it is read from config.app.SendGridApiKey (SENDGRID_API_KEY).
 * Config keys: CompanyName, SendGridApiKey.
 */
'use strict';
const axios = require('axios');
const config = require('../../config');

const EmailParam = { PROPS: ['ToEmailId', 'Subject', 'EmailContent', 'APIKEY', 'FromEmailId', 'FromName'] };

// JavaScriptSerializer.Serialize: null strings are serialised as null, keys in declaration order
function serialize(o) {
  const out = {};
  for (const k of EmailParam.PROPS) out[k] = o[k] === undefined ? null : o[k];
  return JSON.stringify(out);
}

async function CallBackAddress(ToEmailId, Subject, EmailContent) {
  const CompanyName = config.app.CompanyName === undefined ? null : config.app.CompanyName;
  const OBjGETDepositeAddress = {
    ToEmailId,
    Subject,
    EmailContent,
    APIKEY: (config.app.SendGridApiKey || ''),
    FromEmailId: 'noreply@clusteroffer.com',
    FromName: CompanyName,
  };
  const StrPostData = serialize(OBjGETDepositeAddress);
  try {
    await axios.post('https://email.go1000.club/api/v1/send-grid-email', StrPostData, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 100000, // HttpWebRequest default
      responseType: 'text',
      transformResponse: [(d) => d],
    });
  } catch (objExp) {
    return objExp.message;
  }
  return 'success';
}

async function Send(plid, from, to, cc, bcc, subject, body, SenderName = '') {
  await CallBackAddress(to, subject, body);
  return 'success';
}

async function Send1(from, to, cc, bcc, subject, body) {
  await CallBackAddress(to, subject, body);
  return 'success';
}

module.exports = { Send, CallBackAddress, Send1, EmailParam };
