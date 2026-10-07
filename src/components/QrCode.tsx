import { qrMatrix } from '@/lib/qr';

/** Crisp, scalable QR code (prints sharply at any size). */
export function QrCode({ text, className, color = '#0f172a', title }: { text: string; className?: string; color?: string; title?: string }) {
  const m = qrMatrix(text);
  const n = m.length;
  const quiet = 4; // the blank margin scanners need
  let d = '';
  m.forEach((row, r) => row.forEach((dark, c) => {
    if (dark) d += `M${c + quiet} ${r + quiet}h1v1h-1z`;
  }));
  return (
    <svg viewBox={`0 0 ${n + quiet * 2} ${n + quiet * 2}`} className={className} role="img" aria-label={title ?? 'QR code'} shapeRendering="crispEdges">
      <rect width="100%" height="100%" fill="#ffffff" />
      <path d={d} fill={color} />
    </svg>
  );
}
