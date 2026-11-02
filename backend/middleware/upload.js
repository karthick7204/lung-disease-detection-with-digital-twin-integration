import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Resolve uploads directory from environment or default to 'uploads'
const UPLOAD_DIR = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads');

// Ensure uploads folder exists upon server initialization
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// 10 MB default upload limit
const MAX_FILE_SIZE_BYTES =
  (parseInt(process.env.MAX_FILE_SIZE_MB, 10) || 10) * 1024 * 1024;

// Permitted extensions and MIME types for chest X-rays
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
]);

const ALLOWED_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/**
 * Configure Multer disk storage.
 * Files are stored with cryptographically secure random names to prevent file collisions
 * and path manipulation attacks.
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Extract sanitized extension from original name
    const ext = path.extname(file.originalname).toLowerCase();
    const safeExt = ALLOWED_EXTENSIONS.has(ext) ? ext : '.png';

    // Generate random UUID + timestamp for unguessable, safe filename
    const uniqueId = crypto.randomUUID();
    const timestamp = Date.now();
    const safeFilename = `scan-${timestamp}-${uniqueId}${safeExt}`;

    cb(null, safeFilename);
  },
});

/**
 * Filter files based on extension and claimed MIME type before accepting.
 * Rejects unsupported types and catches DICOM files with informative errors.
 */
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  // Explicit check for DICOM medical image extensions or MIME types
  if (
    ext === '.dcm' ||
    ext === '.dicom' ||
    file.mimetype === 'application/dicom' ||
    file.mimetype === 'application/dicom+json'
  ) {
    const dicomError = new Error(
      'DICOM format detected. Direct DICOM uploads are not supported in this version. ' +
      'Please convert your chest X-ray to a high-resolution PNG or JPEG before uploading.'
    );
    dicomError.code = 'DICOM_NOT_SUPPORTED';
    dicomError.status = 400;
    return cb(dicomError, false);
  }

  // Validate allowed image extensions and MIME types
  if (ALLOWED_MIME_TYPES.has(file.mimetype) && ALLOWED_EXTENSIONS.has(ext)) {
    return cb(null, true);
  }

  const error = new Error(
    `Unsupported file type '${ext || file.mimetype}'. Only JPEG and PNG chest X-ray images are allowed.`
  );
  error.code = 'INVALID_FILE_TYPE';
  error.status = 400;
  cb(error, false);
};

// Base multer instance
const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1, // Only 1 image per scan upload
  },
  fileFilter,
});

/**
 * Express middleware wrapper for single image upload on field 'image'.
 * Catches Multer-specific errors (size limit, invalid field name) and passes them
 * formatted to the next error middleware.
 */
export const uploadSingleImage = (req, res, next) => {
  const uploadHandler = upload.single('image');

  uploadHandler(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: `File too large. Maximum allowed size is ${
            process.env.MAX_FILE_SIZE_MB || 10
          } MB.`,
        });
      }
      if (err.code === 'LIMIT_UNEXPECTED_FILE') {
        return res.status(400).json({
          success: false,
          error: `Unexpected field '${err.field}'. Please upload the chest X-ray using the form field name 'image'.`,
        });
      }
      return res.status(400).json({
        success: false,
        error: `Upload error: ${err.message}`,
      });
    } else if (err) {
      return res.status(err.status || 400).json({
        success: false,
        error: err.message,
      });
    }

    next();
  });
};

export { UPLOAD_DIR };
