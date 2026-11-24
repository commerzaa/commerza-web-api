/** Exports: class TBL_TESTIMONIAL (Models/Testimonial.cs; table tbl_testimonial; props TID, Name, Descriptions, Image, Date, Status, City, Regno, Title, Stars)
 *   async GetTestimonials() : TBL_TESTIMONIAL[] (Status 1, Date desc)
 */
'use strict';
const { query } = require('../db');
const { mapRows } = require('../utils/shape');

const PROPS = ['TID', 'Name', 'Descriptions', 'Image', 'Date', 'Status', 'City', 'Regno', 'Title', 'Stars'];

class TBL_TESTIMONIAL {
  async GetTestimonials() {
    return mapRows(await query('affiliate', 'select * from tbl_testimonial where status=1 order by date desc'), PROPS);
  }
}

module.exports = TBL_TESTIMONIAL;
