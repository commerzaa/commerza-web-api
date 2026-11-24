/**
 * Exports: class CategoryDAL { async GetAllCategory(): Main_Product_Category[]; async GetProductCategoryDetail(string PrId | Int32 CatId): Tbl_Product_Category|null;
 *   async GetProductSubCategoryDetail(string PrId | Int32 SubCategoryDetail): Product_Sub_Category|null; async GetSelectedCategory(Int64 BranchId): BranchViewModel;
 *   async GetSelectedPinCode(Int64 BranchId, string Zone): SellingPinCodeViewModel }
 * C# overloads (string vs Int32) are dispatched on typeof the argument (string => code lookup, number => id lookup).
 * PORT-NOTE: Franchise DataBaseContext = Db_Shopping. Entity tables: tbl_main_category, tbl_category, tbl_sub_category, tbl_merchantcat_subcat_keywordmaster,
 *   tbl_pincodegroup, country, state, city, area_master.
 */
'use strict';
const db = require('../../db');
const { mapRow, mapRows } = require('../../utils/shape');

const D = 'shopping';
const MainCat = ['AdminCharge', 'ImageName', 'isDelete', 'IsHot_Links', 'IsHot_Menu', 'IsHot_WithItem', 'main_cat_code', 'main_cat_imgname', 'maincatId', 'maincatname', 'sequence', 'status'];
const Cat = ['AdminCharge', 'DelieveryCharge', 'HandlingCharge', 'FixedFee', 'cat_code', 'cat_imgname', 'catId', 'catname', 'isDelete', 'IsHot_Links', 'IsHot_Menu', 'IsHot_WithItem', 'maincatId', 'sequence', 'status'];
const SubCat = ['AdminCharge', 'catId', 'isDelete', 'IsHot_Links', 'IsHot_Menu', 'IsHot_WithItem', 'maincatId', 'sequence', 'status', 'sub_cat_code', 'sub_cat_imgname', 'subcatId', 'subcatname', 'DelieveryCharge', 'HandlingCharge', 'FixedFee'];
const PinCodeGroup = ['AreaIds', 'GroupName', 'Id', 'IsActive', 'IsDefault', 'ToUserType'];
// Note: C# bool IsSelected is a [NotMapped] property (always false when loaded)

const toInt32 = (s) => {
  const v = String(s).trim();
  if (!/^[+-]?\d+$/.test(v)) throw new Error('Input string was not in a correct format.');
  const n = parseInt(v, 10);
  if (n > 2147483647 || n < -2147483648) throw new Error('Value was either too large or too small for an Int32.');
  return n;
};
const valOf = (s) => (s === null || s === undefined || s === '' ? 0 : toInt32(s)); // string.IsNullOrEmpty ? 0 : Convert.ToInt32
const NRE = () => new TypeError('Object reference not set to an instance of an object.');
const trimStartComma = (s) => {
  if (s === null || s === undefined) throw NRE();
  return String(s).replace(/^,+/, '');
};

class CategoryDAL {
  async GetAllCategory() {
    const rows = await db.query(D, 'select * from tbl_main_category where status = true and isdelete = false', {});
    return mapRows(rows, MainCat).map((r) => ({ ...r, IsSelected: false }));
  }

  async GetProductCategoryDetail(arg) {
    let row;
    if (typeof arg === 'string') {
      row = await db.queryOne(D, 'select * from tbl_category where cat_code = @PrId and status = true limit 1', { PrId: arg });
    } else {
      row = await db.queryOne(D, 'select * from tbl_category where catid = @CatId and status = true limit 1', { CatId: arg });
    }
    const r = mapRow(row, Cat);
    return r === null ? null : { ...r, IsSelected: false };
  }

  async GetProductSubCategoryDetail(arg) {
    let row;
    if (typeof arg === 'string') {
      row = await db.queryOne(D, 'select * from tbl_sub_category where sub_cat_code = @PrId and status = true limit 1', { PrId: arg });
    } else {
      row = await db.queryOne(D, 'select * from tbl_sub_category where subcatid = @SubCategoryDetail and status = true limit 1', { SubCategoryDetail: arg });
    }
    const r = mapRow(row, SubCat);
    return r === null ? null : { ...r, IsSelected: false };
  }

