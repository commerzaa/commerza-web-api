'use strict';
/** Port of Merchant Panel Controllers/CustomerPanel/OuterBusiness_KYC.cs (1 action). DB: 'shopping' */
const express = require('express');
const { auth } = require('../../middleware/auth');
const asyncHandler = require('../../middleware/asyncHandler');
const db = require('../../db');
const router = express.Router();
const DB = 'shopping';

// route-config: outer-business-kyc -> Index
// auth
router.all(['/merchant/OuterBusiness_KYC/Index{/:id}', '/merchant/outer-business-kyc'], auth, asyncHandler(async (req, res) => {
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
  const Plid = Number(req.user.plid);
  const r = await db.queryOne(DB, "Select to_char(DOI,'MM-DD-YYYY') As DOI,PANNO,EntityType From Tbl_BusinessKycDetails Where PLID=@plid limit 1", { plid: Plid });
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
