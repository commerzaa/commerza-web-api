/** Exports: class VatCategory (table tbl_vat_categories; static PROPS, static TABLE) + VatCategoriesDetail, VatCat ({PROPS}) as static members
 *   async GetVatCategory(int vcid, Int64 BranchId) : VatCategory|null
 *   async GetVatCategoryCharges(int vcid, Int64 BranchId) : string ("0.00" format)
 *  Portal C# is identical to the Merchant C# -> extends ../merchant/VatCategory; adds the PROPS of the two property-bag classes
 *  (used with SqlQuery<T> by DAL/VatCategoryDal). */
'use strict';
const Base = require('../merchant/VatCategory');

class VatCategory extends Base {}
VatCategory.PROPS = ['active', 'BranchId', 'vatPercValue', 'vatTitle', 'vcid', 'prodCount', 'vatNewTitle'];
VatCategory.TABLE = 'tbl_vat_categories';
VatCategory.VatCategory = VatCategory;
VatCategory.VatCategoriesDetail = { PROPS: ['active', 'BranchId', 'Rownumber', 'StateName', 'ToUserId', 'ToUserType', 'vatPercValue', 'vatTitle', 'vcid'] };
VatCategory.VatCat = { PROPS: ['active', 'BranchId', 'vatPercValue', 'vatTitle', 'vcid', 'prodCount', 'vatNewTitle'] };

module.exports = VatCategory;
