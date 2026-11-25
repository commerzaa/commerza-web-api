/** Exports: class Testimonial (table tbl_testimonial; props TID, Name, Descriptions, Image, City, Date, Status, Regno)
 *   async AddTestimonial(string name, string description, string city, double Regno, string image) : string  ("success" | "Failed"; Image only when image != "")
 *   async UpdateTestimonial(string name, string description, string city, double Regno, int TID1, string image) : string
 *         ("success" | "Failed"; throws "Sequence contains no elements" when TID1 does not exist, like EF Single)
 *   async RemoveTestimonial(int TID) : string  (Status = 2; "success"; missing row / error => "Failed")
 *   async ApproveTestimonial(int Tid) : string  (Status = 1; "success"; missing row / error => "Failed")
 *   async ShowTestimonialDetails(int TID) : Testimonial | null  (TID, Date desc)
 *   async ShowTestimonialAll() : Testimonial[]  (Status != 2, Date desc)
 *   async ShowMyTestimonialAll(Int64 Regno) : Testimonial[]  (Status != 2 && Regno, Date desc)
 *   async ShowApproveTestimonial() : Testimonial[]  (Status == 1, Date desc)
 * Not reused from ../Testimonial.js (Member/API): different C#.
 */
'use strict';
const { query, queryOne, exec } = require('../../db');
const { defineModel, DB } = require('./_models');

const Base = defineModel('Testimonial', 'tbl_testimonial', { TID: 0, Name: null, Descriptions: null, Image: null, City: null, Date: null, Status: 0, Regno: 0 });

// Convert.ToInt64(double): banker's rounding
function toInt64(d) {
  const n = Number(d);
  const f = Math.floor(n);
  const diff = n - f;
  if (diff > 0.5) return f + 1;
  if (diff < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
}

class Testimonial extends Base {
  async AddTestimonial(name, description, city, Regno, image) {
    const p = { name, description, city, Regno: toInt64(Regno), image: null };
    if (image !== '') {
      p.image = image;
    }
    const ret = await exec(DB, "insert into tbl_testimonial (name, descriptions, city, date, status, regno, image) values (@name, @description, @city, (now() at time zone 'utc'), 1, @Regno, @image)", p);
    if (ret > 0) {
      return 'success';
    } else {
      return 'Failed';
    }
  }

  async UpdateTestimonial(name, description, city, Regno, TID1, image) {
    const rows = await query(DB, 'select tid from tbl_testimonial where tid=@TID1 limit 2', { TID1 });
    if (rows.length === 0) throw new Error('Sequence contains no elements');
    if (rows.length > 1) throw new Error('Sequence contains more than one element');
    const p = { name, description, city, Regno: toInt64(Regno), TID1 };
    let setImage = '';
    if (image !== '') {
      p.image = image;
      setImage = ', image=@image';
    }
    const ret = await exec(DB, `update tbl_testimonial set name=@name, descriptions=@description, city=@city, date=(now() at time zone 'utc'), status=1, regno=@Regno${setImage} where tid=@TID1`, p);
    if (ret > 0) {
      return 'success';
    } else {
      return 'Failed';
    }
  }

  async RemoveTestimonial(TID) {
    try {
      const row = await queryOne(DB, 'select tid from tbl_testimonial where tid=@TID limit 1', { TID });
      if (row === null) throw new TypeError('Object reference not set to an instance of an object.');
      await exec(DB, 'update tbl_testimonial set status=2 where tid=@TID', { TID });
      return 'success';
    } catch (ex) {
      return 'Failed';
    }
  }

  async ApproveTestimonial(Tid) {
    try {
      const row = await queryOne(DB, 'select tid from tbl_testimonial where tid=@Tid limit 1', { Tid });
      if (row === null) throw new TypeError('Object reference not set to an instance of an object.');
      await exec(DB, 'update tbl_testimonial set status=1 where tid=@Tid', { Tid });
      return 'success';
    } catch (ex) {
      return 'Failed';
    }
  }

  async ShowTestimonialDetails(TID) {
    return Base.map(await queryOne(DB, 'select * from tbl_testimonial where tid=@TID order by date desc limit 1', { TID }));
  }

  async ShowTestimonialAll() {
    return Base.mapAll(await query(DB, 'select * from tbl_testimonial where status<>2 order by date desc'));
  }

  async ShowMyTestimonialAll(Regno) {
    return Base.mapAll(await query(DB, 'select * from tbl_testimonial where status<>2 and regno=@Regno order by date desc', { Regno }));
  }

  async ShowApproveTestimonial() {
    return Base.mapAll(await query(DB, 'select * from tbl_testimonial where status=1 order by date desc'));
  }
}

module.exports = Testimonial;
