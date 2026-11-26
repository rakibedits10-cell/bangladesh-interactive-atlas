import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  Clock,
  Pencil,
  Play,
  RotateCcw,
  Search,
  Sparkles,
  Trash2,
  Trophy,
  Upload,
  User,
  X,
  XCircle,
} from 'lucide-react';
import { DIVISION_META } from '../data/bdDistrictDetails';
import { formatNum } from '../utils/format';
import {
  generateQuizQuestions,
  type QuizCategory,
  type QuizConfig,
  type QuizLength,
  type QuizQuestion,
  type QuizScopeType,
} from '../utils/quizGenerator';
import type { GeoDistrict, GeoDivision, GeoRiver, GeoUpazila, Lang } from '../types/map';

interface QuizPageProps {
  divisions: GeoDivision[];
  districts: GeoDistrict[];
  upazilas: GeoUpazila[];
  rivers: GeoRiver[];
  lang: Lang;
  onBackToMap: () => void;
}

export type AvatarPresetId =
  | 'emerald_compass'
  | 'padma_wave'
  | 'sundar_leaf'
  | 'hill_peak'
  | 'terracotta_sun'
  | 'royal_shield'
  | 'shapla_bloom'
  | 'delta_star';

export interface LeaderboardEntry {
  id: string;
  playerName: string;
  avatarId?: AvatarPresetId;
  customAvatar?: string;
  score: number;
  totalQuestions: QuizLength;
  points?: number;
  accuracy: number;
  durationSec: number;
  scopeType: QuizScopeType;
  scopeLabelBn: string;
  scopeLabelEn: string;
  category: QuizCategory;
  createdAt: number;
}

interface PlayerStanding {
  key: string;
  playerName: string;
  avatarId?: AvatarPresetId;
  customAvatar?: string;
  totalPoints: number;
  quizzesCount: number;
  totalScore: number;
  totalQuestions: number;
  avgAccuracy: number;
  bestAccuracy: number;
  fastestSec: number;
  lastPlayedAt: number;
}

interface PickerOption {
  id: string;
  labelBn: string;
  labelEn: string;
  subBn?: string;
  subEn?: string;
}

const LEADERBOARD_STORAGE_KEY = 'bd_atlas_quiz_leaderboard_v1';
const PLAYER_NAME_STORAGE_KEY = 'bd_atlas_quiz_player_v1';
const PLAYER_AVATAR_STORAGE_KEY = 'bd_atlas_quiz_avatar_v1';

const POINTS_PER_MARK = 10;
const OPTION_LETTERS_BN = ['ক', 'খ', 'গ', 'ঘ'];
const OPTION_LETTERS_EN = ['A', 'B', 'C', 'D'];

const AVATAR_PRESETS: {
  id: AvatarPresetId;
  labelBn: string;
  labelEn: string;
  bg: string;
  fg: string;
  accent: string;
}[] = [
  {
    id: 'emerald_compass',
    labelBn: 'কম্পাস',
    labelEn: 'Compass',
    bg: '#047857',
    fg: '#ECFDF5',
    accent: '#6EE7B7',
  },
  {
    id: 'padma_wave',
    labelBn: 'নদী',
    labelEn: 'River',
    bg: '#0369A1',
    fg: '#F0F9FF',
    accent: '#7DD3FC',
  },
  {
    id: 'sundar_leaf',
    labelBn: 'সুন্দরবন',
    labelEn: 'Forest',
    bg: '#15803D',
    fg: '#F0FDF4',
    accent: '#86EFAC',
  },
  {
    id: 'hill_peak',
    labelBn: 'পাহাড়',
    labelEn: 'Hills',
    bg: '#4338CA',
    fg: '#EEF2FF',
    accent: '#A5B4FC',
  },
  {
    id: 'terracotta_sun',
    labelBn: 'সূর্য',
    labelEn: 'Sun',
    bg: '#C2410C',
    fg: '#FFF7ED',
    accent: '#FDBA74',
  },
  {
    id: 'royal_shield',
    labelBn: 'বেঙ্গল',
    labelEn: 'Shield',
    bg: '#B45309',
    fg: '#FFFBEB',
    accent: '#FDE68A',
  },
  {
    id: 'shapla_bloom',
    labelBn: 'শাপলা',
    labelEn: 'Lotus',
    bg: '#BE185D',
    fg: '#FDF2F8',
    accent: '#F9A8D4',
  },
  {
    id: 'delta_star',
    labelBn: 'তারকা',
    labelEn: 'Star',
    bg: '#0F172A',
    fg: '#F8FAFC',
    accent: '#38BDF8',
  },
];

function getDefaultAvatarForName(name: string): AvatarPresetId {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return AVATAR_PRESETS[hash % AVATAR_PRESETS.length].id;
}

function resizeImageToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas unavailable'));
          return;
        }
        const minSide = Math.min(img.width, img.height);
        const sx = (img.width - minSide) / 2;
        const sy = (img.height - minSide) / 2;
        ctx.drawImage(img, sx, sy, minSide, minSide, 0, 0, size, size);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = String(reader.result || '');
    };
    reader.onerror = () => reject(new Error('File read failed'));
    reader.readAsDataURL(file);
  });
}

const AvatarBadge: React.FC<{
  name: string;
  avatarId?: AvatarPresetId;
  customAvatar?: string;
  sizeClass?: string;
}> = ({ name, avatarId, customAvatar, sizeClass = 'w-9 h-9' }) => {
  if (customAvatar) {
    return (
      <img
        src={customAvatar}
        alt={name || 'Player avatar'}
        className={`${sizeClass} rounded-full object-cover border border-slate-200 dark:border-slate-700 shrink-0 bg-slate-100 dark:bg-slate-800`}
      />
    );
  }

  const preset =
    AVATAR_PRESETS.find((p) => p.id === avatarId) ||
    AVATAR_PRESETS.find((p) => p.id === getDefaultAvatarForName(name || 'BD')) ||
    AVATAR_PRESETS[0];

  return (
    <span
      className={`${sizeClass} rounded-full inline-flex items-center justify-center shrink-0 border border-black/10 dark:border-white/15 overflow-hidden`}
      style={{ backgroundColor: preset.bg, color: preset.fg }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 36 36" className="w-full h-full">
        {preset.id === 'emerald_compass' && (
          <>
            <circle cx="18" cy="18" r="10" fill="none" stroke={preset.accent} strokeWidth="1.8" />
            <polygon points="18,9 21,18 18,27 15,18" fill={preset.fg} />
          </>
        )}
        {preset.id === 'padma_wave' && (
          <>
            <path
              d="M7 15c3-3 6-3 9 0s6 3 9 0 4-2 4-2"
              fill="none"
              stroke={preset.fg}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M7 22c3-3 6-3 9 0s6 3 9 0 4-2 4-2"
              fill="none"
              stroke={preset.accent}
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </>
        )}
        {preset.id === 'sundar_leaf' && (
          <>
            <path
              d="M18 8c5 3 8 8 6 14-2 4-6 6-6 6s-4-2-6-6c-2-6 1-11 6-14Z"
              fill={preset.accent}
            />
            <line x1="18" y1="12" x2="18" y2="27" stroke={preset.bg} strokeWidth="1.8" />
          </>
        )}
        {preset.id === 'hill_peak' && (
          <>
            <polygon points="6,26 15,12 24,26" fill={preset.fg} />
            <polygon points="15,26 23,15 30,26" fill={preset.accent} />
          </>
        )}
        {preset.id === 'terracotta_sun' && (
          <>
            <circle cx="18" cy="18" r="6" fill={preset.fg} />
            <circle cx="18" cy="18" r="10" fill="none" stroke={preset.accent} strokeWidth="2" strokeDasharray="3 3" />
          </>
        )}
        {preset.id === 'royal_shield' && (
          <path
            d="M18 8l8 3v7c0 5-3.4 9.2-8 10.6C13.4 27.2 10 23 10 18v-7l8-3Z"
            fill={preset.accent}
          />
        )}
        {preset.id === 'shapla_bloom' && (
          <>
            <ellipse cx="18" cy="16" rx="3.4" ry="7.5" fill={preset.fg} />
            <ellipse cx="13" cy="19" rx="3" ry="6" transform="rotate(-28 13 19)" fill={preset.accent} />
            <ellipse cx="23" cy="19" rx="3" ry="6" transform="rotate(28 23 19)" fill={preset.accent} />
            <path d="M11 25h14" stroke={preset.fg} strokeWidth="2" strokeLinecap="round" />
          </>
        )}
        {preset.id === 'delta_star' && (
          <polygon
            points="18,8 20.8,14.2 27.5,14.9 22.4,19.4 23.9,26 18,22.4 12.1,26 13.6,19.4 8.5,14.9 15.2,14.2"
            fill={preset.accent}
          />
        )}
      </svg>
    </span>
  );
};

const SearchableSelect: React.FC<{
  id: string;
  label: string;
  value: string;
  options: PickerOption[];
  placeholderBn: string;
  placeholderEn: string;
  lang: Lang;
  onChange: (id: string) => void;
}> = ({ id, label, value, options, placeholderBn, placeholderEn, lang, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    window.addEventListener('keydown', onKey);
    const t = window.setTimeout(() => inputRef.current?.focus(), 20);
    return () => {
      document.removeEventListener('mousedown', onOutside);
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(t);
    };
  }, [open]);

  const selected = useMemo(
    () => options.find((o) => o.id === value) || options[0],
    [options, value]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) =>
        o.labelBn.toLowerCase().includes(q) ||
        o.labelEn.toLowerCase().includes(q) ||
        (o.subBn?.toLowerCase().includes(q) ?? false) ||
        (o.subEn?.toLowerCase().includes(q) ?? false)
    );
  }, [options, query]);

  const toggleOpen = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) setQuery('');
      return next;
    });
  };

  return (
    <div ref={containerRef} className="relative">
      <label
        htmlFor={id}
        className="block text-xs text-slate-500 dark:text-slate-400 mb-1.5"
      >
        {label}
      </label>

      <div className="flex items-stretch gap-2">
        <button
          id={id}
          type="button"
          onClick={toggleOpen}
          aria-expanded={open}
          className="flex-1 min-w-0 flex items-center justify-between gap-2 px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-emerald-600 rounded-lg text-sm text-left text-slate-900 dark:text-slate-100 transition-colors"
        >
          <span className="truncate font-medium">
            {selected
              ? lang === 'bn'
                ? `${selected.labelBn}${selected.subBn ? ` (${selected.subBn})` : ''}`
                : `${selected.labelEn}${selected.subEn ? ` (${selected.subEn})` : ''}`
              : lang === 'bn'
              ? placeholderBn
              : placeholderEn}
          </span>
          <ChevronDown
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
              open ? 'rotate-180' : ''
            }`}
          />
        </button>

        <button
          type="button"
          onClick={() => {
            setQuery('');
            setOpen(true);
            window.setTimeout(() => inputRef.current?.focus(), 20);
          }}
          aria-label={lang === 'bn' ? `${label} খুঁজুন` : `Search ${label}`}
          className="inline-flex items-center gap-1.5 px-3 py-2.5 bg-slate-50 dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-200 shrink-0 transition-colors"
        >
          <Search className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
          <span>{lang === 'bn' ? 'খুঁজুন' : 'Search'}</span>
        </button>
      </div>

      {open && (
        <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-40 overflow-hidden">
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={lang === 'bn' ? placeholderBn : placeholderEn}
                className="w-full pl-8 pr-8 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label={lang === 'bn' ? 'মুছুন' : 'Clear'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70">
            {filtered.length > 0 ? (
              filtered.map((opt) => {
                const isSelected = opt.id === value;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => {
                      onChange(opt.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    className={`w-full flex items-center justify-between gap-2 px-3.5 py-2.5 text-left text-xs transition-colors ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-200 font-semibold'
                        : 'text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="truncate">
                        {lang === 'bn' ? opt.labelBn : opt.labelEn}
                      </div>
                      {(opt.subBn || opt.subEn) && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {lang === 'bn' ? opt.subBn : opt.subEn}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    )}
                  </button>
                );
              })
            ) : (
              <div className="px-4 py-6 text-center text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'কোনো ফলাফল পাওয়া যায়নি' : 'No matching item found'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

function formatTimer(sec: number, lang: Lang): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = s < 10 ? `0${s}` : `${s}`;
  return lang === 'bn'
    ? `${formatNum(Number(mm[0]), 'bn')}${formatNum(Number(mm[1]), 'bn')}:${formatNum(
        Number(ss[0]),
        'bn'
      )}${formatNum(Number(ss[1]), 'bn')}`
    : `${mm}:${ss}`;
}

