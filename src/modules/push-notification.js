'use strict';
/** Port of Controllers/MemberPanelCntrl/PushNotificationController.cs (1 route). */
const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const PushNotificationRepo = require('../lib/PushNotificationRepo');

const router = express.Router();
const npe = () => new TypeError('Object reference not set to an instance of an object.');

// legacy model pushNotificationmoel (case-insensitive JSON binding)
function bindModel(body) {
  const b = body && typeof body === 'object' && !Array.isArray(body) ? body : {};
  const lower = {};
  for (const k of Object.keys(b)) lower[k.toLowerCase()] = b[k];
  const g = (k) => (k.toLowerCase() in lower && lower[k.toLowerCase()] !== undefined ? lower[k.toLowerCase()] : null);
  return {
    Token: g('Token'), sendtype: g('sendtype'), Title: g('Title'), body: g('body'), subtitle: g('subtitle'),
    icon: g('icon'), sound: g('sound'), clickaction: g('clickaction'), key_1: g('key_1'), key_2: g('key_2'),
  };
}

// public (legacy has no auth; sends push notifications - consider restricting to admin callers)
router.post('/api/SendpushNotification', asyncHandler(async (req, res) => {
  try {
    const _model = bindModel(req.body);
    const hasToken = _model.Token !== null && _model.Token !== undefined && _model.Token !== '';
    if (hasToken && (() => { if (_model.sendtype == null) throw npe(); return String(_model.sendtype).toUpperCase() !== 'ALL'; })()) {
      // PORT-NOTE: legacy sendnotification is `async void` (fire-and-forget, exceptions not observed by the controller)
      Promise.resolve(PushNotificationRepo.sendnotification(_model)).catch((e) => console.error('sendnotification', e.message));
    } else {
      if (_model.sendtype == null) throw npe();
      if (String(_model.sendtype).toUpperCase() === 'ALL') {
        const data = await PushNotificationRepo.GetTokes();
        _model.Token = data.join(',');
        if (data.length > 0) await PushNotificationRepo.SendFcmMessage(_model);
      }
    }
    return res.json({ status: 'true', message: 'Send Successfully' });
  } catch (ex) {
    return res.json({ status: 'false', message: ex.message });
  }
}));

module.exports = router;
