'use strict';
/**
 * Port of Member/Common/Controllers/CustomerPanel/Apply_For_Franchise.cs (Apply_For_FranchiseController, 3 actions: Index, SaveFranchise, SaveFrenchise)
 * Prefix: /member   DB: Db_Affiliate => 'affiliate'
 * route-config: Apply_For_Franchise -> referral/apply-for-franchise
 * PORT-NOTE: SaveFrenchise is a public string method (MVC action returning text/plain); it keeps the legacy PLID request parameter but is protected with auth.
 */
const express = require('express');
const { proc } = require('../../db');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const ATCAPI = require('../../lib/member/ATCAPI');

const router = express.Router();
const DB = 'affiliate';
const C = 'Apply_For_Franchise';

const s = (v) => (v === null || v === undefined ? '' : String(v));
const jstr = (v) => (v === null || v === undefined ? '' : String(v));
const colOf = (rows, n) => { const r = Array.isArray(rows) ? rows[0] : rows; if (!r) return null; const k = Object.keys(r).find((x) => x.toLowerCase() === n.toLowerCase()); return k === undefined ? null : r[k]; };
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
/** APIResponse.Substring(2, Length-4).Replace("\\","") then JArray.Parse */
function parseApi(resp) {
  const t = s(resp);
  if (t.length < 4) throw new RangeError('Length cannot be less than zero.');
  return JSON.parse(t.substring(2, t.length - 2).split('\\').join(''));
}
const atcRow = async (name, params) => { const r = (await proc(DB, name, params))[0]; return r ? { INR: r.inr, Atc_WalletAddress: r.atc_walletaddress, ATCUserId: r.atcuserid } : null; };

// ---- Index ------------------------------------------------------------------------------------------------------
// auth
router.all([`/member/${C}/Index{/:id}`, `/member/${C}`, '/member/referral/apply-for-franchise'], auth, asyncHandler(async (req, res) => {
  res.json({});
}));

// ---- internal SaveFrenchise -----------------------------------------------------------------------------------------
async function SaveFrenchise(RegionType, PincodeFirstPriority, PincodeSecondPriority, PincodeThirdPriority, PaymentMode, CommentOrRemark, Amount, TransactionId, APIResponseForSave, PLID) {
  // PORT-NOTE: @StrOutPut OUT is read from the "stroutput" column of the procedure result row
  const out = await proc(DB, 'usp_franchise_master', {
    plid: PLID, applyiedforpincodefirstchoice: PincodeFirstPriority, applyiedforpincodesecondchoice: PincodeSecondPriority, applyiedforpincodethirdchoice: PincodeThirdPriority,
    regiontype: RegionType, amount: Amount, transactionid: TransactionId, apiresponseforsave: APIResponseForSave, paymentmode: PaymentMode, mode: '1', commentorremark: CommentOrRemark,
  });
  const v = colOf(out, 'stroutput');
  if (v === null) throw NRE();
  return String(v);
}

