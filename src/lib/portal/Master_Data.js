/** Exports: re-export of ../Master_Data (portal Models/Master_Data.cs is byte-identical to the ClusterOfferAPI one, no database access):
 *  GetRequiredTable(ScatID, code, Cid), Operating_System(), Screen_Size(), Engin_Size(), Breed(), PetTypeMappingWithSubCategory(), Mother_Tongue(),
 *  Community(), YouAre(), AdType(), AdTypeOnSubCategory(), Certified(), AdPrice(), Condition(), ConditionOnSubCategory(), YouWantTo(), DeviceType()
 *  (each returns an array of row objects = C# DataTable; YouAre/YouWantTo rows: {ID, CATID, Title}) */
'use strict';
module.exports = require('../Master_Data');
