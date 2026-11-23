import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Compass,
  MapPin,
  Waves,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
} from 'lucide-react';
import {
  DIRECTION_INFO,
  DISTRICT_DETAILS,
  DIVISION_META,
  type DirectionZone,
} from '../data/bdDistrictDetails';
import { RIVER_DETAILS } from '../data/bdRiverDetails';
import type { GeoDistrict, GeoRiver, Lang, Theme } from '../types/map';

interface DistrictDetailPanelProps {
  districts: GeoDistrict[];
  rivers: GeoRiver[];
  selectedDistrictId: string | null;
  selectedDivisionId: string | null;
  activeDirection: DirectionZone;
  activeRiverId: string | null;
  lang: Lang;
  theme: Theme;
  onSelectDistrict: (id: string | null) => void;
  onSelectDivision: (divisionId: string | null) => void;
  onSelectDirection: (dir: DirectionZone) => void;
  onSelectRiver: (riverId: string | null) => void;
}

export const DistrictDetailPanel: React.FC<DistrictDetailPanelProps> = ({
  districts,
  rivers,
  selectedDistrictId,
  selectedDivisionId,
  activeDirection,
  activeRiverId,
  lang,
  theme,
  onSelectDistrict,
  onSelectDivision,
  onSelectDirection,
  onSelectRiver,
}) => {
  const isDark = theme === 'dark';

  const districtMap = React.useMemo(
    () => new Map(districts.map((d) => [d.id, d])),
    [districts]
  );

  const selectedDistrict = selectedDistrictId ? districtMap.get(selectedDistrictId) || null : null;
  const detail = selectedDistrict ? DISTRICT_DETAILS[selectedDistrict.id] : null;
  const division = selectedDistrict ? DIVISION_META[selectedDistrict.divisionId] : null;

  const districtRivers = React.useMemo(() => {
    if (!selectedDistrict) return [];
    return rivers.filter((r) => r.districts.includes(selectedDistrict.id));
  }, [rivers, selectedDistrict]);

  const activeRiver = activeRiverId ? rivers.find((r) => r.id === activeRiverId) || null : null;

  // Local close-up map zoom & pan state (resets when selectedDistrictId changes)
  const [localZoom, setLocalZoom] = useState<number>(1);
  const [localPan, setLocalPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const localBoxRef = useRef<HTMLDivElement>(null);
  const localZoomRef = useRef(localZoom);
  const localPanRef = useRef(localPan);
  localZoomRef.current = localZoom;
  localPanRef.current = localPan;
  const localDragRef = useRef<{ x: number; y: number; px: number; py: number; moved: boolean } | null>(null);
  const localTouchRef = useRef<{
    mode: 'none' | 'pan' | 'pinch';
    sx: number;
    sy: number;
    px: number;
    py: number;
    dist: number;
    sz: number;
    moved: boolean;
  }>({ mode: 'none', sx: 0, sy: 0, px: 0, py: 0, dist: 0, sz: 1, moved: false });

  useEffect(() => {
    setLocalZoom(1);
    setLocalPan({ x: 0, y: 0 });
  }, [selectedDistrictId]);

  useEffect(() => {
    const el = localBoxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const oldZ = localZoomRef.current;
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= 240;
      const clampedDy = Math.max(-75, Math.min(75, dy));
      const factor = Math.exp(-clampedDy * 0.0042);
      const nextZ = Math.max(1, Math.min(4, Number((oldZ * factor).toFixed(3))));
      if (nextZ <= 1.01) {
        setLocalZoom(1);
        setLocalPan({ x: 0, y: 0 });
        return;
      }
      const dx = e.clientX - rect.left - rect.width / 2;
      const dyPos = e.clientY - rect.top - rect.height / 2;
      const ratio = nextZ / oldZ;
      setLocalZoom(nextZ);
      setLocalPan({
        x: dx - (dx - localPanRef.current.x) * ratio,
        y: dyPos - (dyPos - localPanRef.current.y) * ratio,
      });
    };
    const onTouchMoveNative = (e: TouchEvent) => {
      if (e.touches.length === 2 || localZoomRef.current > 1) {
        e.preventDefault();
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchmove', onTouchMoveNative, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchmove', onTouchMoveNative);
    };
  }, [selectedDistrictId]);

  // Compute tight cropped viewBox for the selected district + its bordering neighbors
  const localViewBox = React.useMemo(() => {
    if (!selectedDistrict) return '0 0 800 1000';
    const cluster = [
      selectedDistrict,
      ...selectedDistrict.neighbors
        .map((nid) => districtMap.get(nid))
        .filter((n): n is GeoDistrict => Boolean(n)),
    ];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const d of cluster) {
      const [bx0, by0, bx1, by1] = d.bbox;
      if (bx0 < minX) minX = bx0;
      if (by0 < minY) minY = by0;
      if (bx1 > maxX) maxX = bx1;
      if (by1 > maxY) maxY = by1;
    }
    const pad = 26;
    const x0 = minX - pad;
    const y0 = minY - pad;
    const w = Math.max(90, maxX - minX + pad * 2);
    const h = Math.max(75, maxY - minY + pad * 2);
    return `${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
  }, [selectedDistrict, districtMap]);

  // View 1 (Priority): Active River Course & Full Dossier
  if (activeRiver) {
    const riverDistricts = activeRiver.districts
      .map((did) => districtMap.get(did))
      .filter((d): d is GeoDistrict => Boolean(d));
    const riverDetail = RIVER_DETAILS[activeRiver.id];

    return (
      <aside className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 flex flex-col gap-5 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onSelectRiver(null)}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>
              {selectedDistrict
                ? lang === 'bn'
                  ? `${selectedDistrict.bnName} জেলায় ফিরুন`
                  : `Back to ${selectedDistrict.name}`
                : lang === 'bn'
                ? 'বাংলাদেশের পূর্ণ মানচিত্রে ফিরুন'
                : 'Back to Bangladesh Map'}
            </span>
          </button>
          {selectedDistrict && (
            <button
              type="button"
              onClick={() => {
                onSelectDistrict(null);
                onSelectRiver(null);
              }}
              className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline whitespace-nowrap"
            >
              {lang === 'bn' ? 'রিসেট' : 'Reset'}
            </button>
          )}
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-sky-700 dark:text-sky-400 font-medium">
            <span>{lang === 'bn' ? 'নদীর সম্পূর্ণ গতিপথ' : 'Full River Course'}</span>
            {riverDetail && (
              <>
                <span aria-hidden="true">·</span>
                <span>{lang === 'bn' ? riverDetail.basinBn : riverDetail.basinEn}</span>
              </>
            )}
          </div>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1 tracking-tight">
            {lang === 'bn' ? `${activeRiver.bnName} নদী` : `${activeRiver.name} River`}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-mono-tabular">
            {lang === 'bn' ? activeRiver.name : activeRiver.bnName} · ~{activeRiver.lengthKm}{' '}
            {lang === 'bn' ? 'কিমি (বাংলাদেশে)' : 'km (in Bangladesh)'}
          </p>
        </div>

        {riverDetail && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3.5 text-sm">
            <div>
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {lang === 'bn' ? 'উৎপত্তিস্থল ও প্রবেশ পথ' : 'Origin & Entry Point'}
              </div>
              <p className="text-slate-800 dark:text-slate-200 mt-1 leading-relaxed">
                {lang === 'bn' ? riverDetail.originBn : riverDetail.originEn}
              </p>
            </div>

            <div>
              <div className="text-xs font-semibold text-blue-700 dark:text-blue-400">
                {lang === 'bn' ? 'মোহনা / সমাপ্তিস্থল' : 'Mouth / Confluence'}
              </div>
              <p className="text-slate-800 dark:text-slate-200 mt-1 leading-relaxed">
                {lang === 'bn' ? riverDetail.mouthBn : riverDetail.mouthEn}
              </p>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'bn' ? 'উপনদী ও শাখানদী' : 'Tributaries & Distributaries'}
              </div>
              <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {lang === 'bn' ? riverDetail.tributariesBn : riverDetail.tributariesEn}
              </p>
            </div>

            <div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'bn' ? 'ভৌগোলিক ও অর্থনৈতিক গুরুত্ব' : 'Geographic & Economic Significance'}
              </div>
              <p className="text-slate-600 dark:text-slate-300 mt-1 leading-relaxed">
                {lang === 'bn' ? riverDetail.significanceBn : riverDetail.significanceEn}
              </p>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
            {lang === 'bn'
              ? `প্রবাহিত জেলাসমূহ (${riverDistricts.length}টি)`
              : `Districts Along This River (${riverDistricts.length})`}
          </h3>
          <div className="flex flex-wrap gap-2">
            {riverDistricts.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  onSelectRiver(null);
                  onSelectDistrict(d.id);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 dark:hover:bg-sky-900/70 border border-sky-200 dark:border-sky-800 text-xs font-medium text-sky-950 dark:text-sky-200 transition-colors"
              >
                <span>{lang === 'bn' ? d.bnName : d.name}</span>
                <ChevronRight className="w-3 h-3 text-sky-700 dark:text-sky-400" />
              </button>
            ))}
          </div>
        </div>
      </aside>
    );
  }

  // View 2: Selected District Map + Enriched Dossier
  if (selectedDistrict && detail && division) {
    const neighborSet = new Set(selectedDistrict.neighbors);
    const neighborDistricts = selectedDistrict.neighbors
      .map((nid) => districtMap.get(nid))
      .filter((n): n is GeoDistrict => Boolean(n));

    // Scale font cleanly for close-up local SVG based on viewBox width
    const vbParts = localViewBox.split(' ').map(Number);
    const vbW = vbParts[2] || 220;
    const localScale = vbW / 240;

    return (
      <aside className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 flex flex-col gap-5 transition-colors">
        {/* Top Back Navigation */}
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onSelectDistrict(null);
              onSelectRiver(null);
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'বাংলাদেশের পূর্ণ মানচিত্রে ফিরুন' : 'Back to Bangladesh Map'}</span>
          </button>

          <button
            type="button"
            onClick={() => onSelectDivision(division.id)}
            className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
          >
            {lang === 'bn' ? `${division.bnName} বিভাগ` : `${division.name} Div.`}
          </button>
        </div>

        {/* Title & Unboxed Geographic Metadata */}
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{lang === 'bn' ? `${division.bnName} বিভাগ` : `${division.name} Division`}</span>
            <span aria-hidden="true">·</span>
            <span>{lang === 'bn' ? detail.directionLabelBn : detail.directionLabelEn}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">
              {lang === 'bn' ? `প্রতিষ্ঠা ${detail.established}` : `Est. ${detail.established}`}
            </span>
          </div>

          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1.5 tracking-tight">
            {lang === 'bn'
              ? `${selectedDistrict.bnName} জেলা`
              : `${selectedDistrict.name} District`}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {lang === 'bn' ? selectedDistrict.name : selectedDistrict.bnName}
          </p>
        </div>

        {/* Dedicated Close-Up Map of Selected District & Bordering Neighbors */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-[#F4F8FA] dark:bg-[#0B1220] overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
              {lang === 'bn'
                ? `${selectedDistrict.bnName} ও পার্শ্ববর্তী জেলার মানচিত্র`
                : `${selectedDistrict.name} & Bordering Districts`}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const nz = Math.max(1, Number((localZoom / 1.4).toFixed(2)));
                  if (nz <= 1.01) {
                    setLocalZoom(1);
                    setLocalPan({ x: 0, y: 0 });
                  } else {
                    setLocalZoom(nz);
                  }
                }}
                disabled={localZoom <= 1}
                aria-label={lang === 'bn' ? 'জুম কমান' : 'Zoom out'}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setLocalZoom((z) => Math.min(4, Number((z * 1.4).toFixed(2))))}
                disabled={localZoom >= 4}
                aria-label={lang === 'bn' ? 'জুম বাড়ান' : 'Zoom in'}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              {localZoom > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setLocalZoom(1);
                    setLocalPan({ x: 0, y: 0 });
                  }}
                  aria-label={lang === 'bn' ? 'রিসেট' : 'Reset'}
                  className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
          <div
            ref={localBoxRef}
            onMouseDown={(e) => {
              if (localZoomRef.current <= 1 || e.button !== 0) return;
              localDragRef.current = {
                x: e.clientX,
                y: e.clientY,
                px: localPanRef.current.x,
                py: localPanRef.current.y,
                moved: false,
              };
            }}
            onMouseMove={(e) => {
              if (!localDragRef.current) return;
              const dx = e.clientX - localDragRef.current.x;
              const dy = e.clientY - localDragRef.current.y;
              if (Math.abs(dx) > 3 || Math.abs(dy) > 3) localDragRef.current.moved = true;
              setLocalPan({ x: localDragRef.current.px + dx, y: localDragRef.current.py + dy });
            }}
            onMouseUp={() => {
              window.setTimeout(() => {
                localDragRef.current = null;
              }, 0);
            }}
            onMouseLeave={() => {
              localDragRef.current = null;
            }}
            onTouchStart={(e) => {
              if (e.touches.length === 2) {
                const dist = Math.hypot(
                  e.touches[1].clientX - e.touches[0].clientX,
                  e.touches[1].clientY - e.touches[0].clientY
                );
                localTouchRef.current = {
                  mode: 'pinch',
                  sx: (e.touches[0].clientX + e.touches[1].clientX) / 2,
                  sy: (e.touches[0].clientY + e.touches[1].clientY) / 2,
                  px: localPanRef.current.x,
                  py: localPanRef.current.y,
                  dist: Math.max(1, dist),
                  sz: localZoomRef.current,
                  moved: true,
                };
              } else if (e.touches.length === 1 && localZoomRef.current > 1) {
                localTouchRef.current = {
                  mode: 'pan',
                  sx: e.touches[0].clientX,
                  sy: e.touches[0].clientY,
                  px: localPanRef.current.x,
                  py: localPanRef.current.y,
                  dist: 0,
                  sz: localZoomRef.current,
                  moved: false,
                };
              } else {
                localTouchRef.current.mode = 'none';
                localTouchRef.current.moved = false;
              }
            }}
            onTouchMove={(e) => {
              const ts = localTouchRef.current;
              if (e.touches.length === 2 && ts.mode === 'pinch') {
                const dist = Math.hypot(
                  e.touches[1].clientX - e.touches[0].clientX,
                  e.touches[1].clientY - e.touches[0].clientY
                );
                const nz = Math.max(1, Math.min(4, Number((ts.sz * (dist / ts.dist)).toFixed(3))));
                if (nz <= 1.01) {
                  setLocalZoom(1);
                  setLocalPan({ x: 0, y: 0 });
                } else {
                  setLocalZoom(nz);
                }
              } else if (e.touches.length === 1 && ts.mode === 'pan') {
                const dx = e.touches[0].clientX - ts.sx;
                const dy = e.touches[0].clientY - ts.sy;
                if (Math.abs(dx) > 4 || Math.abs(dy) > 4) ts.moved = true;
                setLocalPan({ x: ts.px + dx, y: ts.py + dy });
              }
            }}
            onTouchEnd={() => {
              window.setTimeout(() => {
                localTouchRef.current.mode = 'none';
                localTouchRef.current.moved = false;
              }, 0);
            }}
            className={`overflow-hidden select-none ${
              localZoom > 1 ? 'touch-none cursor-grab active:cursor-grabbing' : 'touch-pan-y'
            }`}
          >
            <svg
              viewBox={localViewBox}
              className="w-full h-56 sm:h-60"
              style={{
                transform: `translate(${localPan.x}px, ${localPan.y}px) scale(${localZoom})`,
                transformOrigin: 'center center',
              }}
              role="img"
              aria-label={
                lang === 'bn'
                  ? `${selectedDistrict.bnName} এবং তার পার্শ্ববর্তী জেলাসমূহের মানচিত্র`
                  : `Close-up map of ${selectedDistrict.name} and bordering districts`
              }
            >
              {districts.map((d) => {
                const isSelected = d.id === selectedDistrict.id;
                const isNeighbor = neighborSet.has(d.id);
                const fill = isSelected
                  ? isDark
                    ? '#059669'
                    : '#047857'
                  : isNeighbor
                  ? isDark
                    ? '#78350F'
                    : '#FDE68A'
                  : isDark
                  ? '#141D2E'
                  : '#E2E8F0';
                const stroke = isSelected
                  ? isDark
                    ? '#6EE7B7'
                    : '#064E3B'
                  : isNeighbor
                  ? isDark
                    ? '#F59E0B'
                    : '#B45309'
                  : isDark
                  ? '#334155'
                  : '#CBD5E1';
                return (
                  <path
                    key={`local-${d.id}`}
                    d={d.path}
                    fill={fill}
                    stroke={stroke}
                    strokeWidth={((isSelected ? 1.8 : isNeighbor ? 1.2 : 0.6) * localScale) / Math.sqrt(localZoom)}
                    strokeLinejoin="round"
                    opacity={isSelected || isNeighbor ? 1 : 0.45}
                    className={isNeighbor ? 'cursor-pointer hover:opacity-90' : ''}
                    onClick={() => {
                      if (localDragRef.current?.moved || localTouchRef.current.moved) return;
                      if (isNeighbor) {
                        onSelectRiver(null);
                        onSelectDistrict(d.id);
                      }
                    }}
                  />
                );
              })}

            {/* Rivers flowing through the selected district */}
            {districtRivers.map((r) => (
              <g key={`local-river-${r.id}`} className="pointer-events-none">
                <path
                  d={r.path}
                  fill="none"
                  stroke={isDark ? '#0B1220' : '#FFFFFF'}
                  strokeWidth={3.2 * localScale}
                  strokeLinecap="round"
                  strokeOpacity={0.8}
                />
                <path
                  d={r.path}
                  fill="none"
                  stroke={isDark ? '#38BDF8' : '#0284C7'}
                  strokeWidth={1.8 * localScale}
                  strokeLinecap="round"
                />
              </g>
            ))}

            {/* Labels for Selected District & Neighbors */}
            {[selectedDistrict, ...neighborDistricts].map((d) => {
              const isSelected = d.id === selectedDistrict.id;
              return (
                <text
                  key={`local-lbl-${d.id}`}
                  x={d.cx}
                  y={d.cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={((isSelected ? 9.5 : 7.8) * localScale) / Math.pow(localZoom, 0.55)}
                  fontWeight={isSelected ? '700' : '600'}
                  fill={
                    isSelected
                      ? '#FFFFFF'
                      : isDark
                      ? '#FDE68A'
                      : '#78350F'
                  }
                  stroke={
                    isSelected
                      ? '#064E3B'
                      : isDark
                      ? '#451A03'
                      : '#FFFFFF'
                  }
                  strokeWidth={(2.2 * localScale) / Math.pow(localZoom, 0.55)}
                  style={{ paintOrder: 'stroke' }}
                  className="pointer-events-none select-none"
                >
                  {lang === 'bn' ? d.bnName : d.name}
                </text>
              );
            })}
          </svg>
          </div>
        </div>

        {/* Key Numeric Stats Grid (Tabular Numerals) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'bn' ? 'আয়তন' : 'Area'}
            </div>
            <div className="font-mono-tabular text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
              {detail.areaKm2.toLocaleString()} {lang === 'bn' ? 'কিমি²' : 'km²'}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'bn' ? 'জনসংখ্যা' : 'Population'}
            </div>
            <div className="font-mono-tabular text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
              {lang === 'bn' ? detail.populationBn : detail.populationEn}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'bn' ? 'উপজেলা' : 'Upazilas'}
            </div>
            <div className="font-mono-tabular text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
              {detail.upazilas}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'bn' ? 'প্রতিষ্ঠা' : 'Founded'}
            </div>
            <div className="font-mono-tabular text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
              {detail.established}
            </div>
          </div>
        </div>

        {/* Summary, Specialties, History & Connectivity */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 space-y-3">
          <div>
            <div className="text-xs font-semibold text-emerald-800 dark:text-emerald-400">
              {lang === 'bn' ? 'বিখ্যাত যা কিছুর জন্য' : 'Known For'}
            </div>
            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mt-1 leading-relaxed">
              {lang === 'bn' ? detail.famousForBn : detail.famousForEn}
            </p>
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
              {lang === 'bn' ? detail.summaryBn : detail.summaryEn}
            </p>
          </div>

          <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5 text-sm">
            <div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'bn' ? 'বিখ্যাত পণ্য, খাবার ও কৃষি' : 'Specialties, Cuisine & Produce'}
              </div>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                {lang === 'bn' ? detail.specialtiesBn : detail.specialtiesEn}
              </p>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'bn' ? 'ইতিহাস, সংস্কৃতি ও অর্থনীতি' : 'History, Culture & Economy'}
              </div>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                {lang === 'bn' ? detail.historyEconomyBn : detail.historyEconomyEn}
              </p>
            </div>
            <div>
              <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {lang === 'bn' ? 'প্রধান যোগাযোগ ও পথ' : 'Connectivity & Gateways'}
              </div>
              <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                {lang === 'bn' ? detail.connectivityBn : detail.connectivityEn}
              </p>
            </div>
          </div>
        </div>

        {/* Bordering / Adjacent Districts */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {lang === 'bn'
                ? `সীমান্তবর্তী পার্শ্ববর্তী জেলা (${neighborDistricts.length}টি)`
                : `Bordering Districts (${neighborDistricts.length})`}
            </h3>
            <span className="text-xs text-amber-700 dark:text-amber-400 font-medium">
              {lang === 'bn' ? 'সোনালি রঙে চিহ্নিত' : 'Highlighted in amber'}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {neighborDistricts.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  onSelectRiver(null);
                  onSelectDistrict(n.id);
                }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 dark:hover:bg-amber-900/70 border border-amber-200 dark:border-amber-800 text-xs font-medium text-amber-950 dark:text-amber-200 transition-colors"
              >
                <span>{lang === 'bn' ? n.bnName : n.name}</span>
                <ChevronRight className="w-3 h-3 text-amber-700 dark:text-amber-400" />
              </button>
            ))}
          </div>

          {(lang === 'bn' ? detail.externalBordersBn : detail.externalBordersEn).length > 0 && (
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-3">
              <span className="font-medium text-slate-800 dark:text-slate-200">
                {lang === 'bn' ? 'আন্তর্জাতিক সীমান্ত / সাগর: ' : 'External Border / Coast: '}
              </span>
              {(lang === 'bn' ? detail.externalBordersBn : detail.externalBordersEn).join(' · ')}
            </p>
          )}
        </div>

        {/* Major Rivers Flowing Through Selected District */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {lang === 'bn'
                ? `প্রবাহিত গুরুত্বপূর্ণ নদ-নদী (${districtRivers.length}টি)`
                : `Major Rivers Flowing Through (${districtRivers.length})`}
            </h3>
            <span className="text-xs text-sky-700 dark:text-sky-400 font-medium">
              {lang === 'bn' ? 'ক্লিক করলে পূর্ণ গতিপথ দেখাবে' : 'Click to view full course'}
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            {districtRivers.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelectRiver(r.id)}
                className="w-full flex items-center justify-between px-3.5 py-2.5 text-left bg-white dark:bg-slate-900 hover:bg-sky-50/70 dark:hover:bg-sky-950/40 transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Waves className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                  <div>
                    <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                      {lang === 'bn' ? `${r.bnName} নদী` : `${r.name} River`}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {lang === 'bn'
                        ? `${r.districts.length}টি জেলার ওপর দিয়ে প্রবাহিত`
                        : `Flows across ${r.districts.length} districts`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono-tabular text-xs text-slate-600 dark:text-slate-300">
                    ~{r.lengthKm} {lang === 'bn' ? 'কিমি' : 'km'}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Notable Landmarks (5-7 places) */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2.5">
            {lang === 'bn' ? 'উল্লেখযোগ্য দর্শনীয় স্থান ও ঐতিহ্য' : 'Notable Landmarks & Heritage'}
          </h3>
          <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
            {(lang === 'bn' ? detail.landmarksBn : detail.landmarksEn).map((lm) => (
              <li key={lm} className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 mt-1 shrink-0" />
                <span>{lm}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    );
  }

  // View 3: Filtered Division or Direction Explorer
  const filteredDistricts = districts.filter((d) => {
    if (selectedDivisionId && d.divisionId !== selectedDivisionId) return false;
    if (activeDirection !== 'all') {
      const det = DISTRICT_DETAILS[d.id];
      if (!det || !det.directions.includes(activeDirection)) return false;
    }
    return true;
  });

  const activeDivMeta = selectedDivisionId ? DIVISION_META[selectedDivisionId] : null;
  const dirInfo = DIRECTION_INFO[activeDirection];

  return (
    <aside className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 flex flex-col gap-5 transition-colors">
      <div>
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white tracking-tight">
            {activeDivMeta
              ? lang === 'bn'
                ? `${activeDivMeta.bnName} বিভাগ (${filteredDistricts.length} জেলা)`
                : `${activeDivMeta.name} Division (${filteredDistricts.length})`
              : lang === 'bn'
              ? `${dirInfo.labelBn} (${filteredDistricts.length}টি জেলা)`
              : `${dirInfo.labelEn} (${filteredDistricts.length} districts)`}
          </h2>
          <button
            type="button"
            onClick={() => {
              onSelectDivision(null);
              onSelectDirection('all');
            }}
            className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
          >
            {lang === 'bn' ? 'রিসেট' : 'Reset'}
          </button>
        </div>

        <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
          {activeDivMeta
            ? lang === 'bn'
              ? activeDivMeta.summaryBn
              : activeDivMeta.summaryEn
            : lang === 'bn'
            ? dirInfo.descBn
            : dirInfo.descEn}
        </p>
      </div>

      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300 mb-3">
          <Compass className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
          <span>{lang === 'bn' ? 'যেকোনো জেলায় ক্লিক করুন:' : 'Select a district:'}</span>
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-72 overflow-y-auto pr-1">
          {filteredDistricts.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => onSelectDistrict(d.id)}
              className="px-2.5 py-1.5 rounded-md bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-slate-200 dark:border-slate-700 hover:border-emerald-300 dark:hover:border-emerald-700 text-xs font-medium text-slate-800 dark:text-slate-200 transition-colors"
            >
              {lang === 'bn' ? d.bnName : d.name}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
};
