/**
 * Exports: class PushNotificationRepo { async sendPushnotification(_model: pushNotificationmoel): string; async NotificationMarking(string type, int sprid = 0): void }
 * pushNotificationmoel = { Token, sendtype, Title, body, subtitle, icon, sound, clickaction, key_1, key_2 }
 * PORT-NOTE: RestSharp POST of the JObject body to AppSettings NotificationAPI => axios.post (JSON); response status is not checked (RestSharp does not throw);
 *   the response body is then parsed with JavaScriptSerializer.Deserialize in legacy (result unused) - an unparsable / empty body throws, reproduced with JSON.parse.
 * PORT-NOTE: legacy built the SQL by string concatenation with sprid; here it is a bound @sprid parameter (identical result).
 * Config keys: NotificationAPI, CompanyDomain.
 */
'use strict';
const axios = require('axios');
const config = require('../../config');
const db = require('../../db');

class PushNotificationRepo {
  async sendPushnotification(_model) {
    const url = (config.app || {}).NotificationAPI || '';
    const response = await axios.post(url, JSON.stringify(_model), {
      headers: { 'Content-Type': 'application/json' },
      validateStatus: () => true,
      responseType: 'text',
      transformResponse: [(d) => d],
      timeout: 100000,
    });
    const res = response.data;
    if (res === null || res === undefined) throw new Error('Value cannot be null.');
    JSON.parse(res); // serializer.Deserialize<dynamic>(res) (result unused)
    return '';
  }

  async NotificationMarking(type, sprid = 0) {
    const pushNotificationmoel = {};
    if (String(type).toLowerCase() === 'product') {
      const product = await db.queryOne('shopping',
        `select imp.producttitle, isp.productimages, coalesce((pl.fname || pl.lname), '''') as merchantname
           from ims_subproduct isp
          inner join ims_masterproduct imp on imp.mprid = isp.mprid
           left join portal_login pl on pl.plid = imp.branchid
          where isp.sprid = @sprid limit 1`, { sprid });
      if (product === null || product === undefined) throw new TypeError('Object reference not set to an instance of an object.');
      const image = String(product.productimages).split('^');
      const baseUrl = String((config.app || {}).CompanyDomain || '');
      const productImage = baseUrl + 'Product_Images/' + image[0];
      const message = 'A new product ' + product.producttitle + ' has been added by ' + product.merchantname + '. Tap to view product details.';

      pushNotificationmoel.Token = '';
      pushNotificationmoel.sendtype = 'all';
      pushNotificationmoel.Title = 'New Product Arrival';
      pushNotificationmoel.body = message;
      pushNotificationmoel.subtitle = '';
      pushNotificationmoel.icon = productImage === '' ? 'https://member.clusteroffer.com/images/Admin-1.png' : productImage;
      pushNotificationmoel.sound = 'default';
      pushNotificationmoel.clickaction = 'https://clusteroffer.com/';
      pushNotificationmoel.key_1 = String(sprid);
      pushNotificationmoel.key_2 = 'https://clusteroffer.com/';
      await this.sendPushnotification(pushNotificationmoel);
    }
  }
}

module.exports = PushNotificationRepo;
