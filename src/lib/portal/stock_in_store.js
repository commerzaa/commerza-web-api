/** Exports: class stock_in_store (table tbl_stock_in_store; static PROPS, TABLE), class stock_transfer (table tbl_stock_transfer; static PROPS, TABLE),
 *          StockListInBranch ({PROPS}). Access: require('./stock_in_store') is the stock_in_store class; .stock_transfer / .StockListInBranch hang off it.
 *   stock_in_store: async _stock_in_store_list() : stock_in_store[]
 *                   async Check_stock_in_store(Int64 SPRID) : "yes" | "no"   (throws like the C# NullReference when the product rows are missing)
 *                   async stock_in_store_list(string BrCode = "") : StockListInBranch[]  (Usp_Stock_In_Store_List @BrCode; C# overload without args passes "")
 *   stock_transfer: async _stock_transfer_list() : stock_transfer[]  (order by stid desc) */
'use strict';
const { query, queryOne, proc } = require('../../db');
const { mapRows } = require('../../utils/shape');

const DB = 'shopping';
const nre = () => new TypeError('Object reference not set to an instance of an object.');

const StockListInBranch = { PROPS: ['BrCode', 'BV', 'cat_OH_Amt', 'DAP', 'Mvat', 'PrName', 'ProdUnit', 'PV', 'Qty', 'SComm', 'sellMRP', 'SpAmt', 'stockNetQty', 'SubPrCode', 'SWPID', 'vcid'] };

class stock_in_store {
  async _stock_in_store_list() {
    return mapRows(await query(DB, 'select * from tbl_stock_in_store'), stock_in_store.PROPS);
  }

  async Check_stock_in_store(SPRID) {
    let Result = 'yes';
    const RowSubProd = await queryOne(DB, 'select sprid, mprid from ims_subproduct where sprid=@SPRID limit 1', { SPRID });
    if (!RowSubProd) throw nre();
    const RowProd = await queryOne(DB, 'select mprid, branchid from ims_masterproduct where mprid=@mprid limit 1', { mprid: RowSubProd.mprid });
    if (!RowProd) throw nre();
    const BranchId = RowProd.branchid;
    const Row = await queryOne(DB, 'select swpid from tbl_stock_in_store where isoutofstock::int=0 and branchid=@BranchId and sprid=@sprid limit 1',
      { BranchId, sprid: RowSubProd.sprid });
    if (Row == null) Result = 'no';
    return Result;
  }

  // C# overloads stock_in_store_list(string BrCode) and stock_in_store_list() (passes "")
  async stock_in_store_list(BrCode) {
    // PORT-NOTE: Usp_Stock_In_Store_List is not present in the dbshopping.sql dump; called by name as in the C#.
    return mapRows(await proc(DB, 'usp_stock_in_store_list', { brcode: BrCode === undefined ? '' : BrCode }), StockListInBranch.PROPS);
  }
}
stock_in_store.PROPS = ['BranchId', 'BV', 'DAP', 'isOutOfStock', 'MRP', 'PV', 'SComm', 'SpAmt', 'SPRID', 'stockInQty', 'stockNetQty', 'stockOutQty', 'swpid'];
stock_in_store.TABLE = 'tbl_stock_in_store';

class stock_transfer {
  async _stock_transfer_list() {
    return mapRows(await query(DB, 'select * from tbl_stock_transfer order by stid desc'), stock_transfer.PROPS);
  }
}
stock_transfer.PROPS = ['BV', 'driver_name', 'PV', 'remarks', 'report_amount', 'sessionID', 'stchallan', 'stid', 'storeid_from', 'storeid_to', 'total_amount', 'total_qty', 'transfer_date', 'transfer_mode', 'vahicle_no'];
stock_transfer.TABLE = 'tbl_stock_transfer';

stock_in_store.stock_in_store = stock_in_store;
stock_in_store.stock_transfer = stock_transfer;
stock_in_store.StockListInBranch = StockListInBranch;

module.exports = stock_in_store;
