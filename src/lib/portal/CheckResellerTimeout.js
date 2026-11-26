/** Exports: class CheckResellerTimeout (C# ActionFilterAttribute)
 *   OnActionExecuting(filterContext) : void  -- legacy body is fully commented out (only base.OnActionExecuting), i.e. a no-op filter
 *   static middleware() : Express middleware (req, res, next) => next()   (equivalent usage as a route filter)
 */
'use strict';

class CheckResellerTimeout {
  // The session check (Session["ResellerLoginId"] == null => redirect "/") is commented out in C#; nothing to do.
  OnActionExecuting(filterContext) {
    void filterContext;
  }

  static middleware() {
    return (req, res, next) => next();
  }
}

module.exports = CheckResellerTimeout;
