'use strict';
/**
 * Helpers shared by the batch-22 portal controller ports (ClusterofferShopingPortal Controllers/CustomerPanel:
 * ClassifiedAds, AddNewCommunity, CreateDeal, FreeBusinessKeywords, Posted_Blog, Posted_Classfied, reviews,
 * view_all_notifications, PostShareManagement). Not a router (lives in _shared/, not mounted by src/modules/portal.js).
 * Exports: DB, MAIL_RE, csSubstring(s, start, length), csFromBase64(s), sniffImageFormat(buf), assertImage(buf),
 *          changeExtension(p, ext), safeJoin(dir, name), fileNotFound(p), readTemplate(virtualPath),
 *          runChain(middlewares), customerOrPortalLogin, invalidCastToPortalLogin(), portalLoginOrThrow(req),
 *          fmt00(n), saveThumbProfileImage(base64String, strValidFullName, thresholdKB),
 *          ClassifiedAdsCreateImage(base64String, imagename), ClassifiedAdsGetimageformate(buf), ClassifiedAdsSaveImage(imgecode, titlename)
 */
const fs = require('fs');
const path = require('path');
const ps = require('./portal-session');
const { mapPath, loadSharp } = require('./batch-02-common');
const { csErr, nullRef } = require('./batch-03-common');

const DB = 'shopping';

/** new MailAddress(x) acceptance (rough): one "@" with text on both sides */
const MAIL_RE = /^[^@\s]+@[^@\s]+$/;

/** string.Substring(start, length) with the .NET ArgumentOutOfRangeException */
function csSubstring(s, start, length) {
  if (start < 0 || length < 0 || start + length > s.length) {
    throw csErr('ArgumentOutOfRangeException', 'Index and length must refer to a location within the string.');
  }
  return s.substr(start, length);
}

/** Convert.FromBase64String (FormatException on invalid input) */
function csFromBase64(s) {
  if (s === null || s === undefined) throw csErr('ArgumentNullException', "Value cannot be null.\r\nParameter name: s");
  const t = String(s).replace(/[ \t\r\n]/g, '');
  if (t.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(t)) {
    throw csErr('FormatException', 'The input is not a valid Base-64 string as it contains a non-base 64 character, more than two padding characters, or an illegal character among the padding characters.');
  }
  return Buffer.from(t, 'base64');
}

/**
 * GDI+ decoder of the bytes (Image.FromStream) => the decoder MimeType without "image/" (ImageCodecInfo.GetImageDecoders()).
 * null when System.Drawing could not have decoded it.
 */
function sniffImageFormat(b) {
  if (!b || !b.length) return null;
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length > 4 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (b.length > 4 && b.slice(0, 4).toString('latin1') === 'GIF8') return 'gif';
  if (b.length > 2 && b[0] === 0x42 && b[1] === 0x4d) return 'bmp';
  if (b.length > 4 && ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0)
    || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 0x2a))) return 'tiff';
  if (b.length > 4 && b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return 'x-icon';
  return null;
}
/** Image.FromStream(ms): ArgumentException "Parameter is not valid." for non-images */
function assertImage(b) {
  const f = sniffImageFormat(b);
  if (!f) throw csErr('ArgumentException', 'Parameter is not valid.');
  return f;
}

/** Path.ChangeExtension(p, ext) */
function changeExtension(p, ext) {
  const base = String(p).replace(/\.[^./\\]*$/, '');
  return ext ? base + '.' + String(ext).replace(/^\./, '') : base + '.';
}

/**
 * Path.Combine(MapPath(folder) + "/" + name). PORT-NOTE (security): file names built from request values (e.g. UserName) are
 * refused when they would escape the target folder (legacy wrote wherever the path pointed).
 */
function safeJoin(dir, name) {
  const full = path.resolve(dir, String(name));
  const root = path.resolve(dir);
  if (full !== root && !full.startsWith(root + path.sep)) throw csErr('ArgumentException', 'Illegal characters in path.');
  return full;
}

