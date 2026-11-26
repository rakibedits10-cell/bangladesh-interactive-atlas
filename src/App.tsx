import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Filter, Moon, Search, Sun, Waves, X } from 'lucide-react';
import rawGeoData from './data/bdMapGeo.json';
import rawUpazilaGeoData from './data/bdUpazilasGeo.json';
import {
  DIRECTION_INFO,
  DIVISION_META,
  type DirectionZone,
} from './data/bdDistrictDetails';
import { BangladeshMapCanvas } from './components/BangladeshMapCanvas';
import { DistrictDetailPanel } from './components/DistrictDetailPanel';
import {
  DivisionsDirectoryPage,
} from './components/RegionalDirectorySection';
import { QuizPage } from './components/QuizPage';
import { formatNum } from './utils/format';
import type {
  BdMapGeoData,
  BdUpazilasGeoData,
  GeoDistrict,
  GeoDivision,
  GeoUpazila,
  Lang,
  Theme,
} from './types/map';

const mapGeoData = rawGeoData as BdMapGeoData;
const upazilaGeoData = rawUpazilaGeoData as BdUpazilasGeoData;
type ActivePage = 'map' | 'divisions' | 'quiz';
type RegionOption = Exclude<DirectionZone, 'all'>;

const REGION_OPTIONS: RegionOption[] = ['north', 'south', 'east', 'west', 'central'];

type SearchItem =
  | { type: 'division'; division: GeoDivision }
  | { type: 'district'; district: GeoDistrict }
  | { type: 'upazila'; upazila: GeoUpazila; district: GeoDistrict | undefined };

