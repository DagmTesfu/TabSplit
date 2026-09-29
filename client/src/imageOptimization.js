// Pure JS image optimization and validation helpers for receipt scanning.
// Runs on the client to downscale high-resolution camera photos before upload.

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_ORIGINAL_BYTES = 20 * 1024 * 1024; // 20 MB max selection/capture
export const MAX_OPTIMIZED_BYTES = 5 * 1024 * 1024; // 5 MB max for transmission to backend

export function isAllowedImageType(file) {
  if (!file) return false;
  if (ALLOWED_IMAGE_TYPES.includes(file.type)) return true;
  // Android Gallery fallback: check filename extension if MIME type is missing or generic
  const name = (file.name || '').toLowerCase();
  return name.endsWith('.jpg') || name.endsWith('.jpeg') || name.endsWith('.png') || name.endsWith('.webp');
}

export async function optimizeImageForScan(file) {
  if (!file || typeof window === 'undefined' || typeof Image === 'undefined') return file;

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxDim = 1600;
      let { width, height } = img;

      // If already within optimal dimensions and <= 1 MB, use original
      if (width <= maxDim && height <= maxDim && file.size <= 1024 * 1024) {
        resolve(file);
        return;
      }

      if (width > height) {
        if (width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }

      try {
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              const cleanName = (file.name || 'receipt.jpg').replace(/\.[^/.]+$/, '') + '.jpg';
              resolve(new File([blob], cleanName, { type: 'image/jpeg' }));
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.85
        );
      } catch {
        resolve(file);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };

    img.src = url;
  });
}

export async function processReceiptFile(file, optimizeFn = optimizeImageForScan) {
  if (!file) return { file: null, error: null };

  if (!isAllowedImageType(file)) {
    return { file: null, error: 'Please select a JPEG, PNG, or WebP image.' };
  }

  if (file.size > MAX_ORIGINAL_BYTES) {
    return { file: null, error: 'Receipt image must be 20 MB or smaller.' };
  }

  // Ensure normalized MIME type for mobile browsers (e.g. image/jpg or empty string -> image/jpeg)
  let normalizedFile = file;
  let mimeType = file.type;
  if (!mimeType || mimeType === 'image/jpg' || mimeType === 'image/pjpeg') {
    const name = (file.name || '').toLowerCase();
    if (name.endsWith('.png')) mimeType = 'image/png';
    else if (name.endsWith('.webp')) mimeType = 'image/webp';
    else mimeType = 'image/jpeg';
    if (typeof File !== 'undefined') {
      try {
        normalizedFile = new File([file], file.name || 'receipt.jpg', { type: mimeType });
      } catch {
        normalizedFile = file;
      }
    }
  }

  let optimized = normalizedFile;
  try {
    optimized = await optimizeFn(normalizedFile);
  } catch {
    // If optimization fails, fallback to normalized file
  }

  if (optimized && optimized.size > MAX_OPTIMIZED_BYTES) {
    return { file: null, error: 'Receipt image must be 5 MB or smaller.' };
  }

  return { file: optimized, error: null };
}