const fileNotFound = (p) => csErr('FileNotFoundException', `Could not find file '${p}'.`);

/**
 * new StreamReader(Server.MapPath(virtualPath)).ReadToEnd().
 * PORT-NOTE: the site-root html templates are looked up under config.uploadDir (Server.MapPath equivalent); missing => FileNotFoundException as legacy.
 */
function readTemplate(virtualPath) {
  const full = mapPath(virtualPath);
  if (!fs.existsSync(full)) throw fileNotFound(full);
  return fs.readFileSync(full, 'utf8');
}

/** Runs an array of express middlewares in order, then calls next (or stops when one responds / errors). */
function runChain(mws) {
  const list = mws.flat();
  return (req, res, next) => {
    let i = 0;
    const step = (err) => {
      if (err) return next(err);
      if (i >= list.length) return next();
      const mw = list[i++];
      try { return mw(req, res, step); } catch (e) { return next(e); }
    };
    return step();
  };
}

/**
 * `if (Session["Plid"] == null) return RedirectToAction("Index","Home")` in ClassifiedAds, where Session["Plid"] may hold either
 * the customer Login (JWT) or the Portal_Login put there by AdPayment / PostAdConfirmation (SESSION.md 3.3).
 * Either one passes; otherwise the request is rejected exactly like ps.customerAuth (401 JSON).
 */
const customerOrPortalLogin = [...ps.portalSession, (req, res, next) => {
  if (ps.isCustomer(req) || ps.getPortalLogin(req)) return next();
  return runChain(ps.customerAuth)(req, res, next);
}];

/** (Portal_Login)Session["Plid"] while the session holds a customer Login (SESSION.md 3.3) */
const invalidCastToPortalLogin = () => csErr('InvalidCastException', "Unable to cast object of type 'Login' to type 'Portal_Login'.");

/** (Portal_Login)Session["Plid"] for a session known to be non-null: the Portal_Login, or InvalidCastException for a customer Login. */
function portalLoginOrThrow(req) {
  const pl = ps.getPortalLogin(req);
  if (pl) return pl;
  if (ps.isCustomer(req)) throw invalidCastToPortalLogin();
  return nullRef();
}

/** decimal.ToString("0.00") (MidpointRounding.AwayFromZero) */
function fmt00(n) {
  const v = Number(n);
  const r = Math.sign(v) * Math.round(Math.abs(v) * 100 + 1e-9) / 100;
  return r.toFixed(2);
}

/**
 * The "Member Image" / "Company Logo" block of AddNewCommunity.AddNewMember and FreeBusinessKeywords.SaveOrUpdateBusinessListing,
 * from `b = Convert.FromBase64String(base64String)` on (base64String is the part after "base64,").
 * filesize > thresholdKB => GetThumbnailImage(newWidth, newHeight) (max 300px, 0.5 scale rules of the C#) saved as JPEG; else img.Save(path).
 * PORT-NOTE: resizing needs the optional `sharp` package (lazily required, NOT installed); without it the decoded bytes are written
 * unchanged. Image.FromStream validation is done by signature sniffing.
 */
