'use strict';
// Ported from Shoping Portal Merchant Panel\Controllers\CustomerPanel\getcp_requestController.cs  - DB: shopping (Db_Shopping)
// The C# had no [SessionExpireCheck] but dereferences ((Login)Session["plid"]).Plid (NullReference when logged out) => auth.
const express = require('express');
const db = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRow } = require('../../utils/shape');
const CustomEncriptionAndDecription = require('../../lib/merchant/CustomEncriptionAndDecription');

const router = express.Router();
const DB = 'shopping';
const P = '/merchant/getcp_request';

// Index()
async function Index(req, res) {
  const Plid = Number(req.user.plid);
  const _encry = new CustomEncriptionAndDecription();
  const TotalAvaliableCP = 0;
  const ViewBag = { TotalCPPoint: null };
  const _merchantdetails = mapRow(
    await db.queryOne(DB, 'SELECT coalesce(available_fund,0) AS available_fund, pmid, companyname FROM portal_master WHERE plid=@plid LIMIT 1', { plid: Plid }),
    ['Available_FUND', 'PMID', 'COMPANYNAME'],
  );
  ViewBag.TotalCPPoint = TotalAvaliableCP;
  if (_merchantdetails == null) throw new TypeError('Object reference not set to an instance of an object.'); // _merchantdetails.COMPANYNAME
  ViewBag.merchantInfo = (await _encry.encryption(String(Plid))) + '|' + (_merchantdetails.COMPANYNAME == null ? '' : _merchantdetails.COMPANYNAME);
  res.json(ViewBag);
}

// auth
router.all(`${P}/Index{/:id}`, auth, asyncHandler(Index));
// auth  route-config: merchant/getcp-requestqr -> getcp_request/Index
router.all('/merchant/merchant/getcp-requestqr{/:id}', auth, asyncHandler(Index));

module.exports = router;
