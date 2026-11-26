'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\PackageDeliverySlip.cs (class PackageDeliverySlipController, no namespace
// => /admin/PackageDeliverySlip/...). Database: affiliate (Db_Affiliate). Proc USP_COURIERDELIVERYSTATUS (MODE 3).
const express = require('express');
const db = require('../../db');
const asyncHandler = require('../../middleware/asyncHandler');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/admin/UtilityClass');
const { cvtInt, qs } = require('./_shared/batch06-common');
const { PACKAGE_DELIVERY_SLIP_PROPS } = require('./_shared/batch13-01-common');

const router = express.Router();
const DB = 'affiliate';
const C = 'PackageDeliverySlip';

// ---------------------------------------------------------------- ActionResult Index()
// public (legacy had no session check; returns the empty view only)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], asyncHandler(async (req, res) => {
  res.json({ view: '~/Views/AdminPanel/PackageDeliverySlip/Index.cshtml' });
}));

// ---------------------------------------------------------------- ActionResult InvicesPrintable()
// public (legacy had no session check: printable slip addressed by the encrypted CSID query value)
// route-config: "AdminPanel/PackageDeliverySlip" -> PackageDeliverySlip/InvicesPrintable
router.all([`/admin/${C}/InvicesPrintable{/:id}`, '/admin/AdminPanel/PackageDeliverySlip'], asyncHandler(async (req, res) => {
  const CSID = qs(req, 'CSID'); // Request.QueryString["CSID"]
  if (CSID === null) {
    return res.json({ redirect: '/Home/Index' }); // RedirectToAction("Index", "Home")
  }
  const DecryptId = await UtilityClass.Decryptword(CSID);
  // dbo.USP_COURIERDELIVERYSTATUS @CSID,@SENDTYPE,@USERNAME,@MOBILE,@EMAILID,@ADDRESS,@REMARK,@SENDATE,@CMID,@DOCKETNO,@PRODUCTCODE,@PACKAGEID,
  //   @RESULT OUT,@ProductName,@Name,@Shipment_Address,@Sid,@Cid,@Pincode,@DeliveryDate,@MODE
  const PrintPackageSlip = mapRows(await db.proc(DB, 'USP_COURIERDELIVERYSTATUS', {
    CSID: cvtInt(DecryptId), SENDTYPE: '0', MOBILE: '', USERNAME: '', EMAILID: '', REMARK: '', ADDRESS: '', SENDATE: '', CMID: '0', DOCKETNO: '',
    PRODUCTCODE: '', PACKAGEID: '0', ProductName: '', Name: '', Shipment_Address: '', Sid: '0', Cid: '0', Pincode: '', DeliveryDate: '',
    MODE: cvtInt('3'),
  }), PACKAGE_DELIVERY_SLIP_PROPS);
  return res.json({ view: '~/Views/AdminPanel/PackageDeliverySlip/Invoices.cshtml', Model: PrintPackageSlip });
}));

module.exports = router;
