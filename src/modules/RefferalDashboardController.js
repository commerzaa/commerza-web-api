'use strict';
/** Port of Controllers/MemberPanelCntrl/RefferalDashboardController.cs (1 route) */
const express = require('express');
const { auth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { query, proc, scalar } = require('../db');
const { mapRows, netDate } = require('../utils/shape');
const DataUtility = require('../lib/DataUtility');

const router = express.Router();

const mapD = (rows, props, dates) => mapRows(rows, props).map((r) => {
  for (const d of dates) if (d in r) r[d] = netDate(r[d]);
  return r;
});
const num = (v) => (v === null || v === undefined ? 0 : Number(v)); // FirstOrDefault<decimal>
const firstVal = (rows) => { // SqlQuery<T> of scalar => first column of first row
  const r = rows[0];
  return r ? r[Object.keys(r)[0]] : null;
};

const Member_MasterProps = ['REGNO', 'LOGINID', 'RANKID', 'TITLE', 'FNAME', 'MNAME', 'LNAME', 'USERNAME', 'FATH_HUS_NAME', 'DOB', 'GENDER', 'MARITAL_STATUS', 'ADDRESS', 'CID', 'CTID', 'STATENAME', 'CITYNAME', 'PINCODE', 'MOBILE', 'EMAILID', 'EPIN_NO', 'REGDATE', 'DOC', 'INTROREGNO', 'PARENTREGNO', 'IPADD', 'IMAGENAME', 'ACTIVE', 'STATUS', 'NOMNAME', 'NOMREL', 'NOMDOB', 'PANNO', 'SPONSERID', 'ROOTID', 'LEFTID', 'RIGHTID', 'KYCSTATUS', 'KYCCOMMENT', 'KITPRICE', 'IsMobileSelfVerified', 'IsEmailSelfVerified', 'IsProfileSelfVerified', 'IsReferralAccepted', 'DefaultSponserSide', 'side'];
const KycTypeProps = ['PHOTOSTATUS', 'IDFRUNTIMGSTATUS', 'PANSTATUS', 'BANKSTATUS', 'ALLSTATUS', 'ISPROFILESTATUS'];
const CommunityProps = ['ROWNUMBER', 'PBV', 'DRBV', 'DLBV', 'TLBV', 'TRBV', 'CFLBV', 'CFRBV', 'PAIDBV', 'TOTAL_LBV', 'TOTAL_RBV', 'FLUSHBV', 'CURRENT_LBV', 'CURRENT_RBV', 'TOTALLEFTPAID', 'TOTALRIGHTPAID', 'TOTALRIGHTDEACTIVECOUNT', 'TOTALLEFTDEACTIVECOUNT', 'TOTALLEFTMEMBER', 'TOTALRIGHTMEMBER', 'TOTALLEFTDIRECTMMEBER', 'TOTALRIGHTDIRECTMEMBER', 'ACTIVELEFTDIRECTMMEBER', 'ACTIVERIGHTDIRECTMEMBER', 'INACTIVELEFTDIRECTMMEBER', 'INACTIVERIGHTDIRECTMEMBER', 'MLBV', 'MRBV'];
const RewardProps = ['ROWNUMBER', 'REWARDNAME', 'ACHVEDMATCHING', 'LEFTBUSINESS', 'RIGHTBUSINESS', 'MATCHVOLUMNE', 'ACHIVEREWARD', 'Remaining', 'ACHIVEDATE', 'RANKNAME', 'CLBV', 'CRBV', 'REWARDMATCHBV', 'CLAIMED', 'RAID', 'ApprovedDate'];
const PackagePurchaseProps = ['SNO', 'TotalPayableAmount', 'AllPackageName', 'PuchaseDate', 'IsOrderCanceled', 'IsActive'];

const mainMemberDate = ['DOB', 'REGDATE', 'DOC', 'NOMDOB'];

// auth
router.post('/api/RefferalDashboard', auth, asyncHandler(async (req, res) => {
  const p = req.p;
  let PROCEDURENAME = '';
  const parseIntOrNull = (v) => (v === undefined || v === null || v === '' || !/^[+-]?\d+$/.test(String(v).trim()) ? null : parseInt(v, 10));
  let page = parseIntOrNull(p.page); if (page == null) page = 0; // unused further (kept as in legacy)
  let ActivationStatus = parseIntOrNull(p.ActivationStatus); if (ActivationStatus == null) ActivationStatus = 0; // unused
  const liginid = p.liginid === undefined || p.liginid === null ? '' : String(p.liginid); // null concatenated into SQL => ''
  try {
    // Convert.ToDouble(plid): null => 0, bad format => FormatException
    let Plid;
    if (p.plid === undefined || p.plid === null || p.plid === '') Plid = 0;
    else {
      const t = String(p.plid).trim();
      if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) throw new Error('Input string was not in a correct format.');
      Plid = parseFloat(t);
    }

    // ONLINE KYC APPROVED/ REJECT CALL FOR PROCEDURE
    if (Plid > 0) {
      await proc('affiliate', 'usp_memberkyc_statusimg', { mode: 0, regno: Plid });
    }

    PROCEDURENAME = 'USP_GETDYNAMICDASHBORD_WIDGET';
    // PORT-NOTE: @STRESULT OUT parameter not requested (result variable was unused).
    await proc('affiliate', 'usp_getdynamicdashbord_widget', { regno: Plid });

    const strcount = req.path.replace(/^\//, ''); // Request.Url.AbsolutePath.Substring(1)
    await scalar('affiliate', 'select tdid from tbl_dashboards where url = @url and actine = 1 limit 1', { url: strcount });
    await query('affiliate', 'select * from tbl_flyermanagement where status = 1 and isactive = 1 and contenttype = 2 limit 1');

    await proc('affiliate', 'usp_scalerdata', { mode: 5 });

    await proc('affiliate', 'usp_sponserandachivelevel', { plid: Plid });
    const dm = (mode) => proc('affiliate', 'usp_getnofodirectmember_anddownlinemember', { mode, regno: Plid });
    await dm(1); // TotalDownline
    await dm(2); // TotalDirectMember
    await dm(3); // LastUpdateEwallet
    await dm(4); // LastUpdateCommissionWallet
    await dm(5); // LastUpdatedDepositHistory
    await dm(6); // LastMakeInvestmentHistory
    await dm(7); // RankName

    // PORT-NOTE: @RESULT OUT parameter not requested; legacy passed empty-string values for @REGNO/@IMAGENAME.
    await proc('affiliate', 'usp_insertmemberkycimages', { regno: '', imagename: '', mode: 11 });

    await proc('affiliate', 'usp_get_newsfordashboard', { mode: 1 }); // NewsDetailsforDashboard (not returned)

    const PackagePurchase1 = mapD(await proc('affiliate', 'usp_get_packagepurchase', { regno: Plid }), PackagePurchaseProps, ['PuchaseDate']);

    await proc('affiliate', 'usp_logindetails', { regno: Plid }); // LoginHistory (not returned)
    await proc('affiliate', 'usp_get2fasecurity', {}); // TwoFADetails (not returned)

    const Rewardlist1 = mapD(await proc('affiliate', 'usp_all_life_timerewardachivers', {
      regno: Plid, startrowindex: 1, maxrows: 100, fromdate: '', todate: '',
    }), RewardProps, ['ACHIVEDATE', 'ApprovedDate']);

    await proc('affiliate', 'usp_get_newsfordashboard', { mode: 2 }); // DashboardColor (not returned)

    const KycTypenew = mapRows(await proc('affiliate', 'usp_scalerdatanew', { mode: 6, regno: Plid }), KycTypeProps);

    const AvailableCommissionWallet = num(await scalar('affiliate', 'select coalesce(availablecommissionwallet,0) from member_performance where regno = @plid limit 1', { plid: Plid }));
    await scalar('affiliate', 'select coalesce(sum(income),0) from level_income where isskip=0 and ishold=1 and levelincometype=1 and toid = @liginid', { liginid }); // GenerationIncome (unused)
    await scalar('affiliate', 'select coalesce(sum(income),0) from directincomes where isskip=0 and toid = @liginid', { liginid }); // DirectIncome (overwritten below)
    const SelfBV = num(await scalar('affiliate', 'select coalesce(sum(package_amt),0) from tbl_tempdirectincomedistribution where status=1 and regno = @plid', { plid: Plid }))
      + num(await scalar('affiliate', 'select coalesce(sum(bv),0) from tbl_repurchasedetails where status=1 and payid=0 and regno = @plid', { plid: Plid }));
    const Availablefund = num(await scalar('affiliate', 'select coalesce(available_fund,0) from member_performance where regno = @plid limit 1', { plid: Plid }));
    await scalar('affiliate', 'select coalesce(sum(cr_amount),0) from money_statements where regno = @plid', { plid: Plid }); // TotalIncomeAmount (unused)
    const TOTALREFERRALAMOUNT = num(await scalar('affiliate', 'select coalesce(sum(tas.totalpayableamount),0) from member_master m1 left join tbl_allsubscriptionmaster tas on m1.regno = tas.regno where m1.sponserid = @liginid', { liginid }));
    const AvailableWithdrawallWallet = num(await scalar('affiliate', "select coalesce(sum(withdrawamount),0) from tbl_withdrawals where status = 'PAID' and plid = @plid", { plid: Plid }));

    // Member_Master.Get_member_details(Plid)
    const mrows = await query('affiliate', 'select * from member_master where regno = @plid limit 1', { plid: Math.trunc(Plid) });
    const member_details1 = mrows.length ? mapD(mrows, Member_MasterProps, mainMemberDate)[0] : null;

    const MyCommunityMemberDetails = mapRows(await proc('affiliate', 'usp_dashboard_mycommunity_memberdetails', { regno: Plid }), CommunityProps);

    const widget = [
      { name: 'Top-up Wallet', balance: Availablefund },
      { name: 'Income wallet', balance: AvailableCommissionWallet },
      { name: 'Self C Point', balance: SelfBV },
      { name: 'Total Referral Bussiness', balance: TOTALREFERRALAMOUNT },
      { name: 'Income Total', balance: AvailableCommissionWallet + AvailableWithdrawallWallet },
      { name: 'Total Withdraw Amount', balance: AvailableWithdrawallWallet },
    ];

    if (MyCommunityMemberDetails.length === 0) {
      throw new Error('Index was out of range. Must be non-negative and less than the size of the collection.\r\nParameter name: index');
    }
    return res.json({
      status: 'true',
      message: 'Success',
      widget,
      memberdetails: member_details1,
      kycsummary: KycTypenew,
      businessdetails: MyCommunityMemberDetails[0],
      rewardachivements: Rewardlist1,
      packagepurchase: PackagePurchase1,
    });
  } catch (e) {
    console.error(e);
    try {
      await new DataUtility().ErrorInsert(0, e.message, PROCEDURENAME, 0, req.path);
    } catch (e2) {
      console.error(e2);
    }
    return res.json({ status: 'false', message: 'ErrorMessage', _error: e.message });
  }
}));

module.exports = router;
