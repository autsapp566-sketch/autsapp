import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { getProductUploadDir } from '../lib/uploadDir.js';

function ensureProductUploadDir(dir) {
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  } catch (err) {
    console.warn('[uploads] could not create dir', dir, err?.message);
  }
}

const storage = multer.diskStorage({
  destination(_req, _file, cb) {
    const dir = getProductUploadDir();
    ensureProductUploadDir(dir);
    cb(null, dir);
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
