/** Exports (static class SendMail, all async, return "s" on success or the error message):
 *   Send(Int64 plid, string from, string to, string cc, string bcc, string subject, string body, string SenderName = "") : string
 *   Send1(string from, string to, string cc, string bcc, string subject, string body, int DID = 0, string Type = "") : string
 *   Sendemailwithattachment(string from, string to, string cc, string bcc, string subject, string attachment) : string  (attachment = comma separated URLs, downloaded and attached)
 *  PORT-NOTE: legacy hard-coded the BCC address and the "noreply@clusteroffer.com" sender; BCC now comes from config.app.MailBccAddress (add to config/.env, empty = no BCC),
 *  sender from config.app.NoReplyMail (fallback 'noreply@clusteroffer.com'). Sender display name "Dealsinvicta" is kept.
 */
'use strict';
const path = require('path');
const axios = require('axios');
const config = require('../../config');
const CompanySettings = require('./CompanySettings');
const { mailAddress, addrList, smtpSend } = require('./_mailhelpers');
const { safeUrl } = require('../_http');

const TPL_ATTACH = "<div style='background:#f5f5f5; width:450px; margin:0 auto; padding:20px;  padding-bottom:10px;'>\n  <div style='background: #fff; margin:0 auto; color: #333; font-family: 'Exo', sans-serif,Helvetica,sans-serif; padding:15px 25px;'>\n    <link href='https://maxcdn.bootstrapcdn.com/font-awesome/4.7.0/css/font-awesome.min.css' type='text/css' rel='stylesheet' />\n    <table cellpadding='0' cellspacing='0' style='width: 100%'>\n      <tbody>\n        <tr>\n          <td><table style='width:100%;'>\n              <tbody>\n                <tr>\n                  <td colspan='2' align='center' style='background:#2d2a24 '><img src='$$CompanyResellerURL$$/images/$$Logo$$' height='45' border='0' style='margin-top:15px; margin-left:10px; margin-bottom:10px;'></td>\n                </tr>\n              </tbody>\n            </table></td>\n        </tr>\n        <tr>\n          <td><div>\n              <div class='clear'></div>\n              <table style='padding-bottom: 10px;   width: 100%; '>\n                <tbody>\n                  <tr>\n                    <td align='center'><h1 style='font-size: 18px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px\n\n                        15px; color: #000'></h1>\n                      <strong style='font-size: 20px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin:0; color: #000; padding-top:'></strong>\n                      <div style='text-align:left;'>\n                     <h1 style='font-size: 14px; font-family: 'Exo', sans-serif, Helvetica, sans-serif; font-weight: normal; margin: 15px 0px 15px; color: #3f3f42;'>Dear Reseller, </h1>\n                     <div style='font-size: 15px; color: #333;'>\n                     </div>\nThanks you for accepting our term and condition for agreement now you can download the agreement for complete the process.\n                      <table border='0' width='100%' height='36px' style='background: #00a0a8; margin: 30px 0 20px; font-weight:bold;'>\n                        <tbody>\n                          <tr>\n                            <td align='center' style='padding: 2px 2px'><a href='$$Atchment$$' style='text-align:center; width:100%; font-size: 14px; text-decoration: none; font-family: 'Exo', sans-serif, Helvetica, sans-serif; color: #fff' target='K-P_EYTewa3lJ5WgwetbbkY'>Download Pdf</a></td>\n                          </tr>\n                        </tbody>\n                      </table>\n\n                      <div style='clear: both'></div>\n                      <div style='margin-right: 7px; text-align:left;  border-top:1px solid #ddd; padding-top:20px; margin-top:30px;'>\n                  <h5 style='margin: 0; font - size:18px; font - weight:normal; padding - bottom:5px; '>Need Support?</h5>\n                          <p style = 'text-align: justify;font-size: 14px; font-weight: normal; margin: 0px 0px 7px 0px; padding-top: 0px; font-family: 'Exo', sans-serif, Helvetica, sans-serif;  color: #000'> If you have any issues,\n            we will be happy to help you. You can contact us on <a style = 'color:#00a0a8;'> $$CompanySupportEmailId$$</a></p>\n                                     </div>\n\n                                           </td>\n\n                                       </tr>\n\n                                       <tr>\n\n                                         <td>\n\n                                         <table style = 'width:100%;  border-top:1px solid #ddd; padding-top:20px; margin-top:10px;'>\n\n                                      <tbody>\n\n                                        <tr>\n\n                                        <td>\n\n                                            <p style = 'margin:0; font-size:14px; font-weight:normal; padding-bottom:5px;'> Sincerely </p>\n\n                                               <h5 style = 'margin:0; font-size:14px;  padding-bottom:5px;'> The $$CompanyName$$ Team</h5>\n\n                                              </td>\n\n                                                <td>\n\n                                                <div style = 'margin-right: 7px; text-align:right'>\n\n                                                                                                         </div></td>\n\n                                                                                                      </tr>\n\n                                                                                                    </tbody>\n\n                                                                                                  </table>\n\n                                                                                                          </td>\n\n                                                                                                      </tr>\n\n                                                                                                    </tbody>\n\n                                                                                                  </table>\n\n                                                                                                  <div class='clear'></div>\n            </div></td>\n        </tr>\n      </tbody>\n    </table>\n  </div>\n  <p style = 'font-family:arial; font-size:14px; padding-top:10px; text-align:center;'>� 2019-2020 All Rights Reserved | $$CompanyURL$$</p>\n</div>";

