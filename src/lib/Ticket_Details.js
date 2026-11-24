/** Exports: class Ticket_Details (table tbl_ticketmaster)   async GetMemberInvestmentDetail(int TMID) : Ticket_Details | null */
'use strict';
const { queryOne } = require('../db');
const { mapRow } = require('../utils/shape');

const PROPS = ['TMID', 'ticketno', 'status', 'isattend', 'CATEGORYNAME', 'MESSAGE', 'DATE', 'LASTUPDATE', 'SUBJECT', 'TMIMAGE', 'ACTIVE'];

class Ticket_Details {
  async GetMemberInvestmentDetail(TMID) {
    return mapRow(await queryOne('affiliate', 'select * from tbl_ticketmaster where tmid=@TMID limit 1', { TMID }), PROPS);
  }
}

module.exports = Ticket_Details;
