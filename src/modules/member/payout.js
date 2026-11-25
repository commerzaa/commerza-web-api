'use strict';
/**
 * Ported from Member\Common\Controllers\CustomerPanel\Payout.cs.
 * The C# file is NOT a controller: it only declares the entity class `Payout` ([Table("dbo.Payout")]) with the helper methods
 * GetCurrentPayoutDate / CheckValidPayDate / Getpayoutlist. No MVC action exists, so no route is registered.
 * The helper methods are ported and exposed as properties of the exported router (router.GetCurrentPayoutDate, ...) for other modules.
 */
const express = require('express');
const { query, queryOne } = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/member/UtilityClass');

const router = express.Router();
const DB = 'affiliate';
const PAYOUT_PROPS = ['payID', 'paydate', 'payfrom', 'payto', 'NewMembers', 'PayoutAmount', 'Tds', 'AdminCharge', 'acitve'];

async function GetCurrentPayoutDate() {
  let LastPayDate;
  const row = await queryOne(DB, 'select payto from payout order by payid desc limit 1');
  if (row != null) {
    LastPayDate = new Date(row.payto);
  } else {
    const row2 = await queryOne(DB, 'select regdate from member_master order by regno limit 1');
    LastPayDate = new Date(row2.regdate); // row2 null => TypeError (legacy NullReferenceException)
  }
  LastPayDate.setDate(LastPayDate.getDate() + 7);
  return LastPayDate;
}

async function CheckValidPayDate() {
  const Current = new Date(await UtilityClass.GetDatabaseDate());
  const PayoutDate = await GetCurrentPayoutDate();
  return Current > PayoutDate;
}

async function Getpayoutlist() {
  const rows = await query(DB, 'select * from payout where acitve = 1 order by payid desc');
  return mapRows(rows, PAYOUT_PROPS);
}

router.GetCurrentPayoutDate = GetCurrentPayoutDate;
router.CheckValidPayDate = CheckValidPayDate;
router.Getpayoutlist = Getpayoutlist;

module.exports = router;
