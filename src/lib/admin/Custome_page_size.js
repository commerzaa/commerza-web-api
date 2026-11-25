/** Exports: class Custome_page_size (no table; props pagesize)
 *   static async Cust_page() : Custome_page_size[]  ([{pagesize:10},{50},{100},{150},{200}])
 */
'use strict';
const { defineModel } = require('./_models');

const Base = defineModel('Custome_page_size', null, { pagesize: 0 });

class Custome_page_size extends Base {
  static async Cust_page() {
    const li = [];
    li.push(new Custome_page_size({ pagesize: 10 }));
    li.push(new Custome_page_size({ pagesize: 50 }));
    li.push(new Custome_page_size({ pagesize: 100 }));
    li.push(new Custome_page_size({ pagesize: 150 }));
    li.push(new Custome_page_size({ pagesize: 200 }));
    return li;
  }
}

module.exports = Custome_page_size;
