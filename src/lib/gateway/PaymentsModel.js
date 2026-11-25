/** Exports (Payment Gateway Models/PaymentsModel.cs + Models/DataBaseContext.cs; plain property bags, no logic):
 *   PaymentsModel : class with no properties ; PaymentsModelProps = []
 *   PayU : class { key, transaction, amount(decimal), productInfo, customerName, email, phone, surl, furl, hash } ; PayUProps = [...same names, C# casing]
 *   DataBaseContext : { DB: 'shopping' }  (EF context with no DbSets; Web.config "DataBaseContext" => initial catalog=Db_Shopping)
 * Use PayUProps with utils/shape mapRow/mapRows to restore the legacy property casing.
 */
'use strict';

const PaymentsModelProps = [];
class PaymentsModel {
  constructor(init) { Object.assign(this, init); }
}

const PayUProps = ['key', 'transaction', 'amount', 'productInfo', 'customerName', 'email', 'phone', 'surl', 'furl', 'hash'];
class PayU {
  constructor(init) {
    this.key = null;
    this.transaction = null;
    this.amount = 0; // decimal (non-nullable => 0 by default)
    this.productInfo = null;
    this.customerName = null;
    this.email = null;
    this.phone = null;
    this.surl = null;
    this.furl = null;
    this.hash = null;
    Object.assign(this, init);
  }
}

// DataBaseContext.cs: DbContext with no DbSets (OnModelCreating disables the initializer) => only the database name matters.
const DataBaseContext = Object.freeze({ DB: 'shopping' });

module.exports = { PaymentsModel, PaymentsModelProps, PayU, PayUProps, DataBaseContext };
