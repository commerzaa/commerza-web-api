'use strict';
/**
 * Port of Franchise\Controllers\HomeController.cs (Eblaa_Reseller.Controllers.HomeController)
 * Actions: Index, SaveResellerEnquiry (2)
 */
const express = require('express');
const router = express.Router();
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');

const DB = 'shopping'; // Franchise DataBaseContext => Db_Shopping (Web.config)

// public
router.all('/franchise/Home/Index{/:id}', asyncHandler(async (req, res) => {
  res.json({});
}));

// public
router.all('/franchise/Home/SaveResellerEnquiry{/:id}', asyncHandler(async (req, res) => {
  const { Name, businessname, Email, phonenumber, state, city, Messagae } = req.p;
  const source = 'Reseller Enquiry';
  await db.proc(DB, 'usp_Submit_Enquiry', {
    name: Name, email: Email, subject: businessname, message: Messagae, Type: 'Enquiry', replymsg: '', mode: 'Add', Mobile: phonenumber, city, state, Source: source,
  });
  // PORT-NOTE: legacy returned ExecuteSqlCommand's affected-row count as a string (SQL Server reports -1 for procedures using SET NOCOUNT ON), not the @strResult output.
  res.json('-1');
}));

module.exports = router;
