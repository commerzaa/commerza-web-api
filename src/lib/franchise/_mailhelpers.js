/** Exports: mailAddress, addrList, smtpSend. Internal helpers shared by the franchise mail ports (not a port of a C# file): mailAddress(addr, name?), addrList(csv), smtpSend({...}) : 's' | error message */
'use strict';
const nodemailer = require('nodemailer');

// new MailAddress(address[, displayName]) validation (System.Net.Mail)
function mailAddress(address, displayName) {
  if (address === null || address === undefined) throw new TypeError("Value cannot be null. Parameter name: address");
  const a = String(address).trim();
  if (a === '') throw new Error("The parameter 'address' cannot be an empty string. Parameter name: address");
  if (!/^[^@\s,;<>]+@[^@\s,;<>]+$/.test(a) && !/<[^@\s]+@[^@\s]+>/.test(a)) throw new Error('The specified string is not in the form required for an e-mail address.');
  return displayName ? { name: displayName, address: a } : a;
}

// MailAddressCollection.Add(string) for each item of csv.Split(',')
function addrList(csv) {
  return String(csv).split(',').map((x) => mailAddress(x));
}

/**
 * System.Net.Mail.SmtpClient.Send equivalent. Returns 's' on success, or the error message (legacy returned ex.Message).
 * opts: { host, port = 25, user, pass, enableSsl = false, message: nodemailer message }
 * PORT-NOTE: implicit TLS for port 465, STARTTLS when enableSsl on other ports, otherwise plain (opportunistic STARTTLS by nodemailer).
 */
async function smtpSend({ host, port = 25, user, pass, enableSsl = false, message }) {
  try {
    if (!host) throw new Error('The SMTP host was not specified.');
    const t = nodemailer.createTransport({
      host, port, secure: port === 465, requireTLS: !!enableSsl && port !== 465,
      auth: user ? { user, pass } : undefined,
    });
    await t.sendMail(message);
    return 's';
  } catch (ex) {
    return String(ex && ex.message);
  }
}

module.exports = { mailAddress, addrList, smtpSend };
