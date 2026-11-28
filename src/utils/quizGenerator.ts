import {
  DIRECTION_INFO,
  DISTRICT_DETAILS,
  DIVISION_META,
} from '../data/bdDistrictDetails';
import { RIVER_DETAILS } from '../data/bdRiverDetails';
import {
  getRelativeOffsetLabel,
  getUpazilaDetail,
  hasCuratedUpazilaDetail,
} from '../data/bdUpazilaDetails';
import { formatNum, toBnDigits } from './format';
import type { GeoDistrict, GeoDivision, GeoRiver, GeoUpazila } from '../types/map';

export type QuizScopeType = 'bangladesh' | 'division' | 'district' | 'upazila';
export type QuizCategory = 'mixed' | 'geography_borders' | 'rivers' | 'heritage_facts';
export type QuizLength = 10 | 15 | 20 | 30;

export interface QuizConfig {
  scopeType: QuizScopeType;
  scopeId?: string;
  category: QuizCategory;
  questionCount: QuizLength;
}

export interface QuizQuestion {
  id: string;
  category: Exclude<QuizCategory, 'mixed'>;
  promptBn: string;
  promptEn: string;
  optionsBn: string[];
  optionsEn: string[];
  correctIndex: number;
  explanationBn: string;
  explanationEn: string;
}

interface InternalQuestion extends QuizQuestion {
  priority: 1 | 2;
}

interface OptionPair {
  bn: string;
  en: string;
}

interface QuizDataset {
  divisions: GeoDivision[];
  districts: GeoDistrict[];
  upazilas: GeoUpazila[];
  rivers: GeoRiver[];
}

function shuffleArray<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function buildQuestion(
  id: string,
  priority: 1 | 2,
  category: Exclude<QuizCategory, 'mixed'>,
  promptBn: string,
  promptEn: string,
  correct: OptionPair,
  distractors: OptionPair[],
  explanationBn: string,
  explanationEn: string
): InternalQuestion | null {
  const seenBn = new Set<string>([correct.bn.trim()]);
  const seenEn = new Set<string>([correct.en.trim()]);
  const uniqueDistractors: OptionPair[] = [];

  for (const d of shuffleArray(distractors)) {
    const b = d.bn.trim();
    const e = d.en.trim();
    if (!b || !e || seenBn.has(b) || seenEn.has(e)) continue;
    seenBn.add(b);
    seenEn.add(e);
    uniqueDistractors.push({ bn: b, en: e });
    if (uniqueDistractors.length >= 3) break;
  }

  if (uniqueDistractors.length < 3) return null;

  const indexed = [
    { ...correct, isCorrect: true },
    ...uniqueDistractors.map((d) => ({ ...d, isCorrect: false })),
  ];
  const shuffled = shuffleArray(indexed);
  const correctIndex = shuffled.findIndex((o) => o.isCorrect);

  return {
    id,
    priority,
    category,
    promptBn,
    promptEn,
    optionsBn: shuffled.map((o) => o.bn),
    optionsEn: shuffled.map((o) => o.en),
    correctIndex,
    explanationBn,
    explanationEn,
  };
}

