/** Exports: class DAL_Common { async Direct_List1(string LoginID): Direct_List_Ddl[]; async Direct_List(string LoginID): managerDirect[];
 *   static async check_For_Popup(Int64 Regno): bool }
 * Member DAL/DAL_Common.cs = ClusterOfferAPI DAL/DAL_Common.cs WITHOUT ValidateUser(string PLID) (API-only), same database 'affiliate'.
 * Extends ../DAL_Common and hides the API-only static ValidateUser.
 */
'use strict';
const Base = require('../DAL_Common');

class DAL_Common extends Base {}
// Member C# has no ValidateUser - hide the inherited API-only static.
Object.defineProperty(DAL_Common, 'ValidateUser', { value: undefined, writable: true, configurable: true });
DAL_Common.managerDirect = Base.managerDirect;

module.exports = DAL_Common;
