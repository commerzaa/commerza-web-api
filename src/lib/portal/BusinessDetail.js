/**
 * Exports: class BusinessDetail {
 *   async GetBusinessInfo(long pmid): BusinessInfo[]; async GetReoutines(int pmid): Routine[]; async GetServiceHighlights(int pmid): Portal_Product_Desc[];
 *   async GetFillGrid(int pmid): FillGrid[]; async GetVideo(int pmid): Video[]; async Getfillgridenu(int pmid): fillgridenu[];
 *   async Getbidnpaytypes(int pmid): paytypes[]; async GetbindReviewsComments(int pmid): ReviewsComments[]; async GetMapDetail(int pmid): string|null;
 *   async GetPortalInfo(fromemailid, fromname, toemailid, toname, ccname, ccemailid, subject, message, ipaddress, ipcountry, ipstate, ipcity, Int64 pmid, mobile): int;
 *   async GetProductImage(int pmid): ProductImageList[]; async GetProductPhotoGallery(int pmid): Portalmember_Photogallery[]; async getLocation(int pmid): Locations }
 * Also exported (property lists of the model classes declared in BusinessDetail.cs): BusinessDetail.Models
 * Portal DataBaseContext = Db_Shopping. Legacy string-concatenated SQL is parameterised.
 */
'use strict';
const db = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');

const DB = 'shopping';
const Models = {
  BusinessInfo: ['Title', 'CatName'],
  Routine: ['id', 'dayid', 'status', 'openingtime', 'closingtime', 'officeday', 'breaktime'],
  ReviewsComments: ['ptmid', 'paylog'],
  paytypes: ['ptmid', 'paylog'],
  fillgridenu: ['productimgname', 'productdesc', 'productname'],
  Video: ['Id', 'Name', 'Data'],
  FillGrid: ['CompanyImage', 'pmid', 'actualurl', 'title', 'mobileno', 'address', 'citystatename', 'cityname', 'areaname', 'companyname', 'accounttype',
    'countryName', 'comemailid', 'URL', 'yearofestable', 'cid', 'ctid'],
  Portal_Product_Desc: ['PPID', 'PRODUCTNAME', 'PRODUCTDESC', 'ACTIVE', 'PMID', 'PRODUCTIMGNAME', 'SRNO'],
  ProductImageList: ['rowNumber', 'imageUrl', 'imageTitle'],
  Portalmember_Photogallery: ['PMPGID', 'PMID', 'IMAGENAME', 'ACTIVE'],
  Locations: ['LID', 'PMID', 'AREANAME', 'CITYNAME', 'LONGITUDE', 'LATITUDE', 'DISCRIPTION', 'ACTIVE'],
};

class BusinessDetail {
  async GetBusinessInfo(pmid) {
    return mapRows(await db.proc(DB, 'usp_catname_title_detailspage', { pmid }), Models.BusinessInfo);
  }

  async GetReoutines(pmid) {
    const query = `select id, dayid, status, openingtime,
        case when coalesce(openingtimeevening, '') <> '' then (openingtimeevening || ' - ' || closingtimeevening) else '' end as breaktime, closingtime,
        case when dayid = 1 then 'Monday' when dayid = 2 then 'Tuesday' when dayid = 3 then 'Wednesday' when dayid = 4 then 'Thursday'
             when dayid = 5 then 'Friday' when dayid = 6 then 'Saturday' when dayid = 7 then 'Sunday' else '' end as officeday
      from tblopeningdate where pmid = @pmid order by dayid asc`;
    return mapRows(await db.query(DB, query, { pmid }), Models.Routine);
  }

  async GetServiceHighlights(pmid) {
    const rows = await db.query(DB, 'select * from portal_product_desc where pmid = @pmid and active = true', { pmid });
    return mapRows(rows, Models.Portal_Product_Desc);
  }

  async GetFillGrid(pmid) {
    return mapRows(await db.proc(DB, 'usp_showbusinessdetails', { pmid }), Models.FillGrid);
  }

  async GetVideo(pmid) {
    const rows = await db.query(DB, 'select id, name, data from videodata where status = 1 and pmid = @pmid limit 12', { pmid });
    return mapRows(rows, Models.Video);
  }

  async Getfillgridenu(pmid) {
    const rows = await db.query(DB, "select ('portalproduct/' || productimgname) as productimgname, productdesc, productname from portal_product_desc where active = true and pmid = @pmid order by srno asc", { pmid });
    return mapRows(rows, Models.fillgridenu);
  }

  async Getbidnpaytypes(pmid) {
    return mapRows(await db.proc(DB, 'usp_getdiffpaymethodonpmid', { pmid }), Models.paytypes);
  }

  async GetbindReviewsComments(pmid) {
    return mapRows(await db.proc(DB, 'usp_getproductreviewsandcomments', { pmid }), Models.ReviewsComments);
  }

  async GetMapDetail(pmid) {
    const rows = await db.query(DB, 'select areaname from locations where pmid = @pmid', { pmid });
    return rows.length ? rows[0].areaname : null; // FirstOrDefault()
  }

  async GetPortalInfo(fromemailid, fromname, toemailid, toname, ccname, ccemailid, subject, message, ipaddress, ipcountry, ipstate, ipcity, pmid, mobile) {
    let ret = 0;
    const row = await db.procOne(DB, 'usp_portalinbox', {
      fromemailid, fromname, toemailid, toname, ccemailid, ccname, message, subject, ipaddress, ipcountry, ipstate, ipcity, pmid, mobile,
    });
    let v;
    if (row) {
      const k = Object.keys(row).find((x) => x.toLowerCase() === 'intresult');
      v = k !== undefined ? row[k] : row[Object.keys(row)[0]];
    }
    if (v === null || v === undefined) throw new TypeError('Object reference not set to an instance of an object.');
    ret = parseInt(String(v), 10);
    if (Number.isNaN(ret)) throw new Error('Input string was not in a correct format.');
    return ret;
  }

  async GetProductImage(pmid) {
    return mapRows(await db.proc(DB, 'usp_showproductimage', { pmid }), Models.ProductImageList);
  }

  async GetProductPhotoGallery(pmid) {
    const rows = await db.query(DB, 'select * from portalmember_photogallery where pmid = @pmid and active = true', { pmid });
    return mapRows(rows, Models.Portalmember_Photogallery);
  }

  async getLocation(pmid) {
    const Location = await db.queryOne(DB, 'select * from locations where pmid = @pmid limit 1', { pmid });
    if (Location === null) {
      return {
        LID: 0, PMID: 0, AREANAME: 'East Delhi', CITYNAME: 'Delhi', LONGITUDE: '77.12', LATITUDE: '28.38', DISCRIPTION: '', ACTIVE: true,
      };
    }
    return mapRow(Location, Models.Locations);
  }
}

BusinessDetail.Models = Models;
module.exports = BusinessDetail;
