'use strict';
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const root = path.join(__dirname, '..');
const env = process.env;

module.exports = {
  root,
  isProd: env.NODE_ENV === 'production',
  port: parseInt(env.PORT || '3000', 10),
  baseUrl: (env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, ''),
  trustProxy: env.TRUST_PROXY === '1',
  sessionSecret: env.SESSION_SECRET || '',
  dbPath: env.DB_PATH || path.join(root, 'data', 'dic.db'),
  uploadDir: env.UPLOAD_DIR || path.join(root, 'uploads'),
  maxUploadMb: parseInt(env.MAX_UPLOAD_MB || '10', 10),
  smtp: {
    host: env.SMTP_HOST || '',
    port: parseInt(env.SMTP_PORT || '587', 10),
    secure: env.SMTP_SECURE === '1',
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || '',
    from: env.MAIL_FROM || 'DIC Website <no-reply@dic.id>',
  },
  admin: { email: env.ADMIN_EMAIL || '', password: env.ADMIN_PASSWORD || '' },
};
