/** Exports (C# DAL/ServiceInterface.cs, namespace EntityFramework, MLM Admin): { ProcessResult }
 *   class ProcessResult { Message: string ; ReturnValue: string ; Success: bool? }  (property bag returned by create/update/delete/status-change code)
 * Also available as require('../../lib/admin/ProcessResult').
 * PORT-NOTE: the file's `internal interface` declarations (IAddressType, IBranchType, IProcessResult, IUserType) have no runtime behaviour and are not ported.
 * No Member/API equivalent exists => ported.
 */
'use strict';

class ProcessResult {
  constructor(init) {
    this.Message = null;
    // This Class Return 3 Value Mandatory for Any Creation , updation , Deletion, Status Change
    this.ReturnValue = null;
    this.Success = null;
    if (init) Object.assign(this, init);
  }
}

module.exports = { ProcessResult };
