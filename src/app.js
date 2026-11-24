'use strict';
const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const config = require('./config');
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
