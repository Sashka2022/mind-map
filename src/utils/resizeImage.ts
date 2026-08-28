/**
 * Downscales an image file to a small square-ish JPEG data URL. A phone
 * photo/selfie can be several MB straight out of the camera; the map is
 * persisted to localStorage as one JSON blob, so an unresized photo could
 * easily blow the browser's storage quota for the whole map.
 */
export async function fileToResizedDataUrl(file: File, maxSize = 320, quality = 0.85): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('לא ניתן היה לקרוא את התמונה'));
      img.src = objectUrl;
    });

    const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
    const width = Math.round(img.naturalWidth * scale);
    const height = Math.round(img.naturalHeight * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('לא ניתן היה לעבד את התמונה');
    ctx.drawImage(img, 0, 0, width, height);

    return canvas.toDataURL('image/jpeg', quality);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

/**
 * Captures the current frame of a live `getUserMedia` video feed as a
 * downscaled JPEG data URL, mirrored horizontally so the saved photo
 * matches the mirrored preview the user was looking at (standard selfie
 * convention).
 */
export function videoFrameToResizedDataUrl(video: HTMLVideoElement, maxSize = 320, quality = 0.85): string {
  const scale = Math.min(1, maxSize / Math.max(video.videoWidth, video.videoHeight));
  const width = Math.round(video.videoWidth * scale);
  const height = Math.round(video.videoHeight * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('לא ניתן היה לעבד את התמונה');
  ctx.translate(width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(video, 0, 0, width, height);

  return canvas.toDataURL('image/jpeg', quality);
}