// ---- SaveFranchise -----------------------------------------------------------------------------------------------------
// auth (SessionExpireCheck)
router.all(`/member/${C}/SaveFranchise{/:id}`, auth, asyncHandler(async (req, res) => {
  const { PincodeFirstPriority, PincodeSecondPriority, PincodeThirdPriority, PaymentMode, CommentOrRemark } = req.p;
  let { RegionType } = req.p;
  let APIResponseForSave = ''; let TransactionId = '';
  const Words = s(RegionType).split('^');
  let ReturnOutput = '';
  RegionType = Words[0];
  if (Words.length < 2) throw new RangeError('Index was outside the bounds of the array.');
  const Amount = Words[1];
  let NoOfCoin = '0.00000000';
  const Plid = Number(req.user.plid);
  try {
    let FromATCUserid = ''; let FromATCWalletAddress = '';
    if (PaymentMode === '12') {
      const ObjSATCDatails = await atcRow('usp_getatcdetails', { plid: Plid });
      if (!ObjSATCDatails) throw NRE();
      FromATCUserid = ObjSATCDatails.ATCUserId;
      FromATCWalletAddress = ObjSATCDatails.Atc_WalletAddress;

      // Validate sender Atc wallet address exists or not
      const APIResponseValidate = await ATCAPI.ValidateATCWalletAddress(FromATCWalletAddress);
      const ObjJArrayValidate = parseApi(APIResponseValidate);
      const ResponseValidate = jstr(ObjJArrayValidate[0].Response);
      const IsSuccessValidate = jstr(ObjJArrayValidate[0].IsSuccess);
      if (IsSuccessValidate.trim() !== '1') return res.json('Error^' + ResponseValidate);

      // Check member has balance or not
      if (s(FromATCUserid) !== '' && s(FromATCWalletAddress) !== '') {
        const APIResponse = await ATCAPI.GetATCWalletBalance(FromATCUserid, FromATCWalletAddress);
        const ObjJArrayNew = parseApi(APIResponse);
        const r0 = jstr(ObjJArrayNew[0].Response);
        if (r0.trim() !== '' && !Number.isNaN(Number(r0))) {
          NoOfCoin = r0;
        } else {
          return res.json('Error^' + r0);
        }
      } else {
        NoOfCoin = '0.00000000';
      }
      if (Number(Amount) > Number(NoOfCoin)) return res.json('Error^' + 'You Have Insufficient Fund In Your Wallet');

      // Transfer the coin
      if (s(FromATCUserid) !== '' && s(FromATCWalletAddress) !== '') {
        const ObjSATCDatailsAdmin = await atcRow('get_adminatcdetails', {});
        if (!ObjSATCDatailsAdmin) throw NRE();
        const APIResponse = await ATCAPI.ATCSendReceived(FromATCUserid, ObjSATCDatailsAdmin.Atc_WalletAddress, String(Amount));
        APIResponseForSave = APIResponse;
        const ObjJArray = parseApi(APIResponse);
        const ResponseMessage = jstr(ObjJArray[0].Response);
        TransactionId = jstr(ObjJArray[0].TxID);
        if (ResponseMessage.trim().toLowerCase() !== 'true') {
          return res.json('Error^' + ResponseMessage);
        } else if (TransactionId.trim() === '') {
          return res.json('Error^' + 'Invalid Transaction Id.');
        }
        ReturnOutput = await SaveFrenchise(RegionType, PincodeFirstPriority, PincodeSecondPriority, PincodeThirdPriority, PaymentMode, CommentOrRemark, Amount, TransactionId, APIResponseForSave, Plid);
      } else {
        return res.json('Error^You Do Not Have Sufficient Wallet. ! Try Agian');
      }
    } else if (PaymentMode === '13') {
      ReturnOutput = await SaveFrenchise(RegionType, PincodeFirstPriority, PincodeSecondPriority, PincodeThirdPriority, PaymentMode, CommentOrRemark, Amount, TransactionId, APIResponseForSave, Plid);
    } else {
      return res.json('Error^Select Payment Mode And Try Again.! ');
    }
  } catch (Obj) {
    return res.json('Error^Some Error Occur ! Try Again.! ' + Obj.message);
  }
  return res.json(ReturnOutput);
}));

// ---- SaveFrenchise (public string method => text/plain action) -----------------------------------------------------
// auth
router.all(`/member/${C}/SaveFrenchise{/:id}`, auth, asyncHandler(async (req, res) => {
  const p = req.p;
  const PLID = parseInt(p.PLID, 10);
  if (Number.isNaN(PLID)) throw new Error("The parameters dictionary contains a null entry for parameter 'PLID' of non-nullable type 'System.Int64'.");
  const out = await SaveFrenchise(p.RegionType, p.PincodeFirstPriority, p.PincodeSecondPriority, p.PincodeThirdPriority, p.PaymentMode, p.CommentOrRemark, p.Amount, p.TransactionId, p.APIResponseForSave, PLID);
  res.type('text/plain').send(out);
}));

module.exports = router;
