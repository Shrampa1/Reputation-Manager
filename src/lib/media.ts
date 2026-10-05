import { supabase } from '@/lib/supabase';

const MAX_DIMENSION = 1440; // Instagram's max width; fine for Facebook and Google too
const MAX_INPUT_BYTES = 20 * 1024 * 1024;

/**
 * Resizes an image and re-encodes it as JPEG in the browser.
 * Instagram only accepts JPEG, so every uploaded image is normalized the same way.
 */
export async function toJpeg(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('Image is too large (max 20 MB).');

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process image.');
  // JPEG has no transparency; paint white behind PNGs with alpha
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not process image.'))), 'image/jpeg', 0.88);
  });
}

/** Uploads to the public post-media bucket under the org's folder (required by storage RLS). */
export async function uploadPostImage(organizationId: string, file: File): Promise<string> {
  const jpeg = await toJpeg(file);
  const path = `${organizationId}/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from('post-media').upload(path, jpeg, {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw new Error(`Image upload failed: ${error.message}`);
  return supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl;
}