/** Portal port of Models/Save_ImageFile.cs. Same as ../Save_ImageFile except: UploadImageFile swallows exceptions silently (no ErrorInsert), GetFileNmae uses the portal UtilityClass.
 * Exports (static class Save_ImageFile):
 *   async UploadImageFile(string ImageType, string ImageByteCode, string AppConfigKey) : string   (saved file name)
 *   async GetFileNmae(string filepaths, string Extenstion) : string
 *   IsValidImage(byte[]|Buffer bytes) : bool
 *   GetRandom() : string
 *   MapPath(string virtualPath) : string  (helper: Server.MapPath equivalent => config.uploadDir/<folder>)
 * PORT-NOTE: System.Drawing is not available. IsValidImage sniffs the image magic bytes (BMP/GIF/JPEG/PNG/TIFF/ICO/WMF/EMF).
 * UploadImageFile re-encoded the picture through GetThumbnailImage at 100% size in a background thread; here the decoded
 * original bytes are written (in a background task) to <uploadDir>/<config.app[AppConfigKey]>/<name>.jpg.
 * PORT-NOTE: SavePaths came from AppSettings[AppConfigKey]; it is read from config.app[AppConfigKey] (folder name, e.g. 'KYC_Images').
 */
'use strict';
const fs = require('fs');
const path = require('path');
const config = require('../../config');
const { fire } = require('../_libhelpers');

/** Server.MapPath("~/x/y") => <uploadDir>/x/y */
function MapPath(virtualPath) {
  let p = virtualPath === null || virtualPath === undefined ? '' : String(virtualPath);
  p = p.replace(/^~/, '').replace(/^[\\/]+/, '');
  return path.join(config.uploadDir, p);
}

function IsValidImage(bytes) {
  const b = Buffer.from(bytes || []);
  if (b.length < 4) return false;
  const hex = (n) => b.slice(0, n).toString('hex');
  if (hex(2) === '424d') return true; // BMP
  if (b.slice(0, 3).toString('latin1') === 'GIF') return true; // GIF
  if (hex(3) === 'ffd8ff') return true; // JPEG
  if (hex(8) === '89504e470d0a1a0a') return true; // PNG
  if (hex(4) === '49492a00' || hex(4) === '4d4d002a') return true; // TIFF
  if (hex(4) === '00000100') return true; // ICO
  if (hex(4) === 'd7cdc69a') return true; // WMF placeable
  if (b.length > 44 && b.readUInt32LE(0) === 1 && b.slice(40, 44).toString('latin1') === ' EMF') return true; // EMF
  return false;
}

function GetRandom() {
  const _allowedChars = '0123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNOPQRSTUVWXYZ';
  let s = '';
  for (let i = 0; i < 10; i++) {
    s += _allowedChars[Math.floor(_allowedChars.length * Math.random())];
  }
  return s;
}

async function UploadImageFile(ImageType, ImageByteCode, AppConfigKey) {
  let imgname = '';

  try {
    if (ImageByteCode.includes('base64,')) {
      if (ImageByteCode.trim() !== '') {
        let base64String = '';
        const SavePaths = config.app[AppConfigKey];
        if (ImageByteCode !== '') {
          base64String = ImageByteCode;
          let ProfileImage = ImageType;
          ProfileImage = ProfileImage.trim();
          ProfileImage = ProfileImage.split('&amp;').join('And');
          ProfileImage = ProfileImage.split('&').join(' And ');
          ProfileImage = ProfileImage.replace(/[^\p{L}\p{Mn}\p{Nd}\p{Pc}]/gu, '');
          ProfileImage = ProfileImage.split(' ').join('-');
          imgname = ProfileImage + '-' + GetRandom() + '.jpg';
        } else {
          imgname = ' ';
        }
        const strValidFullName = path.join(MapPath(SavePaths), imgname);
        if (base64String.includes('base64,')) {
          const IndexNo1 = base64String.indexOf(',') + 1;
          base64String = base64String.substring(IndexNo1);
        }
        const b = Buffer.from(base64String, 'base64');
        if (!IsValidImage(b)) throw new Error('Parameter is not valid.'); // Image.FromStream ArgumentException
        if (fs.existsSync(strValidFullName)) {
          fs.unlinkSync(strValidFullName);
        }

        // legacy: background thread that re-encodes and saves the picture
        fire(async () => {
          fs.mkdirSync(path.dirname(strValidFullName), { recursive: true });
          fs.writeFileSync(strValidFullName, b);
        });
      }
    } else {
      ImageByteCode = ImageByteCode.replace(/^\/+|\/+$/g, '');
      const imgname1 = ImageByteCode.split('/');
      if (imgname1.length < 2) throw new RangeError('Index was outside the bounds of the array.');
      imgname = imgname1[1].toString();
    }
  } catch (ex) {
    // legacy (portal): empty catch
  }
  return imgname;
}

async function GetFileNmae(filepaths, Extenstion) {
  let duplicate = false;
  while (duplicate === false) {
    const UtilityClass = require('./UtilityClass');
    const rand = await UtilityClass.Generatetxnid();
    filepaths = filepaths.split('.' + Extenstion).join('') + '_' + rand + '.' + Extenstion;
    if (fs.existsSync(filepaths)) {
      duplicate = false;
    } else {
      duplicate = true;
    }
  }
  return filepaths;
}

module.exports = { UploadImageFile, GetFileNmae, IsValidImage, GetRandom, MapPath };
