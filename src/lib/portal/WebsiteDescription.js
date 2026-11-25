/** Exports: same as ../merchant/WebsiteDescription (Portal C# Models/WebsiteDescription.cs is identical to the Merchant C#, same Db_Shopping DB)
 *   static WebsiteDetail: GetWebsiteInfo(long WID), GetListPageDetails(string URL), GetListPageDetailsOfEComm(int Id, int Type), GetDealsPageDetails(string URL)
 *   -> WebsiteDescription {Heading, Description, SeoTitle, SeoKeyword, SeoDescription} | null ; also exports WebsiteDetail and PROPS. */
'use strict';
const base = require('../merchant/WebsiteDescription');

module.exports = { ...base, PROPS: ['Heading', 'Description', 'SeoTitle', 'SeoKeyword', 'SeoDescription'] };
