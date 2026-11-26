/**
 * Exports: class DealsForYou {
 *   async MainTainHistoryOfDealsForYou(string IpAddress, int PLID, int MainCatId, int CatId, int ScatId, int ProductId): int;
 *   async GetSocialMediaLinks(int plid): SocialMediaModel[] }
 * The internal 5-argument overload MainTainHistoryOfDealsForYou(p1, p2, MainCatId, CatId, SubCatId) threw NotImplementedException;
 * calling with fewer than 6 arguments reproduces that.
 * Portal DataBaseContext = Db_Shopping.
 */
'use strict';
const db = require('../../db');
const { mapRows } = require('../../utils/shape');

const DB = 'shopping';
const outCol = (row, name) => {
  if (!row) return undefined;
  const k = Object.keys(row).find((x) => x.toLowerCase() === name.toLowerCase());
  return k !== undefined ? row[k] : row[Object.keys(row)[0]];
};

class DealsForYou {
  async MainTainHistoryOfDealsForYou(IpAddress, PLID, MainCatId, CatId, ScatId, ProductId) {
    if (arguments.length < 6) throw new Error('The method or operation is not implemented.'); // internal overload
    const row = await db.procOne(DB, 'usp_dealsforyou', {
      ipaddress: IpAddress, plid: PLID, maincatid: MainCatId, catid: CatId, scatid: ScatId, productid: ProductId,
    });
    const v = outCol(row, 'intresult');
    if (v === null || v === undefined) throw new TypeError('Object reference not set to an instance of an object.');
    const n = parseInt(String(v), 10);
    if (Number.isNaN(n)) throw new Error('Input string was not in a correct format.');
    return n;
  }

  async GetSocialMediaLinks(plid) {
    const rows = await db.proc(DB, 'usp_get_social_media_links', { plid });
    return mapRows(rows, ['RowNum', 'SocialName', 'SocialUrl']);
  }
}

module.exports = DealsForYou;
