/** Exports: class Photo_Gallary (table tbl_photogallary; props PGID, ImageTitle, ImageName, Date, type, Status)
 *   async AddPhoto(string Type, string ImageName, string ImageTitle) : string  (INSERT tbl_photogallary, Date = UTC now, Status true; "success" | "Failed")
 *   async RemovePhoto(int PGID) : string  (DELETE by PGID; "success"; missing row / error => ErrorInsert("RemovePhoto", "Controllers/Model/Photo_Gallary") + "Failed")
 *   async ShowPhotoGallaryDetails(int PGID) : Photo_Gallary | null  (PGID && Status, Date desc)
 *   async ShowPhotoGallary(string Type) : Photo_Gallary[]  (type && Status)
 */
'use strict';
const { query, queryOne, exec } = require('../../db');
const { defineModel, errorInsert, DB } = require('./_models');

const Base = defineModel('Photo_Gallary', 'tbl_photogallary', { PGID: 0, ImageTitle: null, ImageName: null, Date: null, type: null, Status: false });

class Photo_Gallary extends Base {
  async AddPhoto(Type, ImageName, ImageTitle) {
    const ret = await exec(DB, "insert into tbl_photogallary (imagetitle, imagename, type, date, status) values (@ImageTitle, @ImageName, @Type, (now() at time zone 'utc'), true)", { ImageTitle, ImageName, Type });
    if (ret > 0) {
      return 'success';
    } else {
      return 'Failed';
    }
  }

  async RemovePhoto(PGID) {
    try {
      const row = await queryOne(DB, 'select pgid from tbl_photogallary where pgid=@PGID limit 1', { PGID });
      if (row === null) throw new TypeError("Value cannot be null.\r\nParameter name: entity"); // EF Remove(null)
      await exec(DB, 'delete from tbl_photogallary where pgid=@PGID', { PGID });
      return 'success';
    } catch (ExpObj) {
      await errorInsert(0, ExpObj.message, 'RemovePhoto', 0, 'Controllers/Model/Photo_Gallary');
      return 'Failed';
    }
  }

  async ShowPhotoGallaryDetails(PGID) {
    return Base.map(await queryOne(DB, 'select * from tbl_photogallary where pgid=@PGID and status::int=1 order by date desc limit 1', { PGID }));
  }

  async ShowPhotoGallary(Type) {
    return Base.mapAll(await query(DB, 'select * from tbl_photogallary where type=@Type and status::int=1', { Type }));
  }
}

module.exports = Photo_Gallary;
