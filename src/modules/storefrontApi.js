'use strict';
const express = require('express');
const db = require('../db');
const asyncHandler = require('../middleware/asyncHandler');
const { parsePagination, buildPagination } = require('../lib/pagination');
const { readLimiter } = require('../lib/rateLimiters');
const { ensureCommerzaSchema } = require('../lib/commerzaSchema');

const router = express.Router();
const DB = 'shopping';
const FALLBACK_IMAGE = '/images/product-thumb-1.png';

const slugify = (v) =>
  String(v || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const decodeText = (v) =>
  String(v || '')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim();

/** Accepts only http(s) or root-relative URLs; rejects base64 data URIs. */
function safeImageUrl(raw, fallback = FALLBACK_IMAGE) {
  const s = String(raw || '').trim();
  if (!s || /^data:/i.test(s)) return fallback;
  if (/^https?:\/\//i.test(s) || s.startsWith('/')) return s;
  return fallback;
}

function parseGalleryUrls(raw) {
  const parts = String(raw || '')
    .split(/[;,|]/)
    .map((p) => p.trim())
    .filter((p) => p && !/^data:/i.test(p) && (/^https?:\/\//i.test(p) || p.startsWith('/')));
  return parts.length > 0 ? parts : [FALLBACK_IMAGE];
}

function groupIcon(name) {
  const n = String(name || '').toLowerCase();
  if (n.includes('electron') || n.includes('mobile') || n.includes('computer')) return 'bi-laptop';
  if (n.includes('fashion') || n.includes('cloth') || n.includes('apparel') || n.includes('shoe')) return 'bi-handbag';
  if (n.includes('home') || n.includes('kitchen') || n.includes('furniture')) return 'bi-house-heart';
  if (n.includes('grocery') || n.includes('food') || n.includes('fruit') || n.includes('beverage')) return 'bi-basket';
  if (n.includes('beauty') || n.includes('health') || n.includes('personal')) return 'bi-heart-pulse';
  if (n.includes('sport') || n.includes('fitness')) return 'bi-trophy';
  if (n.includes('book') || n.includes('stationery')) return 'bi-book';
  return 'bi-grid';
}

function mapProductRow(r) {
  const mrp = Number(r.sellmrp || r.actualprice || 0);
  const dap = Number(r.dap || 0);
  const price = dap > 0 && dap <= mrp ? dap : mrp;
  const originalPrice = mrp > price ? mrp : price;
  const discountPercent =
    originalPrice > price
      ? Math.round(((originalPrice - price) / originalPrice) * 100)
      : Number(r.discountpercentage || 0);
  const galleryImages = parseGalleryUrls(r.productimages);
  const rating = Number(r.ratingstar || 4.4);
  const inStock = !r.isoutofstock && Number(r.stocknet ?? 1) > 0;

  return {
    id: String(r.sprid),
    sprid: Number(r.sprid),
    mprid: Number(r.mprid),
    pmid: Number(r.pmid || 0),
    name: decodeText(r.producttitle || r.subprcode || 'Product'),
    category: decodeText(r.catname || 'General'),
    catid: r.catid ? Number(r.catid) : null,
    parentCategory: decodeText(r.groupname || ''),
    gmid: r.gmid ? Number(r.gmid) : null,
    subCategory: decodeText(r.scatname || ''),
    subcatid: r.subcategoryid ? Number(r.subcategoryid) : null,
    price,
    originalPrice,
    discountPercent,
    image: galleryImages[0],
    galleryImages,
    rating,
    reviewsCount: 0,
    unit: String(r.unit || 'pcs'),
    color: String(r.color || ''),
    colorHex: String(r.color_hex || ''),
    size: String(r.size || ''),
    inStock,
    stockNet: Number(r.stocknet || 0),
    isFeatured: discountPercent >= 15,
    isPopular: rating >= 4.5,
    isBestSeller: discountPercent >= 20,
    description: String(r.fulldescription || r.shotdescription || ''),
    brand: String(r.manufacturerdetails || ''),
    storeName: String(r.companyname || ''),
    tags: [r.productcode, r.groupname, r.catname, r.scatname, r.brand, r.color, r.size]
      .filter((t) => typeof t === 'string' && t.trim().length > 0),
  };
}

router.get('/api/storefront/categories', readLimiter, asyncHandler(async (_req, res) => {
  await ensureCommerzaSchema();
  const [groups, cats, subs, counts] = await Promise.all([
    db.query(
      DB,
      'SELECT gmid, groupname, COALESCE(show_in_nav, true) AS show_in_nav, COALESCE(nav_order, 0) AS nav_order FROM dbo.tbl_categorygroupmaster WHERE COALESCE(status, 1) = 1 ORDER BY COALESCE(nav_order, 0) ASC, gmid ASC'
    ),
    db.query(
      DB,
      `SELECT c.catid, c.catname, c.gmid, COALESCE(NULLIF(c.image_url, ''), c.catimgname, '') AS image_url
       FROM dbo.product_category c
       WHERE COALESCE(c.catactive, true) = true
       ORDER BY c.catid ASC`
    ),
    db.query(
      DB,
      `SELECT sc.scatid, sc.scatname, sc.catid
       FROM dbo.product_subcategory sc
       WHERE COALESCE(sc.scatactive, true) = true
       ORDER BY sc.scatid ASC`
    ),
    db.query(
      DB,
      `SELECT mp.catid, COUNT(*)::int AS cnt
       FROM dbo.ims_subproduct sp
       JOIN dbo.ims_masterproduct mp ON mp.mprid = sp.mprid
       WHERE COALESCE(sp.isactive, true) = true AND COALESCE(sp.isverified, 0) = 1
       GROUP BY mp.catid`
    ),
  ]);

  const countByCat = new Map(counts.map((r) => [Number(r.catid), Number(r.cnt || 0)]));
  const subsByCat = new Map();
  for (const sc of subs) {
    const cid = Number(sc.catid || 0);
    if (!subsByCat.has(cid)) subsByCat.set(cid, []);
    subsByCat.get(cid).push(decodeText(sc.scatname));
  }

  const groupMap = new Map(groups.map((g) => [Number(g.gmid), g]));
  const catsByGroup = new Map();
  const categories = cats.map((c) => {
    const cid = Number(c.catid);
    const gid = Number(c.gmid || 0);
    const parent = groupMap.get(gid);
    const itemCount = countByCat.get(cid) || 0;
    const catName = decodeText(c.catname);
    const parentName = parent ? decodeText(parent.groupname) : '';
    const item = {
      id: String(cid),
      catid: cid,
      gmid: gid || null,
      parentName,
      name: catName,
      slug: slugify(catName) || `cat-${cid}`,
      itemCount,
      image: safeImageUrl(c.image_url, FALLBACK_IMAGE),
    };
    if (!catsByGroup.has(gid)) catsByGroup.set(gid, []);
    catsByGroup.get(gid).push({
      name: item.name,
      slug: item.slug,
      catid: cid,
      itemCount,
      image: item.image,
      subcategories: subsByCat.get(cid) || [],
    });
    return item;
  }).sort((a, b) => b.itemCount - a.itemCount || a.catid - b.catid);

  const parentCategories = groups.map((g) => {
    const gid = Number(g.gmid);
    const gName = decodeText(g.groupname);
    const gCats = (catsByGroup.get(gid) || []).sort((a, b) => b.itemCount - a.itemCount);
    const totalCount = gCats.reduce((sum, c) => sum + Number(c.itemCount || 0), 0);
    const groupImage =
      gCats.find((c) => c.image && c.image !== FALLBACK_IMAGE)?.image ||
      gCats[0]?.image ||
      FALLBACK_IMAGE;
    return {
      id: `parent-${gid}`,
      gmid: gid,
      name: gName,
      slug: slugify(gName) || `group-${gid}`,
      icon: groupIcon(gName),
      image: groupImage,
      showInNav: g.show_in_nav !== false,
      navOrder: Number(g.nav_order || 0),
      itemCount: totalCount,
      categories: gCats,
    };
  }).sort((a, b) => {
    const aOrd = a.navOrder > 0 ? a.navOrder : 999999;
    const bOrd = b.navOrder > 0 ? b.navOrder : 999999;
    return aOrd - bOrd || b.itemCount - a.itemCount || a.gmid - b.gmid;
  });

  res.json({ status: 'true', parentCategories, categories });
}));

router.get('/api/storefront/products', readLimiter, asyncHandler(async (req, res) => {
  const { page, limit, offset } = parsePagination(req.query, 50, 500);
  const search = String(req.query.search || req.query.q || '').trim();
  const parent = String(req.query.parent || '').trim();
  const cat = String(req.query.cat || '').trim();
  const sub = String(req.query.sub || '').trim();
  const gmid = parseInt(req.query.gmid || 0, 10) || 0;
  const catid = parseInt(req.query.catid || 0, 10) || 0;
  const subcatid = parseInt(req.query.subcatid || 0, 10) || 0;
  const pmid = parseInt(req.query.pmid || req.query.storeid || 0, 10) || 0;
  const minPrice = req.query.minPrice !== undefined && req.query.minPrice !== '' ? Number(req.query.minPrice) : null;
  const maxPrice = req.query.maxPrice !== undefined && req.query.maxPrice !== '' ? Number(req.query.maxPrice) : null;
  const inStock = String(req.query.inStock || '').toLowerCase() === 'true';
  const brand = String(req.query.brand || '').trim();
  const sortBy = String(req.query.sortBy || 'relevance').toLowerCase();

  const conds = [
    'COALESCE(sp.isactive, true) = true',
    'COALESCE(sp.isverified, 0) = 1',
    'COALESCE(pm.active, true) = true',
  ];
  const params = { limit, offset };

  if (search) {
    conds.push(`(
      mp.producttitle ILIKE @q
      OR COALESCE(pc.catname, '') ILIKE @q
      OR COALESCE(sc.scatname, '') ILIKE @q
      OR COALESCE(gm.groupname, '') ILIKE @q
      OR COALESCE(sp.manufacturerdetails, '') ILIKE @q
      OR COALESCE(sp.color, '') ILIKE @q
    )`);
    params.q = `%${search}%`;
  }
  if (gmid > 0) { conds.push('pc.gmid = @gmid'); params.gmid = gmid; }
  else if (parent) { conds.push('lower(gm.groupname) = lower(@parent)'); params.parent = parent; }

  if (catid > 0) { conds.push('mp.catid = @catid'); params.catid = catid; }
  else if (cat && cat.toLowerCase() !== 'all') { conds.push('lower(pc.catname) = lower(@cat)'); params.cat = cat; }

  if (subcatid > 0) { conds.push('mp.subcategoryid = @subcatid'); params.subcatid = subcatid; }
  else if (sub) { conds.push('lower(sc.scatname) = lower(@sub)'); params.sub = sub; }

  if (pmid > 0) { conds.push('mp.companyid = @pmid'); params.pmid = pmid; }
  if (minPrice !== null && Number.isFinite(minPrice)) {
    conds.push('COALESCE(NULLIF(sp.dap, 0), sp.sellmrp, 0) >= @minPrice');
    params.minPrice = minPrice;
  }
  if (maxPrice !== null && Number.isFinite(maxPrice)) {
    conds.push('COALESCE(NULLIF(sp.dap, 0), sp.sellmrp, 0) <= @maxPrice');
    params.maxPrice = maxPrice;
  }
  if (inStock) {
    conds.push('COALESCE(sp.isoutofstock, false) = false AND COALESCE(sp.stocknet, 1) > 0');
  }
  if (brand && brand.toLowerCase() !== 'all') {
    conds.push('lower(COALESCE(sp.manufacturerdetails, \'\')) = lower(@brand)');
    params.brand = brand;
  }

  let orderBy = 'sp.sprid DESC';
  if (sortBy === 'price_asc' || sortBy === 'price-low') orderBy = 'COALESCE(NULLIF(sp.dap, 0), sp.sellmrp, 0) ASC, sp.sprid DESC';
  else if (sortBy === 'price_desc' || sortBy === 'price-high') orderBy = 'COALESCE(NULLIF(sp.dap, 0), sp.sellmrp, 0) DESC, sp.sprid DESC';
  else if (sortBy === 'discount') orderBy = 'COALESCE(sp.discountpercentage, 0) DESC, sp.sprid DESC';
  else if (sortBy === 'rating') orderBy = 'COALESCE(sp.discountpercentage, 0) DESC, sp.sprid DESC';

  const where = conds.join(' AND ');
  const fromClause = `
    FROM dbo.ims_subproduct sp
    JOIN dbo.ims_masterproduct mp ON mp.mprid = sp.mprid
    LEFT JOIN dbo.product_category pc ON pc.catid = mp.catid
    LEFT JOIN dbo.tbl_categorygroupmaster gm ON gm.gmid = pc.gmid
    LEFT JOIN dbo.product_subcategory sc ON sc.scatid = mp.subcategoryid
    LEFT JOIN dbo.portal_master pm ON pm.pmid = mp.companyid
    LEFT JOIN dbo.commerza_product_meta pm_meta ON pm_meta.sprid = sp.sprid
  `;

  const [total, rows] = await Promise.all([
    db.scalar(DB, `SELECT COUNT(*)::int ${fromClause} WHERE ${where}`, params),
    db.query(
      DB,
      `SELECT sp.sprid, sp.subprcode, sp.mprid, mp.producttitle, mp.productcode,
              mp.catid, mp.subcategoryid, pc.gmid, gm.groupname, pc.catname, sc.scatname,
              mp.shotdescription, mp.fulldescription, mp.companyid AS pmid, pm.companyname,
              sp.unit, sp.color, sp.color_hex, sp.size, sp.stocknet, sp.isoutofstock,
              sp.productimages, sp.actualprice, sp.sellmrp, sp.dap, sp.discountpercentage,
              sp.manufacturerdetails
       ${fromClause}
       WHERE ${where}
       ORDER BY ${orderBy}
       LIMIT @limit OFFSET @offset`,
      params
    ),
  ]);

  res.json({
    status: 'true',
    products: rows.map(mapProductRow),
    pagination: buildPagination(page, limit, total),
  });
}));

router.get('/api/storefront/products/:id', readLimiter, asyncHandler(async (req, res) => {
  const sprid = parseInt(req.params.id, 10) || 0;
  if (!sprid) return res.status(400).json({ status: 'false', message: 'Invalid product id' });

  const row = await db.queryOne(
    DB,
    `SELECT sp.sprid, sp.subprcode, sp.mprid, mp.producttitle, mp.productcode,
            mp.catid, mp.subcategoryid, pc.gmid, gm.groupname, pc.catname, sc.scatname,
            mp.shotdescription, mp.fulldescription, mp.companyid AS pmid, pm.companyname,
            sp.unit, sp.color, sp.color_hex, sp.size, sp.stocknet, sp.isoutofstock,
            sp.productimages, sp.actualprice, sp.sellmrp, sp.dap, sp.discountpercentage,
            sp.manufacturerdetails
     FROM dbo.ims_subproduct sp
     JOIN dbo.ims_masterproduct mp ON mp.mprid = sp.mprid
     LEFT JOIN dbo.product_category pc ON pc.catid = mp.catid
     LEFT JOIN dbo.tbl_categorygroupmaster gm ON gm.gmid = pc.gmid
     LEFT JOIN dbo.product_subcategory sc ON sc.scatid = mp.subcategoryid
     LEFT JOIN dbo.portal_master pm ON pm.pmid = mp.companyid
     LEFT JOIN dbo.commerza_product_meta pm_meta ON pm_meta.sprid = sp.sprid
     WHERE sp.sprid = @sprid AND COALESCE(sp.isactive, true) = true
     LIMIT 1`,
    { sprid }
  );
  if (!row) return res.status(404).json({ status: 'false', message: 'Product not found' });

  const variants = await db.query(
    DB,
    `SELECT sp.sprid, sp.subprcode, sp.mprid, mp.producttitle, mp.productcode,
            mp.catid, mp.subcategoryid, pc.gmid, gm.groupname, pc.catname, sc.scatname,
            mp.shotdescription, mp.fulldescription, mp.companyid AS pmid, pm.companyname,
            sp.unit, sp.color, sp.color_hex, sp.size, sp.stocknet, sp.isoutofstock,
            sp.productimages, sp.actualprice, sp.sellmrp, sp.dap, sp.discountpercentage,
            sp.manufacturerdetails
     FROM dbo.ims_subproduct sp
     JOIN dbo.ims_masterproduct mp ON mp.mprid = sp.mprid
     LEFT JOIN dbo.product_category pc ON pc.catid = mp.catid
     LEFT JOIN dbo.tbl_categorygroupmaster gm ON gm.gmid = pc.gmid
     LEFT JOIN dbo.product_subcategory sc ON sc.scatid = mp.subcategoryid
     LEFT JOIN dbo.portal_master pm ON pm.pmid = mp.companyid
     LEFT JOIN dbo.commerza_product_meta pm_meta ON pm_meta.sprid = sp.sprid
     WHERE sp.mprid = @mprid AND COALESCE(sp.isactive, true) = true AND COALESCE(sp.isverified, 0) = 1
     ORDER BY sp.sprid ASC`,
    { mprid: row.mprid }
  );

  res.json({
    status: 'true',
    product: mapProductRow(row),
    variants: variants.map(mapProductRow),
  });
}));

router.get('/api/storefront/stores', readLimiter, asyncHandler(async (_req, res) => {
  await ensureCommerzaSchema();
  const [rows, catRows] = await Promise.all([
    db.query(
      DB,
      `SELECT pm.pmid, pm.companyname, pm.mobileno, pm.comemailid, pm.address, pm.pincode,
              pm.areaname, pm.active, pm.isverified,
              sd.city, sd.state, sd.landmark, sd.shop_category,
              sd.shop_logo_url, sd.shop_banner_url, sd.opening_time, sd.closing_time, sd.working_days,
              ds.local_delivery_enabled, ds.local_pincodes, ds.local_eta_text, ds.shiprocket_enabled,
              COALESCE(pcnt.cnt, 0)::int AS product_count
       FROM dbo.portal_master pm
       LEFT JOIN dbo.commerza_shop_details sd ON sd.pmid = pm.pmid
       LEFT JOIN dbo.commerza_shop_delivery_settings ds ON ds.pmid = pm.pmid
       LEFT JOIN (
         SELECT mp.companyid AS pmid, COUNT(sp.sprid)::int AS cnt
         FROM dbo.ims_subproduct sp
         JOIN dbo.ims_masterproduct mp ON mp.mprid = sp.mprid
         WHERE COALESCE(sp.isactive, true) = true AND COALESCE(sp.isverified, 0) = 1
         GROUP BY mp.companyid
       ) pcnt ON pcnt.pmid = pm.pmid
       WHERE COALESCE(pm.active, true) = true
       ORDER BY COALESCE(pcnt.cnt, 0) DESC, pm.pmid DESC`
    ),
    db.query(
      DB,
      `SELECT DISTINCT mp.companyid AS pmid, pc.catname
       FROM dbo.ims_subproduct sp
       JOIN dbo.ims_masterproduct mp ON mp.mprid = sp.mprid
       JOIN dbo.product_category pc ON pc.catid = mp.catid
       WHERE COALESCE(sp.isactive, true) = true
         AND COALESCE(sp.isverified, 0) = 1
         AND COALESCE(pc.catactive, true) = true
       ORDER BY mp.companyid, pc.catname`
    ),
  ]);

  const catsByStore = new Map();
  for (const r of catRows) {
    const pid = Number(r.pmid || 0);
    if (!pid) continue;
    const catName = decodeText(r.catname);
    if (!catName) continue;
    if (!catsByStore.has(pid)) catsByStore.set(pid, []);
    catsByStore.get(pid).push(catName);
  }

  const stores = rows.map((r) => {
    const pmid = Number(r.pmid);
    const storeCats = catsByStore.get(pmid) || [];
    const primaryCat = decodeText(r.shop_category || storeCats[0] || 'General Store');
    const locationParts = [r.areaname, r.city, r.state, r.pincode].filter((v) => String(v || '').trim().length > 0);
    const location = locationParts.join(', ') || String(r.address || '').trim() || 'India';
    const opening = String(r.opening_time || '').trim();
    const closing = String(r.closing_time || '').trim();
    return {
      id: String(pmid),
      pmid,
      name: decodeText(r.companyname || `Store #${pmid}`),
      category: primaryCat,
      categories: storeCats.length > 0 ? storeCats : [primaryCat],
      location,
      address: String(r.address || r.landmark || location).trim(),
      pincode: String(r.pincode || '').trim(),
      city: String(r.city || r.areaname || '').trim(),
      phone: String(r.mobileno || '').trim(),
      email: String(r.comemailid || '').trim(),
      image: safeImageUrl(r.shop_logo_url, FALLBACK_IMAGE),
      bannerImage: safeImageUrl(r.shop_banner_url, FALLBACK_IMAGE),
      productCount: Number(r.product_count || 0),
      verified: Number(r.isverified || 0) === 1,
      localDelivery: Boolean(r.local_delivery_enabled),
      deliveryEta: String(r.local_eta_text || 'Same day / Next day').trim(),
      shiprocketEnabled: Boolean(r.shiprocket_enabled),
      hours: opening && closing ? `${opening} - ${closing}` : '9:00 AM - 9:00 PM',
      workingDays: String(r.working_days || 'Mon - Sun').trim(),
    };
  });

  res.json({ status: 'true', stores });
}));

module.exports = router;
