// Multipart upload endpoint. All images remain in memory, never on disk.
import express from 'express';
import multer from 'multer';
import { AiError, extractReceipt, SUPPORTED_IMAGE_TYPES, MAX_IMAGE_BYTES } from '../ai.js';

const router = express.Router();

// Receipt images plus the client-selected currency travel in one multipart
// request; the image stays in memory and the currency is a plain text field.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_BYTES, files: 1, fields: 1, fieldSize: 20, parts: 3 },
  fileFilter: (req, file, cb) => {
    if (Object.hasOwn(SUPPORTED_IMAGE_TYPES, file.mimetype)) cb(null, true);
    else cb(new AiError('INVALID_UPLOAD', 'Unsupported file type. Use JPG, PNG or WebP.'));
  },
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'currency', maxCount: 1 },
]);

router.post('/extract-receipt', (req, res) => {
  // Even extraction results should not be cached by browsers or shared proxies.
  res.set('Cache-Control', 'no-store');
  upload(req, res, async (error) => {
    if (error) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      return res.status(tooLarge ? 413 : 400).json({
        error: tooLarge ? 'Image is too large (max 5 MB).' :
          error instanceof AiError ? error.message : 'Invalid upload. Send exactly one image file in the image field plus a currency field.',
        code: tooLarge ? 'IMAGE_TOO_LARGE' : 'INVALID_UPLOAD',
      });
    }
    const file = req.files?.image?.[0];
    if (!file) {
      return res.status(400).json({ error: 'No image uploaded. Attach a file under the "image" field.', code: 'NO_FILE' });
    }
    try {
      res.json(await extractReceipt(file.buffer, file.mimetype, req.body.currency));
    } catch (error) {
      if (error instanceof AiError) {
        const status = { NOT_CONFIGURED: 503, PROVIDER_ERROR: 502, PROVIDER_TIMEOUT: 504, INVALID_RESPONSE: 422, INVALID_IMAGE: 400, INVALID_CURRENCY: 400 }[error.code] || 502;
        res.status(status).json({ error: error.message, code: error.code });
      } else {
        res.status(500).json({ error: 'Extraction failed. Please try again.' });
      }
    } finally {
      // Release the request's reference once the provider call has completed.
      delete req.files;
    }
  });
});

export default router;