  async GetSelectedCategory(BranchId) {
    const obj = { BranchId: 0, Category: [], IsVerified: false, MasterCategory: [], SubCategory: [], LiGetKeywordForBusinessListing: null };
    let Category = '';
    let SubCategory = '';
    const b = await db.queryOne(D, 'select category, subcategory from tbl_merchantcat_subcat_keywordmaster where isactive = true and isdeleted = false and plid = @BranchId limit 1', { BranchId });
    if (b !== null) {
      Category = trimStartComma(b.category);
      SubCategory = trimStartComma(b.subcategory);
    }
    const StrCategory = Category.split(',');
    const StrSubCategory = SubCategory.split(',');

    const mains = mapRows(await db.query(D, 'select * from tbl_main_category where status = true and isdelete = false', {}), MainCat);
    for (const mItem of mains) {
      let TotalCCount = 0;
      let MatchedCCount = 0;
      const cats = mapRows(await db.query(D, 'select * from tbl_category where status = true and maincatid = @maincatId and isdelete = false', { maincatId: mItem.maincatId }), Cat);
      for (const cItem of cats) {
        let TotalSCCount = 0;
        let MatchedSCCount = 0;
        const subs = mapRows(await db.query(D, 'select * from tbl_sub_category where status = true and catid = @catId and isdelete = false', { catId: cItem.catId }), SubCat);
        for (const scItem of subs) {
          TotalSCCount += 1;
          const sc = {
            catId: scItem.catId,
            AdminCharge: scItem.AdminCharge,
            sub_cat_code: scItem.sub_cat_code,
            subcatname: scItem.subcatname,
            subcatId: scItem.subcatId,
            maincatId: scItem.maincatId,
            sequence: scItem.sequence,
            isDelete: false, IsHot_Links: null, IsHot_Menu: null, IsHot_WithItem: null, status: false, sub_cat_imgname: null,
            IsSelected: false,
          };
          for (let i = 0; i < StrSubCategory.length; i++) {
            const val = valOf(StrSubCategory[i]);
            if (val === sc.catId) {
              MatchedSCCount += 1;
              sc.IsSelected = true;
            }
          }
          obj.SubCategory.push(sc);
        }

        const c = {
          catId: cItem.catId,
          AdminCharge: cItem.AdminCharge,
          cat_code: cItem.cat_code,
          catname: cItem.catname,
          maincatId: cItem.maincatId,
          sequence: cItem.sequence,
          cat_imgname: null, isDelete: false, IsHot_Links: null, IsHot_Menu: null, IsHot_WithItem: null, status: false,
          IsSelected: false,
        };
        TotalCCount += 1;
        if (TotalSCCount !== 0 && MatchedSCCount !== 0) {
          if (TotalSCCount === MatchedSCCount) {
            MatchedCCount += 1;
            c.IsSelected = true;
          }
        } else {
          for (let i = 0; i < StrCategory.length; i++) {
            const val = valOf(StrCategory[i]);
            if (val === c.catId) {
              c.IsSelected = true;
              MatchedCCount += 1;
            }
          }
        }
        obj.Category.push(c);
      }

      const mc = {
        maincatId: mItem.maincatId,
        AdminCharge: mItem.AdminCharge,
        main_cat_code: mItem.main_cat_code,
        maincatname: mItem.maincatname,
        main_cat_imgname: mItem.main_cat_imgname,
        status: mItem.status,
        ImageName: mItem.ImageName,
        sequence: mItem.sequence,
        isDelete: false, IsHot_Links: null, IsHot_Menu: null, IsHot_WithItem: null,
        IsSelected: false,
      };
      if (TotalCCount !== 0 && MatchedCCount !== 0) {
        if (TotalCCount === MatchedCCount) {
          mc.IsSelected = true;
        }
      }
      obj.MasterCategory.push(mc);
    }
    return obj;
  }

