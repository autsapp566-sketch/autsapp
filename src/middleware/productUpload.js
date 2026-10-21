import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { getProductUploadDir } from '../lib/uploadDir.js';

export const PRODUCT_UPLOAD_DIR = getProductUploadDir();

function ensureProductUploadDir() {
  try {
    if (!fs.existsSync(PRODUCT_UPLOAD_DIR)) {
      fs.mkdirSync(PRODUCT_UPLOAD_DIR, { recursive: true });
    }
  } catch (err) {
    console.warn('[uploads] could not create dir', PRODUCT_UPLOAD_DIR, err?.message);
  }
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    ensureProductUploadDir();
    cb(null, PRODUCT_UPLOAD_DIR);
  },
  filename(_req, file, cb) {
    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const safe = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}${ext}`;
    cb(null, safe);
  },
});

function fileFilter(_req, file, cb) {
  if (file.mimetype?.startsWith('image/')) {
    cb(null, true);
    return;
  }
  cb(new Error('نوع الملف غير مدعوم — صور فقط'));
}

export const uploadProductImages = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024, files: 12 },
});
