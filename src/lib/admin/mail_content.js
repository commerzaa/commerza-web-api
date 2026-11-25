/** Exports: class mail_content (table tbl_mail_contant_master; props int_mc_id, Title, MailType, Type, Subject, Message, status, dtm_date, dtm_update_date)
 *   async content_master() : mail_content[]  (status == 1, by Title)
 *   async content_master(int int_mc_id) : mail_content | null  (status == 1 && int_mc_id)
 *   async content_master(string mailType) : mail_content | null  (MailType == mailType)
 *     -- C# overloads: no argument => list; number => by id; string => by MailType
 * PORT-NOTE: Models/mail_content.cs is NOT included in Common.csproj (it references db._tbl_mail_contant_master, which DataBaseContext
 *   does not declare, so it was never compiled). Ported anyway against table tbl_mail_contant_master.
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('mail_content', 'tbl_mail_contant_master', { int_mc_id: 0, Title: null, MailType: null, Type: null, Subject: null, Message: null, status: 0, dtm_date: null, dtm_update_date: null });

class mail_content extends Base {
  async content_master(...args) {
    if (args.length === 0) {
      return Base.mapAll(await query(DB, 'select * from tbl_mail_contant_master where status=1 order by title'));
    }
    const a = args[0];
    if (typeof a === 'string') {
      const mailType = a;
      return Base.map(await queryOne(DB, 'select * from tbl_mail_contant_master where mailtype=@mailType limit 1', { mailType }));
    }
    const int_mc_id = a;
    return Base.map(await queryOne(DB, 'select * from tbl_mail_contant_master where status=1 and int_mc_id=@int_mc_id limit 1', { int_mc_id }));
  }
}

module.exports = mail_content;
