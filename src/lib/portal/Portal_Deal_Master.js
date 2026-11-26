/** Exports: PROPS-only descriptors of the C# property bag(s) in Models/Portal_Deal_Master.cs: Portal_Deal_Master (table portal_deal_master), AddDeals, AllDealsList, MostPopularDeals
 *   { PROPS: [PascalCase property names], TABLE?: '<EF table>', NOT_MAPPED?: [...] } per class name; use mapRows(rows, X.PROPS). No methods in C#. */
'use strict';
const Portal_Deal_Master = {"PROPS":["DEALID","PMID","TITLE","OFFER","Upload","IMAGES","DESCRIPTION","DISCOUNT","STARTPRICE","FROMTIME","TOTIME","TERMS","HIGHLIGHTS","CREATEDATE","ACTIVE","VERIFY","APPROVEDDATE","REJECTDATE","REJECTREASON"],"TABLE":"portal_deal_master"};
const AddDeals = {"PROPS":["Title","OfferReward","Description","StartingPrice","Discount","DealsFrom","DealsTill","Highlights","Terms","Upload"]};
const AllDealsList = {"PROPS":["ROWNUMBER","ID","ACTIVESTATUS","IMAGENAME","TITLE","CREATEDATE","FROMDATE","EXPIRYDATE","OFFER","DESCRIPTIONS","Responses"]};
const MostPopularDeals = {"PROPS":["DEALID","TITLE","DESCRIPTION","Discount","Offer","ADDRESS","MOBILENO","IMAGES","REVIEW","REVIEWCOUNT","URL","STARTPRICE"]};
module.exports = { ...Portal_Deal_Master, Portal_Deal_Master, AddDeals, AllDealsList, MostPopularDeals };
