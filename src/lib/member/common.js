/** Exports: class common - same methods as ../common (Member DAL/common.cs, database 'affiliate') EXCEPT GetConfigInfo(string configNames)
 *   and class ConfigModel, which exist only in the ClusterOfferAPI C#. Extends ../common and hides GetConfigInfo.
 */
'use strict';
const Base = require('../common');

class common extends Base {}
// Member C# has no GetConfigInfo - hide the inherited API-only instance method.
Object.defineProperty(common.prototype, 'GetConfigInfo', { value: undefined, writable: true, configurable: true });

module.exports = common;
