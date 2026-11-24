'use strict';
/**
 * Exports: SendSms, CustomisedSendSms (plain property bags; legacy C# model classes, no code)
 *   Table: DBO.MSG_HISTORY (SendSms)
 */
const bag = (defaults) => class { constructor(init) { Object.assign(this, defaults, init); } };

const SendSms = bag({
  MsgId: 0, Plid: 0, FromMobile: null, ToMobile: null, MsgDate: null, Message: null, MsgType: null, status: 0,
});

const CustomisedSendSms = bag({
  MsgId: 0, SmsFromPlid: 0, FromMobile: null, ToMobile: null, MsgDate: null, Message: null, MsgType: null, status: 0,
  CampaignName: null, CampaignDate: null, CampaignTime: null, CreatedDate: null, TSCMID: 0, IsSmsSent: 0, plid: 0,
});

module.exports = { SendSms, CustomisedSendSms };
