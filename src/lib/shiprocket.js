'use strict';
const axios = require('axios');
const config = require('../config');

const BASE_URL = 'https://apiv2.shiprocket.in/v1/external';
let cachedToken = null;
let tokenExpiresAt = 0;

function isConfigured() {
  return Boolean(config.app.ShipRocketEmail && config.app.ShipRocketPassword);
}

async function getToken() {
  if (!isConfigured()) {
    throw new Error('Shiprocket credentials (SHIPROCKET_EMAIL / SHIPROCKET_PASSWORD) are not configured in backend .env');
  }
  if (cachedToken && Date.now() < tokenExpiresAt) return cachedToken;
  const { data } = await axios.post(`${BASE_URL}/auth/login`, {
    email: config.app.ShipRocketEmail,
    password: config.app.ShipRocketPassword,
  }, { timeout: 15000 });
  cachedToken = data.token;
  // Shiprocket tokens are valid ~10 days; refresh every 8 days
  tokenExpiresAt = Date.now() + 8 * 24 * 60 * 60 * 1000;
  return cachedToken;
}

async function createAdhocOrder(payload) {
  const token = await getToken();
  const { data } = await axios.post(`${BASE_URL}/orders/create/adhoc`, payload, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 20000,
  });
  return data;
}

async function assignAwb(shipmentId) {
  const token = await getToken();
  const { data } = await axios.post(`${BASE_URL}/courier/assign/awb`, { shipment_id: shipmentId }, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 20000,
  });
  return data;
}

async function trackByAwb(awb) {
  const token = await getToken();
  const { data } = await axios.get(`${BASE_URL}/courier/track/awb/${encodeURIComponent(awb)}`, {
    headers: { Authorization: `Bearer ${token}` },
    timeout: 15000,
  });
  return data;
}

module.exports = { isConfigured, getToken, createAdhocOrder, assignAwb, trackByAwb };
