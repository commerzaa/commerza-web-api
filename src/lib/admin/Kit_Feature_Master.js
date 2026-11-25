/** Exports: class Kit_Feature_Master (table tbl_feature_master; props TFMID, FeatureShortExplanation, FeatureBreifExplanation, IsActive, IsDeleted, AddedByUserId, AddedeDate, Quantity, IsEditable, IsShowProductList, IsAutoRedeem)
 *   async GetallKitFeatureList() : Kit_Feature_Master[]  (by TFMID)
 */
'use strict';
const { query, queryOne } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Kit_Feature_Master', 'tbl_feature_master', { TFMID: 0, FeatureShortExplanation: null, FeatureBreifExplanation: null, IsActive: 0, IsDeleted: 0, AddedByUserId: 0, AddedeDate: null, Quantity: 0, IsEditable: 0, IsShowProductList: 0, IsAutoRedeem: 0 });

class Kit_Feature_Master extends Base {
  async GetallKitFeatureList() {
    return Base.mapAll(await query(DB, 'select * from tbl_feature_master order by tfmid'));
  }
}

module.exports = Kit_Feature_Master;