async function saveThumbProfileImage(base64String, strValidFullName, thresholdKB) {
  const b = csFromBase64(base64String);
  assertImage(b);
  let filesize = b.length;
  filesize = filesize / 1024;
  if (fs.existsSync(strValidFullName)) fs.unlinkSync(strValidFullName);
  // string oldimage = ""; (never set => never deleted)
  fs.mkdirSync(path.dirname(strValidFullName), { recursive: true });
  const sharp = loadSharp();
  if (!sharp) { fs.writeFileSync(strValidFullName, b); return; }
  let meta;
  try { meta = await sharp(b).metadata(); } catch (e) { throw csErr('ArgumentException', 'Parameter is not valid.'); }
  let newWidth = 0; let newHeight = 0; let newWidth1 = 0; let newHeight1 = 0; let radio = 0;
  const scaleFactor = 0.5;
  newWidth1 = Math.trunc(meta.width * scaleFactor);
  newHeight1 = Math.trunc(meta.height * scaleFactor);
  radio = newWidth1 / newHeight1;
  if (filesize > thresholdKB) {
    newWidth = 300; newHeight = 300;
    if (radio === 1) {
      newWidth1 = (meta.width * scaleFactor);
      if (newWidth1 > 300) newWidth1 = 300;
      newHeight1 = (meta.height * scaleFactor);
      if (newHeight1 > 300) newHeight1 = 300;
      newHeight = Math.trunc(newHeight1);
      newWidth = Math.trunc(newWidth1);
    }
    if (radio < 1) {
      newHeight = 300; newWidth1 = 300;
      newWidth1 = newWidth1 * radio;
      newWidth = Math.trunc(newWidth1);
    }
    if (radio > 1) {
      newWidth = 300; newHeight1 = 300;
      newHeight1 = newHeight1 / radio;
      newHeight = Math.trunc(newHeight1);
    }
    if (radio === 1) { newWidth = 300; newHeight = 300; }
    // thumbnail.Save(ms, ImageFormat.Jpeg) -> FromStream -> imgnew.Save(path) (raw format = JPEG)
    const out = await sharp(b).resize(newWidth, newHeight, { fit: 'fill' }).jpeg().toBuffer();
    fs.writeFileSync(strValidFullName, out);
  } else {
    fs.writeFileSync(strValidFullName, b); // img.Save(strValidFullName): same raw format
  }
}

/** ClassifiedAdsController.Getimageformate(System.Drawing.Image img) over the decoded bytes */
function ClassifiedAdsGetimageformate(buf) {
  const f = sniffImageFormat(buf);
  return f === null ? 'jpg' : f;
}

/** Convert.ToInt32(double) (banker's rounding) */
function bankers(x) {
  const f = Math.floor(x); const d = x - f;
  if (d < 0.5) return f;
  if (d > 0.5) return f + 1;
  return f % 2 === 0 ? f : f + 1;
}

/**
 * ClassifiedAdsController.CreateImage(string base64String, string imagename): saves a max-600px JPEG under ../adimages and a 125x125
 * JPEG under ../adimages_Thumb (both with the source extension, like the C#), returns the thumb file name.
 * PORT-NOTE: Server.MapPath("../adimages[_Thumb]") => config.uploadDir/adimages[_Thumb]. Resizing needs the optional `sharp`
 * package (NOT installed): without it the decoded bytes are written unchanged to both files. Format16bppRgb555 colour reduction is not reproduced.
 */
