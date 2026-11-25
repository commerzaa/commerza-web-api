/** Exports: class SaveImage (Models/SaveImage.cs)
 *   static async IsValidImage(byte[]|Buffer bytes) : int  (1 valid image; 0 not => ErrorInsert("IsValidImage", "Controllers/Model/SaveImage"))
 *   async SaveImageNmae(int pdfimg, string getimagebytecode, string imgname, string strValidFullName) : string  (instance; returns the saved file name)
 * Override of ../member/SaveImage.js: the admin IsValidImage catches every exception and logs it through DataUtility.ErrorInsert
 * (the Member one only catches ArgumentException and logs nothing); SaveImageNmae is otherwise identical but must call the admin IsValidImage.
 * PORT-NOTE: System.Drawing is not available: validity is sniffed from the magic bytes (../Save_ImageFile.IsValidImage) and
 *   Image.Save(path) is replaced by writing the decoded bytes unchanged.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Save_ImageFile = require('../Save_ImageFile');
const { errorInsert } = require('./_models');

// C# string.Substring(start, length) throws when out of range
function substr(s, start, len) {
  if (start < 0 || len < 0 || start + len > s.length) throw new RangeError('Index and length must refer to a location within the string.');
  return s.substr(start, len);
}

async function isValidImage(bytes, errorUrl) {
  try {
    if (!Save_ImageFile.IsValidImage(bytes)) throw new Error('Parameter is not valid.'); // Image.FromStream ArgumentException
  } catch (ExpObj) {
    await errorInsert(0, ExpObj.message, 'IsValidImage', 0, errorUrl);
    return 0;
  }
  return 1;
}

// shared body of SaveImage.SaveImageNmae / SaveImageWithCompressandUnCompres.SaveImageNmae (identical C#)
async function saveImageNmae(IsValidImage, pdfimg, getimagebytecode, imgname, strValidFullName) {
  // pdfimg if pdfimg=1 then only image else pdfimg  file
  if (getimagebytecode.includes('base64,')) {
    let ImageExt = '';
    const IndexNo = getimagebytecode.indexOf('/') + 1;
    const lastIndexNo = getimagebytecode.indexOf(';');
    ImageExt = substr(getimagebytecode, IndexNo, lastIndexNo - IndexNo);
    const IndexNo1 = getimagebytecode.indexOf(',') + 1;
    const Pathlength1 = getimagebytecode.length;
    getimagebytecode = substr(getimagebytecode, IndexNo1, Pathlength1 - IndexNo1);
    imgname = imgname.replace(/[^0-9a-zA-Z]+/g, '') + '.' + ImageExt;
    strValidFullName = strValidFullName + '/' + imgname;
    const b = Buffer.from(getimagebytecode, 'base64');
    const retrunimagetype = await IsValidImage(b);
    if (fs.existsSync(strValidFullName)) {
      const rand = String(Math.floor(Math.random() * 99999));
      strValidFullName = strValidFullName.split('.' + ImageExt).join('') + '_' + rand + '.' + ImageExt;
    }
    if (pdfimg === 1) {
      if (retrunimagetype === 1) {
        fs.writeFileSync(strValidFullName, b); // img.Save(strValidFullName)
      } else if (imgname !== null && imgname.length > 0 && b !== null) {
        fs.writeFileSync(strValidFullName, b);
      }
    } else if (imgname !== null && imgname.length > 0 && b !== null) {
      fs.writeFileSync(strValidFullName, b);
    }
  }
  getimagebytecode = path.basename(strValidFullName);
  return getimagebytecode;
}

class SaveImage {
  static async IsValidImage(bytes) {
    return isValidImage(bytes, 'Controllers/Model/SaveImage');
  }

  async SaveImageNmae(pdfimg, getimagebytecode, imgname, strValidFullName) {
    return saveImageNmae(SaveImage.IsValidImage, pdfimg, getimagebytecode, imgname, strValidFullName);
  }

  // private static bool ThumbnailCallback() { throw new NotImplementedException(); }
  static ThumbnailCallback() {
    const e = new Error('The method or operation is not implemented.');
    e.name = 'NotImplementedException';
    throw e;
  }
}

module.exports = SaveImage;
module.exports._internal = { isValidImage, saveImageNmae };
