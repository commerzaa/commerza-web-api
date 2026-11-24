'use strict';
const config = require('../config');

function notFound(req, res) {
  res.status(404).json({ status: 'false', message: `Route not found: ${req.method} ${req.originalUrl}` });
}

// Legacy controllers return { status:false, message: ex.Message } on exceptions; we keep that envelope.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`, err.message, err.sql ? `\nSQL: ${err.sql}` : '');
  if (res.headersSent) return next(err);
  const code = err.status || err.statusCode || 500;
  res.status(code).json({
    status: 'false',
    message: code === 500 && config.env === 'production' ? 'Something went wrong' : err.message,
  });
}

module.exports = { notFound, errorHandler };