const noReply = () => config.app.NoReplyMail || 'noreply@clusteroffer.com';
const bccAddr = () => config.app.MailBccAddress || '';

function buildMessage({ from, SenderName, to, cc, bcc, subject, body }) {
  const msg = { subject, html: body };
  msg.from = SenderName === '' ? mailAddress(from) : mailAddress(from, SenderName);
  if (to !== '') msg.to = addrList(to);
  if (cc !== '') msg.cc = addrList(cc);
  if (bcc !== '') msg.bcc = addrList(bcc);
  mailAddress(from); // MailAddress ad = new MailAddress(from)
  return msg;
}

async function Send(plid, from, to, cc, bcc, subject, body, SenderName = '') {
  bcc = bccAddr();
  from = '';
  SenderName = 'Dealsinvicta';
  const username = CompanySettings.CompanyInfoEmailId;
  const pass = CompanySettings.CompanyMailPassword;
  const host = CompanySettings.CompanyMailServer;
  from = noReply();
  const Port = CompanySettings.CompanyMailServerPort;
  const message = buildMessage({ from, SenderName, to, cc, bcc, subject, body });
  return smtpSend({ host, port: Port, user: username, pass, message });
}

async function Send1(from, to, cc, bcc, subject, body, DID = 0, Type = '') {
  bcc = bccAddr();
  from = '';
  const SenderName = 'Dealsinvicta';
  // both branches of the legacy if (Type != "" && DID != 0) / else use the same company settings
  const username = CompanySettings.CompanyInfoEmailId;
  const pass = CompanySettings.CompanyMailPassword;
  const host = CompanySettings.CompanyMailServer;
  from = noReply();
  const Port = CompanySettings.CompanyMailServerPort;
  const message = buildMessage({ from, SenderName, to, cc, bcc, subject, body });
  return smtpSend({ host, port: Port, user: username, pass, message });
}

async function Sendemailwithattachment(from, to, cc, bcc, subject, attachment) {
  const username = CompanySettings.CompanyInfoEmailId;
  const pass = CompanySettings.CompanyMailPassword;
  const host = CompanySettings.CompanyMailServer;
  from = CompanySettings.CompanyInfoEmailId;
  // new MailMessage(CompanyInfoEmailId, to.Trim()) validates both addresses (exceptions propagate like the C#)
  mailAddress(CompanySettings.CompanyInfoEmailId);
  mailAddress(to.trim());
  let MyString = TPL_ATTACH;
  MyString = MyString.split('$$name$$').join(username);
  MyString = MyString.split('$$CompanyDomain$$').join(CompanySettings.CompanyDomain);
  MyString = MyString.split('$$CompanyURL$$').join(CompanySettings.CompanyURL);
  MyString = MyString.split('$$CompanyName$$').join(CompanySettings.CompanyName);
  MyString = MyString.split('$$CompanyResellerURL$$').join(CompanySettings.CompanyResellerURL);
  MyString = MyString.split('$$CompanySupportEmailId$$').join(CompanySettings.CompanySupportEmailId);
  MyString = MyString.split('$$Logo$$').join(CompanySettings.Logo);
  MyString = MyString.split('$$Atchment$$').join(attachment);
  const msg = { subject, html: MyString, from: mailAddress(from) };
  if (to !== '') msg.to = addrList(to);
  if (cc !== '') msg.cc = addrList(cc);
  if (bcc !== '') msg.bcc = addrList(bcc);
  const url = attachment;
  const paths = url.split(',');
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
  try {
    const UtilityClass = require('./UtilityClass');
    await UtilityClass.TrackError('5');
  } catch (e) { /* TrackError swallows its own errors */ }
  // SmtpClient(host): default port 25
  return smtpSend({ host, port: 25, user: username, pass, message: msg });
}

module.exports = { Send, Send1, Sendemailwithattachment };
