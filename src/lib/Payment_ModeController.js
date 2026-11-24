/** Exports: class Payment_Mode { static PayModeList() : {PayID, PayMode}[] ; static PayModeListforwellate() : {PayID, PayMode}[] } */
'use strict';

class Payment_Mode {
  static PayModeList() {
    return [
      { PayID: 1, PayMode: 'Cash' },
      { PayID: 2, PayMode: 'Cheque' },
      { PayID: 4, PayMode: 'Online Payment' },
      { PayID: 3, PayMode: 'PayUmoney' },
      { PayID: 5, PayMode: 'Wallet' },
    ];
  }

  static PayModeListforwellate() {
    return [
      { PayID: 1, PayMode: 'Cash' },
      { PayID: 2, PayMode: 'Cheque' },
      { PayID: 4, PayMode: 'Online Payment' },
      { PayID: 3, PayMode: 'PayUmoney' },
      { PayID: 5, PayMode: 'Wallet' },
    ];
  }
}

module.exports = Payment_Mode;
