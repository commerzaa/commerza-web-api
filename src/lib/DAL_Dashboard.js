'use strict';
/**
 * Exports: class DAL_Dashboard { Dashboard_Help_Requests_List(Int64 Regno), Dashboard_Help_Requests_List1(Int64 Regno),
 *   Get_Joining_Count(), Get_Commitment(), Get_Withdrawal(), Get_Support(), Details(),
 *   Dashboard_Give_Help_Report(), Dashboard_Get_Help_Report() }  (all async)
 */
const db = require('../db');
const { mapRows, mapRow } = require('../utils/shape');

const Dashboard_Help_Requests = ['HRID', 'FName', 'FEmail', 'FMobile', 'TName', 'TEmail', 'TMobile', 'Amount', 'BTC', 'Create_Date',
  'Expire_Date', 'BTC_Address', 'InvestID', 'RequestID', 'GetID', 'GiveID', 'isHideFrom', 'isHideTo', 'FromRegno', 'ToRegno', 'Status',
  'RemainTime', 'RemainTime_From', 'NoOfUnseenMessage', 'StatusImage', 'PaySlip', 'Remark', 'TLoginID', 'FLoginID', 'str_Create_Date'];
const Total_help = ['totalhelp', 'Confirm', 'pending'];
const Give_Help_Report = ['SNo', 'Name', 'EmailId', 'Give_Help', 'Confirm_Help'];
const Get_Help_Report = ['SNo', 'Name', 'EmailId', 'Request_Help', 'Confirm_Help'];

class DAL_Dashboard {
  async Dashboard_Help_Requests_List(Regno) {
    const rows = await db.proc('affiliate', 'usp_dashboard_help_requests', { regno: Math.trunc(Number(Regno)) });
    return mapRows(rows, Dashboard_Help_Requests);
  }

  async Dashboard_Help_Requests_List1(Regno) {
    const value = 1;
    const rows = await db.proc('affiliate', 'usp_dashboard_help_requests_new', { regno: Math.trunc(Number(Regno)), value });
    return mapRows(rows, Dashboard_Help_Requests);
  }

  async Get_Joining_Count() {
    const totaljoin = Number(await db.scalar('affiliate', 'select count(*) from member_master where status = true'));
    // legacy compared REGDATE == DateTime.Now (exact timestamp equality)
    const todayjoin = Number(await db.scalar('affiliate', 'select count(*) from member_master where status = true and regdate = now()'));
    return { totaljoin, todayjoin, paid: 0, free: 0 };
  }

  async Get_Commitment() {
    const rows = await db.proc('affiliate', 'total_give_help', {});
    if (rows.length > 1) throw new Error('Sequence contains more than one element');
    return mapRow(rows[0] || null, Total_help);
  }

  async Get_Withdrawal() {
    const rows = await db.proc('affiliate', 'total_get_help', {});
    if (rows.length > 1) throw new Error('Sequence contains more than one element');
    return mapRow(rows[0] || null, Total_help);
  }

  async Get_Support() {
    const totaljoin = Number(await db.scalar('affiliate', 'select count(*) from tbl_ticketmaster'));
    const todayjoin = Number(await db.scalar('affiliate', "select count(*) from tbl_ticketmaster where status = 'Solved'"));
    return { totalrequest: totaljoin, solvedrequest: todayjoin };
  }

  async Details() {
    const totaljoin = Number(await db.scalar('affiliate', 'select count(*) from member_master'));
    const todayjoin = Number(await db.scalar('affiliate', 'select count(*) from member_master where regdate::date = current_date'));
    const free = Number(await db.scalar('affiliate', 'select count(*) from member_master where active = false'));
    const paid = Number(await db.scalar('affiliate', 'select count(*) from member_master where active = true'));
    return { totaljoin, todayjoin, paid, free };
  }

  async Dashboard_Give_Help_Report() {
    const rows = await db.proc('affiliate', 'give_help_dashboard_report', {});
    return mapRows(rows, Give_Help_Report);
  }

  async Dashboard_Get_Help_Report() {
    const rows = await db.proc('affiliate', 'get_help_dashboard_report', {});
    return mapRows(rows, Get_Help_Report);
  }
}

module.exports = DAL_Dashboard;
