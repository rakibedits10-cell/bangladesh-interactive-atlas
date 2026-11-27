import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  Compass,
  Info,
  MapPin,
  Search,
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
import { getUpazilaDetail } from '../data/bdUpazilaDetails';
import { formatNum, toBnDigits } from '../utils/format';
import type {
  GeoDistrict,
  GeoDivision,
  GeoRiver,
  GeoUpazila,
  Lang,
  Theme,
} from '../types/map';

interface DistrictDetailPanelProps {
  districts: GeoDistrict[];
  upazilas: GeoUpazila[];
  divisions: GeoDivision[];
  rivers: GeoRiver[];
  selectedDistrictId: string | null;
  selectedUpazilaId: string | null;
  selectedDivisionId: string | null;
  appliedDirections: Exclude<DirectionZone, 'all'>[];
  appliedRiverIds: string[];
  inspectedRiverId: string | null;
  lang: Lang;
  theme: Theme;
  onSelectDistrict: (id: string | null) => void;
  onSelectUpazila: (id: string | null) => void;
  onSelectDivision: (divisionId: string | null) => void;
  onInspectRiver: (riverId: string | null) => void;
  onClearFilters: () => void;
}

export const DistrictDetailPanel: React.FC<DistrictDetailPanelProps> = ({
  districts,
  upazilas,
  divisions,
  rivers,
  selectedDistrictId,
  selectedUpazilaId,
  selectedDivisionId,
  appliedDirections,
  appliedRiverIds,
  inspectedRiverId,
  lang,
  theme,
  onSelectDistrict,
  onSelectUpazila,
  onSelectDivision,
  onInspectRiver,
  onClearFilters,
}) => {
  const isDark = theme === 'dark';

  const districtMap = useMemo(
    () => new Map(districts.map((d) => [d.id, d])),
    [districts]
  );
  const upazilaMap = useMemo(
    () => new Map(upazilas.map((u) => [u.id, u])),
    [upazilas]
  );
  const divisionMap = useMemo(
    () => new Map(divisions.map((div) => [div.id, div])),
    [divisions]
  );
  const riverMap = useMemo(
    () => new Map(rivers.map((r) => [r.id, r])),
    [rivers]
  );

  const selectedDistrict = selectedDistrictId ? districtMap.get(selectedDistrictId) || null : null;
  const selectedUpazila = selectedUpazilaId ? upazilaMap.get(selectedUpazilaId) || null : null;
  const selectedDivision = selectedDivisionId ? divisionMap.get(selectedDivisionId) || null : null;
  const detail = selectedDistrict ? DISTRICT_DETAILS[selectedDistrict.id] : null;
  const division = selectedDistrict ? DIVISION_META[selectedDistrict.divisionId] : null;

  const [filterResultTab, setFilterResultTab] = useState<'districts' | 'upazilas'>('districts');
  const [divUpazilaSearch, setDivUpazilaSearch] = useState<string>('');
  const [hoveredLocalUpazilaId, setHoveredLocalUpazilaId] = useState<string | null>(null);
  const [hoveredLocalDistrictId, setHoveredLocalDistrictId] = useState<string | null>(null);

  useEffect(() => {
    setDivUpazilaSearch('');
  }, [selectedDivisionId]);

  const districtUpazilas = useMemo(() => {
    if (!selectedDistrict) return [];
    return upazilas
      .filter((u) => u.districtId === selectedDistrict.id)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [upazilas, selectedDistrict]);

  const divisionUpazilas = useMemo(() => {
    if (!selectedDivisionId) return [];
    return upazilas
      .filter((u) => u.divisionId === selectedDivisionId)
      .sort((a, b) =>
        lang === 'bn' ? a.bnName.localeCompare(b.bnName) : a.name.localeCompare(b.name)
      );
  }, [upazilas, selectedDivisionId, lang]);

  const districtRivers = useMemo(() => {
    if (!selectedDistrict) return [];
    return rivers.filter((r) => r.districts.includes(selectedDistrict.id));
  }, [rivers, selectedDistrict]);

  const inspectedRiver = inspectedRiverId ? riverMap.get(inspectedRiverId) || null : null;
  const autoSingleFilterRiver =
    !inspectedRiver &&
    !selectedDistrict &&
    !selectedUpazila &&
    !selectedDivision &&
    appliedDirections.length === 0 &&
    appliedRiverIds.length === 1
      ? riverMap.get(appliedRiverIds[0]) || null
      : null;
  const activeInspectedRiver = inspectedRiver || autoSingleFilterRiver;

  interface LocalBox {
    x: number;
    y: number;
    w: number;
    h: number;
  }

  const baseLocalBox = useMemo<LocalBox>(() => {
    if (selectedUpazila) {
      const cluster = [
        selectedUpazila,
        ...selectedUpazila.neighbors
          .map((uid) => upazilaMap.get(uid))
          .filter((u): u is GeoUpazila => Boolean(u)),
      ];
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const u of cluster) {
        const [bx0, by0, bx1, by1] = u.bbox;
        if (bx0 < minX) minX = bx0;
        if (by0 < minY) minY = by0;
        if (bx1 > maxX) maxX = bx1;
        if (by1 > maxY) maxY = by1;
      }
      const spanX = maxX - minX;
      const spanY = maxY - minY;
      const pad = Math.max(5, Math.min(22, Math.max(spanX, spanY) * 0.22));
      return {
        x: minX - pad,
        y: minY - pad,
        w: Math.max(20, spanX + pad * 2),
        h: Math.max(16, spanY + pad * 2),
      };
    }

    if (selectedDistrict) {
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
      const pad = 24;
      return {
        x: minX - pad,
        y: minY - pad,
        w: Math.max(90, maxX - minX + pad * 2),
        h: Math.max(75, maxY - minY + pad * 2),
      };
    }

    if (selectedDivisionId) {
      const divDistricts = districts.filter((d) => d.divisionId === selectedDivisionId);
      if (divDistricts.length > 0) {
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const d of divDistricts) {
          const [bx0, by0, bx1, by1] = d.bbox;
          if (bx0 < minX) minX = bx0;
          if (by0 < minY) minY = by0;
          if (bx1 > maxX) maxX = bx1;
          if (by1 > maxY) maxY = by1;
        }
        const pad = 42;
        return {
          x: minX - pad,
          y: minY - pad,
          w: Math.max(180, maxX - minX + pad * 2),
          h: Math.max(150, maxY - minY + pad * 2),
        };
      }
    }

    return { x: 0, y: 0, w: 800, h: 1000 };
  }, [selectedUpazila, selectedDistrict, selectedDivisionId, upazilaMap, districtMap, districts]);

  // Native SVG viewBox zoom & pan for close-up maps
  const [localCam, setLocalCam] = useState<{ zoom: number; vx: number; vy: number }>({
    zoom: 1,
    vx: baseLocalBox.x,
    vy: baseLocalBox.y,
  });
  const localBoxRef = useRef<HTMLDivElement>(null);
  const localCamRef = useRef(localCam);
  localCamRef.current = localCam;
  const baseBoxRef = useRef(baseLocalBox);
  baseBoxRef.current = baseLocalBox;

  const localDragRef = useRef<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    scale: number;
    moved: boolean;
  } | null>(null);
  const localTouchRef = useRef<{
    mode: 'none' | 'pan' | 'pinch';
    sx: number;
    sy: number;
    svx: number;
    svy: number;
    dist: number;
    sz: number;
    svgMidX: number;
    svgMidY: number;
    scale: number;
    moved: boolean;
  }>({
    mode: 'none',
    sx: 0,
    sy: 0,
    svx: 0,
    svy: 0,
    dist: 1,
    sz: 1,
    svgMidX: 0,
    svgMidY: 0,
    scale: 1,
    moved: false,
  });

  useEffect(() => {
    setLocalCam({ zoom: 1, vx: baseLocalBox.x, vy: baseLocalBox.y });
    setHoveredLocalUpazilaId(null);
    setHoveredLocalDistrictId(null);
  }, [baseLocalBox]);

  const clampLocalCam = (z: number, vx: number, vy: number, box: LocalBox) => {
    const cz = Math.max(1, Math.min(6, Number(z.toFixed(3))));
    if (cz <= 1.01) {
      return { zoom: 1, vx: box.x, vy: box.y };
    }
    const vw = box.w / cz;
    const vh = box.h / cz;
    const mx = vw * 0.2;
    const my = vh * 0.2;
    return {
      zoom: cz,
      vx: Math.max(box.x - mx, Math.min(box.x + box.w - vw + mx, vx)),
      vy: Math.max(box.y - my, Math.min(box.y + box.h - vh + my, vy)),
    };
  };

  const getLocalProjection = (rect: DOMRect, cam: { zoom: number; vx: number; vy: number }, box: LocalBox) => {
    const vw = box.w / cam.zoom;
    const vh = box.h / cam.zoom;
    const scale = Math.min(rect.width / vw, rect.height / vh);
    const ox = (rect.width - vw * scale) / 2;
    const oy = (rect.height - vh * scale) / 2;
    return { vw, vh, scale, ox, oy };
  };

  useEffect(() => {
    const el = localBoxRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const box = baseBoxRef.current;
      const cur = localCamRef.current;
      let dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16;
      else if (e.deltaMode === 2) dy *= 240;
      const clampedDy = Math.max(-75, Math.min(75, dy));
      const factor = Math.exp(-clampedDy * 0.0046);
      const nextZ = Math.max(1, Math.min(6, Number((cur.zoom * factor).toFixed(3))));
      if (nextZ <= 1.01) {
        setLocalCam({ zoom: 1, vx: box.x, vy: box.y });
        return;
      }
      const proj = getLocalProjection(rect, cur, box);
      const svgX = cur.vx + (e.clientX - rect.left - proj.ox) / proj.scale;
      const svgY = cur.vy + (e.clientY - rect.top - proj.oy) / proj.scale;
      const nVw = box.w / nextZ;
      const nVh = box.h / nextZ;
      const nScale = Math.min(rect.width / nVw, rect.height / nVh);
      const nOx = (rect.width - nVw * nScale) / 2;
      const nOy = (rect.height - nVh * nScale) / 2;
      setLocalCam(
        clampLocalCam(
          nextZ,
          svgX - (e.clientX - rect.left - nOx) / nScale,
          svgY - (e.clientY - rect.top - nOy) / nScale,
          box
        )
      );
    };
    const onTouchStartNative = (e: TouchEvent) => {
      if (e.touches.length >= 2) e.preventDefault();
    };
    const onTouchMoveNative = (e: TouchEvent) => {
      if (e.touches.length >= 2 || localCamRef.current.zoom > 1.01) {
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
    };
  }, [selectedDistrictId, selectedUpazilaId, selectedDivisionId]);

  const localViewBoxStr = `${localCam.vx.toFixed(2)} ${localCam.vy.toFixed(2)} ${(
    baseLocalBox.w / localCam.zoom
  ).toFixed(2)} ${(baseLocalBox.h / localCam.zoom).toFixed(2)}`;
  const localZoom = localCam.zoom;

  const zoomLocalCenter = (factor: number) => {
    const box = baseLocalBox;
    const cur = localCamRef.current;
    const nextZ = Math.max(1, Math.min(6, Number((cur.zoom * factor).toFixed(3))));
    if (nextZ <= 1.01) {
      setLocalCam({ zoom: 1, vx: box.x, vy: box.y });
      return;
    }
    const oldVw = box.w / cur.zoom;
    const oldVh = box.h / cur.zoom;
    const centerX = cur.vx + oldVw / 2;
    const centerY = cur.vy + oldVh / 2;
    const nextVw = box.w / nextZ;
    const nextVh = box.h / nextZ;
    setLocalCam(clampLocalCam(nextZ, centerX - nextVw / 2, centerY - nextVh / 2, box));
  };

  const closeUpMapBoxHandlers = {
    onMouseDown: (e: React.MouseEvent<HTMLDivElement>) => {
      if (localCamRef.current.zoom <= 1.01 || e.button !== 0 || !localBoxRef.current) return;
      const proj = getLocalProjection(
        localBoxRef.current.getBoundingClientRect(),
        localCamRef.current,
        baseBoxRef.current
      );
      localDragRef.current = {
        x: e.clientX,
        y: e.clientY,
        vx: localCamRef.current.vx,
        vy: localCamRef.current.vy,
        scale: proj.scale,
        moved: false,
      };
    },
    onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => {
      if (!localDragRef.current) return;
      const dx = e.clientX - localDragRef.current.x;
      const dy = e.clientY - localDragRef.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) localDragRef.current.moved = true;
      setLocalCam(
        clampLocalCam(
          localCamRef.current.zoom,
          localDragRef.current.vx - dx / localDragRef.current.scale,
          localDragRef.current.vy - dy / localDragRef.current.scale,
          baseBoxRef.current
        )
      );
    },
    onMouseUp: () => {
      window.setTimeout(() => {
        localDragRef.current = null;
      }, 0);
    },
    onMouseLeave: () => {
      localDragRef.current = null;
      setHoveredLocalUpazilaId(null);
      setHoveredLocalDistrictId(null);
    },
    onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => {
      if (!localBoxRef.current) return;
      const rect = localBoxRef.current.getBoundingClientRect();
      const box = baseBoxRef.current;
      const cur = localCamRef.current;
      const proj = getLocalProjection(rect, cur, box);
      if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY
        );
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        localTouchRef.current = {
          mode: 'pinch',
          sx: mx,
          sy: my,
          svx: cur.vx,
          svy: cur.vy,
          dist: Math.max(1, dist),
          sz: cur.zoom,
          svgMidX: cur.vx + (mx - rect.left - proj.ox) / proj.scale,
          svgMidY: cur.vy + (my - rect.top - proj.oy) / proj.scale,
          scale: proj.scale,
          moved: true,
        };
      } else if (e.touches.length === 1 && cur.zoom > 1.01) {
        localTouchRef.current = {
          mode: 'pan',
          sx: e.touches[0].clientX,
          sy: e.touches[0].clientY,
          svx: cur.vx,
          svy: cur.vy,
          dist: 1,
          sz: cur.zoom,
          svgMidX: 0,
          svgMidY: 0,
          scale: proj.scale,
          moved: false,
        };
      } else {
        localTouchRef.current.mode = 'none';
        localTouchRef.current.moved = false;
      }
    },
    onTouchMove: (e: React.TouchEvent<HTMLDivElement>) => {
      const ts = localTouchRef.current;
      if (!localBoxRef.current) return;
      const rect = localBoxRef.current.getBoundingClientRect();
      const box = baseBoxRef.current;
      if (e.touches.length === 2 && ts.mode === 'pinch') {
        const dist = Math.hypot(
          e.touches[1].clientX - e.touches[0].clientX,
          e.touches[1].clientY - e.touches[0].clientY
        );
        const mx = (e.touches[0].clientX + e.touches[1].clientX) / 2;
        const my = (e.touches[0].clientY + e.touches[1].clientY) / 2;
        const nz = Math.max(1, Math.min(6, Number((ts.sz * (dist / ts.dist)).toFixed(3))));
        if (nz <= 1.01) {
          setLocalCam({ zoom: 1, vx: box.x, vy: box.y });
          return;
        }
        const nVw = box.w / nz;
        const nVh = box.h / nz;
        const nScale = Math.min(rect.width / nVw, rect.height / nVh);
        const nOx = (rect.width - nVw * nScale) / 2;
        const nOy = (rect.height - nVh * nScale) / 2;
        setLocalCam(
          clampLocalCam(
            nz,
            ts.svgMidX - (mx - rect.left - nOx) / nScale,
            ts.svgMidY - (my - rect.top - nOy) / nScale,
            box
          )
        );
      } else if (e.touches.length === 1 && ts.mode === 'pan') {
        const dx = e.touches[0].clientX - ts.sx;
        const dy = e.touches[0].clientY - ts.sy;
        if (Math.hypot(dx, dy) > 8) ts.moved = true;
        setLocalCam(
          clampLocalCam(
            localCamRef.current.zoom,
            ts.svx - dx / ts.scale,
            ts.svy - dy / ts.scale,
            box
          )
        );
      }
    },
    onTouchEnd: () => {
      window.setTimeout(() => {
        localTouchRef.current.mode = 'none';
        localTouchRef.current.moved = false;
      }, 0);
    },
  };

  // VIEW 1: Single Inspected River Full Course & Dossier
  if (activeInspectedRiver) {
    const riverDistricts = activeInspectedRiver.districts
      .map((did) => districtMap.get(did))
      .filter((d): d is GeoDistrict => Boolean(d));
    const riverUpazilas = upazilas.filter((u) => u.rivers.includes(activeInspectedRiver.id));
    const riverDetail = RIVER_DETAILS[activeInspectedRiver.id];
    const isFromSingleRiverFilter = Boolean(autoSingleFilterRiver);
    const showMultiRiverSwitcher =
      appliedRiverIds.length > 1 &&
      !selectedUpazila &&
      !selectedDistrict &&
      !selectedDivision;
    const switcherRivers = showMultiRiverSwitcher
      ? appliedRiverIds
          .map((rid) => riverMap.get(rid))
          .filter((r): r is GeoRiver => Boolean(r))
      : [];

    return (
      <aside className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 flex flex-col gap-5 transition-colors">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              if (isFromSingleRiverFilter) {
                onClearFilters();
              } else {
                onInspectRiver(null);
              }
            }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>
              {selectedUpazila
                ? lang === 'bn'
                  ? `${selectedUpazila.bnName} উপজেলায় ফিরুন`
                  : `Back to ${selectedUpazila.name}`
                : selectedDistrict
                ? lang === 'bn'
                  ? `${selectedDistrict.bnName} জেলায় ফিরুন`
                  : `Back to ${selectedDistrict.name}`
                : selectedDivision
                ? lang === 'bn'
                  ? `${selectedDivision.bnName} বিভাগে ফিরুন`
                  : `Back to ${selectedDivision.name} Division`
                : appliedRiverIds.length > 1
                ? lang === 'bn'
                  ? `নির্বাচিত ${formatNum(appliedRiverIds.length, lang)}টি নদ-নদীতে ফিরুন`
                  : `Back to ${appliedRiverIds.length} Selected Rivers`
                : lang === 'bn'
                ? 'ফিল্টার / মানচিত্রে ফিরুন'
                : 'Back to Map'}
            </span>
          </button>
          {(selectedDistrict || selectedUpazila || selectedDivision || appliedRiverIds.length > 0) && (
            <button
              type="button"
              onClick={() => {
                onSelectUpazila(null);
                onSelectDistrict(null);
                onSelectDivision(null);
                onInspectRiver(null);
                onClearFilters();
              }}
              className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:underline whitespace-nowrap"
            >
              {lang === 'bn' ? 'রিসেট' : 'Reset'}
            </button>
          )}
        </div>

        {showMultiRiverSwitcher && switcherRivers.length > 1 && (
          <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 mb-1.5">
              {lang === 'bn'
                ? `নির্বাচিত নদ-নদীসমূহ (${formatNum(switcherRivers.length, lang)}টি):`
                : `Selected Rivers (${switcherRivers.length}):`}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {switcherRivers.map((sr) => {
                const isActive = sr.id === activeInspectedRiver.id;
                return (
                  <button
                    key={`sw-${sr.id}`}
                    type="button"
                    onClick={() => onInspectRiver(sr.id)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                      isActive
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-sky-50 dark:hover:bg-sky-950/50'
                    }`}
                  >
                    {lang === 'bn' ? sr.bnName : sr.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

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
            {lang === 'bn'
              ? `${activeInspectedRiver.bnName} নদী`
              : `${activeInspectedRiver.name} River`}
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 font-mono-tabular">
            {lang === 'bn' ? activeInspectedRiver.name : activeInspectedRiver.bnName} · ~
            {formatNum(activeInspectedRiver.lengthKm, lang)}{' '}
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
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2.5">
            {lang === 'bn'
              ? `প্রবাহিত জেলাসমূহ (${formatNum(riverDistricts.length, lang)}টি)`
              : `Districts Along This River (${riverDistricts.length})`}
          </h3>
          <div className="grid grid-cols-2 gap-1.5">
            {riverDistricts.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => {
                  onInspectRiver(null);
                  onSelectDistrict(d.id);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-50/70 dark:bg-slate-800/50 hover:bg-sky-50 dark:hover:bg-sky-950/50 border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 text-xs font-medium text-slate-800 dark:text-slate-200 text-left transition-colors truncate"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 shrink-0" />
                <span className="truncate">{lang === 'bn' ? d.bnName : d.name}</span>
              </button>
            ))}
          </div>
        </div>

        {riverUpazilas.length > 0 && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2.5">
              {lang === 'bn'
                ? `প্রবাহিত উপজেলাসমূহ (${formatNum(riverUpazilas.length, lang)}টি)`
                : `Upazilas Along This River (${riverUpazilas.length})`}
            </h3>
            <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
              {riverUpazilas.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => {
                    onInspectRiver(null);
                    onSelectUpazila(u.id);
                  }}
                  className="px-2.5 py-1.5 rounded-md bg-slate-50/70 dark:bg-slate-800/50 hover:bg-sky-50 dark:hover:bg-sky-950/50 border border-slate-200 dark:border-slate-800 hover:border-sky-300 dark:hover:border-sky-700 text-xs font-medium text-slate-800 dark:text-slate-200 text-left truncate transition-colors"
                >
                  {lang === 'bn' ? u.bnName : u.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </aside>
    );
  }

  // VIEW 2: Selected Upazila Close-up Map & Full Dossier (Full Feature Parity with District)
  if (selectedUpazila) {
    const parentDist = districtMap.get(selectedUpazila.districtId);
    const parentDiv = divisionMap.get(selectedUpazila.divisionId);
    const divMeta = DIVISION_META[selectedUpazila.divisionId];

    if (parentDist && parentDiv) {
      const upazilaRivers = selectedUpazila.rivers
        .map((rid) => riverMap.get(rid))
        .filter((r): r is GeoRiver => Boolean(r));
      const parentDistrictUpazilas = upazilas.filter((u) => u.districtId === parentDist.id);
      const uNeighborSet = new Set(selectedUpazila.neighbors);
      const neighborUpazilas = selectedUpazila.neighbors
        .map((uid) => upazilaMap.get(uid))
        .filter((u): u is GeoUpazila => Boolean(u));
      const crossDistIds = Array.from(
        new Set(
          neighborUpazilas
            .filter((nu) => nu.districtId !== selectedUpazila.districtId)
            .map((nu) => nu.districtId)
        )
      );
      const upazilaDetail = getUpazilaDetail(
        selectedUpazila,
        parentDist,
        parentDiv,
        upazilaRivers.map((r) => r.bnName),
        upazilaRivers.map((r) => r.name),
        {
          districtUpazilas: parentDistrictUpazilas,
          crossDistrictNamesBn: crossDistIds
            .map((id) => districtMap.get(id)?.bnName)
            .filter((n): n is string => Boolean(n)),
          crossDistrictNamesEn: crossDistIds
            .map((id) => districtMap.get(id)?.name)
            .filter((n): n is string => Boolean(n)),
        }
      );
      const upazilaPop = selectedUpazila.population || 0;
      const upazilaDensity =
        selectedUpazila.areaKm2 > 0 ? Math.round(upazilaPop / selectedUpazila.areaKm2) : 0;

      const localScale = baseLocalBox.w / 240;

      return (
        <aside className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 flex flex-col gap-5 transition-colors">
          {/* Top Navigation */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => onSelectDistrict(parentDist.id)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>
                {lang === 'bn'
                  ? `${parentDist.bnName} জেলায় ফিরুন`
                  : `Back to ${parentDist.name} District`}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSelectUpazila(null);
                onSelectDistrict(null);
              }}
              className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
            >
              {lang === 'bn' ? 'পূর্ণ মানচিত্র' : 'Full Map'}
            </button>
          </div>

          {/* Breadcrumb & Title */}
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={() => onSelectDivision(parentDiv.id)}
                className="text-emerald-700 dark:text-emerald-400 hover:underline font-medium"
              >
                {lang === 'bn' ? `${divMeta?.bnName} বিভাগ` : `${divMeta?.name} Division`}
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                onClick={() => onSelectDistrict(parentDist.id)}
                className="text-emerald-700 dark:text-emerald-400 hover:underline font-medium"
              >
                {lang === 'bn' ? `${parentDist.bnName} জেলা` : `${parentDist.name} District`}
              </button>
              <span aria-hidden="true">·</span>
              <span>{lang === 'bn' ? upazilaDetail.directionLabelBn : upazilaDetail.directionLabelEn}</span>
            </div>

            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1.5 tracking-tight">
              {lang === 'bn'
                ? `${selectedUpazila.bnName} ${upazilaDetail.isUrbanThana ? '(থানা)' : 'উপজেলা'}`
                : `${selectedUpazila.name} ${upazilaDetail.isUrbanThana ? 'Thana' : 'Upazila'}`}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {lang === 'bn' ? selectedUpazila.name : selectedUpazila.bnName}
            </p>
          </div>

          {/* Dedicated Close-Up Map of Selected Upazila & Bordering Neighbors */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-[#F4F8FA] dark:bg-[#0B1220] overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                {lang === 'bn'
                  ? `${selectedUpazila.bnName} ও পার্শ্ববর্তী উপজেলার মানচিত্র`
                  : `${selectedUpazila.name} & Bordering Upazilas`}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => zoomLocalCenter(1 / 1.4)}
                  disabled={localZoom <= 1.01}
                  aria-label={lang === 'bn' ? 'জুম কমান' : 'Zoom out'}
                  className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => zoomLocalCenter(1.45)}
                  disabled={localZoom >= 6}
                  aria-label={lang === 'bn' ? 'জুম বাড়ান' : 'Zoom in'}
                  className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                {localZoom > 1.01 && (
                  <button
                    type="button"
                    onClick={() =>
                      setLocalCam({ zoom: 1, vx: baseLocalBox.x, vy: baseLocalBox.y })
                    }
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
              {...closeUpMapBoxHandlers}
              className={`overflow-hidden select-none ${
                localZoom > 1.01 ? 'touch-none cursor-grab active:cursor-grabbing' : 'touch-pan-y'
              }`}
            >
              <svg
                viewBox={localViewBoxStr}
                preserveAspectRatio="xMidYMid meet"
                className="w-full h-56 sm:h-60 block"
                role="img"
                aria-label={
                  lang === 'bn'
                    ? `${selectedUpazila.bnName} এবং তার পার্শ্ববর্তী উপজেলাসমূহের মানচিত্র`
                    : `Close-up map of ${selectedUpazila.name} and bordering upazilas`
                }
              >
                {upazilas.map((u) => {
                  const isSel = u.id === selectedUpazila.id;
                  const isNbr = uNeighborSet.has(u.id);
                  if (
                    !isSel &&
                    !isNbr &&
                    Math.abs(u.cx - selectedUpazila.cx) > baseLocalBox.w * 1.1
                  ) {
                    return null;
                  }
                  const fill = isSel
                    ? isDark
                      ? '#059669'
                      : '#047857'
                    : isNbr
                    ? isDark
                      ? '#78350F'
                      : '#FDE68A'
                    : isDark
                    ? '#141D2E'
                    : '#E2E8F0';
                  const stroke = isSel
                    ? isDark
                      ? '#6EE7B7'
                      : '#064E3B'
                    : isNbr
                    ? isDark
                      ? '#F59E0B'
                      : '#B45309'
                    : isDark
                    ? '#334155'
                    : '#CBD5E1';
                  return (
                    <path
                      key={`local-u-${u.id}`}
                      d={u.path}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={((isSel ? 1.8 : isNbr ? 1.2 : 0.6) * localScale) / Math.sqrt(localZoom)}
                      strokeLinejoin="round"
                      opacity={isSel || isNbr ? 1 : 0.45}
                      className={isNbr ? 'cursor-pointer hover:opacity-90' : ''}
                      onClick={() => {
                        if (localDragRef.current?.moved || localTouchRef.current.moved) return;
                        if (isNbr) onSelectUpazila(u.id);
                      }}
                    />
                  );
                })}

                {/* Rivers flowing through the selected upazila */}
                {upazilaRivers.map((r) => (
                  <g key={`local-u-river-${r.id}`} className="pointer-events-none">
                    <path
                      d={r.path}
                      fill="none"
                      stroke={isDark ? '#0B1220' : '#FFFFFF'}
                      strokeWidth={3.2 * localScale}
                      strokeLinecap="round"
                      strokeOpacity={0.85}
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

                {/* Collision-Culled Labels for Selected Upazila & Neighbors */}
                {(() => {
                  const placedBoxes: [number, number, number, number][] = [];
                  const candidates = [
                    selectedUpazila,
                    ...neighborUpazilas.slice().sort((a, b) => b.areaKm2 - a.areaKm2),
                  ];
                  const zScale = Math.pow(localZoom, 0.72);
                  return candidates.map((u) => {
                    const isSel = u.id === selectedUpazila.id;
                    const fs = ((isSel ? 9.2 : 7.0) * localScale) / zScale;
                    const text = lang === 'bn' ? u.bnName : u.name;
                    const hw = (text.length * fs * 0.56 + fs * 0.7) / 2;
                    const hh = (fs * 1.42) / 2;
                    const box: [number, number, number, number] = [
                      u.cx - hw,
                      u.cy - hh,
                      u.cx + hw,
                      u.cy + hh,
                    ];
                    const collides =
                      !isSel &&
                      placedBoxes.some(
                        (b) => b[0] < box[2] && b[2] > box[0] && b[1] < box[3] && b[3] > box[1]
                      );
                    if (collides) return null;
                    placedBoxes.push(box);

                    return (
                      <text
                        key={`local-u-lbl-${u.id}`}
                        x={u.cx}
                        y={u.cy}
                        textAnchor="middle"
                        dominantBaseline="central"
                        fontSize={fs}
                        fontWeight={isSel ? '700' : '600'}
                        fill={
                          isSel
                            ? '#FFFFFF'
                            : isDark
                            ? '#FDE68A'
                            : '#78350F'
                        }
                        stroke={
                          isSel
                            ? '#064E3B'
                            : isDark
                            ? '#451A03'
                            : '#FFFFFF'
                        }
                        strokeWidth={(2.1 * localScale) / zScale}
                        style={{ paintOrder: 'stroke' }}
                        className="pointer-events-none select-none"
                      >
                        {text}
                      </text>
                    );
                  });
                })()}
              </svg>
            </div>
          </div>

          {/* Key Stats Grid (Aligned Baseline + Population) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-col justify-between">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'আয়তন' : 'Area'}
              </div>
              <div className="font-mono-tabular text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {formatNum(selectedUpazila.areaKm2, lang)} {lang === 'bn' ? 'কিমি²' : 'km²'}
              </div>
            </div>
            <div className="flex flex-col justify-between">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'জনসংখ্যা' : 'Population'}
              </div>
              <div className="font-mono-tabular text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {formatNum(upazilaPop, lang)}
              </div>
            </div>
            <div className="flex flex-col justify-between">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'জনঘনত্ব' : 'Density'}
              </div>
              <div className="font-mono-tabular text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {formatNum(upazilaDensity, lang)} /{lang === 'bn' ? 'কিমি²' : 'km²'}
              </div>
            </div>
            <div className="flex flex-col justify-between">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'মূল জেলা' : 'District'}
              </div>
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate">
                {lang === 'bn' ? parentDist.bnName : parentDist.name}
              </div>
            </div>
            <div className="flex flex-col justify-between">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'পার্শ্ববর্তী উপজেলা' : 'Neighbors'}
              </div>
              <div className="font-mono-tabular text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {formatNum(neighborUpazilas.length, lang)}
              </div>
            </div>
            <div className="flex flex-col justify-between">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'প্রধান নদ-নদী' : 'Major Rivers'}
              </div>
              <div className="font-mono-tabular text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {formatNum(upazilaRivers.length, lang)}
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
                {lang === 'bn' ? upazilaDetail.famousForBn : upazilaDetail.famousForEn}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                {lang === 'bn' ? upazilaDetail.summaryBn : upazilaDetail.summaryEn}
              </p>
            </div>

            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5 text-sm">
              <div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'bn' ? 'বিখ্যাত পণ্য, খাবার ও কৃষি' : 'Specialties & Produce'}
                </div>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                  {lang === 'bn' ? upazilaDetail.specialtiesBn : upazilaDetail.specialtiesEn}
                </p>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'bn' ? 'ইতিহাস ও অর্থনীতি' : 'History & Economy'}
                </div>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                  {lang === 'bn' ? upazilaDetail.historyEconomyBn : upazilaDetail.historyEconomyEn}
                </p>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'bn' ? 'প্রধান যোগাযোগ ব্যবস্থা' : 'Connectivity & Gateways'}
                </div>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                  {lang === 'bn' ? upazilaDetail.connectivityBn : upazilaDetail.connectivityEn}
                </p>
              </div>
            </div>
          </div>

          {/* Interesting Facts */}
          {(lang === 'bn' ? upazilaDetail.interestingFactsBn : upazilaDetail.interestingFactsEn).length > 0 && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2.5">
                {lang === 'bn' ? 'মজার ও গুরুত্বপূর্ণ তথ্য' : 'Interesting Facts'}
              </h3>
              <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                {(lang === 'bn' ? upazilaDetail.interestingFactsBn : upazilaDetail.interestingFactsEn).map((fact) => (
                  <li key={fact} className="flex items-start gap-2 leading-relaxed">
                    <Info className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 mt-1 shrink-0" />
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Bordering / Adjacent Upazilas — Clean Minimalist 2-Column List */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2.5">
              {lang === 'bn'
                ? `পার্শ্ববর্তী উপজেলা (${formatNum(neighborUpazilas.length, lang)})`
                : `Bordering Upazilas (${neighborUpazilas.length})`}
            </h3>

            {neighborUpazilas.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {neighborUpazilas.map((nu) => {
                  const nuDist = districtMap.get(nu.districtId);
                  const isCrossDist = nu.districtId !== selectedUpazila.districtId;
                  return (
                    <button
                      key={nu.id}
                      type="button"
                      onClick={() => onSelectUpazila(nu.id)}
                      className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-slate-50/70 dark:bg-slate-800/45 hover:bg-amber-50/80 dark:hover:bg-amber-950/35 border border-slate-200 dark:border-slate-800 hover:border-amber-400/80 dark:hover:border-amber-600/80 text-xs text-left transition-colors"
                    >
                      <span className="flex items-center gap-2 min-w-0 font-medium text-slate-800 dark:text-slate-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                        <span className="truncate">{lang === 'bn' ? nu.bnName : nu.name}</span>
                      </span>
                      {isCrossDist && nuDist && (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                          {lang === 'bn' ? nuDist.bnName : nuDist.name}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn'
                  ? 'এটি একটি বিচ্ছিন্ন দ্বীপ উপজেলা; স্থলসীমান্তে কোনো পার্শ্ববর্তী উপজেলা নেই।'
                  : 'Offshore island upazila with no contiguous land neighbors.'}
              </p>
            )}
          </div>

          {/* Flowing Rivers Through Selected Upazila */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {lang === 'bn'
                  ? `প্রবাহিত নদী — প্রধান ৩০টির মধ্যে (${formatNum(upazilaRivers.length, lang)})`
                  : `Major Rivers Flowing Through (${upazilaRivers.length} of 30)`}
              </h3>
              {upazilaRivers.length > 0 && (
                <span className="text-[11px] text-sky-700 dark:text-sky-400 font-medium">
                  {lang === 'bn' ? 'পূর্ণ গতিপথ দেখতে ক্লিক করুন' : 'Click for full course'}
                </span>
              )}
            </div>

            {upazilaRivers.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
                {upazilaRivers.map((r) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onInspectRiver(r.id)}
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
                            ? `${formatNum(r.districts.length, lang)}টি জেলার ওপর দিয়ে প্রবাহিত`
                            : `Flows across ${r.districts.length} districts`}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="font-mono-tabular text-xs text-slate-600 dark:text-slate-300">
                        ~{formatNum(r.lengthKm, lang)} {lang === 'bn' ? 'কিমি' : 'km'}
                      </span>
                      <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn'
                  ? 'এই উপজেলার মধ্য দিয়ে তালিকাভুক্ত ৩০টি প্রধান নদ-নদীর কোনোটি সরাসরি অতিক্রম করেনি; আঞ্চলিক খাল ও নদী দ্বারা সেচ ও নিষ্কাশন চলে।'
                  : 'None of the 30 mapped major rivers directly intersect this upazila; local tributaries and canals serve the area.'}
              </p>
            )}
          </div>

          {/* Notable Landmarks */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2.5">
              {lang === 'bn' ? 'উল্লেখযোগ্য দর্শনীয় স্থান ও ঐতিহ্য' : 'Notable Landmarks & Heritage'}
            </h3>
            <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
              {(lang === 'bn' ? upazilaDetail.landmarksBn : upazilaDetail.landmarksEn).map((lm) => (
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
  }

  // VIEW 3: Selected District Map (with Clickable Upazilas inside!) + Enriched Dossier
  if (selectedDistrict && detail && division) {
    const neighborSet = new Set(selectedDistrict.neighbors);
    const neighborDistricts = selectedDistrict.neighbors
      .map((nid) => districtMap.get(nid))
      .filter((n): n is GeoDistrict => Boolean(n));

    const localScale = baseLocalBox.w / 240;

    return (
      <aside className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 flex flex-col gap-5 transition-colors">
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              onSelectDistrict(null);
              onInspectRiver(null);
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

        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{lang === 'bn' ? `${division.bnName} বিভাগ` : `${division.name} Division`}</span>
            <span aria-hidden="true">·</span>
            <span>{lang === 'bn' ? detail.directionLabelBn : detail.directionLabelEn}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular">
              {lang === 'bn'
                ? `প্রতিষ্ঠা ${toBnDigits(detail.established)}`
                : `Est. ${detail.established}`}
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

        {/* Dedicated Close-Up Map of Selected District (with Clickable Upazilas inside!) */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-[#F4F8FA] dark:bg-[#0B1220] overflow-hidden">
          <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-xs">
            <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
              {hoveredLocalUpazilaId
                ? (() => {
                    const hu = upazilaMap.get(hoveredLocalUpazilaId);
                    return hu
                      ? lang === 'bn'
                        ? `উপজেলা: ${hu.bnName} (${hu.name})`
                        : `Upazila: ${hu.name}`
                      : '';
                  })()
                : lang === 'bn'
                ? `${selectedDistrict.bnName} জেলার উপজেলা ও পার্শ্ববর্তী জেলা`
                : `${selectedDistrict.name} Upazilas & Bordering Districts`}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => zoomLocalCenter(1 / 1.4)}
                disabled={localZoom <= 1.01}
                aria-label={lang === 'bn' ? 'জুম কমান' : 'Zoom out'}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => zoomLocalCenter(1.45)}
                disabled={localZoom >= 6}
                aria-label={lang === 'bn' ? 'জুম বাড়ান' : 'Zoom in'}
                className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              {localZoom > 1.01 && (
                <button
                  type="button"
                  onClick={() =>
                    setLocalCam({ zoom: 1, vx: baseLocalBox.x, vy: baseLocalBox.y })
                  }
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
            {...closeUpMapBoxHandlers}
            className={`overflow-hidden select-none ${
              localZoom > 1.01 ? 'touch-none cursor-grab active:cursor-grabbing' : 'touch-pan-y'
            }`}
          >
            <svg
              viewBox={localViewBoxStr}
              preserveAspectRatio="xMidYMid meet"
              className="w-full h-56 sm:h-60 block"
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
                        onInspectRiver(null);
                        onSelectDistrict(d.id);
                      }
                    }}
                  />
                );
              })}

              {/* Interactive Upazilas inside Selected District */}
              {districtUpazilas.map((u) => {
                const isHoveredU = u.id === hoveredLocalUpazilaId;
                return (
                  <path
                    key={`local-dist-u-${u.id}`}
                    d={u.path}
                    fill={isHoveredU ? (isDark ? '#10B981' : '#059669') : 'transparent'}
                    fillOpacity={isHoveredU ? 0.85 : 0}
                    stroke={isDark ? '#A7F3D0' : '#ECFDF5'}
                    strokeWidth={((isHoveredU ? 1.15 : 0.65) * localScale) / Math.sqrt(localZoom)}
                    strokeOpacity={isHoveredU ? 0.95 : 0.6}
                    strokeLinejoin="round"
                    className="cursor-pointer"
                    onMouseEnter={() => setHoveredLocalUpazilaId(u.id)}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (localDragRef.current?.moved || localTouchRef.current.moved) return;
                      onSelectUpazila(u.id);
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

        {/* Key Numeric Stats Grid (Aligned Tabular Numerals) */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-col justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'bn' ? 'আয়তন' : 'Area'}
            </div>
            <div className="font-mono-tabular text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
              {formatNum(detail.areaKm2, lang)} {lang === 'bn' ? 'কিমি²' : 'km²'}
            </div>
          </div>
          <div className="flex flex-col justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'bn' ? 'জনসংখ্যা' : 'Population'}
            </div>
            <div className="font-mono-tabular text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
              {formatNum(detail.population, lang)}
            </div>
          </div>
          <div className="flex flex-col justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'bn' ? 'উপজেলা / থানা' : 'Upazilas'}
            </div>
            <div className="font-mono-tabular text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
              {formatNum(districtUpazilas.length, lang)}
            </div>
          </div>
          <div className="flex flex-col justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'bn' ? 'প্রতিষ্ঠা' : 'Founded'}
            </div>
            <div className="font-mono-tabular text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
              {lang === 'bn' ? toBnDigits(detail.established) : detail.established}
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

        {/* Interesting Facts */}
        {(lang === 'bn' ? detail.interestingFactsBn : detail.interestingFactsEn).length > 0 && (
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2.5">
              {lang === 'bn' ? 'মজার ও গুরুত্বপূর্ণ তথ্য' : 'Interesting Facts'}
            </h3>
            <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
              {(lang === 'bn' ? detail.interestingFactsBn : detail.interestingFactsEn).map((fact) => (
                <li key={fact} className="flex items-start gap-2 leading-relaxed">
                  <Info className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 mt-1 shrink-0" />
                  <span>{fact}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Upazilas / Thanas inside Selected District — Clean Minimalist Grid */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2.5">
            {lang === 'bn'
              ? `উপজেলা ও থানা (${formatNum(districtUpazilas.length, lang)})`
              : `Upazilas & Thanas (${districtUpazilas.length})`}
          </h3>
          <div className="grid grid-cols-2 gap-1.5 max-h-52 overflow-y-auto pr-1">
            {districtUpazilas.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => onSelectUpazila(u.id)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-50/70 dark:bg-slate-800/45 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/45 border border-slate-200 dark:border-slate-800 hover:border-emerald-400/80 dark:hover:border-emerald-700 text-xs font-medium text-slate-800 dark:text-slate-200 text-left transition-colors truncate"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
                <span className="truncate">{lang === 'bn' ? u.bnName : u.name}</span>
              </button>
            ))}
          </div>

          {districtUpazilas.length >= 2 && (() => {
            const byPop = [...districtUpazilas].sort((a, b) => (b.population || 0) - (a.population || 0));
            const byArea = [...districtUpazilas].sort((a, b) => b.areaKm2 - a.areaKm2);
            const maxPopU = byPop[0];
            const minPopU = byPop[byPop.length - 1];
            const maxAreaU = byArea[0];
            const minAreaU = byArea[byArea.length - 1];
            const extremes = [
              {
                key: 'max-pop',
                label: lang === 'bn' ? 'সর্বোচ্চ জনসংখ্যা' : 'Highest Population',
                u: maxPopU,
                val: formatNum(maxPopU.population || 0, lang),
              },
              {
                key: 'min-pop',
                label: lang === 'bn' ? 'সর্বনিম্ন জনসংখ্যা' : 'Lowest Population',
                u: minPopU,
                val: formatNum(minPopU.population || 0, lang),
              },
              {
                key: 'max-area',
                label: lang === 'bn' ? 'সর্ববৃহৎ আয়তন' : 'Largest Land Area',
                u: maxAreaU,
                val: `${formatNum(maxAreaU.areaKm2, lang)} ${lang === 'bn' ? 'কিমি²' : 'km²'}`,
              },
              {
                key: 'min-area',
                label: lang === 'bn' ? 'ক্ষুদ্রতম আয়তন' : 'Smallest Land Area',
                u: minAreaU,
                val: `${formatNum(minAreaU.areaKm2, lang)} ${lang === 'bn' ? 'কিমি²' : 'km²'}`,
              },
            ];
            return (
              <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                  {lang === 'bn'
                    ? 'উপজেলা পরিসংখ্যান (শীর্ষ ও সর্বনিম্ন)'
                    : 'Upazila Extremes (Population & Area)'}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {extremes.map((ex) => (
                    <button
                      key={ex.key}
                      type="button"
                      onClick={() => onSelectUpazila(ex.u.id)}
                      className="flex flex-col justify-between p-2.5 rounded-lg bg-slate-50/75 dark:bg-slate-800/45 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-800 hover:border-emerald-400/80 dark:hover:border-emerald-700 text-left transition-colors"
                    >
                      <span className="text-[11px] text-slate-500 dark:text-slate-400">
                        {ex.label}
                      </span>
                      <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate w-full">
                        {lang === 'bn' ? ex.u.bnName : ex.u.name}
                      </span>
                      <span className="font-mono-tabular text-[11px] font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">
                        {ex.val}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Bordering / Adjacent Districts — Clean Minimalist Grid */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2.5">
            {lang === 'bn'
              ? `পার্শ্ববর্তী জেলা (${formatNum(neighborDistricts.length, lang)})`
              : `Bordering Districts (${neighborDistricts.length})`}
          </h3>

          <div className="grid grid-cols-2 gap-1.5">
            {neighborDistricts.map((n) => (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  onInspectRiver(null);
                  onSelectDistrict(n.id);
                }}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-50/70 dark:bg-slate-800/45 hover:bg-amber-50/80 dark:hover:bg-amber-950/35 border border-slate-200 dark:border-slate-800 hover:border-amber-400/80 dark:hover:border-amber-600/80 text-xs font-medium text-slate-800 dark:text-slate-200 text-left transition-colors truncate"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                <span className="truncate">{lang === 'bn' ? n.bnName : n.name}</span>
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
          <div className="flex items-center justify-between mb-2.5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {lang === 'bn'
                ? `প্রবাহিত নদী — প্রধান ৩০টির মধ্যে (${formatNum(districtRivers.length, lang)})`
                : `Major Rivers Flowing Through (${districtRivers.length} of 30)`}
            </h3>
            <span className="text-[11px] text-sky-700 dark:text-sky-400 font-medium">
              {lang === 'bn' ? 'পূর্ণ গতিপথ দেখতে ক্লিক করুন' : 'Click for full course'}
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
            {districtRivers.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onInspectRiver(r.id)}
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
                        ? `${formatNum(r.districts.length, lang)}টি জেলার ওপর দিয়ে প্রবাহিত`
                        : `Flows across ${r.districts.length} districts`}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono-tabular text-xs text-slate-600 dark:text-slate-300">
                    ~{formatNum(r.lengthKm, lang)} {lang === 'bn' ? 'কিমি' : 'km'}
                  </span>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Notable Landmarks */}
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

  // VIEW 3B: Selected Division Close-Up Map & Full Dossier (Full Feature Parity)
  if (selectedDivision && appliedDirections.length === 0 && appliedRiverIds.length === 0) {
    const divMeta = DIVISION_META[selectedDivision.id];
    if (divMeta) {
      const divNeighborSet = new Set(divMeta.neighbors);
      const neighborDivisions = divMeta.neighbors
        .map((id) => divisionMap.get(id))
        .filter((d): d is GeoDivision => Boolean(d));
      const divDistricts = districts
        .filter((d) => d.divisionId === selectedDivision.id)
        .sort((a, b) => a.name.localeCompare(b.name));
      const divUpazilaCount = upazilas.filter((u) => u.divisionId === selectedDivision.id).length;
      const divRivers = rivers.filter((r) =>
        r.districts.some((did) => districtMap.get(did)?.divisionId === selectedDivision.id)
      );
      const localScale = baseLocalBox.w / 260;

      return (
        <aside className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 flex flex-col gap-5 transition-colors">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => onSelectDivision(null)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{lang === 'bn' ? 'বাংলাদেশের পূর্ণ মানচিত্রে ফিরুন' : 'Back to Bangladesh Map'}</span>
            </button>

            <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              {lang === 'bn' ? 'বিভাগ তথ্য' : 'Division Dossier'}
            </span>
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>{lang === 'bn' ? divMeta.directionBn : divMeta.directionEn}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular">
                {lang === 'bn'
                  ? `প্রতিষ্ঠা ${toBnDigits(divMeta.established)}`
                  : `Est. ${divMeta.established}`}
              </span>
            </div>

            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1.5 tracking-tight">
              {lang === 'bn' ? `${divMeta.bnName} বিভাগ` : `${divMeta.name} Division`}
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              {lang === 'bn' ? `${divMeta.name} Division` : `${divMeta.bnName} বিভাগ`}
            </p>
          </div>

          {/* Dedicated Close-Up Map of Selected Division (with Clickable Districts & Neighboring Divisions) */}
          <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-[#F4F8FA] dark:bg-[#0B1220] overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 text-xs">
              <span className="font-medium text-slate-700 dark:text-slate-200 truncate">
                {hoveredLocalDistrictId
                  ? (() => {
                      const hd = districtMap.get(hoveredLocalDistrictId);
                      return hd
                        ? lang === 'bn'
                          ? `জেলা: ${hd.bnName} (${hd.name})`
                          : `District: ${hd.name}`
                        : '';
                    })()
                  : lang === 'bn'
                  ? `${divMeta.bnName} বিভাগের জেলা ও পার্শ্ববর্তী বিভাগ`
                  : `${divMeta.name} Division Districts & Bordering Divisions`}
              </span>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => zoomLocalCenter(1 / 1.4)}
                  disabled={localZoom <= 1.01}
                  aria-label={lang === 'bn' ? 'জুম কমান' : 'Zoom out'}
                  className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => zoomLocalCenter(1.45)}
                  disabled={localZoom >= 6}
                  aria-label={lang === 'bn' ? 'জুম বাড়ান' : 'Zoom in'}
                  className="w-7 h-7 flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 disabled:opacity-40"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                {localZoom > 1.01 && (
                  <button
                    type="button"
                    onClick={() =>
                      setLocalCam({ zoom: 1, vx: baseLocalBox.x, vy: baseLocalBox.y })
                    }
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
              {...closeUpMapBoxHandlers}
              className={`overflow-hidden select-none ${
                localZoom > 1.01 ? 'touch-none cursor-grab active:cursor-grabbing' : 'touch-pan-y'
              }`}
            >
              <svg
                viewBox={localViewBoxStr}
                preserveAspectRatio="xMidYMid meet"
                className="w-full h-56 sm:h-64 block"
                role="img"
                aria-label={
                  lang === 'bn'
                    ? `${divMeta.bnName} বিভাগ এবং পার্শ্ববর্তী বিভাগসমূহের মানচিত্র`
                    : `Close-up map of ${divMeta.name} Division and bordering divisions`
                }
              >
                {divisions.map((dv) => {
                  const isSel = dv.id === selectedDivision.id;
                  const isNbr = divNeighborSet.has(dv.id);
                  const fill = isSel
                    ? isDark
                      ? '#059669'
                      : '#047857'
                    : isNbr
                    ? isDark
                      ? '#78350F'
                      : '#FDE68A'
                    : isDark
                    ? '#141D2E'
                    : '#E2E8F0';
                  const stroke = isSel
                    ? isDark
                      ? '#6EE7B7'
                      : '#064E3B'
                    : isNbr
                    ? isDark
                      ? '#F59E0B'
                      : '#B45309'
                    : isDark
                    ? '#334155'
                    : '#CBD5E1';
                  return (
                    <path
                      key={`local-div-${dv.id}`}
                      d={dv.path}
                      fill={fill}
                      stroke={stroke}
                      strokeWidth={((isSel ? 1.8 : isNbr ? 1.2 : 0.6) * localScale) / Math.sqrt(localZoom)}
                      strokeLinejoin="round"
                      opacity={isSel || isNbr ? 1 : 0.45}
                      className={isNbr ? 'cursor-pointer hover:opacity-90' : ''}
                      onClick={() => {
                        if (localDragRef.current?.moved || localTouchRef.current.moved) return;
                        if (isNbr) onSelectDivision(dv.id);
                      }}
                    />
                  );
                })}

                {/* Interactive Districts inside Selected Division */}
                {divDistricts.map((d) => {
                  const isHoveredD = d.id === hoveredLocalDistrictId;
                  return (
                    <path
                      key={`local-div-d-${d.id}`}
                      d={d.path}
                      fill={isHoveredD ? (isDark ? '#10B981' : '#059669') : 'transparent'}
                      fillOpacity={isHoveredD ? 0.85 : 0}
                      stroke={isDark ? '#A7F3D0' : '#ECFDF5'}
                      strokeWidth={((isHoveredD ? 1.2 : 0.7) * localScale) / Math.sqrt(localZoom)}
                      strokeOpacity={isHoveredD ? 0.95 : 0.65}
                      strokeLinejoin="round"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredLocalDistrictId(d.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (localDragRef.current?.moved || localTouchRef.current.moved) return;
                        onSelectDistrict(d.id);
                      }}
                    />
                  );
                })}

                {/* Flowing Rivers across the Division */}
                {divRivers.map((r) => (
                  <g key={`local-div-river-${r.id}`} className="pointer-events-none">
                    <path
                      d={r.path}
                      fill="none"
                      stroke={isDark ? '#0B1220' : '#FFFFFF'}
                      strokeWidth={2.8 * localScale}
                      strokeLinecap="round"
                      strokeOpacity={0.8}
                    />
                    <path
                      d={r.path}
                      fill="none"
                      stroke={isDark ? '#38BDF8' : '#0284C7'}
                      strokeWidth={1.5 * localScale}
                      strokeLinecap="round"
                    />
                  </g>
                ))}

                {/* Labels for Selected Division & Neighbors */}
                {[selectedDivision, ...neighborDivisions].map((dv) => {
                  const isSel = dv.id === selectedDivision.id;
                  return (
                    <text
                      key={`local-div-lbl-${dv.id}`}
                      x={dv.cx}
                      y={dv.cy}
                      textAnchor="middle"
                      dominantBaseline="central"
                      fontSize={((isSel ? 9.6 : 7.6) * localScale) / Math.pow(localZoom, 0.55)}
                      fontWeight={isSel ? '700' : '600'}
                      fill={
                        isSel
                          ? '#FFFFFF'
                          : isDark
                          ? '#FDE68A'
                          : '#78350F'
                      }
                      stroke={
                        isSel
                          ? '#064E3B'
                          : isDark
                          ? '#451A03'
                          : '#FFFFFF'
                      }
                      strokeWidth={(2.2 * localScale) / Math.pow(localZoom, 0.55)}
                      style={{ paintOrder: 'stroke' }}
                      className="pointer-events-none select-none"
                    >
                      {lang === 'bn' ? dv.bnName : dv.name}
                    </text>
                  );
                })}
              </svg>
            </div>
          </div>

          {/* Key Numeric Stats Grid (Aligned Baseline) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex flex-col justify-between">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'আয়তন' : 'Area'}
              </div>
              <div className="font-mono-tabular text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {formatNum(divMeta.areaKm2, lang)} {lang === 'bn' ? 'কিমি²' : 'km²'}
              </div>
            </div>
            <div className="flex flex-col justify-between">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'জনসংখ্যা' : 'Population'}
              </div>
              <div className="font-mono-tabular text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {formatNum(divMeta.population, lang)}
              </div>
            </div>
            <div className="flex flex-col justify-between">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'জেলা ও উপজেলা' : 'Districts / Upazilas'}
              </div>
              <div className="font-mono-tabular text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {lang === 'bn'
                  ? `${formatNum(divDistricts.length, lang)} · ${formatNum(divUpazilaCount, lang)}`
                  : `${divDistricts.length} · ${divUpazilaCount}`}
              </div>
            </div>
            <div className="flex flex-col justify-between">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'প্রধান নদ-নদী' : 'Major Rivers'}
              </div>
              <div className="font-mono-tabular text-sm font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
                {formatNum(divRivers.length, lang)}
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
                {lang === 'bn' ? divMeta.famousForBn : divMeta.famousForEn}
              </p>
              <p className="text-sm text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                {lang === 'bn' ? divMeta.summaryBn : divMeta.summaryEn}
              </p>
            </div>

            <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80 space-y-2.5 text-sm">
              <div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'bn' ? 'বিখ্যাত পণ্য, খাবার ও কৃষি' : 'Specialties, Cuisine & Produce'}
                </div>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                  {lang === 'bn' ? divMeta.specialtiesBn : divMeta.specialtiesEn}
                </p>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'bn' ? 'ইতিহাস, সংস্কৃতি ও অর্থনীতি' : 'History, Culture & Economy'}
                </div>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                  {lang === 'bn' ? divMeta.historyEconomyBn : divMeta.historyEconomyEn}
                </p>
              </div>
              <div>
                <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {lang === 'bn' ? 'প্রধান যোগাযোগ ও পথ' : 'Connectivity & Gateways'}
                </div>
                <p className="text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                  {lang === 'bn' ? divMeta.connectivityBn : divMeta.connectivityEn}
                </p>
              </div>
            </div>
          </div>

          {/* Interesting Facts */}
          {(lang === 'bn' ? divMeta.interestingFactsBn : divMeta.interestingFactsEn).length > 0 && (
            <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2.5">
                {lang === 'bn' ? 'মজার ও গুরুত্বপূর্ণ তথ্য' : 'Interesting Facts'}
              </h3>
              <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                {(lang === 'bn' ? divMeta.interestingFactsBn : divMeta.interestingFactsEn).map((fact) => (
                  <li key={fact} className="flex items-start gap-2 leading-relaxed">
                    <Info className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 mt-1 shrink-0" />
                    <span>{fact}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Districts inside Selected Division */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2.5">
              {lang === 'bn'
                ? `অধীনস্থ জেলাসমূহ (${formatNum(divDistricts.length, lang)})`
                : `Districts in Division (${divDistricts.length})`}
            </h3>
            <div className="grid grid-cols-2 gap-1.5">
              {divDistricts.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSelectDistrict(d.id)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-50/70 dark:bg-slate-800/45 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/45 border border-slate-200 dark:border-slate-800 hover:border-emerald-400/80 dark:hover:border-emerald-700 text-xs font-medium text-slate-800 dark:text-slate-200 text-left transition-colors truncate"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" />
                  <span className="truncate">{lang === 'bn' ? d.bnName : d.name}</span>
                </button>
              ))}
            </div>

            {divDistricts.length >= 2 && (() => {
              const withDet = divDistricts.filter((d) => DISTRICT_DETAILS[d.id]);
              if (withDet.length < 2) return null;
              const byPop = [...withDet].sort(
                (a, b) => DISTRICT_DETAILS[b.id].population - DISTRICT_DETAILS[a.id].population
              );
              const byArea = [...withDet].sort(
                (a, b) => DISTRICT_DETAILS[b.id].areaKm2 - DISTRICT_DETAILS[a.id].areaKm2
              );
              const maxPopD = byPop[0];
              const minPopD = byPop[byPop.length - 1];
              const maxAreaD = byArea[0];
              const minAreaD = byArea[byArea.length - 1];
              const extremes = [
                {
                  key: 'div-max-pop',
                  label: lang === 'bn' ? 'সর্বোচ্চ জনসংখ্যার জেলা' : 'Highest Population District',
                  d: maxPopD,
                  val: formatNum(DISTRICT_DETAILS[maxPopD.id].population, lang),
                },
                {
                  key: 'div-min-pop',
                  label: lang === 'bn' ? 'সর্বনিম্ন জনসংখ্যার জেলা' : 'Lowest Population District',
                  d: minPopD,
                  val: formatNum(DISTRICT_DETAILS[minPopD.id].population, lang),
                },
                {
                  key: 'div-max-area',
                  label: lang === 'bn' ? 'সর্ববৃহৎ আয়তনের জেলা' : 'Largest Land Area District',
                  d: maxAreaD,
                  val: `${formatNum(DISTRICT_DETAILS[maxAreaD.id].areaKm2, lang)} ${lang === 'bn' ? 'কিমি²' : 'km²'}`,
                },
                {
                  key: 'div-min-area',
                  label: lang === 'bn' ? 'ক্ষুদ্রতম আয়তনের জেলা' : 'Smallest Land Area District',
                  d: minAreaD,
                  val: `${formatNum(DISTRICT_DETAILS[minAreaD.id].areaKm2, lang)} ${lang === 'bn' ? 'কিমি²' : 'km²'}`,
                },
              ];
              return (
                <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300 mb-2">
                    {lang === 'bn'
                      ? 'জেলার জনসংখ্যা ও আয়তনের শীর্ষ ও সর্বনিম্ন'
                      : 'District Extremes (Population & Area)'}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {extremes.map((ex) => (
                      <button
                        key={ex.key}
                        type="button"
                        onClick={() => onSelectDistrict(ex.d.id)}
                        className="flex flex-col justify-between p-2.5 rounded-lg bg-slate-50/75 dark:bg-slate-800/45 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/40 border border-slate-200 dark:border-slate-800 hover:border-emerald-400/80 dark:hover:border-emerald-700 text-left transition-colors"
                      >
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {ex.label}
                        </span>
                        <span className="text-xs font-semibold text-slate-900 dark:text-slate-100 mt-0.5 truncate w-full">
                          {lang === 'bn' ? ex.d.bnName : ex.d.name}
                        </span>
                        <span className="font-mono-tabular text-[11px] font-medium text-emerald-700 dark:text-emerald-400 mt-0.5">
                          {ex.val}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Upazilas & Thanas inside Selected Division */}
          {divisionUpazilas.length > 0 && (() => {
            const uq = divUpazilaSearch.trim().toLowerCase();
            const visibleDivUpazilas = uq
              ? divisionUpazilas.filter((u) => {
                  const pDist = districtMap.get(u.districtId);
                  return (
                    u.name.toLowerCase().includes(uq) ||
                    u.bnName.includes(uq) ||
                    (pDist?.name.toLowerCase().includes(uq) ?? false) ||
                    (pDist?.bnName.includes(uq) ?? false)
                  );
                })
              : divisionUpazilas;

            return (
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {lang === 'bn'
                      ? `অধীনস্থ উপজেলা ও থানাসমূহ (${formatNum(divisionUpazilas.length, lang)})`
                      : `Upazilas & Thanas (${divisionUpazilas.length})`}
                  </h3>
                  {uq && (
                    <span className="text-[11px] font-mono-tabular text-slate-500 dark:text-slate-400">
                      {formatNum(visibleDivUpazilas.length, lang)}
                    </span>
                  )}
                </div>

                <div className="relative mb-2.5">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={divUpazilaSearch}
                    onChange={(e) => setDivUpazilaSearch(e.target.value)}
                    placeholder={
                      lang === 'bn' ? 'উপজেলা বা জেলা খুঁজুন...' : 'Filter upazila or district...'
                    }
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                {visibleDivUpazilas.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-72 overflow-y-auto pr-1">
                    {visibleDivUpazilas.map((u) => {
                      const pDist = districtMap.get(u.districtId);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => onSelectUpazila(u.id)}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-slate-50/70 dark:bg-slate-800/45 hover:bg-emerald-50/70 dark:hover:bg-emerald-950/45 border border-slate-200 dark:border-slate-800 hover:border-emerald-400/80 dark:hover:border-emerald-700 text-xs text-left transition-colors"
                        >
                          <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                            {lang === 'bn' ? u.bnName : u.name}
                          </span>
                          {pDist && (
                            <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                              {lang === 'bn' ? pDist.bnName : pDist.name}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-2">
                    {lang === 'bn' ? 'কোনো উপজেলা পাওয়া যায়নি' : 'No matching upazila found'}
                  </p>
                )}
              </div>
            );
          })()}

          {/* Bordering / Adjacent Divisions */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2.5">
              {lang === 'bn'
                ? `পার্শ্ববর্তী বিভাগ (${formatNum(neighborDivisions.length, lang)})`
                : `Bordering Divisions (${neighborDivisions.length})`}
            </h3>

            <div className="grid grid-cols-2 gap-1.5">
              {neighborDivisions.map((nd) => (
                <button
                  key={nd.id}
                  type="button"
                  onClick={() => onSelectDivision(nd.id)}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-slate-50/70 dark:bg-slate-800/45 hover:bg-amber-50/80 dark:hover:bg-amber-950/35 border border-slate-200 dark:border-slate-800 hover:border-amber-400/80 dark:hover:border-amber-600/80 text-xs font-medium text-slate-800 dark:text-slate-200 text-left transition-colors truncate"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate">
                    {lang === 'bn' ? `${nd.bnName} বিভাগ` : nd.name}
                  </span>
                </button>
              ))}
            </div>

            {(lang === 'bn' ? divMeta.externalBordersBn : divMeta.externalBordersEn).length > 0 && (
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-3">
                <span className="font-medium text-slate-800 dark:text-slate-200">
                  {lang === 'bn' ? 'আন্তর্জাতিক সীমান্ত / সাগর: ' : 'External Border / Coast: '}
                </span>
                {(lang === 'bn' ? divMeta.externalBordersBn : divMeta.externalBordersEn).join(' · ')}
              </p>
            )}
          </div>

          {/* Major Rivers Flowing Through Division */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                {lang === 'bn'
                  ? `প্রবাহিত নদী — প্রধান ৩০টির মধ্যে (${formatNum(divRivers.length, lang)})`
                  : `Major Rivers Flowing Through (${divRivers.length} of 30)`}
              </h3>
              {divRivers.length > 0 && (
                <span className="text-[11px] text-sky-700 dark:text-sky-400 font-medium">
                  {lang === 'bn' ? 'পূর্ণ গতিপথ দেখতে ক্লিক করুন' : 'Click for full course'}
                </span>
              )}
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden">
              {divRivers.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onInspectRiver(r.id)}
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
                          ? `${formatNum(r.districts.length, lang)}টি জেলার ওপর দিয়ে প্রবাহিত`
                          : `Flows across ${r.districts.length} districts`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono-tabular text-xs text-slate-600 dark:text-slate-300">
                      ~{formatNum(r.lengthKm, lang)} {lang === 'bn' ? 'কিমি' : 'km'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Notable Landmarks */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2.5">
              {lang === 'bn' ? 'উল্লেখযোগ্য দর্শনীয় স্থান ও ঐতিহ্য' : 'Notable Landmarks & Heritage'}
            </h3>
            <ul className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
              {(lang === 'bn' ? divMeta.landmarksBn : divMeta.landmarksEn).map((lm) => (
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
  }

  // VIEW 4: Multi-Region & Multi-River Filter Results Explorer
  const appliedRiverSet = new Set(appliedRiverIds);
  const selectedFilterRivers = rivers.filter((r) => appliedRiverSet.has(r.id));

  const riverDistrictSet = new Set<string>();
  for (const r of selectedFilterRivers) {
    for (const did of r.districts) riverDistrictSet.add(did);
  }

  const filteredDistricts = districts.filter((d) => {
    if (selectedDivisionId && d.divisionId !== selectedDivisionId) return false;
    if (appliedDirections.length > 0) {
      const det = DISTRICT_DETAILS[d.id];
      if (!det || !appliedDirections.some((dir) => det.directions.includes(dir))) return false;
    }
    if (appliedRiverIds.length > 0 && !riverDistrictSet.has(d.id)) return false;
    return true;
  });

  const filteredUpazilas = upazilas.filter((u) => {
    if (selectedDivisionId && u.divisionId !== selectedDivisionId) return false;
    if (appliedDirections.length > 0) {
      const det = DISTRICT_DETAILS[u.districtId];
      if (!det || !appliedDirections.some((dir) => det.directions.includes(dir))) return false;
    }
    if (appliedRiverIds.length > 0 && !u.rivers.some((rid) => appliedRiverSet.has(rid))) {
      return false;
    }
    return true;
  });

  const activeDivMeta = selectedDivisionId ? DIVISION_META[selectedDivisionId] : null;
  const isAllRiversSelected =
    rivers.length > 0 && selectedFilterRivers.length >= rivers.length;
  const regionLabels = appliedDirections.map((dir) =>
    lang === 'bn' ? DIRECTION_INFO[dir].labelBn : DIRECTION_INFO[dir].labelEn
  );

  return (
    <aside className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 flex flex-col gap-5 transition-colors">
      <div>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {lang === 'bn' ? 'ফিল্টার অনুযায়ী ফলাফল' : 'Filtered Results'}
            </div>
            <h2 className="font-display text-xl font-bold text-slate-900 dark:text-white tracking-tight mt-0.5">
              {activeDivMeta
                ? lang === 'bn'
                  ? `${activeDivMeta.bnName} বিভাগ`
                  : `${activeDivMeta.name} Division`
                : regionLabels.length > 0 && selectedFilterRivers.length > 0
                ? lang === 'bn'
                  ? isAllRiversSelected
                    ? `${regionLabels.join(', ')} ও সব নদ-নদী`
                    : `${regionLabels.join(', ')} ও ${formatNum(selectedFilterRivers.length, lang)}টি নদী`
                  : isAllRiversSelected
                  ? `${regionLabels.join(', ')} & All Rivers`
                  : `${regionLabels.join(', ')} & ${selectedFilterRivers.length} River(s)`
                : regionLabels.length > 0
                ? regionLabels.join(' · ')
                : isAllRiversSelected
                ? lang === 'bn'
                  ? `সব নদ-নদী (${formatNum(rivers.length, lang)})`
                  : `All Major Rivers (${rivers.length})`
                : selectedFilterRivers.length === 1
                ? lang === 'bn'
                  ? `${selectedFilterRivers[0].bnName} নদী`
                  : `${selectedFilterRivers[0].name} River`
                : lang === 'bn'
                ? `${formatNum(selectedFilterRivers.length, lang)}টি নির্বাচিত নদ-নদী`
                : `${selectedFilterRivers.length} Selected Rivers`}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClearFilters}
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
            ? `নির্বাচিত ফিল্টার অনুযায়ী বাংলাদেশে ${formatNum(filteredDistricts.length, lang)}টি জেলা ও ${formatNum(filteredUpazilas.length, lang)}টি উপজেলা পাওয়া গেছে।`
            : `${filteredDistricts.length} districts and ${filteredUpazilas.length} upazilas match your active filters.`}
        </p>
      </div>

      {/* Selected Rivers Quick Details + Full Course Links */}
      {selectedFilterRivers.length > 0 && (
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
          <h3 className="text-xs font-semibold text-sky-700 dark:text-sky-400 mb-2.5">
            {lang === 'bn'
              ? `${isAllRiversSelected ? 'প্রধান নদ-নদী' : 'নির্বাচিত নদ-নদী'} (${formatNum(selectedFilterRivers.length, lang)}) — বিস্তারিত দেখতে ক্লিক করুন:`
              : `${isAllRiversSelected ? 'Major Rivers' : 'Selected Rivers'} (${selectedFilterRivers.length}) — click for full dossier:`}
          </h3>
          <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
            {selectedFilterRivers.map((r) => {
              const rd = RIVER_DETAILS[r.id];
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onInspectRiver(r.id)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left bg-white dark:bg-slate-900 hover:bg-sky-50/70 dark:hover:bg-sky-950/40 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-sm font-medium text-slate-900 dark:text-slate-100">
                      <Waves className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span className="truncate">
                        {lang === 'bn' ? `${r.bnName} নদী` : `${r.name} River`}
                      </span>
                    </div>
                    {rd && (
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
                        {lang === 'bn' ? `${rd.originBn} → ${rd.mouthBn}` : `${rd.originEn} → ${rd.mouthEn}`}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="font-mono-tabular text-xs text-slate-600 dark:text-slate-300">
                      ~{formatNum(r.lengthKm, lang)} {lang === 'bn' ? 'কিমি' : 'km'}
                    </span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Matching Districts vs Upazilas Switcher */}
      <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
            <Compass className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
            <span>{lang === 'bn' ? 'প্রাপ্ত ফলাফল' : 'Matched Results'}</span>
          </div>
          <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 bg-slate-50 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => setFilterResultTab('districts')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filterResultTab === 'districts'
                  ? 'bg-emerald-700 dark:bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {lang === 'bn'
                ? `জেলা (${formatNum(filteredDistricts.length, lang)})`
                : `Districts (${filteredDistricts.length})`}
            </button>
            <button
              type="button"
              onClick={() => setFilterResultTab('upazilas')}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filterResultTab === 'upazilas'
                  ? 'bg-emerald-700 dark:bg-emerald-600 text-white'
                  : 'text-slate-600 dark:text-slate-300'
              }`}
            >
              {lang === 'bn'
                ? `উপজেলা (${formatNum(filteredUpazilas.length, lang)})`
                : `Upazilas (${filteredUpazilas.length})`}
            </button>
          </div>
        </div>

        {filterResultTab === 'districts' ? (
          filteredDistricts.length > 0 ? (
            <div className="grid grid-cols-2 gap-1.5 max-h-80 overflow-y-auto pr-1">
              {filteredDistricts.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => onSelectDistrict(d.id)}
                  className="px-2.5 py-1.5 rounded-md bg-slate-50/70 dark:bg-slate-800/45 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 text-xs font-medium text-slate-800 dark:text-slate-200 text-left truncate transition-colors"
                >
                  {lang === 'bn' ? d.bnName : d.name}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {lang === 'bn'
                ? 'এই সম্মিলিত ফিল্টারে কোনো জেলা পাওয়া যায়নি। অনুগ্রহ করে ফিল্টার পরিবর্তন করুন।'
                : 'No districts match the combined filter criteria.'}
            </p>
          )
        ) : filteredUpazilas.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-80 overflow-y-auto pr-1">
            {filteredUpazilas.map((u) => {
              const pDist = districtMap.get(u.districtId);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => onSelectUpazila(u.id)}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-slate-50/70 dark:bg-slate-800/45 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 border border-slate-200 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 text-xs text-left transition-colors"
                >
                  <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                    {lang === 'bn' ? u.bnName : u.name}
                  </span>
                  {pDist && (
                    <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                      {lang === 'bn' ? pDist.bnName : pDist.name}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn'
              ? 'এই সম্মিলিত ফিল্টারে কোনো উপজেলা পাওয়া যায়নি।'
              : 'No upazilas match the combined filter criteria.'}
          </p>
        )}
      </div>
    </aside>
  );
};
