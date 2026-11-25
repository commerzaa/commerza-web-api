'use strict';
/**
 * Helpers private to admin port batch12 (worker B) (not a router; lives in _shared/ so src/modules/admin.js does not mount it).
 * Exports: gaCheck(empId, GAKEY), dynPaging(v), sv0(v), cfgInt16(key)
 */
const config = require('../../../config');
const Admin_Security_Key = require('../../../lib/admin/Admin_Security_Key');
const { cvtInt } = require('./batch12_common');

/**
 * Legacy Google-Authenticator block used by the fund-transfer JSON actions:
 *   gaObj = Get_Security_Key(Emp_ID); if (gaObj != null) { if (GAKEY == "") return "Error^Enter your GA Key."; }
 *   objs = Get_Security_Key(Emp_ID); if (objs != null) { if (!objs.Check_GaKeyForEnableTime(Emp_ID, objs.Get_GA_Key(Emp_ID), GAKEY))
 *     if (GAKEY != "") return "Error^Invalid GA Key. Please enter a valid GA Key."; }
 * Returns the error string to reply with, or null to continue.
 * PORT-NOTE: MVC binds "" as null, so `GAKEY == ""` rarely fires and a missing GA key falls through to "Invalid GA Key" (as in legacy).
 */
async function gaCheck(empId, GAKEY) {
  let IsGoogleAuthenticated = '';
  const gaObj = await new Admin_Security_Key().Get_Security_Key(empId);
  if (gaObj !== null && gaObj !== undefined) {
    IsGoogleAuthenticated = '1';
    if (GAKEY === '') return 'Error^Enter your GA Key.';
  } else {
    IsGoogleAuthenticated = '0';
  }
  if (IsGoogleAuthenticated !== '0') {
    const objs = await new Admin_Security_Key().Get_Security_Key(empId);
    if (objs !== null && objs !== undefined) {
      const ValidRandomNo = await objs.Get_GA_Key(empId);
      if (!(await objs.Check_GaKeyForEnableTime(empId, ValidRandomNo, GAKEY))) {
        if (GAKEY !== '') return 'Error^Invalid GA Key. Please enter a valid GA Key.';
      }
    }
  }
  return null;
}

/** Convert.ToInt16(ConfigurationManager.AppSettings[key]) (missing => 0, invalid => FormatException) */
const cfgInt16 = (key) => cvtInt(config.app[key] === undefined ? null : config.app[key]);

module.exports = { gaCheck, cfgInt16 };
