/** Exports: class MailMessage_Master (table tbl_mailmaster; props MID, Title, Message, status, Active)
 *          class Tbl_Enquiry (table tbl_enquiry; props EId, Name, EmailId, Mobile, Subject, Message, EnqDate, Status, LastReplyMsg, LastReplyDate, Type, Source, Stateid, Cityid, Enquiry_type)
 *          class News_Event (table eventnews; props Newsid, News, NewsDate, activeFlag, type, Title)
 *   async MailMessage(string status) : MailMessage_Master | null  (status == status && Active)
 *   MailMessage_Master.Tbl_Enquiry, MailMessage_Master.News_Event : model classes (also ./Tbl_Enquiry, ./News_Event)
 */
'use strict';
const { queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('MailMessage_Master', 'tbl_mailmaster', { MID: 0, Title: null, Message: null, status: null, Active: false });
const Tbl_Enquiry = defineModel('Tbl_Enquiry', 'tbl_enquiry', { EId: 0, Name: null, EmailId: null, Mobile: null, Subject: null, Message: null, EnqDate: null, Status: 0, LastReplyMsg: null, LastReplyDate: null, Type: null, Source: null, Stateid: null, Cityid: null, Enquiry_type: null });
const News_Event = defineModel('News_Event', 'eventnews', { Newsid: 0, News: null, NewsDate: null, activeFlag: false, type: 0, Title: null });

class MailMessage_Master extends Base {
  async MailMessage(status) {
    return Base.map(await queryOne(DB, 'select * from tbl_mailmaster where status=@status and active::int=1 limit 1', { status }));
  }
}

module.exports = MailMessage_Master;
module.exports.Tbl_Enquiry = Tbl_Enquiry;
module.exports.News_Event = News_Event;
