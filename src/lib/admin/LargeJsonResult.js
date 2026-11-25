/** Exports: class LargeJsonResult (Models/LargeJsonResult.cs, System.Web.Mvc.JsonResult subclass)
 *   new LargeJsonResult()  -> MaxJsonLength = 1024000, RecursionLimit = 100, Data = null, ContentType = null, ContentEncoding = null,
 *                             JsonRequestBehavior = 'DenyGet' (JsonResult default; 'AllowGet' to allow GET)
 *   ExecuteResult(req, res) : void   (Express replacement of ExecuteResult(ControllerContext))
 *     throws ArgumentNullException-like Error("context") when req/res missing; InvalidOperationException-like Error(JsonRequest_GetNotAllowed)
 *     for DenyGet + GET; Content-Type = ContentType || "application/json"; writes the serialized Data when Data != null.
 *   LargeJsonResult.JsonRequestBehavior = { AllowGet, DenyGet }
 */
'use strict';

const JsonRequest_GetNotAllowed = 'This request has been blocked because sensitive information could be disclosed to third party web sites when this is used in a GET request. To allow GET requests, set JsonRequestBehavior to AllowGet.';

class LargeJsonResult {
  constructor() {
    this.Data = null;
    this.ContentType = null;
    this.ContentEncoding = null;
    this.JsonRequestBehavior = 'DenyGet';
    this.MaxJsonLength = 1024000;
    this.RecursionLimit = 100;
  }

  ExecuteResult(req, res) {
    if (req == null || res == null) {
      const e = new Error("Value cannot be null.\r\nParameter name: context");
      e.name = 'ArgumentNullException';
      throw e;
    }
    if (this.JsonRequestBehavior === 'DenyGet' && String(req.method).toUpperCase() === 'GET') {
      const e = new Error(JsonRequest_GetNotAllowed);
      e.name = 'InvalidOperationException';
      throw e;
    }
    let ct;
    if (this.ContentType) {
      ct = this.ContentType;
    } else {
      ct = 'application/json';
    }
    if (this.ContentEncoding != null) {
      ct += '; charset=' + this.ContentEncoding;
    }
    res.setHeader('Content-Type', ct);
    if (this.Data != null) {
      // PORT-NOTE: JavaScriptSerializer is replaced by JSON.stringify (dates are ISO strings, not "\/Date(ms)\/";
      // RecursionLimit is not enforced - JSON.stringify throws on cycles). MaxJsonLength is enforced like the serializer.
      const json = JSON.stringify(this.Data);
      if (json.length > this.MaxJsonLength) {
        throw new Error('Error during serialization or deserialization using the JSON JavaScriptSerializer. The length of the string exceeds the value set on the maxJsonLength property.');
      }
      res.write(json);
    }
    res.end();
  }
}
LargeJsonResult.JsonRequestBehavior = { AllowGet: 'AllowGet', DenyGet: 'DenyGet' };

module.exports = LargeJsonResult;
