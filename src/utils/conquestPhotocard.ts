export type ConquestTier = 'upazila' | 'district' | 'division';

export interface ConquestPhotocardInput {
  tier: ConquestTier;
  nameEn: string;
  nameBn: string;
  parentEn?: string;
  parentBn?: string;
  svgPath: string;
  bbox: [number, number, number, number];
  divisionPaths: string[];
  playerName?: string;
  completionSec: number;
  conqueredAt: number;
  correctCount?: number;
  totalQuestions?: number;
}

export interface RenderedPhotocard {
  dataUrl: string;
  blob: Blob | null;
  fileName: string;
}

function formatDurationEn(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m < 10 ? `0${m}` : m}:${s < 10 ? `0${s}` : s}`;
}

export function getConquestHeadline(tier: ConquestTier): string {
  if (tier === 'upazila') return 'You Conquer This Upazila';
  if (tier === 'district') return 'You Conquer This District';
  return 'You Conquer This Division';
}

function computeMapVisualCenter(
  svgPath: string,
  fallbackX: number,
  fallbackY: number
): [number, number] {
  let bestRing: [number, number][] = [];
  let bestArea = -1;

  for (const rawSub of svgPath.split('M')) {
    const cleaned = rawSub.replace(/[Zz]/g, '').trim();
    if (!cleaned) continue;
    const pts = cleaned
      .split('L')
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => {
        const [x, y] = s.split(',').map(Number);
        return [x || 0, y || 0] as [number, number];
      });
    if (pts.length < 3) continue;
    let a = 0;
    for (let i = 0; i < pts.length; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % pts.length];
      a += x1 * y2 - x2 * y1;
    }
    const absA = Math.abs(a) / 2;
    if (absA > bestArea) {
      bestArea = absA;
      bestRing = pts;
    }
  }

  if (bestRing.length < 3 || bestArea <= 0) {
    return [fallbackX, fallbackY];
  }

  let cxAcc = 0;
  let cyAcc = 0;
  let signedArea = 0;
  for (let i = 0; i < bestRing.length; i++) {
    const [x0, y0] = bestRing[i];
    const [x1, y1] = bestRing[(i + 1) % bestRing.length];
    const cross = x0 * y1 - x1 * y0;
    signedArea += cross;
    cxAcc += (x0 + x1) * cross;
    cyAcc += (y0 + y1) * cross;
  }
  signedArea *= 0.5;
  let cx = Math.abs(signedArea) > 1e-6 ? cxAcc / (6 * signedArea) : fallbackX;
  const cy = Math.abs(signedArea) > 1e-6 ? cyAcc / (6 * signedArea) : fallbackY;

  const xs: number[] = [];
  for (let i = 0, j = bestRing.length - 1; i < bestRing.length; j = i++) {
    const [xi, yi] = bestRing[i];
    const [xj, yj] = bestRing[j];
    if ((yi > cy) !== (yj > cy)) {
      xs.push(((xj - xi) * (cy - yi)) / (yj - yi) + xi);
    }
  }
  if (xs.length >= 2) {
    xs.sort((a, b) => a - b);
    let maxSpan = -1;
    let bestMidX = cx;
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const span = xs[k + 1] - xs[k];
      if (span > maxSpan) {
        maxSpan = span;
        bestMidX = (xs[k] + xs[k + 1]) / 2;
      }
    }
    if (maxSpan > 0) cx = bestMidX;
  }

  return [cx, cy];
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
  ctx.lineTo(x + rad, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rad);
  ctx.lineTo(x, y + rad);
  ctx.quadraticCurveTo(x, y, x + rad, y);
  ctx.closePath();
}

function drawMapPin(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  pinColor: string,
  dotColor: string
) {
  const tipY = cy + radius * 1.45;
  ctx.save();
  ctx.fillStyle = pinColor;
  ctx.beginPath();
  ctx.arc(cx, cy - radius * 0.12, radius, Math.PI * 0.84, Math.PI * 2.16, false);
  ctx.quadraticCurveTo(cx + radius * 0.85, cy + radius * 0.58, cx, tipY);
  ctx.quadraticCurveTo(cx - radius * 0.85, cy + radius * 0.58, cx - radius * 0.876, cy + radius * 0.36);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = dotColor;
  ctx.beginPath();
  ctx.arc(cx, cy - radius * 0.12, radius * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export async function renderConquestPhotocardPng(
  input: ConquestPhotocardInput
): Promise<RenderedPhotocard> {
  const SIZE = 1200;
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Canvas 2D context unavailable');
  }

  // Ensure Bengali/Display fonts are ready before drawing
  if (document.fonts?.ready) {
    try {
      await document.fonts.ready;
    } catch {
      // proceed with loaded fonts
    }
  }

  // 1. Clean Minimalist Off-White Canvas
  ctx.fillStyle = '#FAFBF9';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Subtle architectural outer inset frame
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.strokeRect(48, 48, SIZE - 96, SIZE - 96);

  // Clean corner registration ticks
  const tickLen = 20;
  ctx.strokeStyle = '#047857';
  ctx.lineWidth = 3;
  const corners: [number, number, number, number][] = [
    [48, 48, 1, 1],
    [SIZE - 48, 48, -1, 1],
    [48, SIZE - 48, 1, -1],
    [SIZE - 48, SIZE - 48, -1, -1],
  ];
  for (const [cx, cy, dx, dy] of corners) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + dy * tickLen);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + dx * tickLen, cy);
    ctx.stroke();
  }

  // 2. Top Minimalist Kicker & Headline
  ctx.textAlign = 'center';
  ctx.fillStyle = '#047857';
  ctx.font = '600 20px "Noto Sans Bengali", "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText('CONQUER BANGLADESH THROUGH KNOWLEDGE', SIZE / 2, 122);

  ctx.fillStyle = '#0F172A';
  ctx.font = '700 46px "Noto Sans Bengali", "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(getConquestHeadline(input.tier), SIZE / 2, 186);

  // Territory Title (EN + BN)
  const unitSuffixEn =
    input.tier === 'upazila' ? '' : input.tier === 'district' ? ' District' : ' Division';
  const unitSuffixBn =
    input.tier === 'upazila' ? '' : input.tier === 'district' ? ' জেলা' : ' বিভাগ';
  const titleLine = `${input.nameEn}${unitSuffixEn}  ·  ${input.nameBn}${unitSuffixBn}`;
  ctx.fillStyle = '#334155';
  ctx.font = '600 26px "Noto Sans Bengali", "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(titleLine, SIZE / 2, 234);

  if (input.parentEn || input.parentBn) {
    const parentLine = [input.parentEn, input.parentBn].filter(Boolean).join(' · ');
    ctx.fillStyle = '#64748B';
    ctx.font = '500 20px "Noto Sans Bengali", "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(parentLine, SIZE / 2, 268);
  }

  // 3. Centerpiece Clean Map Frame
  const mapX = 128;
  const mapY = 308;
  const mapW = SIZE - 256;
  const mapH = 680;

  ctx.save();
  drawRoundedRectPath(ctx, mapX, mapY, mapW, mapH, 16);
  ctx.fillStyle = '#FFFFFF';
  ctx.fill();
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.clip();

  // Compute Territory Transform & Visual Center
  const [minX, minY, maxX, maxY] = input.bbox;
  const polyW = Math.max(1, maxX - minX);
  const polyH = Math.max(1, maxY - minY);
  const innerPad = 74;
  const scale = Math.min((mapW - innerPad * 2) / polyW, (mapH - innerPad * 2) / polyH);
  const drawX = mapX + (mapW - polyW * scale) / 2 - minX * scale;
  const drawY = mapY + (mapH - polyH * scale) / 2 - minY * scale;

  const [visX, visY] = computeMapVisualCenter(
    input.svgPath,
    minX + polyW / 2,
    minY + polyH / 2
  );
  const pinCenterX = Math.max(
    mapX + 160,
    Math.min(mapX + mapW - 160, drawX + visX * scale)
  );
  const pinCenterY = Math.max(
    mapY + 80,
    Math.min(mapY + mapH - 80, drawY + visY * scale)
  );

  // Soft Concentric Emerald Halo Rings radiating behind Territory Silhouette
  const ringRadii = [340, 250, 165];
  const ringAlphas = [0.025, 0.04, 0.06];
  for (let i = 0; i < ringRadii.length; i++) {
    ctx.beginPath();
    ctx.arc(mapX + mapW / 2, mapY + mapH / 2, ringRadii[i], 0, Math.PI * 2);
    ctx.fillStyle = `rgba(16, 185, 129, ${ringAlphas[i]})`;
    ctx.fill();
    ctx.strokeStyle = 'rgba(16, 185, 129, 0.06)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Render Territory Vector Silhouette
  ctx.save();
  ctx.translate(drawX, drawY);
  ctx.scale(scale, scale);

  const path2d = new Path2D(input.svgPath);
  ctx.save();
  ctx.shadowColor = 'rgba(5, 150, 105, 0.22)';
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#10B981';
  ctx.fill(path2d);
  ctx.restore();

  const grad = ctx.createLinearGradient(minX, minY, minX, maxY);
  grad.addColorStop(0, '#10B981');
  grad.addColorStop(1, '#059669');
  ctx.fillStyle = grad;
  ctx.fill(path2d);
  ctx.strokeStyle = '#064E3B';
  ctx.lineWidth = 3.2 / scale;
  ctx.lineJoin = 'round';
  ctx.stroke(path2d);
  ctx.restore();

  // Centered Dark-Emerald Map Pin Label Pill
  const mapLabelEn = `${input.nameEn}${unitSuffixEn}`;
  let pillFontSize = 26;
  ctx.font = `700 ${pillFontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
  const maxTextW = mapW * 0.56;
  const measuredTextW = ctx.measureText(mapLabelEn).width;
  if (measuredTextW > maxTextW) {
    pillFontSize = Math.max(18, Math.floor((pillFontSize * maxTextW) / measuredTextW));
    ctx.font = `700 ${pillFontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
  }
  const textW = ctx.measureText(mapLabelEn).width;
  const pinRadius = 9;
  const pillH = 50;
  const pillPadL = 18;
  const pillPadR = 22;
  const iconTextGap = 11;
  const pillW = pillPadL + pinRadius * 2 + iconTextGap + textW + pillPadR;
  const pillX = pinCenterX - pillW / 2;
  const pillY = pinCenterY - pillH / 2;

  ctx.save();
  // Soft emerald drop glow under capsule
  ctx.shadowColor = 'rgba(6, 78, 59, 0.34)';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  drawRoundedRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.fillStyle = 'rgba(6, 78, 59, 0.9)';
  ctx.fill();
  ctx.restore();

  // Crisp luminous emerald inner & outer capsule ring
  ctx.save();
  drawRoundedRectPath(ctx, pillX, pillY, pillW, pillH, pillH / 2);
  ctx.strokeStyle = 'rgba(110, 231, 183, 0.45)';
  ctx.lineWidth = 5;
  ctx.stroke();
  ctx.strokeStyle = '#34D399';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.restore();

  // Crisp White Map Pin Icon + English Territory Name inside Pill
  const iconCx = pillX + pillPadL + pinRadius;
  drawMapPin(ctx, iconCx, pinCenterY - 1, pinRadius, '#FFFFFF', '#064E3B');

  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 ${pillFontSize}px "Plus Jakarta Sans", system-ui, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(mapLabelEn, iconCx + pinRadius + iconTextGap, pinCenterY + 1);
  ctx.restore();

  // Minimalist Bangladesh Context Locator in bottom-right corner of map box
  if (input.divisionPaths.length > 0) {
    const locW = 112;
    const locH = 140;
    const locX = mapX + mapW - locW - 26;
    const locY = mapY + mapH - locH - 26;
    const locScale = Math.min(locW / 800, locH / 1000);

    ctx.save();
    drawRoundedRectPath(ctx, locX - 12, locY - 12, locW + 24, locH + 24, 12);
    ctx.fillStyle = 'rgba(248, 250, 252, 0.94)';
    ctx.fill();
    ctx.strokeStyle = '#CBD5E1';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.save();
    ctx.translate(locX, locY);
    ctx.scale(locScale, locScale);
    for (const dp of input.divisionPaths) {
      const p = new Path2D(dp);
      ctx.fillStyle = '#DCE6F0';
      ctx.fill(p);
    }
    const targetMini = new Path2D(input.svgPath);
    ctx.fillStyle = 'rgba(16, 185, 129, 0.45)';
    ctx.fill(targetMini);
    ctx.restore();

    // Crisp Emerald Pin Marker at the Conquered Territory's position on Bangladesh map
    const miniPinX = locX + visX * locScale;
    const miniPinY = locY + visY * locScale - 5;
    drawMapPin(ctx, miniPinX, miniPinY, 6.5, '#059669', '#FFFFFF');
    ctx.restore();
  }

  ctx.restore(); // End map frame clip

  // 4. Clean Minimalist Footer Metadata Strip
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(128, 1034);
  ctx.lineTo(SIZE - 128, 1034);
  ctx.stroke();

  const dateStr = new Date(input.conqueredAt).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const conqueror = input.playerName?.trim() || 'Bangladesh Explorer';

  ctx.textAlign = 'left';
  ctx.fillStyle = '#0F172A';
  ctx.font = '600 22px "Noto Sans Bengali", "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(conqueror, 128, 1084);
  ctx.fillStyle = '#64748B';
  ctx.font = '500 18px "Noto Sans Bengali", "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillText(dateStr, 128, 1114);

  const totalQ = Math.max(1, input.totalQuestions ?? 30);
  const correctQ = Math.max(0, Math.min(totalQ, input.correctCount ?? totalQ));
  const accuracyPct = Math.round((correctQ / totalQ) * 100);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#047857';
  ctx.font = '700 22px "JetBrains Mono", monospace';
  ctx.fillText(`${correctQ} / ${totalQ}  ·  ${accuracyPct}% ACCURACY`, SIZE - 128, 1084);
  ctx.fillStyle = '#64748B';
  ctx.font = '500 18px "JetBrains Mono", monospace';
  ctx.fillText(`TIME ${formatDurationEn(input.completionSec)}`, SIZE - 128, 1114);

  const dataUrl = canvas.toDataURL('image/png');
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob((b) => resolve(b), 'image/png')
  );
  const slug = input.nameEn
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  return {
    dataUrl,
    blob,
    fileName: `conquered-${input.tier}-${slug || 'bangladesh'}.png`,
  };
}
