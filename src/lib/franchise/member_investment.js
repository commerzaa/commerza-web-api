/** Exports: class Ticket_Details (table tbl_ticketmaster; defined in Models/member_investment.cs; props ticketno, status)
 *   async GetMemberInvestmentDetail(string TicketNO) : Ticket_Details | null  (ticketno == TicketNO)
 */
'use strict';
const { queryOne } = require('../../db');
const { mapRow } = require('../../utils/shape');

class Ticket_Details {
  async GetMemberInvestmentDetail(TicketNO) {
    return mapRow(await queryOne('shopping', 'select * from tbl_ticketmaster where ticketno=@TicketNO limit 1', { TicketNO }), ['ticketno', 'status']);
  }
}

module.exports = Ticket_Details;
module.exports.Ticket_Details = Ticket_Details;
