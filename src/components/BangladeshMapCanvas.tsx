import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Waves, Tag, Maximize2, Minimize2, X } from 'lucide-react';
import {
  DISTRICT_DETAILS,
  DIVISION_META,
  type DirectionZone,
} from '../data/bdDistrictDetails';
import { RIVER_DETAILS } from '../data/bdRiverDetails';
import type { GeoDistrict, GeoDivision, GeoRiver, Lang, Theme } from '../types/map';

interface BangladeshMapCanvasProps {
  districts: GeoDistrict[];
  divisions: GeoDivision[];
  rivers: GeoRiver[];
  selectedDistrictId: string | null;
  selectedDivisionId: string | null;
  activeDirection: DirectionZone;
  activeRiverId: string | null;
  showAllRivers: boolean;
  showAllLabels: boolean;
  lang: Lang;
  theme: Theme;
  onSelectDistrict: (id: string) => void;
  onToggleAllRivers: () => void;
  onToggleAllLabels: () => void;
  onResetView: () => void;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 5;

export const BangladeshMapCanvas: React.FC<BangladeshMapCanvasProps> = ({
  districts,
  divisions,
  rivers,
  selectedDistrictId,
  selectedDivisionId,
  activeDirection,
  activeRiverId,
  showAllRivers,
  showAllLabels,
  lang,
  theme,
  onSelectDistrict,
  onToggleAllRivers,
  onToggleAllLabels,
  onResetView,
}) => {
  const isDark = theme === 'dark';
  const outerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredDistrictId, setHoveredDistrictId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isInteracting, setIsInteracting] = useState<boolean>(false);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState<boolean>(false);
  const [isFallbackFullscreen, setIsFallbackFullscreen] = useState<boolean>(false);
  const isFullscreen = isNativeFullscreen || isFallbackFullscreen;

  // Refs for smooth, synchronous wheel & multi-touch gesture math
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  const dragStartRef = useRef<{
    x: number;
    y: number;
    panX: number;
    panY: number;
    moved: boolean;
  } | null>(null);

  const touchStateRef = useRef<{
    mode: 'none' | 'pan' | 'pinch';
    startX: number;
    startY: number;
    startPanX: number;
    startPanY: number;
    startDist: number;
    startZoom: number;
    moved: boolean;
  }>({
    mode: 'none',
    startX: 0,
    startY: 0,
    startPanX: 0,
    startPanY: 0,
    startDist: 0,
    startZoom: 1,
    moved: false,
  });

  const lastTapRef = useRef<number>(0);