export function generateQuizQuestions(
  config: QuizConfig,
  data: QuizDataset
): QuizQuestion[] {
  const { divisions, districts, upazilas, rivers } = data;
  const divMap = new Map(divisions.map((d) => [d.id, d]));
  const distMap = new Map(districts.map((d) => [d.id, d]));
  const upazilaMap = new Map(upazilas.map((u) => [u.id, u]));
  const riverMap = new Map(rivers.map((r) => [r.id, r]));

  const upazilasByDist = new Map<string, GeoUpazila[]>();
  for (const u of upazilas) {
    const list = upazilasByDist.get(u.districtId) || [];
    list.push(u);
    upazilasByDist.set(u.districtId, list);
  }

  const districtsByDiv = new Map<string, GeoDistrict[]>();
  for (const d of districts) {
    const list = districtsByDiv.get(d.divisionId) || [];
    list.push(d);
    districtsByDiv.set(d.divisionId, list);
  }

  const bank: InternalQuestion[] = [];
  let qCounter = 0;
  const pushQ = (q: InternalQuestion | null) => {
    if (q) bank.push(q);
  };
  const nextId = (prefix: string) => `${prefix}-${++qCounter}`;

  const addRiverFacts = (
    r: GeoRiver,
    priority: 1 | 2,
    thorough: boolean,
    contextBn?: string,
    contextEn?: string
  ) => {
    const rd = RIVER_DETAILS[r.id];
    const otherRivers = rivers.filter((or) => or.id !== r.id && RIVER_DETAILS[or.id]);
    const prefixBn = contextBn ? `${contextBn} ` : '';
    const prefixEn = contextEn ? `${contextEn} ` : '';

    if (rd) {
      pushQ(
        buildQuestion(
          nextId('riv-orig'),
          priority,
          'rivers',
          `${prefixBn}${r.bnName} নদীর উৎপত্তিস্থল বা বাংলাদেশে প্রবেশ পথ কোনটি?`,
          `${prefixEn}Where does the ${r.name} River originate or enter Bangladesh?`,
          { bn: rd.originBn, en: rd.originEn },
          otherRivers.map((or) => ({
            bn: RIVER_DETAILS[or.id].originBn,
            en: RIVER_DETAILS[or.id].originEn,
          })),
          `${r.bnName} নদীর উৎপত্তি/প্রবেশ: ${rd.originBn}।`,
          `${r.name} River origin/entry: ${rd.originEn}.`
        )
      );

      pushQ(
        buildQuestion(
          nextId('riv-mouth'),
          priority,
          'rivers',
          `${prefixBn}${r.bnName} নদীর মোহনা বা সমাপ্তিস্থল কোথায়?`,
          `${prefixEn}Where is the mouth or confluence of the ${r.name} River?`,
          { bn: rd.mouthBn, en: rd.mouthEn },
          otherRivers.map((or) => ({
            bn: RIVER_DETAILS[or.id].mouthBn,
            en: RIVER_DETAILS[or.id].mouthEn,
          })),
          `${r.bnName} নদীর মোহনা: ${rd.mouthBn}।`,
          `Mouth of ${r.name} River: ${rd.mouthEn}.`
        )
      );

      pushQ(
        buildQuestion(
          nextId('riv-basin'),
          priority,
          'rivers',
          `${prefixBn}${r.bnName} নদী কোন প্রধান নদী অববাহিকার অন্তর্গত?`,
          `${prefixEn}Which river basin does the ${r.name} River belong to?`,
          { bn: rd.basinBn, en: rd.basinEn },
          otherRivers.map((or) => ({
            bn: RIVER_DETAILS[or.id].basinBn,
            en: RIVER_DETAILS[or.id].basinEn,
          })),
          `${r.bnName} নদী ${rd.basinBn}-এর অন্তর্গত।`,
          `The ${r.name} River is part of the ${rd.basinEn}.`
        )
      );

      if (thorough) {
        pushQ(
          buildQuestion(
            nextId('riv-trib'),
            priority,
            'rivers',
            `${prefixBn}${r.bnName} নদীর উল্লেখযোগ্য উপনদী বা শাখানদী নিচের কোনগুলো?`,
            `${prefixEn}Which tributaries or distributaries belong to the ${r.name} River?`,
            { bn: rd.tributariesBn, en: rd.tributariesEn },
            otherRivers.map((or) => ({
              bn: RIVER_DETAILS[or.id].tributariesBn,
              en: RIVER_DETAILS[or.id].tributariesEn,
            })),
            `${r.bnName} নদীর উপনদী/শাখানদী: ${rd.tributariesBn}।`,
            `${r.name} River tributaries/distributaries: ${rd.tributariesEn}.`
          )
        );

        pushQ(
          buildQuestion(
            nextId('riv-sig'),
            priority,
            'rivers',
            `নিচের কোন ভৌগোলিক বা অর্থনৈতিক গুরুত্বের বিবরণটি ${r.bnName} নদীর সাথে মিলে যায়?`,
            `Which geographic or economic significance describes the ${r.name} River?`,
            { bn: rd.significanceBn, en: rd.significanceEn },
            otherRivers.map((or) => ({
              bn: RIVER_DETAILS[or.id].significanceBn,
              en: RIVER_DETAILS[or.id].significanceEn,
            })),
            `${r.bnName} নদী: ${rd.significanceBn}।`,
            `${r.name} River: ${rd.significanceEn}.`
          )
        );
      }
    }

    const distinctLengthRivers = rivers.filter(
      (or) => or.id !== r.id && Math.abs(or.lengthKm - r.lengthKm) >= 25
    );
    pushQ(
      buildQuestion(
        nextId('riv-len'),
        priority,
        'rivers',
        `${prefixBn}বাংলাদেশে ${r.bnName} নদীর আনুমানিক দৈর্ঘ্য কত কিলোমিটার?`,
        `${prefixEn}What is the approximate length of the ${r.name} River in Bangladesh?`,
        {
          bn: `প্রায় ${formatNum(r.lengthKm, 'bn')} কিমি`,
          en: `~${r.lengthKm} km`,
        },
        distinctLengthRivers.map((or) => ({
          bn: `প্রায় ${formatNum(or.lengthKm, 'bn')} কিমি`,
          en: `~${or.lengthKm} km`,
        })),
        `বাংলাদেশে ${r.bnName} নদীর দৈর্ঘ্য প্রায় ${formatNum(r.lengthKm, 'bn')} কিমি।`,
        `The ${r.name} River stretches ~${r.lengthKm} km within Bangladesh.`
      )
    );

    if (thorough) {
      const flowSet = new Set(r.districts);
      const flowDists = r.districts
        .map((did) => distMap.get(did))
        .filter((d): d is GeoDistrict => Boolean(d));
      const nonFlowDists = districts.filter((d) => !flowSet.has(d.id));
      const pickedFlow = shuffleArray(flowDists)[0];
      if (pickedFlow && nonFlowDists.length >= 3) {
        pushQ(
          buildQuestion(
            nextId('riv-flow-d'),
            priority,
            'rivers',
            `${prefixBn}নিচের কোন জেলার ওপর দিয়ে ${r.bnName} নদী প্রবাহিত হয়েছে?`,
            `${prefixEn}Through which of these districts does the ${r.name} River flow?`,
            { bn: `${pickedFlow.bnName} জেলা`, en: `${pickedFlow.name} District` },
            nonFlowDists.map((d) => ({ bn: `${d.bnName} জেলা`, en: `${d.name} District` })),
            `${r.bnName} নদী ${pickedFlow.bnName} জেলার মধ্য দিয়ে প্রবাহিত হয়েছে।`,
            `The ${r.name} River passes through ${pickedFlow.name} District.`
          )
        );
      }

      if (flowDists.length >= 3 && nonFlowDists.length >= 1) {
        const pickedNonFlow = shuffleArray(nonFlowDists)[0];
        pushQ(
          buildQuestion(
            nextId('riv-nonflow-d'),
            priority,
            'rivers',
            `${prefixBn}নিচের কোন জেলার ওপর দিয়ে ${r.bnName} নদী সরাসরি প্রবাহিত হয়নি?`,
            `${prefixEn}Which of these districts does the ${r.name} River NOT pass through directly?`,
            { bn: `${pickedNonFlow.bnName} জেলা`, en: `${pickedNonFlow.name} District` },
            flowDists.map((d) => ({ bn: `${d.bnName} জেলা`, en: `${d.name} District` })),
            `${r.bnName} নদী ${pickedNonFlow.bnName} জেলার মধ্য দিয়ে সরাসরি প্রবাহিত হয়নি।`,
            `The ${r.name} River does not flow directly through ${pickedNonFlow.name} District.`
          )
        );
      }
    }
  };

  const addDistrictFacts = (
    dist: GeoDistrict,
    priority: 1 | 2,
    thorough: boolean,
    contextPrefixBn?: string,
    contextPrefixEn?: string,
    includeRiverTrivia = true
  ) => {
    const detail = DISTRICT_DETAILS[dist.id];
    const divMeta = DIVISION_META[dist.divisionId];
    const distUpazilas = upazilasByDist.get(dist.id) || [];
    const distRivers = rivers.filter((r) => r.districts.includes(dist.id));
    if (!detail || !divMeta) return;

    const pBn = contextPrefixBn ? `${contextPrefixBn} ` : '';
    const pEn = contextPrefixEn ? `${contextPrefixEn} ` : '';

    // 1. Division membership
    pushQ(
      buildQuestion(
        nextId('dist-div'),
        priority,
        'geography_borders',
        `${pBn}${dist.bnName} জেলা বাংলাদেশের কোন বিভাগের অন্তর্গত?`,
        `${pEn}Which division does ${dist.name} District belong to?`,
        { bn: `${divMeta.bnName} বিভাগ`, en: `${divMeta.name} Division` },
        divisions
          .filter((dv) => dv.id !== dist.divisionId)
          .map((dv) => ({ bn: `${dv.bnName} বিভাগ`, en: `${dv.name} Division` })),
        `${dist.bnName} জেলা ${divMeta.bnName} বিভাগের অন্তর্ভুক্ত।`,
        `${dist.name} District is located in ${divMeta.name} Division.`
      )
    );

    // 2. Geographical direction
    pushQ(
      buildQuestion(
        nextId('dist-dir'),
        priority,
        'geography_borders',
        `${pBn}ভৌগোলিক অবস্থানে ${dist.bnName} জেলা বাংলাদেশের কোন অঞ্চলে অবস্থিত?`,
        `${pEn}In which geographical region of Bangladesh is ${dist.name} District located?`,
        { bn: detail.directionLabelBn, en: detail.directionLabelEn },
        Object.values(DIRECTION_INFO)
          .filter(
            (z) =>
              z.key !== 'all' &&
              !detail.directions.includes(z.key) &&
              z.labelBn !== detail.directionLabelBn
          )
          .map((z) => ({ bn: z.labelBn, en: z.labelEn })),
        `${dist.bnName} জেলা ${detail.directionLabelBn} অবস্থিত।`,
        `${dist.name} District lies in the ${detail.directionLabelEn}.`
      )
    );

    // 3. Neighboring districts
    const neighborSet = new Set(dist.neighbors);
    const neighbors = dist.neighbors
      .map((nid) => distMap.get(nid))
      .filter((d): d is GeoDistrict => Boolean(d));
    const nonNeighbors = districts.filter((d) => d.id !== dist.id && !neighborSet.has(d.id));

    const neighborSample = thorough ? shuffleArray(neighbors).slice(0, 6) : neighbors.slice(0, 1);
    neighborSample.forEach((nbr, idx) => {
      const qPromptsBn = [
        `${pBn}নিচের কোন জেলাটি ${dist.bnName} জেলার সরাসরি সীমান্তবর্তী?`,
        `${pBn}মানচিত্রে ${dist.bnName} জেলার সীমান্ত স্পর্শ করেছে কোন জেলাটি?`,
        `${pBn}${dist.bnName} জেলার পার্শ্ববর্তী সীমান্ত জেলা নিচের কোনটি?`,
      ];
      const qPromptsEn = [
        `${pEn}Which of the following districts directly borders ${dist.name} District?`,
        `${pEn}On the map, which district shares a boundary with ${dist.name} District?`,
        `${pEn}Which neighboring district lies adjacent to ${dist.name} District?`,
      ];
      pushQ(
        buildQuestion(
          nextId('dist-nbr'),
          priority,
          'geography_borders',
          qPromptsBn[idx % qPromptsBn.length],
          qPromptsEn[idx % qPromptsEn.length],
          { bn: nbr.bnName, en: nbr.name },
          nonNeighbors.map((d) => ({ bn: d.bnName, en: d.name })),
          `${nbr.bnName} জেলা ${dist.bnName} জেলার পার্শ্ববর্তী সীমান্ত জেলা।`,
          `${nbr.name} shares a direct border with ${dist.name} District.`
        )
      );
    });

    if (thorough && neighbors.length >= 2) {
      const northNbr = neighbors.filter((x) => x.cy < dist.cy - 6).sort((a, b) => a.cy - b.cy)[0];
      if (northNbr) {
        pushQ(
          buildQuestion(
            nextId('dist-dir-nbr-n'),
            priority,
            'geography_borders',
            `${pBn}${dist.bnName} জেলার উত্তর দিকে সীমান্তবর্তী জেলা কোনটি?`,
            `${pEn}Which district borders ${dist.name} District to its north?`,
            { bn: `${northNbr.bnName} জেলা`, en: `${northNbr.name} District` },
            nonNeighbors.map((d) => ({ bn: `${d.bnName} জেলা`, en: `${d.name} District` })),
            `${northNbr.bnName} জেলা ${dist.bnName} জেলার উত্তর সীমান্তে অবস্থিত।`,
            `${northNbr.name} District borders ${dist.name} District to the north.`
          )
        );
      }
      const southNbr = neighbors.filter((x) => x.cy > dist.cy + 6).sort((a, b) => b.cy - a.cy)[0];
      if (southNbr) {
        pushQ(
          buildQuestion(
            nextId('dist-dir-nbr-s'),
            priority,
            'geography_borders',
            `${pBn}${dist.bnName} জেলার দক্ষিণ দিকে সীমান্তবর্তী জেলা কোনটি?`,
            `${pEn}Which district borders ${dist.name} District to its south?`,
            { bn: `${southNbr.bnName} জেলা`, en: `${southNbr.name} District` },
            nonNeighbors.map((d) => ({ bn: `${d.bnName} জেলা`, en: `${d.name} District` })),
            `${southNbr.bnName} জেলা ${dist.bnName} জেলার দক্ষিণ সীমান্তে অবস্থিত।`,
            `${southNbr.name} District borders ${dist.name} District to the south.`
          )
        );
      }
    }

    if (neighbors.length >= 3) {
      const nonNbrLimit = thorough ? 3 : 1;
      shuffleArray(nonNeighbors)
        .slice(0, nonNbrLimit)
        .forEach((pickedNonNbr, idx) => {
          pushQ(
            buildQuestion(
              nextId('dist-non-nbr'),
              priority,
              'geography_borders',
              idx === 0
                ? `${pBn}নিচের কোন জেলাটির সাথে ${dist.bnName} জেলার সরাসরি স্থলসীমান্ত নেই?`
                : idx === 1
                ? `${pBn}সীমান্ত বিচারে নিচের কোন জেলাটি ${dist.bnName} জেলার পার্শ্ববর্তী নয়?`
                : `${pBn}${dist.bnName} জেলার সীমানা স্পর্শ করেনি নিচের কোন জেলাটি?`,
              idx === 0
                ? `${pEn}Which of the following districts does NOT share a border with ${dist.name} District?`
                : idx === 1
                ? `${pEn}Which district is NOT directly adjacent to ${dist.name} District?`
                : `${pEn}Which of these districts does not touch the boundary of ${dist.name} District?`,
              { bn: pickedNonNbr.bnName, en: pickedNonNbr.name },
              neighbors.map((d) => ({ bn: d.bnName, en: d.name })),
              `${pickedNonNbr.bnName} জেলার সাথে ${dist.bnName} জেলার সরাসরি সীমান্ত নেই।`,
              `${pickedNonNbr.name} does not border ${dist.name} District directly.`
            )
          );
        });
    }

    // 4. Established year, Area, Upazila count, Neighbor count, External Border
    if (thorough) {
      const yearCandidates = ['1772', '1782', '1787', '1793', '1821', '1845', '1860', '1969', '1976', '1984']
        .filter((y) => y !== detail.established)
        .map((y) => ({ bn: `${toBnDigits(y)} সাল`, en: y }));
      pushQ(
        buildQuestion(
          nextId('dist-est'),
          priority,
          'heritage_facts',
          `${pBn}${dist.bnName} জেলা কোন সালে প্রতিষ্ঠিত হয়?`,
          `${pEn}In which year was ${dist.name} District established?`,
          { bn: `${toBnDigits(detail.established)} সাল`, en: detail.established },
          yearCandidates,
          `${dist.bnName} জেলা ${toBnDigits(detail.established)} সালে প্রতিষ্ঠিত হয়।`,
          `${dist.name} District was established in ${detail.established}.`
        )
      );

      const otherAreas = districts
        .filter(
          (d) =>
            d.id !== dist.id &&
            DISTRICT_DETAILS[d.id] &&
            Math.abs(DISTRICT_DETAILS[d.id].areaKm2 - detail.areaKm2) >= 250
        )
        .map((d) => ({
          bn: `${formatNum(DISTRICT_DETAILS[d.id].areaKm2, 'bn')} বর্গ কিমি`,
          en: `${DISTRICT_DETAILS[d.id].areaKm2.toLocaleString()} km²`,
        }));
      pushQ(
        buildQuestion(
          nextId('dist-area'),
          priority,
          'geography_borders',
          `${pBn}${dist.bnName} জেলার মোট আয়তন প্রায় কত?`,
          `${pEn}What is the approximate total area of ${dist.name} District?`,
          {
            bn: `${formatNum(detail.areaKm2, 'bn')} বর্গ কিমি`,
            en: `${detail.areaKm2.toLocaleString()} km²`,
          },
          otherAreas,
          `${dist.bnName} জেলার আয়তন প্রায় ${formatNum(detail.areaKm2, 'bn')} বর্গকিলোমিটার।`,
          `${dist.name} District covers approximately ${detail.areaKm2.toLocaleString()} km².`
        )
      );
    }

    if (thorough && detail) {
      if (detail.population > 0) {
        const otherPops = districts
          .filter(
            (d) =>
              d.id !== dist.id &&
              DISTRICT_DETAILS[d.id]?.population > 0 &&
              Math.abs(DISTRICT_DETAILS[d.id].population - detail.population) >= 350000
          )
          .map((d) => ({
            bn: `প্রায় ${formatNum(DISTRICT_DETAILS[d.id].population, 'bn')} জন`,
            en: `~${DISTRICT_DETAILS[d.id].population.toLocaleString()}`,
          }));
        pushQ(
          buildQuestion(
            nextId('dist-pop'),
            priority,
            'heritage_facts',
            `${pBn}২০২২ সালের জনশুমারি অনুযায়ী ${dist.bnName} জেলার মোট জনসংখ্যা প্রায় কত?`,
            `${pEn}According to the 2022 census, what is the approximate population of ${dist.name} District?`,
            {
              bn: `প্রায় ${formatNum(detail.population, 'bn')} জন`,
              en: `~${detail.population.toLocaleString()}`,
            },
            otherPops,
            `২০২২ সালের জনশুমারি অনুযায়ী ${dist.bnName} জেলার জনসংখ্যা প্রায় ${formatNum(detail.population, 'bn')} জন।`,
            `As of the 2022 census, ${dist.name} District has a population of ~${detail.population.toLocaleString()}.`
          )
        );

        const distDensity = Math.round(detail.population / Math.max(1, detail.areaKm2));
        const otherDensities = districts
          .filter((d) => d.id !== dist.id && DISTRICT_DETAILS[d.id]?.population > 0)
          .map((d) => Math.round(DISTRICT_DETAILS[d.id].population / Math.max(1, DISTRICT_DETAILS[d.id].areaKm2)))
          .filter((den) => Math.abs(den - distDensity) >= 220)
          .map((den) => ({
            bn: `প্রায় ${formatNum(den, 'bn')} জন/কিমি²`,
            en: `~${den.toLocaleString()} /km²`,
          }));
        pushQ(
          buildQuestion(
            nextId('dist-density'),
            priority,
            'heritage_facts',
            `${pBn}${dist.bnName} জেলায় প্রতি বর্গকিলোমিটারে আনুমানিক জনঘনত্ব কত?`,
            `${pEn}What is the approximate population density per km² in ${dist.name} District?`,
            {
              bn: `প্রায় ${formatNum(distDensity, 'bn')} জন/কিমি²`,
              en: `~${distDensity.toLocaleString()} /km²`,
            },
            otherDensities,
            `${dist.bnName} জেলায় জনঘনত্ব প্রতি বর্গকিলোমিটারে প্রায় ${formatNum(distDensity, 'bn')} জন।`,
            `${dist.name} District has ~${distDensity.toLocaleString()} people per km².`
          )
        );
      }

      const distinctCounts = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
        .filter((c) => c !== distUpazilas.length)
        .map((c) => ({ bn: `${formatNum(c, 'bn')}টি`, en: `${c}` }));
      pushQ(
        buildQuestion(
          nextId('dist-ucount'),
          priority,
          'geography_borders',
          `${pBn}${dist.bnName} জেলায় মোট কয়টি উপজেলা বা থানা রয়েছে?`,
          `${pEn}How many upazilas or thanas are in ${dist.name} District?`,
          {
            bn: `${formatNum(distUpazilas.length, 'bn')}টি`,
            en: `${distUpazilas.length}`,
          },
          distinctCounts,
          `${dist.bnName} জেলায় মোট ${formatNum(distUpazilas.length, 'bn')}টি উপজেলা/থানা রয়েছে।`,
          `${dist.name} District consists of ${distUpazilas.length} upazilas/thanas.`
        )
      );

      const distinctNbrCounts = [1, 2, 3, 4, 5, 6, 7, 8]
        .filter((c) => c !== neighbors.length)
        .map((c) => ({ bn: `${formatNum(c, 'bn')}টি`, en: `${c}` }));
      pushQ(
        buildQuestion(
          nextId('dist-nbrcount'),
          priority,
          'geography_borders',
          `${pBn}${dist.bnName} জেলার সীমান্তে মোট কয়টি পার্শ্ববর্তী জেলা রয়েছে?`,
          `${pEn}How many neighboring districts border ${dist.name} District?`,
          {
            bn: `${formatNum(neighbors.length, 'bn')}টি`,
            en: `${neighbors.length}`,
          },
          distinctNbrCounts,
          `${dist.bnName} জেলার সাথে ${formatNum(neighbors.length, 'bn')}টি জেলার সীমান্ত রয়েছে।`,
          `${dist.name} borders ${neighbors.length} other districts.`
        )
      );

      // External border / coastline fact
      const extBn = detail.externalBordersBn;
      const extEn = detail.externalBordersEn;
      const hasIndia = extEn.some((s) => s.includes('India'));
      const hasMyanmar = extEn.some((s) => s.includes('Myanmar'));
      const hasBay = extEn.some((s) => s.includes('Bay of Bengal'));
      let extAnswer: OptionPair;
      if (hasIndia && hasMyanmar) {
        extAnswer = { bn: 'ভারত ও মায়ানমার উভয় দেশ', en: 'Both India and Myanmar' };
      } else if (hasMyanmar && hasBay) {
        extAnswer = { bn: 'মায়ানমার ও বঙ্গোপসাগর', en: 'Myanmar & Bay of Bengal' };
      } else if (hasIndia && hasBay) {
        extAnswer = { bn: 'ভারত ও বঙ্গোপসাগর', en: 'India & Bay of Bengal' };
      } else if (hasIndia) {
        extAnswer = { bn: `ভারত (${extBn.join(', ')})`, en: `India (${extEn.join(', ')})` };
      } else if (hasMyanmar) {
        extAnswer = { bn: 'মায়ানমার', en: 'Myanmar' };
      } else if (hasBay) {
        extAnswer = { bn: 'বঙ্গোপসাগর (উপকূলীয়)', en: 'Bay of Bengal (Coastal)' };
      } else {
        extAnswer = {
          bn: 'কোনোটিই নয় (অভ্যন্তরীণ জেলা)',
          en: 'None (Landlocked interior district)',
        };
      }
      const extDistractors: OptionPair[] = [
        { bn: 'ভারত ও মায়ানমার উভয় দেশ', en: 'Both India and Myanmar' },
        { bn: 'মায়ানমার', en: 'Myanmar' },
        { bn: 'বঙ্গোপসাগর (উপকূলীয়)', en: 'Bay of Bengal (Coastal)' },
        { bn: 'ভারত (আন্তর্জাতিক সীমান্ত)', en: 'India (International border)' },
        {
          bn: 'কোনোটিই নয় (অভ্যন্তরীণ জেলা)',
          en: 'None (Landlocked interior district)',
        },
      ].filter((opt) => !opt.en.startsWith(extAnswer.en.split(' ')[0]));
      pushQ(
        buildQuestion(
          nextId('dist-ext'),
          priority,
          'geography_borders',
          `${pBn}${dist.bnName} জেলার আন্তর্জাতিক সীমান্ত বা সমুদ্র উপকূল নিচের কোনটির সাথে যুক্ত?`,
          `${pEn}Which international border or coast does ${dist.name} District touch?`,
          extAnswer,
          extDistractors,
          `${dist.bnName} জেলার সীমান্ত: ${extBn.length > 0 ? extBn.join(', ') : 'কোনো আন্তর্জাতিক সীমান্ত বা সমুদ্র উপকূল নেই (অভ্যন্তরীণ জেলা)'}।`,
          `${dist.name} District boundary: ${extEn.length > 0 ? extEn.join(', ') : 'Landlocked interior district'}.`
        )
      );

      // Specialties & Connectivity
      pushQ(
        buildQuestion(
          nextId('dist-spec'),
          priority,
          'heritage_facts',
          `${pBn}${dist.bnName} জেলার বিখ্যাত পণ্য, খাবার বা প্রধান উৎপাদন নিচের কোনটি?`,
          `${pEn}Which specialty produce, cuisine, or craft is ${dist.name} District known for?`,
          { bn: detail.specialtiesBn, en: detail.specialtiesEn },
          districts
            .filter((d) => d.id !== dist.id && DISTRICT_DETAILS[d.id])
            .map((d) => ({
              bn: DISTRICT_DETAILS[d.id].specialtiesBn,
              en: DISTRICT_DETAILS[d.id].specialtiesEn,
            })),
          `${dist.bnName} জেলার বিশেষ পণ্য ও কৃষি: ${detail.specialtiesBn}।`,
          `${dist.name} District specialties: ${detail.specialtiesEn}.`
        )
      );

      pushQ(
        buildQuestion(
          nextId('dist-conn'),
          priority,
          'geography_borders',
          `${pBn}${dist.bnName} জেলার প্রধান সড়ক, রেল বা নৌ-যোগাযোগ পথ নিচের কোনটি?`,
          `${pEn}Which major highway, rail, or waterway corridor connects ${dist.name} District?`,
          { bn: detail.connectivityBn, en: detail.connectivityEn },
          districts
            .filter((d) => d.id !== dist.id && DISTRICT_DETAILS[d.id])
            .map((d) => ({
              bn: DISTRICT_DETAILS[d.id].connectivityBn,
              en: DISTRICT_DETAILS[d.id].connectivityEn,
            })),
          `${dist.bnName} জেলার প্রধান যোগাযোগ: ${detail.connectivityBn}।`,
          `Main connectivity of ${dist.name}: ${detail.connectivityEn}.`
        )
      );
    }

    // 5. Famous-for & Landmarks
    pushQ(
      buildQuestion(
        nextId('dist-fam'),
        priority,
        'heritage_facts',
        `${pBn}${dist.bnName} জেলা নিচের কোনটির জন্য বিশেষভাবে পরিচিত?`,
        `${pEn}What is ${dist.name} District especially famous for?`,
        { bn: detail.famousForBn, en: detail.famousForEn },
        districts
          .filter((d) => d.id !== dist.id && DISTRICT_DETAILS[d.id])
          .map((d) => ({
            bn: DISTRICT_DETAILS[d.id].famousForBn,
            en: DISTRICT_DETAILS[d.id].famousForEn,
          })),
        `${dist.bnName} জেলা বিশেষভাবে পরিচিত: ${detail.famousForBn}।`,
        `${dist.name} District is well known for: ${detail.famousForEn}.`
      )
    );

    const lmLimit = thorough ? detail.landmarksBn.length : 1;
    const foreignLandmarks: OptionPair[] = [];
    for (const od of shuffleArray(districts.filter((d) => d.id !== dist.id))) {
      const odet = DISTRICT_DETAILS[od.id];
      if (!odet) continue;
      for (let idx = 0; idx < odet.landmarksBn.length; idx++) {
        foreignLandmarks.push({ bn: odet.landmarksBn[idx], en: odet.landmarksEn[idx] });
      }
      if (foreignLandmarks.length >= 25) break;
    }

    for (let i = 0; i < lmLimit; i++) {
      const lmBn = detail.landmarksBn[i];
      const lmEn = detail.landmarksEn[i];
      if (!lmBn || !lmEn) continue;
      pushQ(
        buildQuestion(
          nextId('dist-lm'),
          priority,
          'heritage_facts',
          `${pBn}নিচের কোন দর্শনীয় স্থান বা ঐতিহ্যটি ${dist.bnName} জেলায় অবস্থিত?`,
          `${pEn}Which of the following landmarks or heritage sites is located in ${dist.name} District?`,
          { bn: lmBn, en: lmEn },
          foreignLandmarks,
          `‘${lmBn}’ ${dist.bnName} জেলার অন্যতম উল্লেখযোগ্য দর্শনীয় স্থান।`,
          `${lmEn} is a notable landmark in ${dist.name} District.`
        )
      );

      // Reverse clue: landmark -> district (if landmark doesn't already contain district name)
      if (thorough && !lmBn.includes(dist.bnName) && !lmEn.includes(dist.name)) {
        pushQ(
          buildQuestion(
            nextId('dist-lm-rev'),
            priority,
            'heritage_facts',
            `${pBn}বিখ্যাত দর্শনীয় স্থান ‘${lmBn}’ বাংলাদেশের কোন জেলায় অবস্থিত?`,
            `${pEn}In which district of Bangladesh is ‘${lmEn}’ located?`,
            { bn: `${dist.bnName} জেলা`, en: `${dist.name} District` },
            districts
              .filter((d) => d.id !== dist.id)
              .map((d) => ({ bn: `${d.bnName} জেলা`, en: `${d.name} District` })),
            `‘${lmBn}’ ${dist.bnName} জেলায় অবস্থিত।`,
            `${lmEn} is located in ${dist.name} District.`
          )
        );
      }
    }

    // 6. Rivers flowing through district
    const foreignRivers = rivers.filter((r) => !r.districts.includes(dist.id));
    for (const r of thorough ? distRivers : distRivers.slice(0, 1)) {
      pushQ(
        buildQuestion(
          nextId('dist-riv'),
          priority,
          'rivers',
          `${pBn}প্রধান ৩০টি নদ-নদীর মধ্যে কোন নদীটি ${dist.bnName} জেলার ওপর দিয়ে প্রবাহিত হয়েছে?`,
          `${pEn}Which of the following major rivers flows through ${dist.name} District?`,
          { bn: `${r.bnName} নদী`, en: `${r.name} River` },
          foreignRivers.map((fr) => ({ bn: `${fr.bnName} নদী`, en: `${fr.name} River` })),
          `${r.bnName} নদী ${dist.bnName} জেলার মধ্য দিয়ে প্রবাহিত হয়েছে।`,
          `The ${r.name} River flows through ${dist.name} District.`
        )
      );
      if (thorough && includeRiverTrivia) {
        addRiverFacts(
          r,
          priority,
          false,
          `${dist.bnName} জেলার ওপর দিয়ে প্রবাহিত`,
          `Flowing through ${dist.name} District,`
        );
      }
    }

    if (thorough) {
      pushQ(
        buildQuestion(
          nextId('dist-riv-cnt'),
          priority,
          'rivers',
          `${pBn}তালিকাভুক্ত ৩০টি প্রধান নদ-নদীর কয়টি ${dist.bnName} জেলার মধ্য দিয়ে প্রবাহিত হয়েছে?`,
          `${pEn}How many of the 30 mapped major rivers flow through ${dist.name} District?`,
          { bn: `${formatNum(distRivers.length, 'bn')}টি`, en: `${distRivers.length}` },
          [0, 1, 2, 3, 4, 5, 6, 7]
            .filter((n) => n !== distRivers.length)
            .map((n) => ({ bn: `${formatNum(n, 'bn')}টি`, en: `${n}` })),
          `${dist.bnName} জেলার ওপর দিয়ে তালিকাভুক্ত ${formatNum(distRivers.length, 'bn')}টি প্রধান নদী প্রবাহিত হয়েছে।`,
          `${distRivers.length} mapped major river(s) flow through ${dist.name} District.`
        )
      );

      if (distRivers.length >= 3 && foreignRivers.length >= 1) {
        shuffleArray(foreignRivers)
          .slice(0, 2)
          .forEach((pickedForeignRiv) => {
            pushQ(
              buildQuestion(
                nextId('dist-riv-not'),
                priority,
                'rivers',
                `${pBn}নিচের কোন প্রধান নদীটি ${dist.bnName} জেলার মধ্য দিয়ে সরাসরি প্রবাহিত হয়নি?`,
                `${pEn}Which of these major rivers does NOT directly pass through ${dist.name} District?`,
                { bn: `${pickedForeignRiv.bnName} নদী`, en: `${pickedForeignRiv.name} River` },
                distRivers.map((dr) => ({ bn: `${dr.bnName} নদী`, en: `${dr.name} River` })),
                `${pickedForeignRiv.bnName} নদী ${dist.bnName} জেলার মধ্য দিয়ে প্রবাহিত হয়নি।`,
                `The ${pickedForeignRiv.name} River does not pass through ${dist.name} District.`
              )
            );
          });
      }
      if (distRivers.length >= 2) {
        const sortedDistRivs = [...distRivers].sort((a, b) => b.lengthKm - a.lengthKm);
        const longestDistR = sortedDistRivs[0];
        if (longestDistR.lengthKm > sortedDistRivs[1].lengthKm) {
          const rivPool =
            distRivers.length >= 4
              ? sortedDistRivs.slice(1)
              : [...sortedDistRivs.slice(1), ...foreignRivers];
          pushQ(
            buildQuestion(
              nextId('dist-riv-longest'),
              priority,
              'rivers',
              `${pBn}${dist.bnName} জেলার ওপর দিয়ে প্রবাহিত নিচের প্রধান নদীগুলোর মধ্যে বাংলাদেশে সামগ্রিকভাবে সবচেয়ে দীর্ঘ কোনটি?`,
              `${pEn}Among the major rivers flowing through ${dist.name} District, which has the longest course in Bangladesh?`,
              { bn: `${longestDistR.bnName} নদী`, en: `${longestDistR.name} River` },
              rivPool.map((r) => ({ bn: `${r.bnName} নদী`, en: `${r.name} River` })),
              `${longestDistR.bnName} নদী (${formatNum(longestDistR.lengthKm, 'bn')} কিমি) ${dist.bnName} জেলার প্রবাহিত নদীগুলোর মধ্যে দীর্ঘতম।`,
              `The ${longestDistR.name} River (~${longestDistR.lengthKm} km) is the longest river passing through ${dist.name} District.`
            )
          );
        }
      }

      const extNbrDivIds = Array.from(
        new Set(neighbors.filter((nd) => nd.divisionId !== dist.divisionId).map((nd) => nd.divisionId))
      );
      pushQ(
        buildQuestion(
          nextId('dist-xdiv-cnt'),
          priority,
          'geography_borders',
          `${pBn}নিজ বিভাগ (${divMeta.bnName}) ছাড়া ${dist.bnName} জেলার সীমান্ত ভিন্ন কয়টি বিভাগের জেলাকে স্পর্শ করেছে?`,
          `${pEn}Excluding ${divMeta.name} Division, how many other divisions border ${dist.name} District?`,
          extNbrDivIds.length === 0
            ? { bn: '০টি (সম্পূর্ণ নিজ বিভাগের ভেতরে)', en: '0 (surrounded only by own division)' }
            : { bn: `${formatNum(extNbrDivIds.length, 'bn')}টি ভিন্ন বিভাগ`, en: `${extNbrDivIds.length} external division(s)` },
          [
            ...(extNbrDivIds.length > 0
              ? [{ bn: '০টি (সম্পূর্ণ নিজ বিভাগের ভেতরে)', en: '0 (surrounded only by own division)' }]
              : []),
            ...[1, 2, 3, 4]
              .filter((n) => n !== extNbrDivIds.length)
              .map((n) => ({ bn: `${formatNum(n, 'bn')}টি ভিন্ন বিভাগ`, en: `${n} external division(s)` })),
          ],
          extNbrDivIds.length === 0
            ? `${dist.bnName} জেলার সব সীমান্তবর্তী জেলাই ${divMeta.bnName} বিভাগের অন্তর্ভুক্ত।`
            : `${dist.bnName} জেলা নিজ বিভাগ ছাড়াও ${formatNum(extNbrDivIds.length, 'bn')}টি ভিন্ন বিভাগের জেলার সাথে সীমান্ত ভাগ করেছে।`,
          extNbrDivIds.length === 0
            ? `All districts bordering ${dist.name} belong to ${divMeta.name} Division.`
            : `${dist.name} District borders ${extNbrDivIds.length} external division(s).`
        )
      );

      if (detail) {
        const dAreaBr = [
          { match: detail.areaKm2 < 1200, bn: '১,২০০ বর্গ কিমি-র কম', en: 'Under 1,200 km²' },
          { match: detail.areaKm2 >= 1200 && detail.areaKm2 < 2200, bn: '১,২০০ থেকে ২,১৯৯ বর্গ কিমি', en: '1,200 to 2,199 km²' },
          { match: detail.areaKm2 >= 2200 && detail.areaKm2 < 3500, bn: '২,২০০ থেকে ৩,৪৯৯ বর্গ কিমি', en: '2,200 to 3,499 km²' },
          { match: detail.areaKm2 >= 3500, bn: '৩,৫০০ বর্গ কিমি বা তার বেশি', en: '3,500 km² or more' },
        ];
        const mAreaBr = dAreaBr.find((b) => b.match) || dAreaBr[1];
        pushQ(
          buildQuestion(
            nextId('dist-area-br'),
            priority,
            'geography_borders',
            `${pBn}আয়তনের পরিমাপ অনুযায়ী ${dist.bnName} জেলা কোন শ্রেণির অন্তর্ভুক্ত?`,
            `${pEn}Which area category describes ${dist.name} District?`,
            { bn: mAreaBr.bn, en: mAreaBr.en },
            dAreaBr.filter((b) => b.en !== mAreaBr.en).map((b) => ({ bn: b.bn, en: b.en })),
            `${dist.bnName} জেলার আয়তন প্রায় ${formatNum(detail.areaKm2, 'bn')} কিমি² (${mAreaBr.bn})।`,
            `${dist.name} District covers ~${detail.areaKm2} km² (${mAreaBr.en}).`
          )
        );

        const dPopBr = [
          { match: detail.population < 1200000, bn: '১২ লাখের কম', en: 'Under 1.2 million' },
          { match: detail.population >= 1200000 && detail.population < 2200000, bn: '১২ লাখ থেকে ২২ লাখের কম', en: '1.2M to 2.19M' },
          { match: detail.population >= 2200000 && detail.population < 3500000, bn: '২২ লাখ থেকে ৩৫ লাখের কম', en: '2.2M to 3.49M' },
          { match: detail.population >= 3500000, bn: '৩৫ লাখ বা তার বেশি', en: '3.5 million or more' },
        ];
        const mPopBr = dPopBr.find((b) => b.match) || dPopBr[1];
        pushQ(
          buildQuestion(
            nextId('dist-pop-br'),
            priority,
            'heritage_facts',
            `${pBn}২০২২ সালের জনশুমারি অনুযায়ী ${dist.bnName} জেলার জনসংখ্যা কোন সীমার মধ্যে?`,
            `${pEn}Which 2022 census population range fits ${dist.name} District?`,
            { bn: mPopBr.bn, en: mPopBr.en },
            dPopBr.filter((b) => b.en !== mPopBr.en).map((b) => ({ bn: b.bn, en: b.en })),
            `${dist.bnName} জেলার জনসংখ্যা প্রায় ${formatNum(detail.population, 'bn')} জন (${mPopBr.bn})।`,
            `${dist.name} District population is ~${detail.population.toLocaleString()} (${mPopBr.en}).`
          )
        );
      }
    }

    // 7. Upazilas inside district
    const outsideUpazilas = upazilas.filter((u) => u.districtId !== dist.id);
    const upazilaSample = thorough
      ? shuffleArray(distUpazilas).slice(0, 8)
      : shuffleArray(distUpazilas).slice(0, 2);
    const uInPromptsBn = [
      `${pBn}নিচের কোন উপজেলা/থানাটি ${dist.bnName} জেলার অন্তর্ভুক্ত?`,
      `${pBn}প্রশাসনিকভাবে ${dist.bnName} জেলার একটি ইউনিট নিচের কোনটি?`,
      `${pBn}${dist.bnName} জেলার ভৌগোলিক সীমানার ভেতরে অবস্থিত উপজেলা/থানা কোনটি?`,
      `${pBn}নিচের কোন প্রশাসনিক এলাকাটি ${dist.bnName} জেলা প্রশাসনের অধীন?`,
    ];
    const uInPromptsEn = [
      `${pEn}Which of the following upazilas or thanas belongs to ${dist.name} District?`,
      `${pEn}Which unit is administratively part of ${dist.name} District?`,
      `${pEn}Which upazila or thana lies within ${dist.name} District?`,
      `${pEn}Which local administrative area falls under ${dist.name} District?`,
    ];
    upazilaSample.forEach((u, idx) => {
      pushQ(
        buildQuestion(
          nextId('dist-u-in'),
          priority,
          'geography_borders',
          uInPromptsBn[idx % uInPromptsBn.length],
          uInPromptsEn[idx % uInPromptsEn.length],
          { bn: u.bnName, en: u.name },
          outsideUpazilas.map((ou) => ({ bn: ou.bnName, en: ou.name })),
          `${u.bnName} হলো ${dist.bnName} জেলার একটি উপজেলা/থানা।`,
          `${u.name} is an upazila/thana in ${dist.name} District.`
        )
      );
    });

    if (thorough && distUpazilas.length >= 3) {
      const sortedByArea = [...distUpazilas].sort((a, b) => b.areaKm2 - a.areaKm2);
      const largest = sortedByArea[0];
      const smallest = sortedByArea[sortedByArea.length - 1];
      if (largest.areaKm2 > sortedByArea[1].areaKm2) {
        pushQ(
          buildQuestion(
            nextId('dist-u-max'),
            priority,
            'geography_borders',
            `${pBn}${dist.bnName} জেলার নিচের উপজেলাগুলোর মধ্যে কোনটির আয়তন সবচেয়ে বড়?`,
            `${pEn}Which of these upazilas in ${dist.name} District has the largest area?`,
            { bn: largest.bnName, en: largest.name },
            sortedByArea.slice(1).map((u) => ({ bn: u.bnName, en: u.name })),
            `${largest.bnName}-এর আয়তন প্রায় ${formatNum(largest.areaKm2, 'bn')} বর্গ কিমি, যা ${dist.bnName} জেলায় সর্বাধিক।`,
            `${largest.name} covers ~${largest.areaKm2} km², the largest in ${dist.name} District.`
          )
        );
      }
      if (smallest.areaKm2 < sortedByArea[sortedByArea.length - 2].areaKm2) {
        pushQ(
          buildQuestion(
            nextId('dist-u-min'),
            priority,
            'geography_borders',
            `${pBn}${dist.bnName} জেলার নিচের উপজেলা/থানাগুলোর মধ্যে কোনটির আয়তন সবচেয়ে ছোট?`,
            `${pEn}Which of these upazilas/thanas in ${dist.name} District is the smallest in area?`,
            { bn: smallest.bnName, en: smallest.name },
            sortedByArea.slice(0, -1).map((u) => ({ bn: u.bnName, en: u.name })),
            `${smallest.bnName}-এর আয়তন প্রায় ${formatNum(smallest.areaKm2, 'bn')} বর্গ কিমি, যা ${dist.bnName} জেলায় সর্বনিম্ন।`,
            `${smallest.name} covers ~${smallest.areaKm2} km², the smallest in ${dist.name} District.`
          )
        );
      }

      const sortedByPop = [...distUpazilas].sort((a, b) => (b.population || 0) - (a.population || 0));
      const mostPopU = sortedByPop[0];
      const leastPopU = sortedByPop[sortedByPop.length - 1];
      if ((mostPopU.population || 0) > (sortedByPop[1]?.population || 0)) {
        pushQ(
          buildQuestion(
            nextId('dist-u-pop-max'),
            priority,
            'heritage_facts',
            `${pBn}${dist.bnName} জেলার উপজেলা/থানাগুলোর মধ্যে জনসংখ্যার দিক থেকে সবচেয়ে বড় কোনটি?`,
            `${pEn}Which upazila/thana in ${dist.name} District has the highest population?`,
            { bn: mostPopU.bnName, en: mostPopU.name },
            sortedByPop.slice(1).map((u) => ({ bn: u.bnName, en: u.name })),
            `${mostPopU.bnName}-এর জনসংখ্যা প্রায় ${formatNum(mostPopU.population || 0, 'bn')} জন, যা ${dist.bnName} জেলায় সর্বাধিক।`,
            `${mostPopU.name} has ~${(mostPopU.population || 0).toLocaleString()} residents, the highest in ${dist.name} District.`
          )
        );
      }
      if ((leastPopU.population || 0) < (sortedByPop[sortedByPop.length - 2]?.population || 0)) {
        pushQ(
          buildQuestion(
            nextId('dist-u-pop-min'),
            priority,
            'heritage_facts',
            `${pBn}${dist.bnName} জেলার উপজেলা/থানাগুলোর মধ্যে জনসংখ্যা সবচেয়ে কম কোনটির?`,
            `${pEn}Which upazila/thana in ${dist.name} District has the lowest population?`,
            { bn: leastPopU.bnName, en: leastPopU.name },
            sortedByPop.slice(0, -1).map((u) => ({ bn: u.bnName, en: u.name })),
            `${leastPopU.bnName}-এর জনসংখ্যা প্রায় ${formatNum(leastPopU.population || 0, 'bn')} জন, যা ${dist.bnName} জেলায় সর্বনিম্ন।`,
            `${leastPopU.name} has ~${(leastPopU.population || 0).toLocaleString()} residents, the lowest in ${dist.name} District.`
          )
        );
      }

      const withDens = distUpazilas
        .filter((u) => (u.population || 0) > 0 && u.areaKm2 > 0)
        .map((u) => ({ u, dens: Math.round((u.population || 0) / u.areaKm2) }))
        .sort((a, b) => b.dens - a.dens);
      if (withDens.length >= 3) {
        const densest = withDens[0];
        const sparsest = withDens[withDens.length - 1];
        if (densest.dens > withDens[1].dens) {
          pushQ(
            buildQuestion(
              nextId('dist-u-dens-max'),
              priority,
              'heritage_facts',
              `${pBn}${dist.bnName} জেলার উপজেলা/থানাগুলোর মধ্যে প্রতি বর্গকিলোমিটারে জনঘনত্ব সবচেয়ে বেশি কোনটিতে?`,
              `${pEn}Which upazila or thana in ${dist.name} District has the highest population density?`,
              { bn: densest.u.bnName, en: densest.u.name },
              withDens.slice(1).map((x) => ({ bn: x.u.bnName, en: x.u.name })),
              `${densest.u.bnName}-এ প্রতি বর্গকিলোমিটারে জনঘনত্ব প্রায় ${formatNum(densest.dens, 'bn')} জন, যা ${dist.bnName} জেলায় সর্বাধিক।`,
              `${densest.u.name} has ~${densest.dens.toLocaleString()} people/km², the highest density in ${dist.name} District.`
            )
          );
        }
        if (sparsest.dens < withDens[withDens.length - 2].dens) {
          pushQ(
            buildQuestion(
              nextId('dist-u-dens-min'),
              priority,
              'heritage_facts',
              `${pBn}${dist.bnName} জেলার উপজেলা/থানাগুলোর মধ্যে জনঘনত্ব সবচেয়ে কম কোনটিতে?`,
              `${pEn}Which upazila or thana in ${dist.name} District has the lowest population density?`,
              { bn: sparsest.u.bnName, en: sparsest.u.name },
              withDens.slice(0, -1).map((x) => ({ bn: x.u.bnName, en: x.u.name })),
              `${sparsest.u.bnName}-এ প্রতি বর্গকিলোমিটারে জনঘনত্ব প্রায় ${formatNum(sparsest.dens, 'bn')} জন, যা ${dist.bnName} জেলায় সর্বনিম্ন।`,
              `${sparsest.u.name} has ~${sparsest.dens.toLocaleString()} people/km², the lowest density in ${dist.name} District.`
            )
          );
        }
      }

      if (distUpazilas.length >= 4) {
        const sortedNorth = [...distUpazilas].sort((a, b) => a.cy - b.cy);
        const northMost = sortedNorth[0];
        const southMost = sortedNorth[sortedNorth.length - 1];
        if (sortedNorth[1].cy - northMost.cy >= 2) {
          pushQ(
            buildQuestion(
              nextId('dist-u-north'),
              priority,
              'geography_borders',
              `${pBn}মানচিত্রে ${dist.bnName} জেলার সর্ব-উত্তরে অবস্থিত উপজেলা/থানা নিচের কোনটি?`,
              `${pEn}On the map, which is the northernmost upazila/thana in ${dist.name} District?`,
              { bn: northMost.bnName, en: northMost.name },
              sortedNorth.slice(1).map((u) => ({ bn: u.bnName, en: u.name })),
              `${northMost.bnName} ${dist.bnName} জেলার উত্তর প্রান্তে অবস্থিত।`,
              `${northMost.name} sits at the northern edge of ${dist.name} District.`
            )
          );
        }
        if (southMost.cy - sortedNorth[sortedNorth.length - 2].cy >= 2) {
          pushQ(
            buildQuestion(
              nextId('dist-u-south'),
              priority,
              'geography_borders',
              `${pBn}মানচিত্রে ${dist.bnName} জেলার সর্ব-দক্ষিণে অবস্থিত উপজেলা/থানা নিচের কোনটি?`,
              `${pEn}On the map, which is the southernmost upazila/thana in ${dist.name} District?`,
              { bn: southMost.bnName, en: southMost.name },
              sortedNorth.slice(0, -1).map((u) => ({ bn: u.bnName, en: u.name })),
              `${southMost.bnName} ${dist.bnName} জেলার দক্ষিণ প্রান্তে অবস্থিত।`,
              `${southMost.name} sits at the southern edge of ${dist.name} District.`
            )
          );
        }
      }

      shuffleArray(outsideUpazilas)
        .slice(0, 2)
        .forEach((outsiderU, idx) => {
          pushQ(
            buildQuestion(
              nextId('dist-u-not'),
              priority,
              'geography_borders',
              idx === 0
                ? `${pBn}নিচের কোন উপজেলাটি ${dist.bnName} জেলার অন্তর্ভুক্ত নয়?`
                : `${pBn}প্রশাসনিকভাবে নিচের কোনটি ${dist.bnName} জেলার বাইরে অবস্থিত?`,
              idx === 0
                ? `${pEn}Which of the following upazilas is NOT part of ${dist.name} District?`
                : `${pEn}Which of these units lies OUTSIDE ${dist.name} District?`,
              { bn: outsiderU.bnName, en: outsiderU.name },
              distUpazilas.map((u) => ({ bn: u.bnName, en: u.name })),
              `${outsiderU.bnName} ${distMap.get(outsiderU.districtId)?.bnName || ''} জেলার অন্তর্গত, ${dist.bnName} জেলার নয়।`,
              `${outsiderU.name} belongs to ${distMap.get(outsiderU.districtId)?.name || 'another'} District, not ${dist.name}.`
            )
          );
        });
    }

    if (thorough && detail) {
      const hasMetroInDist = distUpazilas.some((u) => u.name.toLowerCase().includes('thana'));
      pushQ(
        buildQuestion(
          nextId('dist-metro-check'),
          priority,
          'heritage_facts',
          `${pBn}প্রশাসনিক তথ্য অনুযায়ী ${dist.bnName} জেলার জন্ম বা বর্তমান জেলা হিসেবে পুনর্গঠন সাল কোন দশকে?`,
          `${pEn}In which historical era was ${dist.name} formally established as an administrative district?`,
          Number(detail.established) >= 1980
            ? { bn: '১৯৮০-এর দশক (১৯৮৪ প্রশাসনিক বিকেন্দ্রীকরণ)', en: '1980s (1984 decentralization)' }
            : Number(detail.established) >= 1947
            ? { bn: '১৯৪৭–১৯৭৯ (পাকিস্তান আমল ও মুক্তিযুদ্ধ-উত্তর সময়)', en: '1947–1979' }
            : Number(detail.established) >= 1850
            ? { bn: '১৮৫০–১৯৪৬ (ব্রিটিশ ঔপনিবেশিক মধ্য-পর্যায়)', en: '1850–1946' }
            : { bn: '১৮৫০-এর পূর্বে (আদি ব্রিটিশ আমলের জেলা)', en: 'Before 1850 (early colonial district)' },
          [
            { bn: '১৯৮০-এর দশক (১৯৮৪ প্রশাসনিক বিকেন্দ্রীকরণ)', en: '1980s (1984 decentralization)' },
            { bn: '১৯৪৭–১৯৭৯ (পাকিস্তান আমল ও মুক্তিযুদ্ধ-উত্তর সময়)', en: '1947–1979' },
            { bn: '১৮৫০–১৯৪৬ (ব্রিটিশ ঔপনিবেশিক মধ্য-পর্যায়)', en: '1850–1946' },
            { bn: '১৮৫০-এর পূর্বে (আদি ব্রিটিশ আমলের জেলা)', en: 'Before 1850 (early colonial district)' },
          ],
          `${dist.bnName} জেলা ${toBnDigits(detail.established)} সালে প্রতিষ্ঠিত হয়।`,
          `${dist.name} District was established in ${detail.established}.`
        )
      );
      if (hasMetroInDist || distUpazilas.length >= 6) {
        const nonLeakDistFacts = detail.interestingFactsBn
          .map((fb, idx) => ({ bn: fb, en: detail.interestingFactsEn[idx] }))
          .filter(
            (f) =>
              f.bn &&
              f.en &&
              !f.bn.includes(dist.bnName) &&
              !f.en.toLowerCase().includes(dist.name.toLowerCase())
          );
        const foreignDistFacts: OptionPair[] = [];
        for (const od of shuffleArray(districts.filter((d) => d.id !== dist.id)).slice(0, 12)) {
          const odet = DISTRICT_DETAILS[od.id];
          if (!odet) continue;
          odet.interestingFactsBn.forEach((fb, idx) => {
            const fe = odet.interestingFactsEn[idx];
            if (
              fb &&
              fe &&
              !fb.includes(od.bnName) &&
              !fe.toLowerCase().includes(od.name.toLowerCase())
            ) {
              foreignDistFacts.push({ bn: fb, en: fe });
            }
          });
        }
        nonLeakDistFacts.slice(0, 2).forEach((fact) => {
          pushQ(
            buildQuestion(
              nextId('dist-fact-match'),
              priority,
              'heritage_facts',
              `${pBn}${dist.bnName} জেলা সম্পর্কে নিচের কোন বিশেষ তথ্যটি সঠিক?`,
              `${pEn}Which of the following statements is true about ${dist.name} District?`,
              { bn: fact.bn, en: fact.en },
              foreignDistFacts,
              `${dist.bnName} জেলা: ${fact.bn}`,
              `${dist.name} District: ${fact.en}`
            )
          );
        });
      }
    }
  };

  const addDivisionFacts = (div: GeoDivision, priority: 1 | 2, thorough: boolean) => {
    const divMeta = DIVISION_META[div.id];
    const divDists = districtsByDiv.get(div.id) || [];
    const divUpazilas = upazilas.filter((u) => u.divisionId === div.id);
    if (!divMeta) return;

    pushQ(
      buildQuestion(
        nextId('div-est'),
        priority,
        'heritage_facts',
        `${divMeta.bnName} বিভাগ কোন সালে প্রতিষ্ঠিত হয়?`,
        `In which year was ${divMeta.name} Division established?`,
        { bn: `${toBnDigits(divMeta.established)} সাল`, en: divMeta.established },
        divisions
          .map((d) => DIVISION_META[d.id]?.established)
          .filter((y): y is string => Boolean(y) && y !== divMeta.established)
          .concat(['1971', '1984', '2001', '2010'])
          .map((y) => ({ bn: `${toBnDigits(y)} সাল`, en: y })),
        `${divMeta.bnName} বিভাগ ${toBnDigits(divMeta.established)} সালে প্রতিষ্ঠিত হয়।`,
        `${divMeta.name} Division was established in ${divMeta.established}.`
      )
    );

    pushQ(
      buildQuestion(
        nextId('div-dcount'),
        priority,
        'geography_borders',
        `${divMeta.bnName} বিভাগে মোট কয়টি জেলা রয়েছে?`,
        `How many districts are in ${divMeta.name} Division?`,
        { bn: `${formatNum(divDists.length, 'bn')}টি`, en: `${divDists.length}` },
        [4, 5, 6, 7, 8, 9, 10, 11, 13]
          .filter((n) => n !== divDists.length)
          .map((n) => ({ bn: `${formatNum(n, 'bn')}টি`, en: `${n}` })),
        `${divMeta.bnName} বিভাগে মোট ${formatNum(divDists.length, 'bn')}টি জেলা রয়েছে।`,
        `${divMeta.name} Division consists of ${divDists.length} districts.`
      )
    );

    if (thorough) {
      pushQ(
        buildQuestion(
          nextId('div-ucount'),
          priority,
          'geography_borders',
          `${divMeta.bnName} বিভাগে মোট কয়টি উপজেলা ও থানা রয়েছে?`,
          `How many upazilas & thanas are there in ${divMeta.name} Division?`,
          { bn: `${formatNum(divUpazilas.length, 'bn')}টি`, en: `${divUpazilas.length}` },
          divisions
            .filter((d) => d.id !== div.id)
            .map((d) => {
              const cnt = upazilas.filter((u) => u.divisionId === d.id).length;
              return { bn: `${formatNum(cnt, 'bn')}টি`, en: `${cnt}` };
            })
            .filter((o) => o.en !== `${divUpazilas.length}`),
          `${divMeta.bnName} বিভাগে মোট ${formatNum(divUpazilas.length, 'bn')}টি উপজেলা ও থানা রয়েছে।`,
          `${divMeta.name} Division has ${divUpazilas.length} upazilas and thanas.`
        )
      );

      pushQ(
        buildQuestion(
          nextId('div-area'),
          priority,
          'geography_borders',
          `${divMeta.bnName} বিভাগের মোট আয়তন প্রায় কত বর্গ কিলোমিটার?`,
          `What is the approximate total area of ${divMeta.name} Division?`,
          {
            bn: `${formatNum(divMeta.areaKm2, 'bn')} বর্গ কিমি`,
            en: `${divMeta.areaKm2.toLocaleString()} km²`,
          },
          divisions
            .filter((d) => d.id !== div.id && DIVISION_META[d.id])
            .map((d) => ({
              bn: `${formatNum(DIVISION_META[d.id].areaKm2, 'bn')} বর্গ কিমি`,
              en: `${DIVISION_META[d.id].areaKm2.toLocaleString()} km²`,
            })),
          `${divMeta.bnName} বিভাগের আয়তন প্রায় ${formatNum(divMeta.areaKm2, 'bn')} বর্গ কিমি।`,
          `${divMeta.name} Division covers ~${divMeta.areaKm2.toLocaleString()} km².`
        )
      );

      if (divMeta.population > 0) {
        pushQ(
          buildQuestion(
            nextId('div-pop'),
            priority,
            'heritage_facts',
            `২০২২ সালের জনশুমারি অনুযায়ী ${divMeta.bnName} বিভাগের মোট জনসংখ্যা প্রায় কত?`,
            `What is the approximate 2022 census population of ${divMeta.name} Division?`,
            {
              bn: `প্রায় ${formatNum(divMeta.population, 'bn')} জন`,
              en: `~${divMeta.population.toLocaleString()}`,
            },
            divisions
              .filter((d) => d.id !== div.id && DIVISION_META[d.id]?.population > 0)
              .map((d) => ({
                bn: `প্রায় ${formatNum(DIVISION_META[d.id].population, 'bn')} জন`,
                en: `~${DIVISION_META[d.id].population.toLocaleString()}`,
              })),
            `২০২২ সালের জনশুমারি অনুযায়ী ${divMeta.bnName} বিভাগের জনসংখ্যা প্রায় ${formatNum(divMeta.population, 'bn')} জন।`,
            `As of 2022, ${divMeta.name} Division has a population of ~${divMeta.population.toLocaleString()}.`
          )
        );
      }

      pushQ(
        buildQuestion(
          nextId('div-fam'),
          priority,
          'heritage_facts',
          `${divMeta.bnName} বিভাগ নিচের কোনটির জন্য বিশেষভাবে পরিচিত?`,
          `What is ${divMeta.name} Division especially known for?`,
          { bn: divMeta.famousForBn, en: divMeta.famousForEn },
          divisions
            .filter((d) => d.id !== div.id && DIVISION_META[d.id])
            .map((d) => ({
              bn: DIVISION_META[d.id].famousForBn,
              en: DIVISION_META[d.id].famousForEn,
            })),
          `${divMeta.bnName} বিভাগ পরিচিত: ${divMeta.famousForBn}।`,
          `${divMeta.name} Division is known for: ${divMeta.famousForEn}.`
        )
      );

      pushQ(
        buildQuestion(
          nextId('div-dir'),
          priority,
          'geography_borders',
          `ভৌগোলিকভাবে ${divMeta.bnName} বিভাগ বাংলাদেশের কোন অঞ্চলে অবস্থিত?`,
          `In which geographical region of Bangladesh is ${divMeta.name} Division located?`,
          { bn: divMeta.directionBn, en: divMeta.directionEn },
          divisions
            .filter((d) => d.id !== div.id && DIVISION_META[d.id]?.directionEn !== divMeta.directionEn)
            .map((d) => ({
              bn: DIVISION_META[d.id].directionBn,
              en: DIVISION_META[d.id].directionEn,
            })),
          `${divMeta.bnName} বিভাগ ${divMeta.directionBn} অবস্থিত।`,
          `${divMeta.name} Division is located in the ${divMeta.directionEn}.`
        )
      );

      if (divMeta.population > 0) {
        const divDensity = Math.round(divMeta.population / Math.max(1, divMeta.areaKm2));
        pushQ(
          buildQuestion(
            nextId('div-density'),
            priority,
            'heritage_facts',
            `${divMeta.bnName} বিভাগে প্রতি বর্গকিলোমিটারে গড় জনঘনত্ব প্রায় কত?`,
            `What is the approximate population density per km² in ${divMeta.name} Division?`,
            {
              bn: `প্রায় ${formatNum(divDensity, 'bn')} জন/কিমি²`,
              en: `~${divDensity.toLocaleString()} /km²`,
            },
            divisions
              .filter((d) => d.id !== div.id && DIVISION_META[d.id]?.population > 0)
              .map((d) => {
                const den = Math.round(DIVISION_META[d.id].population / Math.max(1, DIVISION_META[d.id].areaKm2));
                return { bn: `প্রায় ${formatNum(den, 'bn')} জন/কিমি²`, en: `~${den.toLocaleString()} /km²` };
              })
              .filter((x) => x.en !== `~${divDensity.toLocaleString()} /km²`),
            `${divMeta.bnName} বিভাগে গড় জনঘনত্ব প্রায় ${formatNum(divDensity, 'bn')} জন/কিমি²।`,
            `${divMeta.name} Division has an average density of ~${divDensity.toLocaleString()} people/km².`
          )
        );
      }

      pushQ(
        buildQuestion(
          nextId('div-spec'),
          priority,
          'heritage_facts',
          `${divMeta.bnName} বিভাগের প্রধান কৃষি পণ্য, শিল্প বা বিশেষ উৎপাদন নিচের কোনটি?`,
          `Which specialty produce, craft, or industry is ${divMeta.name} Division known for?`,
          { bn: divMeta.specialtiesBn, en: divMeta.specialtiesEn },
          divisions
            .filter((d) => d.id !== div.id && DIVISION_META[d.id])
            .map((d) => ({
              bn: DIVISION_META[d.id].specialtiesBn,
              en: DIVISION_META[d.id].specialtiesEn,
            })),
          `${divMeta.bnName} বিভাগের বিশেষ উৎপাদন: ${divMeta.specialtiesBn}।`,
          `${divMeta.name} Division specialties: ${divMeta.specialtiesEn}.`
        )
      );

      pushQ(
        buildQuestion(
          nextId('div-conn'),
          priority,
          'geography_borders',
          `${divMeta.bnName} বিভাগের প্রধান সড়ক, সেতু, রেল বা বন্দর যোগাযোগ নিচের কোনটি?`,
          `Which major transport corridor or port connects ${divMeta.name} Division?`,
          { bn: divMeta.connectivityBn, en: divMeta.connectivityEn },
          divisions
            .filter((d) => d.id !== div.id && DIVISION_META[d.id])
            .map((d) => ({
              bn: DIVISION_META[d.id].connectivityBn,
              en: DIVISION_META[d.id].connectivityEn,
            })),
          `${divMeta.bnName} বিভাগের যোগাযোগ ব্যবস্থা: ${divMeta.connectivityBn}।`,
          `${divMeta.name} Division connectivity: ${divMeta.connectivityEn}.`
        )
      );

      // External international border / Bay of Bengal check for division
      const divExtEn = divMeta.externalBordersEn.join(' ');
      const hasIndiaD = divExtEn.includes('India');
      const hasMyanmarD = divExtEn.includes('Myanmar');
      const hasBayD = divExtEn.includes('Bay of Bengal');
      const divExtAns: OptionPair =
        hasIndiaD && hasMyanmarD && hasBayD
          ? { bn: 'ভারত, মায়ানমার ও বঙ্গোপসাগর', en: 'India, Myanmar & Bay of Bengal' }
          : hasIndiaD && hasBayD
          ? { bn: 'ভারত ও বঙ্গোপসাগর', en: 'India & Bay of Bengal' }
          : hasIndiaD
          ? { bn: 'ভারত (স্থলসীমান্ত)', en: 'India (Land border)' }
          : hasBayD
          ? { bn: 'বঙ্গোপসাগর (দক্ষিণ উপকূল)', en: 'Bay of Bengal (Southern Coast)' }
          : { bn: 'অন্য কোনো দেশ বা সমুদ্রসীমা নেই', en: 'None (Interior division)' };
      const divExtOpts: OptionPair[] = [
        { bn: 'ভারত, মায়ানমার ও বঙ্গোপসাগর', en: 'India, Myanmar & Bay of Bengal' },
        { bn: 'ভারত ও বঙ্গোপসাগর', en: 'India & Bay of Bengal' },
        { bn: 'ভারত (স্থলসীমান্ত)', en: 'India (Land border)' },
        { bn: 'বঙ্গোপসাগর (দক্ষিণ উপকূল)', en: 'Bay of Bengal (Southern Coast)' },
        { bn: 'শুধু মায়ানমার (কোনো সমুদ্রসীমা নেই)', en: 'Myanmar only (Landlocked)' },
      ].filter((o) => o.en !== divExtAns.en);
      pushQ(
        buildQuestion(
          nextId('div-ext'),
          priority,
          'geography_borders',
          `${divMeta.bnName} বিভাগের বহির্সীমানা (আন্তর্জাতিক সীমান্ত বা উপকূল) কোনটির সাথে যুক্ত?`,
          `Which international border or coast bounds ${divMeta.name} Division?`,
          divExtAns,
          divExtOpts,
          `${divMeta.bnName} বিভাগের বহির্সীমানা: ${divMeta.externalBordersBn.join(', ')}।`,
          `External borders of ${divMeta.name} Division: ${divMeta.externalBordersEn.join(', ')}.`
        )
      );

      const nbrSet = new Set(divMeta.neighbors);
      const nonNbrDivs = divisions.filter((d) => d.id !== div.id && !nbrSet.has(d.id));
      pushQ(
        buildQuestion(
          nextId('div-nbrcnt'),
          priority,
          'geography_borders',
          `${divMeta.bnName} বিভাগের সাথে দেশের মোট কয়টি বিভাগের সরাসরি সীমান্ত রয়েছে?`,
          `How many other divisions of Bangladesh directly border ${divMeta.name} Division?`,
          { bn: `${formatNum(divMeta.neighbors.length, 'bn')}টি বিভাগ`, en: `${divMeta.neighbors.length}` },
          [1, 2, 3, 4, 5, 6]
            .filter((n) => n !== divMeta.neighbors.length)
            .map((n) => ({ bn: `${formatNum(n, 'bn')}টি বিভাগ`, en: `${n}` })),
          `${divMeta.bnName} বিভাগের সাথে ${formatNum(divMeta.neighbors.length, 'bn')}টি বিভাগের সীমান্ত রয়েছে।`,
          `${divMeta.name} Division shares direct borders with ${divMeta.neighbors.length} divisions.`
        )
      );

      divMeta.neighbors.forEach((ndId, idx) => {
        const nd = divMap.get(ndId);
        if (!nd) return;
        pushQ(
          buildQuestion(
            nextId('div-nbr'),
            priority,
            'geography_borders',
            idx % 2 === 0
              ? `নিচের কোন বিভাগটি ${divMeta.bnName} বিভাগের সরাসরি সীমান্তবর্তী?`
              : `মানচিত্রে ${divMeta.bnName} বিভাগের সাথে সরাসরি যুক্ত প্রতিবেশী বিভাগ কোনটি?`,
            idx % 2 === 0
              ? `Which division directly borders ${divMeta.name} Division?`
              : `Which neighboring division directly touches ${divMeta.name} Division?`,
            { bn: `${nd.bnName} বিভাগ`, en: `${nd.name} Division` },
            nonNbrDivs.map((d) => ({ bn: `${d.bnName} বিভাগ`, en: `${d.name} Division` })),
            `${nd.bnName} বিভাগ ${divMeta.bnName} বিভাগের পার্শ্ববর্তী বিভাগ।`,
            `${nd.name} Division directly borders ${divMeta.name} Division.`
          )
        );
      });

      if (divMeta.neighbors.length >= 3 && nonNbrDivs.length > 0) {
        const nonNbr = shuffleArray(nonNbrDivs)[0];
        pushQ(
          buildQuestion(
            nextId('div-non-nbr'),
            priority,
            'geography_borders',
            `নিচের কোন বিভাগের সাথে ${divMeta.bnName} বিভাগের সরাসরি সীমান্ত নেই?`,
            `Which of these divisions does NOT border ${divMeta.name} Division?`,
            { bn: `${nonNbr.bnName} বিভাগ`, en: `${nonNbr.name} Division` },
            divMeta.neighbors
              .map((nid) => divMap.get(nid))
              .filter((d): d is GeoDivision => Boolean(d))
              .map((d) => ({ bn: `${d.bnName} বিভাগ`, en: `${d.name} Division` })),
            `${nonNbr.bnName} বিভাগের সাথে ${divMeta.bnName} বিভাগের সরাসরি স্থলসীমান্ত নেই।`,
            `${nonNbr.name} Division does not share a direct border with ${divMeta.name} Division.`
          )
        );
      }

      const sortedDivDists = [...divDists].sort(
        (a, b) => (DISTRICT_DETAILS[b.id]?.areaKm2 || 0) - (DISTRICT_DETAILS[a.id]?.areaKm2 || 0)
      );
      if (sortedDivDists.length >= 4) {
        const maxD = sortedDivDists[0];
        const minD = sortedDivDists[sortedDivDists.length - 1];
        pushQ(
          buildQuestion(
            nextId('div-dmax'),
            priority,
            'geography_borders',
            `${divMeta.bnName} বিভাগের জেলাগুলোর মধ্যে আয়তনে সবচেয়ে বড় জেলা কোনটি?`,
            `Which is the largest district by area in ${divMeta.name} Division?`,
            { bn: `${maxD.bnName} জেলা`, en: `${maxD.name} District` },
            sortedDivDists.slice(1).map((d) => ({ bn: `${d.bnName} জেলা`, en: `${d.name} District` })),
            `${maxD.bnName} জেলা ${divMeta.bnName} বিভাগের বৃহত্তম জেলা (~${formatNum(DISTRICT_DETAILS[maxD.id]?.areaKm2 || 0, 'bn')} কিমি²)।`,
            `${maxD.name} District is the largest district in ${divMeta.name} Division (~${(DISTRICT_DETAILS[maxD.id]?.areaKm2 || 0).toLocaleString()} km²).`
          )
        );
        pushQ(
          buildQuestion(
            nextId('div-dmin'),
            priority,
            'geography_borders',
            `${divMeta.bnName} বিভাগের জেলাগুলোর মধ্যে আয়তনে সবচেয়ে ছোট জেলা কোনটি?`,
            `Which is the smallest district by area in ${divMeta.name} Division?`,
            { bn: `${minD.bnName} জেলা`, en: `${minD.name} District` },
            sortedDivDists.slice(0, -1).map((d) => ({ bn: `${d.bnName} জেলা`, en: `${d.name} District` })),
            `${minD.bnName} জেলা ${divMeta.bnName} বিভাগের ক্ষুদ্রতম জেলা (~${formatNum(DISTRICT_DETAILS[minD.id]?.areaKm2 || 0, 'bn')} কিমি²)।`,
            `${minD.name} District is the smallest district in ${divMeta.name} Division (~${(DISTRICT_DETAILS[minD.id]?.areaKm2 || 0).toLocaleString()} km²).`
          )
        );
      }

      const sortedDivDistsByPop = [...divDists].sort(
        (a, b) => (DISTRICT_DETAILS[b.id]?.population || 0) - (DISTRICT_DETAILS[a.id]?.population || 0)
      );
      if (sortedDivDistsByPop.length >= 4) {
        const maxPopD = sortedDivDistsByPop[0];
        const minPopD = sortedDivDistsByPop[sortedDivDistsByPop.length - 1];
        pushQ(
          buildQuestion(
            nextId('div-dpop-max'),
            priority,
            'heritage_facts',
            `${divMeta.bnName} বিভাগের জেলাগুলোর মধ্যে জনসংখ্যার দিক থেকে সবচেয়ে বড় জেলা কোনটি?`,
            `Which district in ${divMeta.name} Division has the highest population?`,
            { bn: `${maxPopD.bnName} জেলা`, en: `${maxPopD.name} District` },
            sortedDivDistsByPop.slice(1).map((d) => ({ bn: `${d.bnName} জেলা`, en: `${d.name} District` })),
            `${maxPopD.bnName} জেলা ${divMeta.bnName} বিভাগের সর্বাধিক জনবহুল জেলা (~${formatNum(DISTRICT_DETAILS[maxPopD.id]?.population || 0, 'bn')} জন)।`,
            `${maxPopD.name} District is the most populous in ${divMeta.name} Division (~${(DISTRICT_DETAILS[maxPopD.id]?.population || 0).toLocaleString()}).`
          )
        );
        pushQ(
          buildQuestion(
            nextId('div-dpop-min'),
            priority,
            'heritage_facts',
            `${divMeta.bnName} বিভাগের জেলাগুলোর মধ্যে জনসংখ্যা সবচেয়ে কম কোন জেলার?`,
            `Which district in ${divMeta.name} Division has the lowest population?`,
            { bn: `${minPopD.bnName} জেলা`, en: `${minPopD.name} District` },
            sortedDivDistsByPop.slice(0, -1).map((d) => ({ bn: `${d.bnName} জেলা`, en: `${d.name} District` })),
            `${minPopD.bnName} জেলা ${divMeta.bnName} বিভাগের সর্বনিম্ন জনসংখ্যার জেলা (~${formatNum(DISTRICT_DETAILS[minPopD.id]?.population || 0, 'bn')} জন)।`,
            `${minPopD.name} District is the least populous in ${divMeta.name} Division (~${(DISTRICT_DETAILS[minPopD.id]?.population || 0).toLocaleString()}).`
          )
        );
      }

      // Within-division District density & upazila-count extremes
      const divDistsByDens = [...divDists]
        .filter((d) => (DISTRICT_DETAILS[d.id]?.population || 0) > 0 && (DISTRICT_DETAILS[d.id]?.areaKm2 || 0) > 0)
        .map((d) => ({
          d,
          dens: Math.round(DISTRICT_DETAILS[d.id].population / DISTRICT_DETAILS[d.id].areaKm2),
        }))
        .sort((a, b) => b.dens - a.dens);
      if (divDistsByDens.length >= 4) {
        const maxDenD = divDistsByDens[0];
        const minDenD = divDistsByDens[divDistsByDens.length - 1];
        pushQ(
          buildQuestion(
            nextId('div-ddens-max'),
            priority,
            'heritage_facts',
            `${divMeta.bnName} বিভাগের জেলাগুলোর মধ্যে প্রতি বর্গকিলোমিটারে জনঘনত্ব সবচেয়ে বেশি কোন জেলায়?`,
            `Which district in ${divMeta.name} Division has the highest population density?`,
            { bn: `${maxDenD.d.bnName} জেলা`, en: `${maxDenD.d.name} District` },
            divDistsByDens.slice(1).map((x) => ({ bn: `${x.d.bnName} জেলা`, en: `${x.d.name} District` })),
            `${maxDenD.d.bnName} জেলায় জনঘনত্ব প্রায় ${formatNum(maxDenD.dens, 'bn')} জন/কিমি², যা ${divMeta.bnName} বিভাগে সর্বাধিক।`,
            `${maxDenD.d.name} District has ~${maxDenD.dens.toLocaleString()} people/km², the highest density in ${divMeta.name} Division.`
          )
        );
        pushQ(
          buildQuestion(
            nextId('div-ddens-min'),
            priority,
            'heritage_facts',
            `${divMeta.bnName} বিভাগের জেলাগুলোর মধ্যে জনঘনত্ব সবচেয়ে কম কোন জেলায়?`,
            `Which district in ${divMeta.name} Division has the lowest population density?`,
            { bn: `${minDenD.d.bnName} জেলা`, en: `${minDenD.d.name} District` },
            divDistsByDens.slice(0, -1).map((x) => ({ bn: `${x.d.bnName} জেলা`, en: `${x.d.name} District` })),
            `${minDenD.d.bnName} জেলায় জনঘনত্ব প্রায় ${formatNum(minDenD.dens, 'bn')} জন/কিমি², যা ${divMeta.bnName} বিভাগে সর্বনিম্ন।`,
            `${minDenD.d.name} District has ~${minDenD.dens.toLocaleString()} people/km², the lowest density in ${divMeta.name} Division.`
          )
        );
      }

      const divDistsByUnitCnt = [...divDists]
        .map((d) => ({ d, cnt: (upazilasByDist.get(d.id) || []).length }))
        .sort((a, b) => b.cnt - a.cnt);
      if (divDistsByUnitCnt.length >= 4 && divDistsByUnitCnt[0].cnt > divDistsByUnitCnt[1].cnt) {
        const mostU = divDistsByUnitCnt[0];
        pushQ(
          buildQuestion(
            nextId('div-dupz-max'),
            priority,
            'geography_borders',
            `${divMeta.bnName} বিভাগের জেলাগুলোর মধ্যে উপজেলা ও থানা মিলিয়ে সর্বাধিক প্রশাসনিক ইউনিট রয়েছে কোন জেলায়?`,
            `Which district in ${divMeta.name} Division has the highest number of upazilas and thanas?`,
            { bn: `${mostU.d.bnName} জেলা`, en: `${mostU.d.name} District` },
            divDistsByUnitCnt.slice(1).map((x) => ({ bn: `${x.d.bnName} জেলা`, en: `${x.d.name} District` })),
            `${mostU.d.bnName} জেলায় ${formatNum(mostU.cnt, 'bn')}টি উপজেলা/থানা রয়েছে, যা ${divMeta.bnName} বিভাগে সর্বাধিক।`,
            `${mostU.d.name} District contains ${mostU.cnt} upazilas/thanas, the highest in ${divMeta.name} Division.`
          )
        );
      }

      // Within-division Upazila comparisons (land area, population, density)
      if (divUpazilas.length >= 4) {
        const divUpzByArea = [...divUpazilas].sort((a, b) => b.areaKm2 - a.areaKm2);
        const maxU = divUpzByArea[0];
        const minU = divUpzByArea[divUpzByArea.length - 1];
        if (maxU.areaKm2 > divUpzByArea[1].areaKm2) {
          pushQ(
            buildQuestion(
              nextId('div-umax'),
              priority,
              'geography_borders',
              `${divMeta.bnName} বিভাগের সব উপজেলা/থানার মধ্যে আয়তনে সবচেয়ে বড় কোনটি?`,
              `Which upazila or thana in ${divMeta.name} Division has the largest land area?`,
              { bn: maxU.bnName, en: maxU.name },
              divUpzByArea.slice(1, 12).map((u) => ({ bn: u.bnName, en: u.name })),
              `${maxU.bnName} (${distMap.get(maxU.districtId)?.bnName || ''} জেলা) ~${formatNum(maxU.areaKm2, 'bn')} কিমি², যা ${divMeta.bnName} বিভাগে বৃহত্তম।`,
              `${maxU.name} (${distMap.get(maxU.districtId)?.name || ''} District) spans ~${maxU.areaKm2} km², the largest in ${divMeta.name} Division.`
            )
          );
        }
        if (minU.areaKm2 < divUpzByArea[divUpzByArea.length - 2].areaKm2) {
          pushQ(
            buildQuestion(
              nextId('div-umin'),
              priority,
              'geography_borders',
              `${divMeta.bnName} বিভাগের সব উপজেলা/থানার মধ্যে আয়তনে সবচেয়ে ছোট কোনটি?`,
              `Which upazila or thana in ${divMeta.name} Division is the smallest in land area?`,
              { bn: minU.bnName, en: minU.name },
              divUpzByArea.slice(-12, -1).map((u) => ({ bn: u.bnName, en: u.name })),
              `${minU.bnName} (${distMap.get(minU.districtId)?.bnName || ''} জেলা) ~${formatNum(minU.areaKm2, 'bn')} কিমি², যা ${divMeta.bnName} বিভাগে ক্ষুদ্রতম।`,
              `${minU.name} (${distMap.get(minU.districtId)?.name || ''} District) covers ~${minU.areaKm2} km², the smallest in ${divMeta.name} Division.`
            )
          );
        }

        const divUpzByPop = [...divUpazilas]
          .filter((u) => (u.population || 0) > 0)
          .sort((a, b) => (b.population || 0) - (a.population || 0));
        if (divUpzByPop.length >= 4) {
          const maxPopU = divUpzByPop[0];
          const minPopU = divUpzByPop[divUpzByPop.length - 1];
          if ((maxPopU.population || 0) > (divUpzByPop[1].population || 0)) {
            pushQ(
              buildQuestion(
                nextId('div-upop-max'),
                priority,
                'heritage_facts',
                `${divMeta.bnName} বিভাগের উপজেলা/থানাগুলোর মধ্যে ২০২২ সালের জনশুমারিতে সর্বাধিক জনবহুল কোনটি?`,
                `Which upazila or thana in ${divMeta.name} Division has the largest 2022 population?`,
                { bn: maxPopU.bnName, en: maxPopU.name },
                divUpzByPop.slice(1, 12).map((u) => ({ bn: u.bnName, en: u.name })),
                `${maxPopU.bnName} (~${formatNum(maxPopU.population || 0, 'bn')} জন) ${divMeta.bnName} বিভাগের সর্বাধিক জনবহুল ইউনিট।`,
                `${maxPopU.name} (~${(maxPopU.population || 0).toLocaleString()}) is the most populous unit in ${divMeta.name} Division.`
              )
            );
          }
          if ((minPopU.population || 0) < (divUpzByPop[divUpzByPop.length - 2].population || 0)) {
            pushQ(
              buildQuestion(
                nextId('div-upop-min'),
                priority,
                'heritage_facts',
                `${divMeta.bnName} বিভাগের উপজেলা/থানাগুলোর মধ্যে জনসংখ্যা সবচেয়ে কম কোনটির?`,
                `Which upazila or thana in ${divMeta.name} Division has the lowest population?`,
                { bn: minPopU.bnName, en: minPopU.name },
                divUpzByPop.slice(-12, -1).map((u) => ({ bn: u.bnName, en: u.name })),
                `${minPopU.bnName} (~${formatNum(minPopU.population || 0, 'bn')} জন) ${divMeta.bnName} বিভাগের সর্বনিম্ন জনসংখ্যার ইউনিট।`,
                `${minPopU.name} (~${(minPopU.population || 0).toLocaleString()}) has the lowest population in ${divMeta.name} Division.`
              )
            );
          }
        }
      }

      // Ranks & Size/Population comparisons of Division among 8 Divisions
      const divsAreaDesc = [...divisions].sort(
        (a, b) => (DIVISION_META[b.id]?.areaKm2 || 0) - (DIVISION_META[a.id]?.areaKm2 || 0)
      );
      const divAreaRank = divsAreaDesc.findIndex((x) => x.id === div.id) + 1;
      const divBnOrd = (n: number) =>
        n === 1 ? '১ম (বৃহত্তম)' : n === 2 ? '২য়' : n === 3 ? '৩য়' : n === 4 ? '৪র্থ' : n === 5 ? '৫ম' : n === 6 ? '৬ষ্ঠ' : n === 7 ? '৭ম' : '৮ম (ক্ষুদ্রতম)';
      pushQ(
        buildQuestion(
          nextId('div-area-rank'),
          priority,
          'geography_borders',
          `আয়তনের দিক থেকে বাংলাদেশের ৮টি বিভাগের মধ্যে ${divMeta.bnName} বিভাগের অবস্থান কততম?`,
          `Where does ${divMeta.name} Division rank by area among the 8 divisions of Bangladesh?`,
          { bn: divBnOrd(divAreaRank), en: `#${divAreaRank}` },
          [1, 2, 3, 4, 5, 6, 7, 8]
            .filter((n) => n !== divAreaRank)
            .map((n) => ({ bn: divBnOrd(n), en: `#${n}` })),
          `আয়তনের বিচারে ${divMeta.bnName} বিভাগ বাংলাদেশে ${divBnOrd(divAreaRank)}।`,
          `${divMeta.name} Division ranks #${divAreaRank} by area among Bangladesh's 8 divisions.`
        )
      );

      const divsPopDesc = [...divisions].sort(
        (a, b) => (DIVISION_META[b.id]?.population || 0) - (DIVISION_META[a.id]?.population || 0)
      );
      const divPopRank = divsPopDesc.findIndex((x) => x.id === div.id) + 1;
      const divPopBnOrd = (n: number) =>
        n === 1 ? '১ম (সর্বাধিক জনবহুল)' : n === 2 ? '২য়' : n === 3 ? '৩য়' : n === 4 ? '৪র্থ' : n === 5 ? '৫ম' : n === 6 ? '৬ষ্ঠ' : n === 7 ? '৭ম' : '৮ম (সর্বনিম্ন)';
      pushQ(
        buildQuestion(
          nextId('div-pop-rank'),
          priority,
          'heritage_facts',
          `জনসংখ্যার দিক থেকে বাংলাদেশের ৮টি বিভাগের মধ্যে ${divMeta.bnName} বিভাগের অবস্থান কততম?`,
          `Where does ${divMeta.name} Division rank by population among the 8 divisions?`,
          { bn: divPopBnOrd(divPopRank), en: `#${divPopRank}` },
          [1, 2, 3, 4, 5, 6, 7, 8]
            .filter((n) => n !== divPopRank)
            .map((n) => ({ bn: divPopBnOrd(n), en: `#${n}` })),
          `জনসংখ্যার বিচারে ${divMeta.bnName} বিভাগ বাংলাদেশে ${divPopBnOrd(divPopRank)}।`,
          `${divMeta.name} Division ranks #${divPopRank} by population.`
        )
      );

      // Direct district membership inside this division
      const divDistIdSet = new Set(divDists.map((d) => d.id));
      const outsideDivDists = districts.filter((d) => !divDistIdSet.has(d.id));
      shuffleArray(divDists)
        .slice(0, Math.min(6, divDists.length))
        .forEach((dd, idx) => {
          pushQ(
            buildQuestion(
              nextId('div-dist-in'),
              priority,
              'geography_borders',
              idx % 2 === 0
                ? `নিচের কোন জেলাটি ${divMeta.bnName} বিভাগের অন্তর্ভুক্ত?`
                : `প্রশাসনিকভাবে ${divMeta.bnName} বিভাগের একটি জেলা নিচের কোনটি?`,
              idx % 2 === 0
                ? `Which of the following districts belongs to ${divMeta.name} Division?`
                : `Which district is part of ${divMeta.name} Division?`,
              { bn: `${dd.bnName} জেলা`, en: `${dd.name} District` },
              outsideDivDists.map((od) => ({ bn: `${od.bnName} জেলা`, en: `${od.name} District` })),
              `${dd.bnName} জেলা ${divMeta.bnName} বিভাগের অন্তর্ভুক্ত।`,
              `${dd.name} District is part of ${divMeta.name} Division.`
            )
          );
        });

      shuffleArray(outsideDivDists)
        .slice(0, 3)
        .forEach((od, idx) => {
          pushQ(
            buildQuestion(
              nextId('div-dist-not'),
              priority,
              'geography_borders',
              idx === 0
                ? `নিচের কোন জেলাটি ${divMeta.bnName} বিভাগের অন্তর্ভুক্ত নয়?`
                : idx === 1
                ? `প্রশাসনিকভাবে নিচের কোন জেলাটি ${divMeta.bnName} বিভাগের বাইরে অবস্থিত?`
                : `${divMeta.bnName} বিভাগের প্রশাসনিক সীমার অন্তর্ভুক্ত নয় নিচের কোন জেলা?`,
              idx === 0
                ? `Which of these districts is NOT in ${divMeta.name} Division?`
                : idx === 1
                ? `Which district lies OUTSIDE ${divMeta.name} Division?`
                : `Which of these districts does not belong to ${divMeta.name} Division?`,
              { bn: `${od.bnName} জেলা`, en: `${od.name} District` },
              divDists.map((dd) => ({ bn: `${dd.bnName} জেলা`, en: `${dd.name} District` })),
              `${od.bnName} জেলা ${divMap.get(od.divisionId)?.bnName || ''} বিভাগের অন্তর্গত, ${divMeta.bnName} বিভাগের নয়।`,
              `${od.name} District belongs to ${divMap.get(od.divisionId)?.name || 'another'} Division, not ${divMeta.name}.`
            )
          );
        });

      const outsideDivUpazilas = upazilas.filter((u) => u.divisionId !== div.id);
      shuffleArray(divUpazilas)
        .slice(0, 4)
        .forEach((du) => {
          pushQ(
            buildQuestion(
              nextId('div-upz-in'),
              priority,
              'geography_borders',
              `নিচের কোন উপজেলা/থানাটি ${divMeta.bnName} বিভাগের ভেতরে অবস্থিত?`,
              `Which of these upazilas/thanas is located within ${divMeta.name} Division?`,
              { bn: du.bnName, en: du.name },
              outsideDivUpazilas.map((ou) => ({ bn: ou.bnName, en: ou.name })),
              `${du.bnName} (${distMap.get(du.districtId)?.bnName || ''} জেলা) ${divMeta.bnName} বিভাগে অবস্থিত।`,
              `${du.name} (${distMap.get(du.districtId)?.name || ''} District) lies in ${divMeta.name} Division.`
            )
          );
        });

      // Rivers flowing through this division (strictly about division itself)
      const divRivers = rivers.filter((r) => r.districts.some((did) => divDistIdSet.has(did)));
      const outsideDivRivers = rivers.filter((r) => !r.districts.some((did) => divDistIdSet.has(did)));
      shuffleArray(divRivers)
        .slice(0, 5)
        .forEach((dr) => {
          pushQ(
            buildQuestion(
              nextId('div-riv-in'),
              priority,
              'rivers',
              `তালিকাভুক্ত প্রধান ৩০টি নদীর মধ্যে কোনটি ${divMeta.bnName} বিভাগের ওপর দিয়ে প্রবাহিত হয়েছে?`,
              `Which of these major rivers flows through ${divMeta.name} Division?`,
              { bn: `${dr.bnName} নদী`, en: `${dr.name} River` },
              outsideDivRivers.map((or) => ({ bn: `${or.bnName} নদী`, en: `${or.name} River` })),
              `${dr.bnName} নদী ${divMeta.bnName} বিভাগের মধ্য দিয়ে প্রবাহিত হয়েছে।`,
              `The ${dr.name} River flows through ${divMeta.name} Division.`
            )
          );
        });
      if (divRivers.length >= 3 && outsideDivRivers.length >= 2) {
        shuffleArray(outsideDivRivers)
          .slice(0, 2)
          .forEach((or) => {
            pushQ(
              buildQuestion(
                nextId('div-riv-not'),
                priority,
                'rivers',
                `নিচের কোন প্রধান নদীটি ${divMeta.bnName} বিভাগের মধ্য দিয়ে প্রবাহিত হয়নি?`,
                `Which major river does NOT flow through ${divMeta.name} Division?`,
                { bn: `${or.bnName} নদী`, en: `${or.name} River` },
                divRivers.map((dr) => ({ bn: `${dr.bnName} নদী`, en: `${dr.name} River` })),
                `${or.bnName} নদী ${divMeta.bnName} বিভাগের মধ্য দিয়ে প্রবাহিত হয়নি।`,
                `The ${or.name} River does not pass through ${divMeta.name} Division.`
              )
            );
          });
      }

      if (divRivers.length >= 2) {
        const sortedDivRivs = [...divRivers].sort((a, b) => b.lengthKm - a.lengthKm);
        const longestDivR = sortedDivRivs[0];
        if (longestDivR.lengthKm > sortedDivRivs[1].lengthKm) {
          pushQ(
            buildQuestion(
              nextId('div-riv-longest'),
              priority,
              'rivers',
              `${divMeta.bnName} বিভাগের ওপর দিয়ে প্রবাহিত নিচের প্রধান নদীগুলোর মধ্যে বাংলাদেশে সবচেয়ে দীর্ঘ কোনটি?`,
              `Among the major rivers flowing through ${divMeta.name} Division, which has the longest course in Bangladesh?`,
              { bn: `${longestDivR.bnName} নদী`, en: `${longestDivR.name} River` },
              sortedDivRivs.slice(1).map((r) => ({ bn: `${r.bnName} নদী`, en: `${r.name} River` })),
              `${longestDivR.bnName} নদী (~${formatNum(longestDivR.lengthKm, 'bn')} কিমি) ${divMeta.bnName} বিভাগে প্রবাহিত দীর্ঘতম প্রধান নদী।`,
              `The ${longestDivR.name} River (~${longestDivR.lengthKm} km) is the longest major river crossing ${divMeta.name} Division.`
            )
          );
        }
      }

      const intlBorderDistCnt = divDists.filter((d) =>
        DISTRICT_DETAILS[d.id]?.externalBordersEn.some(
          (x) => x.includes('India') || x.includes('Myanmar')
        )
      ).length;
      pushQ(
        buildQuestion(
          nextId('div-intl-cnt'),
          priority,
          'geography_borders',
          `${divMeta.bnName} বিভাগের মোট কয়টি জেলার সাথে ভারত বা মায়ানমারের আন্তর্জাতিক স্থলসীমান্ত রয়েছে?`,
          `How many districts in ${divMeta.name} Division share an international land border with India or Myanmar?`,
          { bn: `${formatNum(intlBorderDistCnt, 'bn')}টি জেলা`, en: `${intlBorderDistCnt} district(s)` },
          [0, 1, 2, 3, 4, 5, 6, 7, 8]
            .filter((n) => n !== intlBorderDistCnt)
            .map((n) => ({ bn: `${formatNum(n, 'bn')}টি জেলা`, en: `${n} district(s)` })),
          `${divMeta.bnName} বিভাগের ${formatNum(intlBorderDistCnt, 'bn')}টি জেলার সাথে আন্তর্জাতিক স্থলসীমান্ত রয়েছে।`,
          `${intlBorderDistCnt} district(s) in ${divMeta.name} Division have an international land border.`
        )
      );

      // All landmarks of this division + safe reverse identification
      const foreignDivLms: OptionPair[] = [];
      for (const od of divisions.filter((d) => d.id !== div.id)) {
        const om = DIVISION_META[od.id];
        if (!om) continue;
        om.landmarksBn.forEach((lm, idx) =>
          foreignDivLms.push({ bn: lm, en: om.landmarksEn[idx] })
        );
      }
      for (let i = 0; i < divMeta.landmarksBn.length; i++) {
        const lmBn = divMeta.landmarksBn[i];
        const lmEn = divMeta.landmarksEn[i];
        pushQ(
          buildQuestion(
            nextId('div-lm'),
            priority,
            'heritage_facts',
            `নিচের কোন ঐতিহাসিক বা দর্শনীয় স্থানটি ${divMeta.bnName} বিভাগে অবস্থিত?`,
            `Which landmark is located in ${divMeta.name} Division?`,
            { bn: lmBn, en: lmEn },
            foreignDivLms,
            `‘${lmBn}’ ${divMeta.bnName} বিভাগের অন্যতম পরিচিত স্থান।`,
            `${lmEn} is a notable landmark in ${divMeta.name} Division.`
          )
        );

        if (!lmBn.includes(divMeta.bnName) && !lmEn.toLowerCase().includes(divMeta.name.toLowerCase())) {
          pushQ(
            buildQuestion(
              nextId('div-lm-rev'),
              priority,
              'heritage_facts',
              `দর্শনীয় স্থান ‘${lmBn}’ বাংলাদেশের কোন বিভাগে অবস্থিত?`,
              `In which division of Bangladesh is ‘${lmEn}’ located?`,
              { bn: `${divMeta.bnName} বিভাগ`, en: `${divMeta.name} Division` },
              divisions
                .filter((od) => od.id !== div.id)
                .map((od) => ({ bn: `${od.bnName} বিভাগ`, en: `${od.name} Division` })),
              `‘${lmBn}’ ${divMeta.bnName} বিভাগে অবস্থিত।`,
              `${lmEn} lies in ${divMeta.name} Division.`
            )
          );
        }
      }
    }
  };

  // SCOPE DISPATCH
  if (config.scopeType === 'bangladesh') {
    for (const dv of shuffleArray(divisions)) {
      addDivisionFacts(dv, 1, true);
    }
    for (const d of shuffleArray(districts)) {
      addDistrictFacts(d, 1, false);
    }
    for (const r of shuffleArray(rivers)) {
      addRiverFacts(r, 1, true);
    }

    // National records & landmark comparisons
    const sortedDivs = [...divisions].sort(
      (a, b) => (DIVISION_META[b.id]?.areaKm2 || 0) - (DIVISION_META[a.id]?.areaKm2 || 0)
    );
    const largestDiv = sortedDivs[0];
    const smallestDiv = sortedDivs[sortedDivs.length - 1];
    pushQ(
      buildQuestion(
        nextId('bd-div-max'),
        1,
        'geography_borders',
        `আয়তনের দিক থেকে বাংলাদেশের সবচেয়ে বড় বিভাগ কোনটি?`,
        `Which is the largest division of Bangladesh by area?`,
        { bn: `${largestDiv.bnName} বিভাগ`, en: `${largestDiv.name} Division` },
        sortedDivs.slice(1).map((d) => ({ bn: `${d.bnName} বিভাগ`, en: `${d.name} Division` })),
        `${largestDiv.bnName} বিভাগ আয়তনের দিক থেকে বাংলাদেশের বৃহত্তম বিভাগ (~${formatNum(DIVISION_META[largestDiv.id]?.areaKm2 || 0, 'bn')} কিমি²)।`,
        `${largestDiv.name} Division is the largest division of Bangladesh (~${DIVISION_META[largestDiv.id]?.areaKm2.toLocaleString()} km²).`
      )
    );
    pushQ(
      buildQuestion(
        nextId('bd-div-min'),
        1,
        'geography_borders',
        `আয়তনের দিক থেকে বাংলাদেশের সবচেয়ে ছোট বিভাগ কোনটি?`,
        `Which is the smallest division of Bangladesh by area?`,
        { bn: `${smallestDiv.bnName} বিভাগ`, en: `${smallestDiv.name} Division` },
        sortedDivs.slice(0, -1).map((d) => ({ bn: `${d.bnName} বিভাগ`, en: `${d.name} Division` })),
        `${smallestDiv.bnName} বিভাগ আয়তনের দিক থেকে বাংলাদেশের ক্ষুদ্রতম বিভাগ (~${formatNum(DIVISION_META[smallestDiv.id]?.areaKm2 || 0, 'bn')} কিমি²)।`,
        `${smallestDiv.name} Division is the smallest division of Bangladesh (~${DIVISION_META[smallestDiv.id]?.areaKm2.toLocaleString()} km²).`
      )
    );

    const sortedDivsByPop = [...divisions].sort(
      (a, b) => (DIVISION_META[b.id]?.population || 0) - (DIVISION_META[a.id]?.population || 0)
    );
    if (sortedDivsByPop.length >= 4) {
      const mostPopDiv = sortedDivsByPop[0];
      const leastPopDiv = sortedDivsByPop[sortedDivsByPop.length - 1];
      pushQ(
        buildQuestion(
          nextId('bd-div-pop-max'),
          1,
          'heritage_facts',
          `জনসংখ্যার দিক থেকে বাংলাদেশের সবচেয়ে বড় বিভাগ কোনটি?`,
          `Which is the most populous division in Bangladesh?`,
          { bn: `${mostPopDiv.bnName} বিভাগ`, en: `${mostPopDiv.name} Division` },
          sortedDivsByPop.slice(1).map((d) => ({ bn: `${d.bnName} বিভাগ`, en: `${d.name} Division` })),
          `${mostPopDiv.bnName} বিভাগ জনসংখ্যায় বাংলাদেশের বৃহত্তম বিভাগ (~${formatNum(DIVISION_META[mostPopDiv.id]?.population || 0, 'bn')} জন)।`,
          `${mostPopDiv.name} Division has the largest population in Bangladesh (~${(DIVISION_META[mostPopDiv.id]?.population || 0).toLocaleString()}).`
        )
      );
      pushQ(
        buildQuestion(
          nextId('bd-div-pop-min'),
          1,
          'heritage_facts',
          `জনসংখ্যার দিক থেকে বাংলাদেশের সবচেয়ে ছোট বিভাগ কোনটি?`,
          `Which is the least populous division in Bangladesh?`,
          { bn: `${leastPopDiv.bnName} বিভাগ`, en: `${leastPopDiv.name} Division` },
          sortedDivsByPop.slice(0, -1).map((d) => ({ bn: `${d.bnName} বিভাগ`, en: `${d.name} Division` })),
          `${leastPopDiv.bnName} বিভাগ জনসংখ্যায় বাংলাদেশের ক্ষুদ্রতম বিভাগ (~${formatNum(DIVISION_META[leastPopDiv.id]?.population || 0, 'bn')} জন)।`,
          `${leastPopDiv.name} Division has the smallest population in Bangladesh (~${(DIVISION_META[leastPopDiv.id]?.population || 0).toLocaleString()}).`
        )
      );
    }

    const sortedDistsByArea = [...districts]
      .filter((d) => DISTRICT_DETAILS[d.id])
      .sort((a, b) => DISTRICT_DETAILS[b.id].areaKm2 - DISTRICT_DETAILS[a.id].areaKm2);
    if (sortedDistsByArea.length >= 4) {
      const maxDist = sortedDistsByArea[0];
      const minDist = sortedDistsByArea[sortedDistsByArea.length - 1];
      pushQ(
        buildQuestion(
          nextId('bd-dist-max'),
          1,
          'geography_borders',
          `আয়তনের দিক থেকে বাংলাদেশের সবচেয়ে বড় জেলা কোনটি?`,
          `Which is the largest district of Bangladesh by area?`,
          { bn: `${maxDist.bnName} জেলা`, en: `${maxDist.name} District` },
          sortedDistsByArea.slice(1, 10).map((d) => ({ bn: `${d.bnName} জেলা`, en: `${d.name} District` })),
          `${maxDist.bnName} জেলা বাংলাদেশের বৃহত্তম জেলা (~${formatNum(DISTRICT_DETAILS[maxDist.id].areaKm2, 'bn')} কিমি²)।`,
          `${maxDist.name} District is the largest district in Bangladesh (~${DISTRICT_DETAILS[maxDist.id].areaKm2.toLocaleString()} km²).`
        )
      );
      pushQ(
        buildQuestion(
          nextId('bd-dist-min'),
          1,
          'geography_borders',
          `আয়তনের দিক থেকে বাংলাদেশের সবচেয়ে ছোট জেলা কোনটি?`,
          `Which is the smallest district of Bangladesh by area?`,
          { bn: `${minDist.bnName} জেলা`, en: `${minDist.name} District` },
          sortedDistsByArea.slice(-10, -1).map((d) => ({ bn: `${d.bnName} জেলা`, en: `${d.name} District` })),
          `${minDist.bnName} জেলা বাংলাদেশের ক্ষুদ্রতম জেলা (~${formatNum(DISTRICT_DETAILS[minDist.id].areaKm2, 'bn')} কিমি²)।`,
          `${minDist.name} District is the smallest district in Bangladesh (~${DISTRICT_DETAILS[minDist.id].areaKm2.toLocaleString()} km²).`
        )
      );
    }

    const sortedDistsByPop = [...districts]
      .filter((d) => DISTRICT_DETAILS[d.id]?.population > 0)
      .sort((a, b) => DISTRICT_DETAILS[b.id].population - DISTRICT_DETAILS[a.id].population);
    if (sortedDistsByPop.length >= 4) {
      const maxPopDist = sortedDistsByPop[0];
      const minPopDist = sortedDistsByPop[sortedDistsByPop.length - 1];
      pushQ(
        buildQuestion(
          nextId('bd-dist-pop-max'),
          1,
          'heritage_facts',
          `জনসংখ্যার দিক থেকে বাংলাদেশের সর্বাধিক জনবহুল জেলা কোনটি?`,
          `Which is the most populous district in Bangladesh?`,
          { bn: `${maxPopDist.bnName} জেলা`, en: `${maxPopDist.name} District` },
          sortedDistsByPop.slice(1, 10).map((d) => ({ bn: `${d.bnName} জেলা`, en: `${d.name} District` })),
          `${maxPopDist.bnName} জেলা বাংলাদেশের সর্বাধিক জনবহুল জেলা (~${formatNum(DISTRICT_DETAILS[maxPopDist.id].population, 'bn')} জন)।`,
          `${maxPopDist.name} District has the largest population in Bangladesh (~${DISTRICT_DETAILS[maxPopDist.id].population.toLocaleString()}).`
        )
      );
      pushQ(
        buildQuestion(
          nextId('bd-dist-pop-min'),
          1,
          'heritage_facts',
          `জনসংখ্যার দিক থেকে বাংলাদেশের সর্বনিম্ন জনসংখ্যার জেলা কোনটি?`,
          `Which is the least populous district in Bangladesh?`,
          { bn: `${minPopDist.bnName} জেলা`, en: `${minPopDist.name} District` },
          sortedDistsByPop.slice(-10, -1).map((d) => ({ bn: `${d.bnName} জেলা`, en: `${d.name} District` })),
          `${minPopDist.bnName} জেলা বাংলাদেশের সর্বনিম্ন জনসংখ্যার জেলা (~${formatNum(DISTRICT_DETAILS[minPopDist.id].population, 'bn')} জন)।`,
          `${minPopDist.name} District has the smallest population in Bangladesh (~${DISTRICT_DETAILS[minPopDist.id].population.toLocaleString()}).`
        )
      );
    }

    // Interesting Facts identification questions (only non-name-leaking facts across Divisions & Districts)
    for (const dv of shuffleArray(divisions)) {
      const dm = DIVISION_META[dv.id];
      if (!dm) continue;
      for (let idx = 0; idx < dm.interestingFactsBn.length; idx++) {
        const fBn = dm.interestingFactsBn[idx];
        const fEn = dm.interestingFactsEn[idx];
        if (!fBn || !fEn) continue;
        if (fBn.includes(dm.bnName) || fEn.toLowerCase().includes(dm.name.toLowerCase())) continue;
        pushQ(
          buildQuestion(
            nextId('bd-div-fact'),
            1,
            'heritage_facts',
            `নিচের গুরুত্বপূর্ণ তথ্যটি বাংলাদেশের কোন বিভাগের সাথে সম্পর্কিত: “${fBn}”`,
            `Which division of Bangladesh does this fact describe: “${fEn}”`,
            { bn: `${dm.bnName} বিভাগ`, en: `${dm.name} Division` },
            divisions
              .filter((od) => od.id !== dv.id)
              .map((od) => ({ bn: `${od.bnName} বিভাগ`, en: `${od.name} Division` })),
            `${dm.bnName} বিভাগ: ${fBn}`,
            `${dm.name} Division: ${fEn}`
          )
        );
      }
    }

    for (const d of shuffleArray(districts).slice(0, 18)) {
      const det = DISTRICT_DETAILS[d.id];
      if (!det) continue;
      const nonLeakIdx = det.interestingFactsBn.findIndex(
        (fb, idx) =>
          !fb.includes(d.bnName) &&
          !det.interestingFactsEn[idx]?.toLowerCase().includes(d.name.toLowerCase())
      );
      if (nonLeakIdx >= 0) {
        const fBn = det.interestingFactsBn[nonLeakIdx];
        const fEn = det.interestingFactsEn[nonLeakIdx];
        pushQ(
          buildQuestion(
            nextId('bd-dist-fact'),
            1,
            'heritage_facts',
            `নিচের বিশেষ তথ্যটি বাংলাদেশের কোন জেলার ক্ষেত্রে প্রযোজ্য: “${fBn}”`,
            `Which district of Bangladesh does this fact apply to: “${fEn}”`,
            { bn: `${d.bnName} জেলা`, en: `${d.name} District` },
            districts
              .filter((od) => od.id !== d.id)
              .map((od) => ({ bn: `${od.bnName} জেলা`, en: `${od.name} District` })),
            `${d.bnName} জেলা: ${fBn}`,
            `${d.name} District: ${fEn}`
          )
        );
      }
    }

    const sortedRivs = [...rivers].sort((a, b) => b.lengthKm - a.lengthKm);
    if (sortedRivs.length >= 4) {
      const longestR = sortedRivs[0];
      pushQ(
        buildQuestion(
          nextId('bd-riv-max'),
          1,
          'rivers',
          `মানচিত্রের তালিকাভুক্ত প্রধান ৩০টি নদীর মধ্যে বাংলাদেশে প্রবাহিত সবচেয়ে দীর্ঘ নদী কোনটি?`,
          `Which of the 30 mapped rivers has the longest course inside Bangladesh?`,
          { bn: `${longestR.bnName} নদী`, en: `${longestR.name} River` },
          sortedRivs.slice(1, 8).map((r) => ({ bn: `${r.bnName} নদী`, en: `${r.name} River` })),
          `${longestR.bnName} নদী বাংলাদেশে প্রায় ${formatNum(longestR.lengthKm, 'bn')} কিমি দীর্ঘ।`,
          `The ${longestR.name} River flows ~${longestR.lengthKm} km inside Bangladesh.`
        )
      );
    }

    pushQ(
      buildQuestion(
        nextId('bd-div-young'),
        1,
        'heritage_facts',
        `২০১৫ সালে গঠিত বাংলাদেশের নবীনতম (অষ্টম) বিভাগ কোনটি?`,
        `Which is the newest (8th) division of Bangladesh, formed in 2015?`,
        { bn: 'ময়মনসিংহ বিভাগ', en: 'Mymensingh Division' },
        [
          { bn: 'রংপুর বিভাগ', en: 'Rangpur Division' },
          { bn: 'সিলেট বিভাগ', en: 'Sylhet Division' },
          { bn: 'বরিশাল বিভাগ', en: 'Barishal Division' },
        ],
        `২০১৫ সালের ১৪ সেপ্টেম্বর ঢাকা বিভাগ থেকে পৃথক হয়ে ময়মনসিংহ বিভাগ গঠিত হয়।`,
        `Mymensingh Division was established on 14 September 2015.`
      )
    );

    pushQ(
      buildQuestion(
        nextId('bd-div-most'),
        1,
        'geography_borders',
        `বাংলাদেশের কোন বিভাগে সর্বাধিক সংখ্যক জেলা (১৩টি) রয়েছে?`,
        `Which division of Bangladesh contains the most districts (13)?`,
        { bn: 'ঢাকা বিভাগ', en: 'Dhaka Division' },
        [
          { bn: 'চট্টগ্রাম বিভাগ', en: 'Chattogram Division' },
          { bn: 'খুলনা বিভাগ', en: 'Khulna Division' },
          { bn: 'রাজশাহী বিভাগ', en: 'Rajshahi Division' },
        ],
        `ঢাকা বিভাগে সর্বাধিক ১৩টি জেলা রয়েছে (চট্টগ্রাম বিভাগে ১১টি)।`,
        `Dhaka Division has 13 districts, the highest among all 8 divisions.`
      )
    );

    // Additional Unique National Bangladesh Questions
    pushQ(
      buildQuestion(
        nextId('bd-tri-border'),
        1,
        'geography_borders',
        `বাংলাদেশের একমাত্র কোন জেলাটি ভারত ও মায়ানমার—উভয় দেশের সাথে আন্তর্জাতিক সীমান্ত ভাগ করেছে?`,
        `Which is the only district of Bangladesh that shares international borders with both India and Myanmar?`,
        { bn: 'রাঙ্গামাটি জেলা', en: 'Rangamati District' },
        [
          { bn: 'বান্দরবান জেলা', en: 'Bandarban District' },
          { bn: 'কক্সবাজার জেলা', en: 'Cox’s Bazar District' },
          { bn: 'খাগড়াছড়ি জেলা', en: 'Khagrachari District' },
        ],
        `রাঙ্গামাটি বাংলাদেশের একমাত্র জেলা যার সাথে ভারত (মিজোরাম-ত্রিপুরা) ও মায়ানমার—উভয় দেশের সীমান্ত রয়েছে।`,
        `Rangamati is the sole district in Bangladesh bordering both India and Myanmar.`
      )
    );

    pushQ(
      buildQuestion(
        nextId('bd-no-intl-divs'),
        1,
        'geography_borders',
        `বাংলাদেশের কোন দুটি বিভাগের কোনো জেলারই ভারত বা মায়ানমারের সাথে আন্তর্জাতিক স্থলসীমান্ত নেই?`,
        `Which two divisions of Bangladesh have no international land border with India or Myanmar?`,
        { bn: 'ঢাকা ও বরিশাল বিভাগ', en: 'Dhaka & Barishal Divisions' },
        [
          { bn: 'সিলেট ও ময়মনসিংহ বিভাগ', en: 'Sylhet & Mymensingh Divisions' },
          { bn: 'রাজশাহী ও রংপুর বিভাগ', en: 'Rajshahi & Rangpur Divisions' },
          { bn: 'খুলনা ও চট্টগ্রাম বিভাগ', en: 'Khulna & Chattogram Divisions' },
        ],
        `ঢাকা (সম্পূর্ণ অভ্যন্তরীণ) ও বরিশাল (বঙ্গোপসাগর উপকূলীয়) বিভাগের কোনো জেলার আন্তর্জাতিক স্থলসীমান্ত নেই।`,
        `Dhaka (landlocked) and Barishal (coastal) are the only two divisions without an international land border.`
      )
    );

    pushQ(
      buildQuestion(
        nextId('bd-island-dist'),
        1,
        'geography_borders',
        `বাংলাদেশের একমাত্র দ্বীপ জেলা হিসেবে পরিচিত কোন জেলাটি?`,
        `Which district is recognized as the only island district of Bangladesh?`,
        { bn: 'ভোলা জেলা', en: 'Bhola District' },
        [
          { bn: 'পটুয়াখালী জেলা', en: 'Patuakhali District' },
          { bn: 'বরগুনা জেলা', en: 'Barguna District' },
          { bn: 'নোয়াখালী জেলা', en: 'Noakhali District' },
        ],
        `মেঘনা মোহনা ও বঙ্গোপসাগরের বুকে অবস্থিত ভোলা বাংলাদেশের একমাত্র বৃহৎ দ্বীপ জেলা।`,
        `Surrounded by the Meghna estuary and Bay of Bengal, Bhola is Bangladesh’s only island district.`
      )
    );

    pushQ(
      buildQuestion(
        nextId('bd-largest-upz'),
        1,
        'geography_borders',
        `আয়তনের দিক থেকে বাংলাদেশের বৃহত্তম উপজেলা কোনটি?`,
        `Which is the largest upazila in Bangladesh by land area?`,
        { bn: 'বাঘাইছড়ি (রাঙ্গামাটি)', en: 'Baghaichhari (Rangamati)' },
        [
          { bn: 'শ্যামনগর (সাতক্ষীরা)', en: 'Shyamnagar (Satkhira)' },
          { bn: 'থানচি (বান্দরবান)', en: 'Thanchi (Bandarban)' },
          { bn: 'হাতিয়া (নোয়াখালী)', en: 'Hatiya (Noakhali)' },
        ],
        `রাঙ্গামাটি জেলার বাঘাইছড়ি আয়তনের দিক থেকে বাংলাদেশের বৃহত্তম উপজেলা।`,
        `Baghaichhari in Rangamati District is the largest upazila in Bangladesh by area.`
      )
    );

    pushQ(
      buildQuestion(
        nextId('bd-extreme-pts'),
        1,
        'geography_borders',
        `ভৌগোলিক অবস্থানে বাংলাদেশের সর্ব-উত্তরের, সর্ব-দক্ষিণের ও সর্ব-পশ্চিমের জেলা যথাক্রমে কোন তিনটি?`,
        `Which districts mark Bangladesh’s northernmost, southernmost, and westernmost extremes respectively?`,
        { bn: 'পঞ্চগড়, কক্সবাজার ও চাঁপাইনবাবগঞ্জ', en: 'Panchagarh, Cox’s Bazar & Chapainawabganj' },
        [
          { bn: 'দিনাজপুর, বরগুনা ও সাতক্ষীরা', en: 'Dinajpur, Barguna & Satkhira' },
          { bn: 'লালমনিরহাট, ভোলা ও মেহেরপুর', en: 'Lalmonirhat, Bhola & Meherpur' },
          { bn: 'ঠাকুরগাঁও, পটুয়াখালী ও যশোর', en: 'Thakurgaon, Patuakhali & Jashore' },
        ],
        `সর্ব-উত্তরে পঞ্চগড় (তেঁতুলিয়া), সর্ব-দক্ষিণে কক্সবাজার (টেকনাফ/সেন্টমার্টিন) ও সর্ব-পশ্চিমে চাঁপাইনবাবগঞ্জ (শিবগঞ্জ)।`,
        `Panchagarh marks the north, Cox’s Bazar the south, and Chapainawabganj the west.`
      )
    );

    pushQ(
      buildQuestion(
        nextId('bd-fewest-upz'),
        1,
        'heritage_facts',
        `প্রশাসনিক কাঠামো অনুযায়ী বাংলাদেশের কোন দুটি জেলায় সবচেয়ে কম সংখ্যক (মাত্র ৩টি করে) উপজেলা রয়েছে?`,
        `Which two districts of Bangladesh tie for having the fewest upazilas (only 3 each)?`,
        { bn: 'মেহেরপুর ও নড়াইল', en: 'Meherpur & Narail' },
        [
          { bn: 'ঝালকাঠি ও মাগুরা', en: 'Jhalokati & Magura' },
          { bn: 'চুয়াডাঙ্গা ও রাজবাড়ী', en: 'Chuadanga & Rajbari' },
          { bn: 'মুন্সিগঞ্জ ও নারায়ণগঞ্জ', en: 'Munshiganj & Narayanganj' },
        ],
        `খুলনা বিভাগের মেহেরপুর ও নড়াইল জেলায় মাত্র ৩টি করে উপজেলা রয়েছে।`,
        `Meherpur and Narail each consist of only 3 upazilas.`
      )
    );

    pushQ(
      buildQuestion(
        nextId('bd-sundarbans-3'),
        1,
        'heritage_facts',
        `বিশ্বের বৃহত্তম ম্যানগ্রোভ বন সুন্দরবন বাংলাদেশের কোন তিনটি জেলায় বিস্তৃত রয়েছে?`,
        `Across which three districts of Bangladesh does the Sundarbans mangrove forest extend?`,
        { bn: 'খুলনা, সাতক্ষীরা ও বাগেরহাট', en: 'Khulna, Satkhira & Bagerhat' },
        [
          { bn: 'পটুয়াখালী, বরগুনা ও ভোলা', en: 'Patuakhali, Barguna & Bhola' },
          { bn: 'যশোর, নড়াইল ও গোপালগঞ্জ', en: 'Jashore, Narail & Gopalganj' },
          { bn: 'পিরোজপুর, ঝালকাঠি ও বরিশাল', en: 'Pirojpur, Jhalokati & Barishal' },
        ],
        `সুন্দরবন বাংলাদেশের খুলনা, সাতক্ষীরা ও বাগেরহাট জেলার দক্ষিণ উপকূল জুড়ে বিস্তৃত।`,
        `The Sundarbans spans southern Khulna, Satkhira, and Bagerhat districts.`
      )
    );

    pushQ(
      buildQuestion(
        nextId('bd-haor-cap'),
        1,
        'heritage_facts',
        `টাঙ্গুয়ার হাওরসহ অসংখ্য হাওরের কারণে ‘হাওরের রাজধানী’ হিসেবে পরিচিত জেলা কোনটি?`,
        `Which district is famous as the ‘Haor Capital’ of Bangladesh and home to Tanguar Haor?`,
        { bn: 'সুনামগঞ্জ জেলা', en: 'Sunamganj District' },
        [
          { bn: 'হবিগঞ্জ জেলা', en: 'Habiganj District' },
          { bn: 'মৌলভীবাজার জেলা', en: 'Moulvibazar District' },
          { bn: 'কিশোরগঞ্জ জেলা', en: 'Kishoreganj District' },
        ],
        `টাঙ্গুয়ার হাওর, শনির হাওর ও হাকালুকি-সংলগ্ন সুনামগঞ্জ ‘হাওরের রাজধানী’ হিসেবে পরিচিত।`,
        `Sunamganj is renowned as the haor heartland of Bangladesh and hosts Tanguar Haor.`
      )
    );
  } else if (config.scopeType === 'division') {
    const div = divMap.get(config.scopeId || divisions[0]?.id) || divisions[0];
    if (div) {
      addDivisionFacts(div, 1, true);
    }
  } else if (config.scopeType === 'district') {
    const dist = distMap.get(config.scopeId || districts[0]?.id) || districts[0];
    if (dist) {
      addDistrictFacts(dist, 1, true, undefined, undefined, false);
    }
  } else if (config.scopeType === 'upazila') {
    const u = upazilaMap.get(config.scopeId || upazilas[0]?.id) || upazilas[0];
    if (u) {
      const parentDist = distMap.get(u.districtId);
      const parentDiv = divMap.get(u.divisionId);
      if (parentDist && parentDiv) {
        const uRivers = u.rivers
          .map((rid) => riverMap.get(rid))
          .filter((r): r is GeoRiver => Boolean(r));
        const distUpazilas = upazilasByDist.get(parentDist.id) || [];
        const uNbrsInit = u.neighbors
          .map((uid) => upazilaMap.get(uid))
          .filter((nu): nu is GeoUpazila => Boolean(nu));
        const crossDistIdsInit = Array.from(
          new Set(
            uNbrsInit
              .filter((nu) => nu.districtId !== u.districtId)
              .map((nu) => nu.districtId)
          )
        );
        const uDetail = getUpazilaDetail(
          u,
          parentDist,
          parentDiv,
          uRivers.map((r) => r.bnName),
          uRivers.map((r) => r.name),
          {
            districtUpazilas: distUpazilas,
            crossDistrictNamesBn: crossDistIdsInit
              .map((id) => distMap.get(id)?.bnName)
              .filter((n): n is string => Boolean(n)),
            crossDistrictNamesEn: crossDistIdsInit
              .map((id) => distMap.get(id)?.name)
              .filter((n): n is string => Boolean(n)),
          }
        );
        const relPos = getRelativeOffsetLabel(u, parentDist);
        const uLabelBn = `${u.bnName} ${uDetail.isUrbanThana ? 'থানা' : 'উপজেলা'}`;
        const uLabelEn = `${u.name} ${uDetail.isUrbanThana ? 'Thana' : 'Upazila'}`;
        const distMeta = DISTRICT_DETAILS[parentDist.id];

        // TIER 1: 100% strictly about THIS Upazila (u)
        // 1. Parent District
        pushQ(
          buildQuestion(
            nextId('u-dist'),
            1,
            'geography_borders',
            `${uLabelBn} কোন জেলার অন্তর্গত?`,
            `Which district is ${uLabelEn} located in?`,
            { bn: `${parentDist.bnName} জেলা`, en: `${parentDist.name} District` },
            districts
              .filter((d) => d.id !== parentDist.id)
              .map((d) => ({ bn: `${d.bnName} জেলা`, en: `${d.name} District` })),
            `${uLabelBn} ${parentDist.bnName} জেলার অন্তর্গত।`,
            `${uLabelEn} is part of ${parentDist.name} District.`
          )
        );

        // 2. Parent Division
        pushQ(
          buildQuestion(
            nextId('u-div'),
            1,
            'geography_borders',
            `${uLabelBn} কোন বিভাগের অন্তর্ভুক্ত?`,
            `Which division does ${uLabelEn} belong to?`,
            { bn: `${parentDiv.bnName} বিভাগ`, en: `${parentDiv.name} Division` },
            divisions
              .filter((dv) => dv.id !== parentDiv.id)
              .map((dv) => ({ bn: `${dv.bnName} বিভাগ`, en: `${dv.name} Division` })),
            `${uLabelBn} ${parentDiv.bnName} বিভাগের ${parentDist.bnName} জেলায় অবস্থিত।`,
            `${uLabelEn} lies in ${parentDist.name} District under ${parentDiv.name} Division.`
          )
        );

        // 3. Macro Region of Bangladesh
        if (distMeta) {
          pushQ(
            buildQuestion(
              nextId('u-region'),
              1,
              'geography_borders',
              `ভৌগোলিকভাবে ${uLabelBn} বাংলাদেশের কোন অঞ্চলে অবস্থিত?`,
              `In which region of Bangladesh is ${uLabelEn} located?`,
              { bn: distMeta.directionLabelBn, en: distMeta.directionLabelEn },
              Object.values(DIRECTION_INFO)
                .filter(
                  (z) =>
                    z.key !== 'all' &&
                    !distMeta.directions.includes(z.key) &&
                    z.labelBn !== distMeta.directionLabelBn
                )
                .map((z) => ({ bn: z.labelBn, en: z.labelEn })),
              `${uLabelBn} (${parentDist.bnName} জেলা) ${distMeta.directionLabelBn} অবস্থিত।`,
              `${uLabelEn} (${parentDist.name} District) lies in the ${distMeta.directionLabelEn}.`
            )
          );
        }

        // 4. Relative Compass Position within Parent District
        const posChoices: OptionPair[] = [
          { bn: 'জেলার উত্তর অংশ', en: 'Northern part of district' },
          { bn: 'জেলার দক্ষিণ অংশ', en: 'Southern part of district' },
          { bn: 'জেলার পূর্ব অংশ', en: 'Eastern part of district' },
          { bn: 'জেলার পশ্চিম অংশ', en: 'Western part of district' },
          { bn: 'জেলার উত্তর-পূর্ব অংশ', en: 'Northeastern part of district' },
          { bn: 'জেলার উত্তর-পশ্চিম অংশ', en: 'Northwestern part of district' },
          { bn: 'জেলার দক্ষিণ-পূর্ব অংশ', en: 'Southeastern part of district' },
          { bn: 'জেলার দক্ষিণ-পশ্চিম অংশ', en: 'Southwestern part of district' },
          { bn: 'জেলার মধ্যভাগ', en: 'Central part of district' },
        ];
        pushQ(
          buildQuestion(
            nextId('u-relpos'),
            1,
            'geography_borders',
            `${parentDist.bnName} জেলার মানচিত্রে ${uLabelBn} কোন দিকে অবস্থিত?`,
            `Where inside ${parentDist.name} District is ${uLabelEn} positioned?`,
            relPos,
            posChoices.filter((p) => p.en !== relPos.en),
            `${uLabelBn} ${parentDist.bnName} জেলার ${relPos.bn}-এ অবস্থিত।`,
            `${uLabelEn} sits in the ${relPos.en.toLowerCase()} of ${parentDist.name} District.`
          )
        );

        // 5. Area of Upazila
        const diffAreaUpazilas = upazilas
          .filter((ou) => ou.id !== u.id && Math.abs(ou.areaKm2 - u.areaKm2) >= 35)
          .map((ou) => ({
            bn: `${formatNum(ou.areaKm2, 'bn')} বর্গ কিমি`,
            en: `${ou.areaKm2} km²`,
          }));
        pushQ(
          buildQuestion(
            nextId('u-area'),
            1,
            'geography_borders',
            `${uLabelBn}-এর আনুমানিক আয়তন কত?`,
            `What is the approximate area of ${uLabelEn}?`,
            { bn: `${formatNum(u.areaKm2, 'bn')} বর্গ কিমি`, en: `${u.areaKm2} km²` },
            diffAreaUpazilas,
            `${uLabelBn}-এর আয়তন প্রায় ${formatNum(u.areaKm2, 'bn')} বর্গকিলোমিটার।`,
            `${uLabelEn} covers an area of approximately ${u.areaKm2} km².`
          )
        );

        // 5B. 2022 Census Population & Density of Upazila u
        const uPop = u.population || 0;
        if (uPop > 0) {
          const diffPopUpazilas = upazilas
            .filter((ou) => ou.id !== u.id && (ou.population || 0) > 0 && Math.abs((ou.population || 0) - uPop) >= 55000)
            .map((ou) => ({
              bn: `প্রায় ${formatNum(ou.population || 0, 'bn')} জন`,
              en: `~${(ou.population || 0).toLocaleString()}`,
            }));
          pushQ(
            buildQuestion(
              nextId('u-pop'),
              1,
              'heritage_facts',
              `২০২২ সালের জনশুমারি অনুযায়ী ${uLabelBn}-এর আনুমানিক জনসংখ্যা কত?`,
              `What is the approximate 2022 census population of ${uLabelEn}?`,
              { bn: `প্রায় ${formatNum(uPop, 'bn')} জন`, en: `~${uPop.toLocaleString()}` },
              diffPopUpazilas,
              `২০২২ সালের জনশুমারি অনুযায়ী ${uLabelBn}-এর জনসংখ্যা প্রায় ${formatNum(uPop, 'bn')} জন।`,
              `As of the 2022 census, ${uLabelEn} has a population of ~${uPop.toLocaleString()}.`
            )
          );

          const uDensity = u.areaKm2 > 0 ? Math.round(uPop / u.areaKm2) : 0;
          if (uDensity > 0) {
            const diffDensityUpazilas = upazilas
              .filter((ou) => {
                if (ou.id === u.id || !ou.population || !ou.areaKm2) return false;
                const d2 = Math.round(ou.population / ou.areaKm2);
                return Math.abs(d2 - uDensity) >= 420;
              })
              .map((ou) => {
                const d2 = Math.round((ou.population || 0) / ou.areaKm2);
                return {
                  bn: `প্রায় ${formatNum(d2, 'bn')} জন/কিমি²`,
                  en: `~${d2.toLocaleString()} /km²`,
                };
              });
            pushQ(
              buildQuestion(
                nextId('u-density'),
                1,
                'heritage_facts',
                `${uLabelBn}-এ প্রতি বর্গকিলোমিটারে আনুমানিক জনঘনত্ব কত?`,
                `What is the approximate population density per km² in ${uLabelEn}?`,
                {
                  bn: `প্রায় ${formatNum(uDensity, 'bn')} জন/কিমি²`,
                  en: `~${uDensity.toLocaleString()} /km²`,
                },
                diffDensityUpazilas,
                `${uLabelBn}-এ প্রতি বর্গকিলোমিটারে জনঘনত্ব প্রায় ${formatNum(uDensity, 'bn')} জন।`,
                `${uLabelEn} has a population density of ~${uDensity.toLocaleString()} people per km².`
              )
            );
          }
        }

        // 5C. Area & Population Rank within Parent District (direct ranking of u)
        const bnOrdinal = (n: number) => {
          if (n === 1) return '১ম';
          if (n === 2) return '২য়';
          if (n === 3) return '৩য়';
          if (n === 4) return '৪র্থ';
          if (n === 5) return '৫ম';
          if (n === 6) return '৬ষ্ঠ';
          if (n >= 7 && n <= 10) return `${formatNum(n, 'bn')}ম`;
          return `${formatNum(n, 'bn')}তম`;
        };

        if (distUpazilas.length >= 2) {
          const sortedAreaSibs = [...distUpazilas].sort((a, b) => b.areaKm2 - a.areaKm2);
          const areaRank = sortedAreaSibs.findIndex((s) => s.id === u.id) + 1;
          const areaRankLabel: OptionPair =
            areaRank === 1
              ? { bn: '১ম (জেলার বৃহত্তম)', en: '1st (Largest in district)' }
              : areaRank === distUpazilas.length
              ? { bn: `${bnOrdinal(areaRank)} (জেলার ক্ষুদ্রতম)`, en: `${areaRank} (Smallest in district)` }
              : { bn: `${bnOrdinal(areaRank)} স্থান`, en: `Rank #${areaRank}` };
          const areaRankMax = Math.max(4, distUpazilas.length);
          const areaRankDistractors: OptionPair[] = Array.from(
            { length: areaRankMax },
            (_, idx) => idx + 1
          )
            .filter((r) => r !== areaRank)
            .map((r) =>
              r === 1
                ? { bn: '১ম (জেলার বৃহত্তম)', en: '1st (Largest in district)' }
                : r === distUpazilas.length
                ? { bn: `${bnOrdinal(r)} (জেলার ক্ষুদ্রতম)`, en: `${r} (Smallest in district)` }
                : { bn: `${bnOrdinal(r)} স্থান`, en: `Rank #${r}` }
            );
          pushQ(
            buildQuestion(
              nextId('u-area-rank'),
              1,
              'geography_borders',
              `আয়তনের দিক থেকে ${parentDist.bnName} জেলার ${formatNum(distUpazilas.length, 'bn')}টি ইউনিটের মধ্যে ${uLabelBn}-এর অবস্থান কততম?`,
              `Where does ${uLabelEn} rank by land area among the ${distUpazilas.length} units of ${parentDist.name} District?`,
              areaRankLabel,
              areaRankDistractors,
              `${uLabelBn} (${formatNum(u.areaKm2, 'bn')} কিমি²) আয়তনে ${parentDist.bnName} জেলায় ${areaRankLabel.bn}।`,
              `${uLabelEn} (${u.areaKm2} km²) ranks ${areaRankLabel.en} in ${parentDist.name} District.`
            )
          );

          if (uPop > 0) {
            const sortedPopSibs = [...distUpazilas].sort((a, b) => (b.population || 0) - (a.population || 0));
            const popRank = sortedPopSibs.findIndex((s) => s.id === u.id) + 1;
            const popRankLabel: OptionPair =
              popRank === 1
                ? { bn: '১ম (সর্বাধিক জনবহুল)', en: '1st (Most populous)' }
                : popRank === distUpazilas.length
                ? { bn: `${bnOrdinal(popRank)} (সর্বনিম্ন জনসংখ্যা)`, en: `${popRank} (Least populous)` }
                : { bn: `${bnOrdinal(popRank)} স্থান`, en: `Rank #${popRank}` };
            const popRankDistractors: OptionPair[] = Array.from(
              { length: areaRankMax },
              (_, idx) => idx + 1
            )
              .filter((r) => r !== popRank)
              .map((r) =>
                r === 1
                  ? { bn: '১ম (সর্বাধিক জনবহুল)', en: '1st (Most populous)' }
                  : r === distUpazilas.length
                  ? { bn: `${bnOrdinal(r)} (সর্বনিম্ন জনসংখ্যা)`, en: `${r} (Least populous)` }
                  : { bn: `${bnOrdinal(r)} স্থান`, en: `Rank #${r}` }
              );
            pushQ(
              buildQuestion(
                nextId('u-pop-rank'),
                1,
                'heritage_facts',
                `জনসংখ্যার দিক থেকে ${parentDist.bnName} জেলার ${formatNum(distUpazilas.length, 'bn')}টি ইউনিটের মধ্যে ${uLabelBn}-এর অবস্থান কততম?`,
                `Where does ${uLabelEn} rank by population among the ${distUpazilas.length} units of ${parentDist.name} District?`,
                popRankLabel,
                popRankDistractors,
                `${uLabelBn} (~${formatNum(uPop, 'bn')} জন) জনসংখ্যায় ${parentDist.bnName} জেলায় ${popRankLabel.bn}।`,
                `${uLabelEn} (~${uPop.toLocaleString()}) ranks ${popRankLabel.en} in ${parentDist.name} District.`
              )
            );
          }
        }

        // 5D. Area, Population, Density Brackets & District Share strictly for u
        const areaBrackets: { match: boolean; bn: string; en: string }[] = [
          { match: u.areaKm2 < 100, bn: '১০০ বর্গ কিমি-র কম', en: 'Under 100 km²' },
          { match: u.areaKm2 >= 100 && u.areaKm2 < 250, bn: '১০০ থেকে ২৪৯ বর্গ কিমি', en: '100 to 249 km²' },
          { match: u.areaKm2 >= 250 && u.areaKm2 < 400, bn: '২৫০ থেকে ৩৯৯ বর্গ কিমি', en: '250 to 399 km²' },
          { match: u.areaKm2 >= 400, bn: '৪০০ বর্গ কিমি বা তার বেশি', en: '400 km² or more' },
        ];
        const matchedAreaBr = areaBrackets.find((b) => b.match) || areaBrackets[1];
        pushQ(
          buildQuestion(
            nextId('u-area-br'),
            1,
            'geography_borders',
            `আয়তনের পরিমাপ অনুযায়ী ${uLabelBn} নিচের কোন পরিসরের অন্তর্ভুক্ত?`,
            `Which area size range applies to ${uLabelEn}?`,
            { bn: matchedAreaBr.bn, en: matchedAreaBr.en },
            areaBrackets.filter((b) => b.en !== matchedAreaBr.en).map((b) => ({ bn: b.bn, en: b.en })),
            `${uLabelBn}-এর আয়তন প্রায় ${formatNum(u.areaKm2, 'bn')} বর্গ কিমি, যা ‘${matchedAreaBr.bn}’ পরিসরে পড়ে।`,
            `${uLabelEn} covers ~${u.areaKm2} km², falling in the ${matchedAreaBr.en.toLowerCase()} range.`
          )
        );

        if (uPop > 0) {
          const popBrackets: { match: boolean; bn: string; en: string }[] = [
            { match: uPop < 200000, bn: '২ লাখের কম', en: 'Under 200,000' },
            { match: uPop >= 200000 && uPop < 350000, bn: '২ লাখ থেকে ৩.৫ লাখের কম', en: '200,000 to 349,999' },
            { match: uPop >= 350000 && uPop < 500000, bn: '৩.৫ লাখ থেকে ৫ লাখের কম', en: '350,000 to 499,999' },
            { match: uPop >= 500000, bn: '৫ লাখ বা তার বেশি', en: '500,000 or more' },
          ];
          const matchedPopBr = popBrackets.find((b) => b.match) || popBrackets[1];
          pushQ(
            buildQuestion(
              nextId('u-pop-br'),
              1,
              'heritage_facts',
              `২০২২ সালের জনশুমারি অনুযায়ী ${uLabelBn}-এর জনসংখ্যা কোন সীমার মধ্যে রয়েছে?`,
              `Which 2022 census population bracket does ${uLabelEn} fall into?`,
              { bn: matchedPopBr.bn, en: matchedPopBr.en },
              popBrackets.filter((b) => b.en !== matchedPopBr.en).map((b) => ({ bn: b.bn, en: b.en })),
              `${uLabelBn}-এর জনসংখ্যা প্রায় ${formatNum(uPop, 'bn')} জন (${matchedPopBr.bn})।`,
              `${uLabelEn} has ~${uPop.toLocaleString()} residents (${matchedPopBr.en}).`
            )
          );

          const uDens = u.areaKm2 > 0 ? Math.round(uPop / u.areaKm2) : 0;
          if (uDens > 0) {
            const densBrackets: { match: boolean; bn: string; en: string }[] = [
              { match: uDens < 600, bn: '৬০০ জন/কিমি²-এর কম', en: 'Under 600 /km²' },
              { match: uDens >= 600 && uDens < 1200, bn: '৬০০ থেকে ১,১৯৯ জন/কিমি²', en: '600 to 1,199 /km²' },
              { match: uDens >= 1200 && uDens < 2500, bn: '১,২০০ থেকে ২,৪৯৯ জন/কিমি²', en: '1,200 to 2,499 /km²' },
              { match: uDens >= 2500, bn: '২,৫০০ জন/কিমি² বা তার বেশি', en: '2,500 /km² or more' },
            ];
            const matchedDensBr = densBrackets.find((b) => b.match) || densBrackets[1];
            pushQ(
              buildQuestion(
                nextId('u-dens-br'),
                1,
                'heritage_facts',
                `জনঘনত্বের বিচারে ${uLabelBn} কোন স্তরের অন্তর্ভুক্ত?`,
                `Which population density tier describes ${uLabelEn}?`,
                { bn: matchedDensBr.bn, en: matchedDensBr.en },
                densBrackets.filter((b) => b.en !== matchedDensBr.en).map((b) => ({ bn: b.bn, en: b.en })),
                `${uLabelBn}-এ জনঘনত্ব প্রায় ${formatNum(uDens, 'bn')} জন/কিমি² (${matchedDensBr.bn})।`,
                `${uLabelEn} has a density of ~${uDens.toLocaleString()} /km² (${matchedDensBr.en}).`
              )
            );
          }
        }

        if (distMeta && distMeta.areaKm2 > 0) {
          const areaSharePct = Math.max(1, Math.min(99, Math.round((u.areaKm2 / distMeta.areaKm2) * 100)));
          const shareCandidates = [
            areaSharePct + 14,
            areaSharePct + 27,
            areaSharePct > 16 ? areaSharePct - 12 : areaSharePct + 39,
            areaSharePct > 28 ? areaSharePct - 24 : areaSharePct + 48,
          ].filter((v) => v > 0 && v <= 99 && v !== areaSharePct);
          pushQ(
            buildQuestion(
              nextId('u-dshare-a'),
              1,
              'geography_borders',
              `${parentDist.bnName} জেলার মোট আয়তনের প্রায় কত শতাংশ জুড়ে ${uLabelBn} অবস্থিত?`,
              `Approximately what percentage of ${parentDist.name} District’s area does ${uLabelEn} occupy?`,
              { bn: `প্রায় ${formatNum(areaSharePct, 'bn')}%`, en: `~${areaSharePct}%` },
              shareCandidates.map((v) => ({ bn: `প্রায় ${formatNum(v, 'bn')}%`, en: `~${v}%` })),
              `${uLabelBn} (${formatNum(u.areaKm2, 'bn')} কিমি²) ${parentDist.bnName} জেলার মোট আয়তনের প্রায় ${formatNum(areaSharePct, 'bn')}%।`,
              `${uLabelEn} (${u.areaKm2} km²) accounts for roughly ${areaSharePct}% of ${parentDist.name} District.`
            )
          );
        }

        if (uPop > 0 && distMeta && distMeta.population > 0) {
          const popSharePct = Math.max(1, Math.min(99, Math.round((uPop / distMeta.population) * 100)));
          const popShareCandidates = [
            popSharePct + 13,
            popSharePct + 25,
            popSharePct > 15 ? popSharePct - 11 : popSharePct + 36,
            popSharePct > 26 ? popSharePct - 21 : popSharePct + 47,
          ].filter((v) => v > 0 && v <= 99 && v !== popSharePct);
          pushQ(
            buildQuestion(
              nextId('u-dshare-p'),
              1,
              'heritage_facts',
              `${parentDist.bnName} জেলার মোট জনসংখ্যার প্রায় কত শতাংশ ${uLabelBn}-এ বসবাস করে?`,
              `Approximately what share of ${parentDist.name} District’s population resides in ${uLabelEn}?`,
              { bn: `প্রায় ${formatNum(popSharePct, 'bn')}%`, en: `~${popSharePct}%` },
              popShareCandidates.map((v) => ({ bn: `প্রায় ${formatNum(v, 'bn')}%`, en: `~${v}%` })),
              `${uLabelBn}-এ ${parentDist.bnName} জেলার মোট জনসংখ্যার প্রায় ${formatNum(popSharePct, 'bn')}% মানুষের বসবাস।`,
              `${uLabelEn} holds about ${popSharePct}% of ${parentDist.name} District’s population.`
            )
          );
        }

        // 6. Direct Administrative & Geographic Identity Questions (All 544 Upazilas)
        const isSadarUnit = u.name.toLowerCase().includes('sadar') || u.bnName.includes('সদর');
        pushQ(
          buildQuestion(
            nextId('u-sadar'),
            1,
            'heritage_facts',
            `প্রশাসনিক নাম ও মর্যাদা অনুযায়ী ${uLabelBn} কি ‘${parentDist.bnName} সদর’ হিসেবে পরিচিত?`,
            `Is ${uLabelEn} designated as ${parentDist.name} Sadar?`,
            isSadarUnit
              ? { bn: `হ্যাঁ, এটি ${parentDist.bnName} সদর এলাকা`, en: `Yes, it is ${parentDist.name} Sadar` }
              : { bn: `না, এটি সদর নয় — জেলার অন্য একটি ইউনিট`, en: `No, it is a non-Sadar unit in ${parentDist.name}` },
            [
              isSadarUnit
                ? { bn: `না, এটি সদর নয় — জেলার অন্য একটি ইউনিট`, en: `No, it is a non-Sadar unit in ${parentDist.name}` }
                : { bn: `হ্যাঁ, এটি ${parentDist.bnName} সদর এলাকা`, en: `Yes, it is ${parentDist.name} Sadar` },
              { bn: `এটি বাংলাদেশের কোনো জেলাতেই অবস্থিত নয়`, en: `It is not located in any district of Bangladesh` },
              { bn: `এটি একটি স্বতন্ত্র বিভাগীয় সদর দপ্তর মাত্র`, en: `It is exclusively a divisional border outpost` },
            ],
            isSadarUnit
              ? `${uLabelBn} ${parentDist.bnName} জেলার সদর প্রশাসনিক এলাকা।`
              : `${uLabelBn} ${parentDist.bnName} জেলার একটি আলাদা উপজেলা/থানা (সদর নয়)।`,
            isSadarUnit
              ? `${uLabelEn} serves as ${parentDist.name} Sadar.`
              : `${uLabelEn} is a non-Sadar administrative unit in ${parentDist.name} District.`
          )
        );

        pushQ(
          buildQuestion(
            nextId('u-admin-unit'),
            1,
            'heritage_facts',
            `প্রশাসনিক কাঠামো অনুযায়ী ${u.bnName} নিচের কোন ধরনের এলাকা?`,
            `Administratively, what type of local unit is ${u.name}?`,
            uDetail.isUrbanThana
              ? { bn: 'মহানগর থানা এলাকা', en: 'Metropolitan City Thana' }
              : { bn: 'উপজেলা প্রশাসনিক এলাকা', en: 'Upazila Administrative Unit' },
            [
              uDetail.isUrbanThana
                ? { bn: 'উপজেলা প্রশাসনিক এলাকা', en: 'Upazila Administrative Unit' }
                : { bn: 'মহানগর থানা এলাকা', en: 'Metropolitan City Thana' },
              { bn: 'বিভাগীয় সদর দপ্তর মাত্র', en: 'Divisional Headquarters Only' },
              { bn: 'স্বতন্ত্র জেলা', en: 'Independent District' },
            ],
            `${u.bnName} ${parentDist.bnName} জেলার একটি ${uDetail.isUrbanThana ? 'মহানগর থানা' : 'উপজেলা'}।`,
            `${u.name} is a ${uDetail.isUrbanThana ? 'metropolitan thana' : 'upazila'} under ${parentDist.name} District.`
          )
        );

        const terrainBn = uDetail.isUrbanThana
          ? 'মহানগর থানা এলাকা'
          : uDetail.isHill
          ? 'পার্বত্য ও পাহাড়ি অঞ্চল'
          : uDetail.isHaor
          ? 'হাওর ও বিল বেষ্টিত অঞ্চল'
          : uDetail.isCoastal
          ? 'উপকূলীয় ব-দ্বীপ অঞ্চল'
          : 'নদীবিধৌত সমভূমি ও কৃষি অঞ্চল';
        const terrainEn = uDetail.isUrbanThana
          ? 'Metropolitan urban thana'
          : uDetail.isHill
          ? 'Hill-tract forested region'
          : uDetail.isHaor
          ? 'Seasonal haor wetland basin'
          : uDetail.isCoastal
          ? 'Coastal deltaic estuary zone'
          : 'Riverine alluvial plain & agricultural zone';
        const terrainOptions: OptionPair[] = [
          { bn: 'মহানগর থানা এলাকা', en: 'Metropolitan urban thana' },
          { bn: 'পার্বত্য ও পাহাড়ি অঞ্চল', en: 'Hill-tract forested region' },
          { bn: 'হাওর ও বিল বেষ্টিত অঞ্চল', en: 'Seasonal haor wetland basin' },
          { bn: 'উপকূলীয় ব-দ্বীপ অঞ্চল', en: 'Coastal deltaic estuary zone' },
          { bn: 'নদীবিধৌত সমভূমি ও কৃষি অঞ্চল', en: 'Riverine alluvial plain & agricultural zone' },
        ].filter((o) => o.en !== terrainEn);
        pushQ(
          buildQuestion(
            nextId('u-terrain'),
            1,
            'heritage_facts',
            `ভৌগোলিক ও প্রাকৃতিক বৈশিষ্ট্যের দিক থেকে ${uLabelBn} কোন ধরনের অঞ্চল?`,
            `How is ${uLabelEn} classified geographically?`,
            { bn: terrainBn, en: terrainEn },
            terrainOptions,
            `${uLabelBn} (${parentDist.bnName} জেলা) একটি ${terrainBn}।`,
            `${uLabelEn} (${parentDist.name} District) is a ${terrainEn.toLowerCase()}.`
          )
        );

        pushQ(
          buildQuestion(
            nextId('u-coastal-flag'),
            1,
            'geography_borders',
            `ভৌগোলিক অবস্থান অনুযায়ী ${uLabelBn} কি বাংলাদেশের উপকূলীয় অঞ্চলের অন্তর্ভুক্ত?`,
            `Geographically, is ${uLabelEn} part of Bangladesh’s coastal belt?`,
            uDetail.isCoastal
              ? { bn: 'হ্যাঁ, এটি উপকূলীয় অঞ্চলের অন্তর্ভুক্ত', en: 'Yes, it lies in the coastal region' }
              : { bn: 'না, এটি অভ্যন্তরীণ বা পার্বত্য/নগর অঞ্চল', en: 'No, it is an inland, hill, or urban area' },
            [
              uDetail.isCoastal
                ? { bn: 'না, এটি অভ্যন্তরীণ বা পার্বত্য/নগর অঞ্চল', en: 'No, it is an inland, hill, or urban area' }
                : { bn: 'হ্যাঁ, এটি উপকূলীয় অঞ্চলের অন্তর্ভুক্ত', en: 'Yes, it lies in the coastal region' },
              { bn: 'হ্যাঁ, এটি বাংলাদেশের উত্তর-পশ্চিম তিস্তা-বরেন্দ্র উপকূল', en: 'Yes, on the northwestern Barind coast' },
              { bn: 'হ্যাঁ, এটি পার্বত্য হিমালয় উপকূলীয় অঞ্চল', en: 'Yes, on a Himalayan alpine coast' },
            ],
            uDetail.isCoastal
              ? `${uLabelBn} (${parentDist.bnName} জেলা) বাংলাদেশের উপকূলীয় ব-দ্বীপ অঞ্চলের অন্তর্ভুক্ত।`
              : `${uLabelBn} উপকূলীয় এলাকা নয়।`,
            uDetail.isCoastal
              ? `${uLabelEn} lies inside Bangladesh’s coastal zone.`
              : `${uLabelEn} is not part of Bangladesh’s coastal zone.`
          )
        );

        pushQ(
          buildQuestion(
            nextId('u-hill-flag'),
            1,
            'geography_borders',
            `পার্বত্য ও পাহাড়ি ভূ-প্রকৃতি বিচারে ${uLabelBn} সম্পর্কে নিচের কোন তথ্যটি সঠিক?`,
            `Which statement accurately describes hill-tract geography for ${uLabelEn}?`,
            uDetail.isHill
              ? { bn: 'হ্যাঁ, এটি পার্বত্য ও পাহাড়ি ভূ-প্রকৃতির অঞ্চল', en: 'Yes, it is a hill-tract forested region' }
              : { bn: 'না, এটি পার্বত্য জেলাভুক্ত পাহাড়ি অঞ্চল নয়', en: 'No, it is not in a hill-tract mountainous belt' },
            [
              uDetail.isHill
                ? { bn: 'না, এটি পার্বত্য জেলাভুক্ত পাহাড়ি অঞ্চল নয়', en: 'No, it is not in a hill-tract mountainous belt' }
                : { bn: 'হ্যাঁ, এটি পার্বত্য ও পাহাড়ি ভূ-প্রকৃতির অঞ্চল', en: 'Yes, it is a hill-tract forested region' },
              { bn: 'এটি সুন্দরবনের গহীন ম্যানগ্রোভ বনাঞ্চলের দ্বীপ', en: 'It is a deep Sundarbans mangrove island only' },
              { bn: 'এটি বাংলাদেশের একমাত্র বরফাবৃত শৃঙ্গ', en: 'It is Bangladesh’s sole snow-capped summit' },
            ],
            uDetail.isHill
              ? `${uLabelBn} পার্বত্য ও পাহাড়ি ভূ-প্রকৃতির অঞ্চল।`
              : `${uLabelBn} পার্বত্য ভূ-প্রকৃতির অঞ্চল নয়।`,
            uDetail.isHill
              ? `${uLabelEn} features hill-tract terrain.`
              : `${uLabelEn} is not a hill-tract zone.`
          )
        );

        pushQ(
          buildQuestion(
            nextId('u-haor-flag'),
            1,
            'heritage_facts',
            `জলাভূমি ও হাওর প্রকৃতি বিবেচনায় ${uLabelBn} সম্পর্কে কোনটি সঠিক?`,
            `Which statement fits ${uLabelEn} regarding haor wetland geography?`,
            uDetail.isHaor
              ? { bn: 'হ্যাঁ, এটি বৃহত্তর হাওর ও বিল অববাহিকার অংশ', en: 'Yes, it lies within the seasonal haor wetland basin' }
              : { bn: 'না, এটি মূল হাওর অববাহিকার এলাকা নয়', en: 'No, it is outside the core haor wetland basin' },
            [
              uDetail.isHaor
                ? { bn: 'না, এটি মূল হাওর অববাহিকার এলাকা নয়', en: 'No, it is outside the core haor wetland basin' }
                : { bn: 'হ্যাঁ, এটি বৃহত্তর হাওর ও বিল অববাহিকার অংশ', en: 'Yes, it lies within the seasonal haor wetland basin' },
              { bn: 'এটি শুষ্ক বালুকাময় মরুভূমি এলাকা', en: 'It is an arid sandy desert basin' },
              { bn: 'এটি বাংলাদেশের একমাত্র আগ্নেয়গিরি অঞ্চল', en: 'It is Bangladesh’s volcanic crater zone' },
            ],
            uDetail.isHaor
              ? `${uLabelBn} হাওর ও বিল বেষ্টিত অঞ্চল।`
              : `${uLabelBn} মূল হাওর অববাহিকার অন্তর্ভুক্ত নয়।`,
            uDetail.isHaor
              ? `${uLabelEn} lies inside the haor basin.`
              : `${uLabelEn} is outside the core haor wetland basin.`
          )
        );

        const islandNamesBn = ['হাতিয়া', 'সন্দ্বীপ', 'কুতুবদিয়া', 'মহেশখালী', 'মনপুরা', 'ভোলা সদর', 'দৌলতখান', 'বোরহানউদ্দিন', 'তজুমদ্দিন', 'লালমোহন', 'চরফ্যাশন'];
        const isIslandUnit = islandNamesBn.some((nm) => u.bnName.includes(nm));
        pushQ(
          buildQuestion(
            nextId('u-island-flag'),
            1,
            'geography_borders',
            `দ্বীপ-বৈশিষ্ট্য অনুযায়ী ${uLabelBn} সম্পর্কে কোন বিবৃতিটি সঠিক?`,
            `Which statement describes ${uLabelEn}’s island geography?`,
            isIslandUnit
              ? { bn: 'হ্যাঁ, এটি বঙ্গোপসাগর বা মেঘনা মোহনার দ্বীপাঞ্চল', en: 'Yes, it is a coastal or estuary island territory' }
              : { bn: 'না, এটি মূলত মূল ভূখণ্ড বা স্থলসংযুক্ত এলাকা', en: 'No, it is part of the contiguous mainland' },
            [
              isIslandUnit
                ? { bn: 'না, এটি মূলত মূল ভূখণ্ড বা স্থলসংযুক্ত এলাকা', en: 'No, it is part of the contiguous mainland' }
                : { bn: 'হ্যাঁ, এটি বঙ্গোপসাগর বা মেঘনা মোহনার দ্বীপাঞ্চল', en: 'Yes, it is a coastal or estuary island territory' },
              { bn: 'এটি বঙ্গোপসাগরের গভীর সমুদ্রের আন্তর্জাতিক ভূখণ্ড', en: 'It is an international deep-sea territory outside Bangladesh' },
              { bn: 'এটি ভারত মহাসাগরের একটি স্বাধীন দ্বীপরাষ্ট্র', en: 'It is an independent Indian Ocean island nation' },
            ],
            isIslandUnit
              ? `${uLabelBn} বঙ্গোপসাগর বা মেঘনা মোহনার একটি দ্বীপাঞ্চল।`
              : `${uLabelBn} মূলত মূল ভূখণ্ড বা স্থলসংযুক্ত এলাকা।`,
            isIslandUnit
              ? `${uLabelEn} is an island territory.`
              : `${uLabelEn} is on the contiguous mainland.`
          )
        );

        // 7. Strictly Direct Density Rank, District-Average Comparisons & Boundary Profile of u
        const uNbrSet = new Set(u.neighbors);
        const uNbrs = u.neighbors
          .map((uid) => upazilaMap.get(uid))
          .filter((nu): nu is GeoUpazila => Boolean(nu));

        if (uPop > 0 && u.areaKm2 > 0 && distUpazilas.length >= 2) {
          const sibDens = distUpazilas
            .filter((s) => (s.population || 0) > 0 && s.areaKm2 > 0)
            .map((s) => ({ s, dens: Math.round((s.population || 0) / s.areaKm2) }))
            .sort((a, b) => b.dens - a.dens);
          const densRank = sibDens.findIndex((x) => x.s.id === u.id) + 1;
          if (densRank > 0) {
            const densRankLabel: OptionPair =
              densRank === 1
                ? { bn: '১ম (জেলার সর্বাধিক জনঘনত্বপূর্ণ)', en: '1st (Densest in district)' }
                : densRank === sibDens.length
                ? { bn: `${bnOrdinal(densRank)} (জেলার সর্বনিম্ন জনঘনত্ব)`, en: `${densRank} (Least dense in district)` }
                : { bn: `${bnOrdinal(densRank)} স্থান`, en: `Rank #${densRank}` };
            const densMaxOpt = Math.max(4, sibDens.length);
            const densRankDistractors: OptionPair[] = Array.from(
              { length: densMaxOpt },
              (_, idx) => idx + 1
            )
              .filter((r) => r !== densRank)
              .map((r) =>
                r === 1
                  ? { bn: '১ম (জেলার সর্বাধিক জনঘনত্বপূর্ণ)', en: '1st (Densest in district)' }
                  : r === sibDens.length
                  ? { bn: `${bnOrdinal(r)} (জেলার সর্বনিম্ন জনঘনত্ব)`, en: `${r} (Least dense in district)` }
                  : { bn: `${bnOrdinal(r)} স্থান`, en: `Rank #${r}` }
              );
            pushQ(
              buildQuestion(
                nextId('u-dens-rank'),
                1,
                'heritage_facts',
                `জনঘনত্বের দিক থেকে ${parentDist.bnName} জেলার ${formatNum(sibDens.length, 'bn')}টি ইউনিটের মধ্যে ${uLabelBn}-এর অবস্থান কততম?`,
                `Where does ${uLabelEn} rank by population density inside ${parentDist.name} District?`,
                densRankLabel,
                densRankDistractors,
                `${uLabelBn} জনঘনত্বে ${parentDist.bnName} জেলায় ${densRankLabel.bn}।`,
                `${uLabelEn} ranks ${densRankLabel.en} by density in ${parentDist.name} District.`
              )
            );
          }
        }

        if (distMeta && distUpazilas.length >= 2) {
          const avgArea = distMeta.areaKm2 / distUpazilas.length;
          const areaRatio = u.areaKm2 / Math.max(1, avgArea);
          const areaVsAvgAns: OptionPair =
            areaRatio >= 1.15
              ? { bn: 'জেলার গড় ইউনিট আয়তনের চেয়ে বড়', en: 'Larger than the district average' }
              : areaRatio <= 0.85
              ? { bn: 'জেলার গড় ইউনিট আয়তনের চেয়ে ছোট', en: 'Smaller than the district average' }
              : { bn: 'জেলার গড় ইউনিট আয়তনের প্রায় সমান', en: 'Close to the district average' };
          pushQ(
            buildQuestion(
              nextId('u-area-avg'),
              1,
              'geography_borders',
              `${parentDist.bnName} জেলার গড় উপজেলা/থানা আয়তনের (~${formatNum(Math.round(avgArea), 'bn')} কিমি²) তুলনায় ${uLabelBn}-এর আয়তন কেমন?`,
              `How does ${uLabelEn}’s area compare to ${parentDist.name} District’s average (~${Math.round(avgArea)} km²)?`,
              areaVsAvgAns,
              [
                { bn: 'জেলার গড় ইউনিট আয়তনের চেয়ে বড়', en: 'Larger than the district average' },
                { bn: 'জেলার গড় ইউনিট আয়তনের চেয়ে ছোট', en: 'Smaller than the district average' },
                { bn: 'জেলার গড় ইউনিট আয়তনের প্রায় সমান', en: 'Close to the district average' },
                { bn: 'সমগ্র জেলার মোট আয়তনের সমান (১০০%)', en: 'Equal to the entire district area (100%)' },
              ],
              `${uLabelBn}-এর আয়তন প্রায় ${formatNum(u.areaKm2, 'bn')} কিমি², যেখানে জেলার গড় প্রায় ${formatNum(Math.round(avgArea), 'bn')} কিমি²।`,
              `${uLabelEn} is ~${u.areaKm2} km² compared to the ${parentDist.name} unit average of ~${Math.round(avgArea)} km².`
            )
          );

          if (uPop > 0 && distMeta.population > 0) {
            const avgPop = distMeta.population / distUpazilas.length;
            const popRatio = uPop / Math.max(1, avgPop);
            const popVsAvgAns: OptionPair =
              popRatio >= 1.15
                ? { bn: 'জেলার গড় ইউনিট জনসংখ্যার চেয়ে বেশি', en: 'Above the district unit average' }
                : popRatio <= 0.85
                ? { bn: 'জেলার গড় ইউনিট জনসংখ্যার চেয়ে কম', en: 'Below the district unit average' }
                : { bn: 'জেলার গড় ইউনিট জনসংখ্যার কাছাকাছি', en: 'Near the district unit average' };
            pushQ(
              buildQuestion(
                nextId('u-pop-avg'),
                1,
                'heritage_facts',
                `${parentDist.bnName} জেলার গড় উপজেলা/থানা জনসংখ্যার তুলনায় ${uLabelBn}-এর জনসংখ্যা কেমন?`,
                `How does ${uLabelEn}’s population compare to ${parentDist.name} District’s unit average?`,
                popVsAvgAns,
                [
                  { bn: 'জেলার গড় ইউনিট জনসংখ্যার চেয়ে বেশি', en: 'Above the district unit average' },
                  { bn: 'জেলার গড় ইউনিট জনসংখ্যার চেয়ে কম', en: 'Below the district unit average' },
                  { bn: 'জেলার গড় ইউনিট জনসংখ্যার কাছাকাছি', en: 'Near the district unit average' },
                  { bn: 'সমগ্র জেলার জনসংখ্যার সমান (১০০%)', en: 'Equal to 100% of the district population' },
                ],
                `${uLabelBn}-এর জনসংখ্যা প্রায় ${formatNum(uPop, 'bn')} জন, আর জেলার গড় প্রায় ${formatNum(Math.round(avgPop), 'bn')} জন।`,
                `${uLabelEn} has ~${uPop.toLocaleString()} residents vs a district unit average of ~${Math.round(avgPop).toLocaleString()}.`
              )
            );
          }
        }

        // 8. Direct Neighbor Count & Cross-District/Cross-Division Border Check of u
        pushQ(
          buildQuestion(
            nextId('u-nbrcnt'),
            1,
            'geography_borders',
            `${uLabelBn}-এর সীমান্তে সরাসরি পার্শ্ববর্তী কয়টি উপজেলা বা থানা রয়েছে?`,
            `How many bordering upazilas or thanas surround ${uLabelEn}?`,
            { bn: `${formatNum(uNbrs.length, 'bn')}টি`, en: `${uNbrs.length}` },
            [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
              .filter((n) => n !== uNbrs.length)
              .map((n) => ({ bn: `${formatNum(n, 'bn')}টি`, en: `${n}` })),
            `${uLabelBn}-এর স্থলসীমান্তে ${formatNum(uNbrs.length, 'bn')}টি পার্শ্ববর্তী উপজেলা/থানা রয়েছে।`,
            `${uLabelEn} borders ${uNbrs.length} adjacent upazilas/thanas.`
          )
        );

        const crossDistNbrs = uNbrs.filter((x) => x.districtId !== u.districtId);
        const extDistIds = Array.from(new Set(crossDistNbrs.map((x) => x.districtId)));

        pushQ(
          buildQuestion(
            nextId('u-ext-dcnt'),
            1,
            'geography_borders',
            `নিজ জেলা (${parentDist.bnName}) ছাড়া ${uLabelBn}-এর সীমান্ত অন্য কয়টি জেলাকে স্পর্শ করেছে?`,
            `Apart from ${parentDist.name} District, how many other districts border ${uLabelEn}?`,
            extDistIds.length === 0
              ? { bn: '০টি (অন্য কোনো জেলার সাথে সীমান্ত নেই)', en: '0 (no external district borders)' }
              : { bn: `${formatNum(extDistIds.length, 'bn')}টি জেলা`, en: `${extDistIds.length} district(s)` },
            [
              ...(extDistIds.length > 0
                ? [{ bn: '০টি (অন্য কোনো জেলার সাথে সীমান্ত নেই)', en: '0 (no external district borders)' }]
                : []),
              ...[1, 2, 3, 4, 5]
                .filter((n) => n !== extDistIds.length)
                .map((n) => ({ bn: `${formatNum(n, 'bn')}টি জেলা`, en: `${n} district(s)` })),
            ],
            extDistIds.length === 0
              ? `${uLabelBn}-এর সীমান্ত নিজ জেলা ${parentDist.bnName}-এর বাইরের কোনো জেলাকে স্পর্শ করেনি।`
              : `${uLabelBn} নিজ জেলা ছাড়াও ${formatNum(extDistIds.length, 'bn')}টি ভিন্ন জেলার (${extDistIds
                  .map((id) => distMap.get(id)?.bnName || '')
                  .join(', ')}) সাথে সীমান্ত স্পর্শ করেছে।`,
            extDistIds.length === 0
              ? `${uLabelEn} does not border any external district outside ${parentDist.name}.`
              : `${uLabelEn} touches ${extDistIds.length} external district(s) (${extDistIds
                  .map((id) => distMap.get(id)?.name || '')
                  .join(', ')}).`
          )
        );

        const crossDivIds = Array.from(
          new Set(uNbrs.filter((x) => x.divisionId !== u.divisionId).map((x) => x.divisionId))
        );
        pushQ(
          buildQuestion(
            nextId('u-cross-div-chk'),
            1,
            'geography_borders',
            `${uLabelBn}-এর সীমান্ত নিজ বিভাগ (${parentDiv.bnName}) ছাড়া ভিন্ন কয়টি বিভাগকে স্পর্শ করেছে?`,
            `How many external divisions outside ${parentDiv.name} does ${uLabelEn} directly border?`,
            crossDivIds.length === 0
              ? { bn: '০টি (কোনো ভিন্ন বিভাগের সাথে সীমান্ত নেই)', en: '0 (none outside own division)' }
              : { bn: `${formatNum(crossDivIds.length, 'bn')}টি ভিন্ন বিভাগ`, en: `${crossDivIds.length} external division(s)` },
            [
              ...(crossDivIds.length > 0
                ? [{ bn: '০টি (কোনো ভিন্ন বিভাগের সাথে সীমান্ত নেই)', en: '0 (none outside own division)' }]
                : []),
              ...[1, 2, 3, 4]
                .filter((n) => n !== crossDivIds.length)
                .map((n) => ({ bn: `${formatNum(n, 'bn')}টি ভিন্ন বিভাগ`, en: `${n} external division(s)` })),
            ],
            crossDivIds.length === 0
              ? `${uLabelBn}-এর সীমান্ত ${parentDiv.bnName} বিভাগের বাইরের কোনো বিভাগকে স্পর্শ করেনি।`
              : `${uLabelBn} নিজ বিভাগ ${parentDiv.bnName} ছাড়াও ${formatNum(crossDivIds.length, 'bn')}টি ভিন্ন বিভাগের সীমানা স্পর্শ করেছে।`,
            crossDivIds.length === 0
              ? `${uLabelEn} does not touch any division outside ${parentDiv.name}.`
              : `${uLabelEn} borders ${crossDivIds.length} external division(s) outside ${parentDiv.name}.`
          )
        );

        // 9. Direct Bordering & Non-Bordering Upazilas + Directional Neighbors of u
        const nonUNbrs = upazilas.filter((ou) => ou.id !== u.id && !uNbrSet.has(ou.id));
        const nearbyNonNbrs = distUpazilas.filter((du) => du.id !== u.id && !uNbrSet.has(du.id));
        const distractorPool = nearbyNonNbrs.length >= 3 ? [...nearbyNonNbrs, ...nonUNbrs] : nonUNbrs;
        const nbrPromptsBn = [
          `নিচের কোনটি ${uLabelBn}-এর সরাসরি সীমান্তবর্তী (পার্শ্ববর্তী)?`,
          `মানচিত্রে ${uLabelBn}-এর সীমান্তের সাথে সরাসরি যুক্ত এলাকা কোনটি?`,
          `${uLabelBn}-এর স্থলসীমান্ত স্পর্শ করেছে নিচের কোন উপজেলা বা থানা?`,
          `নিচের কোন প্রশাসনিক ইউনিটের সাথে ${uLabelBn}-এর সরাসরি সীমানা রয়েছে?`,
        ];
        const nbrPromptsEn = [
          `Which of the following directly borders ${uLabelEn}?`,
          `On the map, which adjacent unit shares a direct border with ${uLabelEn}?`,
          `Which upazila or thana touches the boundary of ${uLabelEn}?`,
          `Which neighboring administrative unit shares a boundary line with ${uLabelEn}?`,
        ];
        shuffleArray(uNbrs)
          .slice(0, 4)
          .forEach((nu, idx) => {
            pushQ(
              buildQuestion(
                nextId('u-nbr'),
                1,
                'geography_borders',
                nbrPromptsBn[idx % nbrPromptsBn.length],
                nbrPromptsEn[idx % nbrPromptsEn.length],
                { bn: nu.bnName, en: nu.name },
                distractorPool.map((ou) => ({ bn: ou.bnName, en: ou.name })),
                `${nu.bnName} সরাসরি ${u.bnName}-এর সাথে সীমান্ত ভাগ করেছে।`,
                `${nu.name} directly borders ${u.name}.`
              )
            );
          });

        if (uNbrs.length > 0 && nonUNbrs.length >= 3) {
          const northNbr = [...uNbrs].filter((nu) => nu.cy < u.cy - 2).sort((a, b) => a.cy - b.cy)[0];
          const southNbr = [...uNbrs].filter((nu) => nu.cy > u.cy + 2).sort((a, b) => b.cy - a.cy)[0];
          const eastNbr = [...uNbrs].filter((nu) => nu.cx > u.cx + 2).sort((a, b) => b.cx - a.cx)[0];
          const westNbr = [...uNbrs].filter((nu) => nu.cx < u.cx - 2).sort((a, b) => a.cx - b.cx)[0];
          const dirPairs: { nbr: GeoUpazila | undefined; dirBn: string; dirEn: string; tag: string }[] = [
            { nbr: northNbr, dirBn: 'উত্তর', dirEn: 'northern', tag: 'u-dir-n' },
            { nbr: southNbr, dirBn: 'দক্ষিণ', dirEn: 'southern', tag: 'u-dir-s' },
            { nbr: eastNbr, dirBn: 'পূর্ব', dirEn: 'eastern', tag: 'u-dir-e' },
            { nbr: westNbr, dirBn: 'পশ্চিম', dirEn: 'western', tag: 'u-dir-w' },
          ];
          for (const dp of dirPairs) {
            if (!dp.nbr) continue;
            pushQ(
              buildQuestion(
                nextId(dp.tag),
                1,
                'geography_borders',
                `${uLabelBn}-এর সরাসরি ${dp.dirBn} সীমান্তবর্তী এলাকা নিচের কোনটি?`,
                `Which neighboring unit borders ${uLabelEn} on its ${dp.dirEn} side?`,
                { bn: dp.nbr.bnName, en: dp.nbr.name },
                distractorPool.map((ou) => ({ bn: ou.bnName, en: ou.name })),
                `মানচিত্রে ${dp.nbr.bnName} ${uLabelBn}-এর ${dp.dirBn} সীমান্তে অবস্থিত।`,
                `On the map, ${dp.nbr.name} borders ${uLabelEn} to the ${dp.dirEn === 'northern' ? 'north' : dp.dirEn === 'southern' ? 'south' : dp.dirEn === 'eastern' ? 'east' : 'west'}.`
              )
            );
          }
        }

        if (uNbrs.length >= 3) {
          const nonNbrPool = nearbyNonNbrs.length >= 2 ? nearbyNonNbrs : [...nearbyNonNbrs, ...nonUNbrs];
          shuffleArray(nonNbrPool)
            .slice(0, 2)
            .forEach((pickedNonNbr, idx) => {
              pushQ(
                buildQuestion(
                  nextId('u-non-nbr'),
                  1,
                  'geography_borders',
                  idx === 0
                    ? `নিচের কোন এলাকার সাথে ${uLabelBn}-এর সরাসরি স্থলসীমান্ত নেই?`
                    : `সীমানা বিচারে নিচের কোনটি ${uLabelBn}-এর সরাসরি পার্শ্ববর্তী নয়?`,
                  idx === 0
                    ? `Which of these does NOT share a direct border with ${uLabelEn}?`
                    : `Which of the following is NOT directly adjacent to ${uLabelEn}?`,
                  { bn: pickedNonNbr.bnName, en: pickedNonNbr.name },
                  uNbrs.map((nu) => ({ bn: nu.bnName, en: nu.name })),
                  `${pickedNonNbr.bnName} ${u.bnName}-এর সাথে সরাসরি সীমান্ত সংলগ্ন নয়।`,
                  `${pickedNonNbr.name} does not share a direct border with ${u.name}.`
                )
              );
            });
        }

        // 10. External Districts Directly Bordered by u (strictly about u's own borders)
        if (extDistIds.length > 0) {
          const extDistSet = new Set([parentDist.id, ...extDistIds]);
          const nonBorderDists = districts.filter((d) => !extDistSet.has(d.id));
          extDistIds.slice(0, 2).forEach((edId, idx) => {
            const ed = distMap.get(edId);
            if (!ed) return;
            pushQ(
              buildQuestion(
                nextId('u-ext-d'),
                1,
                'geography_borders',
                idx === 0
                  ? `${parentDist.bnName} জেলা ছাড়াও নিচের কোন ভিন্ন জেলার সাথে ${uLabelBn}-এর সরাসরি সীমান্ত রয়েছে?`
                  : `নিজ জেলা (${parentDist.bnName})-এর বাইরে ${uLabelBn}-এর সীমা নিচের কোন জেলাকে স্পর্শ করেছে?`,
                idx === 0
                  ? `Which external district directly touches ${uLabelEn}?`
                  : `Outside ${parentDist.name}, which district shares a direct boundary with ${uLabelEn}?`,
                { bn: `${ed.bnName} জেলা`, en: `${ed.name} District` },
                nonBorderDists.map((d) => ({ bn: `${d.bnName} জেলা`, en: `${d.name} District` })),
                `${u.bnName} সীমান্তে ${ed.bnName} জেলার সাথে যুক্ত।`,
                `${u.name} directly borders ${ed.name} District.`
              )
            );
          });
        }

        // 11. Curated Landmarks & Heritage strictly of u (never leaking u.bnName in option!)
        const foreignLms: OptionPair[] = [];
        for (const od of shuffleArray(districts.filter((d) => d.id !== parentDist.id)).slice(0, 14)) {
          const odet = DISTRICT_DETAILS[od.id];
          if (!odet) continue;
          odet.landmarksBn.forEach((lm, idx) =>
            foreignLms.push({ bn: lm, en: odet.landmarksEn[idx] })
          );
        }

        if (hasCuratedUpazilaDetail(u.id)) {
          const lmPromptsBn = [
            `${uLabelBn}-এ নিচের কোন উল্লেখযোগ্য স্থান বা ঐতিহ্যটি অবস্থিত?`,
            `ঐতিহাসিক ও দর্শনীয় স্থান হিসেবে ${uLabelBn}-এর অন্তর্গত কোনটি?`,
            `নিচের কোন বিখ্যাত স্থাপনা বা স্থানটি সরাসরি ${uLabelBn}-এ অবস্থিত?`,
          ];
          const lmPromptsEn = [
            `Which notable landmark or heritage site is located in ${uLabelEn}?`,
            `Which landmark belongs specifically to ${uLabelEn}?`,
            `Which famous site is situated directly inside ${uLabelEn}?`,
          ];
          let lmIdx = 0;
          for (let i = 0; i < uDetail.landmarksBn.length; i++) {
            const lmBn = uDetail.landmarksBn[i];
            const lmEn = uDetail.landmarksEn[i];
            if (!lmBn || !lmEn) continue;
            if (lmBn.includes(u.bnName) || lmEn.toLowerCase().includes(u.name.toLowerCase())) {
              continue;
            }
            pushQ(
              buildQuestion(
                nextId('u-cur-lm'),
                1,
                'heritage_facts',
                lmPromptsBn[lmIdx % lmPromptsBn.length],
                lmPromptsEn[lmIdx % lmPromptsEn.length],
                { bn: lmBn, en: lmEn },
                foreignLms,
                `‘${lmBn}’ ${uLabelBn}-এর অন্যতম উল্লেখযোগ্য ঐতিহ্য।`,
                `${lmEn} is a famous landmark in ${uLabelEn}.`
              )
            );
            lmIdx += 1;
            if (lmIdx >= 3) break;
          }

          pushQ(
            buildQuestion(
              nextId('u-cur-fam'),
              1,
              'heritage_facts',
              `${uLabelBn} বিশেষভাবে কিসের জন্য পরিচিত?`,
              `What is ${uLabelEn} especially renowned for?`,
              { bn: uDetail.famousForBn, en: uDetail.famousForEn },
              districts
                .filter((d) => d.id !== parentDist.id && DISTRICT_DETAILS[d.id])
                .map((d) => ({
                  bn: DISTRICT_DETAILS[d.id].famousForBn,
                  en: DISTRICT_DETAILS[d.id].famousForEn,
                })),
              `${uLabelBn}: ${uDetail.famousForBn}।`,
              `${uLabelEn}: ${uDetail.famousForEn}.`
            )
          );

          pushQ(
            buildQuestion(
              nextId('u-cur-spec'),
              1,
              'heritage_facts',
              `${uLabelBn}-এর বিশেষ পণ্য, শিল্প বা কৃষি কোনটি?`,
              `Which specialty product, industry, or agriculture is ${uLabelEn} known for?`,
              { bn: uDetail.specialtiesBn, en: uDetail.specialtiesEn },
              districts
                .filter((d) => d.id !== parentDist.id && DISTRICT_DETAILS[d.id])
                .map((d) => ({
                  bn: DISTRICT_DETAILS[d.id].specialtiesBn,
                  en: DISTRICT_DETAILS[d.id].specialtiesEn,
                })),
              `${uLabelBn}-এর বিশেষ বৈশিষ্ট্য ও পণ্য: ${uDetail.specialtiesBn}।`,
              `${uLabelEn} specialties: ${uDetail.specialtiesEn}.`
            )
          );

          pushQ(
            buildQuestion(
              nextId('u-cur-conn'),
              1,
              'geography_borders',
              `${uLabelBn}-এর প্রধান সড়ক, রেল বা নৌ-যোগাযোগ ব্যবস্থা কোনটি?`,
              `Which main highway, rail, or river route connects ${uLabelEn}?`,
              { bn: uDetail.connectivityBn, en: uDetail.connectivityEn },
              districts
                .filter((d) => d.id !== parentDist.id && DISTRICT_DETAILS[d.id])
                .map((d) => ({
                  bn: DISTRICT_DETAILS[d.id].connectivityBn,
                  en: DISTRICT_DETAILS[d.id].connectivityEn,
                })),
              `${uLabelBn}-এর প্রধান যোগাযোগ: ${uDetail.connectivityBn}।`,
              `${uLabelEn} connectivity: ${uDetail.connectivityEn}.`
            )
          );
        }

        // 12. Rivers flowing directly through Upazila u ONLY (never neighbor rivers or detached river trivia)
        pushQ(
          buildQuestion(
            nextId('u-riv-cnt'),
            1,
            'rivers',
            `মানচিত্রের তালিকাভুক্ত ৩০টি প্রধান নদ-নদীর কতটি সরাসরি ${uLabelBn} অতিক্রম করেছে?`,
            `How many of the 30 mapped major rivers directly pass through ${uLabelEn}?`,
            uRivers.length === 0
              ? { bn: '০টি (আঞ্চলিক নদী বা খাল প্রবাহিত)', en: '0 (local tributaries only)' }
              : { bn: `${formatNum(uRivers.length, 'bn')}টি প্রধান নদী`, en: `${uRivers.length} major river(s)` },
            [
              ...(uRivers.length > 0
                ? [{ bn: '০টি (আঞ্চলিক নদী বা খাল প্রবাহিত)', en: '0 (local tributaries only)' }]
                : []),
              ...[1, 2, 3, 4, 5]
                .filter((n) => n !== uRivers.length)
                .map((n) => ({ bn: `${formatNum(n, 'bn')}টি প্রধান নদী`, en: `${n} major river(s)` })),
            ],
            uRivers.length === 0
              ? `${uLabelBn}-এর মধ্য দিয়ে তালিকাভুক্ত ৩০টি প্রধান নদ-নদীর কোনোটি সরাসরি অতিক্রম করেনি।`
              : `${uLabelBn}-এর ওপর দিয়ে ${formatNum(uRivers.length, 'bn')}টি প্রধান নদী প্রবাহিত হয়েছে।`,
            uRivers.length === 0
              ? `None of the 30 mapped major rivers directly intersect ${uLabelEn}.`
              : `${uRivers.length} mapped major river(s) directly cross ${uLabelEn}.`
          )
        );

        if (uRivers.length > 0) {
          const foreignRivers = rivers.filter((r) => !u.rivers.includes(r.id));
          const uRivPromptsBn = [
            `প্রধান ৩০টি নদ-নদীর মধ্যে নিচের কোন নদীটি সরাসরি ${uLabelBn}-এর ওপর দিয়ে প্রবাহিত?`,
            `মানচিত্র অনুযায়ী ${uLabelBn}-এর ভূখণ্ড অতিক্রম করেছে নিচের কোন প্রধান নদী?`,
            `${uLabelBn}-এর নদী ব্যবস্থার সাথে সরাসরি যুক্ত প্রধান নদী নিচের কোনটি?`,
          ];
          const uRivPromptsEn = [
            `Which of the 30 major rivers flows directly through ${uLabelEn}?`,
            `Which major river directly crosses ${uLabelEn} on the map?`,
            `Which of these mapped rivers runs through ${uLabelEn}?`,
          ];
          uRivers.slice(0, 3).forEach((r, idx) => {
            pushQ(
              buildQuestion(
                nextId('u-riv'),
                1,
                'rivers',
                uRivPromptsBn[idx],
                uRivPromptsEn[idx],
                { bn: `${r.bnName} নদী`, en: `${r.name} River` },
                foreignRivers.map((fr) => ({ bn: `${fr.bnName} নদী`, en: `${fr.name} River` })),
                `${r.bnName} নদী সরাসরি ${uLabelBn}-এর মধ্য দিয়ে প্রবাহিত হয়েছে।`,
                `The ${r.name} River flows directly through ${uLabelEn}.`
              )
            );
          });

          if (uRivers.length >= 3 && foreignRivers.length > 0) {
            const pickedNonRiv = shuffleArray(foreignRivers)[0];
            pushQ(
              buildQuestion(
                nextId('u-riv-not'),
                1,
                'rivers',
                `নিচের কোন প্রধান নদীটি সরাসরি ${uLabelBn}-এর মধ্য দিয়ে প্রবাহিত হয়নি?`,
                `Which of the following major rivers does NOT flow directly through ${uLabelEn}?`,
                { bn: `${pickedNonRiv.bnName} নদী`, en: `${pickedNonRiv.name} River` },
                uRivers.map((r) => ({ bn: `${r.bnName} নদী`, en: `${r.name} River` })),
                `${pickedNonRiv.bnName} নদী ${uLabelBn}-এর মানচিত্রে সরাসরি প্রবাহিত নদীগুলোর অন্তর্ভুক্ত নয়।`,
                `The ${pickedNonRiv.name} River does not directly pass through ${uLabelEn}.`
              )
            );
          }
        } else {
          // 0 mapped major rivers: extra strictly-direct questions about u's non-major river profile & district scale
          pushQ(
            buildQuestion(
              nextId('u-riv-none'),
              1,
              'rivers',
              `নদ-নদী মানচিত্র অনুযায়ী ${uLabelBn} সম্পর্কে নিচের কোন তথ্যটি সঠিক?`,
              `Which statement about ${uLabelEn} matches the 30-river hydrography map?`,
              {
                bn: `তালিকাভুক্ত ৩০টি প্রধান নদ-নদী সরাসরি ${u.bnName} স্পর্শ করেনি`,
                en: `None of the 30 mapped major rivers directly cross ${u.name}`,
              },
              [
                { bn: `পদ্মা ও যমুনা উভয় নদীই ${u.bnName}-এ মিলিত হয়েছে`, en: `Both Padma and Jamuna converge inside ${u.name}` },
                { bn: `সুরমা, কুশিয়ারা ও তিস্তা তিনটিই ${u.bnName}-এর মধ্য দিয়ে প্রবাহিত`, en: `Surma, Kushiyara, and Teesta all cross ${u.name}` },
                { bn: `কর্ণফুলী ও সাংগু নদী ${u.bnName}-এ উৎপন্ন হয়েছে`, en: `Karnaphuli and Sangu originate inside ${u.name}` },
              ],
              `${uLabelBn}-এ প্রধান ৩০টি নদ-নদীর সরাসরি প্রবাহ নেই; স্থানীয় খাল ও উপনদী প্রবাহিত।`,
              `None of the 30 mapped major rivers directly pass through ${uLabelEn}.`
            )
          );
        }

        // 13. Additional strictly-about-u comparative & administrative questions to guarantee >= 30 for EVERY upazila
        const divUpazilaList = upazilas.filter((ou) => ou.divisionId === parentDiv.id);
        const divAreaSorted = [...divUpazilaList].sort((a, b) => b.areaKm2 - a.areaKm2);
        const divAreaTierIdx = divAreaSorted.findIndex((x) => x.id === u.id);
        const divAreaQuartile =
          divAreaTierIdx < divAreaSorted.length * 0.25
            ? { bn: `${parentDiv.bnName} বিভাগের শীর্ষ ২৫% বৃহৎ ইউনিটের একটি`, en: `Top 25% largest units in ${parentDiv.name} Division` }
            : divAreaTierIdx < divAreaSorted.length * 0.5
            ? { bn: `${parentDiv.bnName} বিভাগের দ্বিতীয় চতুর্থাংশের (মাঝারি-বৃহৎ) ইউনিট`, en: `Upper-middle (25–50%) by area in ${parentDiv.name} Division` }
            : divAreaTierIdx < divAreaSorted.length * 0.75
            ? { bn: `${parentDiv.bnName} বিভাগের তৃতীয় চতুর্থাংশের (মাঝারি-ক্ষুদ্র) ইউনিট`, en: `Lower-middle (50–75%) by area in ${parentDiv.name} Division` }
            : { bn: `${parentDiv.bnName} বিভাগের সর্বনিম্ন ২৫% ক্ষুদ্র ইউনিটের একটি`, en: `Smallest 25% by area in ${parentDiv.name} Division` };
        const divQuartileOptions: OptionPair[] = [
          { bn: `${parentDiv.bnName} বিভাগের শীর্ষ ২৫% বৃহৎ ইউনিটের একটি`, en: `Top 25% largest units in ${parentDiv.name} Division` },
          { bn: `${parentDiv.bnName} বিভাগের দ্বিতীয় চতুর্থাংশের (মাঝারি-বৃহৎ) ইউনিট`, en: `Upper-middle (25–50%) by area in ${parentDiv.name} Division` },
          { bn: `${parentDiv.bnName} বিভাগের তৃতীয় চতুর্থাংশের (মাঝারি-ক্ষুদ্র) ইউনিট`, en: `Lower-middle (50–75%) by area in ${parentDiv.name} Division` },
          { bn: `${parentDiv.bnName} বিভাগের সর্বনিম্ন ২৫% ক্ষুদ্র ইউনিটের একটি`, en: `Smallest 25% by area in ${parentDiv.name} Division` },
        ].filter((o) => o.en !== divAreaQuartile.en);
        pushQ(
          buildQuestion(
            nextId('u-div-qarea'),
            1,
            'geography_borders',
            `আয়তনের দিক থেকে নিজ বিভাগ (${parentDiv.bnName})-এ ${uLabelBn}-এর অবস্থান কোন শ্রেণিতে?`,
            `How does ${uLabelEn} rank by land area quartile within ${parentDiv.name} Division?`,
            divAreaQuartile,
            divQuartileOptions,
            `${uLabelBn} (~${formatNum(u.areaKm2, 'bn')} কিমি²) ${divAreaQuartile.bn}।`,
            `${uLabelEn} (~${u.areaKm2} km²) sits in the ${divAreaQuartile.en}.`
          )
        );

        pushQ(
          buildQuestion(
            nextId('u-metro-chk'),
            1,
            'heritage_facts',
            `${uLabelBn} কি সিটি কর্পোরেশনের মহানগর থানাভুক্ত এলাকা?`,
            `Is ${uLabelEn} classified as a metropolitan City Corporation thana?`,
            uDetail.isUrbanThana
              ? { bn: 'হ্যাঁ, এটি মহানগর থানাভুক্ত নগর এলাকা', en: 'Yes, it is a metropolitan city thana' }
              : { bn: 'না, এটি মহানগর থানা নয় — স্বতন্ত্র উপজেলা', en: 'No, it is a regular upazila rather than an urban thana' },
            [
              uDetail.isUrbanThana
                ? { bn: 'না, এটি মহানগর থানা নয় — স্বতন্ত্র উপজেলা', en: 'No, it is a regular upazila rather than an urban thana' }
                : { bn: 'হ্যাঁ, এটি মহানগর থানাভুক্ত নগর এলাকা', en: 'Yes, it is a metropolitan city thana' },
              { bn: 'এটি শুধুমাত্র একটি স্থলবন্দর শুল্ক অঞ্চল', en: 'It is exclusively an uninhabited land-port enclave' },
              { bn: 'এটি পার্বত্য বন্যপ্রাণী অভয়ারণ্য মাত্র', en: 'It is strictly a mountainous wildlife sanctuary only' },
            ],
            uDetail.isUrbanThana
              ? `${uLabelBn} একটি মহানগর থানা এলাকা।`
              : `${uLabelBn} মহানগর থানা নয়, এটি একটি উপজেলা।`,
            uDetail.isUrbanThana
              ? `${uLabelEn} is a metropolitan urban thana.`
              : `${uLabelEn} is a regular upazila.`
          )
        );

        // 14. Extra Unique Direct Boundary, River-Basin & Home-District Context Questions for u
        const sameDistNbrCount = uNbrs.filter((nu) => nu.districtId === u.districtId).length;
        pushQ(
          buildQuestion(
            nextId('u-samedist-nbr'),
            1,
            'geography_borders',
            `${uLabelBn}-এর সীমান্তবর্তী এলাকার মধ্যে কয়টি নিজ জেলা (${parentDist.bnName})-এর ভেতরে অবস্থিত?`,
            `How many bordering units around ${uLabelEn} belong to the same district (${parentDist.name})?`,
            { bn: `${formatNum(sameDistNbrCount, 'bn')}টি`, en: `${sameDistNbrCount}` },
            [0, 1, 2, 3, 4, 5, 6, 7, 8]
              .filter((n) => n !== sameDistNbrCount)
              .map((n) => ({ bn: `${formatNum(n, 'bn')}টি`, en: `${n}` })),
            `${uLabelBn}-এর স্থলসীমান্তে নিজ জেলার ${formatNum(sameDistNbrCount, 'bn')}টি উপজেলা/থানা রয়েছে।`,
            `${sameDistNbrCount} bordering unit(s) around ${uLabelEn} lie inside ${parentDist.name} District.`
          )
        );

        const borderProfileAns: OptionPair =
          uNbrs.length === 0
            ? { bn: 'বিচ্ছিন্ন দ্বীপ/স্থলসংযোগহীন এলাকা', en: 'Detached island without land borders' }
            : crossDivIds.length > 0
            ? { bn: 'অন্য বিভাগের সীমানাকেও স্পর্শ করেছে', en: 'Borders at least one external division' }
            : extDistIds.length > 0
            ? { bn: 'নিজ বিভাগের ভিন্ন জেলা স্পর্শ করেছে', en: 'Borders another district in own division' }
            : { bn: `সম্পূর্ণ নিজ জেলা (${parentDist.bnName}) দ্বারা বেষ্টিত`, en: `Entirely surrounded inside ${parentDist.name}` };
        pushQ(
          buildQuestion(
            nextId('u-border-prof'),
            1,
            'geography_borders',
            `সীমানা ও অবস্থানগত বৈশিষ্ট্যের দিক থেকে ${uLabelBn} কোন শ্রেণিতে পড়ে?`,
            `Which administrative boundary profile accurately describes ${uLabelEn}?`,
            borderProfileAns,
            [
              { bn: 'বিচ্ছিন্ন দ্বীপ/স্থলসংযোগহীন এলাকা', en: 'Detached island without land borders' },
              { bn: 'অন্য বিভাগের সীমানাকেও স্পর্শ করেছে', en: 'Borders at least one external division' },
              { bn: 'নিজ বিভাগের ভিন্ন জেলা স্পর্শ করেছে', en: 'Borders another district in own division' },
              { bn: `সম্পূর্ণ নিজ জেলা (${parentDist.bnName}) দ্বারা বেষ্টিত`, en: `Entirely surrounded inside ${parentDist.name}` },
            ],
            `${uLabelBn}: ${borderProfileAns.bn}।`,
            `${uLabelEn}: ${borderProfileAns.en}.`
          )
        );

        if (crossDivIds.length > 0) {
          const extDiv = divMap.get(crossDivIds[0]);
          if (extDiv) {
            pushQ(
              buildQuestion(
                nextId('u-xdiv-name'),
                1,
                'geography_borders',
                `নিজ বিভাগ (${parentDiv.bnName}) ছাড়া নিচের কোন বিভাগের সীমান্ত সরাসরি ${uLabelBn}-কে স্পর্শ করেছে?`,
                `Outside ${parentDiv.name} Division, which external division directly borders ${uLabelEn}?`,
                { bn: `${extDiv.bnName} বিভাগ`, en: `${extDiv.name} Division` },
                divisions
                  .filter((dv) => dv.id !== parentDiv.id && !crossDivIds.includes(dv.id))
                  .map((dv) => ({ bn: `${dv.bnName} বিভাগ`, en: `${dv.name} Division` })),
                `${uLabelBn} সরাসরি ${extDiv.bnName} বিভাগের সীমান্ত স্পর্শ করেছে।`,
                `${uLabelEn} shares a direct border with ${extDiv.name} Division.`
              )
            );
          }
        }

        if (uPop > 0 && divUpazilaList.length >= 4) {
          const divPopSorted = [...divUpazilaList]
            .filter((x) => (x.population || 0) > 0)
            .sort((a, b) => (b.population || 0) - (a.population || 0));
          const divPopIdx = divPopSorted.findIndex((x) => x.id === u.id);
          if (divPopIdx >= 0) {
            const divPopQuartile =
              divPopIdx < divPopSorted.length * 0.25
                ? { bn: `${parentDiv.bnName} বিভাগের শীর্ষ ২৫% জনবহুল ইউনিটের একটি`, en: `Top 25% most populous in ${parentDiv.name} Division` }
                : divPopIdx < divPopSorted.length * 0.5
                ? { bn: `${parentDiv.bnName} বিভাগের দ্বিতীয় চতুর্থাংশের জনবহুল ইউনিট`, en: `Upper-middle (25–50%) by population in ${parentDiv.name}` }
                : divPopIdx < divPopSorted.length * 0.75
                ? { bn: `${parentDiv.bnName} বিভাগের তৃতীয় চতুর্থাংশের জনবহুল ইউনিট`, en: `Lower-middle (50–75%) by population in ${parentDiv.name}` }
                : { bn: `${parentDiv.bnName} বিভাগের সর্বনিম্ন ২৫% জনসংখ্যার ইউনিটের একটি`, en: `Bottom 25% by population in ${parentDiv.name} Division` };
            pushQ(
              buildQuestion(
                nextId('u-div-qpop'),
                1,
                'heritage_facts',
                `জনসংখ্যার দিক থেকে নিজ বিভাগ (${parentDiv.bnName})-এ ${uLabelBn}-এর অবস্থান কোন শ্রেণিতে?`,
                `How does ${uLabelEn} rank by population quartile within ${parentDiv.name} Division?`,
                divPopQuartile,
                [
                  { bn: `${parentDiv.bnName} বিভাগের শীর্ষ ২৫% জনবহুল ইউনিটের একটি`, en: `Top 25% most populous in ${parentDiv.name} Division` },
                  { bn: `${parentDiv.bnName} বিভাগের দ্বিতীয় চতুর্থাংশের জনবহুল ইউনিট`, en: `Upper-middle (25–50%) by population in ${parentDiv.name}` },
                  { bn: `${parentDiv.bnName} বিভাগের তৃতীয় চতুর্থাংশের জনবহুল ইউনিট`, en: `Lower-middle (50–75%) by population in ${parentDiv.name}` },
                  { bn: `${parentDiv.bnName} বিভাগের সর্বনিম্ন ২৫% জনসংখ্যার ইউনিটের একটি`, en: `Bottom 25% by population in ${parentDiv.name} Division` },
                ],
                `${uLabelBn} (~${formatNum(uPop, 'bn')} জন) ${divPopQuartile.bn}।`,
                `${uLabelEn} (~${uPop.toLocaleString()}) falls in the ${divPopQuartile.en}.`
              )
            );
          }
        }

        if (uRivers.length > 0 && RIVER_DETAILS[uRivers[0].id]) {
          const rMain = uRivers[0];
          const rdMain = RIVER_DETAILS[rMain.id];
          const otherBasins = rivers
            .filter((or) => RIVER_DETAILS[or.id] && RIVER_DETAILS[or.id].basinBn !== rdMain.basinBn)
            .map((or) => ({
              bn: RIVER_DETAILS[or.id].basinBn,
              en: RIVER_DETAILS[or.id].basinEn,
            }));
          pushQ(
            buildQuestion(
              nextId('u-riv-basin'),
              1,
              'rivers',
              `${uLabelBn}-এর ওপর দিয়ে প্রবাহিত ${rMain.bnName} নদী কোন প্রধান নদী অববাহিকার অন্তর্ভুক্ত?`,
              `The ${rMain.name} River passing through ${uLabelEn} belongs to which major river basin?`,
              { bn: rdMain.basinBn, en: rdMain.basinEn },
              otherBasins,
              `${uLabelBn}-এ প্রবাহিত ${rMain.bnName} নদী ${rdMain.basinBn}-এর অন্তর্গত।`,
              `The ${rMain.name} River in ${uLabelEn} is part of the ${rdMain.basinEn}.`
            )
          );
        }

        pushQ(
          buildQuestion(
            nextId('u-dist-ucnt'),
            1,
            'geography_borders',
            `${uLabelBn} যে জেলায় অবস্থিত (${parentDist.bnName}), সেই জেলায় মোট কয়টি উপজেলা ও থানা রয়েছে?`,
            `How many upazilas & thanas in total are in ${uLabelEn}’s district (${parentDist.name})?`,
            { bn: `${formatNum(distUpazilas.length, 'bn')}টি`, en: `${distUpazilas.length}` },
            [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
              .filter((n) => n !== distUpazilas.length)
              .map((n) => ({ bn: `${formatNum(n, 'bn')}টি`, en: `${n}` })),
            `${uLabelBn} ${parentDist.bnName} জেলার ${formatNum(distUpazilas.length, 'bn')}টি প্রশাসনিক ইউনিটের একটি।`,
            `${uLabelEn} is one of ${distUpazilas.length} units in ${parentDist.name} District.`
          )
        );

        if (distMeta) {
          const extEnDist = distMeta.externalBordersEn.join(' ');
          const distHasIntlOrSea =
            extEnDist.includes('India') || extEnDist.includes('Myanmar') || extEnDist.includes('Bay');
          pushQ(
            buildQuestion(
              nextId('u-dist-ext'),
              1,
              'geography_borders',
              `${uLabelBn}-এর নিজ জেলা ${parentDist.bnName}-এর কি কোনো আন্তর্জাতিক সীমান্ত বা সমুদ্র উপকূল রয়েছে?`,
              `Does ${uLabelEn}’s home district (${parentDist.name}) touch an international border or the sea coast?`,
              distHasIntlOrSea
                ? { bn: 'হ্যাঁ, জেলার আন্তর্জাতিক সীমান্ত বা উপকূল রয়েছে', en: 'Yes, the district touches an international border or coast' }
                : { bn: 'না, জেলাটি সম্পূর্ণ অভ্যন্তরীণ (স্থলবেষ্টিত)', en: 'No, it is an interior landlocked district' },
              [
                distHasIntlOrSea
                  ? { bn: 'না, জেলাটি সম্পূর্ণ অভ্যন্তরীণ (স্থলবেষ্টিত)', en: 'No, it is an interior landlocked district' }
                  : { bn: 'হ্যাঁ, জেলার আন্তর্জাতিক সীমান্ত বা উপকূল রয়েছে', en: 'Yes, the district touches an international border or coast' },
                { bn: 'জেলাটি প্রশান্ত মহাসাগরের তীরে অবস্থিত', en: 'The district lies on the Pacific Ocean coast' },
                { bn: 'জেলাটি নেপালের সাথে সরাসরি সীমান্ত ভাগ করে', en: 'The district directly borders Nepal' },
              ],
              distHasIntlOrSea
                ? `${parentDist.bnName} জেলার বহির্সীমানা: ${distMeta.externalBordersBn.join(', ')}।`
                : `${parentDist.bnName} জেলা সম্পূর্ণ অভ্যন্তরীণ জেলা।`,
              distHasIntlOrSea
                ? `${parentDist.name} District borders ${distMeta.externalBordersEn.join(', ')}.`
                : `${parentDist.name} District is an interior landlocked district.`
            )
          );
        }
      }
    }
  }

  // Deduplicate by promptBn (keep higher priority Tier 1 first)
  const sortedBank = [...bank].sort((a, b) => a.priority - b.priority);
  const seenPrompts = new Set<string>();
  const dedupedBank: InternalQuestion[] = [];
  for (const q of sortedBank) {
    if (!seenPrompts.has(q.promptBn)) {
      seenPrompts.add(q.promptBn);
      dedupedBank.push(q);
    }
  }

  const tier1 = dedupedBank.filter((q) => q.priority === 1);
  const tier2 = dedupedBank.filter((q) => q.priority === 2);

  const pickFromTier = (pool: InternalQuestion[], limit: number): InternalQuestion[] => {
    if (limit <= 0 || pool.length === 0) return [];
    if (config.category === 'mixed') {
      const geo = shuffleArray(pool.filter((q) => q.category === 'geography_borders'));
      const riv = shuffleArray(pool.filter((q) => q.category === 'rivers'));
      const her = shuffleArray(pool.filter((q) => q.category === 'heritage_facts'));
      const out: InternalQuestion[] = [];
      let idx = 0;
      while (out.length < limit && (idx < geo.length || idx < riv.length || idx < her.length)) {
        if (idx < geo.length && out.length < limit) out.push(geo[idx]);
        if (idx < riv.length && out.length < limit) out.push(riv[idx]);
        if (idx < her.length && out.length < limit) out.push(her[idx]);
        idx++;
      }
      return out;
    }
    const matching = shuffleArray(pool.filter((q) => q.category === config.category));
    const other = shuffleArray(pool.filter((q) => q.category !== config.category));
    return [...matching, ...other].slice(0, limit);
  };

  const desiredCount = config.questionCount;
  // Always exhaust Tier 1 (selected scope) across matching then remaining categories before touching Tier 2
  let selected: InternalQuestion[] = [];
  if (config.category === 'mixed') {
    const t1Pick = pickFromTier(tier1, desiredCount);
    const t2Pick =
      t1Pick.length < desiredCount ? pickFromTier(tier2, desiredCount - t1Pick.length) : [];
    selected = shuffleArray([...t1Pick, ...t2Pick]);
  } else {
    const t1Match = shuffleArray(tier1.filter((q) => q.category === config.category));
    const t1Other = shuffleArray(tier1.filter((q) => q.category !== config.category));
    const t2Match = shuffleArray(tier2.filter((q) => q.category === config.category));
    const t2Other = shuffleArray(tier2.filter((q) => q.category !== config.category));
    selected = [...t1Match, ...t1Other, ...t2Match, ...t2Other].slice(0, desiredCount);
  }

  return selected.slice(0, desiredCount).map(({ priority: _p, ...q }) => q);
}