export default function App() {
  const [lang, setLang] = useState<Lang>('bn');
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bd_atlas_theme');
      if (saved === 'dark' || saved === 'light') return saved;
    }
    return 'light';
  });

  const [activePage, setActivePage] = useState<ActivePage>('map');
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>(null);
  const [selectedUpazilaId, setSelectedUpazilaId] = useState<string | null>(null);
  const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null);
  const [inspectedRiverId, setInspectedRiverId] = useState<string | null>(null);

  // Multi-select Region & River Filter states (Draft vs Applied via Done button)
  const [appliedDirections, setAppliedDirections] = useState<RegionOption[]>([]);
  const [draftDirections, setDraftDirections] = useState<RegionOption[]>([]);
  const [appliedRiverIds, setAppliedRiverIds] = useState<string[]>([]);
  const [draftRiverIds, setDraftRiverIds] = useState<string[]>([]);

  const [openFilterMenu, setOpenFilterMenu] = useState<'region' | 'river' | null>(null);
  const [riverFilterSearch, setRiverFilterSearch] = useState<string>('');

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState<boolean>(false);

  const pageTopRef = useRef<HTMLDivElement>(null);
  const filterBarRef = useRef<HTMLDivElement>(null);
  const detailPanelRef = useRef<HTMLDivElement>(null);

  const districtById = useMemo(
    () => new Map(mapGeoData.districts.map((d) => [d.id, d])),
    []
  );
  const riverById = useMemo(
    () => new Map(mapGeoData.rivers.map((r) => [r.id, r])),
    []
  );

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    try {
      localStorage.setItem('bd_atlas_theme', theme);
    } catch {
      // ignore storage failure
    }
  }, [theme]);

  // Close filter popovers on outside click or Escape
  useEffect(() => {
    if (!openFilterMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (filterBarRef.current && !filterBarRef.current.contains(e.target as Node)) {
        setOpenFilterMenu(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenFilterMenu(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKey);
    };
  }, [openFilterMenu]);

  const searchResults = useMemo<SearchItem[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    const results: SearchItem[] = [];

    for (const div of mapGeoData.divisions) {
      if (
        div.name.toLowerCase().includes(q) ||
        div.bnName.includes(q) ||
        `${div.bnName} বিভাগ`.includes(q) ||
        `${div.name.toLowerCase()} division`.includes(q)
      ) {
        results.push({ type: 'division', division: div });
      }
      if (results.length >= 3) break;
    }

    for (const d of mapGeoData.districts) {
      if (
        d.name.toLowerCase().includes(q) ||
        d.bnName.includes(q) ||
        (DIVISION_META[d.divisionId]?.name.toLowerCase().includes(q) ?? false) ||
        (DIVISION_META[d.divisionId]?.bnName.includes(q) ?? false)
      ) {
        results.push({ type: 'district', district: d });
      }
      if (results.length >= 8) break;
    }

    for (const u of upazilaGeoData.upazilas) {
      if (u.name.toLowerCase().includes(q) || u.bnName.includes(q)) {
        results.push({
          type: 'upazila',
          upazila: u,
          district: districtById.get(u.districtId),
        });
      }
      if (results.length >= 16) break;
    }

    return results;
  }, [searchQuery, districtById]);

  const filteredRiversForMenu = useMemo(() => {
    const q = riverFilterSearch.trim().toLowerCase();
    if (!q) return mapGeoData.rivers;
    return mapGeoData.rivers.filter(
      (r) => r.name.toLowerCase().includes(q) || r.bnName.includes(q)
    );
  }, [riverFilterSearch]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToDetailsOnMobile = () => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth >= 1024 || document.fullscreenElement) return;
    window.setTimeout(() => {
      detailPanelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 65);
  };

  const handleSelectDistrict = (id: string | null) => {
    setSelectedDistrictId(id);
    setSelectedUpazilaId(null);
    setInspectedRiverId(null);
    if (id) {
      setSelectedDivisionId(null);
      scrollToDetailsOnMobile();
    } else if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      scrollToTop();
    }
  };

  const handleSelectUpazila = (id: string | null) => {
    setSelectedUpazilaId(id);
    setSelectedDistrictId(null);
    setInspectedRiverId(null);
    if (id) {
      setSelectedDivisionId(null);
      scrollToDetailsOnMobile();
    } else if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      scrollToTop();
    }
  };

  const handleSelectDivision = (divId: string | null) => {
    setSelectedDivisionId(divId);
    setSelectedDistrictId(null);
    setSelectedUpazilaId(null);
    setInspectedRiverId(null);
    setOpenFilterMenu(null);
    if (divId) {
      setAppliedDirections([]);
      setDraftDirections([]);
      setAppliedRiverIds([]);
      setDraftRiverIds([]);
      scrollToDetailsOnMobile();
    } else if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      scrollToTop();
    }
  };

  const handleOpenFilterMenu = (menu: 'region' | 'river') => {
    if (openFilterMenu === menu) {
      setOpenFilterMenu(null);
      return;
    }
    if (menu === 'region') {
      setDraftDirections(appliedDirections);
    } else if (menu === 'river') {
      setDraftRiverIds(appliedRiverIds);
      setRiverFilterSearch('');
    }
    setOpenFilterMenu(menu);
  };

  const toggleDraftDirection = (dir: RegionOption) => {
    setDraftDirections((prev) =>
      prev.includes(dir) ? prev.filter((d) => d !== dir) : [...prev, dir]
    );
  };

  const toggleDraftRiver = (riverId: string) => {
    setDraftRiverIds((prev) =>
      prev.includes(riverId) ? prev.filter((id) => id !== riverId) : [...prev, riverId]
    );
  };

  const handleApplyRegionFilter = () => {
    setAppliedDirections(draftDirections);
    setSelectedDistrictId(null);
    setSelectedUpazilaId(null);
    setSelectedDivisionId(null);
    setInspectedRiverId(null);
    setOpenFilterMenu(null);
  };

  const handleApplyRiverFilter = () => {
    setAppliedRiverIds(draftRiverIds);
    setSelectedDistrictId(null);
    setSelectedUpazilaId(null);
    setSelectedDivisionId(null);
    setInspectedRiverId(null);
    setOpenFilterMenu(null);
  };

  const handleClearFilters = () => {
    setAppliedDirections([]);
    setDraftDirections([]);
    setAppliedRiverIds([]);
    setDraftRiverIds([]);
    setSelectedDivisionId(null);
    setInspectedRiverId(null);
    setOpenFilterMenu(null);
  };

  const handleResetView = () => {
    setSelectedDistrictId(null);
    setSelectedUpazilaId(null);
    setSelectedDivisionId(null);
    setInspectedRiverId(null);
    setAppliedDirections([]);
    setDraftDirections([]);
    setAppliedRiverIds([]);
    setDraftRiverIds([]);
    setSearchQuery('');
    setOpenFilterMenu(null);
  };

  const navigateToPage = (page: ActivePage) => {
    setActivePage(page);
    scrollToTop();
  };

  const isDetailOpen =
    selectedDistrictId !== null ||
    selectedUpazilaId !== null ||
    selectedDivisionId !== null ||
    appliedDirections.length > 0 ||
    appliedRiverIds.length > 0 ||
    inspectedRiverId !== null;

  const navItems: { id: ActivePage; labelBn: string; labelEn: string }[] = [
    { id: 'map', labelBn: 'মানচিত্র', labelEn: 'Map' },
    { id: 'divisions', labelBn: 'বিভাগ, জেলা ও উপজেলা', labelEn: 'Divisions & Upazilas' },
    { id: 'quiz', labelBn: 'কুইজ', labelEn: 'Quiz' },
  ];

  const hasRegionDraftChanges =
    draftDirections.length > 0 || appliedDirections.length > 0;
  const hasRiverDraftChanges =
    draftRiverIds.length > 0 || appliedRiverIds.length > 0;
  const allRiversCount = mapGeoData.rivers.length;
  const allDraftRiversSelected =
    draftRiverIds.length === allRiversCount && allRiversCount > 0;
  const allAppliedRiversSelected =
    appliedRiverIds.length >= allRiversCount && allRiversCount > 0;

  const filterControlsNode = (
    <div ref={filterBarRef} className="flex items-center gap-1.5 sm:gap-2 relative">
      <span className="hidden sm:inline-flex items-center gap-1 text-xs font-medium text-slate-500 dark:text-slate-400 mr-0.5">
        <Filter className="w-3.5 h-3.5" />
      </span>

      {/* 1. Multi-Select Region Filter Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => handleOpenFilterMenu('region')}
          aria-expanded={openFilterMenu === 'region'}
          className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
            appliedDirections.length > 0
              ? 'bg-emerald-700 dark:bg-emerald-600 text-white border-emerald-700 dark:border-emerald-600'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          <span>
            {appliedDirections.length > 0
              ? lang === 'bn'
                ? `অঞ্চল (${formatNum(appliedDirections.length, lang)})`
                : `Regions (${appliedDirections.length})`
              : lang === 'bn'
              ? 'অঞ্চল'
              : 'Region'}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${
              openFilterMenu === 'region' ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openFilterMenu === 'region' && (
          <div className="absolute left-0 mt-1.5 w-72 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-40 overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                {lang === 'bn'
                  ? 'এক বা একাধিক অঞ্চল বেছে নিন'
                  : 'Select one or more regions'}
              </span>
              {draftDirections.length > 0 && (
                <button
                  type="button"
                  onClick={() => setDraftDirections([])}
                  className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                >
                  {lang === 'bn' ? 'সব মুছুন' : 'Clear'}
                </button>
              )}
            </div>

            <div className="p-2 space-y-1">
              {REGION_OPTIONS.map((dir) => {
                const info = DIRECTION_INFO[dir];
                const checked = draftDirections.includes(dir);
                return (
                  <button
                    key={dir}
                    type="button"
                    onClick={() => toggleDraftDirection(dir)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                      checked
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-semibold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <span>{lang === 'bn' ? info.labelBn : info.labelEn}</span>
                    <span
                      className={`w-4 h-4 rounded-xs border flex items-center justify-center shrink-0 ${
                        checked
                          ? 'bg-emerald-700 dark:bg-emerald-600 border-emerald-700 dark:border-emerald-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {checked && <Check className="w-3 h-3" />}
                    </span>
                  </button>
                );
              })}
            </div>

            {hasRegionDraftChanges && (
              <div className="px-3 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {lang === 'bn'
                    ? `${formatNum(draftDirections.length, lang)}টি নির্বাচিত`
                    : `${draftDirections.length} selected`}
                </span>
                <button
                  type="button"
                  onClick={handleApplyRegionFilter}
                  className="px-4 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Multi-Select Major Rivers Filter Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => handleOpenFilterMenu('river')}
          aria-expanded={openFilterMenu === 'river'}
          className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap ${
            appliedRiverIds.length > 0
              ? 'bg-sky-600 dark:bg-sky-600 text-white border-sky-600'
              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700'
          }`}
        >
          <Waves className="w-3.5 h-3.5" />
          <span>
            {allAppliedRiversSelected
              ? lang === 'bn'
                ? `সব নদ-নদী (${formatNum(allRiversCount, lang)})`
                : `All Rivers (${allRiversCount})`
              : appliedRiverIds.length > 0
              ? lang === 'bn'
                ? `প্রধান নদ-নদী (${formatNum(appliedRiverIds.length, lang)})`
                : `Major Rivers (${appliedRiverIds.length})`
              : lang === 'bn'
              ? 'প্রধান নদ-নদী'
              : 'Major Rivers'}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 transition-transform ${
              openFilterMenu === 'river' ? 'rotate-180' : ''
            }`}
          />
        </button>

        {openFilterMenu === 'river' && (
          <div className="absolute -left-16 sm:left-0 mt-1.5 w-76 max-w-[calc(100vw-2rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-40 overflow-hidden">
            <div className="px-3.5 py-2.5 border-b border-slate-100 dark:border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-800 dark:text-slate-100">
                  {lang === 'bn'
                    ? 'এক বা একাধিক নদ-নদী নির্বাচন করুন'
                    : 'Select one or more rivers'}
                </span>
                {draftRiverIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDraftRiverIds([])}
                    className="text-[11px] text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
                  >
                    {lang === 'bn' ? 'সব মুছুন' : 'Clear'}
                  </button>
                )}
              </div>
              <input
                type="text"
                value={riverFilterSearch}
                onChange={(e) => setRiverFilterSearch(e.target.value)}
                placeholder={lang === 'bn' ? 'নদীর নাম লিখুন...' : 'Search river...'}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-600"
              />
            </div>

            <div className="p-2 max-h-64 overflow-y-auto space-y-1">
              {!riverFilterSearch.trim() && (
                <button
                  type="button"
                  onClick={() =>
                    setDraftRiverIds(
                      allDraftRiversSelected ? [] : mapGeoData.rivers.map((r) => r.id)
                    )
                  }
                  className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-xs border-b border-slate-100 dark:border-slate-800 mb-1 transition-colors ${
                    allDraftRiversSelected
                      ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-950 dark:text-sky-200 font-semibold'
                      : 'text-slate-800 dark:text-slate-100 font-medium hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <div className="min-w-0">
                    <div className="truncate">
                      {lang === 'bn' ? 'সব নদ-নদী' : 'All Rivers'}
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono-tabular font-normal">
                      {lang === 'bn'
                        ? `${formatNum(allRiversCount, lang)}টি প্রধান নদী একসাথে দেখুন`
                        : `Show all ${allRiversCount} major rivers`}
                    </div>
                  </div>
                  <span
                    className={`w-4 h-4 rounded-xs border flex items-center justify-center shrink-0 ${
                      allDraftRiversSelected
                        ? 'bg-sky-600 border-sky-600 text-white'
                        : 'border-slate-300 dark:border-slate-600'
                    }`}
                  >
                    {allDraftRiversSelected && <Check className="w-3 h-3" />}
                  </span>
                </button>
              )}

              {filteredRiversForMenu.map((r) => {
                const checked = draftRiverIds.includes(r.id);
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => toggleDraftRiver(r.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                      checked
                        ? 'bg-sky-50 dark:bg-sky-950/60 text-sky-950 dark:text-sky-200 font-semibold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate">
                        {lang === 'bn' ? `${r.bnName} নদী` : `${r.name} River`}
                      </div>
                      <div className="text-[11px] text-slate-400 font-mono-tabular">
                        ~{formatNum(r.lengthKm, lang)} {lang === 'bn' ? 'কিমি' : 'km'} ·{' '}
                        {formatNum(r.districts.length, lang)} {lang === 'bn' ? 'জেলা' : 'dist'}
                      </div>
                    </div>
                    <span
                      className={`w-4 h-4 rounded-xs border flex items-center justify-center shrink-0 ${
                        checked
                          ? 'bg-sky-600 border-sky-600 text-white'
                          : 'border-slate-300 dark:border-slate-600'
                      }`}
                    >
                      {checked && <Check className="w-3 h-3" />}
                    </span>
                  </button>
                );
              })}
              {filteredRiversForMenu.length === 0 && (
                <div className="px-3 py-4 text-center text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'bn' ? 'কোনো নদী পাওয়া যায়নি' : 'No matching river'}
                </div>
              )}
            </div>

            {hasRiverDraftChanges && (
              <div className="px-3 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {lang === 'bn'
                    ? `${formatNum(draftRiverIds.length, lang)}টি নদী নির্বাচিত`
                    : `${draftRiverIds.length} river(s) selected`}
                </span>
                <button
                  type="button"
                  onClick={handleApplyRiverFilter}
                  className="px-4 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold transition-colors"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  const activeFilterTagsNode =
    appliedDirections.length > 0 || appliedRiverIds.length > 0 ? (
      <div className="flex flex-wrap items-center gap-1.5">
        {appliedDirections.map((dir) => (
          <button
            key={`tag-dir-${dir}`}
            type="button"
            onClick={() => {
              const next = appliedDirections.filter((d) => d !== dir);
              setAppliedDirections(next);
              setDraftDirections(next);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-medium text-emerald-900 dark:text-emerald-200 hover:bg-emerald-100 dark:hover:bg-emerald-900/70"
          >
            <span>{lang === 'bn' ? DIRECTION_INFO[dir].labelBn : DIRECTION_INFO[dir].labelEn}</span>
            <X className="w-3 h-3" />
          </button>
        ))}
        {allAppliedRiversSelected ? (
          <button
            type="button"
            onClick={() => {
              setAppliedRiverIds([]);
              setDraftRiverIds([]);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-xs font-medium text-sky-900 dark:text-sky-200 hover:bg-sky-100 dark:hover:bg-sky-900/70"
          >
            <span>
              {lang === 'bn'
                ? `সব নদ-নদী (${formatNum(allRiversCount, lang)})`
                : `All Rivers (${allRiversCount})`}
            </span>
            <X className="w-3 h-3" />
          </button>
        ) : (
          appliedRiverIds.map((rid) => {
            const r = riverById.get(rid);
            if (!r) return null;
            return (
              <button
                key={`tag-riv-${rid}`}
                type="button"
                onClick={() => {
                  const next = appliedRiverIds.filter((id) => id !== rid);
                  setAppliedRiverIds(next);
                  setDraftRiverIds(next);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-xs font-medium text-sky-900 dark:text-sky-200 hover:bg-sky-100 dark:hover:bg-sky-900/70"
              >
                <span>{lang === 'bn' ? `${r.bnName} নদী` : r.name}</span>
                <X className="w-3 h-3" />
              </button>
            );
          })
        )}
        <button
          type="button"
          onClick={handleClearFilters}
          className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 underline ml-1"
        >
          {lang === 'bn' ? 'ফিল্টার মুছুন' : 'Clear all'}
        </button>
      </div>
    ) : null;

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
      {/* 3-Zone Top Bar */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-slate-950/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 transition-colors">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Title */}
          <a
            href="#atlas"
            onClick={(e) => {
              e.preventDefault();
              handleResetView();
              navigateToPage('map');
            }}
            className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap shrink-0"
          >
            {lang === 'bn' ? 'বাংলাদেশ মানচিত্র' : 'Bangladesh Atlas'}
          </a>

          {/* Zone 2: Concise Single-Line Nav Links */}
          <nav
            aria-label={lang === 'bn' ? 'প্রধান মেনু' : 'Primary Navigation'}
            className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600 dark:text-slate-300"
          >
            {navItems.map((item) => {
              const isCurrent = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateToPage(item.id)}
                  className={`py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isCurrent
                      ? 'text-emerald-700 dark:text-emerald-400 font-semibold underline underline-offset-8 decoration-2'
                      : 'hover:text-slate-900 dark:hover:text-white hover:underline underline-offset-8'
                  }`}
                >
                  {lang === 'bn' ? item.labelBn : item.labelEn}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setLang((prev) => (prev === 'bn' ? 'en' : 'bn'))}
              className="px-4 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 rounded-lg transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              {lang === 'bn' ? 'English' : 'বাংলা'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Container */}
      <main
        id="atlas"
        ref={pageTopRef}
        className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 py-4 sm:py-6"
      >
        {/* Mobile Page Navigation Strip + Theme Switch */}
        <div className="flex md:hidden items-center justify-between gap-2 pb-4 mb-4 border-b border-slate-200 dark:border-slate-800">
          <nav
            aria-label={lang === 'bn' ? 'মোবাইল মেনু' : 'Mobile Navigation'}
            className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 rounded-lg overflow-x-auto"
          >
            {navItems.map((item) => {
              const isCurrent = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigateToPage(item.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                    isCurrent
                      ? 'bg-emerald-700 dark:bg-emerald-600 text-white'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {lang === 'bn' ? item.labelBn : item.labelEn}
                </button>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            className="p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 shrink-0"
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>
        </div>

        {/* PAGE 1: INTERACTIVE BANGLADESH MAP */}
        {activePage === 'map' && (
          <>
            {/* Workspace Header: Title, Unified Division+District+Upazila Search & Dark Mode */}
            <section className="mb-4">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div className="max-w-2xl">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight text-balance">
                    {lang === 'bn'
                      ? `বাংলাদেশের মানচিত্র · ৮ বিভাগ, ৬৪ জেলা ও ${formatNum(upazilaGeoData.upazilas.length, lang)} উপজেলা`
                      : `Bangladesh Map · 8 Divisions, 64 Districts & ${upazilaGeoData.upazilas.length} Upazilas`}
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {lang === 'bn'
                      ? 'মানচিত্রে বিভাগ দেখুন ও জুম করে জেলা-উপজেলায় যান; যেকোনো বিভাগ, জেলা বা উপজেলায় ক্লিক করলে বিস্তারিত তথ্য খুলবে।'
                      : 'Start with Divisions and zoom in for Districts & Upazilas; click any area to explore neighbors, rivers, and full details.'}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 w-full lg:w-auto shrink-0">
                  {/* Unified Division + District + Upazila Search Box */}
                  <div className="relative flex-1 lg:w-80">
                    <label htmlFor="district-search" className="sr-only">
                      {lang === 'bn' ? 'বিভাগ, জেলা বা উপজেলা খুঁজুন' : 'Search divisions, districts or upazilas'}
                    </label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="district-search"
                        type="text"
                        value={searchQuery}
                        onFocus={() => setSearchOpen(true)}
                        onBlur={() => setTimeout(() => setSearchOpen(false), 180)}
                        onChange={(e) => {
                          setSearchQuery(e.target.value);
                          setSearchOpen(true);
                        }}
                        placeholder={
                          lang === 'bn'
                            ? 'বিভাগ, জেলা বা উপজেলা খুঁজুন...'
                            : 'Search division, district or upazila...'
                        }
                        className="w-full pl-10 pr-9 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                      />
                      {searchQuery && (
                        <button
                          type="button"
                          onClick={() => setSearchQuery('')}
                          aria-label={lang === 'bn' ? 'খোঁজা মুছুন' : 'Clear search'}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {searchOpen && searchQuery.trim().length > 0 && (
                      <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-40 max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {searchResults.length > 0 ? (
                          searchResults.map((item) =>
                            item.type === 'division' ? (
                              <button
                                key={`sdiv-${item.division.id}`}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  handleSelectDivision(item.division.id);
                                  setSearchQuery('');
                                  setSearchOpen(false);
                                }}
                                className="w-full px-3.5 py-2.5 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center justify-between gap-2 transition-colors"
                              >
                                <div>
                                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                    {lang === 'bn'
                                      ? `${item.division.bnName} বিভাগ (${item.division.name})`
                                      : `${item.division.name} Division (${item.division.bnName})`}
                                  </div>
                                  <div className="text-xs text-emerald-700 dark:text-emerald-400">
                                    {lang === 'bn'
                                      ? `বিভাগ · ${DIVISION_META[item.division.id]?.directionBn || ''}`
                                      : `Division · ${DIVISION_META[item.division.id]?.directionEn || ''}`}
                                  </div>
                                </div>
                              </button>
                            ) : item.type === 'district' ? (
                              <button
                                key={`sd-${item.district.id}`}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  handleSelectDistrict(item.district.id);
                                  setSearchQuery('');
                                  setSearchOpen(false);
                                }}
                                className="w-full px-3.5 py-2.5 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center justify-between gap-2 transition-colors"
                              >
                                <div>
                                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                    {lang === 'bn'
                                      ? `${item.district.bnName} (${item.district.name})`
                                      : `${item.district.name} (${item.district.bnName})`}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400">
                                    {lang === 'bn'
                                      ? `জেলা · ${DIVISION_META[item.district.divisionId]?.bnName} বিভাগ`
                                      : `District · ${DIVISION_META[item.district.divisionId]?.name} Div.`}
                                  </div>
                                </div>
                              </button>
                            ) : (
                              <button
                                key={`su-${item.upazila.id}`}
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => {
                                  handleSelectUpazila(item.upazila.id);
                                  setSearchQuery('');
                                  setSearchOpen(false);
                                }}
                                className="w-full px-3.5 py-2.5 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center justify-between gap-2 transition-colors"
                              >
                                <div>
                                  <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                    {lang === 'bn'
                                      ? `${item.upazila.bnName} (${item.upazila.name})`
                                      : `${item.upazila.name} (${item.upazila.bnName})`}
                                  </div>
                                  <div className="text-xs text-emerald-700 dark:text-emerald-400">
                                    {lang === 'bn'
                                      ? `উপজেলা/থানা · ${item.district?.bnName || ''} জেলা, ${
                                          DIVISION_META[item.upazila.divisionId]?.bnName || ''
                                        } বিভাগ`
                                      : `Upazila · ${item.district?.name || ''} Dist., ${
                                          DIVISION_META[item.upazila.divisionId]?.name || ''
                                        } Div.`}
                                  </div>
                                </div>
                              </button>
                            )
                          )
                        ) : (
                          <div className="px-3.5 py-3 text-xs text-slate-500 dark:text-slate-400">
                            {lang === 'bn'
                              ? 'কোনো বিভাগ, জেলা বা উপজেলা পাওয়া যায়নি'
                              : 'No matching division, district or upazila found'}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Dark / Light Mode Toggle (Desktop) */}
                  <button
                    type="button"
                    onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                    aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                    className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                  >
                    {theme === 'dark' ? (
                      <>
                        <Sun className="w-4 h-4 text-amber-400" />
                        <span>{lang === 'bn' ? 'লাইট মোড' : 'Light'}</span>
                      </>
                    ) : (
                      <>
                        <Moon className="w-4 h-4 text-slate-600" />
                        <span>{lang === 'bn' ? 'ডার্ক মোড' : 'Dark'}</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </section>

            {/* Map Stage: Left Map Sticky on Desktop while Right Detail Panel Scrolls */}
            {isDetailOpen ? (
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7 lg:sticky lg:top-20">
                  <BangladeshMapCanvas
                    districts={mapGeoData.districts}
                    upazilas={upazilaGeoData.upazilas}
                    divisions={mapGeoData.divisions}
                    rivers={mapGeoData.rivers}
                    selectedDistrictId={selectedDistrictId}
                    selectedUpazilaId={selectedUpazilaId}
                    selectedDivisionId={selectedDivisionId}
                    appliedDirections={appliedDirections}
                    activeRiverIds={appliedRiverIds}
                    inspectedRiverId={inspectedRiverId}
                    filterControls={filterControlsNode}
                    activeFilterTags={activeFilterTagsNode}
                    lang={lang}
                    theme={theme}
                    onSelectDivision={(id) => handleSelectDivision(id)}
                    onSelectDistrict={(id) => handleSelectDistrict(id)}
                    onSelectUpazila={(id) => handleSelectUpazila(id)}
                    onResetView={handleResetView}
                  />
                </div>

                <div ref={detailPanelRef} className="lg:col-span-5 scroll-mt-16">
                  <DistrictDetailPanel
                    districts={mapGeoData.districts}
                    upazilas={upazilaGeoData.upazilas}
                    divisions={mapGeoData.divisions}
                    rivers={mapGeoData.rivers}
                    selectedDistrictId={selectedDistrictId}
                    selectedUpazilaId={selectedUpazilaId}
                    selectedDivisionId={selectedDivisionId}
                    appliedDirections={appliedDirections}
                    appliedRiverIds={appliedRiverIds}
                    inspectedRiverId={inspectedRiverId}
                    lang={lang}
                    theme={theme}
                    onSelectDistrict={handleSelectDistrict}
                    onSelectUpazila={handleSelectUpazila}
                    onSelectDivision={handleSelectDivision}
                    onInspectRiver={(rid) => {
                      setInspectedRiverId(rid);
                      if (rid) scrollToDetailsOnMobile();
                    }}
                    onClearFilters={handleClearFilters}
                  />
                </div>
              </section>
            ) : (
              <section className="w-full">
                <BangladeshMapCanvas
                  districts={mapGeoData.districts}
                  upazilas={upazilaGeoData.upazilas}
                  divisions={mapGeoData.divisions}
                  rivers={mapGeoData.rivers}
                  selectedDistrictId={selectedDistrictId}
                  selectedUpazilaId={selectedUpazilaId}
                  selectedDivisionId={selectedDivisionId}
                  appliedDirections={appliedDirections}
                  activeRiverIds={appliedRiverIds}
                  inspectedRiverId={inspectedRiverId}
                  filterControls={filterControlsNode}
                  activeFilterTags={activeFilterTagsNode}
                  lang={lang}
                  theme={theme}
                  onSelectDivision={(id) => handleSelectDivision(id)}
                  onSelectDistrict={(id) => handleSelectDistrict(id)}
                  onSelectUpazila={(id) => handleSelectUpazila(id)}
                  onResetView={handleResetView}
                />
              </section>
            )}
          </>
        )}

        {/* PAGE 2: 64 DISTRICTS & ALL UPAZILAS BY DIVISION */}
        {activePage === 'divisions' && (
          <>
            <div className="hidden md:flex justify-end mb-2">
              <button
                type="button"
                onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span>{lang === 'bn' ? 'লাইট মোড' : 'Light'}</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-slate-600" />
                    <span>{lang === 'bn' ? 'ডার্ক মোড' : 'Dark'}</span>
                  </>
                )}
              </button>
            </div>
            <DivisionsDirectoryPage
              districts={mapGeoData.districts}
              upazilas={upazilaGeoData.upazilas}
              selectedDistrictId={selectedDistrictId}
              lang={lang}
              onSelectDistrictOnMap={(id) => {
                handleSelectDistrict(id);
                navigateToPage('map');
              }}
              onSelectUpazilaOnMap={(id) => {
                handleSelectUpazila(id);
                navigateToPage('map');
              }}
              onSelectDivisionOnMap={(divId) => {
                handleSelectDivision(divId);
                navigateToPage('map');
              }}
              onBackToMap={() => navigateToPage('map')}
            />
          </>
        )}

        {/* PAGE 3: BANGLADESH QUIZ & LEADERBOARD */}
        {activePage === 'quiz' && (
          <>
            <div className="hidden md:flex justify-end mb-2">
              <button
                type="button"
                onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {theme === 'dark' ? (
                  <>
                    <Sun className="w-3.5 h-3.5 text-amber-400" />
                    <span>{lang === 'bn' ? 'লাইট মোড' : 'Light'}</span>
                  </>
                ) : (
                  <>
                    <Moon className="w-3.5 h-3.5 text-slate-600" />
                    <span>{lang === 'bn' ? 'ডার্ক মোড' : 'Dark'}</span>
                  </>
                )}
              </button>
            </div>
            <QuizPage
              divisions={mapGeoData.divisions}
              districts={mapGeoData.districts}
              upazilas={upazilaGeoData.upazilas}
              rivers={mapGeoData.rivers}
              lang={lang}
              onBackToMap={() => navigateToPage('map')}
            />
          </>
        )}
      </main>

      {/* Clean Editorial Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 mt-12 transition-colors">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>
            {lang === 'bn'
              ? `বাংলাদেশ ইন্টারেক্টিভ মানচিত্র · ৮টি বিভাগ, ৬৪টি জেলা, ${formatNum(upazilaGeoData.upazilas.length, lang)}টি উপজেলা ও ৩০টি প্রধান নদ-নদী`
              : `Bangladesh Interactive Atlas · 8 Divisions, 64 Districts, ${upazilaGeoData.upazilas.length} Upazilas & 30 Major Rivers`}
          </span>
          <span>
            {lang === 'bn'
              ? 'ভৌগোলিক সীমানা: geoBoundaries (BBS / OCHA)'
              : 'Boundary data: geoBoundaries (BBS / OCHA)'}
          </span>
        </div>
      </footer>
    </div>
  );
}
