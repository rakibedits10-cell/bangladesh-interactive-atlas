import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Award,
  Check,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Flag,
  MapPin,
  RotateCcw,
  Search,
  Share2,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  X,
  XCircle,
} from 'lucide-react';
import { BangladeshMapCanvas } from './BangladeshMapCanvas';
import { FireworksBurst } from './FireworksBurst';
import {
  generateQuizQuestions,
  type QuizQuestion,
  type QuizScopeType,
} from '../utils/quizGenerator';
import {
  getConquestHeadline,
  renderConquestPhotocardPng,
  type ConquestTier,
  type RenderedPhotocard,
} from '../utils/conquestPhotocard';
import { formatNum, toBnDigits } from '../utils/format';
import type {
  GeoDistrict,
  GeoDivision,
  GeoRiver,
  GeoUpazila,
  Lang,
  Theme,
} from '../types/map';

interface ConquerBangladeshPageProps {
  divisions: GeoDivision[];
  districts: GeoDistrict[];
  upazilas: GeoUpazila[];
  rivers: GeoRiver[];
  lang: Lang;
  theme: Theme;
  onBackToMap: () => void;
}

interface ConquestRecord {
  timeSec: number;
  conqueredAt: number;
  bestScore?: number;
}

interface ConquestState {
  divisions: Record<string, ConquestRecord>;
  districts: Record<string, ConquestRecord>;
  upazilas: Record<string, ConquestRecord>;
}

interface TargetInfo {
  tier: ConquestTier;
  id: string;
  nameEn: string;
  nameBn: string;
  parentEn?: string;
  parentBn?: string;
  svgPath: string;
  bbox: [number, number, number, number];
}

type ConquestStage = 'select' | 'active' | 'victory' | 'failed';

const CONQUEST_STORAGE_KEY = 'bd_atlas_conquests_v1';
const PLAYER_STORAGE_KEY = 'bd_atlas_quiz_player_v1';
const CHALLENGE_DURATION_SEC = 300; // 5 minutes
const CHALLENGE_QUESTION_COUNT = 30;
const MIN_CORRECT_TO_CONQUER = 3;
const DEFAULT_DIVISION_ID = '3'; // Dhaka
const BENGALI_OPTION_LABELS = ['ক', 'খ', 'গ', 'ঘ'];
const ENGLISH_OPTION_LABELS = ['A', 'B', 'C', 'D'];

function loadConquestState(): ConquestState {
  const empty: ConquestState = { divisions: {}, districts: {}, upazilas: {} };
  if (typeof window === 'undefined') return empty;
  try {
    const raw = localStorage.getItem(CONQUEST_STORAGE_KEY);
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as Partial<ConquestState>;
    return {
      divisions: parsed.divisions && typeof parsed.divisions === 'object' ? parsed.divisions : {},
      districts: parsed.districts && typeof parsed.districts === 'object' ? parsed.districts : {},
      upazilas: parsed.upazilas && typeof parsed.upazilas === 'object' ? parsed.upazilas : {},
    };
  } catch {
    return empty;
  }
}

function saveConquestState(state: ConquestState): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CONQUEST_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore storage quota failure
  }
}

function formatTimerClock(sec: number, lang: Lang): string {
  const safe = Math.max(0, sec);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  const mm = m < 10 ? `0${m}` : `${m}`;
  const ss = s < 10 ? `0${s}` : `${s}`;
  if (lang === 'en') return `${mm}:${ss}`;
  return `${toBnDigits(mm)}:${toBnDigits(ss)}`;
}

