/** Exports: class Member_Master (table member_master; props regNo, LoginId, kycstatus, userName, sponserID, dob, FName, KycComment, MName, LName, gender, KYCStatus, address, cid, sid, ctid, pincode, cityName, mobile, Emailid, ImageName, KID, Regdate, DOC, introRegNo, parentRegNo, panNo, Active, status, LeftID, RightID, rootID, FullName, FullNameID, MarriageAnniversary ; [NotMapped] FullName, FullNameID)
 *   static async Bank_Accounts(Int64 regNo) : Member_Master[]  (regNo == regNo)
 *   async Client_List() : Member_Master[]  (Active && status, regNo desc; only regNo, LoginId, Emailid, mobile, address, introRegNo,
 *         parentRegNo, Regdate, FullName = "FName MName LName" (trimmed parts), FullNameID = "LoginId - FullName" are filled)
 */
'use strict';
const { query } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Member_Master', 'member_master', { regNo: 0, LoginId: null, kycstatus: null, userName: null, sponserID: null, dob: null, FName: null, KycComment: null, MName: null, LName: null, gender: false, KYCStatus: false, address: null, cid: 0, sid: 0, ctid: 0, pincode: null, cityName: null, mobile: null, Emailid: null, ImageName: null, KID: 0, Regdate: null, DOC: null, introRegNo: 0, parentRegNo: null, panNo: null, Active: false, status: false, LeftID: null, RightID: null, rootID: null, FullName: null, FullNameID: null, MarriageAnniversary: null }, ['FullName', 'FullNameID']);

class Member_Master extends Base {
  static async Bank_Accounts(regNo) {
    return Base.mapAll(await query(DB, 'select * from member_master where regno=@regNo', { regNo }));
  }

  async Client_List() {
    const li = [];
    const rows = Base.mapAll(await query(DB, 'select * from member_master where active::int=1 and status::int=1 order by regno desc'));
    for (const item of rows) {
      const obj = new Member_Master();
      obj.regNo = item.regNo;
      obj.LoginId = item.LoginId;
      obj.Emailid = item.Emailid;
      obj.mobile = item.mobile;
      obj.address = item.address;
      obj.introRegNo = item.introRegNo;
      obj.parentRegNo = item.parentRegNo;
      obj.Regdate = item.Regdate;
      // legacy: NullReferenceException when FName/MName/LName is NULL (same here: TypeError)
      obj.FullName = item.FName.trim() + ' ' + item.MName.trim() + ' ' + item.LName.trim();
      obj.FullNameID = item.LoginId + ' - ' + item.FName.trim() + ' ' + item.MName.trim() + ' ' + item.LName.trim();
      li.push(obj);
    }
    return li;
  }
}

module.exports = Member_Master;
