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

// ---------------------------------------------------------------- Video (TikTok)
export const VIDEO_TYPES = ['video/mp4', 'video/quicktime', 'video/webm'];
/** Supabase's upload limit on the free plan; TikTok itself accepts up to 4 GB */
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const VIDEO_EXT: Record<string, string> = { 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm' };

export function isVideoFile(file: File) {
  return file.type.startsWith('video/');
}

export function checkVideoFile(file: File): string | null {
  if (!VIDEO_TYPES.includes(file.type)) return 'Use an MP4, MOV or WebM video.';
  if (file.size > MAX_VIDEO_BYTES) return `Video is too large (${(file.size / 1024 / 1024).toFixed(0)} MB). The limit is 50 MB.`;
  return null;
}

/** Video length in seconds, read in the browser (null if the browser can't tell). */
export function videoDuration(src: string): Promise<number | null> {
  return new Promise((resolve) => {
    const el = document.createElement('video');
    el.preload = 'metadata';
    el.muted = true;
    const done = (v: number | null) => {
      el.removeAttribute('src');
      el.load();
      resolve(v);
    };
    el.onloadedmetadata = () => done(Number.isFinite(el.duration) ? el.duration : null);
    el.onerror = () => done(null);
    setTimeout(() => done(null), 8000);
    el.src = src;
  });
}

export async function uploadPostVideo(organizationId: string, file: File): Promise<string> {
  const problem = checkVideoFile(file);
  if (problem) throw new Error(problem);
  const path = `${organizationId}/${crypto.randomUUID()}.${VIDEO_EXT[file.type] ?? 'mp4'}`;
  const { error } = await supabase.storage.from('post-media').upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw new Error(`Video upload failed: ${error.message}`);
  return supabase.storage.from('post-media').getPublicUrl(path).data.publicUrl;
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
