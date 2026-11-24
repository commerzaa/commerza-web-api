/** Exports: class Tbl_ImageGallery (table tbl_imagegallery; props IGID, RegNo, Images, ImageUrl, Status, IsActive)   async GetImageGallery() : Tbl_ImageGallery[] (IsActive 1 and Status 1) */
'use strict';
const { query } = require('../db');
const { mapRows } = require('../utils/shape');

const PROPS = ['IGID', 'RegNo', 'Images', 'ImageUrl', 'Status', 'IsActive'];

class Tbl_ImageGallery {
  async GetImageGallery() {
    return mapRows(await query('affiliate', 'select * from tbl_imagegallery where isactive=1 and status=1'), PROPS);
  }
}

module.exports = Tbl_ImageGallery;
