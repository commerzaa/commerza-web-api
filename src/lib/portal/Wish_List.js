/** Exports: Wish_List - EF entity / SqlQuery<T> property bag from Models/Wish_List.cs.
 *  { PROPS: [PascalCase property names for mapRows], TABLE: '<postgres table>' } (no methods in the C#). */
'use strict';

const Wish_List = { PROPS: ['date', 'RegNo', 'Sprid', 'status', 'LoginId', 'wlid'], TABLE: 'tbl_wishlist' };

module.exports = { ...Wish_List, Wish_List };