function getCategoryLabel(cat: QuizCategory, lang: Lang): string {
  if (cat === 'mixed') return lang === 'bn' ? 'মিশ্র কুইজ' : 'Mixed Quiz';
  if (cat === 'geography_borders') {
    return lang === 'bn' ? 'মানচিত্র ও সীমান্ত' : 'Map & Borders';
  }
  if (cat === 'rivers') return lang === 'bn' ? 'নদ-নদী ও গতিপথ' : 'Rivers & Basins';
  return lang === 'bn' ? 'ঐতিহ্য ও দর্শনীয় স্থান' : 'Heritage & Landmarks';
}

function getScopeTypeLabel(scope: QuizScopeType, lang: Lang): string {
  if (scope === 'bangladesh') return lang === 'bn' ? 'পুরো বাংলাদেশ' : 'Bangladesh';
  if (scope === 'division') return lang === 'bn' ? 'বিভাগ' : 'Division';
  if (scope === 'district') return lang === 'bn' ? 'জেলা' : 'District';
  return lang === 'bn' ? 'উপজেলা' : 'Upazila';
}

export const QuizPage: React.FC<QuizPageProps> = ({
  divisions,
  districts,
  upazilas,
  rivers,
  lang,
  onBackToMap,
}) => {
  const [subTab, setSubTab] = useState<'play' | 'leaderboard'>('play');
  const [lbViewMode, setLbViewMode] = useState<'points' | 'history'>('points');

  const [playerName, setPlayerName] = useState<string>(() => {
    try {
      return localStorage.getItem(PLAYER_NAME_STORAGE_KEY) || '';
    } catch {
      return '';
    }
  });

  const [avatarConfig, setAvatarConfig] = useState<{
    presetId: AvatarPresetId;
    customUrl?: string;
  }>(() => {
    try {
      const raw = localStorage.getItem(PLAYER_AVATAR_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.presetId === 'string') {
          return {
            presetId: parsed.presetId as AvatarPresetId,
            customUrl: typeof parsed.customUrl === 'string' ? parsed.customUrl : undefined,
          };
        }
      }
    } catch {
      // ignore storage errors
    }
    return { presetId: 'emerald_compass' };
  });

  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);

  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(() => {
    try {
      const raw = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  // Quiz Setup State
  const [scopeType, setScopeType] = useState<QuizScopeType>('bangladesh');
  const [selectedDivId, setSelectedDivId] = useState<string>(divisions[0]?.id || '3');
  const [selectedDistId, setSelectedDistId] = useState<string>(districts[0]?.id || '1');
  const [selectedUpazilaDistId, setSelectedUpazilaDistId] = useState<string>('all');
  const [selectedUpazilaId, setSelectedUpazilaId] = useState<string>(
    upazilas[0]?.id || ''
  );
  const [category, setCategory] = useState<QuizCategory>('mixed');
  const [questionCount, setQuestionCount] = useState<QuizLength>(10);

  // Active Quiz Gameplay State (answers array holds selected index per question; no premature right/wrong)
  const [stage, setStage] = useState<'setup' | 'active' | 'result'>('setup');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [elapsedSec, setElapsedSec] = useState<number>(0);
  const [activeConfig, setActiveConfig] = useState<QuizConfig | null>(null);
  const [savedEntryId, setSavedEntryId] = useState<string | null>(null);
  const [nameError, setNameError] = useState<boolean>(false);

  // Leaderboard Filters State
  const [lbLengthFilter, setLbLengthFilter] = useState<'all' | QuizLength>('all');
  const [lbScopeFilter, setLbScopeFilter] = useState<'all' | QuizScopeType>('all');
  const [lbSearch, setLbSearch] = useState<string>('');
  const [confirmClearLb, setConfirmClearLb] = useState<boolean>(false);

  useEffect(() => {
    try {
      localStorage.setItem(LEADERBOARD_STORAGE_KEY, JSON.stringify(leaderboard));
    } catch {
      // ignore storage errors
    }
  }, [leaderboard]);

  useEffect(() => {
    try {
      localStorage.setItem(PLAYER_NAME_STORAGE_KEY, playerName);
    } catch {
      // ignore storage errors
    }
  }, [playerName]);

  useEffect(() => {
    try {
      localStorage.setItem(PLAYER_AVATAR_STORAGE_KEY, JSON.stringify(avatarConfig));
    } catch {
      // ignore storage errors
    }
  }, [avatarConfig]);

  useEffect(() => {
    if (stage !== 'active') return;
    const id = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [stage]);

  const divMap = useMemo(() => new Map(divisions.map((d) => [d.id, d])), [divisions]);
  const distMap = useMemo(() => new Map(districts.map((d) => [d.id, d])), [districts]);
  const upazilaMap = useMemo(() => new Map(upazilas.map((u) => [u.id, u])), [upazilas]);

  const sortedDistricts = useMemo(
    () =>
      [...districts].sort((a, b) =>
        lang === 'bn' ? a.bnName.localeCompare(b.bnName, 'bn') : a.name.localeCompare(b.name)
      ),
    [districts, lang]
  );

  const districtPickerOptions = useMemo<PickerOption[]>(
    () =>
      sortedDistricts.map((d) => ({
        id: d.id,
        labelBn: `${d.bnName} জেলা`,
        labelEn: `${d.name} District`,
        subBn: `${DIVISION_META[d.divisionId]?.bnName || ''} বিভাগ`,
        subEn: `${DIVISION_META[d.divisionId]?.name || ''} Div.`,
      })),
    [sortedDistricts]
  );

  const upazilaDistrictFilterOptions = useMemo<PickerOption[]>(
    () => [
      {
        id: 'all',
        labelBn: 'সকল জেলা (৫৪৪ উপজেলা)',
        labelEn: 'All Districts (544 Upazilas)',
        subBn: 'সরাসরি যেকোনো উপজেলা খুঁজুন',
        subEn: 'Search any upazila directly',
      },
      ...districtPickerOptions,
    ],
    [districtPickerOptions]
  );

  const upazilasForPicker = useMemo(() => {
    const list =
      selectedUpazilaDistId === 'all'
        ? upazilas
        : upazilas.filter((u) => u.districtId === selectedUpazilaDistId);
    return [...list].sort((a, b) =>
      lang === 'bn' ? a.bnName.localeCompare(b.bnName, 'bn') : a.name.localeCompare(b.name)
    );
  }, [upazilas, selectedUpazilaDistId, lang]);

  const upazilaPickerOptions = useMemo<PickerOption[]>(
    () =>
      upazilasForPicker.map((u) => {
        const pd = distMap.get(u.districtId);
        const pdiv = DIVISION_META[u.divisionId];
        return {
          id: u.id,
          labelBn: u.bnName,
          labelEn: u.name,
          subBn: `${pd?.bnName || ''} জেলা${pdiv ? `, ${pdiv.bnName}` : ''}`,
          subEn: `${pd?.name || ''} Dist.${pdiv ? `, ${pdiv.name}` : ''}`,
        };
      }),
    [upazilasForPicker, distMap]
  );

  useEffect(() => {
    if (
      upazilasForPicker.length > 0 &&
      !upazilasForPicker.some((u) => u.id === selectedUpazilaId)
    ) {
      setSelectedUpazilaId(upazilasForPicker[0].id);
    }
  }, [upazilasForPicker, selectedUpazilaId]);

  const handleUploadCustomAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAvatarError(
        lang === 'bn' ? 'অনুগ্রহ করে একটি ছবির ফাইল নির্বাচন করুন।' : 'Please select an image file.'
      );
      return;
    }
    try {
      const dataUrl = await resizeImageToDataUrl(file);
      setAvatarConfig((prev) => ({ ...prev, customUrl: dataUrl }));
      setAvatarError(null);
    } catch {
      setAvatarError(
        lang === 'bn' ? 'ছবি লোড করা যায়নি, অন্য ছবি চেষ্টা করুন।' : 'Could not process image.'
      );
    }
  };

  const getScopeLabels = (cfg: QuizConfig): { bn: string; en: string } => {
    if (cfg.scopeType === 'bangladesh') {
      return { bn: 'পুরো বাংলাদেশ', en: 'Whole Bangladesh' };
    }
    if (cfg.scopeType === 'division') {
      const dv = divMap.get(cfg.scopeId || '');
      return {
        bn: dv ? `${dv.bnName} বিভাগ` : 'বিভাগ',
        en: dv ? `${dv.name} Division` : 'Division',
      };
    }
    if (cfg.scopeType === 'district') {
      const d = distMap.get(cfg.scopeId || '');
      return {
        bn: d ? `${d.bnName} জেলা` : 'জেলা',
        en: d ? `${d.name} District` : 'District',
      };
    }
    const u = upazilaMap.get(cfg.scopeId || '');
    const pd = u ? distMap.get(u.districtId) : undefined;
    return {
      bn: u ? `${u.bnName}${pd ? ` (${pd.bnName})` : ''}` : 'উপজেলা',
      en: u ? `${u.name}${pd ? ` (${pd.name})` : ''}` : 'Upazila',
    };
  };

  const currentScopeId =
    scopeType === 'division'
      ? selectedDivId
      : scopeType === 'district'
      ? selectedDistId
      : scopeType === 'upazila'
      ? selectedUpazilaId
      : undefined;

  const startQuiz = (overrideConfig?: QuizConfig) => {
    const cfg: QuizConfig = overrideConfig || {
      scopeType,
      scopeId: currentScopeId,
      category,
      questionCount,
    };
    const generated = generateQuizQuestions(cfg, {
      divisions,
      districts,
      upazilas,
      rivers,
    });
    if (generated.length === 0) return;
    setActiveConfig(cfg);
    setQuestions(generated);
    setCurrentIdx(0);
    setAnswers(Array(generated.length).fill(null));
    setElapsedSec(0);
    setSavedEntryId(null);
    setNameError(false);
    setSubTab('play');
    setStage('active');
  };

  const selectedOption = answers[currentIdx] ?? null;
  const answeredCount = useMemo(
    () => answers.filter((a) => a !== null).length,
    [answers]
  );

  const handleChooseOption = (idx: number) => {
    setAnswers((prev) => {
      const next = [...prev];
      next[currentIdx] = idx;
      return next;
    });
  };

  const handleNextOrFinish = () => {
    if (answers[currentIdx] === null) return;
    if (currentIdx + 1 < questions.length) {
      setCurrentIdx((i) => i + 1);
    } else {
      setStage('result');
    }
  };

  const scoreCount = useMemo(
    () =>
      answers.reduce<number>((acc, ans, idx) => {
        const q = questions[idx];
        return q && ans === q.correctIndex ? acc + 1 : acc;
      }, 0),
    [answers, questions]
  );

  const earnedPoints = scoreCount * POINTS_PER_MARK;

  // Player Points Standings (cumulative points across quizzes for each player)
  const playerStandings = useMemo<PlayerStanding[]>(() => {
    const map = new Map<
      string,
      {
        key: string;
        playerName: string;
        avatarId?: AvatarPresetId;
        customAvatar?: string;
        totalPoints: number;
        quizzesCount: number;
        totalScore: number;
        totalQuestions: number;
        bestAccuracy: number;
        fastestSec: number;
        lastPlayedAt: number;
      }
    >();

    // Sort chronologically ascending so later avatar/name casing updates profile cleanly
    const ordered = [...leaderboard].sort((a, b) => a.createdAt - b.createdAt);
    for (const entry of ordered) {
      const key = entry.playerName.trim().toLowerCase();
      const entryPts = entry.points ?? entry.score * POINTS_PER_MARK;
      const prev = map.get(key);
      if (!prev) {
        map.set(key, {
          key,
          playerName: entry.playerName,
          avatarId: entry.avatarId,
          customAvatar: entry.customAvatar,
          totalPoints: entryPts,
          quizzesCount: 1,
          totalScore: entry.score,
          totalQuestions: entry.totalQuestions,
          bestAccuracy: entry.accuracy,
          fastestSec: entry.durationSec,
          lastPlayedAt: entry.createdAt,
        });
      } else {
        prev.playerName = entry.playerName;
        if (entry.avatarId) prev.avatarId = entry.avatarId;
        if (entry.customAvatar) prev.customAvatar = entry.customAvatar;
        prev.totalPoints += entryPts;
        prev.quizzesCount += 1;
        prev.totalScore += entry.score;
        prev.totalQuestions += entry.totalQuestions;
        prev.bestAccuracy = Math.max(prev.bestAccuracy, entry.accuracy);
        prev.fastestSec = Math.min(prev.fastestSec, entry.durationSec);
        prev.lastPlayedAt = Math.max(prev.lastPlayedAt, entry.createdAt);
      }
    }

    return Array.from(map.values())
      .map((p) => ({
        ...p,
        avgAccuracy:
          p.totalQuestions > 0 ? Math.round((p.totalScore / p.totalQuestions) * 100) : 0,
      }))
      .sort((a, b) => {
        if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
        if (b.avgAccuracy !== a.avgAccuracy) return b.avgAccuracy - a.avgAccuracy;
        if (b.quizzesCount !== a.quizzesCount) return b.quizzesCount - a.quizzesCount;
        return a.fastestSec - b.fastestSec;
      });
  }, [leaderboard]);

  const sortedHistory = useMemo(() => {
    return [...leaderboard].sort((a, b) => {
      const pa = a.points ?? a.score * POINTS_PER_MARK;
      const pb = b.points ?? b.score * POINTS_PER_MARK;
      if (pb !== pa) return pb - pa;
      if (b.accuracy !== a.accuracy) return b.accuracy - a.accuracy;
      if (a.durationSec !== b.durationSec) return a.durationSec - b.durationSec;
      return b.createdAt - a.createdAt;
    });
  }, [leaderboard]);

  const filteredStandings = useMemo(() => {
    const q = lbSearch.trim().toLowerCase();
    if (!q) return playerStandings;
    return playerStandings.filter((p) => p.playerName.toLowerCase().includes(q));
  }, [playerStandings, lbSearch]);

  const filteredHistory = useMemo(() => {
    const q = lbSearch.trim().toLowerCase();
    return sortedHistory.filter((entry) => {
      if (lbLengthFilter !== 'all' && entry.totalQuestions !== lbLengthFilter) return false;
      if (lbScopeFilter !== 'all' && entry.scopeType !== lbScopeFilter) return false;
      if (q) {
        const hay = `${entry.playerName} ${entry.scopeLabelBn} ${entry.scopeLabelEn}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sortedHistory, lbLengthFilter, lbScopeFilter, lbSearch]);

  const lbStats = useMemo(() => {
    if (leaderboard.length === 0) {
      return {
        totalPlayers: 0,
        topPoints: 0,
        totalPointsAll: 0,
        totalAttempts: 0,
        fastestSec: 0,
      };
    }
    return {
      totalPlayers: playerStandings.length,
      topPoints: playerStandings[0]?.totalPoints || 0,
      totalPointsAll: playerStandings.reduce((s, p) => s + p.totalPoints, 0),
      totalAttempts: leaderboard.length,
      fastestSec: Math.min(...leaderboard.map((e) => e.durationSec)),
    };
  }, [leaderboard, playerStandings]);

  const handleSaveToLeaderboard = () => {
    if (!activeConfig || savedEntryId) return;
    const trimmed = playerName.trim();
    if (!trimmed) {
      setNameError(true);
      return;
    }
    setNameError(false);
    const total = (questions.length || activeConfig.questionCount) as QuizLength;
    const accuracy = Math.round((scoreCount / total) * 100);
    const scopeLabels = getScopeLabels(activeConfig);
    const entry: LeaderboardEntry = {
      id: `lb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      playerName: trimmed,
      avatarId: avatarConfig.presetId,
      customAvatar: avatarConfig.customUrl,
      score: scoreCount,
      totalQuestions: total,
      points: scoreCount * POINTS_PER_MARK,
      accuracy,
      durationSec: Math.max(1, elapsedSec),
      scopeType: activeConfig.scopeType,
      scopeLabelBn: scopeLabels.bn,
      scopeLabelEn: scopeLabels.en,
      category: activeConfig.category,
      createdAt: Date.now(),
    };
    setLeaderboard((prev) => [entry, ...prev]);
    setSavedEntryId(entry.id);
  };

  const savedPlayerStanding = useMemo(() => {
    if (!savedEntryId) return null;
    const key = playerName.trim().toLowerCase();
    const idx = playerStandings.findIndex((p) => p.key === key);
    if (idx < 0) return null;
    return { rank: idx + 1, standing: playerStandings[idx] };
  }, [savedEntryId, playerName, playerStandings]);

  const currentQuestion = questions[currentIdx];

  return (
    <section className="space-y-6">
      {/* Page Header & Play / Leaderboard Tabs */}
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
              ? 'বাংলাদেশ ভূগোল কুইজ ও লিডারবোর্ড'
              : 'Bangladesh Geography Quiz & Leaderboard'}
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
            {lang === 'bn'
              ? 'পুরো বাংলাদেশ অথবা নির্দিষ্ট বিভাগ, জেলা ও উপজেলা বেছে নিয়ে ১০, ১৫ বা ২০ নম্বরের কুইজ দিন। প্রতিটি সঠিক ১ নম্বরে পাবেন ১০ পয়েন্ট।'
              : 'Challenge yourself on whole Bangladesh or any division, district, or upazila with 10, 15, or 20 marks. Earn 10 points per correct answer.'}
          </p>
        </div>

        {/* Play Quiz vs Leaderboard Segmented Tabs */}
        <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shrink-0 self-start lg:self-auto">
          <button
            type="button"
            onClick={() => setSubTab('play')}
            className={`px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === 'play'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {lang === 'bn' ? 'কুইজ খেলুন' : 'Play Quiz'}
          </button>
          <button
            type="button"
            onClick={() => setSubTab('leaderboard')}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
              subTab === 'leaderboard'
                ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-xs'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Trophy className="w-3.5 h-3.5 text-amber-500" />
            <span>
              {lang === 'bn'
                ? `লিডারবোর্ড (${formatNum(playerStandings.length, lang)})`
                : `Leaderboard (${playerStandings.length})`}
            </span>
          </button>
        </div>
      </div>

      {/* TAB 1: QUIZ PLAY FLOW (SETUP -> ACTIVE -> RESULT) */}
      {subTab === 'play' && (
        <>
          {stage === 'setup' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left 7 Cols: Quiz Configurator */}
              <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-6">
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                    {lang === 'bn' ? 'কুইজ সেটআপ করুন' : 'Configure Your Quiz'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {lang === 'bn'
                      ? 'প্রোফাইল, পরিসর, কুইজের ধরন ও প্রশ্ন সংখ্যা নির্বাচন করে শুরু করুন।'
                      : 'Set your player profile, region scope, topic style, and total marks.'}
                  </p>
                </div>

                {/* Compact Player Profile with Expandable Edit Mode */}
                <div className="p-4 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 space-y-3.5">
                  {!isEditingProfile ? (
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <AvatarBadge
                          name={playerName || 'BD'}
                          avatarId={avatarConfig.presetId}
                          customAvatar={avatarConfig.customUrl}
                          sizeClass="w-11 h-11"
                        />
                        <div className="min-w-0">
                          <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                            {lang === 'bn' ? 'প্রতিযোগীর প্রোফাইল' : 'Player Profile'}
                          </div>
                          <div className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                            {playerName.trim() ||
                              (lang === 'bn' ? 'নাম সেট করা হয়নি' : 'Name not set')}
                          </div>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsEditingProfile(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-600 dark:hover:border-emerald-500 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shrink-0"
                      >
                        <Pencil className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                        <span>{lang === 'bn' ? 'এডিট' : 'Edit'}</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                          {lang === 'bn'
                            ? 'প্রোফাইল সম্পাদনা করুন (লিডারবোর্ড ও পয়েন্টের জন্য)'
                            : 'Edit Profile (for Leaderboard & Points)'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setIsEditingProfile(false)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white text-xs font-semibold transition-colors shrink-0"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{lang === 'bn' ? 'সম্পন্ন' : 'Done'}</span>
                        </button>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                        <AvatarBadge
                          name={playerName || 'BD'}
                          avatarId={avatarConfig.presetId}
                          customAvatar={avatarConfig.customUrl}
                          sizeClass="w-12 h-12"
                        />

                        <div className="flex-1 min-w-0">
                          <label
                            htmlFor="quiz-player-name"
                            className="sr-only"
                          >
                            {lang === 'bn' ? 'প্রতিযোগীর নাম' : 'Player Name'}
                          </label>
                          <div className="relative">
                            <User className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                            <input
                              id="quiz-player-name"
                              type="text"
                              maxLength={36}
                              value={playerName}
                              onChange={(e) => setPlayerName(e.target.value)}
                              placeholder={
                                lang === 'bn'
                                  ? 'আপনার নাম লিখুন (যেমন: রাকিব)'
                                  : 'Enter your name (e.g. Rakib)'
                              }
                              className="w-full pl-9 pr-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/15"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Avatar Presets + Custom Photo Upload */}
                      <div className="pt-2.5 border-t border-slate-200/80 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          {AVATAR_PRESETS.map((preset) => {
                            const isPicked =
                              !avatarConfig.customUrl && avatarConfig.presetId === preset.id;
                            return (
                              <button
                                key={preset.id}
                                type="button"
                                onClick={() =>
                                  setAvatarConfig({ presetId: preset.id, customUrl: undefined })
                                }
                                title={lang === 'bn' ? preset.labelBn : preset.labelEn}
                                aria-label={lang === 'bn' ? preset.labelBn : preset.labelEn}
                                className={`p-0.5 rounded-full transition-transform ${
                                  isPicked
                                    ? 'ring-2 ring-emerald-600 dark:ring-emerald-400 scale-110'
                                    : 'opacity-80 hover:opacity-100'
                                }`}
                              >
                                <AvatarBadge
                                  name={preset.labelEn}
                                  avatarId={preset.id}
                                  sizeClass="w-7 h-7"
                                />
                              </button>
                            );
                          })}
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            ref={avatarFileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleUploadCustomAvatar}
                            className="hidden"
                          />
                          <button
                            type="button"
                            onClick={() => avatarFileInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-xs font-medium text-slate-700 dark:text-slate-200 transition-colors"
                          >
                            <Camera className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
                            <span>
                              {avatarConfig.customUrl
                                ? lang === 'bn'
                                  ? 'ছবি পরিবর্তন'
                                  : 'Change Photo'
                                : lang === 'bn'
                                ? 'নিজের ছবি দিন'
                                : 'Upload Photo'}
                            </span>
                          </button>
                          {avatarConfig.customUrl && (
                            <button
                              type="button"
                              onClick={() =>
                                setAvatarConfig((prev) => ({ ...prev, customUrl: undefined }))
                              }
                              aria-label={lang === 'bn' ? 'ছবি সরান' : 'Remove photo'}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      {avatarError && (
                        <p className="text-xs text-rose-600 dark:text-rose-400">{avatarError}</p>
                      )}
                    </>
                  )}
                </div>

                {/* Scope Selector */}
                <div className="space-y-3">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {lang === 'bn' ? '১. কুইজের পরিসর নির্বাচন করুন' : '1. Select Quiz Scope'}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {(
                      [
                        { id: 'bangladesh', bn: 'পুরো বাংলাদেশ', en: 'Bangladesh' },
                        { id: 'division', bn: 'নির্দিষ্ট বিভাগ', en: 'Division' },
                        { id: 'district', bn: 'নির্দিষ্ট জেলা', en: 'District' },
                        { id: 'upazila', bn: 'নির্দিষ্ট উপজেলা', en: 'Upazila' },
                      ] as { id: QuizScopeType; bn: string; en: string }[]
                    ).map((item) => {
                      const active = scopeType === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setScopeType(item.id)}
                          className={`px-3 py-2.5 rounded-lg border text-xs font-semibold transition-colors text-center whitespace-nowrap ${
                            active
                              ? 'bg-emerald-700 dark:bg-emerald-600 text-white border-emerald-700 dark:border-emerald-600'
                              : 'bg-slate-50/70 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          {lang === 'bn' ? item.bn : item.en}
                        </button>
                      );
                    })}
                  </div>

                  {/* Specific Division / Searchable District / Searchable Upazila Pickers */}
                  {scopeType === 'division' && (
                    <div className="pt-1">
                      <label
                        htmlFor="quiz-div-select"
                        className="block text-xs text-slate-500 dark:text-slate-400 mb-1"
                      >
                        {lang === 'bn' ? 'বিভাগ বেছে নিন' : 'Choose Division'}
                      </label>
                      <select
                        id="quiz-div-select"
                        value={selectedDivId}
                        onChange={(e) => setSelectedDivId(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600"
                      >
                        {divisions.map((dv) => (
                          <option key={dv.id} value={dv.id}>
                            {lang === 'bn'
                              ? `${dv.bnName} বিভাগ (${formatNum(
                                  DIVISION_META[dv.id]?.districtCount || 0,
                                  lang
                                )} জেলা)`
                              : `${dv.name} Division (${
                                  DIVISION_META[dv.id]?.districtCount || 0
                                } districts)`}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {scopeType === 'district' && (
                    <div className="pt-1">
                      <SearchableSelect
                        id="quiz-dist-picker"
                        label={
                          lang === 'bn'
                            ? 'জেলা বেছে নিন (৬৪ জেলা)'
                            : 'Choose District (64 Districts)'
                        }
                        value={selectedDistId}
                        options={districtPickerOptions}
                        placeholderBn="জেলার নাম লিখে খুঁজুন (যেমন: ঢাকা, জামালপুর)..."
                        placeholderEn="Type district name (e.g. Dhaka, Jamalpur)..."
                        lang={lang}
                        onChange={setSelectedDistId}
                      />
                    </div>
                  )}

                  {scopeType === 'upazila' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                      <SearchableSelect
                        id="quiz-udist-picker"
                        label={
                          lang === 'bn'
                            ? 'জেলা অনুযায়ী ফিল্টার (ঐচ্ছিক)'
                            : 'Filter by District (Optional)'
                        }
                        value={selectedUpazilaDistId}
                        options={upazilaDistrictFilterOptions}
                        placeholderBn="জেলা খুঁজুন..."
                        placeholderEn="Search district..."
                        lang={lang}
                        onChange={setSelectedUpazilaDistId}
                      />
                      <SearchableSelect
                        id="quiz-u-picker"
                        label={
                          lang === 'bn'
                            ? `উপজেলা / থানা বেছে নিন (${formatNum(upazilasForPicker.length, lang)}টি)`
                            : `Choose Upazila / Thana (${upazilasForPicker.length})`
                        }
                        value={selectedUpazilaId}
                        options={upazilaPickerOptions}
                        placeholderBn="উপজেলা বা থানার নাম লিখুন (যেমন: সাভার)..."
                        placeholderEn="Type upazila or thana name (e.g. Savar)..."
                        lang={lang}
                        onChange={setSelectedUpazilaId}
                      />
                    </div>
                  )}
                </div>

                {/* Quiz Category / Style */}
                <div className="space-y-2.5">
                  <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {lang === 'bn' ? '২. কুইজের ধরন নির্বাচন করুন' : '2. Choose Quiz Topic Type'}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(
                      [
                        {
                          id: 'mixed',
                          bn: 'মিশ্র কুইজ (সব বিষয়)',
                          en: 'Mixed Quiz (All Topics)',
                          subBn: 'মানচিত্র, সীমান্ত, নদী ও দর্শনীয় স্থান',
                          subEn: 'Borders, rivers, landmarks & history',
                        },
                        {
                          id: 'geography_borders',
                          bn: 'মানচিত্র ও সীমান্ত',
                          en: 'Map & Borders',
                          subBn: 'বিভাগ, জেলা, উপজেলা ও পার্শ্ববর্তী সীমানা',
                          subEn: 'Divisions, districts & bordering areas',
                        },
                        {
                          id: 'rivers',
                          bn: 'নদ-নদী ও গতিপথ',
                          en: 'Rivers & Waterways',
                          subBn: 'প্রধান ৩০টি নদী, উৎপত্তি, মোহনা ও দৈর্ঘ্য',
                          subEn: 'Major rivers, origins, mouths & lengths',
                        },
                        {
                          id: 'heritage_facts',
                          bn: 'ঐতিহ্য ও দর্শনীয় স্থান',
                          en: 'Heritage & Landmarks',
                          subBn: 'বিখ্যাত স্থান, পণ্য, প্রতিষ্ঠা সাল ও তথ্য',
                          subEn: 'Landmarks, specialties & founding dates',
                        },
                      ] as {
                        id: QuizCategory;
                        bn: string;
                        en: string;
                        subBn: string;
                        subEn: string;
                      }[]
                    ).map((cat) => {
                      const active = category === cat.id;
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => setCategory(cat.id)}
                          className={`px-3.5 py-2.5 rounded-lg border text-left transition-colors ${
                            active
                              ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 dark:border-emerald-500 text-emerald-950 dark:text-emerald-100'
                              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60'
                          }`}
                        >
                          <div className="text-xs font-semibold">
                            {lang === 'bn' ? cat.bn : cat.en}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            {lang === 'bn' ? cat.subBn : cat.subEn}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Total Marks / Question Count */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                      {lang === 'bn' ? '৩. কত নম্বরের কুইজ দেবেন?' : '3. Select Marks / Questions'}
                    </span>
                    <span className="text-[11px] text-slate-500 dark:text-slate-400">
                      {lang === 'bn'
                        ? `প্রতি প্রশ্নের মান ১ নম্বর (${formatNum(POINTS_PER_MARK, lang)} পয়েন্ট)`
                        : `1 mark per question (${POINTS_PER_MARK} pts each)`}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    {([10, 15, 20] as QuizLength[]).map((len) => {
                      const active = questionCount === len;
                      return (
                        <button
                          key={len}
                          type="button"
                          onClick={() => setQuestionCount(len)}
                          className={`py-3 px-3 rounded-lg border text-center transition-colors ${
                            active
                              ? 'bg-emerald-700 dark:bg-emerald-600 text-white border-emerald-700 dark:border-emerald-600'
                              : 'bg-slate-50/70 dark:bg-slate-800/50 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800'
                          }`}
                        >
                          <div className="font-mono-tabular text-base font-bold">
                            {lang === 'bn' ? `${formatNum(len, lang)} নম্বর` : `${len} Marks`}
                          </div>
                          <div
                            className={`text-[11px] mt-0.5 ${
                              active ? 'text-emerald-100' : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {lang === 'bn'
                              ? `সর্বোচ্চ ${formatNum(len * POINTS_PER_MARK, lang)} পয়েন্ট`
                              : `Up to ${len * POINTS_PER_MARK} pts`}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    {lang === 'bn'
                      ? `নির্বাচিত: ${
                          getScopeLabels({
                            scopeType,
                            scopeId: currentScopeId,
                            category,
                            questionCount,
                          }).bn
                        } · ${getCategoryLabel(category, lang)} · ${formatNum(
                          questionCount,
                          lang
                        )} নম্বর`
                      : `Selected: ${
                          getScopeLabels({
                            scopeType,
                            scopeId: currentScopeId,
                            category,
                            questionCount,
                          }).en
                        } · ${getCategoryLabel(category, lang)} · ${questionCount} Marks`}
                  </div>
                  <button
                    type="button"
                    onClick={() => startQuiz()}
                    className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                  >
                    <Play className="w-4 h-4" />
                    <span>{lang === 'bn' ? 'কুইজ শুরু করুন' : 'Start Quiz'}</span>
                  </button>
                </div>
              </div>

              {/* Right 5 Cols: Cumulative Points Leaderboard Preview */}
              <aside className="lg:col-span-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-5 h-5 text-amber-500 shrink-0" />
                    <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
                      {lang === 'bn' ? 'পয়েন্ট লিডারবোর্ড' : 'Points Leaderboard'}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSubTab('leaderboard')}
                    className="text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline whitespace-nowrap"
                  >
                    {lang === 'bn' ? 'সব দেখুন →' : 'View All →'}
                  </button>
                </div>

                {/* Points Formula Callout */}
                <div className="p-3 rounded-lg bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <span>
                    {lang === 'bn'
                      ? `প্রতিটি কুইজে প্রাপ্ত প্রতি ১ নম্বরে ${formatNum(
                          POINTS_PER_MARK,
                          lang
                        )} পয়েন্ট যোগ হবে। যত বেশি কুইজ দেবেন ও ভালো নম্বর পাবেন, আপনার পয়েন্ট তত বাড়বে।`
                      : `Earn ${POINTS_PER_MARK} points for every mark scored. Complete more quizzes to climb the total points ranking.`}
                  </span>
                </div>

                {/* Quick Summary Stats */}
                <div className="grid grid-cols-3 gap-3 py-3 border-y border-slate-200 dark:border-slate-800">
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'প্রতিযোগী' : 'Players'}
                    </div>
                    <div className="font-mono-tabular text-base font-bold text-slate-900 dark:text-white mt-0.5">
                      {formatNum(lbStats.totalPlayers, lang)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'সর্বোচ্চ পয়েন্ট' : 'Top Points'}
                    </div>
                    <div className="font-mono-tabular text-base font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                      {formatNum(lbStats.topPoints, lang)}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {lang === 'bn' ? 'সম্পন্ন কুইজ' : 'Quizzes'}
                    </div>
                    <div className="font-mono-tabular text-base font-bold text-slate-900 dark:text-white mt-0.5">
                      {formatNum(lbStats.totalAttempts, lang)}
                    </div>
                  </div>
                </div>

                {playerStandings.length > 0 ? (
                  <div className="divide-y divide-slate-100 dark:divide-slate-800">
                    {playerStandings.slice(0, 5).map((player, idx) => (
                      <div
                        key={player.key}
                        className="py-2.5 flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className={`font-mono-tabular w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold shrink-0 ${
                              idx === 0
                                ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                                : idx === 1
                                ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                : idx === 2
                                ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300'
                                : 'text-slate-500 dark:text-slate-400'
                            }`}
                          >
                            {formatNum(idx + 1, lang)}
                          </span>
                          <AvatarBadge
                            name={player.playerName}
                            avatarId={player.avatarId}
                            customAvatar={player.customAvatar}
                            sizeClass="w-8 h-8"
                          />
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {player.playerName}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono-tabular">
                              {lang === 'bn'
                                ? `${formatNum(player.quizzesCount, lang)}টি কুইজ · গড় ${formatNum(
                                    player.avgAccuracy,
                                    lang
                                  )}%`
                                : `${player.quizzesCount} quiz(zes) · ${player.avgAccuracy}% avg`}
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono-tabular text-sm font-bold text-amber-600 dark:text-amber-400">
                            {formatNum(player.totalPoints, lang)} {lang === 'bn' ? 'পয়েন্ট' : 'pts'}
                          </div>
                          <div className="font-mono-tabular text-[11px] text-slate-500 dark:text-slate-400">
                            {formatNum(player.totalScore, lang)}/
                            {formatNum(player.totalQuestions, lang)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-8 text-center space-y-2">
                    <Award className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto" />
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      {lang === 'bn'
                        ? 'লিডারবোর্ডে এখনো কোনো পয়েন্ট নেই'
                        : 'No points on the leaderboard yet'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {lang === 'bn'
                        ? 'একটি কুইজ সম্পন্ন করে আপনার প্রথম পয়েন্ট লিডারবোর্ডে যোগ করুন।'
                        : 'Finish a quiz and save your score to earn points.'}
                    </p>
                  </div>
                )}
              </aside>
            </div>
          )}

          {/* ACTIVE QUIZ GAMEPLAY (NO PREMATURE RIGHT/WRONG REVEAL) */}
          {stage === 'active' && currentQuestion && activeConfig && (
            <div className="max-w-3xl mx-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-7 space-y-6">
              {/* Top Meta Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {lang === 'bn'
                      ? getScopeLabels(activeConfig).bn
                      : getScopeLabels(activeConfig).en}
                  </span>
                  <span aria-hidden="true">·</span>
                  <span>{getCategoryLabel(activeConfig.category, lang)}</span>
                  <span aria-hidden="true">·</span>
                  <span>{lang === 'bn' ? 'প্রতি প্রশ্ন ১ নম্বর' : '1 mark each'}</span>
                </div>

                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 font-mono-tabular text-xs font-semibold text-slate-700 dark:text-slate-300">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {formatTimer(elapsedSec, lang)}
                  </span>
                  <span className="font-mono-tabular text-xs text-slate-500 dark:text-slate-400">
                    {lang === 'bn'
                      ? `উত্তরিত: ${formatNum(answeredCount, lang)}/${formatNum(questions.length, lang)}`
                      : `Answered: ${answeredCount}/${questions.length}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStage('setup')}
                    className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    {lang === 'bn' ? 'বাতিল' : 'Quit'}
                  </button>
                </div>
              </div>

              {/* Progress Indicator */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-medium text-slate-600 dark:text-slate-300 font-mono-tabular">
                  <span>
                    {lang === 'bn'
                      ? `প্রশ্ন ${formatNum(currentIdx + 1, lang)} / ${formatNum(questions.length, lang)}`
                      : `Question ${currentIdx + 1} of ${questions.length}`}
                  </span>
                  <span>
                    {formatNum(Math.round(((currentIdx + 1) / questions.length) * 100), lang)}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-emerald-600 dark:bg-emerald-500 transition-[width] duration-200"
                    style={{ width: `${((currentIdx + 1) / questions.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Question Prompt */}
              <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-snug">
                {lang === 'bn' ? currentQuestion.promptBn : currentQuestion.promptEn}
              </h2>

              {/* 4 Answer Options — Pure Neutral Selection Only (Results Shown After Quiz Finishes) */}
              <div className="space-y-2.5">
                {(lang === 'bn' ? currentQuestion.optionsBn : currentQuestion.optionsEn).map(
                  (opt, idx) => {
                    const isChosen = selectedOption === idx;
                    const letter = lang === 'bn' ? OPTION_LETTERS_BN[idx] : OPTION_LETTERS_EN[idx];

                    return (
                      <button
                        key={`${currentQuestion.id}-opt-${idx}`}
                        type="button"
                        onClick={() => handleChooseOption(idx)}
                        className={`w-full min-h-[48px] px-4 py-3 rounded-lg border text-left flex items-center justify-between gap-3 transition-colors ${
                          isChosen
                            ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 dark:border-emerald-500 text-emerald-950 dark:text-emerald-100 ring-1 ring-emerald-600/25'
                            : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800/70 hover:border-slate-400 dark:hover:border-slate-500'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span
                            className={`font-mono-tabular text-xs font-bold w-6 h-6 rounded-md border flex items-center justify-center shrink-0 mt-0.5 ${
                              isChosen
                                ? 'bg-emerald-700 dark:bg-emerald-600 border-emerald-700 dark:border-emerald-600 text-white'
                                : 'border-current/25'
                            }`}
                          >
                            {letter}
                          </span>
                          <span className="text-sm font-medium leading-relaxed">{opt}</span>
                        </div>
                        {isChosen && (
                          <Check className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                        )}
                      </button>
                    );
                  }
                )}
              </div>

              {/* Navigation Footer (Previous / Next or Submit) */}
              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'পূর্ববর্তী' : 'Previous'}</span>
                </button>

                <span className="hidden sm:inline text-xs text-slate-400 dark:text-slate-500">
                  {lang === 'bn'
                    ? 'সঠিক ও ভুল উত্তর কুইজ শেষে দেখানো হবে'
                    : 'Answers are revealed after completing the quiz'}
                </span>

                <button
                  type="button"
                  disabled={selectedOption === null}
                  onClick={handleNextOrFinish}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-40 disabled:pointer-events-none transition-colors"
                >
                  <span>
                    {currentIdx + 1 < questions.length
                      ? lang === 'bn'
                        ? 'পরবর্তী প্রশ্ন'
                        : 'Next Question'
                      : lang === 'bn'
                      ? 'কুইজ শেষ করে ফলাফল দেখুন'
                      : 'Submit & View Results'}
                  </span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* QUIZ RESULT, POINTS EARNED, SAVE TO LEADERBOARD & FULL REVIEW */}
          {stage === 'result' && activeConfig && (
            <div className="max-w-4xl mx-auto space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-7 space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                      {lang === 'bn' ? 'কুইজ সম্পন্ন হয়েছে' : 'Quiz Completed'}
                    </div>
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-1">
                      {lang === 'bn'
                        ? `আপনার প্রাপ্ত নম্বর: ${formatNum(scoreCount, lang)} / ${formatNum(
                            questions.length,
                            lang
                          )}`
                        : `Your Score: ${scoreCount} / ${questions.length}`}
                    </h2>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                      {lang === 'bn'
                        ? getScopeLabels(activeConfig).bn
                        : getScopeLabels(activeConfig).en}{' '}
                      · {getCategoryLabel(activeConfig.category, lang)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 shrink-0">
                    <div className="text-center px-4 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/70">
                      <div className="text-[11px] text-amber-800 dark:text-amber-300 font-medium">
                        {lang === 'bn' ? 'অর্জিত পয়েন্ট' : 'Points Earned'}
                      </div>
                      <div className="font-mono-tabular text-xl font-bold text-amber-600 dark:text-amber-400">
                        +{formatNum(earnedPoints, lang)}
                      </div>
                    </div>
                    <div className="text-center px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {lang === 'bn' ? 'নির্ভুলতা' : 'Accuracy'}
                      </div>
                      <div className="font-mono-tabular text-xl font-bold text-emerald-700 dark:text-emerald-400">
                        {formatNum(Math.round((scoreCount / questions.length) * 100), lang)}%
                      </div>
                    </div>
                    <div className="text-center px-4 py-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700">
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        {lang === 'bn' ? 'সময়' : 'Time'}
                      </div>
                      <div className="font-mono-tabular text-xl font-bold text-slate-900 dark:text-white">
                        {formatTimer(elapsedSec, lang)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Save Score & Points to Leaderboard with Avatar */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
                  {savedEntryId ? (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800">
                      <div className="flex items-center gap-3 text-sm font-medium text-emerald-900 dark:text-emerald-200">
                        <AvatarBadge
                          name={playerName}
                          avatarId={avatarConfig.presetId}
                          customAvatar={avatarConfig.customUrl}
                          sizeClass="w-9 h-9"
                        />
                        <div>
                          <div>
                            {lang === 'bn'
                              ? `লিডারবোর্ডে +${formatNum(earnedPoints, lang)} পয়েন্ট যোগ হয়েছে!`
                              : `+${earnedPoints} points saved to Leaderboard!`}
                          </div>
                          {savedPlayerStanding && (
                            <div className="text-xs text-emerald-700 dark:text-emerald-400 font-mono-tabular">
                              {lang === 'bn'
                                ? `মোট পয়েন্ট: ${formatNum(
                                    savedPlayerStanding.standing.totalPoints,
                                    lang
                                  )} · বর্তমান র‍্যাংক: #${formatNum(
                                    savedPlayerStanding.rank,
                                    lang
                                  )}`
                                : `Total Points: ${savedPlayerStanding.standing.totalPoints} · Rank #${savedPlayerStanding.rank}`}
                            </div>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSubTab('leaderboard')}
                        className="text-xs font-semibold text-emerald-800 dark:text-emerald-300 hover:underline whitespace-nowrap"
                      >
                        {lang === 'bn' ? 'লিডারবোর্ড দেখুন →' : 'Open Leaderboard →'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <label
                        htmlFor="save-lb-name"
                        className="block text-xs font-semibold text-slate-700 dark:text-slate-300"
                      >
                        {lang === 'bn'
                          ? `আপনার নাম ও ছবি/অ্যাভাটারসহ +${formatNum(
                              earnedPoints,
                              lang
                            )} পয়েন্ট লিডারবোর্ডে যোগ করুন`
                          : `Save +${earnedPoints} points to Leaderboard with your name & avatar`}
                      </label>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                        <div className="flex items-center gap-2 shrink-0">
                          <AvatarBadge
                            name={playerName || 'BD'}
                            avatarId={avatarConfig.presetId}
                            customAvatar={avatarConfig.customUrl}
                            sizeClass="w-9 h-9"
                          />
                          <button
                            type="button"
                            onClick={() => avatarFileInputRef.current?.click()}
                            title={lang === 'bn' ? 'ছবি আপলোড করুন' : 'Upload photo'}
                            className="inline-flex items-center gap-1 px-2.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-200 hover:border-emerald-500"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>{lang === 'bn' ? 'ছবি' : 'Photo'}</span>
                          </button>
                          <input
                            ref={avatarFileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleUploadCustomAvatar}
                            className="hidden"
                          />
                        </div>
                        <input
                          id="save-lb-name"
                          type="text"
                          maxLength={36}
                          value={playerName}
                          onChange={(e) => {
                            setPlayerName(e.target.value);
                            if (nameError) setNameError(false);
                          }}
                          placeholder={
                            lang === 'bn' ? 'আপনার নাম লিখুন...' : 'Enter your name...'
                          }
                          className={`flex-1 px-3.5 py-2 bg-slate-50 dark:bg-slate-800 border rounded-lg text-sm text-slate-900 dark:text-slate-100 focus:outline-none ${
                            nameError
                              ? 'border-rose-500 focus:border-rose-500'
                              : 'border-slate-200 dark:border-slate-700 focus:border-emerald-600'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={handleSaveToLeaderboard}
                          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
                        >
                          <Trophy className="w-3.5 h-3.5" />
                          <span>
                            {lang === 'bn' ? 'পয়েন্ট সংরক্ষণ করুন' : 'Save Points'}
                          </span>
                        </button>
                      </div>
                      {nameError && (
                        <p className="text-xs text-rose-600 dark:text-rose-400">
                          {lang === 'bn'
                            ? 'সংরক্ষণ করতে অনুগ্রহ করে আপনার নাম লিখুন।'
                            : 'Please enter your name before saving.'}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Result Actions */}
                <div className="flex flex-wrap items-center gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => startQuiz(activeConfig)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'একই বিষয়ে নতুন কুইজ দিন' : 'Play Again'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setStage('setup')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-semibold transition-colors"
                  >
                    <span>{lang === 'bn' ? 'বিষয় ও নম্বর পরিবর্তন করুন' : 'Change Setup'}</span>
                  </button>
                </div>
              </div>

              {/* Detailed Answer Review (First time right/wrong is revealed!) */}
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-4">
                <h3 className="font-display text-base font-bold text-slate-900 dark:text-white">
                  {lang === 'bn'
                    ? `প্রশ্ন ও উত্তরের পর্যালোচনা (${formatNum(questions.length, lang)}টি)`
                    : `Answer Review (${questions.length} Questions)`}
                </h3>
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {questions.map((q, idx) => {
                    const userAns = answers[idx];
                    const isRight = userAns === q.correctIndex;
                    const opts = lang === 'bn' ? q.optionsBn : q.optionsEn;
                    return (
                      <div key={q.id} className="py-4 first:pt-1 last:pb-1 space-y-1.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            <span className="font-mono-tabular text-slate-400 mr-1.5">
                              {formatNum(idx + 1, lang)}.
                            </span>
                            {lang === 'bn' ? q.promptBn : q.promptEn}
                          </div>
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold shrink-0 font-mono-tabular ${
                              isRight
                                ? 'text-emerald-700 dark:text-emerald-400'
                                : 'text-rose-600 dark:text-rose-400'
                            }`}
                          >
                            {isRight ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>
                                  {lang === 'bn'
                                    ? `+১ নম্বর (+${formatNum(POINTS_PER_MARK, lang)} পয়েন্ট)`
                                    : `+1 (+${POINTS_PER_MARK} pts)`}
                                </span>
                              </>
                            ) : (
                              <>
                                <XCircle className="w-3.5 h-3.5" />
                                <span>{lang === 'bn' ? '০' : '0'}</span>
                              </>
                            )}
                          </span>
                        </div>
                        <div className="text-xs space-y-0.5 text-slate-600 dark:text-slate-300">
                          {!isRight && userAns !== null && userAns !== undefined && (
                            <div className="text-rose-700 dark:text-rose-400">
                              {lang === 'bn' ? 'আপনার উত্তর: ' : 'Your answer: '}
                              {opts[userAns]}
                            </div>
                          )}
                          <div className="text-emerald-700 dark:text-emerald-400 font-medium">
                            {lang === 'bn' ? 'সঠিক উত্তর: ' : 'Correct answer: '}
                            {opts[q.correctIndex]}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400">
                            {lang === 'bn' ? q.explanationBn : q.explanationEn}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* TAB 2: FULL LEADERBOARD (CUMULATIVE POINTS RANKING + ATTEMPT HISTORY) */}
      {subTab === 'leaderboard' && (
        <div className="space-y-6">
          {/* Summary Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5">
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'মোট প্রতিযোগী' : 'Total Players'}
              </div>
              <div className="font-mono-tabular text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                {formatNum(lbStats.totalPlayers, lang)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'সর্বোচ্চ পয়েন্ট' : 'Top Points'}
              </div>
              <div className="font-mono-tabular text-xl font-bold text-amber-600 dark:text-amber-400 mt-0.5">
                {formatNum(lbStats.topPoints, lang)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'সর্বমোট অর্জিত পয়েন্ট' : 'All Players Points'}
              </div>
              <div className="font-mono-tabular text-xl font-bold text-emerald-700 dark:text-emerald-400 mt-0.5">
                {formatNum(lbStats.totalPointsAll, lang)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                {lang === 'bn' ? 'দ্রুততম সময়' : 'Fastest Run'}
              </div>
              <div className="font-mono-tabular text-xl font-bold text-slate-900 dark:text-white mt-0.5">
                {lbStats.totalAttempts > 0 ? formatTimer(lbStats.fastestSec, lang) : '—'}
              </div>
            </div>
          </div>

          {/* Leaderboard Card & Filters */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {/* Points Ranking vs Individual Quiz History */}
                <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button
                    type="button"
                    onClick={() => setLbViewMode('points')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                      lbViewMode === 'points'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {lang === 'bn' ? 'পয়েন্ট র‍্যাংকিং' : 'Points Ranking'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setLbViewMode('history')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                      lbViewMode === 'history'
                        ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {lang === 'bn'
                      ? `সব কুইজ রেকর্ড (${formatNum(leaderboard.length, lang)})`
                      : `Quiz History (${leaderboard.length})`}
                  </button>
                </div>

                {lbViewMode === 'history' && (
                  <>
                    <div className="inline-flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                      {(['all', 10, 15, 20] as const).map((len) => (
                        <button
                          key={`lb-len-${len}`}
                          type="button"
                          onClick={() => setLbLengthFilter(len)}
                          className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
                            lbLengthFilter === len
                              ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {len === 'all'
                            ? lang === 'bn'
                              ? 'সব নম্বর'
                              : 'All'
                            : lang === 'bn'
                            ? `${formatNum(len, lang)} নম্বর`
                            : `${len} Marks`}
                        </button>
                      ))}
                    </div>

                    <select
                      aria-label={lang === 'bn' ? 'পরিসর অনুযায়ী ফিল্টার' : 'Filter by scope'}
                      value={lbScopeFilter}
                      onChange={(e) => setLbScopeFilter(e.target.value as 'all' | QuizScopeType)}
                      className="px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-200 focus:outline-none focus:border-emerald-600"
                    >
                      <option value="all">{lang === 'bn' ? 'সব পরিসর' : 'All Scopes'}</option>
                      <option value="bangladesh">{lang === 'bn' ? 'পুরো বাংলাদেশ' : 'Bangladesh'}</option>
                      <option value="division">{lang === 'bn' ? 'বিভাগ' : 'Division'}</option>
                      <option value="district">{lang === 'bn' ? 'জেলা' : 'District'}</option>
                      <option value="upazila">{lang === 'bn' ? 'উপজেলা' : 'Upazila'}</option>
                    </select>
                  </>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 sm:w-56">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={lbSearch}
                    onChange={(e) => setLbSearch(e.target.value)}
                    placeholder={
                      lbViewMode === 'points'
                        ? lang === 'bn'
                          ? 'প্রতিযোগীর নাম খুঁজুন...'
                          : 'Search player...'
                        : lang === 'bn'
                        ? 'নাম বা এলাকা খুঁজুন...'
                        : 'Search player or region...'
                    }
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-emerald-600"
                  />
                </div>

                {leaderboard.length > 0 && (
                  confirmClearLb ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setLeaderboard([]);
                          setConfirmClearLb(false);
                        }}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold"
                      >
                        {lang === 'bn' ? 'সব মুছুন' : 'Confirm Clear'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmClearLb(false)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300"
                      >
                        {lang === 'bn' ? 'বাতিল' : 'Cancel'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmClearLb(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>{lang === 'bn' ? 'রিসেট' : 'Clear'}</span>
                    </button>
                  )
                )}
              </div>
            </div>

            {lbViewMode === 'points' ? (
              filteredStandings.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <th className="py-3 px-4">{lang === 'bn' ? 'অবস্থান' : 'Rank'}</th>
                        <th className="py-3 px-4">{lang === 'bn' ? 'প্রতিযোগী' : 'Player'}</th>
                        <th className="py-3 px-4 text-right">{lang === 'bn' ? 'মোট পয়েন্ট' : 'Total Points'}</th>
                        <th className="py-3 px-4 text-right">{lang === 'bn' ? 'সম্পন্ন কুইজ' : 'Quizzes'}</th>
                        <th className="py-3 px-4 text-right">{lang === 'bn' ? 'মোট নম্বর' : 'Total Marks'}</th>
                        <th className="py-3 px-4 text-right">{lang === 'bn' ? 'গড় নির্ভুলতা' : 'Avg Accuracy'}</th>
                        <th className="py-3 px-4 text-right">{lang === 'bn' ? 'দ্রুততম' : 'Best Time'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                      {filteredStandings.map((player, idx) => (
                        <tr
                          key={player.key}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 font-mono-tabular font-bold">
                            <span
                              className={`inline-flex items-center justify-center w-6 h-6 rounded-md text-xs ${
                                idx === 0
                                  ? 'bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300'
                                  : idx === 1
                                  ? 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                                  : idx === 2
                                  ? 'bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300'
                                  : 'text-slate-500 dark:text-slate-400'
                              }`}
                            >
                              {formatNum(idx + 1, lang)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5 whitespace-nowrap">
                              <AvatarBadge
                                name={player.playerName}
                                avatarId={player.avatarId}
                                customAvatar={player.customAvatar}
                                sizeClass="w-8 h-8"
                              />
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {player.playerName}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                            {formatNum(player.totalPoints, lang)} {lang === 'bn' ? 'পয়েন্ট' : 'pts'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {formatNum(player.quizzesCount, lang)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-semibold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                            {formatNum(player.totalScore, lang)} /{' '}
                            {formatNum(player.totalQuestions, lang)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {formatNum(player.avgAccuracy, lang)}%
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {formatTimer(player.fastestSec, lang)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-10 text-center space-y-3">
                  <Trophy className="w-9 h-9 text-slate-300 dark:text-slate-600 mx-auto" />
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {leaderboard.length === 0
                      ? lang === 'bn'
                        ? 'লিডারবোর্ডে এখনো কোনো পয়েন্ট সংরক্ষিত নেই'
                        : 'No leaderboard points yet'
                      : lang === 'bn'
                      ? 'এই নামে কোনো প্রতিযোগী পাওয়া যায়নি'
                      : 'No players match your search'}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setSubTab('play');
                      setStage('setup');
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'কুইজ শুরু করুন' : 'Start a Quiz'}</span>
                  </button>
                </div>
              )
            ) : filteredHistory.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/40 text-xs font-semibold text-slate-500 dark:text-slate-400">
                      <th className="py-3 px-4">{lang === 'bn' ? 'ক্রম' : '#'}</th>
                      <th className="py-3 px-4">{lang === 'bn' ? 'প্রতিযোগী' : 'Player'}</th>
                      <th className="py-3 px-4">{lang === 'bn' ? 'পরিসর ও বিষয়' : 'Scope & Topic'}</th>
                      <th className="py-3 px-4 text-right">{lang === 'bn' ? 'নম্বর' : 'Score'}</th>
                      <th className="py-3 px-4 text-right">{lang === 'bn' ? 'পয়েন্ট' : 'Points'}</th>
                      <th className="py-3 px-4 text-right">{lang === 'bn' ? 'হার' : 'Accuracy'}</th>
                      <th className="py-3 px-4 text-right">{lang === 'bn' ? 'সময়' : 'Time'}</th>
                      <th className="py-3 px-4 text-right">{lang === 'bn' ? 'তারিখ' : 'Date'}</th>
                      <th className="py-3 px-2" aria-label={lang === 'bn' ? 'মুছুন' : 'Delete'} />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    {filteredHistory.map((entry, idx) => {
                      const entryPts = entry.points ?? entry.score * POINTS_PER_MARK;
                      return (
                        <tr
                          key={entry.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-4 font-mono-tabular font-bold text-slate-500 dark:text-slate-400">
                            {formatNum(idx + 1, lang)}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5 whitespace-nowrap">
                              <AvatarBadge
                                name={entry.playerName}
                                avatarId={entry.avatarId}
                                customAvatar={entry.customAvatar}
                                sizeClass="w-7 h-7"
                              />
                              <span className="font-semibold text-slate-900 dark:text-slate-100">
                                {entry.playerName}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="text-xs font-medium text-slate-800 dark:text-slate-200">
                              {lang === 'bn' ? entry.scopeLabelBn : entry.scopeLabelEn}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400">
                              {getScopeTypeLabel(entry.scopeType, lang)} ·{' '}
                              {getCategoryLabel(entry.category, lang)}
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap">
                            {formatNum(entry.score, lang)} / {formatNum(entry.totalQuestions, lang)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular font-bold text-amber-600 dark:text-amber-400 whitespace-nowrap">
                            +{formatNum(entryPts, lang)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-slate-700 dark:text-slate-300 whitespace-nowrap">
                            {formatNum(entry.accuracy, lang)}%
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            {formatTimer(entry.durationSec, lang)}
                          </td>
                          <td className="py-3 px-4 text-right font-mono-tabular text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                            {new Date(entry.createdAt).toLocaleDateString(
                              lang === 'bn' ? 'bn-BD' : 'en-US',
                              { month: 'short', day: 'numeric' }
                            )}
                          </td>
                          <td className="py-3 px-2 text-right">
                            <button
                              type="button"
                              onClick={() =>
                                setLeaderboard((prev) => prev.filter((item) => item.id !== entry.id))
                              }
                              aria-label={lang === 'bn' ? 'এন্ট্রি মুছুন' : 'Delete entry'}
                              className="p-1.5 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 rounded-md"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-10 text-center space-y-3">
                <Trophy className="w-9 h-9 text-slate-300 dark:text-slate-600 mx-auto" />
                <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                  {leaderboard.length === 0
                    ? lang === 'bn'
                      ? 'লিডারবোর্ডে এখনো কোনো স্কোর সংরক্ষিত নেই'
                      : 'No leaderboard entries yet'
                    : lang === 'bn'
                    ? 'এই ফিল্টারে কোনো ফলাফল পাওয়া যায়নি'
                    : 'No entries match your filter'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
};
