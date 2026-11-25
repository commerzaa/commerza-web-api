/** Exports: PROPS-only descriptors of the C# property bag(s) in Models/Settings.cs: Settings (table settings)
 *   { PROPS: [PascalCase property names], TABLE?: '<EF table>', NOT_MAPPED?: [...] }; use mapRows(rows, X.PROPS). No methods in C#. */
'use strict';
const Settings = {"PROPS":["SID","CAPTION","CLUBDESC","LIMITS","ACTIVE","EDITABLE","CID","SYMBOL","clubCond"],"TABLE":"settings"};
module.exports = { ...Settings, Settings };
