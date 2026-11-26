/** Exports: class CommonDal { async InsertReview(string RWID, string NAME, string EMAIL, string Title, string RATE, string TYPE, string REVIEW, int pmid): ProductListingDetails[]; async ShowReview(int pmid): ProductListingDetails[] } */
'use strict';
// Ported from ClusterofferShopingPortal DAL/CommonDal.cs. Both legacy methods have empty bodies and return an empty list.

class CommonDal {
  // eslint-disable-next-line no-unused-vars
  async InsertReview(RWID, NAME, EMAIL, Title, RATE, TYPE, REVIEW, pmid) {
    const DetailList = [];
    return DetailList;
  }

  // eslint-disable-next-line no-unused-vars
  async ShowReview(pmid) {
    const DetailList = [];
    return DetailList;
  }
}

module.exports = CommonDal;
