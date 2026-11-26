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
export type QuizLength = 10 | 15 | 20;

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
    contextPrefixEn?: string
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
          .filter((z) => z.labelBn !== detail.directionLabelBn && z.labelBn !== 'সব অঞ্চল')
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

    const neighborSample = thorough ? shuffleArray(neighbors).slice(0, 4) : neighbors.slice(0, 1);
    for (const nbr of neighborSample) {
      pushQ(
        buildQuestion(
          nextId('dist-nbr'),
          priority,
          'geography_borders',
          `${pBn}নিচের কোন জেলাটি ${dist.bnName} জেলার সরাসরি সীমান্তবর্তী?`,
          `${pEn}Which of the following districts directly borders ${dist.name} District?`,
          { bn: nbr.bnName, en: nbr.name },
          nonNeighbors.map((d) => ({ bn: d.bnName, en: d.name })),
          `${nbr.bnName} জেলা ${dist.bnName} জেলার পার্শ্ববর্তী সীমান্ত জেলা।`,
          `${nbr.name} shares a direct border with ${dist.name} District.`
        )
      );
    }

    if (neighbors.length >= 3) {
      const pickedNonNbr = shuffleArray(nonNeighbors)[0];
      if (pickedNonNbr) {
        pushQ(
          buildQuestion(
            nextId('dist-non-nbr'),
            priority,
            'geography_borders',
            `${pBn}নিচের কোন জেলাটির সাথে ${dist.bnName} জেলার সরাসরি স্থলসীমান্ত নেই?`,
            `${pEn}Which of the following districts does NOT share a border with ${dist.name} District?`,
            { bn: pickedNonNbr.bnName, en: pickedNonNbr.name },
            neighbors.map((d) => ({ bn: d.bnName, en: d.name })),
            `${pickedNonNbr.bnName} জেলার সাথে ${dist.bnName} জেলার সরাসরি সীমান্ত নেই।`,
            `${pickedNonNbr.name} does not border ${dist.name} District directly.`
          )
        );
      }
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
      if (thorough) {
        addRiverFacts(
          r,
          priority,
          false,
          `${dist.bnName} জেলার ওপর দিয়ে প্রবাহিত`,
          `Flowing through ${dist.name} District,`
        );
      }
    }

    // 7. Upazilas inside district
    const outsideUpazilas = upazilas.filter((u) => u.districtId !== dist.id);
    const upazilaSample = thorough
      ? shuffleArray(distUpazilas).slice(0, 6)
      : shuffleArray(distUpazilas).slice(0, 2);
    for (const u of upazilaSample) {
      pushQ(
        buildQuestion(
          nextId('dist-u-in'),
          priority,
          'geography_borders',
          `${pBn}নিচের কোন উপজেলা/থানাটি ${dist.bnName} জেলার অন্তর্ভুক্ত?`,
          `${pEn}Which of the following upazilas or thanas belongs to ${dist.name} District?`,
          { bn: u.bnName, en: u.name },
          outsideUpazilas.map((ou) => ({ bn: ou.bnName, en: ou.name })),
          `${u.bnName} হলো ${dist.bnName} জেলার একটি উপজেলা/থানা।`,
          `${u.name} is an upazila/thana in ${dist.name} District.`
        )
      );
    }

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

      const outsiderU = shuffleArray(outsideUpazilas)[0];
      if (outsiderU) {
        pushQ(
          buildQuestion(
            nextId('dist-u-not'),
            priority,
            'geography_borders',
            `${pBn}নিচের কোন উপজেলাটি ${dist.bnName} জেলার অন্তর্ভুক্ত নয়?`,
            `${pEn}Which of the following upazilas is NOT part of ${dist.name} District?`,
            { bn: outsiderU.bnName, en: outsiderU.name },
            distUpazilas.map((u) => ({ bn: u.bnName, en: u.name })),
            `${outsiderU.bnName} ${distMap.get(outsiderU.districtId)?.bnName || ''} জেলার অন্তর্গত, ${dist.bnName} জেলার নয়।`,
            `${outsiderU.name} belongs to ${distMap.get(outsiderU.districtId)?.name || 'another'} District, not ${dist.name}.`
          )
        );
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

      const nbrSet = new Set(divMeta.neighbors);
      const nonNbrDivs = divisions.filter((d) => d.id !== div.id && !nbrSet.has(d.id));
      for (const ndId of divMeta.neighbors.slice(0, 2)) {
        const nd = divMap.get(ndId);
        if (!nd) continue;
        pushQ(
          buildQuestion(
            nextId('div-nbr'),
            priority,
            'geography_borders',
            `নিচের কোন বিভাগটি ${divMeta.bnName} বিভাগের সরাসরি সীমান্তবর্তী?`,
            `Which division directly borders ${divMeta.name} Division?`,
            { bn: `${nd.bnName} বিভাগ`, en: `${nd.name} Division` },
            nonNbrDivs.map((d) => ({ bn: `${d.bnName} বিভাগ`, en: `${d.name} Division` })),
            `${nd.bnName} বিভাগ ${divMeta.bnName} বিভাগের পার্শ্ববর্তী বিভাগ।`,
            `${nd.name} Division directly borders ${divMeta.name} Division.`
          )
        );
      }

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

      for (let i = 0; i < Math.min(3, divMeta.landmarksBn.length); i++) {
        const foreignLms: OptionPair[] = [];
        for (const od of divisions.filter((d) => d.id !== div.id)) {
          const om = DIVISION_META[od.id];
          if (!om) continue;
          om.landmarksBn.forEach((lm, idx) =>
            foreignLms.push({ bn: lm, en: om.landmarksEn[idx] })
          );
        }
        pushQ(
          buildQuestion(
            nextId('div-lm'),
            priority,
            'heritage_facts',
            `নিচের কোন ঐতিহাসিক বা দর্শনীয় স্থানটি ${divMeta.bnName} বিভাগে অবস্থিত?`,
            `Which landmark is located in ${divMeta.name} Division?`,
            { bn: divMeta.landmarksBn[i], en: divMeta.landmarksEn[i] },
            foreignLms,
            `‘${divMeta.landmarksBn[i]}’ ${divMeta.bnName} বিভাগের অন্যতম পরিচিত স্থান।`,
            `${divMeta.landmarksEn[i]} is a notable landmark in ${divMeta.name} Division.`
          )
        );
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
  } else if (config.scopeType === 'division') {
    const div = divMap.get(config.scopeId || divisions[0]?.id) || divisions[0];
    if (div) {
      addDivisionFacts(div, 1, true);
      const divDists = districtsByDiv.get(div.id) || [];
      for (const d of shuffleArray(divDists)) {
        addDistrictFacts(d, 1, divDists.length <= 6);
      }
      const divDistSet = new Set(divDists.map((d) => d.id));
      const divRivers = rivers.filter((r) => r.districts.some((did) => divDistSet.has(did)));
      for (const r of shuffleArray(divRivers)) {
        addRiverFacts(r, 1, true, `${div.bnName} বিভাগে প্রবাহিত`, `In ${div.name} Division,`);
      }
    }
  } else if (config.scopeType === 'district') {
    const dist = distMap.get(config.scopeId || districts[0]?.id) || districts[0];
    if (dist) {
      addDistrictFacts(dist, 1, true);

      // Upazila-to-upazila neighbor & river questions strictly scoped to this district
      const distUpazilas = upazilasByDist.get(dist.id) || [];
      const outsideUpazilas = upazilas.filter((u) => u.districtId !== dist.id);
      for (const u of shuffleArray(distUpazilas).slice(0, 6)) {
        const uNbrSet = new Set(u.neighbors);
        const uNbrs = u.neighbors
          .map((uid) => upazilaMap.get(uid))
          .filter((nu): nu is GeoUpazila => Boolean(nu));
        if (uNbrs.length > 0) {
          const pickedNbr = shuffleArray(uNbrs)[0];
          const nonNbrs = outsideUpazilas
            .concat(distUpazilas.filter((du) => du.id !== u.id && !uNbrSet.has(du.id)))
            .filter((x) => !uNbrSet.has(x.id) && x.id !== u.id);
          pushQ(
            buildQuestion(
              nextId('dist-unbr'),
              1,
              'geography_borders',
              `${dist.bnName} জেলার ${u.bnName}-এর সরাসরি সীমান্তবর্তী কোনটি?`,
              `Which of the following directly borders ${u.name} (${dist.name} District)?`,
              { bn: pickedNbr.bnName, en: pickedNbr.name },
              nonNbrs.map((x) => ({ bn: x.bnName, en: x.name })),
              `${pickedNbr.bnName} ${u.bnName}-এর পার্শ্ববর্তী এলাকা।`,
              `${pickedNbr.name} shares a direct boundary with ${u.name}.`
            )
          );
        }
        if (u.rivers.length > 0) {
          const r = riverMap.get(u.rivers[0]);
          if (r) {
            pushQ(
              buildQuestion(
                nextId('dist-uriv'),
                1,
                'rivers',
                `${dist.bnName} জেলার কোন এলাকার মধ্য দিয়ে ${r.bnName} নদী প্রবাহিত হয়েছে?`,
                `Through which upazila of ${dist.name} District does the ${r.name} River flow?`,
                { bn: u.bnName, en: u.name },
                distUpazilas
                  .filter((du) => du.id !== u.id && !du.rivers.includes(r.id))
                  .concat(outsideUpazilas)
                  .map((x) => ({ bn: x.bnName, en: x.name })),
                `${r.bnName} নদী ${dist.bnName} জেলার ${u.bnName} অতিক্রম করেছে।`,
                `The ${r.name} River flows through ${u.name} in ${dist.name} District.`
              )
            );
          }
        }
      }

      // Tier 2 supporting regional river/division context (only if Tier 1 runs short, e.g. rivers category)
      const div = divMap.get(dist.divisionId);
      if (div) {
        addDivisionFacts(div, 2, false);
        const divDistSet = new Set((districtsByDiv.get(div.id) || []).map((d) => d.id));
        for (const r of shuffleArray(
          rivers.filter((rv) => !rv.districts.includes(dist.id) && rv.districts.some((id) => divDistSet.has(id)))
        )) {
          addRiverFacts(
            r,
            2,
            false,
            `${dist.bnName}-এর সংলগ্ন ${div.bnName} অঞ্চলের`,
            `In ${div.name} region near ${dist.name},`
          );
        }
      }
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
                .filter((z) => z.labelBn !== distMeta.directionLabelBn && z.labelBn !== 'সব অঞ্চল')
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

        // 5C. Area & Population Rank within Parent District
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

        if (distUpazilas.length >= 4) {
          const sortedAreaSibs = [...distUpazilas].sort((a, b) => b.areaKm2 - a.areaKm2);
          const areaRank = sortedAreaSibs.findIndex((s) => s.id === u.id) + 1;
          const areaRankLabel: OptionPair =
            areaRank === 1
              ? { bn: '১ম (জেলার বৃহত্তম)', en: '1st (Largest in district)' }
              : areaRank === distUpazilas.length
              ? { bn: `${bnOrdinal(areaRank)} (জেলার ক্ষুদ্রতম)`, en: `${areaRank} (Smallest in district)` }
              : { bn: `${bnOrdinal(areaRank)} স্থান`, en: `Rank #${areaRank}` };
          const areaRankDistractors: OptionPair[] = Array.from(
            { length: distUpazilas.length },
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

          const sortedPopSibs = [...distUpazilas].sort((a, b) => (b.population || 0) - (a.population || 0));
          const popRank = sortedPopSibs.findIndex((s) => s.id === u.id) + 1;
          const popRankLabel: OptionPair =
            popRank === 1
              ? { bn: '১ম (সর্বাধিক জনবহুল)', en: '1st (Most populous)' }
              : popRank === distUpazilas.length
              ? { bn: `${bnOrdinal(popRank)} (সর্বনিম্ন জনসংখ্যা)`, en: `${popRank} (Least populous)` }
              : { bn: `${bnOrdinal(popRank)} স্থান`, en: `Rank #${popRank}` };
          const popRankDistractors: OptionPair[] = Array.from(
            { length: distUpazilas.length },
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

        // 6. Sibling upazilas in the same district
        const sameDistSiblings = distUpazilas.filter((du) => du.id !== u.id);
        const outsideUpazilas = upazilas.filter((ou) => ou.districtId !== parentDist.id);
        const sibPromptsBn = [
          `${uLabelBn}-এর মতোই ${parentDist.bnName} জেলার অপর একটি উপজেলা/থানা নিচের কোনটি?`,
          `${parentDist.bnName} জেলার প্রশাসনিক সীমার মধ্যে ${uLabelBn}-এর সাথে আর কোনটি অবস্থিত?`,
          `নিচের কোন এলাকাটি ${u.bnName}-এর সহ-উপজেলা/থানা হিসেবে ${parentDist.bnName} জেলার অংশ?`,
        ];
        const sibPromptsEn = [
          `Which of these upazilas/thanas shares ${parentDist.name} District with ${uLabelEn}?`,
          `Which unit lies alongside ${uLabelEn} inside ${parentDist.name} District?`,
          `Which of the following is also part of ${parentDist.name} District like ${u.name}?`,
        ];
        shuffleArray(sameDistSiblings)
          .slice(0, 3)
          .forEach((sib, idx) => {
            pushQ(
              buildQuestion(
                nextId('u-sib'),
                1,
                'geography_borders',
                sibPromptsBn[idx % sibPromptsBn.length],
                sibPromptsEn[idx % sibPromptsEn.length],
                { bn: sib.bnName, en: sib.name },
                outsideUpazilas.map((ou) => ({ bn: ou.bnName, en: ou.name })),
                `${u.bnName} এবং ${sib.bnName} উভয়ই ${parentDist.bnName} জেলার অন্তর্ভুক্ত।`,
                `Both ${u.name} and ${sib.name} belong to ${parentDist.name} District.`
              )
            );
          });

        if (sameDistSiblings.length >= 3 && outsideUpazilas.length >= 2) {
          shuffleArray(outsideUpazilas)
            .slice(0, 2)
            .forEach((pickedOutsider, idx) => {
              pushQ(
                buildQuestion(
                  nextId('u-non-sib'),
                  1,
                  'geography_borders',
                  idx === 0
                    ? `নিচের কোনটি ${uLabelBn}-এর নিজ জেলা (${parentDist.bnName})-এর অন্তর্ভুক্ত নয়?`
                    : `প্রশাসনিকভাবে নিচের কোন এলাকাটি ${uLabelBn}-এর সাথে একই জেলায় (${parentDist.bnName}) অবস্থিত নয়?`,
                  idx === 0
                    ? `Which of these is NOT in ${uLabelEn}’s district (${parentDist.name})?`
                    : `Which of these administrative units does NOT share ${parentDist.name} District with ${uLabelEn}?`,
                  { bn: pickedOutsider.bnName, en: pickedOutsider.name },
                  sameDistSiblings.map((s) => ({ bn: s.bnName, en: s.name })),
                  `${pickedOutsider.bnName} ${distMap.get(pickedOutsider.districtId)?.bnName || ''} জেলায় অবস্থিত, ${parentDist.bnName} জেলায় নয়।`,
                  `${pickedOutsider.name} is located in ${distMap.get(pickedOutsider.districtId)?.name || 'another'} District, not ${parentDist.name}.`
                )
              );
            });
        }

        // 7. Direct area comparison against siblings/neighbors
        const uNbrSet = new Set(u.neighbors);
        const uNbrs = u.neighbors
          .map((uid) => upazilaMap.get(uid))
          .filter((nu): nu is GeoUpazila => Boolean(nu));
        const localPeerPool = Array.from(
          new Map([...sameDistSiblings, ...uNbrs].map((x) => [x.id, x])).values()
        );
        const clearlyLarger = localPeerPool.filter((p) => p.areaKm2 - u.areaKm2 >= 25);
        const clearlySmaller = localPeerPool.filter((p) => u.areaKm2 - p.areaKm2 >= 25);

        if (clearlyLarger.length >= 1 && clearlySmaller.length >= 3) {
          const pickedLarge = shuffleArray(clearlyLarger)[0];
          pushQ(
            buildQuestion(
              nextId('u-larger'),
              1,
              'geography_borders',
              `নিচের কোন উপজেলাটি আয়তনে ${uLabelBn}-এর চেয়ে বড়?`,
              `Which of the following upazilas is larger in area than ${uLabelEn}?`,
              { bn: pickedLarge.bnName, en: pickedLarge.name },
              clearlySmaller.map((s) => ({ bn: s.bnName, en: s.name })),
              `${pickedLarge.bnName}-এর আয়তন প্রায় ${formatNum(pickedLarge.areaKm2, 'bn')} বর্গ কিমি, যা ${u.bnName} (${formatNum(u.areaKm2, 'bn')} বর্গ কিমি)-এর চেয়ে বড়।`,
              `${pickedLarge.name} (~${pickedLarge.areaKm2} km²) is larger than ${u.name} (~${u.areaKm2} km²).`
            )
          );
        }

        if (clearlySmaller.length >= 1 && clearlyLarger.length >= 3) {
          const pickedSmall = shuffleArray(clearlySmaller)[0];
          pushQ(
            buildQuestion(
              nextId('u-smaller'),
              1,
              'geography_borders',
              `নিচের কোন উপজেলাটি আয়তনে ${uLabelBn}-এর চেয়ে ছোট?`,
              `Which of the following upazilas is smaller in area than ${uLabelEn}?`,
              { bn: pickedSmall.bnName, en: pickedSmall.name },
              clearlyLarger.map((l) => ({ bn: l.bnName, en: l.name })),
              `${pickedSmall.bnName}-এর আয়তন প্রায় ${formatNum(pickedSmall.areaKm2, 'bn')} বর্গ কিমি, যা ${u.bnName} (${formatNum(u.areaKm2, 'bn')} বর্গ কিমি)-এর চেয়ে ছোট।`,
              `${pickedSmall.name} (~${pickedSmall.areaKm2} km²) is smaller than ${u.name} (~${u.areaKm2} km²).`
            )
          );
        }

        // 7B. Direct Population comparisons against sibling/neighbor upazilas
        const clearlyMorePop = localPeerPool.filter((p) => (p.population || 0) - uPop >= 35000);
        const clearlyLessPop = localPeerPool.filter((p) => uPop - (p.population || 0) >= 35000);
        if (clearlyMorePop.length >= 1 && clearlyLessPop.length >= 3) {
          const pickedMore = shuffleArray(clearlyMorePop)[0];
          pushQ(
            buildQuestion(
              nextId('u-pop-more'),
              1,
              'heritage_facts',
              `নিচের কোন উপজেলা/থানার জনসংখ্যা ${uLabelBn}-এর চেয়ে বেশি?`,
              `Which of these neighboring/sibling units has a larger population than ${uLabelEn}?`,
              { bn: pickedMore.bnName, en: pickedMore.name },
              clearlyLessPop.map((s) => ({ bn: s.bnName, en: s.name })),
              `${pickedMore.bnName}-এর জনসংখ্যা প্রায় ${formatNum(pickedMore.population || 0, 'bn')} জন, যা ${u.bnName} (~${formatNum(uPop, 'bn')})-এর চেয়ে বেশি।`,
              `${pickedMore.name} (~${(pickedMore.population || 0).toLocaleString()}) has more residents than ${u.name} (~${uPop.toLocaleString()}).`
            )
          );
        }
        if (clearlyLessPop.length >= 1 && clearlyMorePop.length >= 3) {
          const pickedLess = shuffleArray(clearlyLessPop)[0];
          pushQ(
            buildQuestion(
              nextId('u-pop-less'),
              1,
              'heritage_facts',
              `নিচের কোন উপজেলা/থানার জনসংখ্যা ${uLabelBn}-এর চেয়ে কম?`,
              `Which of these neighboring/sibling units has a smaller population than ${uLabelEn}?`,
              { bn: pickedLess.bnName, en: pickedLess.name },
              clearlyMorePop.map((l) => ({ bn: l.bnName, en: l.name })),
              `${pickedLess.bnName}-এর জনসংখ্যা প্রায় ${formatNum(pickedLess.population || 0, 'bn')} জন, যা ${u.bnName} (~${formatNum(uPop, 'bn')})-এর চেয়ে কম।`,
              `${pickedLess.name} (~${(pickedLess.population || 0).toLocaleString()}) has fewer residents than ${u.name} (~${uPop.toLocaleString()}).`
            )
          );
        }

        // 8. Neighbor count
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

        // 9. Bordering upazilas (up to 3 varied distinct questions)
        const nonUNbrs = upazilas.filter((ou) => ou.id !== u.id && !uNbrSet.has(ou.id));
        const nearbyNonNbrs = distUpazilas.filter((du) => du.id !== u.id && !uNbrSet.has(du.id));
        const distractorPool = nearbyNonNbrs.length >= 3 ? [...nearbyNonNbrs, ...nonUNbrs] : nonUNbrs;
        const nbrPromptsBn = [
          `নিচের কোনটি ${uLabelBn}-এর সরাসরি সীমান্তবর্তী (পার্শ্ববর্তী)?`,
          `মানচিত্রে ${uLabelBn}-এর সীমান্তের সাথে সরাসরি যুক্ত এলাকা কোনটি?`,
          `${uLabelBn}-এর স্থলসীমান্ত স্পর্শ করেছে নিচের কোন উপজেলা বা থানা?`,
        ];
        const nbrPromptsEn = [
          `Which of the following directly borders ${uLabelEn}?`,
          `On the map, which adjacent unit shares a direct border with ${uLabelEn}?`,
          `Which upazila or thana touches the boundary of ${uLabelEn}?`,
        ];
        shuffleArray(uNbrs)
          .slice(0, 3)
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

        // 10. Cross-district neighbor & external bordering districts
        const crossDistNbrs = uNbrs.filter((x) => x.districtId !== u.districtId);
        const extDistIds = Array.from(new Set(crossDistNbrs.map((x) => x.districtId)));

        if (extDistIds.length > 0) {
          pushQ(
            buildQuestion(
              nextId('u-ext-dcnt'),
              1,
              'geography_borders',
              `নিজ জেলা (${parentDist.bnName}) ছাড়া ${uLabelBn}-এর সীমান্ত অন্য কয়টি জেলাকে স্পর্শ করেছে?`,
              `Apart from ${parentDist.name} District, how many other districts border ${uLabelEn}?`,
              { bn: `${formatNum(extDistIds.length, 'bn')}টি জেলা`, en: `${extDistIds.length} district(s)` },
              [0, 1, 2, 3, 4, 5]
                .filter((n) => n !== extDistIds.length)
                .map((n) => ({ bn: `${formatNum(n, 'bn')}টি জেলা`, en: `${n} district(s)` })),
              `${uLabelBn} নিজ জেলা ছাড়াও ${formatNum(extDistIds.length, 'bn')}টি ভিন্ন জেলার (${extDistIds
                .map((id) => distMap.get(id)?.bnName || '')
                .join(', ')}) সাথে সীমান্ত স্পর্শ করেছে।`,
              `${uLabelEn} touches ${extDistIds.length} external district(s) (${extDistIds
                .map((id) => distMap.get(id)?.name || '')
                .join(', ')}).`
            )
          );

          const extDistSet = new Set([parentDist.id, ...extDistIds]);
          const nonBorderDists = districts.filter((d) => !extDistSet.has(d.id));
          for (const edId of extDistIds.slice(0, 2)) {
            const ed = distMap.get(edId);
            if (!ed) continue;
            pushQ(
              buildQuestion(
                nextId('u-ext-d'),
                1,
                'geography_borders',
                `${parentDist.bnName} জেলা ছাড়াও নিচের কোন ভিন্ন জেলার সাথে ${uLabelBn}-এর সরাসরি সীমান্ত রয়েছে?`,
                `Which external district directly touches ${uLabelEn}?`,
                { bn: `${ed.bnName} জেলা`, en: `${ed.name} District` },
                nonBorderDists.map((d) => ({ bn: `${d.bnName} জেলা`, en: `${d.name} District` })),
                `${u.bnName} সীমান্তে ${ed.bnName} জেলার সাথে যুক্ত।`,
                `${u.name} directly borders ${ed.name} District.`
              )
            );
          }
        }

        for (const nu of shuffleArray(crossDistNbrs).slice(0, 3)) {
          const nuDist = distMap.get(nu.districtId);
          if (!nuDist) continue;
          pushQ(
            buildQuestion(
              nextId('u-cross-nbr'),
              1,
              'geography_borders',
              `${u.bnName}-এর পার্শ্ববর্তী ${nu.bnName} ভিন্ন কোন জেলার অন্তর্ভুক্ত?`,
              `${u.name}'s bordering neighbor ${nu.name} belongs to which district?`,
              { bn: `${nuDist.bnName} জেলা`, en: `${nuDist.name} District` },
              districts
                .filter((d) => d.id !== nuDist.id)
                .map((d) => ({ bn: `${d.bnName} জেলা`, en: `${d.name} District` })),
              `${nu.bnName} ${nuDist.bnName} জেলার অন্তর্ভুক্ত হয়েও ${u.bnName}-এর সাথে সীমান্ত ভাগ করেছে।`,
              `${nu.name} belongs to ${nuDist.name} District and borders ${u.name}.`
            )
          );
        }

        const crossDivNbr = crossDistNbrs.find((x) => x.divisionId !== u.divisionId);
        if (crossDivNbr) {
          const xDiv = divMap.get(crossDivNbr.divisionId);
          if (xDiv) {
            pushQ(
              buildQuestion(
                nextId('u-cross-div'),
                1,
                'geography_borders',
                `${uLabelBn}-এর সীমান্তবর্তী ‘${crossDivNbr.bnName}’ নিচের কোন ভিন্ন বিভাগের অন্তর্গত?`,
                `${uLabelEn}'s neighbor ${crossDivNbr.name} lies in which other division?`,
                { bn: `${xDiv.bnName} বিভাগ`, en: `${xDiv.name} Division` },
                divisions
                  .filter((d) => d.id !== xDiv.id)
                  .map((d) => ({ bn: `${d.bnName} বিভাগ`, en: `${d.name} Division` })),
                `${crossDivNbr.bnName} (${xDiv.bnName} বিভাগ) ${u.bnName}-এর সাথে সরাসরি সীমান্ত সংলগ্ন।`,
                `${crossDivNbr.name} belongs to ${xDiv.name} Division and borders ${u.name}.`
              )
            );
          }
        }

        // 11. Curated Landmarks & Heritage (ONLY if curated, and never leaking u.bnName in option!)
        const foreignLms: OptionPair[] = [];
        for (const od of shuffleArray(districts.filter((d) => d.id !== parentDist.id)).slice(0, 14)) {
          const odet = DISTRICT_DETAILS[od.id];
          if (!odet) continue;
          odet.landmarksBn.forEach((lm, idx) =>
            foreignLms.push({ bn: lm, en: odet.landmarksEn[idx] })
          );
        }

        if (hasCuratedUpazilaDetail(u.id)) {
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
                `${uLabelBn}-এর নিচের কোন উল্লেখযোগ্য স্থান বা ঐতিহ্যটি অবস্থিত?`,
                `Which notable landmark or heritage site is located in ${uLabelEn}?`,
                { bn: lmBn, en: lmEn },
                foreignLms,
                `‘${lmBn}’ ${uLabelBn}-এর অন্যতম উল্লেখযোগ্য ঐতিহ্য।`,
                `${lmEn} is a famous landmark in ${uLabelEn}.`
              )
            );
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
        } else {
          // Non-curated upazila: ask honest, verified geographical & factual questions strictly about u
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
                { bn: 'বিভাগীয় সদর দপ্তর', en: 'Divisional Headquarters Only' },
                { bn: 'স্বতন্ত্র জেলা', en: 'Independent District' },
              ],
              `${u.bnName} ${parentDist.bnName} জেলার একটি ${uDetail.isUrbanThana ? 'মহানগর থানা' : 'উপজেলা'}।`,
              `${u.name} is a ${uDetail.isUrbanThana ? 'metropolitan thana' : 'upazila'} under ${parentDist.name} District.`
            )
          );
        }

        // 12. Rivers flowing directly through Upazila u (and upazila river neighbors!)
        if (uRivers.length > 0) {
          const foreignRivers = rivers.filter((r) => !u.rivers.includes(r.id));
          for (const r of uRivers) {
            pushQ(
              buildQuestion(
                nextId('u-riv'),
                1,
                'rivers',
                `প্রধান ৩০টি নদ-নদীর মধ্যে নিচের কোন নদীটি সরাসরি ${uLabelBn}-এর ওপর দিয়ে প্রবাহিত?`,
                `Which of the 30 major rivers flows directly through ${uLabelEn}?`,
                { bn: `${r.bnName} নদী`, en: `${r.name} River` },
                foreignRivers.map((fr) => ({ bn: `${fr.bnName} নদী`, en: `${fr.name} River` })),
                `${r.bnName} নদী ${uLabelBn}-এর মধ্য দিয়ে প্রবাহিত হয়েছে।`,
                `The ${r.name} River flows directly through ${uLabelEn}.`
              )
            );

            // Neighbor sharing the same river
            const nbrSharingRiver = uNbrs.filter((nu) => nu.rivers.includes(r.id));
            const nonRiverNbrs = upazilas.filter((ou) => ou.id !== u.id && !ou.rivers.includes(r.id));
            if (nbrSharingRiver.length > 0 && nonRiverNbrs.length >= 3) {
              const pickedSameRivNbr = shuffleArray(nbrSharingRiver)[0];
              pushQ(
                buildQuestion(
                  nextId('u-riv-nbr'),
                  1,
                  'rivers',
                  `${u.bnName}-এর মতোই পার্শ্ববর্তী নিচের কোন উপজেলার ওপর দিয়েও ${r.bnName} নদী প্রবাহিত হয়েছে?`,
                  `Which neighbor of ${u.name} also has the ${r.name} River flowing through it?`,
                  { bn: pickedSameRivNbr.bnName, en: pickedSameRivNbr.name },
                  nonRiverNbrs.map((ou) => ({ bn: ou.bnName, en: ou.name })),
                  `${r.bnName} নদী ${u.bnName} ও পার্শ্ববর্তী ${pickedSameRivNbr.bnName} উভয়ের ওপর দিয়েই প্রবাহিত।`,
                  `The ${r.name} River flows through both ${u.name} and neighboring ${pickedSameRivNbr.name}.`
                )
              );
            }

            addRiverFacts(
              r,
              1,
              true,
              `${u.bnName}-এর ওপর দিয়ে প্রবাহিত`,
              `Flowing through ${u.name},`
            );
          }
        } else {
          pushQ(
            buildQuestion(
              nextId('u-riv0'),
              1,
              'rivers',
              `মানচিত্রের তালিকাভুক্ত ৩০টি প্রধান নদ-নদীর কতটি সরাসরি ${uLabelBn} অতিক্রম করেছে?`,
              `How many of the 30 mapped major rivers directly pass through ${uLabelEn}?`,
              { bn: `০টি (আঞ্চলিক নদী/খাল প্রবাহিত)`, en: `0 (served by local tributaries)` },
              [
                { bn: `১টি`, en: `1` },
                { bn: `২টি`, en: `2` },
                { bn: `৩টি`, en: `3` },
              ],
              `${uLabelBn}-এর মধ্য দিয়ে তালিকাভুক্ত ৩০টি প্রধান নদ-নদীর কোনোটি সরাসরি অতিক্রম করেনি।`,
              `None of the 30 mapped major rivers directly intersect ${uLabelEn}.`
            )
          );

          // Check rivers in neighboring upazilas
          const nbrWithRiver = uNbrs.find((nu) => nu.rivers.length > 0);
          if (nbrWithRiver) {
            const nr = riverMap.get(nbrWithRiver.rivers[0]);
            if (nr) {
              pushQ(
                buildQuestion(
                  nextId('u-nbr-riv'),
                  1,
                  'rivers',
                  `${uLabelBn}-এর পার্শ্ববর্তী ${nbrWithRiver.bnName}-এর ওপর দিয়ে নিচের কোন প্রধান নদী প্রবাহিত?`,
                  `Which major river flows through ${nbrWithRiver.name}, bordering ${uLabelEn}?`,
                  { bn: `${nr.bnName} নদী`, en: `${nr.name} River` },
                  rivers
                    .filter((fr) => !nbrWithRiver.rivers.includes(fr.id))
                    .map((fr) => ({ bn: `${fr.bnName} নদী`, en: `${fr.name} River` })),
                  `${u.bnName}-এর পার্শ্ববর্তী ${nbrWithRiver.bnName}-এর মধ্য দিয়ে ${nr.bnName} নদী প্রবাহিত হয়েছে।`,
                  `The ${nr.name} River flows through ${nbrWithRiver.name}, adjacent to ${u.name}.`
                )
              );
            }
          }
        }

        // Strictly scoped to this Upazila: no parent-district landmarks or fallback leakage!
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
