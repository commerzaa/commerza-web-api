'use strict';
/** Ported from Member\Common\Controllers\SessionCheckController.cs (SessionCheckController)
 *  The SessionExpireCheck ActionFilterAttribute (OnActionExecuting: Session["Plid"]==null => redirect "~/") is not an action;
 *  it is replaced by the `auth` middleware on every protected route (not routed here).
 */
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');

const router = express.Router();
const P = '/member/SessionCheck';

// public (no session check in legacy; view only)
router.all([`${P}/Index{/:id}`, P], asyncHandler(async (req, res) => {
  res.json({});
}));

module.exports = router;
