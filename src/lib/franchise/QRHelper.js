/** Exports (static class QRHelper, MVC HtmlHelper extension): async QRCode(string content) : string  (html `<img src="data:image/png;base64,..." alt="content" />`)
 *  Requires npm package: qrcode
 */
'use strict';

// PORT-NOTE: legacy used Gma.QrCodeNet (ErrorCorrectionLevel.H, 5px per module, black on white); `qrcode` is used with the same settings.
async function QRCode(content) {
  const QR = require('qrcode');
  const buf = await QR.toBuffer(content, { errorCorrectionLevel: 'H', scale: 5, margin: 4, color: { dark: '#000000', light: '#FFFFFF' } });
  return '<img src="data:image/png;base64,' + buf.toString('base64') + '" alt="' + content + '" />';
}

module.exports = { QRCode };
