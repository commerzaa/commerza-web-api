'use strict';
/**
 * Exports: class DAL_Help_Master (all async) { ManageExtendTimer(int HRID): string; Upload_PopUpData(string Regno, string ImageOfPopUp, string Remark, string VideoLink): string;
 *   Upload_Payment_Slip(Int64 Regno, Int64 HRID, string Image, string Remark): string;
 *   Create_Admin_Links(Int64 Regno) / Create_Admin_Links(Int64 Regno, string Address): string  (overload chosen by arguments.length);
 *   Geneate_Link_For_Auto_Get_Help(Int64 Regno): void;
 *   Confirm_Request(Int64 Regno, Int64 HRID, int ActionBy) / Confirm_Request(Regno, HRID, ActionBy, decimal BTC, string BTC_Address, string HashCode, int time, bool IsTestMode): string  (overload by arguments.length);
 *   Reject_Request(Int64 Regno, Int64 HRID, int ActionBy): string; Dashboard_Help_Requests_List(Int64 Regno): Dashboard_Help_Requests[];
 *   _Wallet(Int64 Regno): Wallet; _ROI(Int64 Regno): ROI[]; _Wallet_Details(Int64 Regno): {_ROI, _Wallet};
 *   Get_Help(decimal Principle, decimal ROI, decimal Working, Int64 RegNo, string Password): {RequestID, Message};
 *   Trasnfer_Principle_Into_Wallet(Int64 GAID, decimal amount, Int64 RegNo): string; Generate_Custom_ROI(Int64 Regno, decimal ROI_Rate): decimal }
 * PORT-NOTE: OUTPUT parameters are read from the single result row (lower-case column named after the parameter).
 */
const db = require('../db');
const { mapRows, mapRow } = require('../utils/shape');
const { out, toStr, fire } = require('./_libhelpers');

const Dashboard_Help_Requests = ['HRID', 'FName', 'FEmail', 'FMobile', 'TName', 'TEmail', 'TMobile', 'Amount', 'BTC', 'Create_Date',
  'Expire_Date', 'BTC_Address', 'InvestID', 'RequestID', 'GetID', 'GiveID', 'isHideFrom', 'isHideTo', 'FromRegno', 'ToRegno', 'Status',
  'RemainTime', 'RemainTime_From', 'NoOfUnseenMessage', 'StatusImage', 'PaySlip', 'Remark', 'TLoginID', 'FLoginID', 'str_Create_Date'];
const Wallet = ['Directincome', 'levelIncome', 'Pool_Income', 'ROI', 'CrAmount', 'Principle', 'totalIncome', 'withdrawalAmount', 'DrAmount',
  'currentIncome', 'Speed_Bonus', 'TeamRespresent_Bonus', 'taskincome'];
const ROI = ['GAID', 'Amount', 'Create_Date', 'GrowthDays', 'GrowthRate', 'RemainDays', 'Return_ROI', 'Available_Principle', 'Available_ROI', 'Status', 'InvestID'];

class DAL_Help_Master {
  // ManageExtendTimer
  async ManageExtendTimer(HRID) {
    const row = await db.procOne('affiliate', 'usp_extendtime', { hrid: HRID });
    return toStr(out(row, 'stringoutput'));
  }

  // this function returns success in cash of succsessfull transaction, other wise return error message
  async Upload_PopUpData(Regno, ImageOfPopUp, Remark, VideoLink) {
    // legacy maps @Message <- ImageOfPopUp and @ImageName <- Remark (kept)
    const row = await db.procOne('affiliate', 'usp_saveparticipantdetails', {
      regno: Regno,
      message: toStr(ImageOfPopUp),
      imagename: toStr(Remark),
      videolink: toStr(VideoLink),
    });
    return toStr(out(row, 'stringoutput'));
  }

  async Upload_Payment_Slip(Regno, HRID, Image, Remark) {
    const row = await db.procOne('affiliate', 'usp_upload_slip', { regno: Regno, hrid: HRID, image: toStr(Image), remark: toStr(Remark) });
    return toStr(out(row, 'message'));
  }

