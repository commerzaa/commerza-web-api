/**
 * Exports: class PhotoGallary { async InsertPhoto(string ImageName, Int32 pmid): string }  (internal in C#; C# file PhotoGallery.cs, class PhotoGallary)
 * Also exposed as PhotoGallery (alias of the same class).
 */
'use strict';
const db = require('../../db');
const { outValue } = require('../_http');

class PhotoGallary {
  async InsertPhoto(ImageName, pmid) {
    const row = await db.procOne('shopping', 'usp_uploadzone_new', {
      imagename: ImageName, url: '', pmid, name: '', contenttype: '', data: '', title: '', compnyimg: '', pdfname: '', intmode: 'ImageName',
    });
    return outValue(row, 'intResult'); // @intResult OUT
  }
}

module.exports = PhotoGallary;
module.exports.PhotoGallary = PhotoGallary;
module.exports.PhotoGallery = PhotoGallary;
