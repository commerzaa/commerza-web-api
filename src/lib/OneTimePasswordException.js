/** Exports: class OneTimePasswordException extends Error  (C# ctor overloads: (), (message), (message, innerException)) */
'use strict';

class OneTimePasswordException extends Error {
  constructor(message, innerException) {
    super(message);
    this.name = 'OneTimePasswordException';
    if (innerException) this.innerException = innerException;
  }
}

module.exports = OneTimePasswordException;
