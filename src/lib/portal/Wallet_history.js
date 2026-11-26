/** Exports: Wallet_history - EF entity / SqlQuery<T> property bag from Models/Wallet_history.cs.
 *  { PROPS: [PascalCase property names for mapRows], TABLE: '<postgres table>' } (no methods in the C#). */
'use strict';

const Wallet_history = { PROPS: ['WHID', 'WDID', 'PLID', 'CRDRTYPE', 'AMOUNT', 'TRANTYPE', 'DATE', 'REMARKS', 'PAYMODE', 'ACCOUNTHOLDERNAME', 'ACCOUNTNO', 'BANKNAME', 'BRANCHNAME', 'IFSC', 'RESPONSETYPE', 'STATUS', 'TRANID'], TABLE: 'withdrawal_history' };

module.exports = { ...Wallet_history, Wallet_history };