  const clampPan = useCallback((nextPanX: number, nextPanY: number, nextZoom: number) => {
    if (nextZoom <= 1) return { x: 0, y: 0 };
    const el = containerRef.current;
    const w = el?.clientWidth || 700;
    const h = el?.clientHeight || 600;
    const maxOffsetX = w * (nextZoom - 1) * 0.55 + 60;
    const maxOffsetY = h * (nextZoom - 1) * 0.55 + 60;
    return {
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, nextPanX)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, nextPanY)),
    };
  }, []);

  const zoomAtPoint = useCallback(
    (targetZoom: number, clientX: number, clientY: number) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const oldZoom = zoomRef.current;
      const clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(targetZoom.toFixed(3))));
      if (clampedZoom <= 1.01) {
        setZoom(1);
        setPan({ x: 0, y: 0 });
        return;
      }

      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const dx = clientX - rect.left - cx;
      const dy = clientY - rect.top - cy;

      const ratio = clampedZoom / oldZoom;
      const rawPanX = dx - (dx - panRef.current.x) * ratio;
      const rawPanY = dy - (dy - panRef.current.y) * ratio;
      const clamped = clampPan(rawPanX, rawPanY, clampedZoom);

      setZoom(clampedZoom);
      setPan(clamped);
    },
    [clampPan]
  );

  const [showZoomHint, setShowZoomHint] = useState<boolean>(false);
  const zoomHintTimerRef = useRef<number | null>(null);

  // Sync native fullscreen & Escape key for fallback fullscreen
  useEffect(() => {
    const handleFsChange = () => {
      setIsNativeFullscreen(Boolean(document.fullscreenElement));
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFallbackFullscreen) {
        setIsFallbackFullscreen(false);
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFallbackFullscreen]);

  const toggleFullscreen = useCallback(async () => {
    if (isFullscreen) {
      if (document.fullscreenElement) {
        try {
          await document.exitFullscreen();
        } catch {
          // ignore
        }
      }
      setIsNativeFullscreen(false);
      setIsFallbackFullscreen(false);
      return;
    }

    const el = outerRef.current;
    if (el && el.requestFullscreen) {
      try {
        await el.requestFullscreen();
        setIsNativeFullscreen(true);
        return;
      } catch {
        // Iframe or browser policy blocked native fullscreen; use viewport fallback
      }
    }
    setIsFallbackFullscreen(true);
  }, [isFullscreen]);

  // Non-passive mouse wheel listener: Ctrl+Scroll (or trackpad pinch) zooms quickly; plain scroll scrolls the page normally
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setShowZoomHint(false);
        setIsInteracting(true);
        let dy = e.deltaY;
        if (e.deltaMode === 1) dy *= 16;
        else if (e.deltaMode === 2) dy *= 240;
        const clampedDy = Math.max(-75, Math.min(75, dy));
        const factor = Math.exp(-clampedDy * 0.0042);
        zoomAtPoint(zoomRef.current * factor, e.clientX, e.clientY);
        window.clearTimeout((onWheel as unknown as { _t?: number })._t);
        (onWheel as unknown as { _t?: number })._t = window.setTimeout(() => {
          setIsInteracting(false);
        }, 120);
      } else {
        // Let normal vertical scrolling move the page up/down; show brief hint
        setShowZoomHint(true);
        if (zoomHintTimerRef.current) window.clearTimeout(zoomHintTimerRef.current);
        zoomHintTimerRef.current = window.setTimeout(() => {
          setShowZoomHint(false);
        }, 1800);
      }
    };

    const onTouchMoveNative = (e: TouchEvent) => {
      if (e.touches.length === 2 || zoomRef.current > 1) {
        e.preventDefault();
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchmove', onTouchMoveNative, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchmove', onTouchMoveNative);
      if (zoomHintTimerRef.current) window.clearTimeout(zoomHintTimerRef.current);
    };
  }, [zoomAtPoint]);

  const selectedDistrict = useMemo(
    () => districts.find((d) => d.id === selectedDistrictId) || null,
    [districts, selectedDistrictId]
  );

  const neighborSet = useMemo(() => {
    if (!selectedDistrict) return new Set<string>();
    return new Set(selectedDistrict.neighbors);
  }, [selectedDistrict]);

  const activeRivers = useMemo(() => {
    if (activeRiverId) {
      return rivers.filter((r) => r.id === activeRiverId);
    }
    if (selectedDistrictId) {
      return rivers.filter((r) => r.districts.includes(selectedDistrictId));
    }
    return [];
  }, [rivers, selectedDistrictId, activeRiverId]);

  const activeRiverDistrictSet = useMemo(() => {
    if (!activeRiverId) return new Set<string>();
    const river = rivers.find((r) => r.id === activeRiverId);
    return new Set(river ? river.districts : []);
  }, [rivers, activeRiverId]);

  const activeRiverIds = useMemo(() => new Set(activeRivers.map((r) => r.id)), [activeRivers]);

  const hoveredDistrict = useMemo(
    () => districts.find((d) => d.id === hoveredDistrictId) || null,
    [districts, hoveredDistrictId]
  );

  const doesMatchFilter = (d: GeoDistrict) => {
    if (selectedDivisionId && d.divisionId !== selectedDivisionId) return false;
    if (activeDirection !== 'all') {
      const detail = DISTRICT_DETAILS[d.id];
      if (!detail || !detail.directions.includes(activeDirection)) return false;
    }
    return true;
  };

  const hasFilterActive = selectedDivisionId !== null || activeDirection !== 'all';

  // Mouse handlers (PC drag pan + hover tooltip)
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
        dragStartRef.current.moved = true;
      }
      setPan(
        clampPan(
          dragStartRef.current.panX + dx,
          dragStartRef.current.panY + dy,
          zoomRef.current
        )
      );
    }
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.button !== 0 || zoomRef.current <= 1) return;
    setIsInteracting(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      panX: panRef.current.x,
      panY: panRef.current.y,
      moved: false,
    };
  };

  const handleMouseUp = () => {
    setIsInteracting(false);
    // Keep moved flag slightly until click fires, then clear
    window.setTimeout(() => {
      dragStartRef.current = null;
    }, 0);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const nextZoom = zoomRef.current >= 3.5 ? 1 : Math.min(MAX_ZOOM, zoomRef.current * 2);
    zoomAtPoint(nextZoom, e.clientX, e.clientY);
  };

  // Touch handlers (Mobile 2-finger pinch zoom + 1-finger pan + double-tap zoom)
  const getTouchDistAndMid = (t1: React.Touch, t2: React.Touch) => {
    const dx = t2.clientX - t1.clientX;
    const dy = t2.clientY - t1.clientY;
    return {
      dist: Math.hypot(dx, dy),
      midX: (t1.clientX + t2.clientX) / 2,
      midY: (t1.clientY + t2.clientY) / 2,
    };
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setHoveredDistrictId(null);
    setTooltipPos(null);

    if (e.touches.length === 2) {
      setIsInteracting(true);
      const { dist, midX, midY } = getTouchDistAndMid(e.touches[0], e.touches[1]);
      touchStateRef.current = {
        mode: 'pinch',
        startX: midX,
        startY: midY,
        startPanX: panRef.current.x,
        startPanY: panRef.current.y,
        startDist: Math.max(1, dist),
        startZoom: zoomRef.current,
        moved: true,
      };
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      const now = Date.now();
      if (now - lastTapRef.current < 280) {
        // Double-tap zoom on mobile
        const nextZoom = zoomRef.current >= 3 ? 1 : Math.min(MAX_ZOOM, zoomRef.current * 1.8);
        zoomAtPoint(nextZoom, t.clientX, t.clientY);
        lastTapRef.current = 0;
        touchStateRef.current.mode = 'none';
        return;
      }
      lastTapRef.current = now;

      if (zoomRef.current > 1) {
        setIsInteracting(true);
        touchStateRef.current = {
          mode: 'pan',
          startX: t.clientX,
          startY: t.clientY,
          startPanX: panRef.current.x,
          startPanY: panRef.current.y,
          startDist: 0,
          startZoom: zoomRef.current,
          moved: false,
        };
      } else {
        touchStateRef.current = {
          ...touchStateRef.current,
          mode: 'none',
          moved: false,
        };
      }
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const ts = touchStateRef.current;
    if (e.touches.length === 2 && ts.mode === 'pinch') {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const { dist, midX, midY } = getTouchDistAndMid(e.touches[0], e.touches[1]);
      const nextZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, Number((ts.startZoom * (dist / ts.startDist)).toFixed(3)))
      );

      if (nextZoom <= 1.01) {
        setZoom(1);
        setPan({ x: 0, y: 0 });
        return;
      }

      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const startDx = ts.startX - rect.left - cx;
      const startDy = ts.startY - rect.top - cy;
      const currDx = midX - rect.left - cx;
      const currDy = midY - rect.top - cy;

      const ratio = nextZoom / ts.startZoom;
      const rawPanX = currDx - (startDx - ts.startPanX) * ratio;
      const rawPanY = currDy - (startDy - ts.startPanY) * ratio;

      setZoom(nextZoom);
      setPan(clampPan(rawPanX, rawPanY, nextZoom));
    } else if (e.touches.length === 1 && ts.mode === 'pan') {
      const t = e.touches[0];
      const dx = t.clientX - ts.startX;
      const dy = t.clientY - ts.startY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        ts.moved = true;
      }
      setPan(clampPan(ts.startPanX + dx, ts.startPanY + dy, zoomRef.current));
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1 && touchStateRef.current.mode === 'pinch') {
      // Seamless transition from 2-finger pinch to 1-finger pan if still zoomed
      const t = e.touches[0];
      if (zoomRef.current > 1) {
        touchStateRef.current = {
          mode: 'pan',
          startX: t.clientX,
          startY: t.clientY,
          startPanX: panRef.current.x,
          startPanY: panRef.current.y,
          startDist: 0,
          startZoom: zoomRef.current,
          moved: true,
        };
        return;
      }
    }
    if (e.touches.length === 0) {
      setIsInteracting(false);
      window.setTimeout(() => {
        touchStateRef.current.mode = 'none';
        touchStateRef.current.moved = false;
      }, 0);
    }
  };

  const handleZoomIn = () => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    zoomAtPoint(zoomRef.current * 1.4, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  const handleZoomOut = () => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    zoomAtPoint(zoomRef.current / 1.4, rect.left + rect.width / 2, rect.top + rect.height / 2);
  };

  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
    onResetView();
  };

  const getRiverLabelPoint = (pathStr: string): [number, number] | null => {
    const matches = [...pathStr.matchAll(/(\d+(?:\.\d+)?),(\d+(?:\.\d+)?)/g)];
    if (matches.length === 0) return null;
    const mid = matches[Math.floor(matches.length / 2)];
    return [parseFloat(mid[1]), parseFloat(mid[2])];
  };

  const getRiverEndpoints = (
    pathStr: string
  ): { start: [number, number]; end: [number, number] } | null => {
    const matches = [...pathStr.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)];
    if (matches.length < 2) return null;
    const first = matches[0];
    const last = matches[matches.length - 1];
    return {
      start: [parseFloat(first[1]), parseFloat(first[2])],
      end: [parseFloat(last[1]), parseFloat(last[2])],
    };
  };

  const labelHaloColor = isDark ? '#0B1220' : '#FFFFFF';
  const focusedRiver = activeRiverId ? rivers.find((r) => r.id === activeRiverId) || null : null;
  const focusedRiverDetail = focusedRiver ? RIVER_DETAILS[focusedRiver.id] || null : null;

  return (
    <div
      ref={outerRef}
      className={`flex flex-col bg-white dark:bg-slate-900 transition-colors overflow-hidden ${
        isFallbackFullscreen
          ? 'fixed inset-0 z-50 rounded-none border-0'
          : isNativeFullscreen
          ? 'w-full h-full rounded-none border-0'
          : 'border border-slate-200 dark:border-slate-800 rounded-xl'
      }`}
    >
      {/* Map Stage Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 sm:px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 shrink-0">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onToggleAllRivers}
            className={`inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-600 ${
              showAllRivers
                ? 'bg-sky-600 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Waves className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'সব নদ-নদী (৩০)' : 'All Major Rivers (30)'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleAllLabels}
            className={`inline-flex items-center gap-1.5 px-3 py-2 sm:py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
              showAllLabels
                ? 'bg-slate-800 dark:bg-emerald-700 text-white'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'জেলার নাম' : 'District Names'}</span>
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            aria-label={lang === 'bn' ? 'জুম কমান' : 'Zoom out'}
            className="min-w-[40px] min-h-[40px] sm:min-w-[34px] sm:min-h-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="font-mono-tabular text-xs text-slate-600 dark:text-slate-300 w-11 text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            aria-label={lang === 'bn' ? 'জুম বাড়ান' : 'Zoom in'}
            className="min-w-[40px] min-h-[40px] sm:min-w-[34px] sm:min-h-[34px] flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 ml-0.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'রিসেট' : 'Reset'}</span>
          </button>
          <button
            type="button"
            onClick={toggleFullscreen}
            aria-label={
              isFullscreen
                ? lang === 'bn'
                  ? 'ফুলস্ক্রিন বন্ধ করুন'
                  : 'Exit fullscreen'
                : lang === 'bn'
                ? 'ফুলস্ক্রিনে দেখুন'
                : 'Fullscreen map'
            }
            className={`inline-flex items-center gap-1 min-h-[40px] sm:min-h-[34px] px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              isFullscreen
                ? 'bg-emerald-700 dark:bg-emerald-600 text-white border-emerald-700 dark:border-emerald-600'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{lang === 'bn' ? 'স্বাভাবিক' : 'Exit'}</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{lang === 'bn' ? 'ফুলস্ক্রিন' : 'Fullscreen'}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Interactive Cartographic Canvas */}
      <div
        ref={containerRef}
        onMouseMove={handleMouseMove}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        onMouseLeave={() => {
          setHoveredDistrictId(null);
          setTooltipPos(null);
          dragStartRef.current = null;
          setIsInteracting(false);
        }}
        className={`relative w-full bg-[#F4F8FA] dark:bg-[#0B1220] overflow-hidden select-none transition-colors ${
          isFullscreen ? 'flex-1 min-h-0' : ''
        } ${zoom > 1 ? 'touch-none' : 'touch-pan-y'} ${
          zoom > 1 ? (dragStartRef.current ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
        style={isFullscreen ? undefined : { height: 'clamp(460px, 68vh, 720px)' }}
      >
        {/* Subtle Cartographic Graticule Backdrop */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            opacity: isDark ? 0.25 : 0.45,
            backgroundImage: isDark
              ? 'linear-gradient(to right, rgba(71,85,105,0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(71,85,105,0.28) 1px, transparent 1px)'
              : 'linear-gradient(to right, rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.18) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Compass Rose (Top-Right) */}
        <div
          className="absolute top-3 right-3 z-10 pointer-events-none bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 shadow-xs"
          aria-hidden="true"
        >
          <div className="relative w-12 h-12 flex items-center justify-center">
            <span className="absolute top-0 left-1/2 -translate-x-1/2 text-[9px] font-bold text-emerald-700 dark:text-emerald-400 leading-none">
              {lang === 'bn' ? 'উ' : 'N'}
            </span>
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-slate-500 dark:text-slate-400 leading-none">
              {lang === 'bn' ? 'দ' : 'S'}
            </span>
            <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-slate-500 dark:text-slate-400 leading-none">
              {lang === 'bn' ? 'প' : 'W'}
            </span>
            <span className="absolute right-0 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-slate-500 dark:text-slate-400 leading-none">
              {lang === 'bn' ? 'পূ' : 'E'}
            </span>
            <svg viewBox="0 0 36 36" className="w-6 h-6">
              <circle
                cx="18"
                cy="18"
                r="13"
                fill="none"
                stroke={isDark ? '#475569' : '#CBD5E1'}
                strokeWidth="1"
              />
              <polygon points="18,4 21,18 18,16 15,18" fill={isDark ? '#10B981' : '#047857'} />
              <polygon points="18,32 21,18 18,20 15,18" fill={isDark ? '#64748B' : '#94A3B8'} />
              <circle cx="18" cy="18" r="1.5" fill={isDark ? '#F8FAFC' : '#0F172A'} />
            </svg>
          </div>
        </div>

        {/* Floating Mobile-Friendly Corner Zoom Controls on Bottom-Right */}
        <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1.5 sm:hidden">
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            aria-label={lang === 'bn' ? 'জুম বাড়ান' : 'Zoom in'}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 shadow-md disabled:opacity-40"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            aria-label={lang === 'bn' ? 'জুম কমান' : 'Zoom out'}
            className="w-11 h-11 flex items-center justify-center rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 shadow-md disabled:opacity-40"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
        </div>

        {/* SVG Map */}
        <svg
          viewBox="0 0 800 1000"
          preserveAspectRatio="xMidYMid meet"
          className={`w-full h-full ${
            isInteracting ? '' : 'transition-transform duration-150 ease-out'
          }`}
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
          }}
          role="img"
          aria-label={
            lang === 'bn'
              ? 'বাংলাদেশের ৬৪টি জেলার ইন্টারেক্টিভ মানচিত্র'
              : 'Interactive map of 64 districts of Bangladesh'
          }
        >
          {/* Geographic Orientation Context Labels */}
          <g className="pointer-events-none select-none" fontSize="13" fontWeight="600">
            <text
              x="290"
              y="26"
              textAnchor="middle"
              fill={isDark ? '#94A3B8' : '#64748B'}
              letterSpacing="0.04em"
            >
              {lang === 'bn'
                ? '↑ উত্তর · ভারত (পশ্চিমবঙ্গ ও মেঘালয়)'
                : '↑ NORTH · INDIA (ASSAM & MEGHALAYA)'}
            </text>
            <text
              x="22"
              y="470"
              textAnchor="middle"
              fill={isDark ? '#94A3B8' : '#64748B'}
              transform="rotate(-90 22 470)"
              letterSpacing="0.04em"
            >
              {lang === 'bn' ? '← পশ্চিম · ভারত (পশ্চিমবঙ্গ)' : '← WEST · INDIA (WEST BENGAL)'}
            </text>
            <text
              x="778"
              y="440"
              textAnchor="middle"
              fill={isDark ? '#94A3B8' : '#64748B'}
              transform="rotate(90 778 440)"
              letterSpacing="0.04em"
            >
              {lang === 'bn'
                ? 'পূর্ব · ভারত (ত্রিপুরা ও মিজোরাম) →'
                : 'EAST · INDIA (TRIPURA & MIZORAM) →'}
            </text>
            <text x="706" y="845" textAnchor="middle" fill={isDark ? '#94A3B8' : '#64748B'} fontSize="12">
              {lang === 'bn' ? 'মিয়ানমার →' : 'MYANMAR →'}
            </text>
            <text
              x="360"
              y="972"
              textAnchor="middle"
              fill={isDark ? '#38BDF8' : '#0369A1'}
              fontSize="15"
              fontWeight="600"
              letterSpacing="0.06em"
            >
              {lang === 'bn' ? '↓ দক্ষিণ · বঙ্গোপসাগর (Bay of Bengal)' : '↓ SOUTH · BAY OF BENGAL'}
            </text>
          </g>

          {/* 64 District Polygons */}
          <g>
            {districts.map((d) => {
              const divMeta = DIVISION_META[d.divisionId];
              const isSelected = d.id === selectedDistrictId;
              const isNeighbor = neighborSet.has(d.id);
              const isHovered = d.id === hoveredDistrictId;
              const isRiverDistrict = activeRiverDistrictSet.has(d.id);
              const matchesFilter = doesMatchFilter(d);

              let fill = isDark ? divMeta?.darkFill || '#1E293B' : divMeta?.fill || '#EDF2F7';
              let stroke = isDark ? '#475569' : '#64748B';
              let strokeWidth = 0.85;
              let opacity = 1;

              if (activeRiverId) {
                if (isRiverDistrict) {
                  fill = isDark ? '#0C4A6E' : '#DBEAFE';
                  stroke = isDark ? '#38BDF8' : '#0284C7';
                  strokeWidth = 1.5;
                } else {
                  fill = isDark ? '#141D2E' : '#F1F5F9';
                  stroke = isDark ? '#334155' : '#CBD5E1';
                  opacity = 0.52;
                }
              } else if (selectedDistrictId) {
                if (isSelected) {
                  fill = isDark ? '#059669' : '#047857';
                  stroke = isDark ? '#6EE7B7' : '#064E3B';
                  strokeWidth = 2.4;
                } else if (isNeighbor) {
                  fill = isDark ? '#78350F' : '#FDE68A';
                  stroke = isDark ? '#F59E0B' : '#B45309';
                  strokeWidth = 1.75;
                } else {
                  fill = isDark ? '#141D2E' : '#F1F5F9';
                  stroke = isDark ? '#334155' : '#CBD5E1';
                  strokeWidth = 0.65;
                  opacity = 0.72;
                }
              } else if (hasFilterActive) {
                if (matchesFilter) {
                  fill = isHovered
                    ? isDark
                      ? divMeta?.darkHoverFill || '#334155'
                      : divMeta?.hoverFill || '#CBD5E1'
                    : isDark
                    ? divMeta?.darkFill || '#1E293B'
                    : divMeta?.fill || '#E2E8F0';
                  stroke = isDark ? '#94A3B8' : '#334155';
                  strokeWidth = 1.1;
                } else {
                  fill = isDark ? '#111827' : '#F1F5F9';
                  stroke = isDark ? '#1E293B' : '#CBD5E1';
                  opacity = 0.34;
                }
              } else if (isHovered) {
                fill = isDark
                  ? divMeta?.darkHoverFill || '#334155'
                  : divMeta?.hoverFill || '#CBD5E1';
                stroke = isDark ? '#F8FAFC' : '#0F172A';
                strokeWidth = 1.35;
              }

              if (isHovered && !isSelected && (selectedDistrictId || activeRiverId)) {
                stroke = isDark ? '#F8FAFC' : '#0F172A';
                strokeWidth = 1.7;
              }

              return (
                <path
                  key={d.id}
                  d={d.path}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth={strokeWidth / Math.sqrt(zoom)}
                  strokeLinejoin="round"
                  opacity={opacity}
                  className="cursor-pointer transition-[fill,opacity] duration-150 focus:outline-none"
                  tabIndex={0}
                  role="button"
                  aria-label={`${d.bnName} (${d.name})`}
                  onMouseEnter={() => setHoveredDistrictId(d.id)}
                  onClick={() => {
                    if (dragStartRef.current?.moved || touchStateRef.current.moved) {
                      return;
                    }
                    onSelectDistrict(d.id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onSelectDistrict(d.id);
                    }
                  }}
                />
              );
            })}
          </g>

          {/* Crisp Division Borders Overlay */}
          <g className="pointer-events-none">
            {divisions.map((div) => {
              const isSelectedDiv = selectedDivisionId === div.id;
              return (
                <path
                  key={div.id}
                  d={div.path}
                  fill="none"
                  stroke={
                    isSelectedDiv
                      ? isDark
                        ? '#F8FAFC'
                        : '#0F172A'
                      : isDark
                      ? '#64748B'
                      : '#475569'
                  }
                  strokeWidth={(isSelectedDiv ? 2 : 1.15) / Math.sqrt(zoom)}
                  strokeOpacity={selectedDistrictId ? 0.25 : isSelectedDiv ? 0.9 : 0.5}
                  strokeLinejoin="round"
                />
              );
            })}
          </g>

          {/* Subtle Background All-Rivers Layer (when enabled) */}
          {showAllRivers && (
            <g className="pointer-events-none">
              {rivers.map((r) => {
                if (activeRiverIds.has(r.id)) return null;
                return (
                  <path
                    key={`bg-${r.id}`}
                    d={r.path}
                    fill="none"
                    stroke={isDark ? '#38BDF8' : '#0EA5E9'}
                    strokeWidth={1.7 / Math.sqrt(zoom)}
                    strokeLinecap="round"
                    strokeOpacity={isDark ? 0.6 : 0.55}
                  />
                );
              })}
            </g>
          )}

          {/* Active Highlighted Rivers Layer + Origin/Mouth Markers */}
          {activeRivers.length > 0 && (
            <g className="pointer-events-none">
              {activeRivers.map((r) => {
                const endpoints = activeRiverId === r.id ? getRiverEndpoints(r.path) : null;
                const invZoom = Math.sqrt(zoom);
                return (
                  <g key={`active-river-${r.id}`}>
                    <path
                      d={r.path}
                      fill="none"
                      stroke={labelHaloColor}
                      strokeWidth={(activeRiverId ? 6.2 : 5.2) / invZoom}
                      strokeLinecap="round"
                      strokeOpacity={0.9}
                    />
                    <path
                      d={r.path}
                      fill="none"
                      stroke={isDark ? '#38BDF8' : '#0284C7'}
                      strokeWidth={(activeRiverId ? 3.8 : 3) / invZoom}
                      strokeLinecap="round"
                    />
                    <path
                      d={r.path}
                      fill="none"
                      stroke="#E0F2FE"
                      strokeWidth={(activeRiverId ? 1.8 : 1.4) / invZoom}
                      strokeLinecap="round"
                      className="river-flow-animate"
                    />

                    {endpoints && (
                      <>
                        {/* Origin / Entry Marker */}
                        <circle
                          cx={endpoints.start[0]}
                          cy={endpoints.start[1]}
                          r={6.5 / invZoom}
                          fill="#10B981"
                          stroke={labelHaloColor}
                          strokeWidth={2 / invZoom}
                        />
                        <text
                          x={endpoints.start[0]}
                          y={endpoints.start[1] - 11 / invZoom}
                          textAnchor="middle"
                          fontSize={10.5 / Math.pow(zoom, 0.55)}
                          fontWeight="700"
                          fill={isDark ? '#6EE7B7' : '#047857'}
                          stroke={labelHaloColor}
                          strokeWidth={3 / Math.pow(zoom, 0.55)}
                          style={{ paintOrder: 'stroke' }}
                        >
                          {lang === 'bn' ? 'উৎপত্তি/প্রবেশ' : 'Origin / Entry'}
                        </text>

                        {/* Mouth / End Marker */}
                        <polygon
                          points={`${endpoints.end[0]},${endpoints.end[1] - 7.5 / invZoom} ${
                            endpoints.end[0] + 7.5 / invZoom
                          },${endpoints.end[1]} ${endpoints.end[0]},${
                            endpoints.end[1] + 7.5 / invZoom
                          } ${endpoints.end[0] - 7.5 / invZoom},${endpoints.end[1]}`}
                          fill={isDark ? '#60A5FA' : '#1D4ED8'}
                          stroke={labelHaloColor}
                          strokeWidth={2 / invZoom}
                        />
                        <text
                          x={endpoints.end[0]}
                          y={endpoints.end[1] + 18 / invZoom}
                          textAnchor="middle"
                          fontSize={10.5 / Math.pow(zoom, 0.55)}
                          fontWeight="700"
                          fill={isDark ? '#93C5FD' : '#1E40AF'}
                          stroke={labelHaloColor}
                          strokeWidth={3 / Math.pow(zoom, 0.55)}
                          style={{ paintOrder: 'stroke' }}
                        >
                          {lang === 'bn' ? 'মোহনা' : 'Mouth'}
                        </text>
                      </>
                    )}
                  </g>
                );
              })}
            </g>
          )}

          {/* District Labels */}
          <g className="pointer-events-none select-none">
            {districts.map((d) => {
              const isSelected = !activeRiverId && d.id === selectedDistrictId;
              const isNeighbor = !activeRiverId && neighborSet.has(d.id);
              const matchesFilter = doesMatchFilter(d);
              const isRiverMatch = activeRiverDistrictSet.has(d.id);

              const shouldShow =
                isSelected ||
                isNeighbor ||
                isRiverMatch ||
                (hasFilterActive && !selectedDistrictId && !activeRiverId && matchesFilter) ||
                (!selectedDistrictId && !activeRiverId && !hasFilterActive && (showAllLabels || zoom >= 1.5));

              if (!shouldShow) return null;

              const labelText = lang === 'bn' ? d.bnName : d.name;
              const baseFontSize = isSelected ? 13 : isNeighbor ? 11 : 9.8;
              const fontSize = baseFontSize / Math.pow(zoom, 0.55);
              const fillColor = isSelected
                ? '#FFFFFF'
                : isNeighbor
                ? isDark
                  ? '#FDE68A'
                  : '#78350F'
                : isDark
                ? '#E2E8F0'
                : '#1E293B';
              const strokeColor = isSelected
                ? '#064E3B'
                : isNeighbor && isDark
                ? '#451A03'
                : labelHaloColor;

              return (
                <text
                  key={`lbl-${d.id}`}
                  x={d.cx}
                  y={d.cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={fontSize}
                  fontWeight={isSelected ? '700' : isNeighbor ? '600' : '500'}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={(isSelected ? 3.2 : 2.8) / Math.pow(zoom, 0.55)}
                  style={{ paintOrder: 'stroke' }}
                >
                  {labelText}
                </text>
              );
            })}
          </g>

          {/* Division Centroid Labels (overview mode) */}
          {!selectedDistrictId && !showAllLabels && !hasFilterActive && !activeRiverId && zoom < 1.5 && (
            <g className="pointer-events-none select-none">
              {divisions.map((div) => (
                <text
                  key={`div-lbl-${div.id}`}
                  x={div.cx}
                  y={div.cy}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={14 / Math.pow(zoom, 0.45)}
                  fontWeight="700"
                  fill={isDark ? '#F8FAFC' : '#0F172A'}
                  stroke={labelHaloColor}
                  strokeWidth={3.8 / Math.pow(zoom, 0.45)}
                  style={{ paintOrder: 'stroke' }}
                >
                  {lang === 'bn' ? `${div.bnName} বিভাগ` : div.name}
                </text>
              ))}
            </g>
          )}

          {/* Active River Name Labels */}
          {(activeRivers.length > 0 || showAllRivers) && (
            <g className="pointer-events-none select-none">
              {(activeRivers.length > 0 ? activeRivers : rivers.slice(0, 12)).map((r) => {
                const pt = getRiverLabelPoint(r.path);
                if (!pt) return null;
                const isActive = activeRiverIds.has(r.id);
                const rFont = (isActive ? 12 : 9.5) / Math.pow(zoom, 0.55);
                return (
                  <text
                    key={`rlbl-${r.id}`}
                    x={pt[0]}
                    y={pt[1] - 7 / Math.pow(zoom, 0.55)}
                    textAnchor="middle"
                    fontSize={rFont}
                    fontWeight={isActive ? '700' : '600'}
                    fill={isDark ? '#7DD3FC' : '#0369A1'}
                    stroke={labelHaloColor}
                    strokeWidth={3.2 / Math.pow(zoom, 0.55)}
                    style={{ paintOrder: 'stroke' }}
                  >
                    {lang === 'bn' ? `${r.bnName} নদী` : r.name}
                  </text>
                );
              })}
            </g>
          )}
        </svg>

        {/* Floating Hover Tooltip */}
        {hoveredDistrict && tooltipPos && !dragStartRef.current && (
          <div
            className="hidden sm:block absolute z-20 pointer-events-none bg-slate-900 dark:bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 shadow-lg max-w-[235px]"
            style={{
              left: Math.min(tooltipPos.x + 14, (containerRef.current?.clientWidth || 500) - 215),
              top: Math.max(tooltipPos.y - 54, 12),
            }}
          >
            <div className="text-sm font-semibold leading-tight">
              {lang === 'bn'
                ? `${hoveredDistrict.bnName} (${hoveredDistrict.name})`
                : `${hoveredDistrict.name} (${hoveredDistrict.bnName})`}
            </div>
            <div className="text-xs text-slate-300 mt-0.5">
              {lang === 'bn'
                ? `${DIVISION_META[hoveredDistrict.divisionId]?.bnName} বিভাগ · ${
                    DISTRICT_DETAILS[hoveredDistrict.id]?.directionLabelBn
                  }`
                : `${DIVISION_META[hoveredDistrict.divisionId]?.name} Div. · ${
                    DISTRICT_DETAILS[hoveredDistrict.id]?.directionLabelEn
                  }`}
            </div>
            {selectedDistrictId && neighborSet.has(hoveredDistrict.id) && (
              <div className="text-[11px] font-medium text-amber-300 mt-1">
                {lang === 'bn' ? 'পার্শ্ববর্তী জেলা · ক্লিক করুন' : 'Bordering district · Click to open'}
              </div>
            )}
          </div>
        )}
        {/* Fullscreen Compact Floating Inspector Card */}
        {isFullscreen && (focusedRiver || selectedDistrict) && (
          <div className="absolute top-3 left-3 z-20 max-w-xs sm:max-w-sm bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-3 shadow-lg">
            <div className="flex items-start justify-between gap-2">
              {focusedRiver ? (
                <div>
                  <div className="text-[11px] font-semibold text-sky-700 dark:text-sky-400">
                    {lang === 'bn' ? 'নদীর সম্পূর্ণ গতিপথ' : 'Full River Course'}
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {lang === 'bn' ? `${focusedRiver.bnName} নদী` : `${focusedRiver.name} River`} · ~
                    {focusedRiver.lengthKm} {lang === 'bn' ? 'কিমি' : 'km'}
                  </div>
                  {focusedRiverDetail && (
                    <div className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 space-y-1">
                      <div>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {lang === 'bn' ? 'উৎপত্তি: ' : 'Origin: '}
                        </span>
                        {lang === 'bn' ? focusedRiverDetail.originBn : focusedRiverDetail.originEn}
                      </div>
                      <div>
                        <span className="font-semibold text-sky-700 dark:text-sky-400">
                          {lang === 'bn' ? 'মোহনা: ' : 'Mouth: '}
                        </span>
                        {lang === 'bn' ? focusedRiverDetail.mouthBn : focusedRiverDetail.mouthEn}
                      </div>
                    </div>
                  )}
                </div>
              ) : selectedDistrict ? (
                <div>
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {lang === 'bn'
                      ? `${DIVISION_META[selectedDistrict.divisionId]?.bnName} বিভাগ · ${
                          DISTRICT_DETAILS[selectedDistrict.id]?.directionLabelBn
                        }`
                      : `${DIVISION_META[selectedDistrict.divisionId]?.name} Div. · ${
                          DISTRICT_DETAILS[selectedDistrict.id]?.directionLabelEn
                        }`}
                  </div>
                  <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                    {lang === 'bn'
                      ? `${selectedDistrict.bnName} জেলা`
                      : `${selectedDistrict.name} District`}
                  </div>
                  <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                    {lang === 'bn'
                      ? `পার্শ্ববর্তী ${selectedDistrict.neighbors.length}টি জেলা (সোনালি) · প্রবাহিত ${activeRivers.length}টি নদী`
                      : `${selectedDistrict.neighbors.length} bordering districts (amber) · ${activeRivers.length} rivers`}
                  </div>
                </div>
              ) : null}
              <button
                type="button"
                onClick={handleReset}
                aria-label={lang === 'bn' ? 'নির্বাচন মুছুন' : 'Clear selection'}
                className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Non-blocking Ctrl+Scroll Hint Overlay */}
        {showZoomHint && (
          <div className="hidden sm:flex items-center justify-center absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none bg-slate-900/90 dark:bg-slate-800/95 text-white text-xs font-medium px-3.5 py-2 rounded-lg shadow-md border border-slate-700 whitespace-nowrap">
            {lang === 'bn'
              ? 'মানচিত্র জুম করতে Ctrl + স্ক্রল অথবা +/− বাটন ব্যবহার করুন'
              : 'Hold Ctrl + scroll (or use +/−) to zoom the map'}
          </div>
        )}
      </div>

      {/* Explicit Multi-Coded Map Legend Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-600 dark:text-slate-300 shrink-0">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3.5 h-3.5 rounded-xs bg-[#047857] dark:bg-[#059669] border border-[#064E3B] dark:border-[#6EE7B7]" />
            <span>{lang === 'bn' ? 'নির্বাচিত জেলা' : 'Selected District'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-3.5 h-3.5 rounded-xs bg-[#FDE68A] dark:bg-[#78350F] border border-[#B45309] dark:border-[#F59E0B]" />
            <span>{lang === 'bn' ? 'পার্শ্ববর্তী জেলা' : 'Bordering Neighbors'}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-5 h-1 rounded-full bg-[#0284C7] dark:bg-[#38BDF8]" />
            <span>{lang === 'bn' ? 'প্রবাহিত নদী' : 'Flowing Rivers'}</span>
          </div>
          {activeRiverId && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>{lang === 'bn' ? 'উৎপত্তি' : 'Origin'}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="inline-block w-2.5 h-2.5 rotate-45 bg-blue-700 dark:bg-blue-400" />
                <span>{lang === 'bn' ? 'মোহনা' : 'Mouth'}</span>
              </div>
            </div>
          )}
        </div>
        <span className="text-slate-500 dark:text-slate-400">
          {lang === 'bn'
            ? 'Ctrl + স্ক্রল / পিঞ্চ করে জুম · টেনে সরান'
            : 'Ctrl + scroll or pinch to zoom · Drag to pan'}
        </span>
      </div>
    </div>
  );
};
