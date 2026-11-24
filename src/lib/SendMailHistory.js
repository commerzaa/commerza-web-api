'use strict';
/**
 * Exports: SENDMAILHISTORY, CustomizedSendMailHistory (plain property bags; legacy C# model classes, no code)
 *   Table: DBO.TBL_SENDMAILHISTORY (SENDMAILHISTORY)
 */
const bag = (defaults) => class { constructor(init) { Object.assign(this, defaults, init); } };

const SENDMAILHISTORY = bag({
  SMID: 0, PLID: 0, FROMEMAIL: null, TOEMAIL: null, SENDDATE: null, SUBJECT: null, BODY: null,
  ISACTIVE: 0, ISDELETED: 0, ATTACHMENT: null, MAILTYPE: null,
});

const CustomizedSendMailHistory = bag({
  SMID: 0, PLID: 0, FROMEMAIL: 0, TOEMAIL: null, Attachment: null, SENDDATE: null, SUBJECT: null, BODY: null,
  ISACTIVE: 0, ISDELETED: 0, MAILTYPE: null, CampaignName: null, CampaignDate: null, CampaignTime: null,
  IsMailSend: 0, CreatedDate: null,
});

module.exports = { SENDMAILHISTORY, CustomizedSendMailHistory };
