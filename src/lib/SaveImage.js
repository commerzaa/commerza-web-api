/** Exports: class SaveImage
 *   static IsValidImage(byte[]|Buffer bytes) : int (1 valid image, 0 not)
 *   async SaveImageNmae(int pdfimg, string getimagebytecode, string imgname, string strValidFullName) : string   (instance method)
 *   static async SaveBase64Image(string base64String, string folderRelativePath) : string   ("Success:/<folder>/<guid>.<ext>" | "Error: ..."; throws Error on failure)
 * PORT-NOTE: System.Drawing image decode/re-save is not available: image bytes are written unchanged (same as the non-image branch).
 * PORT-NOTE: Server.MapPath(folderRelativePath) => config.uploadDir/<folderRelativePath without leading ~ or />.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Save_ImageFile = require('./Save_ImageFile');
const Global = require('./Global');

// C# string.Substring(start, length) throws when out of range
function substr(s, start, len) {
  if (start < 0 || len < 0 || start + len > s.length) throw new RangeError('Index and length must refer to a location within the string.');
  return s.substr(start, len);
}

class SaveImage {
  static IsValidImage(bytes) {
    return Save_ImageFile.IsValidImage(bytes) ? 1 : 0;
  }

  async SaveImageNmae(pdfimg, getimagebytecode, imgname, strValidFullName) {
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
      const retrunimagetype = SaveImage.IsValidImage(b);

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

  static async SaveBase64Image(base64String, folderRelativePath) {
    try {
      // Example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
      base64String = base64String.trim();
      base64String = base64String.split('\n').join('').split('\r').join('');
      const match = /data:image\/(.+?);base64,(.+)/.exec(base64String);
      if (!match) throw new Error('Invalid base64 image format');

      // Extract extension and image bytes
      const fileType = match[1]; // png, jpeg, etc.
      if (!Global.Extension.includes('.' + fileType)) {
        return 'Error: Invalid File formate upoload only image!!';
      }

      const base64Data = match[2];
      const imageBytes = Buffer.from(base64Data, 'base64');

      // Generate unique filename
      const fileName = `${crypto.randomUUID()}.${fileType}`;

      // Convert relative path (e.g., "~/Images/Uploads") to physical path
      const folderPath = Save_ImageFile.MapPath(folderRelativePath);

      // Ensure directory exists
      if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });

      // Full file path
      const filePath = path.join(folderPath, fileName);

      // Save image
      fs.writeFileSync(filePath, imageBytes);

      // Return relative path to saved file
      return `Success:/${folderRelativePath.replace(/^~+/, '').replace(/^\/+/, '')}/${fileName}`;
    } catch (ex) {
      throw new Error('Error saving Base64 image: ' + ex.message);
    }
  }
}

module.exports = SaveImage;
