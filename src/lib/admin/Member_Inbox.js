/** Exports: class Member_Inbox (table member_inbox; props MsgId, MsgType, MsgSubject, FromRegNo, ToRegNo, MsgDate, Message, Activeflag, toAll, status, fileName, isread)
 *   Source Models/Member_Inbox.cs: plain C# model class(es), no methods. Each class: new X(init?), X.PROPS, X.TABLE, X.NOT_MAPPED, X.map(row), X.mapAll(rows) (see ./_models.js).
 */
'use strict';
const { defineModel } = require('./_models');

const Member_Inbox = defineModel('Member_Inbox', 'member_inbox', { MsgId: 0, MsgType: null, MsgSubject: null, FromRegNo: 0, ToRegNo: 0, MsgDate: null, Message: null, Activeflag: false, toAll: false, status: false, fileName: null, isread: 0 });

module.exports = Member_Inbox;
