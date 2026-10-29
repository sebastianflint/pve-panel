'use strict';
const path = require('path');
const multer = require('multer');
const config = require('../config');
const { token } = require('./util');

const ALLOWED = {
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif',
  '.pdf': 'application/pdf', '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
};
const storage = multer.diskStorage({
  destination: config.uploadDir,
  filename: (req, file, cb) => cb(null, token(12) + path.extname(file.originalname).toLowerCase()),
});
const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadMb * 1024 * 1024, files: 5, fields: 60 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(ALLOWED[ext] ? null : new Error('Tipe file tidak diizinkan: ' + ext), !!ALLOWED[ext]);
  },
});
const isImage = (name) => /\.(jpe?g|png|webp|gif)$/i.test(name || '');
module.exports = { upload, ALLOWED, isImage };