export const ConquerBangladeshPage: React.FC<ConquerBangladeshPageProps> = ({
  divisions,
  districts,
  upazilas,
  rivers,
  lang,
  theme,
  onBackToMap,
}) => {
  const [conquests, setConquests] = useState<ConquestState>(() => loadConquestState());
  const [playerName, setPlayerName] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    return localStorage.getItem(PLAYER_STORAGE_KEY) || '';
  });

  const defaultDivisionId = useMemo(
    () =>
      (
        divisions.find((d) => d.id === DEFAULT_DIVISION_ID || d.name.toLowerCase() === 'dhaka') ||
        divisions[0]
      )?.id || null,
    [divisions]
  );

  // Map Selection State
  const [selectedTier, setSelectedTier] = useState<ConquestTier>('division');
  const [selectedId, setSelectedId] = useState<string | null>(() => {
    const dhaka = divisions.find(
      (d) => d.id === DEFAULT_DIVISION_ID || d.name.toLowerCase() === 'dhaka'
    );
    return (dhaka || divisions[0])?.id || null;
  });
  const [requestedZoomPreset, setRequestedZoomPreset] = useState<{
    layer: 'divisions' | 'districts' | 'upazilas';
    nonce: number;
  } | null>(null);
  const [focusBBoxRequest, setFocusBBoxRequest] = useState<{
    bbox: [number, number, number, number];
    minZoom: number;
    nonce: number;
  } | null>(null);
  const [targetSearch, setTargetSearch] = useState<string>('');
  const [targetSearchOpen, setTargetSearchOpen] = useState<boolean>(false);

  // Challenge State
  const [stage, setStage] = useState<ConquestStage>('select');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [currentIdx, setCurrentIdx] = useState<number>(0);
  const [remainingSec, setRemainingSec] = useState<number>(CHALLENGE_DURATION_SEC);
  const [completionSec, setCompletionSec] = useState<number>(0);
  const [lastCorrectCount, setLastCorrectCount] = useState<number>(MIN_CORRECT_TO_CONQUER);
  const [timedOut, setTimedOut] = useState<boolean>(false);
  const [reviewExpanded, setReviewExpanded] = useState<boolean>(false);

  // Victory Celebration & Photocard State
  const [fireworkKey, setFireworkKey] = useState<number>(0);
  const [photocard, setPhotocard] = useState<RenderedPhotocard | null>(null);
  const [renderingCard, setRenderingCard] = useState<boolean>(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  const divisionById = useMemo(
    () => new Map(divisions.map((d) => [d.id, d])),
    [divisions]
  );
  const districtById = useMemo(
    () => new Map(districts.map((d) => [d.id, d])),
    [districts]
  );
  const upazilaById = useMemo(
    () => new Map(upazilas.map((u) => [u.id, u])),
    [upazilas]
  );

  // Compute bounding boxes for Divisions from their member districts
  const divisionBBoxMap = useMemo(() => {
    const map = new Map<string, [number, number, number, number]>();
    for (const div of divisions) {
      const members = districts.filter((d) => d.divisionId === div.id);
      if (members.length === 0) {
        map.set(div.id, [0, 0, 800, 1000]);
        continue;
      }
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const d of members) {
        minX = Math.min(minX, d.bbox[0]);
        minY = Math.min(minY, d.bbox[1]);
        maxX = Math.max(maxX, d.bbox[2]);
        maxY = Math.max(maxY, d.bbox[3]);
      }
      map.set(div.id, [minX, minY, maxX, maxY]);
    }
    return map;
  }, [divisions, districts]);

  const divisionPaths = useMemo(() => divisions.map((d) => d.path), [divisions]);

  const conqueredDivisionSet = useMemo(
    () => new Set(Object.keys(conquests.divisions)),
    [conquests.divisions]
  );
  const conqueredDistrictSet = useMemo(
    () => new Set(Object.keys(conquests.districts)),
    [conquests.districts]
  );
  const conqueredUpazilaSet = useMemo(
    () => new Set(Object.keys(conquests.upazilas)),
    [conquests.upazilas]
  );

  const selectedTarget = useMemo<TargetInfo | null>(() => {
    if (!selectedId) return null;
    if (selectedTier === 'division') {
      const div = divisionById.get(selectedId);
      if (!div) return null;
      return {
        tier: 'division',
        id: div.id,
        nameEn: div.name,
        nameBn: div.bnName,
        parentEn: 'Bangladesh',
        parentBn: 'বাংলাদেশ',
        svgPath: div.path,
        bbox: divisionBBoxMap.get(div.id) || [0, 0, 800, 1000],
      };
    }
    if (selectedTier === 'district') {
      const dist = districtById.get(selectedId);
      if (!dist) return null;
      const div = divisionById.get(dist.divisionId);
      return {
        tier: 'district',
        id: dist.id,
        nameEn: dist.name,
        nameBn: dist.bnName,
        parentEn: div ? `${div.name} Division` : 'Bangladesh',
        parentBn: div ? `${div.bnName} বিভাগ` : 'বাংলাদেশ',
        svgPath: dist.path,
        bbox: dist.bbox,
      };
    }
    const upz = upazilaById.get(selectedId);
    if (!upz) return null;
    const dist = districtById.get(upz.districtId);
    const div = divisionById.get(upz.divisionId);
    return {
      tier: 'upazila',
      id: upz.id,
      nameEn: upz.name,
      nameBn: upz.bnName,
      parentEn: [dist?.name ? `${dist.name} District` : '', div?.name ? `${div.name} Division` : '']
        .filter(Boolean)
        .join(', '),
      parentBn: [dist?.bnName ? `${dist.bnName} জেলা` : '', div?.bnName ? `${div.bnName} বিভাগ` : '']
        .filter(Boolean)
        .join(', '),
      svgPath: upz.path,
      bbox: upz.bbox,
    };
  }, [selectedTier, selectedId, divisionById, districtById, upazilaById, divisionBBoxMap]);

  const selectedTargetRecord = useMemo<ConquestRecord | null>(() => {
    if (!selectedTarget) return null;
    if (selectedTarget.tier === 'division') {
      return conquests.divisions[selectedTarget.id] || null;
    }
    if (selectedTarget.tier === 'district') {
      return conquests.districts[selectedTarget.id] || null;
    }
    return conquests.upazilas[selectedTarget.id] || null;
  }, [selectedTarget, conquests]);

  // Target quick-search results across Divisions, Districts & Upazilas
  const searchSuggestions = useMemo(() => {
    const q = targetSearch.trim().toLowerCase();
    if (!q) return [];
    const out: {
      tier: ConquestTier;
      id: string;
      label: string;
      sub: string;
      bbox: [number, number, number, number];
      conquered: boolean;
    }[] = [];

    for (const div of divisions) {
      if (
        div.name.toLowerCase().includes(q) ||
        div.bnName.includes(q) ||
        `${div.bnName} বিভাগ`.includes(q)
      ) {
        out.push({
          tier: 'division',
          id: div.id,
          label: lang === 'bn' ? `${div.bnName} বিভাগ` : `${div.name} Division`,
          sub: lang === 'bn' ? 'বিভাগ' : 'Division',
          bbox: divisionBBoxMap.get(div.id) || [0, 0, 800, 1000],
          conquered: conqueredDivisionSet.has(div.id),
        });
      }
      if (out.length >= 4) break;
    }

    for (const dist of districts) {
      if (dist.name.toLowerCase().includes(q) || dist.bnName.includes(q)) {
        const div = divisionById.get(dist.divisionId);
        out.push({
          tier: 'district',
          id: dist.id,
          label: lang === 'bn' ? `${dist.bnName} জেলা` : `${dist.name} District`,
          sub: lang === 'bn' ? `${div?.bnName || ''} বিভাগ` : `${div?.name || ''} Division`,
          bbox: dist.bbox,
          conquered: conqueredDistrictSet.has(dist.id),
        });
      }
      if (out.length >= 10) break;
    }

    for (const upz of upazilas) {
      if (upz.name.toLowerCase().includes(q) || upz.bnName.includes(q)) {
        const dist = districtById.get(upz.districtId);
        out.push({
          tier: 'upazila',
          id: upz.id,
          label: lang === 'bn' ? upz.bnName : upz.name,
          sub: lang === 'bn' ? `${dist?.bnName || ''} জেলা` : `${dist?.name || ''} District`,
          bbox: upz.bbox,
          conquered: conqueredUpazilaSet.has(upz.id),
        });
      }
      if (out.length >= 18) break;
    }

    return out;
  }, [
    targetSearch,
    divisions,
    districts,
    upazilas,
    lang,
    divisionBBoxMap,
    divisionById,
    districtById,
    conqueredDivisionSet,
    conqueredDistrictSet,
    conqueredUpazilaSet,
  ]);

  const buildPhotocardForTarget = useCallback(
    async (
      target: TargetInfo,
      timeSec: number,
      conqueredAt: number,
      correctCount: number,
      customName?: string
    ) => {
      setRenderingCard(true);
      try {
        const card = await renderConquestPhotocardPng({
          tier: target.tier,
          nameEn: target.nameEn,
          nameBn: target.nameBn,
          parentEn: target.parentEn,
          parentBn: target.parentBn,
          svgPath: target.svgPath,
          bbox: target.bbox,
          divisionPaths,
          playerName: customName !== undefined ? customName : playerName,
          completionSec: timeSec,
          conqueredAt,
          correctCount,
          totalQuestions: CHALLENGE_QUESTION_COUNT,
        });
        setPhotocard(card);
      } catch {
        setPhotocard(null);
      } finally {
        setRenderingCard(false);
      }
    },
    [divisionPaths, playerName]
  );

  // Evaluate quiz submission or timeout
  const finishChallenge = useCallback(
    (finalAnswers: Record<number, number>, didTimeout: boolean, usedSec: number) => {
      let correctCount = 0;
      for (let i = 0; i < questions.length; i += 1) {
        if (finalAnswers[i] === questions[i].correctIndex) {
          correctCount += 1;
        }
      }

      setTimedOut(didTimeout);
      setCompletionSec(usedSec);
      setLastCorrectCount(correctCount);

      const hasConquered =
        !didTimeout &&
        questions.length === CHALLENGE_QUESTION_COUNT &&
        correctCount >= MIN_CORRECT_TO_CONQUER;

      if (hasConquered && selectedTarget) {
        const now = Date.now();
        setConquests((prev) => {
          const key =
            selectedTarget.tier === 'division'
              ? 'divisions'
              : selectedTarget.tier === 'district'
              ? 'districts'
              : 'upazilas';
          const existing = prev[key][selectedTarget.id];
          const bestTime = existing ? Math.min(existing.timeSec, usedSec) : usedSec;
          const prevScore = existing?.bestScore ?? CHALLENGE_QUESTION_COUNT;
          const nextBestScore = existing ? Math.max(prevScore, correctCount) : correctCount;
          const next: ConquestState = {
            ...prev,
            [key]: {
              ...prev[key],
              [selectedTarget.id]: {
                timeSec: bestTime,
                conqueredAt: existing?.conqueredAt || now,
                bestScore: nextBestScore,
              },
            },
          };
          saveConquestState(next);
          return next;
        });

        setStage('victory');
        setReviewExpanded(false);
        setFireworkKey((k) => k + 1);
        void buildPhotocardForTarget(selectedTarget, usedSec, now, correctCount);
      } else {
        setStage('failed');
        setReviewExpanded(true);
      }
    },
    [questions, selectedTarget, buildPhotocardForTarget]
  );

  // 5-Minute Countdown Timer during Active Challenge
  useEffect(() => {
    if (stage !== 'active') return;
    const id = window.setInterval(() => {
      setRemainingSec((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [stage]);

  // Trigger timeout finish when timer hits 0 during active stage
  useEffect(() => {
    if (stage === 'active' && remainingSec === 0 && questions.length > 0) {
      finishChallenge(answers, true, CHALLENGE_DURATION_SEC);
    }
  }, [stage, remainingSec, questions.length, answers, finishChallenge]);

  const handleStartConquest = () => {
    if (!selectedTarget) return;
    const scopeType: QuizScopeType =
      selectedTarget.tier === 'division'
        ? 'division'
        : selectedTarget.tier === 'district'
        ? 'district'
        : 'upazila';

    const generated = generateQuizQuestions(
      {
        scopeType,
        scopeId: selectedTarget.id,
        category: 'mixed',
        questionCount: CHALLENGE_QUESTION_COUNT,
      },
      { divisions, districts, upazilas, rivers }
    );

    setQuestions(generated.slice(0, CHALLENGE_QUESTION_COUNT));
    setAnswers({});
    setCurrentIdx(0);
    setRemainingSec(CHALLENGE_DURATION_SEC);
    setCompletionSec(0);
    setTimedOut(false);
    setPhotocard(null);
    setShareFeedback(null);
    setStage('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewExistingPhotocard = () => {
    if (!selectedTarget || !selectedTargetRecord) return;
    const savedScore = selectedTargetRecord.bestScore ?? CHALLENGE_QUESTION_COUNT;
    setCompletionSec(selectedTargetRecord.timeSec);
    setLastCorrectCount(savedScore);
    setTimedOut(false);
    setQuestions([]);
    setStage('victory');
    setFireworkKey((k) => k + 1);
    void buildPhotocardForTarget(
      selectedTarget,
      selectedTargetRecord.timeSec,
      selectedTargetRecord.conqueredAt,
      savedScore
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMapSelectDivision = (divId: string) => {
    setSelectedTier('division');
    setSelectedId(divId);
  };

  const handleMapSelectDistrict = (distId: string) => {
    setSelectedTier('district');
    setSelectedId(distId);
  };

  const handleMapSelectUpazila = (upzId: string) => {
    setSelectedTier('upazila');
    setSelectedId(upzId);
  };

  const handleLayerPresetClick = (layer: 'divisions' | 'districts' | 'upazilas') => {
    setRequestedZoomPreset({ layer, nonce: Date.now() });
    if (layer === 'divisions') {
      setSelectedTier('division');
      if (selectedTier !== 'division') {
        setSelectedId(defaultDivisionId);
      }
    } else if (layer === 'districts') {
      setSelectedTier('district');
      if (selectedTier !== 'district') {
        setSelectedId(districts[0]?.id || null);
      }
    } else {
      setSelectedTier('upazila');
      if (selectedTier !== 'upazila') {
        setSelectedId(upazilas[0]?.id || null);
      }
    }
  };

  const handleSelectSearchTarget = (item: {
    tier: ConquestTier;
    id: string;
    bbox: [number, number, number, number];
  }) => {
    setSelectedTier(item.tier);
    setSelectedId(item.id);
    setTargetSearch('');
    setTargetSearchOpen(false);
    const minZoom = item.tier === 'division' ? 1 : item.tier === 'district' ? 1.85 : 3.2;
    setFocusBBoxRequest({ bbox: item.bbox, minZoom, nonce: Date.now() });
  };

  const handleCopyPhotocard = async () => {
    if (!photocard?.blob || typeof navigator === 'undefined' || !navigator.clipboard) {
      setShareFeedback(
        lang === 'bn'
          ? 'ছবিটি ডাউনলোড করে শেয়ার করুন'
          : 'Download PNG to share the image'
      );
      return;
    }
    try {
      const ClipboardItemCtor = window.ClipboardItem;
      if (ClipboardItemCtor) {
        await navigator.clipboard.write([
          new ClipboardItemCtor({ 'image/png': photocard.blob }),
        ]);
        setShareFeedback(
          lang === 'bn'
            ? 'ফটোকার্ড ক্লিপবোর্ডে কপি হয়েছে!'
            : 'Photocard image copied to clipboard!'
        );
        return;
      }
    } catch {
      // fall through to text copy
    }
    try {
      await navigator.clipboard.writeText(
        `${getConquestHeadline(selectedTarget?.tier || 'district')} - ${selectedTarget?.nameEn || ''} (${window.location.href})`
      );
      setShareFeedback(lang === 'bn' ? 'শেয়ার লিংক কপি হয়েছে!' : 'Share caption copied!');
    } catch {
      setShareFeedback(lang === 'bn' ? 'ডাউনলোড বাটন ব্যবহার করুন' : 'Use Download PNG button');
    }
  };

  const handleNativeShare = async () => {
    if (!selectedTarget) return;
    const headline = getConquestHeadline(selectedTarget.tier);
    const accuracyPct = Math.round((lastCorrectCount / CHALLENGE_QUESTION_COUNT) * 100);
    const shareText = `${headline}: ${selectedTarget.nameEn} (${selectedTarget.nameBn}) — ${lastCorrectCount}/${CHALLENGE_QUESTION_COUNT} (${accuracyPct}% accuracy) in Conquer Bangladesh Through Knowledge!`;
    const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        if (photocard?.blob) {
          const file = new File([photocard.blob], photocard.fileName, { type: 'image/png' });
          if (navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
              title: headline,
              text: shareText,
              files: [file],
            });
            return;
          }
        }
        await navigator.share({
          title: headline,
          text: shareText,
          url: shareUrl,
        });
        return;
      } catch {
        // user cancelled or unavailable -> fallback to copy
      }
    }
    await handleCopyPhotocard();
  };

  const totalTerritories = divisions.length + districts.length + upazilas.length;
  const totalConquered =
    conqueredDivisionSet.size + conqueredDistrictSet.size + conqueredUpazilaSet.size;
  const totalPercent = totalTerritories > 0 ? Math.round((totalConquered / totalTerritories) * 100) : 0;

  const answeredCount = Object.keys(answers).length;
  const currentQuestion = questions[currentIdx] || null;
  const optLabels = lang === 'bn' ? BENGALI_OPTION_LABELS : ENGLISH_OPTION_LABELS;

  const mapLayerFilterControls = (
    <div className="flex items-center gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-0.5">
      {(
        [
          { layer: 'divisions' as const, tier: 'division' as const, bn: 'বিভাগ', en: 'Divisions' },
          { layer: 'districts' as const, tier: 'district' as const, bn: 'জেলা', en: 'Districts' },
          { layer: 'upazilas' as const, tier: 'upazila' as const, bn: 'উপজেলা', en: 'Upazilas' },
        ]
      ).map((item) => {
        const active = selectedTier === item.tier;
        return (
          <button
            key={item.layer}
            type="button"
            onClick={() => handleLayerPresetClick(item.layer)}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              active
                ? 'bg-emerald-700 dark:bg-emerald-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {lang === 'bn' ? item.bn : item.en}
          </button>
        );
      })}
    </div>
  );

  // Compute SVG miniature preview viewBox for the selected target
  const targetPreviewBox = useMemo(() => {
    if (!selectedTarget) return '0 0 800 1000';
    const [x1, y1, x2, y2] = selectedTarget.bbox;
    const w = Math.max(12, x2 - x1);
    const h = Math.max(12, y2 - y1);
    const pad = Math.max(w, h) * 0.14;
    return `${x1 - pad} ${y1 - pad} ${w + pad * 2} ${h + pad * 2}`;
  }, [selectedTarget]);

  const accuracyPct = Math.round((lastCorrectCount / CHALLENGE_QUESTION_COUNT) * 100);
  const shareTextEncoded = encodeURIComponent(
    selectedTarget
      ? `${getConquestHeadline(selectedTarget.tier)} — ${selectedTarget.nameEn} (${selectedTarget.nameBn}) · ${lastCorrectCount}/${CHALLENGE_QUESTION_COUNT} (${accuracyPct}% Accuracy) in Conquer Bangladesh Through Knowledge!`
      : 'Conquer Bangladesh Through Knowledge!'
  );
  const currentUrlEncoded = encodeURIComponent(
    typeof window !== 'undefined' ? window.location.href : ''
  );

  return (
    <div className="space-y-6">
      {/* Celebratory Canvas Fireworks when player conquers territory */}
      <FireworksBurst active={stage === 'victory'} burstKey={fireworkKey} />

      {/* Top Editorial Header & National Conquest Progress */}
      <section className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-5">
        <div className="space-y-2 max-w-2xl">
          <button
            type="button"
            onClick={onBackToMap}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{lang === 'bn' ? 'মানচিত্রে ফিরে যান' : 'Back to Map'}</span>
          </button>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
            Conquer Bangladesh Through Knowledge
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {lang === 'bn'
              ? 'মানচিত্র থেকে যেকোনো বিভাগ, জেলা বা উপজেলা বেছে নিন। ৫ মিনিটে ৩০টি প্রশ্নের মধ্যে কমপক্ষে ৩টি সঠিক উত্তর দিয়ে এলাকাটি জয় করুন।'
              : 'Pick any Division, District, or Upazila from the map. Answer at least 3 out of 30 questions correctly within 5 minutes to conquer the territory.'}
          </p>
        </div>

        {/* Clean Minimalist National Progress Summary (Zero Pills) */}
        <div className="w-full lg:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2.5 shrink-0">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5">
              <Flag className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>{lang === 'bn' ? 'বাংলাদেশ জয় অগ্রগতি' : 'Bangladesh Conquest'}</span>
            </span>
            <span className="font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400">
              {formatNum(totalConquered, lang)} / {formatNum(totalTerritories, lang)} ({formatNum(totalPercent, lang)}%)
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-300"
              style={{ width: `${Math.min(100, (totalConquered / Math.max(1, totalTerritories)) * 100)}%` }}
            />
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>
              {lang === 'bn'
                ? `বিভাগ ${formatNum(conqueredDivisionSet.size, lang)}/${formatNum(divisions.length, lang)}`
                : `Div ${conqueredDivisionSet.size}/${divisions.length}`}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {lang === 'bn'
                ? `জেলা ${formatNum(conqueredDistrictSet.size, lang)}/${formatNum(districts.length, lang)}`
                : `Dist ${conqueredDistrictSet.size}/${districts.length}`}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              {lang === 'bn'
                ? `উপজেলা ${formatNum(conqueredUpazilaSet.size, lang)}/${formatNum(upazilas.length, lang)}`
                : `Upazila ${conqueredUpazilaSet.size}/${upazilas.length}`}
            </span>
          </div>
        </div>
      </section>

      {/* STAGE 1: MAP TARGET SELECTION & BRIEFING */}
      {stage === 'select' && (
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7 Columns: Interactive Conquest Map */}
          <div className="lg:col-span-7">
            <BangladeshMapCanvas
              districts={districts}
              upazilas={upazilas}
              divisions={divisions}
              rivers={rivers}
              selectedDivisionId={selectedTier === 'division' ? selectedId : null}
              selectedDistrictId={selectedTier === 'district' ? selectedId : null}
              selectedUpazilaId={selectedTier === 'upazila' ? selectedId : null}
              appliedDirections={[]}
              activeRiverIds={[]}
              filterControls={mapLayerFilterControls}
              conquestMode={true}
              conqueredDivisionIds={conqueredDivisionSet}
              conqueredDistrictIds={conqueredDistrictSet}
              conqueredUpazilaIds={conqueredUpazilaSet}
              requestedZoomPreset={requestedZoomPreset}
              focusBBoxRequest={focusBBoxRequest}
              lang={lang}
              theme={theme}
              onSelectDivision={handleMapSelectDivision}
              onSelectDistrict={handleMapSelectDistrict}
              onSelectUpazila={handleMapSelectUpazila}
              onResetView={() => {
                setSelectedTier('division');
                setSelectedId(defaultDivisionId);
              }}
            />
          </div>

          {/* Right 5 Columns: Quick Search + Target Briefing Card */}
          <div className="lg:col-span-5 space-y-4">
            {/* Search Box to Jump Directly to Any Division, District, or Upazila */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2.5">
              <label
                htmlFor="conquest-target-search"
                className="text-xs font-semibold text-slate-700 dark:text-slate-200 block"
              >
                {lang === 'bn'
                  ? 'সরাসরি বিভাগ, জেলা বা উপজেলা খুঁজুন'
                  : 'Quick jump to Division, District or Upazila'}
              </label>
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="conquest-target-search"
                  type="text"
                  value={targetSearch}
                  onFocus={() => setTargetSearchOpen(true)}
                  onBlur={() => setTimeout(() => setTargetSearchOpen(false), 180)}
                  onChange={(e) => {
                    setTargetSearch(e.target.value);
                    setTargetSearchOpen(true);
                  }}
                  placeholder={
                    lang === 'bn'
                      ? 'যেমন: ঢাকা, সিলেট, কক্সবাজার সদর...'
                      : 'e.g. Dhaka, Sylhet, Savar...'
                  }
                  className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600"
                />
                {targetSearch && (
                  <button
                    type="button"
                    onClick={() => setTargetSearch('')}
                    aria-label={lang === 'bn' ? 'মুছুন' : 'Clear'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}

                {targetSearchOpen && targetSearch.trim().length > 0 && (
                  <div className="absolute left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-30 max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                    {searchSuggestions.length > 0 ? (
                      searchSuggestions.map((item) => (
                        <button
                          key={`cq-s-${item.tier}-${item.id}`}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => handleSelectSearchTarget(item)}
                          className="w-full px-3.5 py-2.5 text-left hover:bg-emerald-50 dark:hover:bg-emerald-950/50 flex items-center justify-between gap-2"
                        >
                          <div className="min-w-0">
                            <div className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                              {item.label}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              {item.sub}
                            </div>
                          </div>
                          {item.conquered && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 shrink-0">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>{lang === 'bn' ? 'জয়কৃত' : 'Conquered'}</span>
                            </span>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="px-3.5 py-3 text-xs text-slate-500 dark:text-slate-400">
                        {lang === 'bn' ? 'কোনো এলাকা পাওয়া যায়নি' : 'No matching area found'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Selected Target Mission Briefing */}
            {selectedTarget ? (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                      <Target className="w-3.5 h-3.5" />
                      <span>
                        {selectedTarget.tier === 'division'
                          ? lang === 'bn'
                            ? 'বিভাগ অভিযান'
                            : 'Division Conquest'
                          : selectedTarget.tier === 'district'
                          ? lang === 'bn'
                            ? 'জেলা অভিযান'
                            : 'District Conquest'
                          : lang === 'bn'
                          ? 'উপজেলা অভিযান'
                          : 'Upazila Conquest'}
                      </span>
                    </div>
                    <h2 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-snug">
                      {lang === 'bn'
                        ? `${selectedTarget.nameBn}${
                            selectedTarget.tier === 'division'
                              ? ' বিভাগ'
                              : selectedTarget.tier === 'district'
                              ? ' জেলা'
                              : ''
                          }`
                        : `${selectedTarget.nameEn}${
                            selectedTarget.tier === 'division'
                              ? ' Division'
                              : selectedTarget.tier === 'district'
                              ? ' District'
                              : ''
                          }`}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {lang === 'bn'
                        ? `${selectedTarget.nameEn} · ${selectedTarget.parentBn}`
                        : `${selectedTarget.nameBn} · ${selectedTarget.parentEn}`}
                    </p>
                  </div>

                  {/* Clean Miniature Vector Silhouette */}
                  <div className="w-20 h-20 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 p-2 shrink-0 flex items-center justify-center">
                    <svg viewBox={targetPreviewBox} className="w-full h-full">
                      <path
                        d={selectedTarget.svgPath}
                        fill={selectedTargetRecord ? '#10B981' : '#2563EB'}
                        stroke={selectedTargetRecord ? '#065F46' : '#1E3A8A'}
                        strokeWidth="1.5"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                  </div>
                </div>

                {/* Conquest Status Line */}
                <div
                  className={`p-3.5 rounded-lg border text-xs flex items-center justify-between gap-3 ${
                    selectedTargetRecord
                      ? 'bg-emerald-50/70 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200'
                      : 'bg-slate-50 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {selectedTargetRecord ? (
                      <Trophy className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                    ) : (
                      <MapPin className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    )}
                    <div>
                      <div className="font-semibold">
                        {selectedTargetRecord
                          ? lang === 'bn'
                            ? 'অভিনন্দন! এই এলাকাটি ইতিমধ্যেই জয় করেছেন'
                            : 'Territory Conquered'
                          : lang === 'bn'
                          ? 'এলাকাটি এখনো জয় করা হয়নি'
                          : 'Ready to Conquer'}
                      </div>
                      {selectedTargetRecord && (
                        <div className="text-[11px] opacity-80 font-mono-tabular mt-0.5">
                          {lang === 'bn'
                            ? `সর্বোচ্চ স্কোর: ${formatNum(selectedTargetRecord.bestScore ?? CHALLENGE_QUESTION_COUNT, lang)}/${formatNum(CHALLENGE_QUESTION_COUNT, lang)} · সেরা সময়: ${formatTimerClock(selectedTargetRecord.timeSec, lang)}`
                            : `Best Score: ${selectedTargetRecord.bestScore ?? CHALLENGE_QUESTION_COUNT}/${CHALLENGE_QUESTION_COUNT} · Best Time: ${formatTimerClock(selectedTargetRecord.timeSec, lang)}`}
                        </div>
                      )}
                    </div>
                  </div>
                  {selectedTargetRecord && (
                    <button
                      type="button"
                      onClick={handleViewExistingPhotocard}
                      className="px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300 font-semibold hover:bg-emerald-100/60 dark:hover:bg-emerald-900/50 whitespace-nowrap shrink-0"
                    >
                      {lang === 'bn' ? 'ফটোকার্ড দেখুন' : 'Photocard'}
                    </button>
                  )}
                </div>

                {/* Victory Conditions (3 Fixed Metrics) */}
                <div className="grid grid-cols-3 gap-2.5 text-center">
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
                    <div className="font-mono-tabular text-lg font-bold text-slate-900 dark:text-white">
                      {formatNum(CHALLENGE_QUESTION_COUNT, lang)}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {lang === 'bn' ? 'মোট প্রশ্ন' : 'Questions'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
                    <div className="font-mono-tabular text-lg font-bold text-slate-900 dark:text-white">
                      {lang === 'bn' ? '০৫:০০' : '05:00'}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {lang === 'bn' ? 'সর্বোচ্চ সময়' : 'Time Limit'}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
                    <div className="font-mono-tabular text-lg font-bold text-emerald-700 dark:text-emerald-400">
                      {formatNum(MIN_CORRECT_TO_CONQUER, lang)}/{formatNum(CHALLENGE_QUESTION_COUNT, lang)}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {lang === 'bn' ? 'ন্যূনতম সঠিক উত্তর' : 'Pass Score'}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <span>
                    {lang === 'bn'
                      ? '৫ মিনিটের মধ্যে ৩০টি প্রশ্নের কমপক্ষে ৩টি (৩/৩০) সঠিক হলে এলাকাটি মানচিত্রে সবুজ চিহ্নে যুক্ত হবে এবং শেয়ারযোগ্য ফটোকার্ড পাবেন।'
                      : 'Answer at least 3 of 30 questions correctly within 5 minutes to mark this area emerald on your map and unlock a downloadable shareable photocard.'}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleStartConquest}
                  className="w-full py-3 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <Flag className="w-4 h-4" />
                  <span>
                    {selectedTargetRecord
                      ? lang === 'bn'
                        ? 'আবার চ্যালেঞ্জ খেলুন'
                        : 'Replay Conquest Challenge'
                      : lang === 'bn'
                      ? 'জয় অভিযান শুরু করুন (৩০ প্রশ্ন · ৫ মি.)'
                      : 'Start Conquest (30 Questions · 5m)'}
                  </span>
                </button>
              </div>
            ) : (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                {lang === 'bn'
                  ? 'বাম পাশের মানচিত্র থেকে একটি বিভাগ, জেলা বা উপজেলা নির্বাচন করুন।'
                  : 'Select a Division, District, or Upazila on the map to begin.'}
              </div>
            )}

            {/* Recently Conquered Areas */}
            {totalConquered > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2.5">
                <div className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex items-center justify-between">
                  <span>{lang === 'bn' ? 'সাম্প্রতিক জয় করা এলাকা' : 'Recent Conquests'}</span>
                  <span className="font-mono-tabular text-slate-500 dark:text-slate-400">
                    {formatNum(totalConquered, lang)}
                  </span>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-800 max-h-48 overflow-y-auto">
                  {[
                    ...Object.entries(conquests.divisions).map(([id, rec]) => {
                      const d = divisionById.get(id);
                      return d
                        ? {
                            tier: 'division' as const,
                            id,
                            name: lang === 'bn' ? `${d.bnName} বিভাগ` : `${d.name} Division`,
                            bbox: divisionBBoxMap.get(id) || ([0, 0, 800, 1000] as [number, number, number, number]),
                            ...rec,
                          }
                        : null;
                    }),
                    ...Object.entries(conquests.districts).map(([id, rec]) => {
                      const d = districtById.get(id);
                      return d
                        ? {
                            tier: 'district' as const,
                            id,
                            name: lang === 'bn' ? `${d.bnName} জেলা` : `${d.name} District`,
                            bbox: d.bbox,
                            ...rec,
                          }
                        : null;
                    }),
                    ...Object.entries(conquests.upazilas).map(([id, rec]) => {
                      const u = upazilaById.get(id);
                      return u
                        ? {
                            tier: 'upazila' as const,
                            id,
                            name: lang === 'bn' ? u.bnName : u.name,
                            bbox: u.bbox,
                            ...rec,
                          }
                        : null;
                    }),
                  ]
                    .filter((x): x is NonNullable<typeof x> => Boolean(x))
                    .sort((a, b) => b.conqueredAt - a.conqueredAt)
                    .slice(0, 6)
                    .map((item) => (
                      <button
                        key={`rec-cq-${item.tier}-${item.id}`}
                        type="button"
                        onClick={() => handleSelectSearchTarget(item)}
                        className="w-full py-2 flex items-center justify-between gap-2 text-left text-xs hover:text-emerald-700 dark:hover:text-emerald-400 transition-colors"
                      >
                        <span className="font-medium text-slate-800 dark:text-slate-100 truncate inline-flex items-center gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span className="truncate">{item.name}</span>
                        </span>
                        <span className="font-mono-tabular text-slate-500 dark:text-slate-400 shrink-0">
                          {formatTimerClock(item.timeSec, lang)}
                        </span>
                      </button>
                    ))}
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* STAGE 2: ACTIVE 5-MINUTE / 30-QUESTION CONQUEST CHALLENGE */}
      {stage === 'active' && currentQuestion && selectedTarget && (
        <section className="max-w-4xl mx-auto space-y-4">
          {/* Mission HUD Header */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {lang === 'bn'
                  ? 'অভিযান চলমান · কমপক্ষে ৩/৩০ সঠিক উত্তর প্রয়োজন'
                  : 'Conquest In Progress · At least 3/30 Correct Required'}
              </div>
              <div className="font-display text-lg font-bold text-slate-900 dark:text-white truncate mt-0.5">
                {lang === 'bn'
                  ? `${selectedTarget.nameBn}${
                      selectedTarget.tier === 'division'
                        ? ' বিভাগ'
                        : selectedTarget.tier === 'district'
                        ? ' জেলা'
                        : ''
                    }`
                  : `${selectedTarget.nameEn}${
                      selectedTarget.tier === 'division'
                        ? ' Division'
                        : selectedTarget.tier === 'district'
                        ? ' District'
                        : ''
                    }`}
              </div>
            </div>

            <div className="flex items-center gap-3 ml-auto">
              <div
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-mono-tabular text-sm font-bold ${
                  remainingSec <= 30
                    ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-300 dark:border-rose-700 text-rose-700 dark:text-rose-300'
                    : remainingSec <= 90
                    ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-800 dark:text-amber-300'
                    : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
                }`}
              >
                <Clock className="w-4 h-4" />
                <span>{formatTimerClock(remainingSec, lang)}</span>
              </div>

              <div className="text-xs font-mono-tabular text-slate-600 dark:text-slate-300">
                {lang === 'bn'
                  ? `উত্তর ${formatNum(answeredCount, lang)}/${formatNum(questions.length, lang)}`
                  : `${answeredCount}/${questions.length} answered`}
              </div>

              <button
                type="button"
                onClick={() => setStage('select')}
                className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {lang === 'bn' ? 'বাতিল' : 'Exit'}
              </button>
            </div>
          </div>

          {/* 30-Question Rapid Jump Strip */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-3 sm:p-4">
            <div className="flex flex-wrap gap-1.5">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIdx;
                const isAnswered = answers[idx] !== undefined;
                return (
                  <button
                    key={`qnav-${q.id}-${idx}`}
                    type="button"
                    onClick={() => setCurrentIdx(idx)}
                    className={`w-8 h-8 rounded-md font-mono-tabular text-xs font-semibold border transition-colors ${
                      isCurrent
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white'
                        : isAnswered
                        ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-300'
                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                  >
                    {formatNum(idx + 1, lang)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Question Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-7 space-y-5">
            <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span className="font-mono-tabular font-semibold text-emerald-700 dark:text-emerald-400">
                {lang === 'bn'
                  ? `প্রশ্ন ${formatNum(currentIdx + 1, lang)} / ${formatNum(questions.length, lang)}`
                  : `Question ${currentIdx + 1} of ${questions.length}`}
              </span>
              <span>
                {lang === 'bn'
                  ? `অতিক্রান্ত সময়: ${formatTimerClock(CHALLENGE_DURATION_SEC - remainingSec, lang)}`
                  : `Elapsed: ${formatTimerClock(CHALLENGE_DURATION_SEC - remainingSec, lang)}`}
              </span>
            </div>

            <h2 className="font-display text-lg sm:text-xl font-bold text-slate-900 dark:text-white leading-snug">
              {lang === 'bn' ? currentQuestion.promptBn : currentQuestion.promptEn}
            </h2>

            <div className="grid grid-cols-1 gap-2.5">
              {(lang === 'bn' ? currentQuestion.optionsBn : currentQuestion.optionsEn).map(
                (optText, optIdx) => {
                  const selected = answers[currentIdx] === optIdx;
                  return (
                    <button
                      key={`cq-opt-${currentQuestion.id}-${optIdx}`}
                      type="button"
                      onClick={() => {
                        setAnswers((prev) => ({ ...prev, [currentIdx]: optIdx }));
                      }}
                      className={`w-full text-left px-4 py-3.5 rounded-xl border text-sm transition-colors flex items-center gap-3 cursor-pointer ${
                        selected
                          ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-600 dark:border-emerald-500 text-emerald-950 dark:text-emerald-100 font-semibold'
                          : 'bg-white dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-100 hover:border-slate-400 dark:hover:border-slate-600'
                      }`}
                    >
                      <span
                        className={`w-7 h-7 rounded-md border flex items-center justify-center text-xs font-bold shrink-0 ${
                          selected
                            ? 'bg-emerald-700 dark:bg-emerald-600 border-emerald-700 dark:border-emerald-600 text-white'
                            : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {optLabels[optIdx] || optIdx + 1}
                      </span>
                      <span className="flex-1">{optText}</span>
                    </button>
                  );
                }
              )}
            </div>

            {/* Bottom Controls */}
            <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentIdx === 0}
                  onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{lang === 'bn' ? 'আগের প্রশ্ন' : 'Previous'}</span>
                </button>

                {currentIdx < questions.length - 1 && (
                  <button
                    type="button"
                    onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:opacity-90"
                  >
                    <span>{lang === 'bn' ? 'পরবর্তী প্রশ্ন' : 'Next'}</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="button"
                disabled={answeredCount < questions.length}
                onClick={() =>
                  finishChallenge(answers, false, CHALLENGE_DURATION_SEC - remainingSec)
                }
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white text-xs font-semibold disabled:opacity-45 disabled:cursor-not-allowed transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>
                  {answeredCount < questions.length
                    ? lang === 'bn'
                      ? `সব উত্তর দিন (বাকি ${formatNum(questions.length - answeredCount, lang)}টি)`
                      : `Answer All (${questions.length - answeredCount} left)`
                    : lang === 'bn'
                    ? 'চ্যালেঞ্জ জমা দিন'
                    : 'Submit Conquest'}
                </span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* STAGE 3: VICTORY + FIREWORKS + MINIMALIST PHOTOCARD */}
      {stage === 'victory' && selectedTarget && (
        <section className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left 7 Columns: Clean Minimalist Downloadable Photocard */}
          <div className="lg:col-span-7 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-6">
            {renderingCard && !photocard ? (
              <div className="aspect-square w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-8 text-center">
                <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  {lang === 'bn' ? 'ফটোকার্ড তৈরি হচ্ছে...' : 'Preparing your minimalist photocard...'}
                </div>
              </div>
            ) : photocard ? (
              <img
                src={photocard.dataUrl}
                alt={`${getConquestHeadline(selectedTarget.tier)} - ${selectedTarget.nameEn}`}
                className="w-full aspect-square object-contain rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs bg-[#FAFBF9]"
              />
            ) : (
              /* Fallback Vector Card Preview if canvas blob unavailable */
              <div className="aspect-square w-full rounded-xl border border-slate-200 bg-[#FAFBF9] text-slate-900 p-8 flex flex-col justify-between text-center">
                <div>
                  <div className="text-xs font-semibold tracking-widest text-emerald-700">
                    CONQUER BANGLADESH THROUGH KNOWLEDGE
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-bold mt-2">
                    {getConquestHeadline(selectedTarget.tier)}
                  </h2>
                  <div className="text-base font-semibold text-slate-700 mt-1">
                    {selectedTarget.nameEn} · {selectedTarget.nameBn}
                  </div>
                </div>
                <div className="flex-1 flex items-center justify-center py-6">
                  <svg viewBox={targetPreviewBox} className="w-56 h-56">
                    <path
                      d={selectedTarget.svgPath}
                      fill="#10B981"
                      stroke="#064E3B"
                      strokeWidth="2.5"
                      vectorEffect="non-scaling-stroke"
                    />
                  </svg>
                </div>
                <div className="border-t border-slate-200 pt-4 flex items-center justify-between text-xs text-slate-600 font-mono-tabular">
                  <span>{playerName.trim() || 'Bangladesh Explorer'}</span>
                  <span>
                    {lastCorrectCount} / {CHALLENGE_QUESTION_COUNT} · {accuracyPct}% ACCURACY
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Right 5 Columns: Celebration Controls, Player Name Stamp, Download & Social Share */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-4">
              <div className="inline-flex items-center gap-2 text-emerald-700 dark:text-emerald-400 text-xs font-semibold uppercase tracking-wider">
                <Award className="w-4 h-4" />
                <span>{lang === 'bn' ? 'অভিযান সফল হয়েছে!' : 'Conquest Complete'}</span>
              </div>

              <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white leading-tight">
                {getConquestHeadline(selectedTarget.tier)}
              </h2>

              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {lang === 'bn'
                  ? `অভিনন্দন! আপনি ${formatTimerClock(completionSec, lang)} সময়ে ${formatNum(lastCorrectCount, lang)}/${formatNum(CHALLENGE_QUESTION_COUNT, lang)} (${formatNum(accuracyPct, lang)}% সঠিকতা) স্কোর করে এলাকাটি জয় করেছেন।`
                  : `Congratulations! You conquered this territory scoring ${lastCorrectCount}/${CHALLENGE_QUESTION_COUNT} (${accuracyPct}% accuracy) in ${formatTimerClock(completionSec, 'en')}.`}
              </p>

              {/* Optional Name Update for Photocard Signature */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2">
                <label
                  htmlFor="photocard-player-name"
                  className="text-xs font-medium text-slate-600 dark:text-slate-400 block"
                >
                  {lang === 'bn' ? 'ফটোকার্ডে আপনার নাম' : 'Your name on photocard'}
                </label>
                <div className="flex gap-2">
                  <input
                    id="photocard-player-name"
                    type="text"
                    maxLength={28}
                    value={playerName}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPlayerName(val);
                      try {
                        localStorage.setItem(PLAYER_STORAGE_KEY, val);
                      } catch {
                        // ignore
                      }
                    }}
                    placeholder={lang === 'bn' ? 'আপনার নাম লিখুন...' : 'Enter your name...'}
                    className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      void buildPhotocardForTarget(
                        selectedTarget,
                        completionSec,
                        selectedTargetRecord?.conqueredAt || Date.now(),
                        lastCorrectCount,
                        playerName
                      )
                    }
                    className="px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 whitespace-nowrap"
                  >
                    {lang === 'bn' ? 'আপডেট' : 'Update'}
                  </button>
                </div>
              </div>

              {/* Download & Social Share Actions */}
              <div className="space-y-2.5 pt-2">
                {photocard && (
                  <a
                    href={photocard.dataUrl}
                    download={photocard.fileName}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                  >
                    <Download className="w-4 h-4" />
                    <span>{lang === 'bn' ? 'ফটোকার্ড ডাউনলোড করুন (PNG)' : 'Download Photocard (PNG)'}</span>
                  </a>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void handleNativeShare()}
                    className="py-2 px-3 rounded-lg bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold flex items-center justify-center gap-1.5 hover:opacity-90"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'শেয়ার করুন' : 'Share'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyPhotocard()}
                    className="py-2 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{lang === 'bn' ? 'ছবি কপি করুন' : 'Copy Image'}</span>
                  </button>
                </div>

                {/* Direct Social Links (Declarative <a> tags — no window.open) */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs">
                  <a
                    href={`https://www.facebook.com/sharer/sharer.php?u=${currentUrlEncoded}&quote=${shareTextEncoded}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center py-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                  >
                    Facebook
                  </a>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${shareTextEncoded}&url=${currentUrlEncoded}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center py-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                  >
                    X / Twitter
                  </a>
                  <a
                    href={`https://wa.me/?text=${shareTextEncoded}%20${currentUrlEncoded}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-center py-2 px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-medium"
                  >
                    WhatsApp
                  </a>
                </div>

                {shareFeedback && (
                  <div className="text-xs font-medium text-emerald-700 dark:text-emerald-400 text-center">
                    {shareFeedback}
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFireworkKey((k) => k + 1)}
                  className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>{lang === 'bn' ? 'আতশবাজি' : 'Fireworks'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setStage('select')}
                  className="flex-1 py-2 px-3 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white text-xs font-semibold"
                >
                  {lang === 'bn' ? 'পরবর্তী এলাকা জয় করুন →' : 'Conquer Next Area →'}
                </button>
              </div>
            </div>

            {questions.length > 0 && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                <button
                  type="button"
                  onClick={() => setReviewExpanded((v) => !v)}
                  className="w-full flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-100"
                >
                  <span>
                    {lang === 'bn'
                      ? '৩০টি প্রশ্নের উত্তর পর্যালোচনা'
                      : 'Review All 30 Questions'}
                  </span>
                  <span>{reviewExpanded ? '−' : '+'}</span>
                </button>
                {reviewExpanded && (
                  <div className="mt-3 space-y-2.5 max-h-80 overflow-y-auto pr-1">
                    {questions.map((q, idx) => (
                      <div
                        key={`vrev-${q.id}-${idx}`}
                        className="p-2.5 rounded-lg bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900 text-xs space-y-1"
                      >
                        <div className="font-semibold text-slate-900 dark:text-white">
                          {formatNum(idx + 1, lang)}. {lang === 'bn' ? q.promptBn : q.promptEn}
                        </div>
                        <div className="text-emerald-800 dark:text-emerald-300">
                          ✓{' '}
                          {lang === 'bn'
                            ? q.optionsBn[q.correctIndex]
                            : q.optionsEn[q.correctIndex]}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {/* STAGE 4: FAILED ATTEMPT + FULL REVIEW */}
      {stage === 'failed' && selectedTarget && (
        <section className="max-w-4xl mx-auto space-y-5">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                  <XCircle className="w-4 h-4" />
                  <span>
                    {timedOut
                      ? lang === 'bn'
                        ? 'সময় শেষ হয়েছে (০৫:০০)'
                        : 'Time Expired (05:00)'
                      : lang === 'bn'
                      ? 'ন্যূনতম ৩টি সঠিক উত্তর অর্জিত হয়নি'
                      : 'Minimum 3/30 Correct Answers Not Reached'}
                  </span>
                </div>
                <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  {lang === 'bn'
                    ? `${selectedTarget.nameBn} জয় করা সম্ভব হয়নি`
                    : `Conquest Failed — ${selectedTarget.nameEn}`}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {lang === 'bn'
                    ? 'জয় করার জন্য ৫ মিনিটের মধ্যে ৩০টি প্রশ্নের মধ্যে কমপক্ষে ৩টি (৩/৩০) সঠিক উত্তর দিতে হবে। নিচে ভুলগুলো দেখে আবার চেষ্টা করুন।'
                    : 'At least 3 out of 30 questions must be answered correctly within 5 minutes to conquer this territory.'}
                </p>
              </div>

              <div className="text-right font-mono-tabular">
                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                  {formatNum(
                    questions.filter((q, i) => answers[i] === q.correctIndex).length,
                    lang
                  )}{' '}
                  / {formatNum(questions.length, lang)}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">
                  {lang === 'bn'
                    ? `ব্যবহৃত সময়: ${formatTimerClock(completionSec, lang)}`
                    : `Time used: ${formatTimerClock(completionSec, lang)}`}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleStartConquest}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white text-sm font-semibold"
              >
                <RotateCcw className="w-4 h-4" />
                <span>{lang === 'bn' ? 'আবার ৩০ প্রশ্নের চ্যালেঞ্জ দিন' : 'Retry Conquest Challenge'}</span>
              </button>
              <button
                type="button"
                onClick={() => setStage('select')}
                className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                {lang === 'bn' ? 'মানচিত্রে ফিরে যান' : 'Back to Conquest Map'}
              </button>
            </div>
          </div>

          {/* Review All Questions */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 sm:p-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {lang === 'bn' ? 'উত্তর পর্যালোচনা' : 'Answer Review'}
            </h3>
            <div className="space-y-3">
              {questions.map((q, idx) => {
                const chosen = answers[idx];
                const isCorrect = chosen === q.correctIndex;
                return (
                  <div
                    key={`frev-${q.id}-${idx}`}
                    className={`p-3.5 rounded-xl border text-xs space-y-1.5 ${
                      isCorrect
                        ? 'bg-emerald-50/40 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900'
                        : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900'
                    }`}
                  >
                    <div className="font-semibold text-slate-900 dark:text-white flex items-start justify-between gap-2">
                      <span>
                        {formatNum(idx + 1, lang)}. {lang === 'bn' ? q.promptBn : q.promptEn}
                      </span>
                      <span
                        className={`shrink-0 font-bold ${
                          isCorrect
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {isCorrect
                          ? lang === 'bn'
                            ? 'সঠিক'
                            : 'Correct'
                          : chosen === undefined
                          ? lang === 'bn'
                            ? 'উত্তর দেওয়া হয়নি'
                            : 'Unanswered'
                          : lang === 'bn'
                          ? 'ভুল'
                          : 'Wrong'}
                      </span>
                    </div>
                    {!isCorrect && chosen !== undefined && (
                      <div className="text-rose-700 dark:text-rose-300">
                        {lang === 'bn' ? 'আপনার উত্তর: ' : 'Your answer: '}
                        {lang === 'bn' ? q.optionsBn[chosen] : q.optionsEn[chosen]}
                      </div>
                    )}
                    <div className="text-emerald-800 dark:text-emerald-300 font-medium">
                      {lang === 'bn' ? 'সঠিক উত্তর: ' : 'Correct answer: '}
                      {lang === 'bn'
                        ? q.optionsBn[q.correctIndex]
                        : q.optionsEn[q.correctIndex]}
                    </div>
                    <div className="text-slate-600 dark:text-slate-400">
                      {lang === 'bn' ? q.explanationBn : q.explanationEn}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      )}
    </div>
  );
};