  async GetSelectedPinCode(BranchId, Zone) {
    // eslint-disable-next-line no-unused-vars
    const ZoneId = toInt32(Zone);
    const obj = { Area: [], BranchId: 0, City: [], Country: [], Group: null, IsVerified: false, State: [] };
    const CountryName = 'India';
    let Category = '';
    let SubCategory = '';

    // legacy: first active keyword-master row (no plid filter)
    const b = await db.queryOne(D, 'select category, subcategory from tbl_merchantcat_subcat_keywordmaster where isactive = true and isdeleted = false limit 1', {});
    const groups = await db.query(D, 'select * from tbl_pincodegroup where touserid = @BranchId', { BranchId });
    obj.Group = mapRows(groups, PinCodeGroup);
    if (b !== null) {
      if (b.category === null || b.category === undefined || b.subcategory === null || b.subcategory === undefined) {
        // legacy: Category = b.Category (null) => later Category.Split throws NullReferenceException
        if (b.category === null || b.category === undefined) throw NRE();
        throw NRE();
      }
      Category = b.category;
      SubCategory = b.subcategory;
    }
    const StrCategory = Category.split(',');
    const StrSubCategory = SubCategory.split(',');

    const countries = await db.query(D, 'select cid, countryname from country where countryname = @CountryName', { CountryName });
    for (const country of countries) {
      let TotalStateCount = 0;
      let MatchedStateCount = 0;
      let AreaCount = Number(await db.scalar(D, 'select count(*) from (select distinct * from area_master where cid = @cid and pincode is not null) t', { cid: country.cid }));
      if (AreaCount > 0) {
        const states = await db.query(D, 'select * from state where sactive = true and cid = @cid', { cid: country.cid });
        for (const state of states) {
          let TotalCityCount = 0;
          let MatchedCityCount = 0;
          AreaCount = Number(await db.scalar(D, 'select count(*) from (select distinct * from area_master where sid = @sid and pincode is not null) t', { sid: state.sid }));
          if (AreaCount > 0) {
            const cities = await db.query(D, 'select * from city where active = true and sid = @sid', { sid: state.sid });
            for (const city of cities) {
              let TotalAreaCount = 0;
              let MatchedAreaCount = 0;
              AreaCount = Number(await db.scalar(D, 'select count(*) from (select distinct * from area_master where ctid = @ctid and pincode is not null) t', { ctid: city.ctid }));
              if (AreaCount > 0) {
                const areas = await db.query(D, 'select distinct * from area_master where cactive = 1 and ctid = @ctid and pincode is not null', { ctid: city.ctid });
                for (const area of areas) {
                  const al = {
                    AID: area.aid,
                    AreaName: area.areaname,
                    CountryName: country.countryname,
                    CityName: city.cityname,
                    StateName: state.statename,
                    CountryId: area.cid,
                    StateId: area.sid,
                    CityId: area.ctid,
                    IsActive: !!area.cactive,
                    PinCode: area.pincode,
                    IsSelected: false,
                  };
                  TotalAreaCount += 1;
                  for (let i = 0; i < StrSubCategory.length; i++) {
                    const val = valOf(StrSubCategory[i]);
                    if (val === al.AID) {
                      al.IsSelected = true;
                      MatchedAreaCount += 1;
                    }
                  }
                  obj.Area.push(al);
                }
                const citylist = {
                  Id: city.ctid,
                  CityName: city.cityname,
                  StateId: city.sid,
                  CountryId: city.cid,
                  IsActive: city.active,
                  IsSelected: false,
                  CityGuid: null, CreatedDate: null, LogId: null,
                };
                TotalCityCount += 1;
                if (TotalAreaCount !== 0 && MatchedAreaCount !== 0) {
                  if (TotalAreaCount === MatchedAreaCount) {
                    citylist.IsSelected = true;
                    MatchedCityCount += 1;
                  }
                } else {
                  for (let i = 0; i < StrCategory.length; i++) {
                    const val = valOf(StrCategory[i]);
                    if (val === citylist.Id) {
                      citylist.IsSelected = true;
                      MatchedCityCount += 1;
                    }
                  }
                }
                obj.City.push(citylist);
              }
            }
            const sl = {
              Id: state.sid,
              Code: state.scode,
              CountryId: state.cid,
              IsActive: state.sactive,
              StateName: state.statename,
              IsSelected: false,
              Cost: 0, CreatedDate: null, LogId: null, StateGuid: null, TinNo: null,
            };
            TotalStateCount += 1;
            if (TotalCityCount !== 0 && MatchedCityCount !== 0) {
              if (TotalCityCount === MatchedCityCount) {
                sl.IsSelected = true;
                MatchedStateCount += 1;
              }
            } else {
              for (let i = 0; i < StrCategory.length; i++) {
                const val = valOf(StrCategory[i]);
                if (val === sl.Id) {
                  sl.IsSelected = true;
                  MatchedStateCount += 1;
                }
              }
            }
            obj.State.push(sl);
          }
        }
      }
      const cl = {
        Id: country.cid,
        CountryName: country.countryname,
        IsActive: true,
        IsSelected: false,
        CountryGuid: null, CreatedDate: null, CurrencyId: null, ISDCode: null, LogId: null,
      };
      if (TotalStateCount !== 0 && MatchedStateCount !== 0) {
        if (TotalStateCount === MatchedStateCount) {
          cl.IsSelected = true;
        }
      }
      obj.Country.push(cl);
    }
    return obj;
  }
}

module.exports = CategoryDAL;
