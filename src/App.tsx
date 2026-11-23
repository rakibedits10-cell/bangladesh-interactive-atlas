import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Moon, Search, Sun, X } from 'lucide-react';
import rawGeoData from './data/bdMapGeo.json';
import {
  DIRECTION_INFO,
  DIVISION_META,
  type DirectionZone,
} from './data/bdDistrictDetails';
import { BangladeshMapCanvas } from './components/BangladeshMapCanvas';
import { DistrictDetailPanel } from './components/DistrictDetailPanel';
import {
  DivisionsDirectoryPage,
  RiversDirectoryPage,
} from './components/RegionalDirectorySection';
import type { BdMapGeoData, Lang, Theme } from './types/map';

const mapGeoData = rawGeoData as BdMapGeoData;
type ActivePage = 'map' | 'divisions' | 'rivers';

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
  const [selectedDivisionId, setSelectedDivisionId] = useState<string | null>(null);
  const [activeDirection, setActiveDirection] = useState<DirectionZone>('all');
  const [activeRiverId, setActiveRiverId] = useState<string | null>(null);
  const [showAllRivers, setShowAllRivers] = useState<boolean>(false);
  const [showAllLabels, setShowAllLabels] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchOpen, setSearchOpen] = useState<boolean>(false);

  const pageTopRef = useRef<HTMLDivElement>(null);

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

  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];
    return mapGeoData.districts
      .filter(
        (d) =>
          d.name.toLowerCase().includes(q) ||
          d.bnName.includes(q) ||
          (DIVISION_META[d.divisionId]?.name.toLowerCase().includes(q) ?? false) ||
          (DIVISION_META[d.divisionId]?.bnName.includes(q) ?? false)
      )
      .slice(0, 10);
  }, [searchQuery]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectDistrict = (id: string | null) => {
    setSelectedDistrictId(id);
    setActiveRiverId(null);
    if (id) {
      setSelectedDivisionId(null);
    }
  };

  const handleSelectDivision = (divId: string | null) => {
    setSelectedDivisionId(divId);
    setSelectedDistrictId(null);
    setActiveRiverId(null);
    if (divId) setActiveDirection('all');
  };

  const handleSelectDirection = (dir: DirectionZone) => {
    setActiveDirection(dir);
    setSelectedDistrictId(null);
    setSelectedDivisionId(null);
    setActiveRiverId(null);
  };

  const handleResetView = () => {
    setSelectedDistrictId(null);
    setSelectedDivisionId(null);
    setActiveDirection('all');
    setActiveRiverId(null);
    setSearchQuery('');
  };

  const navigateToPage = (page: ActivePage) => {
    setActivePage(page);
    scrollToTop();
  };

  const isDetailOpen =
    selectedDistrictId !== null ||
    selectedDivisionId !== null ||
    activeDirection !== 'all' ||
    activeRiverId !== null;

  const navItems: { id: ActivePage; labelBn: string; labelEn: string }[] = [
    { id: 'map', labelBn: 'মানচিত্র', labelEn: 'Map' },
    { id: 'divisions', labelBn: 'বিভাগ ও জেলা', labelEn: 'Divisions' },
    { id: 'rivers', labelBn: 'নদ-নদী', labelEn: 'Rivers' },
  ];

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
        {/* Mobile Page Navigation Strip + Theme Switch (non-sticky to stay under 15% mobile sticky cap) */}
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

        {/* PAGE 1: INTERACTIVE BANGLADESH MAP (No directory clutter below) */}
        {activePage === 'map' && (
          <>
            {/* Workspace Toolbar: Title, Search, Directional Filter, and Dark Mode Toggle */}
            <section className="mb-5">
              <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                <div className="max-w-2xl">
                  <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight text-balance">
                    {lang === 'bn'
                      ? 'বাংলাদেশের মানচিত্র · ৬৪ জেলা ও ৮ বিভাগ'
                      : 'Bangladesh Map · 64 Districts & 8 Divisions'}
                  </h1>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {lang === 'bn'
                      ? 'মানচিত্রের যেকোনো জেলায় ক্লিক করলে সেই জেলার মানচিত্র, পার্শ্ববর্তী জেলা, প্রবাহিত নদী ও গুরুত্বপূর্ণ তথ্য দেখা যাবে।'
                      : 'Click any district on the map to view its local map, highlighted bordering districts, flowing rivers, and key facts.'}
                  </p>
                </div>

                <div className="flex items-center gap-2.5 w-full lg:w-auto shrink-0">
                  {/* District & Division Search Box */}
                  <div className="relative flex-1 lg:w-72">
                    <label htmlFor="district-search" className="sr-only">
                      {lang === 'bn' ? 'জেলা খুঁজুন' : 'Search districts'}
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
                            ? 'জেলা খুঁজুন (যেমন: ঢাকা, সিলেট)'
                            : 'Search district (e.g. Dhaka)'
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
                      <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-30 max-h-72 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                        {searchResults.length > 0 ? (
                          searchResults.map((d) => (
                            <button
                              key={d.id}
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => {
                                handleSelectDistrict(d.id);
                                setSearchQuery('');
                                setSearchOpen(false);
                              }}
                              className="w-full px-3.5 py-2.5 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center justify-between gap-2 transition-colors"
                            >
                              <div>
                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                  {lang === 'bn'
                                    ? `${d.bnName} (${d.name})`
                                    : `${d.name} (${d.bnName})`}
                                </div>
                                <div className="text-xs text-slate-500 dark:text-slate-400">
                                  {lang === 'bn'
                                    ? `${DIVISION_META[d.divisionId]?.bnName} বিভাগ`
                                    : `${DIVISION_META[d.divisionId]?.name} Division`}
                                </div>
                              </div>
                            </button>
                          ))
                        ) : (
                          <div className="px-3.5 py-3 text-xs text-slate-500 dark:text-slate-400">
                            {lang === 'bn' ? 'কোনো জেলা পাওয়া যায়নি' : 'No matching district found'}
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

              {/* Directional Filter Toolbar */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400 mr-1">
                  {lang === 'bn' ? 'দিক অনুযায়ী:' : 'Region:'}
                </span>
                {(['all', 'north', 'south', 'east', 'west', 'central'] as DirectionZone[]).map(
                  (z) => {
                    const info = DIRECTION_INFO[z];
                    const isActive =
                      activeDirection === z &&
                      !selectedDistrictId &&
                      !selectedDivisionId &&
                      !activeRiverId;
                    return (
                      <button
                        key={z}
                        type="button"
                        onClick={() => handleSelectDirection(z)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                          isActive
                            ? 'bg-slate-900 dark:bg-emerald-600 text-white'
                            : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                        }`}
                      >
                        {lang === 'bn' ? info.labelBn : info.labelEn}
                      </button>
                    );
                  }
                )}
              </div>
            </section>

            {/* Map Stage: Initially Clean Full Bangladesh Map; Expands to 2-Column When a District/Region/River is Selected */}
            {isDetailOpen ? (
              <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                <div className="lg:col-span-7">
                  <BangladeshMapCanvas
                    districts={mapGeoData.districts}
                    divisions={mapGeoData.divisions}
                    rivers={mapGeoData.rivers}
                    selectedDistrictId={selectedDistrictId}
                    selectedDivisionId={selectedDivisionId}
                    activeDirection={activeDirection}
                    activeRiverId={activeRiverId}
                    showAllRivers={showAllRivers}
                    showAllLabels={showAllLabels}
                    lang={lang}
                    theme={theme}
                    onSelectDistrict={(id) => handleSelectDistrict(id)}
                    onToggleAllRivers={() => setShowAllRivers((v) => !v)}
                    onToggleAllLabels={() => setShowAllLabels((v) => !v)}
                    onResetView={handleResetView}
                  />
                </div>

                <div className="lg:col-span-5 lg:sticky lg:top-20">
                  <DistrictDetailPanel
                    districts={mapGeoData.districts}
                    rivers={mapGeoData.rivers}
                    selectedDistrictId={selectedDistrictId}
                    selectedDivisionId={selectedDivisionId}
                    activeDirection={activeDirection}
                    activeRiverId={activeRiverId}
                    lang={lang}
                    theme={theme}
                    onSelectDistrict={handleSelectDistrict}
                    onSelectDivision={handleSelectDivision}
                    onSelectDirection={handleSelectDirection}
                    onSelectRiver={setActiveRiverId}
                  />
                </div>
              </section>
            ) : (
              <section className="max-w-4xl mx-auto">
                <BangladeshMapCanvas
                  districts={mapGeoData.districts}
                  divisions={mapGeoData.divisions}
                  rivers={mapGeoData.rivers}
                  selectedDistrictId={selectedDistrictId}
                  selectedDivisionId={selectedDivisionId}
                  activeDirection={activeDirection}
                  activeRiverId={activeRiverId}
                  showAllRivers={showAllRivers}
                  showAllLabels={showAllLabels}
                  lang={lang}
                  theme={theme}
                  onSelectDistrict={(id) => handleSelectDistrict(id)}
                  onToggleAllRivers={() => setShowAllRivers((v) => !v)}
                  onToggleAllLabels={() => setShowAllLabels((v) => !v)}
                  onResetView={handleResetView}
                />
              </section>
            )}
          </>
        )}

        {/* PAGE 2: 64 DISTRICTS BY DIVISION */}
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
              selectedDistrictId={selectedDistrictId}
              lang={lang}
              onSelectDistrictOnMap={(id) => {
                handleSelectDistrict(id);
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

        {/* PAGE 3: MAJOR RIVERS & FLOWING DISTRICTS */}
        {activePage === 'rivers' && (
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
            <RiversDirectoryPage
              districts={mapGeoData.districts}
              rivers={mapGeoData.rivers}
              activeRiverId={activeRiverId}
              lang={lang}
              onSelectRiverOnMap={(riverId) => {
                setSelectedDistrictId(null);
                setSelectedDivisionId(null);
                setActiveDirection('all');
                setActiveRiverId(riverId);
                navigateToPage('map');
              }}
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
              ? 'বাংলাদেশ ইন্টারেক্টিভ মানচিত্র · ৬৪টি জেলা, ৮টি বিভাগ ও ৩০টি প্রধান নদ-নদী'
              : 'Bangladesh Interactive Atlas · 64 Districts, 8 Divisions & 30 Major Rivers'}
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
