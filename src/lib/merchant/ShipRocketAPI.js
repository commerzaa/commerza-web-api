/**
 * Exports: class ShipRocketAPI { async CreateOrder(_model: object[]): string }   (private Authentication() is internal)
 * PORT-NOTE: the Shiprocket login e-mail / password were hard coded in the C# (not copied): config.app.ShipRocketEmail / config.app.ShipRocketPassword.
 * PORT-NOTE: RestSharp does not throw on HTTP errors; response bodies are parsed as JSON regardless of status (JSON.parse throws like JavaScriptSerializer on bad bodies).
 * PORT-NOTE: Authorization header is "Bearer" + token WITHOUT a space - legacy typo preserved.
 */
'use strict';
const axios = require('axios');
const config = require('../../config');

const raw = { validateStatus: () => true, responseType: 'text', transformResponse: [(d) => d], timeout: 100000 };

class ShipRocketAPI {
  async Authentication() {
    const body = new URLSearchParams({
      email: String((config.app || {}).ShipRocketEmail || ''),
      password: String((config.app || {}).ShipRocketPassword || ''),
    }).toString();
    const response = await axios.post('https://apiv2.shiprocket.in/v1/external/auth/login', body, {
      ...raw, headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    const res = response.data;
    if (res === null || res === undefined) throw new Error('Value cannot be null.');
    return JSON.parse(res);
  }

  async CreateOrder(_model) {
    let message = '';
    const getAuthentication = await this.Authentication();
    if (!Object.prototype.hasOwnProperty.call(getAuthentication, 'token')) throw new Error('The given key was not present in the dictionary.');
    const token = getAuthentication.token;

    let body = JSON.stringify(_model);
    body = body.substring(1);                    // body.Remove(0, 1)
    body = body.substring(0, body.length - 1);   // body.Remove(body.Length - 1, 1)
    const jsonbody = JSON.parse(body);           // JObject.Parse(body)

    const response = await axios.post('https://apiv2.shiprocket.in/v1/external/orders/create/adhoc', JSON.stringify(jsonbody), {
      ...raw,
      headers: { Authorization: 'Bearer' + token, 'Content-Type': 'application/json' },
    });
    const res = response.data;
    if (res === null || res === undefined) throw new Error('Value cannot be null.');
    const jsonObject = JSON.parse(res);
    if (!Object.prototype.hasOwnProperty.call(jsonObject, 'status_code')) throw new Error('The given key was not present in the dictionary.');
    const status = jsonObject.status_code;
    if (status === 1) {
      message = 'true';
    } else {
      if (!Object.prototype.hasOwnProperty.call(jsonObject, 'message')) throw new Error('The given key was not present in the dictionary.');
      message = jsonObject.message;
    }
    return message;
  }
}

module.exports = ShipRocketAPI;
