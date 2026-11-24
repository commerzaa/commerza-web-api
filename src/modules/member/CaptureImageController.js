'use strict';
// Ported from Member\Controllers\CaptureImageController.cs (3 actions)
const express = require('express');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const config = require('../../config');
const { optionalAuth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const sessionStore = require('../../utils/sessionStore');

const P = '/member/CaptureImage';
const two = (n) => String(n).padStart(2, '0');
// .NET Server.UrlEncode
const urlEncode = (s) => encodeURIComponent(s).replace(/%20/g, '+').replace(/'/g, '%27').replace(/~/g, '%7e');
function ConvertHexToBytes(hex) { // private static helper (not an action)
  if (hex.length % 2 !== 0) throw new Error('Index was outside the bounds of the array.');
  const bytes = Buffer.alloc(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    const h = hex.substr(i, 2);
    if (!/^[0-9a-fA-F]{2}$/.test(h)) throw new Error('Could not find any recognizable digits.');
    bytes[i / 2] = parseInt(h, 16);
  }
  return bytes;
}
const rawBody = express.text({ type: () => true, limit: '50mb' });

// public (legacy had no session check)
// route-config: capture-image -> Index
router.all([P + '/Index{/:id}', '/member/capture-image'], optionalAuth, asyncHandler(async (req, res) => {
  sessionStore.set(req, 'CapturedImage', '');
  res.json({});
}));

// public (legacy had no session check)
router.post(P + '/Capture{/:id}', optionalAuth, rawBody, asyncHandler(async (req, res) => {
  let body = req.body;
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  else if (body && typeof body === 'object') body = Object.keys(body).length ? JSON.stringify(body) : '';
  body = typeof body === 'string' ? body : '';
  if (body.length > 0) {
    const hexString = urlEncode(body);
    const d = new Date();
    const h12 = d.getHours() % 12 === 0 ? 12 : d.getHours() % 12;
    const imageName = `${two(d.getDate())}-${two(d.getMonth() + 1)}-${two(d.getFullYear() % 100)} ${two(h12)}-${two(d.getMinutes())}-${two(d.getSeconds())}`;
    const dir = path.join(config.uploadDir, 'Captures');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, imageName + '.png'), ConvertHexToBytes(hexString));
    sessionStore.set(req, 'CapturedImage', `/Captures/${imageName}.png`); // VirtualPathUtility.ToAbsolute
  }
  res.json({});
}));

// public (legacy had no session check)
router.post(P + '/GetCapture{/:id}', optionalAuth, asyncHandler(async (req, res) => {
  const v = sessionStore.get(req, 'CapturedImage');
  if (v === undefined || v === null) throw new Error('Object reference not set to an instance of an object.');
  sessionStore.set(req, 'CapturedImage', null);
  res.type('text/plain').send(String(v));
}));

module.exports = router;
