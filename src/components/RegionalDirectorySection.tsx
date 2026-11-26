import React, { useMemo, useState } from 'react';
import { Waves, ArrowUpRight, Search, X, ArrowLeft } from 'lucide-react';
import { DIVISION_META } from '../data/bdDistrictDetails';
import { RIVER_DETAILS } from '../data/bdRiverDetails';
import { formatNum } from '../utils/format';
import type { GeoDistrict, GeoRiver, GeoUpazila, Lang } from '../types/map';

interface DivisionsDirectoryPageProps {
  districts: GeoDistrict[];
  upazilas: GeoUpazila[];
  selectedDistrictId: string | null;
  lang: Lang;
  onSelectDistrictOnMap: (id: string) => void;
  onSelectUpazilaOnMap: (id: string) => void;
  onSelectDivisionOnMap: (divisionId: string) => void;
  onBackToMap: () => void;
}

export const DivisionsDirectoryPage: React.FC<DivisionsDirectoryPageProps> = ({
  districts,
  upazilas,
  selectedDistrictId,
  lang,
  onSelectDistrictOnMap,
  onSelectUpazilaOnMap,
  onSelectDivisionOnMap,
  onBackToMap,
}) => {
  const [filterText, setFilterText] = useState('');
  const divisionsOrdered = ['6', '5', '8', '7', '3', '4', '1', '2'];

  const q = filterText.trim().toLowerCase();
  const districtById = useMemo(
    () => new Map(districts.map((d) => [d.id, d])),
    [districts]
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-2xl">
          <button
            type="button"
            onClick={onBackToMap}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'মানচিত্রে ফিরে যান' : 'Back to Map'}</span>
          </button>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight text-balance">
            {lang === 'bn'
              ? `বিভাগ অনুযায়ী বাংলাদেশের ৬৪ জেলা ও ${formatNum(upazilas.length, lang)} উপজেলা`
              : `All 64 Districts & ${upazilas.length} Upazilas by Division`}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
            {lang === 'bn'
              ? 'বাংলাদেশের ৮টি বিভাগ, ৬৪টি জেলা ও সকল উপজেলার তালিকা। যেকোনো জেলা, উপজেলা বা বিভাগে ক্লিক করলে সরাসরি মানচিত্রে তার অবস্থান, পার্শ্ববর্তী সীমানা, প্রবাহিত নদী ও বিস্তারিত তথ্য খুলবে।'
              : 'Explore all 8 divisions, 64 districts, and all upazilas of Bangladesh. Click any item to open its location, neighbors, rivers, and dossier on the map.'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder={
                lang === 'bn'
                  ? 'বিভাগ, জেলা বা উপজেলা খুঁজুন...'
                  : 'Filter division, district or upazila...'
              }
              className="w-full pl-10 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
            />
            {filterText && (
              <button
                type="button"
                onClick={() => setFilterText('')}
                aria-label={lang === 'bn' ? 'মুছুন' : 'Clear'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className="hidden sm:inline font-mono-tabular text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {lang === 'bn'
              ? `৮ বিভাগ · ৬৪ জেলা · ${formatNum(upazilas.length, lang)} উপজেলা`
              : `8 Div · 64 Dist · ${upazilas.length} Upazilas`}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {divisionsOrdered.map((divId) => {
          const meta = DIVISION_META[divId];
          const allDivDistricts = districts
            .filter((d) => d.divisionId === divId)
            .sort((a, b) => a.name.localeCompare(b.name));
          const allDivUpazilas = upazilas
            .filter((u) => u.divisionId === divId)
            .sort((a, b) => a.name.localeCompare(b.name));

          const divMatches =
            !q ||
            meta.name.toLowerCase().includes(q) ||
            meta.bnName.includes(q);

          const matchingUpazilas = q
            ? allDivUpazilas.filter(
                (u) => u.name.toLowerCase().includes(q) || u.bnName.includes(q)
              )
            : allDivUpazilas;

          const visibleDistricts = divMatches
            ? allDivDistricts
            : allDivDistricts.filter(
                (d) =>
                  d.name.toLowerCase().includes(q) ||
                  d.bnName.includes(q) ||
                  matchingUpazilas.some((u) => u.districtId === d.id)
              );

          if (visibleDistricts.length === 0 && matchingUpazilas.length === 0) return null;

          return (
            <div
              key={divId}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-4 transition-colors"
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? meta.directionBn : meta.directionEn}
                      <span aria-hidden="true"> · </span>
                      <span className="font-mono-tabular">
                        {formatNum(meta.areaKm2, lang)} {lang === 'bn' ? 'বর্গকিমি' : 'km²'}
                      </span>
                      <span aria-hidden="true"> · </span>
                      <span className="font-mono-tabular">
                        {formatNum(allDivDistricts.length, lang)} {lang === 'bn' ? 'জেলা' : 'dist'} ·{' '}
                        {formatNum(allDivUpazilas.length, lang)} {lang === 'bn' ? 'উপজেলা' : 'upazilas'}
                      </span>
                    </div>
                    <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white mt-0.5">
                      {lang === 'bn' ? `${meta.bnName} বিভাগ` : `${meta.name} Division`}
                    </h2>
                  </div>

                  <button
                    type="button"
                    onClick={() => onSelectDivisionOnMap(divId)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
                  >
                    <span>{lang === 'bn' ? 'মানচিত্রে দেখুন' : 'Show on Map'}</span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 leading-relaxed">
                  {lang === 'bn' ? meta.summaryBn : meta.summaryEn}
                </p>
              </div>

              <div className="space-y-3.5 pt-3 border-t border-slate-100 dark:border-slate-800">
                <div>
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                    {lang === 'bn'
                      ? `জেলাসমূহ (${formatNum(visibleDistricts.length, lang)}টি)`
                      : `Districts (${visibleDistricts.length})`}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {visibleDistricts.map((d) => {
                      const isActive = selectedDistrictId === d.id;
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => onSelectDistrictOnMap(d.id)}
                          className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${
                            isActive
                              ? 'bg-emerald-700 dark:bg-emerald-600 text-white'
                              : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 hover:border-emerald-300 dark:hover:border-emerald-700 hover:text-emerald-900 dark:hover:text-emerald-200'
                          }`}
                        >
                          {lang === 'bn' ? d.bnName : d.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 mb-2">
                    {lang === 'bn'
                      ? `উপজেলা ও থানাসমূহ (${formatNum(matchingUpazilas.length, lang)}টি)`
                      : `Upazilas & Thanas (${matchingUpazilas.length})`}
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-52 overflow-y-auto pr-1">
                    {matchingUpazilas.map((u) => {
                      const pd = districtById.get(u.districtId);
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => onSelectUpazilaOnMap(u.id)}
                          className="px-2 py-1 rounded-md bg-emerald-50/70 dark:bg-emerald-950/40 hover:bg-emerald-100 dark:hover:bg-emerald-900/70 border border-emerald-200/80 dark:border-emerald-800/80 text-[11px] font-medium text-emerald-950 dark:text-emerald-200 transition-colors"
                        >
                          {lang === 'bn'
                            ? `${u.bnName} · ${pd?.bnName || ''}`
                            : `${u.name} · ${pd?.name || ''}`}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};

interface RiversDirectoryPageProps {
  districts: GeoDistrict[];
  rivers: GeoRiver[];
  activeRiverId: string | null;
  lang: Lang;
  onSelectRiverOnMap: (riverId: string) => void;
  onBackToMap: () => void;
}

export const RiversDirectoryPage: React.FC<RiversDirectoryPageProps> = ({
  districts,
  rivers,
  activeRiverId,
  lang,
  onSelectRiverOnMap,
  onBackToMap,
}) => {
  const [riverSearch, setRiverSearch] = useState('');

  const districtById = useMemo(
    () => new Map(districts.map((d) => [d.id, d])),
    [districts]
  );

  const filteredRivers = useMemo(() => {
    const q = riverSearch.trim().toLowerCase();
    if (!q) return rivers;
    return rivers.filter((r) => {
      const detail = RIVER_DETAILS[r.id];
      const districtMatch = r.districts.some((did) => {
        const d = districtById.get(did);
        return d && (d.name.toLowerCase().includes(q) || d.bnName.includes(q));
      });
      return (
        r.name.toLowerCase().includes(q) ||
        r.bnName.includes(q) ||
        districtMatch ||
        (detail?.originBn.includes(q) ?? false) ||
        (detail?.originEn.toLowerCase().includes(q) ?? false) ||
        (detail?.mouthBn.includes(q) ?? false) ||
        (detail?.mouthEn.toLowerCase().includes(q) ?? false)
      );
    });
  }, [rivers, riverSearch, districtById]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-2xl">
          <button
            type="button"
            onClick={onBackToMap}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-sky-700 dark:text-sky-400 hover:underline mb-2"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'মানচিত্রে ফিরে যান' : 'Back to Map'}</span>
          </button>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight text-balance">
            {lang === 'bn'
              ? 'বাংলাদেশের প্রধান নদ-নদী ও প্রবাহিত জেলা'
              : 'Major Rivers of Bangladesh & Courses'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
            {lang === 'bn'
              ? 'প্রতিটি নদীর উৎপত্তিস্থল, মোহনা, উপনদী ও প্রবাহিত জেলা জানুন। যেকোনো নদীতে ক্লিক করলে বাংলাদেশের মানচিত্রে তার সম্পূর্ণ গতিপথ দেখাবে।'
              : 'Explore the origin, mouth, tributaries, and flowing districts of each river. Click any river to view its entire course across Bangladesh on the map.'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="relative w-full sm:w-68">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={riverSearch}
              onChange={(e) => setRiverSearch(e.target.value)}
              placeholder={
                lang === 'bn'
                  ? 'নদী বা জেলা খুঁজুন (যেমন: পদ্মা)'
                  : 'Search river or district...'
              }
              className="w-full pl-10 pr-8 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-sky-600 focus:ring-2 focus:ring-sky-600/15"
            />
            {riverSearch && (
              <button
                type="button"
                onClick={() => setRiverSearch('')}
                aria-label={lang === 'bn' ? 'মুছুন' : 'Clear'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className="hidden sm:inline font-mono-tabular text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
            {lang === 'bn'
              ? `${formatNum(filteredRivers.length, lang)}টি নদী`
              : `${filteredRivers.length} Rivers`}
          </span>
        </div>
      </div>

      {filteredRivers.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-8 text-center text-sm text-slate-500 dark:text-slate-400">
          {lang === 'bn'
            ? 'আপনার খোঁজা অনুযায়ী কোনো নদী পাওয়া যায়নি।'
            : 'No rivers matched your search.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredRivers.map((r) => {
            const isSelected = activeRiverId === r.id;
            const riverDetail = RIVER_DETAILS[r.id];
            const districtNames = r.districts
              .map((id) => districtById.get(id))
              .filter((d): d is GeoDistrict => Boolean(d))
              .map((d) => (lang === 'bn' ? d.bnName : d.name));

            return (
              <button
                key={r.id}
                type="button"
                onClick={() => onSelectRiverOnMap(r.id)}
                className={`text-left p-5 rounded-xl border transition-colors flex flex-col justify-between gap-3.5 ${
                  isSelected
                    ? 'bg-sky-50 dark:bg-sky-950/60 border-sky-400 dark:border-sky-600'
                    : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-sky-400 dark:hover:border-sky-600 hover:bg-slate-50/70 dark:hover:bg-slate-800/40'
                }`}
              >
                <div className="space-y-2.5 w-full">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Waves className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                      <div>
                        <h2 className="font-display text-base font-bold text-slate-900 dark:text-slate-100 leading-tight">
                          {lang === 'bn' ? `${r.bnName} নদী` : `${r.name} River`}
                        </h2>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">
                          {lang === 'bn' ? r.name : r.bnName}
                          {riverDetail && (
                            <>
                              <span aria-hidden="true"> · </span>
                              <span>{lang === 'bn' ? riverDetail.basinBn : riverDetail.basinEn}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="font-mono-tabular text-xs font-semibold text-sky-700 dark:text-sky-400 shrink-0">
                      ~{formatNum(r.lengthKm, lang)} {lang === 'bn' ? 'কিমি' : 'km'}
                    </span>
                  </div>

                  {riverDetail && (
                    <div className="space-y-1.5 text-xs pt-2 border-t border-slate-100 dark:border-slate-800">
                      <div>
                        <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                          {lang === 'bn' ? 'উৎপত্তি: ' : 'Origin: '}
                        </span>
                        <span className="text-slate-700 dark:text-slate-300">
                          {lang === 'bn' ? riverDetail.originBn : riverDetail.originEn}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-blue-700 dark:text-blue-400">
                          {lang === 'bn' ? 'মোহনা: ' : 'Mouth: '}
                        </span>
                        <span className="text-slate-700 dark:text-slate-300">
                          {lang === 'bn' ? riverDetail.mouthBn : riverDetail.mouthEn}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 w-full space-y-2">
                  <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {lang === 'bn'
                      ? `প্রবাহিত জেলা (${formatNum(districtNames.length, lang)}টি):`
                      : `Flowing Districts (${districtNames.length}):`}
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                    {districtNames.join(' · ')}
                  </p>
                  <div className="inline-flex items-center gap-1 text-xs font-semibold text-sky-700 dark:text-sky-400 pt-0.5">
                    <span>
                      {lang === 'bn' ? 'মানচিত্রে পূর্ণ গতিপথ দেখুন' : 'View full course on map'}
                    </span>
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
};
