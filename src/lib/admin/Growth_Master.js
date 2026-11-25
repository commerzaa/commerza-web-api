/** Exports: class Growth_Master (table tbl_growthmaster; props GMID, RegNo, Invest_Amount, Invest_Date, Last_Update, DailyGrowth_Rate, Updated_DailyGrowth_Rate, GrowthDays, PaidDays, MaxReturn, CurrentGrowth_Day, CurrentReturn, Withdrawal_Amount, Current_Amount, Status, InvestID)
 *          class GrowtChart (no table; props InvestID, InvestAmount, Date, GrowthRate, GrowthAmount, DayName)
 *   Dispose() : void (no-op, IDisposable)
 *   async InvestorList(Int64 RegNo) : Growth_Master[]  (RegNo && Status, GMID desc)
 *   async InvestorList() : Growth_Master[]  (Status, GMID desc)   -- C# overload: dispatched on argument count
 *   async GrowthChart(Int64 GMID) : GrowtChart[]  (proc Usp_ShowGrowthChart @GMID)
 *   Growth_Master.GrowtChart : class (also ./GrowtChart)
 */
'use strict';
const { query, proc } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Growth_Master', 'tbl_growthmaster', { GMID: 0, RegNo: 0, Invest_Amount: 0, Invest_Date: null, Last_Update: null, DailyGrowth_Rate: 0, Updated_DailyGrowth_Rate: 0, GrowthDays: 0, PaidDays: 0, MaxReturn: 0, CurrentGrowth_Day: 0, CurrentReturn: 0, Withdrawal_Amount: 0, Current_Amount: 0, Status: false, InvestID: null });
const GrowtChart = defineModel('GrowtChart', null, { InvestID: null, InvestAmount: 0, Date: null, GrowthRate: 0, GrowthAmount: 0, DayName: null });

class Growth_Master extends Base {
  Dispose() {}

  async InvestorList(...args) {
    if (args.length === 0) {
      return Base.mapAll(await query(DB, 'select * from tbl_growthmaster where status::int=1 order by gmid desc'));
    }
    const RegNo = args[0];
    return Base.mapAll(await query(DB, 'select * from tbl_growthmaster where regno=@RegNo and status::int=1 order by gmid desc', { RegNo }));
  }

  async GrowthChart(GMID) {
    return GrowtChart.mapAll(await proc(DB, 'usp_showgrowthchart', { gmid: GMID }));
  }
}

module.exports = Growth_Master;
module.exports.GrowtChart = GrowtChart;
