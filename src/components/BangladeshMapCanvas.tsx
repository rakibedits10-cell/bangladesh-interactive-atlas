import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2, Minimize2, X } from 'lucide-react';
import {
  DIRECTION_INFO,
  DISTRICT_DETAILS,
  DIVISION_META,
  type DirectionZone,
} from '../data/bdDistrictDetails';
import { RIVER_DETAILS } from '../data/bdRiverDetails';
import { formatNum } from '../utils/format';
import type {
  GeoDistrict,
  GeoDivision,
  GeoRiver,
  GeoUpazila,
  Lang,
  Theme,
} from '../types/map';

interface BangladeshMapCanvasProps {
  districts: GeoDistrict[];
  upazilas: GeoUpazila[];
  divisions: GeoDivision[];
  rivers: GeoRiver[];
  selectedDistrictId: string | null;
  selectedUpazilaId: string | null;
  selectedDivisionId: string | null;
  appliedDirections: Exclude<DirectionZone, 'all'>[];
  activeRiverIds: string[];
  inspectedRiverId?: string | null;
  filterControls?: React.ReactNode;
  activeFilterTags?: React.ReactNode;
  conquestMode?: boolean;
  conqueredDivisionIds?: Set<string>;
  conqueredDistrictIds?: Set<string>;
  conqueredUpazilaIds?: Set<string>;
  requestedZoomPreset?: { layer: 'divisions' | 'districts' | 'upazilas'; nonce: number } | null;
  focusBBoxRequest?: { bbox: [number, number, number, number]; minZoom: number; nonce: number } | null;
  lang: Lang;
  theme: Theme;
  onSelectDivision: (id: string) => void;
  onSelectDistrict: (id: string) => void;
  onSelectUpazila: (id: string) => void;
  onResetView: () => void;
}

interface CameraState {
  zoom: number;
  vx: number;
  vy: number;
}

const BASE_W = 800;
const BASE_H = 1000;
const MIN_ZOOM = 1;
const MAX_ZOOM = 14;
const ZOOM_STEP = 1.5;
const DISTRICT_ZOOM_THRESHOLD = 1.35;
const UPAZILA_ZOOM_THRESHOLD = 2.6;

type BBox2D = [number, number, number, number];

const boxesOverlap = (a: BBox2D, b: BBox2D): boolean =>
  a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];

// Stitch exterior edges from child Upazila polygons (cancelling shared internal edges)
// so District/Division borders align 100% identically with Upazila borders at deep zoom.
function stitchBoundaryPaths(paths: string[]): string {
  const edgeCounts = new Map<string, number>();
  const edgeCoords = new Map<string, [string, string]>();

  for (const rawPath of paths) {
    const subpaths = rawPath.split('M');
    for (const rawSub of subpaths) {
      const cleaned = rawSub.replace(/[Zz]/g, '').trim();
      if (!cleaned) continue;
      const pts = cleaned
        .split('L')
        .map((s) => s.trim())
        .filter(Boolean);
      if (pts.length < 2) continue;

      const ringCount = pts[0] === pts[pts.length - 1] ? pts.length - 1 : pts.length;
      for (let i = 0; i < ringCount; i++) {
        const a = pts[i];
        const b = pts[(i + 1) % pts.length];
        if (!a || !b || a === b) continue;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;
        edgeCounts.set(key, (edgeCounts.get(key) || 0) + 1);
        if (!edgeCoords.has(key)) {
          edgeCoords.set(key, [a, b]);
        }
      }
    }
  }

  const boundaryEdges: [string, string][] = [];
  for (const [key, count] of edgeCounts.entries()) {
    if (count === 1) {
      const pair = edgeCoords.get(key);
      if (pair) boundaryEdges.push(pair);
    }
  }
  if (boundaryEdges.length === 0) return '';

  const adj = new Map<string, number[]>();
  for (let i = 0; i < boundaryEdges.length; i++) {
    const [a, b] = boundaryEdges[i];
    const listA = adj.get(a);
    if (listA) listA.push(i);
    else adj.set(a, [i]);
    const listB = adj.get(b);
    if (listB) listB.push(i);
    else adj.set(b, [i]);
  }

  const used = new Uint8Array(boundaryEdges.length);
  const svgParts: string[] = [];

  for (let i = 0; i < boundaryEdges.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const [a, b] = boundaryEdges[i];
    const chain: string[] = [a, b];

    // Extend forward from chain end
    let curr = b;
    while (true) {
      const neighbors = adj.get(curr);
      if (!neighbors) break;
      let nextIdx = -1;
      for (const idx of neighbors) {
        if (!used[idx]) {
          nextIdx = idx;
          break;
        }
      }
      if (nextIdx === -1) break;
      used[nextIdx] = 1;
      const [ea, eb] = boundaryEdges[nextIdx];
      curr = ea === curr ? eb : ea;
      chain.push(curr);
      if (curr === chain[0]) break;
    }

    // Extend backward from chain start if open
    if (chain[0] !== chain[chain.length - 1]) {
      const prefix: string[] = [];
      let head = chain[0];
      while (true) {
        const neighbors = adj.get(head);
        if (!neighbors) break;
        let prevIdx = -1;
        for (const idx of neighbors) {
          if (!used[idx]) {
            prevIdx = idx;
            break;
          }
        }
        if (prevIdx === -1) break;
        used[prevIdx] = 1;
        const [ea, eb] = boundaryEdges[prevIdx];
        head = ea === head ? eb : ea;
        prefix.push(head);
        if (head === chain[chain.length - 1]) break;
      }
      if (prefix.length > 0) {
        prefix.reverse();
        chain.unshift(...prefix);
      }
    }

    if (chain.length >= 2) {
      const isClosed = chain[0] === chain[chain.length - 1];
      const ptsSlice = isClosed ? chain.slice(0, -1) : chain;
      svgParts.push(`M${ptsSlice.join('L')}${isClosed ? 'Z' : ''}`);
    }
  }

  return svgParts.join(' ');
}

