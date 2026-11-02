import fs from 'fs';
import path from 'path';

/**
 * Validates the actual binary contents (magic numbers/signatures) of an uploaded file.
 * Prevents attackers from uploading malicious executables with a spoofed .jpg or .png extension.
 * Also explicitly detects DICOM medical imaging files and returns a helpful message.
 *
 * @param {string} filePath - Absolute path to the uploaded file on disk
 * @returns {Promise<{ valid: boolean, isDicom?: boolean, detectedType?: string, error?: string }>}
 */
export async function validateImageContent(filePath) {
  let fileHandle = null;

  try {
    fileHandle = await fs.promises.open(filePath, 'r');
    const buffer = Buffer.alloc(256);
    const { bytesRead } = await fileHandle.read(buffer, 0, 256, 0);

    if (bytesRead < 4) {
      return {
        valid: false,
        error: 'File is empty or corrupted (insufficient data to determine file type).',
      };
    }

    // 1. Check for DICOM format
    // Standard DICOM files have a 128-byte preamble followed by ASCII letters "DICM" (0x44 0x49 0x43 0x4D)
    if (bytesRead >= 132) {
      const dicomMagic = buffer.toString('ascii', 128, 132);
      if (dicomMagic === 'DICM') {
        return {
          valid: false,
          isDicom: true,
          error:
            'DICOM file format detected. Direct DICOM uploads are not supported in this version. ' +
            'Please convert your chest X-ray to a high-resolution PNG or JPEG before uploading.',
        };
      }
    }

    // 2. Check for JPEG / JFIF / EXIF
    // Starts with 0xFF 0xD8 0xFF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return {
        valid: true,
        detectedType: 'image/jpeg',
      };
    }

    // 3. Check for PNG
    // Starts with 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A (\x89PNG\r\n\x1a\n)
    if (
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47 &&
      buffer[4] === 0x0d &&
      buffer[5] === 0x0a &&
      buffer[6] === 0x1a &&
      buffer[7] === 0x0a
    ) {
      return {
        valid: true,
        detectedType: 'image/png',
      };
    }

    // 4. Check for WebP
    // Starts with 'RIFF' (0..3) and 'WEBP' (8..11)
    if (
      bytesRead >= 12 &&
      buffer.toString('ascii', 0, 4) === 'RIFF' &&
      buffer.toString('ascii', 8, 12) === 'WEBP'
    ) {
      return {
        valid: true,
        detectedType: 'image/webp',
      };
    }

    // If none matched, the file header is invalid
    return {
      valid: false,
      error:
        'Invalid image content. File signature does not match a valid chest X-ray image (JPEG or PNG required).',
    };
  } catch (err) {
    return {
      valid: false,
      error: `Failed to inspect file contents: ${err.message}`,
    };
  } finally {
    if (fileHandle) {
      await fileHandle.close();
    }
  }
}

/**
 * Ensures a resolved file path is safely contained within an allowed base directory.
 * Prevents Directory Traversal (LFI) attacks like `../../etc/passwd` or `uploads/../../private`.
 *
 * @param {string} baseDir - The trusted base directory (e.g. uploads/)
 * @param {string} targetPath - The path to test
 * @returns {boolean} - True if targetPath is safely inside baseDir
 */
export function isSafePath(baseDir, targetPath) {
  const resolvedBase = path.resolve(baseDir);
  const resolvedTarget = path.resolve(targetPath);
  return (
    resolvedTarget.startsWith(resolvedBase + path.sep) ||
    resolvedTarget === resolvedBase
  );
}

/**
 * Safely removes a file from disk if it exists, without throwing uncaught errors.
 * Useful for cleaning up orphaned files after database or validation errors.
 *
 * @param {string} filePath - Absolute or relative path to file
 */
export async function deleteFileIfExists(filePath) {
  if (!filePath) return;
  try {
    if (fs.existsSync(filePath)) {
      await fs.promises.unlink(filePath);
      console.log(`🧹 Cleaned up file: ${path.basename(filePath)}`);
    }
  } catch (err) {
    console.error(`⚠️  Failed to delete file (${filePath}):`, err.message);
  }
}
