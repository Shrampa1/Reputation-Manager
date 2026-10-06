// Draws a review as a square social media image (1080×1080 JPEG) in the browser.

export type GraphicTemplate = 'ocean' | 'sunset' | 'forest';

export const GRAPHIC_TEMPLATES: { key: GraphicTemplate; name: string; colors: [string, string, string]; preview: string }[] = [
  { key: 'ocean', name: 'Ocean', colors: ['#0ea5e9', '#0284c7', '#1d4ed8'], preview: 'from-sky-500 to-blue-700' },
  { key: 'sunset', name: 'Sunset', colors: ['#fb923c', '#f43f5e', '#be123c'], preview: 'from-orange-400 to-rose-600' },
  { key: 'forest', name: 'Forest', colors: ['#10b981', '#0d9488', '#115e59'], preview: 'from-emerald-500 to-teal-700' },
];

const SIZE = 1080;
const PADDING = 110;
const FONT = "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

function starPath(ctx: CanvasRenderingContext2D, cx: number, cy: number, outer: number, inner: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const x = cx + r * Math.cos(angle);
    const y = cy + r * Math.sin(angle);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** Splits text into lines that fit `maxWidth` at the context's current font. */
function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width <= maxWidth || !line) {
      line = candidate;
    } else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/** Picks the largest font size (down to a floor) at which the quote fits; truncates if it never does. */
function fitQuote(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxHeight: number) {
  for (let size = 60; size >= 32; size -= 2) {
    ctx.font = `600 ${size}px ${FONT}`;
    const lineHeight = size * 1.35;
    const lines = wrap(ctx, text, maxWidth);
    if (lines.length * lineHeight <= maxHeight) return { lines, size, lineHeight };
  }
  const size = 32;
  ctx.font = `600 ${size}px ${FONT}`;
  const lineHeight = size * 1.35;
  const maxLines = Math.floor(maxHeight / lineHeight);
  const lines = wrap(ctx, text, maxWidth).slice(0, maxLines);
  let last = lines[lines.length - 1] ?? '';
  while (last && ctx.measureText(`${last}…”`).width > maxWidth) last = last.replace(/\s*\S+$/, '');
  lines[lines.length - 1] = `${last}…”`;
  return { lines, size, lineHeight };
}

export async function renderReviewGraphic(input: {
  content: string;
  authorName: string;
  rating: number;
  businessName: string;
  template: GraphicTemplate;
}): Promise<Blob> {
  // Make sure the web font is ready, or the first render falls back to a system font
  try {
    await document.fonts.load(`600 48px Inter`);
  } catch {
    /* system font is fine */
  }

  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Your browser can’t create images.');

  const tpl = GRAPHIC_TEMPLATES.find((t) => t.key === input.template) ?? GRAPHIC_TEMPLATES[0];

  // Background
  const bg = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  bg.addColorStop(0, tpl.colors[0]);
  bg.addColorStop(0.5, tpl.colors[1]);
  bg.addColorStop(1, tpl.colors[2]);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Soft decorative circles
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath();
  ctx.arc(SIZE - 60, 60, 260, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(40, SIZE - 30, 200, 0, Math.PI * 2);
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  // Big quote mark
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.font = `800 220px Georgia, 'Times New Roman', serif`;
  ctx.fillText('“', SIZE / 2, 290);

  // Stars
  const stars = Math.max(1, Math.min(5, Math.round(input.rating)));
  const starSize = 34;
  const gap = 18;
  const starsWidth = 5 * starSize * 2 + 4 * gap;
  let x = SIZE / 2 - starsWidth / 2 + starSize;
  for (let i = 0; i < 5; i++) {
    starPath(ctx, x, 330, starSize, starSize * 0.45);
    ctx.fillStyle = i < stars ? '#fcd34d' : 'rgba(255,255,255,0.3)';
    ctx.fill();
    x += starSize * 2 + gap;
  }

  // Quote text, vertically centered in the space between stars and author
  const quote = input.content.trim() || 'Great service!';
  const top = 410;
  const bottom = SIZE - 230;
  const { lines, lineHeight } = fitQuote(ctx, `“${quote}”`, SIZE - PADDING * 2, bottom - top);
  ctx.fillStyle = '#ffffff';
  const blockHeight = lines.length * lineHeight;
  let y = top + (bottom - top - blockHeight) / 2 + lineHeight * 0.8;
  for (const line of lines) {
    ctx.fillText(line, SIZE / 2, y);
    y += lineHeight;
  }

  // Author and business
  ctx.font = `700 40px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.fillText(`— ${input.authorName}`, SIZE / 2, SIZE - 150);
  ctx.font = `500 30px ${FONT}`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText(input.businessName, SIZE / 2, SIZE - 95);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Couldn’t create the image.'))), 'image/jpeg', 0.92);
  });
}

export function graphicFileName(authorName: string) {
  const slug = authorName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'review';
  return `review-${slug}.jpg`;
}
