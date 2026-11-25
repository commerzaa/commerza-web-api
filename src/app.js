'use strict';
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const config = require('./config');

// MVC route namespaces reference shared libraries that do not all have
// namespace-local copies. Resolve missing namespace imports against src/lib.
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function resolveFilename(request, parent, isMain, options) {
  try {
    return originalResolveFilename.call(this, request, parent, isMain, options);
  } catch (error) {
    if (!/[/\\]lib[/\\](merchant|member|franchise)[/\\][^/\\]+$/.test(request)) throw error;
    const match = request.match(/[/\\]lib[/\\](merchant|member|franchise)[/\\]([^/\\]+)$/);
    if (!match) throw error;
    const namespace = match[1];
    const name = match[2].replace(/\.js$/, '');
    const base = path.join(__dirname, 'lib');
    const candidates = [
      path.join(base, namespace, name + '.js'),
      path.join(base, name + '.js'),
      path.join(base, 'member', name + '.js'),
      path.join(base, 'franchise', name + '.js'),
      path.join(base, 'merchant', name + '.js'),
    ];
    const candidate = candidates.find((file) => fs.existsSync(file));
    if (!candidate) throw error;
    return originalResolveFilename.call(this, candidate, parent, isMain, options);
  }
};

const params = require('./middleware/params');
const { notFound, errorHandler } = require('./middleware/error');
const db = require('./db');

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true); // legacy GetIP read the real client IP
app.use(helmet({ crossOriginResourcePolicy: false }));
app.use(cors());
app.use(compression());
if (config.env !== 'test') app.use(morgan(config.env === 'production' ? 'combined' : 'dev'));
// Legacy clients post large base64 images in the body
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(params);
app.use(require('./lib/GetIP').requestContext); // replaces HttpContext.Current for GetIP.GetLocalIP()

// Static uploads (legacy folders: Member_Image, KYC_Images, TicketCenterImage, UploadedBills, ...)
fs.mkdirSync(config.uploadDir, { recursive: true });
app.use('/uploads', express.static(config.uploadDir));

app.get('/', (_req, res) => res.json({ name: 'commerza-web-api', status: 'running' }));
app.get('/health', async (_req, res) => res.json({ status: 'ok', db: await db.ping(), time: new Date().toISOString() }));

const routes = require('./routes');
app.use('/', routes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