  // ActionBy:1 if call from member panel and pass ActionBy:2 when call from admin panel
  async Create_Admin_Links(Regno, Address) {
    const addr = arguments.length >= 2 ? Address : '';
    const BTCRate = 1;
    await db.proc('affiliate', 'usp_create_admin_links', { regno: Regno, btcrate: BTCRate, address: addr });
    fire(async () => {
      // SendMailOnCreateAdminLinks(Row);  (commented out in legacy)
    });
    return '';
  }

  async Geneate_Link_For_Auto_Get_Help(Regno) {
    const BTCRate = 1;
    await db.proc('affiliate', 'usp_geneate_link_for_auto_get_help', { regno: Regno, btcrate: BTCRate });
    fire(async () => {
      // SendMailOnCreateAdminLinks(Row);  (commented out in legacy)
    });
  }

  async Confirm_Request(Regno, HRID, ActionBy, BTC, BTC_Address, HashCode, time, IsTestMode) {
    if (arguments.length >= 8) {
      const row = await db.procOne('affiliate', 'usp_confirm_request', {
        hrid: HRID, actionby: ActionBy, sessionregno: Regno, btc: BTC, btc_address: BTC_Address, hashcode: HashCode, time, istestmode: IsTestMode,
      });
      return toStr(out(row, 'message'));
    }
    if (ActionBy === 2) { // by admin no need to confirm hash code
      const row = await db.procOne('affiliate', 'usp_confirm_request', {
        hrid: HRID, actionby: ActionBy, sessionregno: Regno, btc: 0, btc_address: '', hashcode: '', time: 0, istestmode: true,
      });
      return toStr(out(row, 'message'));
    }
    return 'this function has been closed';
  }

  // ActionBy:1 if call from member panel and pass ActionBy:2 when call from admin panel
  async Reject_Request(Regno, HRID, ActionBy) {
    const row = await db.procOne('affiliate', 'usp_reject_request', { hrid: HRID, actionby: ActionBy, sessionregno: Regno });
    return toStr(out(row, 'message'));
  }

  async Dashboard_Help_Requests_List(Regno) {
    const rows = await db.proc('affiliate', 'usp_dashboard_help_requests', { regno: Math.trunc(Number(Regno)) });
    return mapRows(rows, Dashboard_Help_Requests);
  }

  async _Wallet(Regno) {
    const row = await db.procOne('affiliate', 'usp_wallet', { regno: Regno });
    return mapRow(row, Wallet);
  }

  async _ROI(Regno) {
    const rows = await db.proc('affiliate', 'usp_roi', { regno: Regno });
    const list = mapRows(rows, ROI);
    list.sort((a, b) => {
      const x = a.Create_Date ? new Date(a.Create_Date).getTime() : 0;
      const y = b.Create_Date ? new Date(b.Create_Date).getTime() : 0;
      return x - y;
    });
    return list;
  }

  async _Wallet_Details(Regno) {
    const obj = { _Wallet: null, _ROI: null };
    obj._ROI = await this._ROI(Regno);
    obj._Wallet = await this._Wallet(Regno);
    return obj;
  }

  // if Get_Help_Response.Message return Success then process completed succressfully
  async Get_Help(Principle, ROI_, Working, RegNo, Password) {
    const Result = { RequestID: null, Message: null };
    try {
      const row = await db.procOne('affiliate', 'usp_get_help', {
        regno: RegNo, principle: Principle, roi: ROI_, working: Working, password: Password,
      });
      Result.RequestID = toStr(out(row, 'reqeustid'));
      Result.Message = toStr(out(row, 'message'));
      return Result;
    } catch (ex) {
      Result.RequestID = '0';
      Result.Message = 'Some error occurred, Please try again !';
      return Result;
    }
  }

  // Return success in case of success transfer
  async Trasnfer_Principle_Into_Wallet(GAID, amount, RegNo) {
    try {
      const row = await db.procOne('affiliate', 'usp_trasnfer_principle_into_wallet', { gaid: GAID, sessionregno: RegNo, amount });
      return toStr(out(row, 'message'));
    } catch (ex) {
      return 'Some error occurred, Please try again !';
    }
  }

  async Generate_Custom_ROI(Regno, ROI_Rate) {
    const row = await db.procOne('affiliate', 'usp_generate_custom_roi', { regno: Regno, roi_rate: ROI_Rate });
    return Number(out(row, 'income'));
  }
}

module.exports = DAL_Help_Master;
