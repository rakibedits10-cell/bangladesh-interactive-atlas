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

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(mapX, mapY, mapW, mapH);
  ctx.strokeStyle = '#E2E8F0';
  ctx.lineWidth = 2;
  ctx.strokeRect(mapX, mapY, mapW, mapH);

  // Subtle geometric center crosshair inside map frame
  ctx.save();
  ctx.strokeStyle = '#F1F5F9';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(mapX + mapW / 2, mapY + 24);
  ctx.lineTo(mapX + mapW / 2, mapY + mapH - 24);
  ctx.moveTo(mapX + 24, mapY + mapH / 2);
  ctx.lineTo(mapX + mapW - 24, mapY + mapH / 2);
  ctx.stroke();
  ctx.restore();

  // Render Exact Territory Vector Silhouette centered in map frame
  const [minX, minY, maxX, maxY] = input.bbox;
  const polyW = Math.max(1, maxX - minX);
  const polyH = Math.max(1, maxY - minY);
  const innerPad = 72;
  const scale = Math.min((mapW - innerPad * 2) / polyW, (mapH - innerPad * 2) / polyH);
  const drawX = mapX + (mapW - polyW * scale) / 2 - minX * scale;
  const drawY = mapY + (mapH - polyH * scale) / 2 - minY * scale;

  ctx.save();
  ctx.beginPath();
  ctx.rect(mapX + 2, mapY + 2, mapW - 4, mapH - 4);
  ctx.clip();

  ctx.translate(drawX, drawY);
  ctx.scale(scale, scale);

  const path2d = new Path2D(input.svgPath);
  // Subtle drop lift
  ctx.save();
  ctx.shadowColor = 'rgba(4, 120, 87, 0.14)';
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = '#D1FAE5';
  ctx.fill(path2d);
  ctx.restore();

  // Crisp Emerald Map Fill + Dark Forest Border
  ctx.fillStyle = '#10B981';
  ctx.fill(path2d);
  ctx.strokeStyle = '#064E3B';
  ctx.lineWidth = 3 / scale;
  ctx.lineJoin = 'round';
  ctx.stroke(path2d);
  ctx.restore();

  // Minimalist Bangladesh Context Locator in bottom-right corner of map box
  if (input.divisionPaths.length > 0) {
    const locW = 112;
    const locH = 140;
    const locX = mapX + mapW - locW - 24;
    const locY = mapY + mapH - locH - 24;
    const locScale = Math.min(locW / 800, locH / 1000);

    ctx.save();
    ctx.fillStyle = 'rgba(248, 250, 252, 0.92)';
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 1.5;
    ctx.fillRect(locX - 10, locY - 10, locW + 20, locH + 20);
    ctx.strokeRect(locX - 10, locY - 10, locW + 20, locH + 20);

    ctx.translate(locX, locY);
    ctx.scale(locScale, locScale);
    for (const dp of input.divisionPaths) {
      const p = new Path2D(dp);
      ctx.fillStyle = '#E2E8F0';
      ctx.fill(p);
    }
    const targetMini = new Path2D(input.svgPath);
    ctx.fillStyle = '#047857';
    ctx.fill(targetMini);
    ctx.strokeStyle = '#047857';
    ctx.lineWidth = 8;
    ctx.stroke(targetMini);
    ctx.restore();
  }

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
