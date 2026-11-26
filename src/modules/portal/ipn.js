// Ported from ClusterofferShopingPortal/Controllers/IPNController.cs
'use strict';
/**
 * IPNController : ApiController (Web API, not MVC). DB: DataBaseContext = Db_Shopping => 'shopping'.
 * Only route in legacy: App_Start/WebApiConfig.cs "api/auto-recharge-ipn" -> IPN/GETIPNDETAILS ([HttpGet, HttpPost]).
 * The default "api/{controller}/{id}" route was commented out and MVC routing does not dispatch to ApiControllers.
 * The commented GETIPNDETAILS(Did, TokenId) overload is not ported (commented out in legacy).
 */
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { pget } = require('./_shared/batch-21-common');

const DB = 'shopping';
const router = express.Router();
const PARAMS = ['reqid', 'status', 'remark', 'balance', 'mn', 'field1', 'ec'];

function ipnParameter(v) {
  return 'reqid=' + v.reqid + '&status=' + v.status + '&remark=' + v.remark + '&balance=' + v.balance + '&mn=' + v.mn + '&field1=' + v.field1 + '&ec=' + v.ec + '';
}

async function GETIPNDETAILS(req, res) {
  // Web API binds simple types from the URI (query string / route) only.
  const q = req.query || {};
  // PORT-NOTE: Web API action selection required every (non-optional) parameter to be present in the URI; a request missing one
  //   got the standard 404 "No action was found" response. Reproduced below.
  for (const n of PARAMS) {
    if (pget(q, n) === undefined) {
      return res.status(404).json({
        Message: `No HTTP resource was found that matches the request URI '${req.protocol}://${req.get('host')}${req.originalUrl}'.`,
        MessageDetail: "No action was found on the controller 'IPN' that matches the request.",
      });
    }
  }
  // empty query values bind as null in Web API; the legacy null checks then turn them into ""
  const v = {};
  for (const n of PARAMS) {
    let x = pget(q, n);
    if (Array.isArray(x)) x = x.join(',');
    v[n] = x === null || x === undefined || x === '' ? null : String(x);
  }
  let IPNParameterGivenByAPI = '';
  try {
    for (const n of PARAMS) if (v[n] == null) v[n] = '';
    IPNParameterGivenByAPI = ipnParameter(v);
    const row = await db.procOne(DB, 'usp_instantipnnotification', {
      reqid: v.reqid.trim(), status: v.status.trim(), remark: v.remark.trim(), balance: v.balance.trim(),
      mn: v.mn.trim(), field1: v.field1.trim(), ec: v.ec.trim(),
    });
    // Param[7].Value.ToString() (@STROUTPUT OUT, returned as a column)
    let out = null;
    if (row) { const k = Object.keys(row).find((x) => x.toLowerCase() === 'stroutput'); out = k === undefined ? null : row[k]; }
    const flag = (out === null || out === undefined ? '' : String(out)).trim(); // DBNull.ToString() => ''
    if (flag === 'success') {
      return res.json({ Flag: 'success', Message: 'API Response Received', IPNParameter: IPNParameterGivenByAPI, ExceptionMessage: '' });
    }
    return res.json({ Flag: flag, Message: 'API Response Received', IPNParameter: IPNParameterGivenByAPI, ExceptionMessage: '' });
  } catch (EX) {
    for (const n of PARAMS) if (v[n] == null) v[n] = '';
    IPNParameterGivenByAPI = ipnParameter(v);
    return res.json({ Flag: 'error', Message: EX.message, IPNParameter: IPNParameterGivenByAPI, ExceptionMessage: EX.message });
  }
}

// public (recharge API IPN callback, no session in legacy)
// route-config: WebApiConfig "api/auto-recharge-ipn" -> IPN/GETIPNDETAILS
// PORT-NOTE: '/portal/IPN/GETIPNDETAILS' is an extra alias (legacy only exposed api/auto-recharge-ipn).
router.route(['/portal/api/auto-recharge-ipn', '/portal/IPN/GETIPNDETAILS{/:id}'])
  .get(asyncHandler(GETIPNDETAILS))
  .post(asyncHandler(GETIPNDETAILS));

module.exports = router;
