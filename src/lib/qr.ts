import qrcode from 'qrcode-generator';

/** Where the counter QR code points: the public rating page for this business. */
export function reviewQrUrl(publicKey: string) {
  return `${window.location.origin}/q/${publicKey}`;
}

/** Dark/light grid for a QR code ("M" error correction survives a smudge or a fold). */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

/** Saves the QR code as a PNG (for menus, receipts, flyers, social posts). */
export function downloadQrPng(text: string, fileName: string, size = 1024) {
  const m = qrMatrix(text);
  const quiet = 4;
  const cells = m.length + quiet * 2;
  const scale = Math.max(1, Math.floor(size / cells));
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = cells * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#000000';
  m.forEach((row, r) => row.forEach((dark, c) => {
    if (dark) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
  }));
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/png');
}
