/** Exports: class SaveImageWithCompressandUnCompres (Models/SaveImageWithCompressandUnCompres.cs)
 *   static async IsValidImage(byte[]|Buffer bytes) : int  (1 valid; 0 => ErrorInsert("IsValidImage", "Controllers/Model/SaveImageWithCompressandUnCompres"))
 *   Getimageformate(Buffer img) : string  (decoder MIME type without "image/": bmp, jpeg, gif, x-emf, x-wmf, tiff, png, x-icon; else "jpg")
 *   async SaveImageNmae(int pdfimg, string getimagebytecode, string imgname, string strValidFullName, int compressAndUnCompress, string extenstion) : string
 *       (same body as SaveImage.SaveImageNmae; compressAndUnCompress / extenstion are unused in the legacy code)
 * PORT-NOTE: System.Drawing.Image parameter of Getimageformate is replaced by the image bytes (format sniffed from magic bytes).
 */
'use strict';
const { _internal } = require('./SaveImage');

class SaveImageWithCompressandUnCompres {
  static async IsValidImage(bytes) {
    return _internal.isValidImage(bytes, 'Controllers/Model/SaveImageWithCompressandUnCompres');
  }

  Getimageformate(img) {
    let extens = '';
    const b = Buffer.from(img || []);
    const hex = (n) => b.slice(0, n).toString('hex');
    let mime = null;
    if (b.length >= 2 && hex(2) === '424d') mime = 'image/bmp';
    else if (b.length >= 3 && hex(3) === 'ffd8ff') mime = 'image/jpeg';
    else if (b.length >= 3 && b.slice(0, 3).toString('latin1') === 'GIF') mime = 'image/gif';
    else if (b.length > 44 && b.readUInt32LE(0) === 1 && b.slice(40, 44).toString('latin1') === ' EMF') mime = 'image/x-emf';
    else if (b.length >= 4 && hex(4) === 'd7cdc69a') mime = 'image/x-wmf';
    else if (b.length >= 4 && (hex(4) === '49492a00' || hex(4) === '4d4d002a')) mime = 'image/tiff';
    else if (b.length >= 8 && hex(8) === '89504e470d0a1a0a') mime = 'image/png';
    else if (b.length >= 4 && hex(4) === '00000100') mime = 'image/x-icon';
    if (mime) {
      extens = mime;
      extens = extens.split('image/').join('');
      return extens;
    }
    return 'jpg';
  }

  async SaveImageNmae(pdfimg, getimagebytecode, imgname, strValidFullName, compressAndUnCompress, extenstion) { // eslint-disable-line no-unused-vars
    return _internal.saveImageNmae(SaveImageWithCompressandUnCompres.IsValidImage, pdfimg, getimagebytecode, imgname, strValidFullName);
  }

  static ThumbnailCallback() {
    const e = new Error('The method or operation is not implemented.');
    e.name = 'NotImplementedException';
    throw e;
  }
}

module.exports = SaveImageWithCompressandUnCompres;
