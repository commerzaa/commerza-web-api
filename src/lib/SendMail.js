'use strict';
/**
 * Exports (static class):
 *   async Send(plid:Int64, from, to, cc, bcc, subject, body, SenderName = ""): string   ("s" on success, else error message)
 *   async Send1(from, to, cc, bcc, subject, body): string                               ("Invalid Function return")
 */
const nodemailer = require('nodemailer');
const { queryOne } = require('../db');

// legacy: _TBL_EMAILACCOUNT.Where(EAID == 1).FirstOrDefault()  (Db_Affiliate)
async function Send(plid, from, to, cc, bcc, subject, body, SenderName = '') {
  let username = '';
  let pass = '';
  let host = '';
  let strret = '';
  from = '';
  let Portnumber = 0;
  const EmailAcctount = await queryOne('affiliate', 'select * from tbl_emailaccount where eaid = @eaid limit 1', { eaid: 1 });
  if (!EmailAcctount) throw new TypeError('Object reference not set to an instance of an object.');
  Portnumber = parseInt(EmailAcctount.smtpport, 10);
  if (Number.isNaN(Portnumber)) throw new Error('Input string was not in a correct format.');
  username = EmailAcctount.emailid;
  pass = EmailAcctount.password;
  host = EmailAcctount.hostname;
  strret = '';
  from = EmailAcctount.emailid;

  const split = (s) => s.split(',');
  const msg = {
    subject,
    html: body,
    from: SenderName === '' ? from : { name: SenderName, address: from },
  };
  if (to !== '') msg.to = split(to);
  if (cc !== '') msg.cc = split(cc);
  if (bcc !== '') msg.bcc = split(bcc);

  // PORT-NOTE: System.Net.Mail without EnableSsl => plain/STARTTLS; implicit TLS only for port 465.
  const transporter = nodemailer.createTransport({
    host, port: Portnumber, secure: Portnumber === 465, auth: { user: username, pass },
  });
  try {
    await transporter.sendMail(msg);
    strret = 's';
    return strret;
  } catch (ExpObj) {
    strret = String(ExpObj.message);
    return strret; // legacy returned here; the ErrorInsert block after it was unreachable
  }
}

async function Send1(from, to, cc, bcc, subject, body) {
  return 'Invalid Function return';
}

module.exports = { Send, Send1 };
