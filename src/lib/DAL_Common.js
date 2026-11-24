'use strict';
/**
 * Exports: class DAL_Common { async Direct_List1(string LoginID): Direct_List_Ddl[]; async Direct_List(string LoginID): managerDirect[];
 *   static async check_For_Popup(Int64 Regno): bool; static async ValidateUser(string PLID): string }
 */
const db = require('../db');

const managerDirect = ['loginid', 'email'];

class DAL_Common {
  async Direct_List1(LoginID) {
    const query = await db.query('affiliate', 'select emailid, loginid, leftid from member_master where sponserid = @LoginID', { LoginID });
    const li = [];
    for (const item of query) {
      const obj = { Name: null, LoginID: null, MID: 0 };
      obj.Name = item.emailid;
      obj.LoginID = item.loginid;
      obj.LoginID = item.leftid; // Change MID
      li.push(obj);
    }
    return li;
  }

  async Direct_List(LoginID) {
    let li = [];
    try {
      const checkmanager = await db.queryOne('affiliate', 'select loginid from member_master where loginid = @LoginID limit 1', { LoginID });
      if (checkmanager !== null) {
        const rows = await db.proc('affiliate', 'usp_directmamagemeber', { loginid: LoginID });
        li = rows.map((r) => ({ loginid: r.loginid === undefined ? null : r.loginid, email: r.email === undefined ? null : r.email }));
      } else {
        li = [];
      }
    } catch (ex) {
      // legacy swallowed all errors
    }
    return li;
  }

  static async check_For_Popup(Regno) {
    const rows = await db.proc('affiliate', 'usp_check_for_popup', { regno: Regno });
    const first = rows[0];
    const str = first ? first[Object.keys(first)[0]] : null;
    return str === 'yes';
  }

  static async ValidateUser(PLID) {
    const v = await db.scalar('affiliate', 'select loginid from member_master where regno = @PLID limit 1', { PLID });
    return v === undefined ? null : v;
  }
}

DAL_Common.managerDirect = managerDirect;
module.exports = DAL_Common;
