'use strict';
/** Port of Controllers/SchedulerController.cs (1 route, public / cron). */
const crypto = require('crypto');
const express = require('express');
const asyncHandler = require('../middleware/asyncHandler');
const SchedulerData = require('../lib/SchedulerData');

const router = express.Router();

// Optional shared secret: enforced ONLY when env SCHEDULER_KEY is set (otherwise open like the legacy endpoint).
function schedulerKey(req, res, next) {
  const expected = process.env.SCHEDULER_KEY;
  if (!expected) return next();
  const got = String(req.headers['x-scheduler-key'] || '');
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
  return res.status(401).json({ Status: false, Message: 'Unauthorized' });
}

// public (cron) - no verb attribute in legacy => all verbs
router.all('/api/AutoPayout', schedulerKey, asyncHandler(async (req, res) => {
  const repo = typeof SchedulerData === 'function' ? new SchedulerData() : SchedulerData; // legacy: instance class
  const status = await repo.AutoPayout();
  if (status) return res.json({ Status: true, Message: 'Success' });
  return res.json({ Status: false, Message: 'Something went wrong' });
}));

module.exports = router;
