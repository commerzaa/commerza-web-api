/** Exports: PROPS-only descriptors of the C# property bag(s) in Models/LoginRegistration.cs: Login, VIDEODATA, WORKINGHOURS
 *   { PROPS: [PascalCase property names], TABLE?: '<EF table>', NOT_MAPPED?: [...] } per class name; use mapRows(rows, X.PROPS). No methods in C#. */
'use strict';
const Login = {"PROPS":["Plid","Pmid","Smdid","LoginID","UserName","Name","EmailId","Cid","DID","SecretCode"],"NOT_MAPPED":["SecretCode"]};
const VIDEODATA = {"PROPS":["ID","NAME","CONTENTTYPE","DATA","STATUS","PMID"]};
const WORKINGHOURS = {"PROPS":["ID","OPENTIME","CLOSETIME","OPENTIMEEVENING","CLOSETIMEEVENING","ISCLOSED"]};
module.exports = { Login, VIDEODATA, WORKINGHOURS };
