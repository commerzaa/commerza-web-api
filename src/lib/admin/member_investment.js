/** Exports: class Ticket_Details (table tbl_ticketmaster; props ticketno, status, isattend)
 *   (file Models/member_investment.cs, class Ticket_Details; also available as ./Ticket_Details)
 *   async GetMemberInvestmentDetail(string TicketNO) : Ticket_Details | null  (ticketno == TicketNO)
 */
'use strict';
const { queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Ticket_Details', 'tbl_ticketmaster', { ticketno: null, status: null, isattend: 0 });

class Ticket_Details extends Base {
  async GetMemberInvestmentDetail(TicketNO) {
    return Base.map(await queryOne(DB, 'select * from tbl_ticketmaster where ticketno=@TicketNO limit 1', { TicketNO }));
  }
}

module.exports = Ticket_Details;
module.exports.Ticket_Details = Ticket_Details;
