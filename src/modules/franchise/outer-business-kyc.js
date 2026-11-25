'use strict';
const express = require('express');
const router = express.Router();
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const { mapRows } = require('../../utils/shape');
const UtilityClass = require('../../lib/franchise/UtilityClass');
// PORT-NOTE: OUT params of stored procs are read from same-named (lower-case) columns of the first result row (0 when absent).
const outv = (rows, n) => (rows && rows[0] && rows[0][n.toLowerCase()] !== undefined && rows[0][n.toLowerCase()] !== null ? rows[0][n.toLowerCase()] : 0);
const s = (v) => (v === undefined || v === null ? '' : String(v));
const pg = (v) => { const n = parseInt(v, 10); return Number.isNaN(n) ? 1 : n; };
// Port of Franchise\Controllers\CustomerPanel\OuterBusiness_KYC.cs (1 action)
// route-config: outer-business-kyc -> Index
// auth
router.all(['/franchise/OuterBusiness_KYC/Index{/:id}', '/franchise/outer-business-kyc'], auth, asyncHandler(async (req, res) => {
  const out = {
    PancardDeails: '/images/uploadkyc.png',
    AddressProofDeails: '/images/uploadkyc.png',
    Deed: '/images/uploadkyc.png',
    PartnerShipDeed: '/images/uploadkyc.png',
    MemorandumOfAssociation: '/images/uploadkyc.png',
    IncorporationCertificate: '/images/uploadkyc.png',
    PancardMessage: '', PancardApprovalStatus: 0,
    AddressProofMessage: '', AddressProofApprovalStatus: 0,
    DeedMessage: '', DeedApprovalStatus: 0,
    PartnerShipDeedMessage: '', PartnerShipDeedApprovalStatus: 0,
    MemorandumOfAssociationMessage: '', MemorandumOfAssociationApprovalStatus: 0,
    IncorporationCertificateMessage: '', IncorporationCertificateApprovalStatus: 0,
    PancardImageMessage: 'Image Not Uploaded',
    AddressProofImageMessage: 'Image Not Uploaded',
    DeedImageMessage: 'Image Not Uploaded',
    PartnerShipDeedImageMessage: 'Image Not Uploaded',
    MemorandumOfAssociationImageMessage: 'Image Not Uploaded',
    IncorporationCertificateImageMessage: 'Image Not Uploaded',
  };
  const Plid = req.user.did;
  const r = await db.queryOne('shopping', "Select to_char(DOI,'MM-DD-YYYY') As DOI,PANNO,EntityType From Tbl_BusinessKycDetails_DISTRIBUTOR Where DID=@plid limit 1", { plid: Plid });
  if (r) {
    out.DOI = r.doi;
    out.PanNo = r.panno;
    out.EntityType = r.entitytype;
  } else {
    out.DOI = '';
    out.PanNo = '';
    out.EntityType = 0;
  }
  res.json(out);
}));

module.exports = router;
