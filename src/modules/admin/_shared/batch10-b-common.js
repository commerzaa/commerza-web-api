'use strict';
/**
 * Helpers private to admin port batch10 (fork B) (not a router).
 * Exports: SQL_EMPTY_DATETIME, addReferalLink(p), referalLinkDir(), saveLogoImage(Images, fileName, loginid)
 */
const fs = require('fs');
const path = require('path');
const db = require('../../../db');
const config = require('../../../config');
const { DB, nullRef, decodeBase64Image } = require('./batch10-common');

// PORT-NOTE: USP_ADDREFERAL_LINK declares @DATE DATETIME and @RLID/@Active INT; legacy passed "" / "0" and SQL Server converted them
// implicitly ('' => 1900-01-01 00:00:00, '' => 0, '0' => 0). PostgreSQL does not cast '' to timestamp/int, so the converted values are passed.
const SQL_EMPTY_DATETIME = '1900-01-01 00:00:00';

/** USP_ADDREFERAL_LINK @TITLE,@IMAGE,@URL,@DATE,@MODE,@RLID,@Active,@STRRESULT out */
async function addReferalLink(p) {
  return db.proc(DB, 'USP_ADDREFERAL_LINK', {
    TITLE: p.TITLE, IMAGE: p.IMAGE, URL: p.URL, DATE: SQL_EMPTY_DATETIME, MODE: p.MODE, RLID: p.RLID, Active: p.Active,
  });
}

/**
 * Server.MapPath(AppSettings["ReferalLink"]) (Web.config value "../ReferalLinkImage", resolved against the request folder => app root).
 * PORT-NOTE: leading "~", "/" and "../" segments are dropped so the folder stays inside config.uploadDir.
 */
function referalLinkDir() {
  const SavePaths = config.app.ReferalLink || '';
  return path.join(config.uploadDir, String(SavePaths).replace(/^~/, '').replace(/^([\/]|\.\.[\/]|\.[\/])+/, ''));
}

/** #region LogoImage (identical in AddNewReferalLink and UpdatImageReferalLink of MemberManageList / MemberTaskReport) => imgname */
async function saveLogoImage(Images, fileName, loginid) {
  let imgname = '';
  if (Images === null || Images === undefined) throw nullRef(); // Images.Trim()
  if (String(Images).trim() !== '') {
    let base64String = '';
    if (Images !== '') {
      base64String = String(Images);
      let ProfileImage = loginid;
      if (ProfileImage === null || ProfileImage === undefined) throw nullRef();
      ProfileImage = String(ProfileImage).trim();
      ProfileImage = ProfileImage.split('&amp;').join('And');
      ProfileImage = ProfileImage.split('&').join(' And ');
      ProfileImage = ProfileImage.replace(/[^\w\d]/g, '');
      ProfileImage = ProfileImage.split(' ').join('-');
      imgname = ProfileImage + '-' + (fileName === null || fileName === undefined ? '' : fileName) + '.png';
    } else {
      imgname = ' ';
    }
    const strValidFullName = path.join(referalLinkDir(), imgname);
    if (base64String.includes('base64,')) {
      const IndexNo = base64String.indexOf('/') + 1;
      const lastIndexNo = base64String.indexOf(';');
      if (lastIndexNo - IndexNo < 0 || lastIndexNo < 0) {
        throw new Error('Length cannot be less than zero.\r\nParameter name: length'); // Substring ArgumentOutOfRangeException
      }
      const ImageExt = base64String.substring(IndexNo, lastIndexNo); void ImageExt;
      const IndexNo1 = base64String.indexOf(',') + 1;
      base64String = base64String.substring(IndexNo1);
    }
    const b = decodeBase64Image(base64String); // Convert.FromBase64String
    const sharp = require('sharp'); // System.Drawing.Image.FromStream (throws on an invalid image)
    await sharp(b).metadata();
    const filesize = b.length / 1024; void filesize;
    if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
    const oldimage = ''; // param[9].Value.ToString() (always "" in legacy)
    if (oldimage !== '') {
      const o = path.join(referalLinkDir(), oldimage);
      if (fs.existsSync(o)) fs.unlinkSync(o);
    }
    // PORT-NOTE: img.Save(path) re-encoded with System.Drawing in the image's raw format; the decoded bytes are written as-is.
    fs.mkdirSync(path.dirname(strValidFullName), { recursive: true });
    fs.writeFileSync(strValidFullName, b);
  }
  return imgname;
}

module.exports = { SQL_EMPTY_DATETIME, addReferalLink, referalLinkDir, saveLogoImage };
