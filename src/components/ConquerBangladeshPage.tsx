import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  HelpCircle,
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
  totalQuestions?: number;
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

interface TierChallengeRules {
  questionCount: 20 | 30;
  durationSec: number;
  minutesBn: string;
  minutesEn: string;
  clockBn: string;
  clockEn: string;
}

type ConquestStage = 'select' | 'active' | 'victory' | 'failed';

const CONQUEST_STORAGE_KEY = 'bd_atlas_conquests_v1';
const PLAYER_STORAGE_KEY = 'bd_atlas_quiz_player_v1';
const BENGALI_OPTION_LABELS = ['ক', 'খ', 'গ', 'ঘ'];
const ENGLISH_OPTION_LABELS = ['A', 'B', 'C', 'D'];

function getTierChallengeRules(tier: ConquestTier): TierChallengeRules {
  if (tier === 'upazila') {
    return {
      questionCount: 20,
      durationSec: 180,
      minutesBn: '৩',
      minutesEn: '3',
      clockBn: '০৩:০০',
      clockEn: '03:00',
    };
  }
  return {
    questionCount: 30,
    durationSec: 300,
    minutesBn: '৫',
    minutesEn: '5',
    clockBn: '০৫:০০',
    clockEn: '05:00',
  };
}

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

  // Map Selection State (nothing selected by default)
  const [selectedTier, setSelectedTier] = useState<ConquestTier>('division');
  const [selectedId, setSelectedId] = useState<string | null>(null);
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
  const [remainingSec, setRemainingSec] = useState<number>(300);
  const [completionSec, setCompletionSec] = useState<number>(0);
  const [lastCorrectCount, setLastCorrectCount] = useState<number>(30);
  const [lastTotalQuestions, setLastTotalQuestions] = useState<number>(30);
  const [timedOut, setTimedOut] = useState<boolean>(false);
  const [reviewExpanded, setReviewExpanded] = useState<boolean>(false);

  // Victory Celebration & Photocard State
  const [fireworkKey, setFireworkKey] = useState<number>(0);
  const [photocard, setPhotocard] = useState<RenderedPhotocard | null>(null);
  const [renderingCard, setRenderingCard] = useState<boolean>(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState<boolean>(false);
  const mapSectionRef = useRef<HTMLDivElement>(null);
  const briefingCardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!helpOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setHelpOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [helpOpen]);

  const scrollToBriefingOnMobileOrTablet = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth >= 1024 || document.fullscreenElement) return;
    window.setTimeout(() => {
      briefingCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
  }, []);

  const scrollToMapOnMobileOrTablet = useCallback(() => {
    if (typeof window === 'undefined') return;
    if (window.innerWidth >= 1024 || document.fullscreenElement) return;
    window.setTimeout(() => {
      mapSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }, []);

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

  const targetRules = useMemo(
    () => getTierChallengeRules(selectedTarget?.tier || selectedTier),
    [selectedTarget?.tier, selectedTier]
  );

  const buildPhotocardForTarget = useCallback(
    async (
      target: TargetInfo,
      timeSec: number,
      conqueredAt: number,
      correctCount: number,
      totalQuestionsCount: number,
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
          totalQuestions: totalQuestionsCount,
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
      const rules = getTierChallengeRules(selectedTarget?.tier || selectedTier);
      const requiredCount = rules.questionCount;
      let correctCount = 0;
      for (let i = 0; i < questions.length; i += 1) {
        if (finalAnswers[i] === questions[i].correctIndex) {
          correctCount += 1;
        }
      }

      setTimedOut(didTimeout);
      setCompletionSec(usedSec);
      setLastCorrectCount(correctCount);
      setLastTotalQuestions(questions.length || requiredCount);

      const hasConquered =
        !didTimeout &&
        questions.length === requiredCount &&
        correctCount === requiredCount;

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
          const prevScore = existing?.bestScore ?? requiredCount;
          const nextBestScore = existing
            ? Math.min(requiredCount, Math.max(prevScore, correctCount))
            : correctCount;
          const next: ConquestState = {
            ...prev,
            [key]: {
              ...prev[key],
              [selectedTarget.id]: {
                timeSec: bestTime,
                conqueredAt: existing?.conqueredAt || now,
                bestScore: nextBestScore,
                totalQuestions: requiredCount,
              },
            },
          };
          saveConquestState(next);
          return next;
        });

        setStage('victory');
        setReviewExpanded(false);
        setFireworkKey((k) => k + 1);
        void buildPhotocardForTarget(selectedTarget, usedSec, now, correctCount, requiredCount);
      } else {
        setStage('failed');
        setReviewExpanded(true);
      }
    },
    [questions, selectedTarget, selectedTier, buildPhotocardForTarget]
  );

  // Countdown Timer during Active Challenge
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
      finishChallenge(answers, true, targetRules.durationSec);
    }
  }, [stage, remainingSec, questions.length, answers, finishChallenge, targetRules.durationSec]);

  const handleStartConquest = () => {
    if (!selectedTarget) return;
    const rules = getTierChallengeRules(selectedTarget.tier);
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
        questionCount: rules.questionCount,
      },
      { divisions, districts, upazilas, rivers }
    );

    const picked = generated.slice(0, rules.questionCount);
    setQuestions(picked);
    setAnswers({});
    setCurrentIdx(0);
    setRemainingSec(rules.durationSec);
    setCompletionSec(0);
    setLastTotalQuestions(picked.length || rules.questionCount);
    setTimedOut(false);
    setPhotocard(null);
    setShareFeedback(null);
    setStage('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleViewExistingPhotocard = () => {
    if (!selectedTarget || !selectedTargetRecord) return;
    const rules = getTierChallengeRules(selectedTarget.tier);
    const totalQ = selectedTargetRecord.totalQuestions ?? rules.questionCount;
    const savedScore = Math.min(totalQ, selectedTargetRecord.bestScore ?? totalQ);
    setCompletionSec(selectedTargetRecord.timeSec);
    setLastCorrectCount(savedScore);
    setLastTotalQuestions(totalQ);
    setTimedOut(false);
    setQuestions([]);
    setStage('victory');
    setFireworkKey((k) => k + 1);
    void buildPhotocardForTarget(
      selectedTarget,
      selectedTargetRecord.timeSec,
      selectedTargetRecord.conqueredAt,
      savedScore,
      totalQ
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMapSelectDivision = (divId: string) => {
    setSelectedTier('division');
    setSelectedId(divId);
    scrollToBriefingOnMobileOrTablet();
  };

  const handleMapSelectDistrict = (distId: string) => {
    setSelectedTier('district');
    setSelectedId(distId);
    scrollToBriefingOnMobileOrTablet();
  };

  const handleMapSelectUpazila = (upzId: string) => {
    setSelectedTier('upazila');
    setSelectedId(upzId);
    scrollToBriefingOnMobileOrTablet();
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
    scrollToBriefingOnMobileOrTablet();
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
    const totalQ = lastTotalQuestions || targetRules.questionCount;
    const accuracyPct = Math.round((lastCorrectCount / Math.max(1, totalQ)) * 100);
    const shareText = `${headline}: ${selectedTarget.nameEn} (${selectedTarget.nameBn}) — ${lastCorrectCount}/${totalQ} (${accuracyPct}% accuracy) in Conquer Bangladesh Through Knowledge!`;
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

  // Compute SVG miniature preview viewBox for the selected target
  const targetPreviewBox = useMemo(() => {
    if (!selectedTarget) return '0 0 800 1000';
    const [x1, y1, x2, y2] = selectedTarget.bbox;
    const w = Math.max(12, x2 - x1);
    const h = Math.max(12, y2 - y1);
    const pad = Math.max(w, h) * 0.14;
    return `${x1 - pad} ${y1 - pad} ${w + pad * 2} ${h + pad * 2}`;
  }, [selectedTarget]);

  const activeTotalQuestions = lastTotalQuestions || targetRules.questionCount;
  const accuracyPct = Math.round((lastCorrectCount / Math.max(1, activeTotalQuestions)) * 100);
  const shareTextEncoded = encodeURIComponent(
    selectedTarget
      ? `${getConquestHeadline(selectedTarget.tier)} — ${selectedTarget.nameEn} (${selectedTarget.nameBn}) · ${lastCorrectCount}/${activeTotalQuestions} (${accuracyPct}% Accuracy) in Conquer Bangladesh Through Knowledge!`
      : 'Conquer Bangladesh Through Knowledge!'
  );
  const currentUrlEncoded = encodeURIComponent(
    typeof window !== 'undefined' ? window.location.href : ''
  );

  return (
    <div className="space-y-4">
      {/* Celebratory Canvas Fireworks when player conquers territory */}
      <FireworksBurst active={stage === 'victory'} burstKey={fireworkKey} />

      {/* Mobile & Tablet Top Bar: Pic 4 Title + Compact Search Bar (PC stays completely unchanged) */}
      {stage === 'select' && (
        <section className="lg:hidden pb-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2.5">
          <h1 className="font-display text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight leading-tight min-w-0">
            Conquer Bangladesh Through Knowledge
          </h1>

          <div className="relative w-36 sm:w-52 shrink-0">
            <label htmlFor="conquest-mobile-search" className="sr-only">
              {lang === 'bn'
                ? 'বিভাগ, জেলা বা উপজেলা খুঁজুন'
                : 'Search Division, District or Upazila'}
            </label>
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="conquest-mobile-search"
              type="text"
              value={targetSearch}
              onFocus={() => setTargetSearchOpen(true)}
              onBlur={() => setTimeout(() => setTargetSearchOpen(false), 180)}
              onChange={(e) => {
                setTargetSearch(e.target.value);
                setTargetSearchOpen(true);
              }}
              placeholder={lang === 'bn' ? 'এলাকা খুঁজুন...' : 'Search area...'}
              className="w-full pl-8 pr-7 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:border-emerald-600"
            />
            {targetSearch && (
              <button
                type="button"
                onClick={() => setTargetSearch('')}
                aria-label={lang === 'bn' ? 'মুছুন' : 'Clear'}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}

            {targetSearchOpen && targetSearch.trim().length > 0 && (
              <div className="absolute right-0 mt-1.5 w-72 sm:w-80 max-w-[calc(100vw-1.75rem)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl z-40 max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                {searchSuggestions.length > 0 ? (
                  searchSuggestions.map((item) => (
                    <button
                      key={`cq-ms-${item.tier}-${item.id}`}
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
        </section>
      )}

      {/* Desktop Compact Header (and Active/Result Stages on Mobile & Tablet) */}
      <section
        className={`${
          stage === 'select' ? 'hidden lg:flex' : 'flex'
        } flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3.5`}
      >
        <div className="space-y-0.5 max-w-2xl">
          <h1 className="font-display text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
            Conquer Bangladesh Through Knowledge
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {lang === 'bn'
              ? 'উপজেলা: ২০ প্রশ্ন (৩ মি.) · জেলা ও বিভাগ: ৩০ প্রশ্ন (৫ মি.) · ১০০% সঠিক উত্তর'
              : 'Upazila: 20 Qs (3m) · District/Division: 30 Qs (5m) · 100% accuracy'}
          </p>
        </div>

        {/* Clean Minimalist National Progress Summary (Zero Pills) */}
        <div className="w-full lg:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl px-4 py-3 space-y-2 shrink-0">
          <div className="flex items-center justify-between text-xs">
            <span className="font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5">
              <Flag className="w-3.5 h-3.5 text-emerald-700 dark:text-emerald-400" />
              <span>{lang === 'bn' ? 'বাংলাদেশ জয় অগ্রগতি' : 'Bangladesh Conquest'}</span>
            </span>
            <span className="font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400">
              {formatNum(totalConquered, lang)} / {formatNum(totalTerritories, lang)} ({formatNum(totalPercent, lang)}%)
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-300"
              style={{ width: `${Math.min(100, (totalConquered / Math.max(1, totalTerritories)) * 100)}%` }}
            />
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-tabular flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
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
          <div ref={mapSectionRef} className="lg:col-span-7 scroll-mt-20 space-y-3">
            <BangladeshMapCanvas
              districts={districts}
              upazilas={upazilas}
              divisions={divisions}
              rivers={[]}
              selectedDivisionId={selectedTier === 'division' ? selectedId : null}
              selectedDistrictId={selectedTier === 'district' ? selectedId : null}
              selectedUpazilaId={selectedTier === 'upazila' ? selectedId : null}
              appliedDirections={[]}
              activeRiverIds={[]}
              conquestMode={true}
              conqueredDivisionIds={conqueredDivisionSet}
              conqueredDistrictIds={conqueredDistrictSet}
              conqueredUpazilaIds={conqueredUpazilaSet}
              focusBBoxRequest={focusBBoxRequest}
              lang={lang}
              theme={theme}
              onSelectDivision={handleMapSelectDivision}
              onSelectDistrict={handleMapSelectDistrict}
              onSelectUpazila={handleMapSelectUpazila}
              onOpenHelp={() => setHelpOpen(true)}
              onResetView={() => {
                setSelectedTier('division');
                setSelectedId(null);
              }}
            />
          </div>

          {/* Right 5 Columns: Quick Search (Desktop) / Progress Card (Mobile & Tablet) + Target Briefing Card */}
          <div className="lg:col-span-5 space-y-4">
            {/* Mobile & Tablet Conquest Progress Strip (Swapped into Search Bar's old position) */}
            <div className="lg:hidden bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2 text-xs">
                <span className="font-display text-sm font-bold text-slate-900 dark:text-white inline-flex items-center gap-1.5">
                  Conquer Bangladesh
                </span>
                <span className="font-mono-tabular font-bold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1 shrink-0">
                  <Flag className="w-3.5 h-3.5" />
                  <span>
                    {formatNum(totalConquered, lang)}/{formatNum(totalTerritories, lang)} ({formatNum(totalPercent, lang)}%)
                  </span>
                </span>
              </div>
              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-600 dark:bg-emerald-500 transition-all duration-300"
                  style={{ width: `${Math.min(100, (totalConquered / Math.max(1, totalTerritories)) * 100)}%` }}
                />
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 font-mono-tabular flex flex-wrap items-center gap-x-2.5 gap-y-0.5">
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

            {/* Desktop Search Box to Jump Directly to Any Division, District, or Upazila (Unchanged on PC) */}
            <div className="hidden lg:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-2.5">
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
            <div ref={briefingCardRef} className="scroll-mt-20">
              {selectedTarget ? (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 sm:p-6 space-y-5">
                  <div className="flex items-center justify-between gap-2 lg:hidden">
                    <button
                      type="button"
                      onClick={scrollToMapOnMobileOrTablet}
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline"
                    >
                      <span>↑ {lang === 'bn' ? 'মানচিত্রে ফিরে যান' : 'Back to Map'}</span>
                    </button>
                  </div>
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
                            {(() => {
                              const recTotal = selectedTargetRecord.totalQuestions ?? targetRules.questionCount;
                              const recScore = Math.min(recTotal, selectedTargetRecord.bestScore ?? recTotal);
                              return lang === 'bn'
                                ? `সর্বোচ্চ স্কোর: ${formatNum(recScore, lang)}/${formatNum(recTotal, lang)} · সেরা সময়: ${formatTimerClock(selectedTargetRecord.timeSec, lang)}`
                                : `Best Score: ${recScore}/${recTotal} · Best Time: ${formatTimerClock(selectedTargetRecord.timeSec, lang)}`;
                            })()}
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

                  {/* Victory Conditions (Dynamic per Territory Tier) */}
                  <div className="grid grid-cols-3 gap-2.5 text-center">
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
                      <div className="font-mono-tabular text-lg font-bold text-slate-900 dark:text-white">
                        {formatNum(targetRules.questionCount, lang)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {lang === 'bn' ? 'মোট প্রশ্ন' : 'Questions'}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
                      <div className="font-mono-tabular text-lg font-bold text-slate-900 dark:text-white">
                        {lang === 'bn' ? targetRules.clockBn : targetRules.clockEn}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {lang === 'bn' ? 'সর্বোচ্চ সময়' : 'Time Limit'}
                      </div>
                    </div>
                    <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50">
                      <div className="font-mono-tabular text-lg font-bold text-emerald-700 dark:text-emerald-400">
                        {formatNum(targetRules.questionCount, lang)}/{formatNum(targetRules.questionCount, lang)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {lang === 'bn' ? '১০০% সঠিক উত্তর' : '100% Accuracy'}
                      </div>
                    </div>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed flex items-start gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      {lang === 'bn'
                        ? `${targetRules.minutesBn} মিনিটের মধ্যে ${formatNum(targetRules.questionCount, lang)}টি প্রশ্নের সবগুলোর (${formatNum(targetRules.questionCount, lang)}/${formatNum(targetRules.questionCount, lang)}) সঠিক উত্তর দিলে এলাকাটি মানচিত্রে সবুজ চিহ্নে যুক্ত হবে এবং শেয়ারযোগ্য ফটোকার্ড পাবেন।`
                        : `Answer all ${targetRules.questionCount} questions correctly (100% accuracy) within ${targetRules.minutesEn} minutes to mark this area emerald on your map and unlock a downloadable shareable photocard.`}
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
                        ? `জয় অভিযান শুরু করুন (${formatNum(targetRules.questionCount, lang)} প্রশ্ন · ${targetRules.minutesBn} মি.)`
                        : `Start Conquest (${targetRules.questionCount} Questions · ${targetRules.minutesEn}m)`}
                    </span>
                  </button>
                </div>
              ) : (
                <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 text-center text-sm text-slate-500 dark:text-slate-400">
                  {lang === 'bn'
                    ? 'মানচিত্র থেকে একটি বিভাগ, জেলা বা উপজেলা নির্বাচন করুন।'
                    : 'Select a Division, District, or Upazila on the map to begin.'}
                </div>
              )}
            </div>

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

      {/* STAGE 2: ACTIVE CONQUEST CHALLENGE */}
      {stage === 'active' && currentQuestion && selectedTarget && (
        <section className="max-w-4xl mx-auto space-y-4">
          {/* Mission HUD Header */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                {lang === 'bn'
                  ? `অভিযান চলমান · ${formatNum(questions.length || targetRules.questionCount, lang)}/${formatNum(questions.length || targetRules.questionCount, lang)} (১০০%) সঠিক উত্তর প্রয়োজন`
                  : `Conquest In Progress · ${questions.length || targetRules.questionCount}/${questions.length || targetRules.questionCount} (100% Accuracy) Required`}
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
                  ? `অতিক্রান্ত সময়: ${formatTimerClock(targetRules.durationSec - remainingSec, lang)}`
                  : `Elapsed: ${formatTimerClock(targetRules.durationSec - remainingSec, lang)}`}
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
                  finishChallenge(answers, false, targetRules.durationSec - remainingSec)
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
                <div className="flex-1 flex items-center justify-center py-6 relative border border-slate-200 bg-white rounded-xl my-3 overflow-hidden">
                  <div className="w-56 h-56 rounded-full bg-emerald-500/5 border border-emerald-500/10 flex items-center justify-center">
                    <svg viewBox={targetPreviewBox} className="w-48 h-48">
                      <path
                        d={selectedTarget.svgPath}
                        fill="#10B981"
                        stroke="#064E3B"
                        strokeWidth="2.5"
                        vectorEffect="non-scaling-stroke"
                      />
                    </svg>
                  </div>
                  <div className="absolute inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-950/90 border border-emerald-400 text-white text-sm font-bold shadow-md pointer-events-none select-none">
                    <MapPin className="w-3.5 h-3.5 text-white shrink-0" />
                    <span>
                      {selectedTarget.nameEn}
                      {selectedTarget.tier === 'district'
                        ? ' District'
                        : selectedTarget.tier === 'division'
                        ? ' Division'
                        : ''}
                    </span>
                  </div>
                </div>
                <div className="border-t border-slate-200 pt-4 flex items-center justify-between text-xs text-slate-600 font-mono-tabular">
                  <span>{playerName.trim() || 'Bangladesh Explorer'}</span>
                  <span>
                    {lastCorrectCount} / {activeTotalQuestions} · {accuracyPct}% ACCURACY
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
                  ? `অভিনন্দন! আপনি ${formatTimerClock(completionSec, lang)} সময়ে ${formatNum(lastCorrectCount, lang)}/${formatNum(activeTotalQuestions, lang)} (${formatNum(accuracyPct, lang)}% সঠিকতা) স্কোর করে এলাকাটি জয় করেছেন।`
                  : `Congratulations! You conquered this territory scoring ${lastCorrectCount}/${activeTotalQuestions} (${accuracyPct}% accuracy) in ${formatTimerClock(completionSec, 'en')}.`}
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
                        activeTotalQuestions,
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
                      ? `${formatNum(questions.length, lang)}টি প্রশ্নের উত্তর পর্যালোচনা`
                      : `Review All ${questions.length} Questions`}
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
                        ? `সময় শেষ হয়েছে (${targetRules.clockBn})`
                        : `Time Expired (${targetRules.clockEn})`
                      : lang === 'bn'
                      ? `${formatNum(targetRules.questionCount, lang)}টি প্রশ্নের সবগুলোর (১০০%) সঠিক উত্তর অর্জিত হয়নি`
                      : `100% Accuracy (${targetRules.questionCount}/${targetRules.questionCount}) Not Reached`}
                  </span>
                </div>
                <h2 className="font-display text-2xl font-bold text-slate-900 dark:text-white">
                  {lang === 'bn'
                    ? `${selectedTarget.nameBn} জয় করা সম্ভব হয়নি`
                    : `Conquest Failed — ${selectedTarget.nameEn}`}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {lang === 'bn'
                    ? `জয় করার জন্য ${targetRules.minutesBn} মিনিটের মধ্যে ${formatNum(targetRules.questionCount, lang)}টি প্রশ্নের সবগুলোর (১০০%) সঠিক উত্তর দিতে হবে। নিচে ভুলগুলো দেখে আবার চেষ্টা করুন।`
                    : `All ${targetRules.questionCount} questions must be answered correctly (100% accuracy) within ${targetRules.minutesEn} minutes to conquer this territory.`}
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
                <span>
                  {lang === 'bn'
                    ? `আবার ${formatNum(targetRules.questionCount, lang)} প্রশ্নের চ্যালেঞ্জ দিন`
                    : 'Retry Conquest Challenge'}
                </span>
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

      {/* Conquer Bangladesh Help Modal */}
      {helpOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-xs"
          onClick={() => setHelpOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="conquest-help-title"
        >
          <div
            className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                <h2
                  id="conquest-help-title"
                  className="font-display text-base font-bold text-slate-900 dark:text-white"
                >
                  {lang === 'bn'
                    ? 'Conquer Bangladesh ব্যবহার নির্দেশিকা'
                    : 'How Conquer Bangladesh Works'}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                aria-label={lang === 'bn' ? 'বন্ধ করুন' : 'Close'}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3.5 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-mono-tabular font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  {formatNum(1, lang)}
                </span>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {lang === 'bn' ? 'লক্ষ্য এলাকা নির্বাচন ও জুম' : 'Zoom & Select a Territory'}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {lang === 'bn'
                      ? 'প্রথমে মানচিত্রে ৮টি বিভাগ দেখা যাবে। মানচিত্রের নির্দিষ্ট স্থানে জুম (+) বা চিমটি করলে প্রথমে ৬৪টি জেলা এবং আরও জুম করলে ৫৪৪টি উপজেলা খুলে যাবে। যেকোনো বিভাগ, জেলা বা উপজেলায় ক্লিক করলে (অথবা উপরের সার্চ বারে নাম লিখলে) সরাসরি সেটির অভিযান কার্ড ওপেন হবে।'
                      : 'The map opens with 8 Divisions—zoom in (+) or pinch an area to reveal 64 Districts, and zoom further to unlock 544 Upazilas. Tap any Division, District, or Upazila (or search by name above) to jump straight to its conquest briefing.'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-mono-tabular font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  {formatNum(2, lang)}
                </span>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {lang === 'bn' ? 'জয়ের শর্ত (১০০% সঠিক উত্তর)' : 'Victory Rules (100% Accuracy)'}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {lang === 'bn'
                      ? 'উপজেলা জয়ে ৩ মিনিটে ২০টি প্রশ্নের ২০টিই, আর জেলা বা বিভাগ জয়ে ৫ মিনিটে ৩০টি প্রশ্নের ৩০টিই সঠিক হতে হবে।'
                      : 'Answer 20/20 questions within 3 minutes for Upazilas, or 30/30 within 5 minutes for Districts & Divisions.'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-mono-tabular font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  {formatNum(3, lang)}
                </span>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {lang === 'bn' ? 'সবুজ রঙে মানচিত্র জয়' : 'Turn the Map Emerald'}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {lang === 'bn'
                      ? 'সফল হলে এলাকাটি মানচিত্রে স্থায়ীভাবে সবুজ চিহ্নে যুক্ত হবে এবং আপনার মোট অগ্রগতি বাড়বে।'
                      : 'Conquered areas turn emerald green permanently on your map and count toward your 616-territory progress.'}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <span className="w-5 h-5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 font-mono-tabular font-bold text-[11px] flex items-center justify-center shrink-0 mt-0.5">
                  {formatNum(4, lang)}
                </span>
                <div>
                  <div className="font-semibold text-slate-900 dark:text-white">
                    {lang === 'bn' ? 'ফটোকার্ড সংগ্রহ ও শেয়ার' : 'Download & Share Photocard'}
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    {lang === 'bn'
                      ? 'প্রতিটি জয়ের পর আপনার নাম ও সময়সহ একটি ক্লিন ফটোকার্ড পাবেন, যা PNG হিসেবে ডাউনলোড বা শেয়ার করা যাবে।'
                      : 'Unlock a personalized victory photocard with your name, accuracy, and time to download as PNG or share.'}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-5 py-3 bg-slate-50 dark:bg-slate-950/50 border-t border-slate-200 dark:border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setHelpOpen(false)}
                className="px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-700 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                {lang === 'bn' ? 'বুঝেছি' : 'Got it'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
