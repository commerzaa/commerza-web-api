/** Exports: Tbl_Password_Change_History, Tbl_Password_Change_History_Member - EF entity / SqlQuery<T> property bags from Models/Tbl_Password_Change_History.cs.
 *  { PROPS: [PascalCase property names for mapRows], TABLE: '<postgres table>' } (no methods in the C#). */
'use strict';

const Tbl_Password_Change_History = { PROPS: ['TPCHID', 'Plid', 'OldPassword', 'ResetLink', 'ChangeDate', 'IsLinkExpired'], TABLE: 'tbl_password_change_history' };
const Tbl_Password_Change_History_Member = { PROPS: ['TPCHID', 'Plid', 'OldPassword', 'ResetLink', 'ChangeDate', 'IsLinkExpired'], TABLE: 'tbl_password_change_history_member' };

module.exports = { ...Tbl_Password_Change_History, Tbl_Password_Change_History, Tbl_Password_Change_History_Member };