async function ClassifiedAdsCreateImage(base64String, imagename) {
  if (base64String === null || base64String === undefined) nullRef();
  let extens = '';
  base64String = String(base64String).split(' ').join('+');
  if (base64String.includes('base64,')) {
    const IndexNo = base64String.indexOf('/') + 1;
    const lastIndexNo = base64String.indexOf(';');
    csSubstring(base64String, IndexNo, lastIndexNo - IndexNo); // ImageExt (unused)
    const IndexNo1 = base64String.indexOf(',') + 1;
    const Pathlength1 = base64String.length;
    base64String = csSubstring(base64String, IndexNo1, Pathlength1 - IndexNo1);
  }
  const b = csFromBase64(base64String);
  assertImage(b);
  extens = ClassifiedAdsGetimageformate(b);
  let strValidFullName1 = mapPath('../adimages_Thumb') + '/' + (imagename === null || imagename === undefined ? '' : imagename);
  let strValidFullName2 = mapPath('../adimages') + '/' + (imagename === null || imagename === undefined ? '' : imagename);
  strValidFullName1 = changeExtension(strValidFullName1, extens);
  strValidFullName2 = changeExtension(strValidFullName2, extens);
  safeJoin(mapPath('../adimages_Thumb'), path.basename(strValidFullName1));
  safeJoin(mapPath('../adimages'), path.basename(strValidFullName2));
  if (fs.existsSync(strValidFullName1)) fs.unlinkSync(strValidFullName1);
  if (fs.existsSync(strValidFullName2)) fs.unlinkSync(strValidFullName2);
  fs.mkdirSync(path.dirname(strValidFullName1), { recursive: true });
  fs.mkdirSync(path.dirname(strValidFullName2), { recursive: true });
  const sharp = loadSharp();
  if (!sharp) {
    fs.writeFileSync(strValidFullName2, b);
    fs.writeFileSync(strValidFullName1, b);
    return path.basename(strValidFullName1);
  }
  let meta;
  try { meta = await sharp(b).metadata(); } catch (e) { throw csErr('ArgumentException', 'Parameter is not valid.'); }
  let radio = 1;
  const newWidth1 = Math.trunc(meta.width);
  const newHeight1 = Math.trunc(meta.height);
  radio = newWidth1 / newHeight1;
  let iwidth = Math.trunc(meta.width);
  let iheight = Math.trunc(meta.height);
  let abc1 = 600; let abc2 = 600;
  if ((iwidth > 600) || (iheight > 400)) {
    if (radio < 1) abc1 = 600 * radio;
    else if (radio > 1) abc2 = 600 / radio;
    else { abc1 = 600; abc2 = 400; }
    iwidth = bankers(abc1); iheight = bankers(abc2);
    if (radio < 1) {
      if ((iwidth > 600) || (iheight > 600)) { iwidth = bankers(iwidth * radio); iheight = bankers(iheight * radio); }
    }
    if (radio > 1) {
      if ((iwidth > 600) || (iheight > 600)) { iwidth = bankers(iwidth / radio); iheight = bankers(iheight / radio); }
    }
  }
  // ImageCodecInfo.GetImageEncoders()[1] = JPEG
  fs.writeFileSync(strValidFullName2, await sharp(b).resize(iwidth, iheight, { fit: 'fill' }).flatten({ background: '#000000' }).jpeg({ quality: 100 }).toBuffer());
  // ======================small
  fs.writeFileSync(strValidFullName1, await sharp(b).resize(125, 125, { fit: 'fill' }).flatten({ background: '#000000' }).jpeg({ quality: 100 }).toBuffer());
  return path.basename(strValidFullName1);
}

/** ClassifiedAdsController.saveImage(string imgecode, string titlename) */
async function ClassifiedAdsSaveImage(imgecode, titlename) {
  if (titlename === null || titlename === undefined) throw csErr('ArgumentNullException', "Value cannot be null.\r\nParameter name: input");
  const UtilityClass = require('../../../lib/portal/UtilityClass');
  titlename = String(titlename).replace(/[^0-9a-zA-Z]+/g, '');
  titlename = titlename.replace(/[\s+]/g, '');
  let returnfilename = '';
  if (titlename.length > 5) titlename = titlename.substring(0, 4);
  if (imgecode === null || imgecode === undefined) nullRef();
  const getcolltionimage = String(imgecode).split('^');
  for (const items of getcolltionimage) {
    let filenames = '';
    filenames = titlename.trim() + await UtilityClass.getRandomName();
    if ((items.trim() !== '') && (items.includes('base64,'))) {
      const getnewfilename = await ClassifiedAdsCreateImage(items, filenames);
      if (getnewfilename.trim() !== '') {
        if (returnfilename.trim() === '') returnfilename = getnewfilename;
        else returnfilename = returnfilename + '^' + getnewfilename;
      }
    }
  }
  return returnfilename;
}

module.exports = {
  DB, MAIL_RE, csSubstring, csFromBase64, sniffImageFormat, assertImage, changeExtension, safeJoin, fileNotFound, readTemplate,
  runChain, customerOrPortalLogin, invalidCastToPortalLogin, portalLoginOrThrow, fmt00, saveThumbProfileImage,
  ClassifiedAdsCreateImage, ClassifiedAdsGetimageformate, ClassifiedAdsSaveImage,
};
