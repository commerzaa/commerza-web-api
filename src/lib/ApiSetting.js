/** Exports (instance class, all methods async): class ApiSetting { Create(TITLE, EMAIL, HOSTNAME, PORT, PASSWORD, CHECK: bool, Plid: Int64, SenderID, SenderName): string; Modify(TEMID: int, TITLE, EMAIL, HOSTNAME, PORT, PASSWORD, CHECK: bool, Plid: Int64, SenderID, SenderName): string } */
'use strict';
const { procOne } = require('../db');
const { outValue } = require('./_http');

// PORT-NOTE: USP_API_SETTING / USP_API_SETTING_MODIFY exist in the Db_Shopping schema dump only (legacy DataBaseContext pointed at Db_Affiliate); 'shopping' is used so the objects resolve.
class ApiSetting {
  async Create(TITLE, EMAIL, HOSTNAME, PORT, PASSWORD, CHECK, Plid, SenderID, SenderName) {
    const row = await procOne('shopping', 'usp_api_setting', {
      plid: Plid, email: EMAIL, hostname: HOSTNAME, port: PORT, password: PASSWORD, title: TITLE,
      check: CHECK ? 1 : 0, senderid: SenderID, sendername: SenderName,
    });
    return outValue(row, 'Message'); // @Message OUT
  }

  async Modify(TEMID, TITLE, EMAIL, HOSTNAME, PORT, PASSWORD, CHECK, Plid, SenderID, SenderName) {
    const row = await procOne('shopping', 'usp_api_setting_modify', {
      temid: TEMID, plid: Plid, email: EMAIL, hostname: HOSTNAME, port: PORT, password: PASSWORD, title: TITLE,
      check: CHECK ? 1 : 0, senderid: SenderID, sendername: SenderName,
    });
    return outValue(row, 'Message');
  }
}

module.exports = ApiSetting;
