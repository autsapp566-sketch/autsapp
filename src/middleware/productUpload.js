import multer from 'multer';

function fileFilter(_req, file, cb) {
  if (file.mimetype?.startsWith('image/')) {
    cb(null, true);
    return;
  }
  cb(new Error('نوع الملف غير مدعوم — صور فقط'));
}

/** Files are kept in memory and persisted to the database (serverless disks are ephemeral). */
export const uploadProductImages = multer({
  storage: multer.memoryStorage(),
  fileFilter,
  limits: { fileSize: 4 * 1024 * 1024, files: 12 },
});