export const BangladeshMapCanvas: React.FC<BangladeshMapCanvasProps> = ({
  districts,
  upazilas,
  divisions,
  rivers,
  selectedDistrictId,
  selectedUpazilaId,
  selectedDivisionId,
  appliedDirections,
  activeRiverIds,
  inspectedRiverId = null,
  filterControls,
  activeFilterTags,
  conquestMode = false,
  conqueredDivisionIds,
  conqueredDistrictIds,
  conqueredUpazilaIds,
  requestedZoomPreset = null,
  focusBBoxRequest = null,
  lang,
  theme,
  onSelectDivision,
  onSelectDistrict,
  onSelectUpazila,
  onResetView,
}) => {
  const isDark = theme === 'dark';
  const outerRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [hoveredDivisionId, setHoveredDivisionId] = useState<string | null>(null);
  const [hoveredDistrictId, setHoveredDistrictId] = useState<string | null>(null);
  const [hoveredUpazilaId, setHoveredUpazilaId] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const [camera, setCamera] = useState<CameraState>({ zoom: 1, vx: 0, vy: 0 });
  const cameraRef = useRef<CameraState>(camera);
  cameraRef.current = camera;

  const animRafRef = useRef<number | null>(null);
  const [isNativeFullscreen, setIsNativeFullscreen] = useState<boolean>(false);
  const [isFallbackFullscreen, setIsFallbackFullscreen] = useState<boolean>(false);
  const isFullscreen = isNativeFullscreen || isFallbackFullscreen;

  const [isDragging, setIsDragging] = useState<boolean>(false);

  const dragStartRef = useRef<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    scale: number;
    moved: boolean;
  } | null>(null);

  const touchStateRef = useRef<{
    mode: 'none' | 'pan' | 'pinch';
    startX: number;
    startY: number;
    startVx: number;
    startVy: number;
    startDist: number;
    startZoom: number;
    startSvgMidX: number;
    startSvgMidY: number;
    scale: number;
    moved: boolean;
  }>({
    mode: 'none',
    startX: 0,
    startY: 0,
    startVx: 0,
    startVy: 0,
    startDist: 1,
    startZoom: 1,
    startSvgMidX: 400,
    startSvgMidY: 500,
    scale: 1,
    moved: false,
  });

  const lastTapRef = useRef<number>(0);
  const [showZoomHint, setShowZoomHint] = useState<boolean>(false);
  const zoomHintTimerRef = useRef<number | null>(null);

  const clampCamera = useCallback((z: number, vx: number, vy: number): CameraState => {
    const clampedZ = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(z.toFixed(3))));
    if (clampedZ <= 1.01) {
      return { zoom: 1, vx: 0, vy: 0 };
    }
    const vw = BASE_W / clampedZ;
    const vh = BASE_H / clampedZ;
    const marginX = vw * 0.2;
    const marginY = vh * 0.15;
    const minX = -marginX;
    const maxX = BASE_W - vw + marginX;
    const minY = -marginY;
    const maxY = BASE_H - vh + marginY;
    return {
      zoom: clampedZ,
      vx: Math.max(minX, Math.min(maxX, vx)),
      vy: Math.max(minY, Math.min(maxY, vy)),
    };
  }, []);

  const getProjection = useCallback((rect: DOMRect, cam: CameraState) => {
    const vw = BASE_W / cam.zoom;
    const vh = BASE_H / cam.zoom;
    const scale = Math.min(rect.width / vw, rect.height / vh);
    const offsetX = (rect.width - vw * scale) / 2;
    const offsetY = (rect.height - vh * scale) / 2;
    return { vw, vh, scale, offsetX, offsetY };
  }, []);

  const computeZoomAtPoint = useCallback(
    (targetZoom: number, clientX: number, clientY: number, baseCam: CameraState): CameraState => {
      const el = containerRef.current;
      if (!el) return clampCamera(targetZoom, 0, 0);
      const rect = el.getBoundingClientRect();
      const clampedZ = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(targetZoom.toFixed(3))));
      if (clampedZ <= 1.01) {
        return { zoom: 1, vx: 0, vy: 0 };
      }

      const oldProj = getProjection(rect, baseCam);
      const svgX = baseCam.vx + (clientX - rect.left - oldProj.offsetX) / oldProj.scale;
      const svgY = baseCam.vy + (clientY - rect.top - oldProj.offsetY) / oldProj.scale;

      const nextVw = BASE_W / clampedZ;
      const nextVh = BASE_H / clampedZ;
      const nextScale = Math.min(rect.width / nextVw, rect.height / nextVh);
      const nextOffsetX = (rect.width - nextVw * nextScale) / 2;
      const nextOffsetY = (rect.height - nextVh * nextScale) / 2;

      const nextVx = svgX - (clientX - rect.left - nextOffsetX) / nextScale;
      const nextVy = svgY - (clientY - rect.top - nextOffsetY) / nextScale;
      return clampCamera(clampedZ, nextVx, nextVy);
    },
    [clampCamera, getProjection]
  );

  const animateCameraTo = useCallback((target: CameraState) => {
    if (animRafRef.current) {
      cancelAnimationFrame(animRafRef.current);
      animRafRef.current = null;
    }
    const start = { ...cameraRef.current };
    const startTime = performance.now();
    const duration = 165;

    const tick = (now: number) => {
      const t = Math.min(1, (now - startTime) / duration);
      const ease = 1 - Math.pow(1 - t, 3);
      const next: CameraState = {
        zoom: start.zoom + (target.zoom - start.zoom) * ease,
        vx: start.vx + (target.vx - start.vx) * ease,
        vy: start.vy + (target.vy - start.vy) * ease,
      };
      cameraRef.current = next;
      setCamera(next);
      if (t < 1) {
        animRafRef.current = requestAnimationFrame(tick);
      } else {
        cameraRef.current = target;
        setCamera(target);
        animRafRef.current = null;
      }
    };

    animRafRef.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    return () => {
      if (animRafRef.current) cancelAnimationFrame(animRafRef.current);
    };
  }, []);

  useEffect(() => {
    if (!requestedZoomPreset) return;
    const { layer } = requestedZoomPreset;
    if (layer === 'divisions') {
      animateCameraTo({ zoom: 1, vx: 0, vy: 0 });
      return;
    }
    const targetZoom = layer === 'districts' ? 1.65 : 3.1;
    const el = containerRef.current;
    if (!el) {
      const vw = BASE_W / targetZoom;
      const vh = BASE_H / targetZoom;
      animateCameraTo(clampCamera(targetZoom, (BASE_W - vw) / 2, (BASE_H - vh) / 2));
      return;
    }
    const rect = el.getBoundingClientRect();
    const cur = cameraRef.current;
    animateCameraTo(
      computeZoomAtPoint(
        targetZoom,
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
        cur
      )
    );
  }, [requestedZoomPreset, animateCameraTo, clampCamera, computeZoomAtPoint]);

  useEffect(() => {
    if (!focusBBoxRequest) return;
    const { bbox, minZoom } = focusBBoxRequest;
    const bw = Math.max(12, bbox[2] - bbox[0]);
    const bh = Math.max(12, bbox[3] - bbox[1]);
    const fitZoom = Math.min((BASE_W * 0.45) / bw, (BASE_H * 0.45) / bh);
    const targetZoom = Math.max(minZoom, Math.min(8, Number(fitZoom.toFixed(2))));
    if (targetZoom <= 1.05) {
      animateCameraTo({ zoom: 1, vx: 0, vy: 0 });
      return;
    }
    const cx = (bbox[0] + bbox[2]) / 2;
    const cy = (bbox[1] + bbox[3]) / 2;
    const vw = BASE_W / targetZoom;
    const vh = BASE_H / targetZoom;
    animateCameraTo(clampCamera(targetZoom, cx - vw / 2, cy - vh / 2));
  }, [focusBBoxRequest, animateCameraTo, clampCamera]);

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
        // Fallback fullscreen inside iframe
      }
    }
    setIsFallbackFullscreen(true);
  }, [isFullscreen]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        if (animRafRef.current) {
          cancelAnimationFrame(animRafRef.current);
          animRafRef.current = null;
        }
        setShowZoomHint(false);
        let dy = e.deltaY;
        if (e.deltaMode === 1) dy *= 16;
        else if (e.deltaMode === 2) dy *= 240;
        const clampedDy = Math.max(-75, Math.min(75, dy));
        const factor = Math.exp(-clampedDy * 0.0046);
        const cur = cameraRef.current;
        const next = computeZoomAtPoint(cur.zoom * factor, e.clientX, e.clientY, cur);
        cameraRef.current = next;
        setCamera(next);
      } else {
        setShowZoomHint(true);
        if (zoomHintTimerRef.current) window.clearTimeout(zoomHintTimerRef.current);
        zoomHintTimerRef.current = window.setTimeout(() => {
          setShowZoomHint(false);
        }, 1800);
      }
    };

    const onTouchStartNative = (e: TouchEvent) => {
      if (e.touches.length >= 2) {
        e.preventDefault();
      }
    };

    const onTouchMoveNative = (e: TouchEvent) => {
      if (e.touches.length >= 2 || cameraRef.current.zoom > 1.01) {
        e.preventDefault();
      }
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStartNative, { passive: false });
    el.addEventListener('touchmove', onTouchMoveNative, { passive: false });
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStartNative);
      el.removeEventListener('touchmove', onTouchMoveNative);
      if (zoomHintTimerRef.current) window.clearTimeout(zoomHintTimerRef.current);
    };
  }, [computeZoomAtPoint]);

  const districtMap = useMemo(
    () => new Map(districts.map((d) => [d.id, d])),
    [districts]
  );

  // Exact District & Division outer borders derived directly from child Upazila polygons
  // so zoomed Upazila view never shows misaligned double ghost lines.
  const exactDistrictBorderPaths = useMemo(() => {
    const byDist = new Map<string, string[]>();
    for (const u of upazilas) {
      const list = byDist.get(u.districtId);
      if (list) list.push(u.path);
      else byDist.set(u.districtId, [u.path]);
    }
    const out = new Map<string, string>();
    for (const [distId, paths] of byDist.entries()) {
      const stitched = stitchBoundaryPaths(paths);
      if (stitched) out.set(distId, stitched);
    }
    return out;
  }, [upazilas]);

  const exactDivisionBorderPaths = useMemo(() => {
    const byDiv = new Map<string, string[]>();
    for (const u of upazilas) {
      const list = byDiv.get(u.divisionId);
      if (list) list.push(u.path);
      else byDiv.set(u.divisionId, [u.path]);
    }
    const out = new Map<string, string>();
    for (const [divId, paths] of byDiv.entries()) {
      const stitched = stitchBoundaryPaths(paths);
      if (stitched) out.set(divId, stitched);
    }
    return out;
  }, [upazilas]);

  const selectedDistrict = useMemo(
    () => (selectedDistrictId ? districtMap.get(selectedDistrictId) || null : null),
    [districtMap, selectedDistrictId]
  );

  const selectedUpazila = useMemo(
    () => (selectedUpazilaId ? upazilas.find((u) => u.id === selectedUpazilaId) || null : null),
    [upazilas, selectedUpazilaId]
  );

  const isAllRiversFilter =
    rivers.length > 0 && activeRiverIds.length >= rivers.length;

  const hasNonDivisionFilter =
    appliedDirections.length > 0 || (activeRiverIds.length > 0 && !isAllRiversFilter);

  const hasFilterActive = selectedDivisionId !== null || hasNonDivisionFilter;

  // Progressive Semantic Zoom Level of Detail: Divisions -> Districts -> Upazilas
  const zoom = camera.zoom;
  const effectiveLayer: 'divisions' | 'districts' | 'upazilas' = useMemo(() => {
    if (conquestMode) {
      if (zoom >= UPAZILA_ZOOM_THRESHOLD) return 'upazilas';
      if (zoom >= DISTRICT_ZOOM_THRESHOLD) return 'districts';
      return 'divisions';
    }
    if (selectedUpazilaId !== null || zoom >= UPAZILA_ZOOM_THRESHOLD) {
      return 'upazilas';
    }
    if (selectedDistrictId !== null || hasNonDivisionFilter || zoom >= DISTRICT_ZOOM_THRESHOLD) {
      return 'districts';
    }
    return 'divisions';
  }, [conquestMode, selectedUpazilaId, selectedDistrictId, hasNonDivisionFilter, zoom]);

  const divisionNeighborSet = useMemo(() => {
    if (!selectedDivisionId) return new Set<string>();
    return new Set(DIVISION_META[selectedDivisionId]?.neighbors || []);
  }, [selectedDivisionId]);

  const neighborSet = useMemo(() => {
    if (!selectedDistrict) return new Set<string>();
    return new Set(selectedDistrict.neighbors);
  }, [selectedDistrict]);

  const upazilaNeighborSet = useMemo(() => {
    if (!selectedUpazila) return new Set<string>();
    return new Set(selectedUpazila.neighbors);
  }, [selectedUpazila]);

  const activeRiverIdSet = useMemo(() => new Set(activeRiverIds), [activeRiverIds]);

  const divisionStatsMap = useMemo(() => {
    const map = new Map<string, { districts: number; upazilas: number }>();
    for (const div of divisions) {
      map.set(div.id, {
        districts: districts.filter((d) => d.divisionId === div.id).length,
        upazilas: upazilas.filter((u) => u.divisionId === div.id).length,
      });
    }
    return map;
  }, [divisions, districts, upazilas]);

  const activeRivers = useMemo(() => {
    if (activeRiverIds.length > 0 || inspectedRiverId) {
      return rivers.filter((r) => activeRiverIdSet.has(r.id) || r.id === inspectedRiverId);
    }
    if (selectedUpazila) {
      const uRiverSet = new Set(selectedUpazila.rivers);
      return rivers.filter((r) => uRiverSet.has(r.id));
    }
    if (selectedDistrictId) {
      return rivers.filter((r) => r.districts.includes(selectedDistrictId));
    }
    if (selectedDivisionId) {
      return rivers.filter((r) =>
        r.districts.some((did) => districtMap.get(did)?.divisionId === selectedDivisionId)
      );
    }
    return [];
  }, [
    rivers,
    activeRiverIds.length,
    activeRiverIdSet,
    inspectedRiverId,
    selectedUpazila,
    selectedDistrictId,
    selectedDivisionId,
    districtMap,
  ]);

  const highlightedRiverIds = useMemo(
    () => new Set(activeRivers.map((r) => r.id)),
    [activeRivers]
  );

  const activeRiverDistrictSet = useMemo(() => {
    const s = new Set<string>();
    if (activeRiverIds.length === 0) return s;
    for (const r of rivers) {
      if (activeRiverIdSet.has(r.id)) {
        for (const did of r.districts) s.add(did);
      }
    }
    return s;
  }, [rivers, activeRiverIds.length, activeRiverIdSet]);

  const doesDistrictMatchFilter = useCallback(
    (d: GeoDistrict) => {
      if (selectedDivisionId && d.divisionId !== selectedDivisionId) return false;
      if (appliedDirections.length > 0) {
        const detail = DISTRICT_DETAILS[d.id];
        if (!detail || !appliedDirections.some((dir) => detail.directions.includes(dir))) {
          return false;
        }
      }
      if (activeRiverIds.length > 0 && !isAllRiversFilter && !activeRiverDistrictSet.has(d.id)) {
        return false;
      }
      return true;
    },
    [selectedDivisionId, appliedDirections, activeRiverIds.length, isAllRiversFilter, activeRiverDistrictSet]
  );

  const doesUpazilaMatchFilter = useCallback(
    (u: GeoUpazila) => {
      if (selectedDivisionId && u.divisionId !== selectedDivisionId) return false;
      if (appliedDirections.length > 0) {
        const detail = DISTRICT_DETAILS[u.districtId];
        if (!detail || !appliedDirections.some((dir) => detail.directions.includes(dir))) {
          return false;
        }
      }
      if (activeRiverIds.length > 0 && !isAllRiversFilter) {
        if (!u.rivers.some((rid) => activeRiverIdSet.has(rid))) return false;
      }
      return true;
    },
    [selectedDivisionId, appliedDirections, activeRiverIds.length, isAllRiversFilter, activeRiverIdSet]
  );

  const hoveredDivision = useMemo(
    () => (hoveredDivisionId ? divisions.find((d) => d.id === hoveredDivisionId) || null : null),
    [divisions, hoveredDivisionId]
  );

  const hoveredDistrict = useMemo(
    () => (hoveredDistrictId ? districtMap.get(hoveredDistrictId) || null : null),
    [districtMap, hoveredDistrictId]
  );

  const hoveredUpazila = useMemo(
    () => (hoveredUpazilaId ? upazilas.find((u) => u.id === hoveredUpazilaId) || null : null),
    [upazilas, hoveredUpazilaId]
  );

  // Quantized zoom for label placement so panning never flickers labels
  const labelZoom = useMemo(
    () => Math.max(1, Math.round(zoom * 4) / 4),
    [zoom]
  );

  // Cartographic collision-free labels for Districts Tier
  const visibleDistrictLabels = useMemo(() => {
    if (effectiveLayer !== 'districts') return [];

    const candidates = districts
      .map((d) => {
        const isSelected = activeRiverIds.length === 0 && d.id === selectedDistrictId;
        const isNeighbor = activeRiverIds.length === 0 && neighborSet.has(d.id);
        const isHovered = d.id === hoveredDistrictId;
        const matchesFilter = doesDistrictMatchFilter(d);
        const shouldShow =
          isSelected ||
          isNeighbor ||
          isHovered ||
          (hasFilterActive && !selectedDistrictId && matchesFilter) ||
          (!selectedDistrictId && !hasFilterActive);
        if (!shouldShow) return null;

        const priority = isSelected ? 3 : isHovered ? 2.5 : isNeighbor ? 2 : 1;
        const area = (d.bbox[2] - d.bbox[0]) * (d.bbox[3] - d.bbox[1]);
        const fontSize =
          (isSelected ? 12.2 : isNeighbor ? 10.4 : 9.0) / Math.pow(labelZoom, 0.62);
        const text = lang === 'bn' ? d.bnName : d.name;
        const w = text.length * fontSize * 0.56 + fontSize * 0.7;
        const h = fontSize * 1.4;
        const box: BBox2D = [d.cx - w / 2, d.cy - h / 2, d.cx + w / 2, d.cy + h / 2];

        return { d, isSelected, isNeighbor, isHovered, priority, area, fontSize, text, box };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .sort((a, b) => b.priority - a.priority || b.area - a.area);

    const occupied: BBox2D[] = [];
    const placed: typeof candidates = [];

    for (const item of candidates) {
      if (item.priority >= 2.5 || !occupied.some((b) => boxesOverlap(b, item.box))) {
        occupied.push(item.box);
        placed.push(item);
      }
    }
    return placed;
  }, [
    effectiveLayer,
    districts,
    activeRiverIds.length,
    selectedDistrictId,
    hoveredDistrictId,
    neighborSet,
    hasFilterActive,
    doesDistrictMatchFilter,
    labelZoom,
    lang,
  ]);

  // Cartographic collision-free + polygon-fit labels for Upazilas Tier:
  // Upazila labels reserve boxes FIRST so District names never hide or overlap any Upazila name.
  const visibleUpazilaLayerLabels = useMemo(() => {
    if (effectiveLayer !== 'upazilas') {
      return {
        districtLabels: [] as {
          d: GeoDistrict;
          isParentOfSelected: boolean;
          fontSize: number;
          text: string;
          x: number;
          y: number;
        }[],
        upazilaLabels: [] as {
          u: GeoUpazila;
          isSelected: boolean;
          isNeighbor: boolean;
          isHovered: boolean;
          fontSize: number;
          text: string;
        }[],
      };
    }

    const occupied: BBox2D[] = [];
    const upazilaLabels: {
      u: GeoUpazila;
      isSelected: boolean;
      isNeighbor: boolean;
      isHovered: boolean;
      fontSize: number;
      text: string;
    }[] = [];

    const makeUpazilaEntry = (u: GeoUpazila, isSel: boolean, isNbr: boolean, isHov: boolean) => {
      const text = lang === 'bn' ? u.bnName : u.name;
      const baseFs = isSel ? 10.4 : isHov ? 9.2 : isNbr ? 8.5 : 7.85;
      const fontSize = baseFs / Math.pow(labelZoom, 0.56);
      const w = text.length * fontSize * 0.56 + fontSize * 0.9;
      const h = fontSize * 1.5;
      const box: BBox2D = [u.cx - w / 2, u.cy - h / 2, u.cx + w / 2, u.cy + h / 2];
      return { u, isSelected: isSel, isNeighbor: isNbr, isHovered: isHov, fontSize, text, box };
    };

    // Pass 1: Selected & hovered upazila always reserve space first
    for (const u of upazilas) {
      if (u.id === selectedUpazilaId || u.id === hoveredUpazilaId) {
        const entry = makeUpazilaEntry(
          u,
          u.id === selectedUpazilaId,
          !conquestMode && upazilaNeighborSet.has(u.id),
          u.id === hoveredUpazilaId
        );
        occupied.push(entry.box);
        upazilaLabels.push(entry);
      }
    }

    // Pass 2: Bordering neighbor upazilas (in explore mode)
    if (selectedUpazilaId && !conquestMode) {
      const neighbors = upazilas
        .filter((u) => u.id !== selectedUpazilaId && u.id !== hoveredUpazilaId && upazilaNeighborSet.has(u.id))
        .sort((a, b) => b.areaKm2 - a.areaKm2);
      for (const u of neighbors) {
        const entry = makeUpazilaEntry(u, false, true, false);
        if (!occupied.some((b) => boxesOverlap(b, entry.box))) {
          occupied.push(entry.box);
          upazilaLabels.push(entry);
        }
      }
    }

    // Pass 3: General upazilas — shown across the map even when an upazila is selected
    if (labelZoom >= UPAZILA_ZOOM_THRESHOLD || selectedUpazilaId !== null || (hasFilterActive && labelZoom >= 1.5)) {
      const regular = upazilas
        .filter(
          (u) =>
            u.id !== selectedUpazilaId &&
            u.id !== hoveredUpazilaId &&
            !(!conquestMode && upazilaNeighborSet.has(u.id)) &&
            (!hasFilterActive || doesUpazilaMatchFilter(u))
        )
        .sort((a, b) => {
          const aParent =
            selectedDistrictId === a.districtId || selectedUpazila?.districtId === a.districtId ? 1 : 0;
          const bParent =
            selectedDistrictId === b.districtId || selectedUpazila?.districtId === b.districtId ? 1 : 0;
          if (aParent !== bParent) return bParent - aParent;
          return b.areaKm2 - a.areaKm2;
        });

      const minMajorRatio = labelZoom >= 4.0 ? 1.08 : 1.38;
      const minMinorRatio = labelZoom >= 4.0 ? 0.42 : 0.56;

      for (const u of regular) {
        const entry = makeUpazilaEntry(u, false, false, false);
        const polyW = u.bbox[2] - u.bbox[0];
        const polyH = u.bbox[3] - u.bbox[1];
        if (
          Math.max(polyW, polyH) < entry.fontSize * minMajorRatio ||
          Math.min(polyW, polyH) < entry.fontSize * minMinorRatio
        ) {
          continue;
        }
        if (!occupied.some((b) => boxesOverlap(b, entry.box))) {
          occupied.push(entry.box);
          upazilaLabels.push(entry);
        }
      }
    }

    // Pass 4 (LAST): District context labels placed ONLY in collision-free pockets so they NEVER cover any Upazila name
    const districtLabels: {
      d: GeoDistrict;
      isParentOfSelected: boolean;
      fontSize: number;
      text: string;
      x: number;
      y: number;
    }[] = [];

    const distCandidates = districts
      .map((d) => {
        const matchesFilter = doesDistrictMatchFilter(d);
        if (hasFilterActive && !selectedUpazilaId && !matchesFilter) return null;
        const isParentOfSelected =
          selectedUpazila?.districtId === d.id || selectedDistrictId === d.id;

        const fontSize = (isParentOfSelected ? 8.8 : 8.1) / Math.pow(labelZoom, 0.54);
        const text = lang === 'bn' ? `${d.bnName} জেলা` : d.name;
        const w = text.length * fontSize * 0.56 + fontSize * 0.9;
        const h = fontSize * 1.45;
        const area = (d.bbox[2] - d.bbox[0]) * (d.bbox[3] - d.bbox[1]);
        return { d, isParentOfSelected, fontSize, text, w, h, area };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .sort((a, b) => Number(b.isParentOfSelected) - Number(a.isParentOfSelected) || b.area - a.area);

    for (const dc of distCandidates) {
      const polyW = dc.d.bbox[2] - dc.d.bbox[0];
      const polyH = dc.d.bbox[3] - dc.d.bbox[1];
      if (polyW < dc.w * 0.95 || polyH < dc.h * 1.4) continue;

      const pad = 2.2 / Math.pow(labelZoom, 0.54);
      const offsets: [number, number][] = [
        [0, -dc.h * 1.15],
        [0, dc.h * 1.15],
        [-dc.w * 0.32, 0],
        [dc.w * 0.32, 0],
        [0, -dc.h * 2.1],
        [0, dc.h * 2.1],
        [-dc.w * 0.32, -dc.h * 1.15],
        [dc.w * 0.32, -dc.h * 1.15],
        [-dc.w * 0.32, dc.h * 1.15],
        [dc.w * 0.32, dc.h * 1.15],
        [0, 0],
      ];

      for (const [dx, dy] of offsets) {
        const cx = dc.d.cx + dx;
        const cy = dc.d.cy + dy;
        // Keep district label cleanly inside its own district boundary
        if (
          cx - dc.w / 2 < dc.d.bbox[0] + 1.5 ||
          cx + dc.w / 2 > dc.d.bbox[2] - 1.5 ||
          cy - dc.h / 2 < dc.d.bbox[1] + 1.5 ||
          cy + dc.h / 2 > dc.d.bbox[3] - 1.5
        ) {
          continue;
        }
        const checkBox: BBox2D = [
          cx - dc.w / 2 - pad,
          cy - dc.h / 2 - pad,
          cx + dc.w / 2 + pad,
          cy + dc.h / 2 + pad,
        ];
        if (!occupied.some((b) => boxesOverlap(b, checkBox))) {
          occupied.push(checkBox);
          districtLabels.push({
            d: dc.d,
            isParentOfSelected: dc.isParentOfSelected,
            fontSize: dc.fontSize,
            text: dc.text,
            x: cx,
            y: cy,
          });
          break;
        }
      }
    }

    return { districtLabels, upazilaLabels };
  }, [
    effectiveLayer,
    upazilas,
    districts,
    selectedUpazilaId,
    hoveredUpazilaId,
    selectedDistrictId,
    selectedUpazila,
    upazilaNeighborSet,
    conquestMode,
    hasFilterActive,
    doesDistrictMatchFilter,
    doesUpazilaMatchFilter,
    labelZoom,
    lang,
  ]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragStartRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        dragStartRef.current.moved = true;
      }
      const curZoom = cameraRef.current.zoom;
      const next = clampCamera(
        curZoom,
        dragStartRef.current.vx - dx / dragStartRef.current.scale,
        dragStartRef.current.vy - dy / dragStartRef.current.scale
      );
      cameraRef.current = next;
      setCamera(next);
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
    if (e.button !== 0 || cameraRef.current.zoom <= 1.01) return;
    if (animRafRef.current) {
      cancelAnimationFrame(animRafRef.current);
      animRafRef.current = null;
    }
    const el = containerRef.current;
    if (!el) return;
    const proj = getProjection(el.getBoundingClientRect(), cameraRef.current);
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      vx: cameraRef.current.vx,
      vy: cameraRef.current.vy,
      scale: proj.scale,
      moved: false,
    };
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    window.setTimeout(() => {
      dragStartRef.current = null;
    }, 0);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const cur = cameraRef.current;
    const nextZoom = cur.zoom >= 5 ? 1 : Math.min(MAX_ZOOM, cur.zoom * 1.9);
    animateCameraTo(computeZoomAtPoint(nextZoom, e.clientX, e.clientY, cur));
  };

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
    setHoveredDivisionId(null);
    setHoveredDistrictId(null);
    setHoveredUpazilaId(null);
    setTooltipPos(null);

    if (animRafRef.current) {
      cancelAnimationFrame(animRafRef.current);
      animRafRef.current = null;
    }

    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cur = cameraRef.current;
    const proj = getProjection(rect, cur);

    if (e.touches.length === 2) {
      const { dist, midX, midY } = getTouchDistAndMid(e.touches[0], e.touches[1]);
      const startSvgMidX = cur.vx + (midX - rect.left - proj.offsetX) / proj.scale;
      const startSvgMidY = cur.vy + (midY - rect.top - proj.offsetY) / proj.scale;
      touchStateRef.current = {
        mode: 'pinch',
        startX: midX,
        startY: midY,
        startVx: cur.vx,
        startVy: cur.vy,
        startDist: Math.max(1, dist),
        startZoom: cur.zoom,
        startSvgMidX,
        startSvgMidY,
        scale: proj.scale,
        moved: true,
      };
    } else if (e.touches.length === 1) {
      const t = e.touches[0];
      const now = Date.now();
      if (now - lastTapRef.current < 270) {
        const nextZoom = cur.zoom >= 4.5 ? 1 : Math.min(MAX_ZOOM, cur.zoom * 1.85);
        animateCameraTo(computeZoomAtPoint(nextZoom, t.clientX, t.clientY, cur));
        lastTapRef.current = 0;
        touchStateRef.current.mode = 'none';
        touchStateRef.current.moved = true;
        return;
      }
      lastTapRef.current = now;

      if (cur.zoom > 1.01) {
        touchStateRef.current = {
          mode: 'pan',
          startX: t.clientX,
          startY: t.clientY,
          startVx: cur.vx,
          startVy: cur.vy,
          startDist: 1,
          startZoom: cur.zoom,
          startSvgMidX: 400,
          startSvgMidY: 500,
          scale: proj.scale,
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
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();

    if (e.touches.length === 2 && ts.mode === 'pinch') {
      const { dist, midX, midY } = getTouchDistAndMid(e.touches[0], e.touches[1]);
      const nextZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, Number((ts.startZoom * (dist / ts.startDist)).toFixed(3)))
      );

      if (nextZoom <= 1.01) {
        const next = { zoom: 1, vx: 0, vy: 0 };
        cameraRef.current = next;
        setCamera(next);
        return;
      }

      const nextVw = BASE_W / nextZoom;
      const nextVh = BASE_H / nextZoom;
      const nextScale = Math.min(rect.width / nextVw, rect.height / nextVh);
      const nextOffsetX = (rect.width - nextVw * nextScale) / 2;
      const nextOffsetY = (rect.height - nextVh * nextScale) / 2;

      const nextVx = ts.startSvgMidX - (midX - rect.left - nextOffsetX) / nextScale;
      const nextVy = ts.startSvgMidY - (midY - rect.top - nextOffsetY) / nextScale;
      const next = clampCamera(nextZoom, nextVx, nextVy);
      cameraRef.current = next;
      setCamera(next);
    } else if (e.touches.length === 1 && ts.mode === 'pan') {
      const t = e.touches[0];
      const dx = t.clientX - ts.startX;
      const dy = t.clientY - ts.startY;
      if (Math.hypot(dx, dy) > 8) {
        ts.moved = true;
      }
      const next = clampCamera(
        cameraRef.current.zoom,
        ts.startVx - dx / ts.scale,
        ts.startVy - dy / ts.scale
      );
      cameraRef.current = next;
      setCamera(next);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    const el = containerRef.current;
    if (e.touches.length === 1 && touchStateRef.current.mode === 'pinch' && el) {
      const t = e.touches[0];
      const cur = cameraRef.current;
      if (cur.zoom > 1.01) {
        const proj = getProjection(el.getBoundingClientRect(), cur);
        touchStateRef.current = {
          mode: 'pan',
          startX: t.clientX,
          startY: t.clientY,
          startVx: cur.vx,
          startVy: cur.vy,
          startDist: 1,
          startZoom: cur.zoom,
          startSvgMidX: 400,
          startSvgMidY: 500,
          scale: proj.scale,
          moved: true,
        };
        return;
      }
    }
    if (e.touches.length === 0) {
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
    const cur = cameraRef.current;
    animateCameraTo(
      computeZoomAtPoint(cur.zoom * ZOOM_STEP, rect.left + rect.width / 2, rect.top + rect.height / 2, cur)
    );
  };

  const handleZoomOut = () => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cur = cameraRef.current;
    animateCameraTo(
      computeZoomAtPoint(cur.zoom / ZOOM_STEP, rect.left + rect.width / 2, rect.top + rect.height / 2, cur)
    );
  };

  const handleReset = () => {
    animateCameraTo({ zoom: 1, vx: 0, vy: 0 });
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
  const focusedRiverId =
    inspectedRiverId || (activeRiverIds.length === 1 ? activeRiverIds[0] : null);
  const singleFocusedRiver = focusedRiverId
    ? rivers.find((r) => r.id === focusedRiverId) || null
    : null;
  const focusedRiverDetail = singleFocusedRiver
    ? RIVER_DETAILS[singleFocusedRiver.id] || null
    : null;

  const selectedUpazilaParentDist = selectedUpazila
    ? districtMap.get(selectedUpazila.districtId) || null
    : null;

  const selectedDivisionMeta = selectedDivisionId
    ? DIVISION_META[selectedDivisionId] || null
    : null;
  const selectedDivisionStats = selectedDivisionId
    ? divisionStatsMap.get(selectedDivisionId) || null
    : null;

  const vw = BASE_W / camera.zoom;
  const vh = BASE_H / camera.zoom;
  const svgViewBox = `${camera.vx.toFixed(2)} ${camera.vy.toFixed(2)} ${vw.toFixed(2)} ${vh.toFixed(2)}`;

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
      {/* Map Stage Toolbar: Single Clean Row on Mobile + Full Controls on Desktop */}
      <div className="flex items-center justify-between gap-2 px-3 sm:px-4 py-2 sm:py-2.5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/90 shrink-0">
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          {filterControls}
        </div>

        {/* Desktop Zoom + Reset + Fullscreen Controls */}
        <div className="hidden lg:flex items-center gap-1.5 ml-auto shrink-0">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            aria-label={lang === 'bn' ? 'জুম কমান' : 'Zoom out'}
            className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <span className="font-mono-tabular text-xs text-slate-600 dark:text-slate-300 w-10 text-center">
            {formatNum(Math.round(zoom * 100), lang)}%
          </span>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            aria-label={lang === 'bn' ? 'জুম বাড়ান' : 'Zoom in'}
            className="min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1 min-h-[32px] px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors whitespace-nowrap shrink-0 ml-0.5"
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
            className={`inline-flex items-center gap-1 min-h-[32px] px-2.5 py-1 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              isFullscreen
                ? 'bg-emerald-700 dark:bg-emerald-600 text-white border-emerald-700 dark:border-emerald-600'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {isFullscreen ? (
              <>
                <Minimize2 className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'স্বাভাবিক' : 'Exit'}</span>
              </>
            ) : (
              <>
                <Maximize2 className="w-3.5 h-3.5" />
                <span>{lang === 'bn' ? 'ফুলস্ক্রিন' : 'Fullscreen'}</span>
              </>
            )}
          </button>
        </div>

        {/* Minimalist Mobile & Tablet Toolbar Actions (Zoom +/- live cleanly in map corner) */}
        <div className="flex lg:hidden items-center gap-1.5 ml-auto shrink-0">
          {(zoom > 1.05 ||
            hasFilterActive ||
            selectedDistrictId !== null ||
            selectedUpazilaId !== null ||
            activeRiverIds.length > 0) && (
            <button
              type="button"
              onClick={handleReset}
              aria-label={lang === 'bn' ? 'রিসেট' : 'Reset'}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
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
            className={`h-8 px-2 sm:px-2.5 inline-flex items-center gap-1 rounded-lg border text-xs font-medium transition-colors ${
              isFullscreen
                ? 'bg-emerald-700 dark:bg-emerald-600 text-white border-emerald-700 dark:border-emerald-600'
                : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">
              {isFullscreen
                ? lang === 'bn'
                  ? 'স্বাভাবিক'
                  : 'Exit'
                : lang === 'bn'
                ? 'ফুলস্ক্রিন'
                : 'Fullscreen'}
            </span>
          </button>
        </div>
      </div>

      {/* Optional Slim Active Filter Summary Strip */}
      {activeFilterTags && (
        <div className="px-3 sm:px-4 py-2 border-b border-slate-200/80 dark:border-slate-800/80 bg-white dark:bg-slate-900/70 shrink-0">
          {activeFilterTags}
        </div>
      )}

      {/* Interactive Cartographic Canvas (Native SVG ViewBox Zoom for Razor-Sharp Vector Rendering) */}
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
          setHoveredDivisionId(null);
          setHoveredDistrictId(null);
          setHoveredUpazilaId(null);
          setTooltipPos(null);
          dragStartRef.current = null;
          setIsDragging(false);
        }}
        className={`relative w-full bg-[#F4F8FA] dark:bg-[#0B1220] overflow-hidden select-none transition-colors ${
          isFullscreen
            ? 'flex-1 min-h-0'
            : 'h-[58vh] min-h-[380px] max-h-[540px] sm:h-[62vh] sm:max-h-[640px] lg:h-[clamp(500px,calc(100vh-195px),690px)]'
        } ${zoom > 1.01 ? 'touch-none' : 'touch-pan-y'} ${
          zoom > 1.01 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : ''
        }`}
      >
        {/* Subtle Cartographic Graticule Backdrop (hidden on deep upazila zoom for clean look) */}
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-200"
          style={{
            opacity: effectiveLayer === 'upazilas' ? 0 : isDark ? 0.16 : 0.28,
            backgroundImage: isDark
              ? 'linear-gradient(to right, rgba(71,85,105,0.28) 1px, transparent 1px), linear-gradient(to bottom, rgba(71,85,105,0.28) 1px, transparent 1px)'
              : 'linear-gradient(to right, rgba(148,163,184,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.18) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        {/* Compass Rose (Top-Right) */}
        <div
          className="hidden sm:block absolute top-3 right-3 z-10 pointer-events-none bg-white/90 dark:bg-slate-900/90 backdrop-blur-xs border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-2 shadow-xs"
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

        {/* Floating Mobile & Tablet Corner Zoom Controls (Bottom-Right) */}
        <div className="absolute bottom-3 right-3 z-10 flex flex-col gap-1.5 lg:hidden">
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= MAX_ZOOM}
            aria-label={lang === 'bn' ? 'জুম বাড়ান' : 'Zoom in'}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 shadow-md disabled:opacity-40"
          >
            <ZoomIn className="w-5 h-5" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= MIN_ZOOM}
            aria-label={lang === 'bn' ? 'জুম কমান' : 'Zoom out'}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 shadow-md disabled:opacity-40"
          >
            <ZoomOut className="w-5 h-5" />
          </button>
          {zoom > 1.05 && (
            <button
              type="button"
              onClick={handleReset}
              aria-label={lang === 'bn' ? 'রিসেট' : 'Reset'}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/95 dark:bg-slate-900/95 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shadow-md"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Native ViewBox SVG Map */}
        <svg
          viewBox={svgViewBox}
          preserveAspectRatio="xMidYMid meet"
          className="w-full h-full block"
          role="img"
          aria-label={
            effectiveLayer === 'upazilas'
              ? lang === 'bn'
                ? 'বাংলাদেশের সকল উপজেলার ইন্টারেক্টিভ মানচিত্র'
                : 'Interactive map of all upazilas of Bangladesh'
              : effectiveLayer === 'districts'
              ? lang === 'bn'
                ? 'বাংলাদেশের ৬৪টি জেলার ইন্টারেক্টিভ মানচিত্র'
                : 'Interactive map of 64 districts of Bangladesh'
              : lang === 'bn'
              ? 'বাংলাদেশের ৮টি বিভাগের ইন্টারেক্টিভ মানচিত্র'
              : 'Interactive map of 8 divisions of Bangladesh'
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

          {/* TIER 1: 8 Divisions (Overview Layer, zoom < 1.35) */}
          {effectiveLayer === 'divisions' && (
            <>
              <g>
                {divisions.map((div) => {
                  const divMeta = DIVISION_META[div.id];
                  const isSelected = div.id === selectedDivisionId;
                  const isConquered = conquestMode && Boolean(conqueredDivisionIds?.has(div.id));
                  const isNeighbor = !conquestMode && divisionNeighborSet.has(div.id);
                  const isHovered = div.id === hoveredDivisionId;

                  let fill = isDark ? divMeta?.darkFill || '#1E293B' : divMeta?.fill || '#EDF2F7';
                  let stroke = isDark ? '#64748B' : '#475569';
                  let strokeWidth = 1.25;
                  let opacity = 1;

                  if (conquestMode) {
                    fill = isDark ? '#182234' : '#F1F5F9';
                    stroke = isDark ? '#475569' : '#94A3B8';
                    strokeWidth = 1.15;

                    if (isSelected) {
                      fill = isConquered
                        ? isDark
                          ? '#059669'
                          : '#047857'
                        : isDark
                        ? '#1D4ED8'
                        : '#2563EB';
                      stroke = isConquered ? '#FBBF24' : isDark ? '#93C5FD' : '#1E3A8A';
                      strokeWidth = 2.6;
                    } else if (isConquered) {
                      fill = isDark ? '#059669' : '#10B981';
                      stroke = isDark ? '#6EE7B7' : '#065F46';
                      strokeWidth = 1.8;
                    } else if (isHovered) {
                      fill = isDark ? '#273549' : '#E2E8F0';
                      stroke = isDark ? '#F8FAFC' : '#0F172A';
                      strokeWidth = 1.7;
                    }
                  } else if (selectedDivisionId) {
                    if (isSelected) {
                      fill = isDark ? '#059669' : '#047857';
                      stroke = isDark ? '#6EE7B7' : '#064E3B';
                      strokeWidth = 2.6;
                    } else if (isNeighbor) {
                      fill = isDark ? '#78350F' : '#FDE68A';
                      stroke = isDark ? '#F59E0B' : '#B45309';
                      strokeWidth = 1.85;
                    } else {
                      fill = isDark ? '#141D2E' : '#F1F5F9';
                      stroke = isDark ? '#334155' : '#CBD5E1';
                      strokeWidth = 0.9;
                      opacity = 0.72;
                    }
                  } else if (isHovered) {
                    fill = isDark
                      ? divMeta?.darkHoverFill || '#334155'
                      : divMeta?.hoverFill || '#CBD5E1';
                    stroke = isDark ? '#F8FAFC' : '#0F172A';
                    strokeWidth = 1.8;
                  }

                  if (isHovered && !isSelected && (selectedDivisionId || conquestMode)) {
                    stroke = isDark ? '#F8FAFC' : '#0F172A';
                    strokeWidth = 2.0;
                  }

                  return (
                    <path
                      key={`div-poly-${div.id}`}
                      d={div.path}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth / Math.sqrt(zoom)}
                      strokeLinejoin="round"
                      opacity={opacity}
                      className="cursor-pointer transition-[fill,opacity] duration-150 focus:outline-none"
                      tabIndex={0}
                      role="button"
                      aria-label={lang === 'bn' ? `${div.bnName} বিভাগ` : `${div.name} Division`}
                      onMouseEnter={() => setHoveredDivisionId(div.id)}
                      onClick={() => {
                        if (dragStartRef.current?.moved || touchStateRef.current.moved) return;
                        onSelectDivision(div.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          onSelectDivision(div.id);
                        }
                      }}
                    />
                  );
                })}
              </g>

              {/* Show conquered sub-territories subtly on Division map in Conquest Mode */}
              {conquestMode && (
                <g className="pointer-events-none">
                  {districts
                    .filter(
                      (d) =>
                        conqueredDistrictIds?.has(d.id) &&
                        !conqueredDivisionIds?.has(d.divisionId)
                    )
                    .map((d) => (
                      <path
                        key={`cq-sub-dist-${d.id}`}
                        d={d.path}
                        fill={isDark ? '#059669' : '#34D399'}
                        fillOpacity={0.58}
                        stroke={isDark ? '#6EE7B7' : '#047857'}
                        strokeWidth={0.75 / Math.sqrt(zoom)}
                        strokeLinejoin="round"
                      />
                    ))}
                  {upazilas
                    .filter(
                      (u) =>
                        conqueredUpazilaIds?.has(u.id) &&
                        !conqueredDistrictIds?.has(u.districtId) &&
                        !conqueredDivisionIds?.has(u.divisionId)
                    )
                    .map((u) => (
                      <path
                        key={`cq-sub-upz-${u.id}`}
                        d={u.path}
                        fill={isDark ? '#10B981' : '#6EE7B7'}
                        fillOpacity={0.62}
                        stroke={isDark ? '#34D399' : '#059669'}
                        strokeWidth={0.45 / Math.sqrt(zoom)}
                        strokeLinejoin="round"
                      />
                    ))}
                </g>
              )}

              {/* Subtle District Hairlines inside Selected Division */}
              {!conquestMode && selectedDivisionId && activeRiverIds.length === 0 && (
                <g className="pointer-events-none">
                  {districts
                    .filter((d) => d.divisionId === selectedDivisionId)
                    .map((d) => (
                      <path
                        key={`sel-div-d-${d.id}`}
                        d={d.path}
                        fill="none"
                        stroke={isDark ? '#A7F3D0' : '#ECFDF5'}
                        strokeWidth={0.85 / Math.sqrt(zoom)}
                        strokeOpacity={0.62}
                        strokeLinejoin="round"
                      />
                    ))}
                </g>
              )}
            </>
          )}

          {/* TIER 2: 64 Districts (Zoom 1.35x .. 2.59x or when a district/filter is active) */}
          {effectiveLayer === 'districts' && (
            <>
              <g>
                {districts.map((d) => {
                  const divMeta = DIVISION_META[d.divisionId];
                  const isSelected = d.id === selectedDistrictId;
                  const isConquered = conquestMode && Boolean(conqueredDistrictIds?.has(d.id));
                  const isNeighbor = !conquestMode && neighborSet.has(d.id);
                  const isHovered = d.id === hoveredDistrictId;
                  const matchesFilter = doesDistrictMatchFilter(d);

                  let fill = isDark ? divMeta?.darkFill || '#1E293B' : divMeta?.fill || '#EDF2F7';
                  let stroke = isDark ? '#475569' : '#64748B';
                  let strokeWidth = 0.85;
                  let opacity = 1;

                  if (conquestMode) {
                    fill = isDark ? '#182234' : '#F1F5F9';
                    stroke = isDark ? '#475569' : '#64748B';
                    strokeWidth = 0.9;

                    if (isSelected) {
                      fill = isConquered
                        ? isDark
                          ? '#059669'
                          : '#047857'
                        : isDark
                        ? '#1D4ED8'
                        : '#2563EB';
                      stroke = isConquered ? '#FBBF24' : isDark ? '#93C5FD' : '#1E3A8A';
                      strokeWidth = 2.35;
                    } else if (isConquered) {
                      fill = isDark ? '#059669' : '#10B981';
                      stroke = isDark ? '#6EE7B7' : '#065F46';
                      strokeWidth = 1.4;
                    } else if (isHovered) {
                      fill = isDark ? '#273549' : '#E2E8F0';
                      stroke = isDark ? '#F8FAFC' : '#0F172A';
                      strokeWidth = 1.45;
                    }
                  } else if (selectedDistrictId && activeRiverIds.length === 0) {
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
                      if (
                        activeRiverIds.length > 0 &&
                        !isAllRiversFilter &&
                        appliedDirections.length === 0 &&
                        !selectedDivisionId
                      ) {
                        fill = isDark ? '#0C4A6E' : '#DBEAFE';
                        stroke = isDark ? '#38BDF8' : '#0284C7';
                        strokeWidth = 1.45;
                      } else {
                        fill = isHovered
                          ? isDark
                            ? divMeta?.darkHoverFill || '#334155'
                            : divMeta?.hoverFill || '#CBD5E1'
                          : isDark
                          ? divMeta?.darkFill || '#1E293B'
                          : divMeta?.fill || '#E2E8F0';
                        stroke =
                          activeRiverIds.length > 0 && !isAllRiversFilter
                            ? isDark
                              ? '#38BDF8'
                              : '#0284C7'
                            : isDark
                            ? '#94A3B8'
                            : '#334155';
                        strokeWidth = 1.2;
                      }
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

                  if (isHovered && !isSelected && (selectedDistrictId || hasFilterActive || conquestMode)) {
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

              {/* Show conquered upazilas subtly inside unconquered districts on District view */}
              {conquestMode && conqueredUpazilaIds && conqueredUpazilaIds.size > 0 && (
                <g className="pointer-events-none">
                  {upazilas
                    .filter(
                      (u) =>
                        conqueredUpazilaIds.has(u.id) &&
                        !conqueredDistrictIds?.has(u.districtId)
                    )
                    .map((u) => (
                      <path
                        key={`cq-dist-sub-u-${u.id}`}
                        d={u.path}
                        fill={isDark ? '#10B981' : '#6EE7B7'}
                        fillOpacity={0.62}
                        stroke={isDark ? '#34D399' : '#059669'}
                        strokeWidth={0.45 / Math.sqrt(zoom)}
                        strokeLinejoin="round"
                      />
                    ))}
                </g>
              )}

              {/* Subtle Upazila Subdivision Hairlines inside the Selected District */}
              {!conquestMode && selectedDistrictId && activeRiverIds.length === 0 && (
                <g className="pointer-events-none">
                  {upazilas
                    .filter((u) => u.districtId === selectedDistrictId)
                    .map((u) => (
                      <path
                        key={`sel-u-${u.id}`}
                        d={u.path}
                        fill="none"
                        stroke={isDark ? '#A7F3D0' : '#ECFDF5'}
                        strokeWidth={0.65 / Math.sqrt(zoom)}
                        strokeOpacity={0.55}
                        strokeLinejoin="round"
                      />
                    ))}
                </g>
              )}
            </>
          )}

          {/* TIER 3: 544 Upazilas (Zoom >= 2.60x or when an upazila is selected) */}
          {effectiveLayer === 'upazilas' && (
            <>
              <g>
                {upazilas.map((u) => {
                  const divMeta = DIVISION_META[u.divisionId];
                  const isSelected = u.id === selectedUpazilaId;
                  const isConquered = conquestMode && Boolean(conqueredUpazilaIds?.has(u.id));
                  const isNeighbor = !conquestMode && upazilaNeighborSet.has(u.id);
                  const isHovered = u.id === hoveredUpazilaId;
                  const matchesFilter = doesUpazilaMatchFilter(u);
                  const isParentDistSelected =
                    !conquestMode && !selectedUpazilaId && selectedDistrictId === u.districtId;

                  let fill = conquestMode
                    ? isDark
                      ? '#182234'
                      : '#F1F5F9'
                    : isDark
                    ? divMeta?.darkFill || '#1E293B'
                    : divMeta?.fill || '#EDF2F7';
                  let stroke = isDark ? '#64748B' : '#64748B';
                  let strokeWidth = 0.52;
                  let strokeOpacity = isDark ? 0.62 : 0.52;
                  let opacity = 1;

                  if (conquestMode) {
                    if (isSelected) {
                      fill = isConquered
                        ? isDark
                          ? '#059669'
                          : '#047857'
                        : isDark
                        ? '#1D4ED8'
                        : '#2563EB';
                      stroke = isConquered ? '#FBBF24' : isDark ? '#93C5FD' : '#1E3A8A';
                      strokeWidth = 1.65;
                      strokeOpacity = 1;
                    } else if (isConquered) {
                      fill = isDark ? '#059669' : '#10B981';
                      stroke = isDark ? '#6EE7B7' : '#065F46';
                      strokeWidth = 0.9;
                      strokeOpacity = 0.92;
                    } else if (isHovered) {
                      fill = isDark ? '#273549' : '#E2E8F0';
                      stroke = isDark ? '#F8FAFC' : '#0F172A';
                      strokeWidth = 1.05;
                      strokeOpacity = 0.95;
                    }
                  } else if (selectedUpazilaId) {
                    if (isSelected) {
                      fill = isDark ? '#059669' : '#047857';
                      stroke = isDark ? '#6EE7B7' : '#064E3B';
                      strokeWidth = 1.65;
                      strokeOpacity = 1;
                    } else if (isNeighbor) {
                      fill = isDark ? '#78350F' : '#FDE68A';
                      stroke = isDark ? '#F59E0B' : '#B45309';
                      strokeWidth = 1.1;
                      strokeOpacity = 0.95;
                    } else {
                      fill = isDark ? '#141D2E' : '#F1F5F9';
                      stroke = isDark ? '#64748B' : '#64748B';
                      strokeWidth = 0.45;
                      strokeOpacity = 0.5;
                      opacity = 0.68;
                    }
                  } else if (isParentDistSelected) {
                    fill = isDark ? '#065F46' : '#D1FAE5';
                    stroke = isDark ? '#34D399' : '#059669';
                    strokeWidth = 0.65;
                    strokeOpacity = 0.8;
                  } else if (hasFilterActive) {
                    if (matchesFilter) {
                      fill =
                        activeRiverIds.length > 0 &&
                        !isAllRiversFilter &&
                        appliedDirections.length === 0 &&
                        !selectedDivisionId
                          ? isDark
                            ? '#0C4A6E'
                            : '#DBEAFE'
                          : isDark
                          ? divMeta?.darkFill || '#1E293B'
                          : divMeta?.fill || '#E2E8F0';
                      stroke =
                        activeRiverIds.length > 0 && !isAllRiversFilter
                          ? isDark
                            ? '#38BDF8'
                            : '#0284C7'
                          : isDark
                          ? '#94A3B8'
                          : '#475569';
                      strokeWidth = 0.62;
                      strokeOpacity = 0.72;
                    } else {
                      fill = isDark ? '#111827' : '#F1F5F9';
                      stroke = isDark ? '#334155' : '#CBD5E1';
                      strokeOpacity = 0.42;
                      opacity = 0.36;
                    }
                  } else if (isHovered) {
                    fill = isDark
                      ? divMeta?.darkHoverFill || '#334155'
                      : divMeta?.hoverFill || '#CBD5E1';
                    stroke = isDark ? '#F8FAFC' : '#0F172A';
                    strokeWidth = 1.0;
                    strokeOpacity = 0.92;
                  }

                  if (isHovered && !isSelected) {
                    stroke = isDark ? '#F8FAFC' : '#0F172A';
                    strokeWidth = 1.1;
                    strokeOpacity = 0.96;
                  }

                  return (
                    <path
                      key={u.id}
                      d={u.path}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={strokeWidth / Math.sqrt(zoom)}
                      strokeOpacity={strokeOpacity}
                      strokeLinejoin="round"
                      opacity={opacity}
                      className="cursor-pointer transition-[fill,opacity] duration-150 focus:outline-none"
                      onMouseEnter={() => setHoveredUpazilaId(u.id)}
                      onClick={() => {
                        if (dragStartRef.current?.moved || touchStateRef.current.moved) {
                          return;
                        }
                        onSelectUpazila(u.id);
                      }}
                    />
                  );
                })}
              </g>

              {/* Natural Aligned District Borders Derived from Upazila Edges */}
              <g className="pointer-events-none">
                {districts.map((d) => {
                  const isParentOrSelected =
                    selectedUpazila?.districtId === d.id || selectedDistrictId === d.id;
                  const matchesFilter = !hasFilterActive || doesDistrictMatchFilter(d);
                  const borderPath = exactDistrictBorderPaths.get(d.id) || d.path;
                  return (
                    <path
                      key={`upz-dist-border-${d.id}`}
                      d={borderPath}
                      fill="none"
                      stroke={
                        isParentOrSelected
                          ? conquestMode
                            ? isDark
                              ? '#60A5FA'
                              : '#1D4ED8'
                            : isDark
                            ? '#34D399'
                            : '#047857'
                          : isDark
                          ? '#CBD5E1'
                          : '#334155'
                      }
                      strokeWidth={(isParentOrSelected ? 1.15 : 0.88) / Math.sqrt(zoom)}
                      strokeOpacity={
                        isParentOrSelected
                          ? 0.92
                          : selectedUpazilaId && !conquestMode
                          ? 0.68
                          : matchesFilter
                          ? 0.82
                          : 0.3
                      }
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  );
                })}
                {selectedDivisionId &&
                  divisions
                    .filter((div) => div.id === selectedDivisionId)
                    .map((div) => (
                      <path
                        key={`upz-div-border-${div.id}`}
                        d={exactDivisionBorderPaths.get(div.id) || div.path}
                        fill="none"
                        stroke={isDark ? '#E2E8F0' : '#1E293B'}
                        strokeWidth={1.15 / Math.sqrt(zoom)}
                        strokeOpacity={0.82}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    ))}
              </g>
            </>
          )}

          {/* Crisp Division Borders Overlay (in Districts Tier only) */}
          {effectiveLayer === 'districts' && (
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
                    strokeWidth={(isSelectedDiv ? 1.8 : 0.95) / Math.sqrt(zoom)}
                    strokeOpacity={
                      selectedDistrictId ? 0.2 : isSelectedDiv ? 0.85 : 0.35
                    }
                    strokeLinejoin="round"
                  />
                );
              })}
            </g>
          )}

          {/* Active Highlighted Rivers Layer + Origin/Mouth Markers */}
          {activeRivers.length > 0 && (
            <g className="pointer-events-none">
              {[...activeRivers]
                .sort((a, b) => {
                  const aFocused = singleFocusedRiver?.id === a.id ? 1 : 0;
                  const bFocused = singleFocusedRiver?.id === b.id ? 1 : 0;
                  return aFocused - bFocused;
                })
                .map((r) => {
                  const isFocused = singleFocusedRiver?.id === r.id;
                  const isSecondary = Boolean(singleFocusedRiver && !isFocused);
                  const endpoints = isFocused ? getRiverEndpoints(r.path) : null;
                  const invZoom = Math.sqrt(zoom);
                  const isRiverFilterMode = activeRiverIds.length > 0 && !isAllRiversFilter;
                  const haloW = isFocused
                    ? 6.2
                    : isAllRiversFilter
                    ? 3.4
                    : isRiverFilterMode
                    ? 5.4
                    : 5.0;
                  const mainW = isFocused
                    ? 3.8
                    : isAllRiversFilter
                    ? 2.0
                    : isRiverFilterMode
                    ? 3.2
                    : 2.9;
                  const flowW = isFocused
                    ? 1.75
                    : isAllRiversFilter
                    ? 0.95
                    : isRiverFilterMode
                    ? 1.5
                    : 1.35;
                  const groupOpacity = isSecondary ? 0.36 : 1;
                  return (
                    <g key={`active-river-${r.id}`} opacity={groupOpacity}>
                      <path
                        d={r.path}
                        fill="none"
                        stroke={labelHaloColor}
                        strokeWidth={haloW / invZoom}
                        strokeLinecap="round"
                        strokeOpacity={isAllRiversFilter ? 0.72 : 0.9}
                      />
                      <path
                        d={r.path}
                        fill="none"
                        stroke={isDark ? '#38BDF8' : '#0284C7'}
                        strokeWidth={mainW / invZoom}
                        strokeLinecap="round"
                        strokeOpacity={isAllRiversFilter ? 0.85 : 1}
                      />
                      {!isSecondary && (
                        <path
                          d={r.path}
                          fill="none"
                          stroke="#E0F2FE"
                          strokeWidth={flowW / invZoom}
                          strokeLinecap="round"
                          className="river-flow-animate"
                        />
                      )}

                      {endpoints && (
                        <>
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

          {/* LABELS BY PROGRESSIVE ZOOM TIER */}
          {effectiveLayer === 'divisions' && (
            <g className="pointer-events-none select-none">
              {divisions.map((div) => {
                const isSelected = div.id === selectedDivisionId;
                const isConquered = conquestMode && Boolean(conqueredDivisionIds?.has(div.id));
                const isNeighbor = !conquestMode && divisionNeighborSet.has(div.id);
                const fontSize = (isSelected ? 15.5 : isNeighbor ? 14 : 13.5) / Math.pow(zoom, 0.45);
                const fillColor =
                  isSelected || isConquered
                    ? '#FFFFFF'
                    : isNeighbor
                    ? isDark
                      ? '#FDE68A'
                      : '#78350F'
                    : isDark
                    ? '#F8FAFC'
                    : '#0F172A';
                const strokeColor =
                  isSelected && !isConquered
                    ? conquestMode
                      ? '#1E3A8A'
                      : '#064E3B'
                    : isConquered
                    ? '#064E3B'
                    : isNeighbor && isDark
                    ? '#451A03'
                    : labelHaloColor;
                return (
                  <g key={`div-lbl-${div.id}`}>
                    <text
                      x={div.cx}
                      y={div.cy}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={fontSize}
                      fontWeight="700"
                      fill={fillColor}
                      stroke={strokeColor}
                      strokeWidth={3.8 / Math.pow(zoom, 0.45)}
                      style={{ paintOrder: 'stroke' }}
                    >
                      {`${isConquered ? '✓ ' : ''}${lang === 'bn' ? `${div.bnName} বিভাগ` : div.name}`}
                    </text>
                  </g>
                );
              })}
            </g>
          )}

          {effectiveLayer === 'districts' && (
            <g className="pointer-events-none select-none">
              {visibleDistrictLabels.map(({ d, isSelected, isNeighbor, fontSize, text }) => {
                const isConquered = conquestMode && Boolean(conqueredDistrictIds?.has(d.id));
                const fillColor =
                  isSelected || isConquered
                    ? '#FFFFFF'
                    : isNeighbor
                    ? isDark
                      ? '#FDE68A'
                      : '#78350F'
                    : isDark
                    ? '#E2E8F0'
                    : '#1E293B';
                const strokeColor =
                  isSelected && !isConquered
                    ? conquestMode
                      ? '#1E3A8A'
                      : '#064E3B'
                    : isConquered
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
                    fontWeight={isSelected || isConquered ? '700' : '600'}
                    fill={fillColor}
                    stroke={strokeColor}
                    strokeWidth={(isSelected || isConquered ? 3.2 : 2.6) / Math.pow(labelZoom, 0.62)}
                    style={{ paintOrder: 'stroke' }}
                  >
                    {`${isConquered ? '✓ ' : ''}${text}`}
                  </text>
                );
              })}
            </g>
          )}

          {effectiveLayer === 'upazilas' && (
            <>
              {/* Muted District Context Labels Placed Strictly in Non-Overlapping Pockets */}
              <g className="pointer-events-none select-none">
                {visibleUpazilaLayerLabels.districtLabels.map(
                  ({ d, isParentOfSelected, fontSize, text, x, y }) => (
                    <text
                      key={`u-dist-lbl-${d.id}`}
                      x={x}
                      y={y}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={fontSize}
                      fontWeight="500"
                      fill={
                        isParentOfSelected
                          ? conquestMode
                            ? isDark
                              ? '#60A5FA'
                              : '#1D4ED8'
                            : isDark
                            ? '#34D399'
                            : '#047857'
                          : isDark
                          ? '#94A3B8'
                          : '#64748B'
                      }
                      fillOpacity={0.92}
                      stroke={labelHaloColor}
                      strokeOpacity={0.9}
                      strokeWidth={(isParentOfSelected ? 2.2 : 1.9) / Math.pow(labelZoom, 0.54)}
                      style={{ paintOrder: 'stroke' }}
                    >
                      {text}
                    </text>
                  )
                )}
              </g>

              {/* Crisp Upazila Names Matching District Border Contrast */}
              <g className="pointer-events-none select-none">
                {visibleUpazilaLayerLabels.upazilaLabels.map(
                  ({ u, isSelected, isNeighbor, fontSize, text }) => {
                    const isConquered = conquestMode && Boolean(conqueredUpazilaIds?.has(u.id));
                    const fillColor =
                      isSelected || isConquered
                        ? '#FFFFFF'
                        : isNeighbor
                        ? isDark
                          ? '#FDE68A'
                          : '#78350F'
                        : isDark
                        ? '#E2E8F0'
                        : '#1E293B';
                    const strokeColor =
                      isSelected && !isConquered
                        ? conquestMode
                          ? '#1E3A8A'
                          : '#064E3B'
                        : isConquered
                        ? '#064E3B'
                        : isNeighbor && isDark
                        ? '#451A03'
                        : labelHaloColor;

                    return (
                      <text
                        key={`ulbl-${u.id}`}
                        x={u.cx}
                        y={u.cy}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={fontSize}
                        fontWeight={isSelected || isConquered ? '700' : '600'}
                        fill={fillColor}
                        stroke={strokeColor}
                        strokeWidth={(isSelected || isConquered ? 2.5 : 1.95) / Math.pow(labelZoom, 0.56)}
                        style={{ paintOrder: 'stroke' }}
                      >
                        {`${isConquered ? '✓ ' : ''}${text}`}
                      </text>
                    );
                  }
                )}
              </g>
            </>
          )}

          {/* Active River Name Labels */}
          {activeRivers.length > 0 && (
            <g className="pointer-events-none select-none">
              {(isAllRiversFilter && zoom < 1.8 ? activeRivers.slice(0, 14) : activeRivers).map((r) => {
                const pt = getRiverLabelPoint(r.path);
                if (!pt) return null;
                const isActive = highlightedRiverIds.has(r.id);
                const rFont = (isAllRiversFilter ? 9.5 : isActive ? 11.5 : 9.5) / Math.pow(zoom, 0.55);
                return (
                  <text
                    key={`rlbl-${r.id}`}
                    x={pt[0]}
                    y={pt[1] - 7 / Math.pow(zoom, 0.55)}
                    textAnchor="middle"
                    fontSize={rFont}
                    fontWeight={isActive && !isAllRiversFilter ? '700' : '600'}
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

        {/* Floating Hover Tooltips (Division / District / Upazila) */}
        {effectiveLayer === 'divisions' && hoveredDivision && tooltipPos && !isDragging && (
          <div
            className="hidden sm:block absolute z-20 pointer-events-none bg-slate-900 dark:bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 shadow-lg max-w-[245px]"
            style={{
              left: Math.min(tooltipPos.x + 14, (containerRef.current?.clientWidth || 500) - 230),
              top: Math.max(tooltipPos.y - 54, 12),
            }}
          >
            <div className="text-sm font-semibold leading-tight">
              {lang === 'bn'
                ? `${hoveredDivision.bnName} বিভাগ (${hoveredDivision.name})`
                : `${hoveredDivision.name} Division`}
            </div>
            <div className="text-xs text-slate-300 mt-0.5">
              {lang === 'bn'
                ? `${DIVISION_META[hoveredDivision.id]?.directionBn} · ${formatNum(
                    divisionStatsMap.get(hoveredDivision.id)?.districts || 0,
                    lang
                  )} জেলা`
                : `${DIVISION_META[hoveredDivision.id]?.directionEn} · ${
                    divisionStatsMap.get(hoveredDivision.id)?.districts || 0
                  } Districts`}
            </div>
            {selectedDivisionId && divisionNeighborSet.has(hoveredDivision.id) && (
              <div className="text-[11px] font-medium text-amber-300 mt-1">
                {lang === 'bn' ? 'পার্শ্ববর্তী বিভাগ · ক্লিক করুন' : 'Bordering division · Click to open'}
              </div>
            )}
          </div>
        )}

        {effectiveLayer === 'districts' && hoveredDistrict && tooltipPos && !isDragging && (
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

        {effectiveLayer === 'upazilas' && hoveredUpazila && tooltipPos && !isDragging && (
          <div
            className="hidden sm:block absolute z-20 pointer-events-none bg-slate-900 dark:bg-slate-800 text-white border border-slate-700 rounded-lg px-3 py-2 shadow-lg max-w-[245px]"
            style={{
              left: Math.min(tooltipPos.x + 14, (containerRef.current?.clientWidth || 500) - 225),
              top: Math.max(tooltipPos.y - 54, 12),
            }}
          >
            <div className="text-sm font-semibold leading-tight">
              {lang === 'bn'
                ? `${hoveredUpazila.bnName} (${hoveredUpazila.name})`
                : `${hoveredUpazila.name} (${hoveredUpazila.bnName})`}
            </div>
            <div className="text-xs text-slate-300 mt-0.5">
              {lang === 'bn'
                ? `${districtMap.get(hoveredUpazila.districtId)?.bnName || ''} জেলা · ${
                    DIVISION_META[hoveredUpazila.divisionId]?.bnName || ''
                  } বিভাগ`
                : `${districtMap.get(hoveredUpazila.districtId)?.name || ''} Dist. · ${
                    DIVISION_META[hoveredUpazila.divisionId]?.name || ''
                  } Div.`}
            </div>
            {selectedUpazilaId && upazilaNeighborSet.has(hoveredUpazila.id) && (
              <div className="text-[11px] font-medium text-amber-300 mt-1">
                {lang === 'bn' ? 'পার্শ্ববর্তী উপজেলা · ক্লিক করুন' : 'Bordering upazila · Click to open'}
              </div>
            )}
          </div>
        )}

        {/* Fullscreen Compact Floating Inspector Card */}
        {isFullscreen &&
          (singleFocusedRiver ||
            selectedUpazila ||
            selectedDistrict ||
            selectedDivisionMeta ||
            appliedDirections.length > 0 ||
            activeRiverIds.length > 0) && (
            <div className="absolute top-3 left-3 z-20 max-w-xs sm:max-w-sm bg-white/95 dark:bg-slate-900/95 backdrop-blur-xs border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-3 shadow-lg">
              <div className="flex items-start justify-between gap-2">
                {singleFocusedRiver ? (
                  <div>
                    <div className="text-[11px] font-semibold text-sky-700 dark:text-sky-400">
                      {lang === 'bn' ? 'নদীর সম্পূর্ণ গতিপথ' : 'Full River Course'}
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {lang === 'bn'
                        ? `${singleFocusedRiver.bnName} নদী`
                        : `${singleFocusedRiver.name} River`}{' '}
                      · ~{formatNum(singleFocusedRiver.lengthKm, lang)} {lang === 'bn' ? 'কিমি' : 'km'}
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
                ) : selectedUpazila ? (
                  <div>
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn'
                        ? `${selectedUpazilaParentDist?.bnName || ''} জেলা · ${
                            DIVISION_META[selectedUpazila.divisionId]?.bnName || ''
                          } বিভাগ`
                        : `${selectedUpazilaParentDist?.name || ''} Dist. · ${
                            DIVISION_META[selectedUpazila.divisionId]?.name || ''
                          } Div.`}
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {lang === 'bn' ? selectedUpazila.bnName : selectedUpazila.name}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      {lang === 'bn'
                        ? `পার্শ্ববর্তী ${formatNum(selectedUpazila.neighbors.length, lang)}টি উপজেলা · প্রধান নদী ${formatNum(selectedUpazila.rivers.length, lang)}টি`
                        : `${selectedUpazila.neighbors.length} bordering upazilas · ${selectedUpazila.rivers.length} major rivers`}
                    </div>
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
                        ? `পার্শ্ববর্তী ${formatNum(selectedDistrict.neighbors.length, lang)}টি জেলা · প্রধান নদী ${formatNum(activeRivers.length, lang)}টি`
                        : `${selectedDistrict.neighbors.length} bordering districts · ${activeRivers.length} major rivers`}
                    </div>
                  </div>
                ) : selectedDivisionMeta ? (
                  <div>
                    <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? selectedDivisionMeta.directionBn : selectedDivisionMeta.directionEn}
                    </div>
                    <div className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                      {lang === 'bn'
                        ? `${selectedDivisionMeta.bnName} বিভাগ`
                        : `${selectedDivisionMeta.name} Division`}
                    </div>
                    <div className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                      {lang === 'bn'
                        ? `${formatNum(selectedDivisionStats?.districts || 0, lang)} জেলা · ${formatNum(
                            selectedDivisionStats?.upazilas || 0,
                            lang
                          )} উপজেলা · প্রধান নদী ${formatNum(activeRivers.length, lang)}টি`
                        : `${selectedDivisionStats?.districts || 0} districts · ${
                            selectedDivisionStats?.upazilas || 0
                          } upazilas · ${activeRivers.length} major rivers`}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                      {lang === 'bn' ? 'ফিল্টার ফলাফল' : 'Filtered Results'}
                    </div>
                    <div className="text-xs text-slate-700 dark:text-slate-200 mt-1 space-y-0.5">
                      {appliedDirections.length > 0 && (
                        <div>
                          {appliedDirections
                            .map((dir) =>
                              lang === 'bn' ? DIRECTION_INFO[dir].labelBn : DIRECTION_INFO[dir].labelEn
                            )
                            .join(' · ')}
                        </div>
                      )}
                      {activeRiverIds.length > 0 && (
                        <div className="text-sky-700 dark:text-sky-400 font-medium">
                          {isAllRiversFilter
                            ? lang === 'bn'
                              ? `সব নদ-নদী (${formatNum(rivers.length, lang)})`
                              : `All Major Rivers (${rivers.length})`
                            : lang === 'bn'
                            ? `${formatNum(activeRiverIds.length, lang)}টি নির্বাচিত নদ-নদী`
                            : `${activeRiverIds.length} selected rivers`}
                        </div>
                      )}
                    </div>
                  </div>
                )}
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
        {conquestMode ? (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3.5 rounded-xs bg-[#10B981] dark:bg-[#059669] border border-[#065F46] dark:border-[#6EE7B7]" />
              <span>{lang === 'bn' ? 'জয় করা এলাকা' : 'Conquered'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3.5 rounded-xs bg-[#2563EB] dark:bg-[#1D4ED8] border border-[#1E3A8A] dark:border-[#93C5FD]" />
              <span>{lang === 'bn' ? 'নির্বাচিত লক্ষ্য' : 'Selected Target'}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3.5 rounded-xs bg-[#F1F5F9] dark:bg-[#182234] border border-[#94A3B8] dark:border-[#475569]" />
              <span>{lang === 'bn' ? 'জয় করতে বাকি' : 'Unconquered'}</span>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3.5 rounded-xs bg-[#047857] dark:bg-[#059669] border border-[#064E3B] dark:border-[#6EE7B7]" />
              <span>
                {effectiveLayer === 'upazilas'
                  ? lang === 'bn'
                    ? 'নির্বাচিত উপজেলা'
                    : 'Selected Upazila'
                  : effectiveLayer === 'districts'
                  ? lang === 'bn'
                    ? 'নির্বাচিত জেলা'
                    : 'Selected District'
                  : lang === 'bn'
                  ? 'নির্বাচিত বিভাগ'
                  : 'Selected Division'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-3.5 h-3.5 rounded-xs bg-[#FDE68A] dark:bg-[#78350F] border border-[#B45309] dark:border-[#F59E0B]" />
              <span>
                {effectiveLayer === 'upazilas'
                  ? lang === 'bn'
                    ? 'পার্শ্ববর্তী উপজেলা'
                    : 'Bordering Upazilas'
                  : effectiveLayer === 'districts'
                  ? lang === 'bn'
                    ? 'পার্শ্ববর্তী জেলা'
                    : 'Bordering Districts'
                  : lang === 'bn'
                  ? 'পার্শ্ববর্তী বিভাগ'
                  : 'Bordering Divisions'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="inline-block w-5 h-1 rounded-full bg-[#0284C7] dark:bg-[#38BDF8]" />
              <span>{lang === 'bn' ? 'প্রবাহিত নদী (প্রধান ৩০টি)' : 'Major Rivers (of 30)'}</span>
            </div>
            {singleFocusedRiver && (
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
        )}
        <span className="text-slate-500 dark:text-slate-400">
          {effectiveLayer === 'divisions'
            ? lang === 'bn'
              ? 'বিভাগ স্তর · জুম করলে জেলা ও উপজেলা দেখাবে'
              : 'Divisions · Zoom in for Districts & Upazilas'
            : effectiveLayer === 'districts'
            ? lang === 'bn'
              ? 'জেলা স্তর · আরও জুম করলে উপজেলা দেখাবে'
              : 'Districts · Zoom in further for Upazilas'
            : lang === 'bn'
            ? 'উপজেলা স্তর · জুম আউট করলে জেলা ও বিভাগ'
            : 'Upazilas · Zoom out for Districts & Divisions'}
        </span>
      </div>
    </div>
  );
};
