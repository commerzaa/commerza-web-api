/** Exports: class SaveImage
 *   static IsValidImage(byte[]|Buffer bytes) : int (1 valid image, 0 not)
 *   async SaveImageNmae(int pdfimg, string getimagebytecode, string imgname, string strValidFullName) : string   (instance method)
 * Member Models/SaveImage.cs = ClusterOfferAPI Models/SaveImage.cs WITHOUT SaveBase64Image (API-only). Extends ../SaveImage and hides it.
 */
'use strict';
const Base = require('../SaveImage');

class SaveImage extends Base {}
// Member C# has no SaveBase64Image - hide the inherited API-only static.
Object.defineProperty(SaveImage, 'SaveBase64Image', { value: undefined, writable: true, configurable: true });

module.exports = SaveImage;
