'use strict';
// Ported from MLM_Adminpanel\Common\Controllers\AdminPanel\Add_Emp_InfoController.cs (namespace Common.Controllers.AdminPanel, class Add_Emp_InfoController)
// Database: none used.
const express = require('express');
const asyncHandler = require('../../middleware/asyncHandler');
const { view } = require('./_shared/batch02_common');

const router = express.Router();
const C = 'Add_Emp_Info';

// ---------------------------------------------------------------- Index()  => return View();
// public (legacy had no session check and no data)
router.all([`/admin/${C}/Index{/:id}`, `/admin/${C}`], asyncHandler(async (req, res) => view(res, '~/Views/Add_Emp_Info/Index.cshtml')));

module.exports = router;
