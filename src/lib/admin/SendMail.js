/** Exports: class SendMail (Models/SendMail.cs)
 *   new SendMail()
 *   static async Send(string from, string to, string cc, string bcc, string subject, string body) : string
 *       (always returns "This is invalid funtion which you are tying to call" - the admin legacy class sends nothing)
 *  Not reused from ../member/SendMail.js: the Member C# really sends mail, the admin one is a stub.
 */
'use strict';

class SendMail {
  static async Send(from, to, cc, bcc, subject, body) { // eslint-disable-line no-unused-vars
    return 'This is invalid funtion which you are tying to call';
  }
}

module.exports = SendMail;
