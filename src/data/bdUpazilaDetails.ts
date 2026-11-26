import { DISTRICT_DETAILS, DIVISION_META } from './bdDistrictDetails';
import { toBnDigits } from '../utils/format';
import type { GeoDistrict, GeoDivision, GeoUpazila } from '../types/map';

export interface UpazilaDetail {
  directionLabelBn: string;
  directionLabelEn: string;
  famousForBn: string;
  famousForEn: string;
  landmarksBn: string[];
  landmarksEn: string[];
  specialtiesBn: string;
  specialtiesEn: string;
  historyEconomyBn: string;
  historyEconomyEn: string;
  connectivityBn: string;
  connectivityEn: string;
  summaryBn: string;
  summaryEn: string;
  interestingFactsBn: string[];
  interestingFactsEn: string[];
  isUrbanThana: boolean;
  isCoastal: boolean;
  isHaor: boolean;
  isHill: boolean;
}

type CuratedUpazilaPatch = Partial<Omit<UpazilaDetail, 'directionLabelBn' | 'directionLabelEn'>>;

const CURATED_UPAZILAS: Record<string, CuratedUpazilaPatch> = {
  // Dhaka Metropolitan & District
  u10: {
    famousForBn: 'ঢাকা জেলার উত্তর-পশ্চিমে বংশী ও গাজীখালী নদীবিধৌত কৃষি ও শিল্পাঞ্চল, ধামরাই রথযাত্রা ও কাঁসা-পিতল শিল্প',
    famousForEn: 'Bangshi–Gazikhali river basin, historic Dhamrai Rath Yatra, and traditional brassware craft',
    landmarksBn: ['ধামরাই জগন্নাথ রথ (ঐতিহ্যবাহী রথযাত্রা)', 'যশোমাধব মন্দির', 'কাঁসা-পিতল কারুপল্লি', 'আলাদিনস পার্ক'],
    landmarksEn: ['Dhamrai Jagannath Rath', 'Yashomadhav Temple', 'Brass & Bell-Metal Craft Village', 'Aladin’s Park'],
    specialtiesBn: 'ঐতিহ্যবাহী কাঁসা ও পিতলের শিল্পকর্ম, মিষ্টান্ন ও মৌসুমি সবজি',
    specialtiesEn: 'Artisanal brass and bell-metalware, traditional sweets, and winter vegetables',
    connectivityBn: 'ঢাকা-আরিচা মহাসড়ক (N5) ও বংশী নদী',
    connectivityEn: 'Dhaka–Aricha Highway (N5) and Bangshi River',
    summaryBn: 'ঢাকার উত্তর-পশ্চিম প্রান্তের সমৃদ্ধ উপজেলা ধামরাই; প্রাচীন রথযাত্রা, কাঁসা-পিতল শিল্প ও ক্রমবর্ধমান শিল্পাঞ্চলের জন্য পরিচিত।',
    summaryEn: 'Located in northwestern Dhaka district, Dhamrai is renowned for its centuries-old Rath Yatra, bell-metal crafts, and growing industrial zones.',
  },
  u36: {
    famousForBn: 'জাতীয় স্মৃতিসৌধ, জাহাঙ্গীরনগর বিশ্ববিদ্যালয়, বিকেএসপি এবং বাংলাদেশের প্রধান তৈরি পোশাক ও শিল্প কেন্দ্র',
    famousForEn: 'National Martyrs’ Memorial, Jahangirnagar University, BKSP, and major garment & industrial hub',
    landmarksBn: ['জাতীয় স্মৃতিসৌধ (নবীনগর)', 'জাহাঙ্গীরনগর বিশ্ববিদ্যালয় ও অতিথি পাখির লেক', 'বিকেএসপি (BKSP)', 'ফ্যান্টাসি কিংডম ও নন্দন পার্ক', 'গোলাপ গ্রাম (সাদুল্লাহপুর)'],
    landmarksEn: ['National Martyrs’ Memorial (Nabinagar)', 'Jahangirnagar University Campus', 'BKSP Sports Complex', 'Golap Gram (Rose Village, Sadullahpur)', 'Fantasy Kingdom'],
    specialtiesBn: 'সাদুল্লাহপুরের গোলাপ ফুল চাষ, দুগ্ধজাত পণ্য (সাভার ডেইরি) ও তৈরি পোশাক শিল্প',
    specialtiesEn: 'Commercial rose farming in Sadullahpur, dairy products, and export-oriented garments & pharmaceuticals',
    historyEconomyBn: '১৯৭১ সালের মহান মুক্তিযুদ্ধের শহীদদের স্মরণে নির্মিত জাতীয় স্মৃতিসৌধ এখানে অবস্থিত। সাভার ও আশুলিয়া দেশের অন্যতম বৃহৎ শিল্প-কারখানা ও ইপিজেড অঞ্চল।',
    historyEconomyEn: 'Home to Bangladesh’s National Martyrs’ Memorial and Dhaka EPZ, Savar–Ashulia forms a backbone of national manufacturing and higher education.',
    connectivityBn: 'ঢাকা-আরিচা ও নবীনগর-চন্দ্রা মহাসড়ক, বংশী ও তুরাগ নদী',
    connectivityEn: 'Dhaka–Aricha & Nabinagar–Chandra Highways; Bangshi & Turag rivers',
    summaryBn: 'রাজধানী ঢাকার ঠিক উত্তর-পশ্চিমে অবস্থিত সাভার উপজেলা ইতিহাস, শিক্ষা, প্রকৃতি ও আধুনিক শিল্পায়নের অনন্য সমন্বয়।',
    summaryEn: 'Bordering Dhaka city to the northwest, Savar blends liberation heritage, university greenery, rose gardens, and major industry.',
  },
  u11: {
    famousForBn: 'ঢাকা শহরের ঐতিহ্যবাহী আবাসিক ও সাংস্কৃতিক কেন্দ্র, ধানমন্ডি লেক, রবীন্দ্র সরোবর ও মুক্তিযুদ্ধ জাদুঘর সংলগ্ন এলাকা',
    famousForEn: 'Historic cultural & residential heart of Dhaka featuring Dhanmondi Lake, Rabindra Sarobar, and cafes',
    landmarksBn: ['ধানমন্ডি লেক ও রবীন্দ্র সরোবর', 'ধানমন্ডি ৩২ বঙ্গবন্ধু স্মৃতি জাদুঘর', 'শংকর ও সাতমসজিদ রোড সাংস্কৃতিক বলয়', 'স্টার মসজিদ সংযোগ ও আবাহনী মাঠ'],
    landmarksEn: ['Dhanmondi Lake & Rabindra Sarobar', 'Dhanmondi 32 Heritage Zone', 'Satmasjid Road Cultural Corridor', 'Abahani Field'],
    specialtiesBn: 'শিক্ষাপ্রতিষ্ঠান, হাসপাতাল, বইয়ের দোকান ও ঢাকাইয়া সংস্কৃতি-খাবারের কেন্দ্র',
    specialtiesEn: 'Leading universities, medical hubs, bookshops, and Dhaka’s vibrant dining scene',
    connectivityBn: 'মিরপুর রোড, সাতমসজিদ রোড ও গ্রীন রোড',
    connectivityEn: 'Mirpur Road, Satmasjid Road, and Green Road',
    summaryBn: '১৯৫০-এর দশকে পরিকল্পিত ধানমন্ডি আজ ঢাকার অন্যতম প্রধান শিক্ষা, চিকিৎসা ও সাংস্কৃতিক প্রাণকেন্দ্র।',
    summaryEn: 'Planned in the 1950s around Dhanmondi Lake, Dhanmondi is a premier educational, healthcare, and cultural hub of Dhaka.',
    isUrbanThana: true,
  },
  u14: {
    famousForBn: 'ঢাকার কূটনৈতিক পাড়া, কর্পোরেট সদর দপ্তর, গুলশান লেক ও আধুনিক বাণিজ্যিক কেন্দ্র',
    famousForEn: 'Dhaka’s diplomatic enclave, corporate headquarters, Gulshan Lake, and modern commercial hub',
    landmarksBn: ['গুলশান লেক পার্ক', 'বিচারপতি সাহাবুদ্দীন আহমদ পার্ক', 'বনানী-গুলশান কূটনৈতিক এলাকা', 'হাতিরঝিল উত্তর প্রান্ত'],
    landmarksEn: ['Gulshan Lake Park', 'Justice Shahabuddin Ahmed Park', 'Diplomatic Enclave', 'Hatirjheel North Waterfront'],
    specialtiesBn: 'আন্তর্জাতিক দূতাবাস, কর্পোরেট অফিস, আধুনিক শপিং ও রেস্তোরাঁ',
    specialtiesEn: 'Foreign embassies, corporate towers, boutique retail, and global cuisine',
    connectivityBn: 'গুলশান এভিনিউ, কামাল আতাতুর্ক এভিনিউ ও হাতিরঝিল',
    connectivityEn: 'Gulshan Avenue, Kemal Ataturk Avenue, and Hatirjheel Expressway',
    summaryBn: 'আধুনিক ঢাকার অর্থনৈতিক ও কূটনৈতিক কেন্দ্রবিন্দু গুলশান থানা; সবুজ লেক পার্ক ও বহুতল বাণিজ্যিক ভবনের জন্য সুপরিচিত।',
    summaryEn: 'Gulshan serves as Dhaka’s diplomatic and financial core, anchored by lakeside parks and modern commercial avenues.',
    isUrbanThana: true,
  },
  u24: {
    famousForBn: 'পুরান ঢাকার ঐতিহাসিক হৃদয়, সদরঘাট লঞ্চ টার্মিনাল, আহসান মঞ্জিল ও শাঁখারীবাজার',
    famousForEn: 'Historic Old Dhaka core featuring Sadarghat river port, Ahsan Manzil, and Shankhari Bazar',
    landmarksBn: ['আহসান মঞ্জিল জাদুঘর', 'সদরঘাট নদীবন্দর (বুড়িগঙ্গা)', 'শাঁখারীবাজার ঐতিহ্যবাহী গলি', 'আর্মেনিয়ান চার্চ ও তারা মসজিদ'],
    landmarksEn: ['Ahsan Manzil Pink Palace', 'Sadarghat River Terminal', 'Shankhari Bazar Heritage Street', 'Armenian Church'],
    specialtiesBn: 'পুরান ঢাকার ঐতিহ্যবাহী বিরিয়ানি, বাকরখানি, শাঁখা-শিল্প ও পাইকারি বাণিজ্য',
    specialtiesEn: 'Old Dhaka biryani, bakarkhani flatbread, conch-shell crafts, and wholesale trade',
    connectivityBn: 'বুড়িগঙ্গা নদীপথ (সদরঘাট) ও নবাবপুর-জগন্নাথ রোড',
    connectivityEn: 'Buriganga River Port (Sadarghat) and Old Dhaka arterial roads',
    summaryBn: 'মুঘল ও নবাবী আমলের ঐতিহ্যবাহী পুরান ঢাকার প্রাণকেন্দ্র কোতওয়ালী; বুড়িগঙ্গার তীরে সদরঘাট ও আহসান মঞ্জিলের জন্য বিখ্যাত।',
    summaryEn: 'At the historic core of Old Dhaka on the Buriganga River, Kotwali preserves Mughal-era landmarks, Ahsan Manzil, and Sadarghat port.',
    isUrbanThana: true,
  },
  u25: {
    famousForBn: 'ঐতিহাসিক লালবাগ কেল্লা, চকবাজার ও ঢাকেশ্বরী জাতীয় মন্দির',
    famousForEn: 'Mughal-era Lalbagh Fort, Dhakeshwari National Temple, and historic Old Dhaka quarters',
    landmarksBn: ['লালবাগ কেল্লা (১৬৭৮)', 'ঢাকেশ্বরী জাতীয় মন্দির', 'খান মোহাম্মদ মৃধা মসজিদ', 'হোসেনী দালান'],
    landmarksEn: ['Lalbagh Fort (1678)', 'Dhakeshwari National Temple', 'Khan Mohammad Mridha Mosque', 'Hossaini Dalan'],
    specialtiesBn: 'ঐতিহাসিক মুঘল স্থাপত্য, প্লাস্টিক ও কুটির শিল্প এবং ঢাকাইয়া খাবার',
    specialtiesEn: 'Mughal architecture, traditional crafts, and Old Dhaka culinary heritage',
    connectivityBn: 'আজিমপুর-পলাশী সড়ক ও বুড়িগঙ্গা নদী তীর',
    connectivityEn: 'Azimpur–Palashi corridor and Buriganga riverfront',
    summaryBn: 'মুঘল সুবেদার শায়েস্তা খাঁর আমলের লালবাগ কেল্লা ও প্রাচীন স্থাপত্যের জন্য লালবাগ বাংলাদেশের অন্যতম ঐতিহাসিক এলাকা।',
    summaryEn: 'Renowned for the 17th-century Lalbagh Fort and Dhakeshwari Temple, Lalbagh holds some of Dhaka’s richest Mughal heritage.',
    isUrbanThana: true,
  },
  u26: {
    famousForBn: 'জাতীয় চিড়িয়াখানা, জাতীয় উদ্ভিদ উদ্যান, শের-ই-বাংলা জাতীয় ক্রিকেট স্টেডিয়াম ও মিরপুর বেনারসি পল্লি',
    famousForEn: 'National Cricket Stadium, Dhaka Zoo, Botanical Garden, and Mirpur Benarasi Silk Village',
    landmarksBn: ['শের-ই-বাংলা জাতীয় ক্রিকেট স্টেডিয়াম', 'বাংলাদেশ জাতীয় চিড়িয়াখানা', 'জাতীয় উদ্ভিদ উদ্যান (বোটানিক্যাল গার্ডেন)', 'মিরপুর শহীদ বুদ্ধিজীবী স্মৃতিসৌধ'],
    landmarksEn: ['Sher-e-Bangla National Cricket Stadium', 'Bangladesh National Zoo', 'National Botanical Garden', 'Martyred Intellectuals Memorial'],
    specialtiesBn: 'মিরপুরের ঐতিহ্যবাহী বেনারসি ও কাতান শাড়ি, শিক্ষা ও ক্রীড়া অবকাঠামো',
    specialtiesEn: 'Famous Mirpur Benarasi & Katan handloom sarees, sports venues, and residential hubs',
    connectivityBn: 'ঢাকা মেট্রোরেল (MRT Line-6) ও রোকেয়া সরণি',
    connectivityEn: 'Dhaka Metro Rail (MRT Line-6) and Begum Rokeya Sarani',
    summaryBn: 'উত্তর-পশ্চিম ঢাকার ঘনবসতিপূর্ণ ও প্রাণবন্ত অঞ্চল মিরপুর; ক্রিকেট স্টেডিয়াম, বোটানিক্যাল গার্ডেন এবং বেনারসি শাড়ির জন্য খ্যাত।',
    summaryEn: 'A major northwestern hub of Dhaka famous for the National Cricket Stadium, Botanical Garden, Metro Rail, and Benarasi weavers.',
    isUrbanThana: true,
  },
  u38: {
    famousForBn: 'ঢাকা বিশ্ববিদ্যালয়, বাংলাদেশ জাতীয় জাদুঘর, বাংলা একাডেমি, কেন্দ্রীয় শহীদ মিনার ও রমনা পার্ক',
    famousForEn: 'University of Dhaka, National Museum, Central Shaheed Minar, Bangla Academy, and Ramna Park',
    landmarksBn: ['কেন্দ্রীয় শহীদ মিনার', 'ঢাকা বিশ্ববিদ্যালয় ও কার্জন হল', 'বাংলাদেশ জাতীয় জাদুঘর', 'সোহরাওয়ার্দী উদ্যান ও স্বাধীনতা স্তম্ভ', 'রমনা পার্ক ও টিএসসি'],
    landmarksEn: ['Central Shaheed Minar', 'University of Dhaka & Curzon Hall', 'Bangladesh National Museum', 'Suhrawardy Udyan', 'Ramna Park'],
    specialtiesBn: 'অমর একুশে বইমেলা, ভাষা আন্দোলন ও মুক্তিযুদ্ধের ঐতিহাসিক স্মৃতিস্থান',
    specialtiesEn: 'Ekushey Book Fair, Language Movement monuments, and national academic institutions',
    connectivityBn: 'শাহবাগ মোড় ও ঢাকা মেট্রোরেল (টিএসসি-শাহবাগ স্টেশন)',
    connectivityEn: 'Shahbagh Intersection and Dhaka Metro Rail stations',
    summaryBn: 'বাংলাদেশের শিক্ষা, সাহিত্য, ভাষা আন্দোলন ও সংস্কৃতির মূল কেন্দ্র শাহবাগ; কার্জন হল থেকে শহীদ মিনার পর্যন্ত ঐতিহাসিক স্থাপনা এখানে।',
    summaryEn: 'The intellectual and cultural heart of Bangladesh, encompassing Dhaka University, Central Shaheed Minar, and the National Museum.',
    isUrbanThana: true,
  },
  u46: {
    famousForBn: 'সুপরিকল্পিত আবাসিক মডেল টাউন, হযরত শাহজালাল আন্তর্জাতিক বিমানবন্দর সংলগ্ন এবং আধুনিক বাণিজ্যিক কেন্দ্র',
    famousForEn: 'Planned northern residential hub of Dhaka adjacent to Hazrat Shahjalal International Airport',
    landmarksBn: ['উত্তরা লেক ও পার্ক', 'দিয়াবাড়ি মেট্রোরেল ডিপো ও পর্যটন এলাকা', 'মুগ্ধ মঞ্চ ও রবীন্দ্র সরণি'],
    landmarksEn: ['Uttara Lake & Sector Parks', 'Diabari Waterfront & Metro Depot', 'Uttara University & Shopping Avenues'],
    specialtiesBn: 'আধুনিক পরিকল্পিত সেক্টর, মেট্রোরেল টার্মিনাল ও বিমানবন্দর সংযোগ',
    specialtiesEn: 'Grid-planned urban sectors, Metro Rail northern terminus, and aviation gateway',
    connectivityBn: 'ঢাকা-ময়মনসিংহ মহাসড়ক, বিমানবন্দর সড়ক ও মেট্রোরেল উত্তরা উত্তর স্টেশন',
    connectivityEn: 'Dhaka–Mymensingh Highway, Airport Road, and MRT Line-6',
    summaryBn: 'রাজধানী ঢাকার উত্তর প্রবেশদ্বার উত্তরা; প্রশস্ত সড়ক, লেক, বিমানবন্দর ও মেট্রোরেল সংযোগের জন্য সুপরিচিত।',
    summaryEn: 'Dhaka’s northern gateway known for planned numbered sectors, lakeside promenades, and direct airport and Metro Rail access.',
    isUrbanThana: true,
  },

  // Narayanganj / Munshiganj / Gopalganj / Kishoreganj / Madaripur / Tangail / Netrokona
  u119: {
    famousForBn: 'মধ্যযুগীয় বাংলার প্রাচীন রাজধানী, পানাম নগর, লোক ও কারুশিল্প জাদুঘর এবং গোয়ালদী মসজিদ',
    famousForEn: 'Medieval capital of Bengal featuring Panam Nagar, Folk Arts Museum, and Goaldi Mosque',
    landmarksBn: ['পানাম নগর (ঐতিহাসিক বণিক শহর)', 'বাংলাদেশ লোক ও কারুশিল্প জাদুঘর (বড় সরদার বাড়ি)', 'গোয়ালদী শাহী মসজিদ (১৫১৯)', 'গিয়াসউদ্দিন আযম শাহের মাজার', 'বাংলার তাজমহল ও মায়াদ্বীপ'],
    landmarksEn: ['Panam Nagar Heritage Street', 'Bangladesh Folk Arts & Crafts Museum', 'Goaldi Mosque (1519)', 'Tomb of Sultan Ghiyasuddin Azam Shah'],
    specialtiesBn: 'ঐতিহ্যবাহী জামদানি বুনন, নকশীকাঁথা ও বাংলার সুলতানি ইতিহাস',
    specialtiesEn: 'Jamdani handloom weaving, folk crafts, and Sultanate-era history',
    connectivityBn: 'ঢাকা-চট্টগ্রাম মহাসড়ক (মোগরাপাড়া), মেঘনা ও শীতলক্ষ্যা নদী',
    connectivityEn: 'Dhaka–Chattogram Highway (N1), Meghna & Shitalakshya rivers',
    summaryBn: 'বাংলার সুলতানি আমলের রাজধানী সোনারগাঁও আজ পানাম নগর ও লোকশিল্প জাদুঘরের জন্য দেশের অন্যতম শীর্ষ ঐতিহাসিক গন্তব্য।',
    summaryEn: 'Once the medieval capital of Bengal, Sonargaon preserves the haunting merchant ruins of Panam Nagar and the Folk Arts Museum.',
  },
  u98: {
    famousForBn: 'পদ্মা বহুমুখী সেতুর উত্তর প্রান্ত (মাওয়া), পদ্মার তাজা ইলিশ ও বিক্রমপুরের আড়িয়াল বিল',
    famousForEn: 'Northern gateway of the Padma Multipurpose Bridge (Mawa), fresh Padma hilsa, and riverine heritage',
    landmarksBn: ['পদ্মা সেতু মাওয়া প্রান্ত ও সার্ভিস এরিয়া', 'মাওয়া ফেরি ও ইলিশ ঘাট', 'শিমুলিয়া ঘাট বিনোদন এলাকা'],
    landmarksEn: ['Padma Bridge North Approach (Mawa)', 'Mawa Hilsa Ghat', 'Shimulia Riverfront'],
    specialtiesBn: 'পদ্মা নদীর তাজা ইলিশ ও মাওয়া ঘাটের ইলিশ ভাজা-ভর্তা',
    specialtiesEn: 'Fresh Padma River hilsa fish and riverside culinary culture',
    connectivityBn: 'ঢাকা-মাওয়া-ভাঙ্গা এক্সপ্রেসওয়ে (N8) ও পদ্মা সেতু',
    connectivityEn: 'Dhaka–Mawa–Bhanga Expressway (N8) via Padma Bridge',
    summaryBn: 'পদ্মার উত্তর তীরে অবস্থিত লৌহজং উপজেলা পদ্মা সেতুর উত্তর প্রবেশদ্বার ও সুস্বাদু ইলিশের জন্য দেশব্যাপী পরিচিত।',
    summaryEn: 'Sitting on the Padma’s north bank, Lohajang anchors the northern approach to the Padma Bridge and famous Mawa hilsa markets.',
  },
  u89: {
    famousForBn: 'পদ্মা বহুমুখী সেতুর দক্ষিণ প্রান্ত (জাজিরা-শিবচর সংযোগ), পদ্মা-আড়িয়াল খাঁ নদী ও তাঁত শিল্প',
    famousForEn: 'Southern gateway corridor of Padma Bridge, Arial Khan–Padma confluence, and handloom crafts',
    landmarksBn: ['পদ্মা সেতু দক্ষিণ টোল প্লাজা ও সংযোগ সড়ক', 'বাহাদুরপুর দরবার শরীফ', 'চান্দেরচর ও পদ্মার চর'],
    landmarksEn: ['Padma Bridge South Approach', 'Bahadurpur Heritage Site', 'Padma–Arial Khan Riverfront'],
    specialtiesBn: 'তাঁতবস্ত্র, পাট ও পদ্মার মাছ',
    specialtiesEn: 'Handloom weaving, jute, and river fisheries',
    connectivityBn: 'পদ্মা সেতু ও ঢাকা-ভাঙ্গা-খুলনা এক্সপ্রেসওয়ে',
    connectivityEn: 'Padma Bridge & Dhaka–Bhanga Expressway',
    summaryBn: 'মাদারীপুর জেলার উত্তর-পূর্ব প্রান্তের শিবচর উপজেলা পদ্মা সেতু সংযোগের ফলে দক্ষিণবঙ্গের প্রধান প্রবেশপথে পরিণত হয়েছে।',
    summaryEn: 'In northeastern Madaripur, Shibchar has become a strategic gateway connecting southern Bangladesh to Dhaka via the Padma Bridge.',
  },
  u65: {
    famousForBn: 'বঙ্গবন্ধু সমাধিসৌধ, মধুমতী নদী ও বাগিয়ার বিলের প্রাকৃতিক পরিবেশ',
    famousForEn: 'Historic Tungipara mausoleum complex, Madhumati River, and serene wetland heritage',
    landmarksBn: ['টুঙ্গিপাড়া সমাধিসৌধ কমপ্লেক্স', 'মধুমতী নদীর পাড়', 'পাটগাতী নৌবন্দর ও বাগিয়ার বিল'],
    landmarksEn: ['Tungipara Mausoleum Complex', 'Madhumati Riverfront', 'Patgati Waterway & Bagiar Beel'],
    specialtiesBn: 'ধান, পাট, খেজুরের গুড় ও মিঠাপানির মাছ',
    specialtiesEn: 'Rice, jute, date-palm molasses, and freshwater fish',
    connectivityBn: 'গোপালগঞ্জ-টুঙ্গিপাড়া সড়ক ও মধুমতী নদীপথ',
    connectivityEn: 'Gopalganj–Tungipara Highway and Madhumati River',
    summaryBn: 'মধুমতী ও বাগিয়ার বিলের তীরে অবস্থিত টুঙ্গিপাড়া গোপালগঞ্জ জেলার ঐতিহাসিক ও শান্ত জলজ জনপদ।',
    summaryEn: 'Set along the Madhumati River in southern Gopalganj, Tungipara is a historic riverside upazila surrounded by lush wetlands.',
  },
  u73: {
    famousForBn: 'বিখ্যাত পনির ও ইটাখোলা-অষ্টগ্রাম হাওর, ঐতিহাসিক কুতুব শাহ মসজিদ (ষোড়শ শতক) ও হাওরের অল-ওয়েদার সড়ক',
    famousForEn: 'Famous Austagram artisan cheese, 16th-century Qutub Shah Mosque, and scenic haor wetlands',
    landmarksBn: ['অষ্টগ্রাম কুতুব শাহ মসজিদ (ষোড়শ শতক)', 'ইটনা-মিঠামইন-অষ্টগ্রাম হাওর অল-ওয়েদার সড়ক', 'ভাতশালা হাওর'],
    landmarksEn: ['16th-Century Qutub Shah Mosque', 'Itna–Mithamain–Austagram All-Weather Haor Road', 'Bhatshala Haor'],
    specialtiesBn: 'অষ্টগ্রামের ঐতিহ্যবাহী পনির (দুগ্ধজাত) ও হাওরের শুঁটকি-মিঠাপানির মাছ',
    specialtiesEn: 'Traditional Austagram artisan cheese and abundant haor freshwater fish',
    connectivityBn: 'হাওর অল-ওয়েদার সড়ক (ইটনা-মিঠামইন-অষ্টগ্রাম) ও ধনু-মেঘনা নৌপথ',
    connectivityEn: 'Haor All-Weather Road and Dhanu–Meghna waterways',
    summaryBn: 'কিশোরগঞ্জের হাওরবেষ্টিত অষ্টগ্রাম উপজেলা ষোড়শ শতকের কুতুব শাহ মসজিদ এবং ঐতিহ্যবাহী পনিরের জন্য দেশখ্যাত।',
    summaryEn: 'Surrounded by vast seasonal wetlands in Kishoreganj, Austagram is famous for heritage artisan cheese and the 16th-century Qutub Shah Mosque.',
    isHaor: true,
  },
  u82: {
    famousForBn: 'ইটনা-মিঠামইন-অষ্টগ্রাম দৃষ্টিনন্দন হাওর সড়ক, দিল্লির আখড়া (৪০০ বছরের পুরনো) ও বিশাল হাওর পর্যটন',
    famousForEn: 'Scenic Itna–Mithamain–Austagram all-weather haor road and 400-year-old Dilli Akhara',
    landmarksBn: ['মিঠামইন হাওর অল-ওয়েদার সড়ক', 'দিল্লির আখড়া (হিজল বন ও ঐতিহাসিক আশ্রম)', 'মালিকপুর ও ঘোড়াউত্রা নদীর তীর'],
    landmarksEn: ['Mithamain All-Weather Haor Road', '400-Year-Old Dilli Akhara & Hijal Forest', 'Ghorautra Riverbank'],
    specialtiesBn: 'বোরো ধান, হাওরের মিঠাপানির মাছ ও হাঁসের ডিম',
    specialtiesEn: 'Boro rice, haor fisheries, and duck farming',
    connectivityBn: 'মিঠামইন-করিমগঞ্জ-অষ্টগ্রাম সড়ক ও বর্ষায় নৌযান',
    connectivityEn: 'Haor All-Weather Road and seasonal river ferries',
    summaryBn: 'জলমগ্ন হাওরের বুক চিরে যাওয়া অল-ওয়েদার সড়কের কারণে মিঠামইন বাংলাদেশের অন্যতম জনপ্রিয় পর্যটন গন্তব্যে পরিণত হয়েছে।',
    summaryEn: 'Famous for the elevated highway cutting across endless monsoon waters, Mithamain is a centerpiece of Bangladesh’s haor region.',
    isHaor: true,
  },
  u83: {
    famousForBn: 'নিকলী হাওরের অপরূপ জলরাশি, বেরিবাঁধ পর্যটন কেন্দ্র ও শতবর্ষী হিজল-করচ বন',
    famousForEn: 'Nikli Haor monsoon seascape, scenic embankment, and swamp-forest islands',
    landmarksBn: ['নিকলী হাওর ও বেরিবাঁধ', 'ছতিরচর হিজল-করচ বন', 'গুরই শাহী মসজিদ'],
    landmarksEn: ['Nikli Haor & Embankment', 'Chhatirchar Swamp Forest', 'Guroi Shahi Mosque'],
    specialtiesBn: 'বোরো ধান, হাওরের দেশি মাছ ও গবাদিপশু',
    specialtiesEn: 'Boro rice and fresh haor fish',
    connectivityBn: 'কিশোরগঞ্জ-নিকলী সড়ক ও নৌপথ',
    connectivityEn: 'Kishoreganj–Nikli Road and waterways',
    summaryBn: 'বর্ষাকালে সাগরের মতো বিস্তৃত জলরাশির জন্য নিকলী হাওর ভ্রমণপিপাসুদের কাছে অত্যন্ত আকর্ষণীয় এক জনপদ।',
    summaryEn: 'Turning into an inland sea during the monsoon, Nikli in Kishoreganj is beloved for boat tours and submerged hijal groves.',
    isHaor: true,
  },
  u128: {
    famousForBn: 'গারো পাহাড়ের পাদদেশে চিনামাটির নীল পাহাড় (বিজয়পুর), সোমেশ্বরী নদী ও রাণীখং মিশন',
    famousForEn: 'Birishiri white-clay hills & turquoise lakes, Someshwari River, and Garo cultural heritage',
    landmarksBn: ['বিজয়পুর চিনামাটির পাহাড় ও নীল পানির হ্রদ', 'সোমেশ্বরী নদী', 'রাণীখং ক্যাথলিক মিশন', 'টংক আন্দোলনের স্মৃতিস্তম্ভ ও বিরিশিরি কালচারাল একাডেমি'],
    landmarksEn: ['Bijoypur White Clay Hills & Turquoise Lakes', 'Someshwari River', 'Ranikhong Hilltop Mission', 'Birishiri Tribal Cultural Academy'],
    specialtiesBn: 'চিনামাটি (সাদা মাটি), গারো ও হাজং আদিবাসী সংস্কৃতি এবং নদীবাহিত পাথর-বালু',
    specialtiesEn: 'White kaolin clay deposits, Garo–Hajong weaving, and Someshwari river sands',
    connectivityBn: 'নেত্রকোনা-শ্যামগঞ্জ-দুর্গাপুর সড়ক ও সোমেশ্বরী নদী',
    connectivityEn: 'Netrokona–Birishiri Road and Someshwari River',
    summaryBn: 'নেত্রকোনার উত্তর সীমান্তে গারো পাহাড়ের কোলে দুর্গাপুর (বিরিশিরি) চিনামাটির পাহাড় ও স্বচ্ছ সোমেশ্বরী নদীর জন্য খ্যাত।',
    summaryEn: 'Nestled against the Garo Hills on the Meghalaya border, Durgapur (Birishiri) is famous for kaolin hills and the Someshwari River.',
  },
  u159: {
    famousForBn: 'মধুপুর শালবন জাতীয় উদ্যান, পীরগাছা রাবার বাগান ও দেশের বিখ্যাত মধুপুর আনারস',
    famousForEn: 'Madhupur Sal Forest National Park, rubber plantations, and famous Madhupur pineapples',
    landmarksBn: ['মধুপুর জাতীয় উদ্যান (দোখলা শালবন)', 'পীরগাছা রাবার বাগান', 'জলছত্র গারো পল্লি ও মিশন'],
    landmarksEn: ['Madhupur National Park (Dokhla)', 'Pirgachha Rubber Estate', 'Jalachhatra Garo Village'],
    specialtiesBn: 'মধুপুরের জিআই/বিখ্যাত আনারস (জলডুগি ও জায়ান্ট কিউ), কাঁঠাল ও কলা',
    specialtiesEn: 'Sweet Madhupur pineapples, bananas, jackfruit, and natural rubber',
    connectivityBn: 'টাঙ্গাইল-ময়মনসিংহ মহাসড়ক',
    connectivityEn: 'Tangail–Mymensingh Highway',
    summaryBn: 'প্রাকৃতিক শালবন, লালমাটির গড় ও সুস্বাদু আনারসের জন্য টাঙ্গাইলের মধুপুর উপজেলা সারা দেশে পরিচিত।',
    summaryEn: 'Famous for its red-soil Sal forest, Garo heritage, and Bangladesh’s finest pineapples, Madhupur anchors northern Tangail.',
  },
  u163: {
    famousForBn: 'ঐতিহ্যবাহী টাঙ্গাইল শাড়ি (সন্তোষ-পাথরাইল), পোড়াবাড়ির চমচম ও করটিয়া-সন্তোষ জমিদার ইতিহাস',
    famousForEn: 'GI-tagged Tangail handloom sarees, Porabari Chomchom sweets, and Santosh–Atia heritage',
    landmarksBn: ['পাথরাইল টাঙ্গাইল শাড়ি তাঁতপল্লি', 'সন্তোষ মাওলানা ভাসানী বিজ্ঞান ও প্রযুক্তি বিশ্ববিদ্যালয়', 'পোড়াবাড়ির ঐতিহাসিক চমচম বাজার', 'এসপি পার্ক ও ডিসি লেক'],
    landmarksEn: ['Pathrail Tangail Saree Weaving Village', 'Santosh (MBSTU Campus)', 'Porabari Sweet Market', 'DC Lake Tangail'],
    specialtiesBn: 'জিআই স্বীকৃত টাঙ্গাইল শাড়ি ও পোড়াবাড়ির আসল চমচম',
    specialtiesEn: 'GI-certified Tangail cotton/jamdani sarees and Porabari Chomchom',
    connectivityBn: 'ঢাকা-টাঙ্গাইল-বঙ্গবন্ধু সেতু মহাসড়ক (N4) ও রেলপথ',
    connectivityEn: 'Dhaka–Tangail Highway (N4) and Tangail Railway Station',
    summaryBn: 'টাঙ্গাইল জেলার কেন্দ্রস্থল টাঙ্গাইল সদর বিশ্বখ্যাত টাঙ্গাইল শাড়ি ও পোড়াবাড়ির চমচমের আঁতুড়ঘর।',
    summaryEn: 'The heart of Tangail district, celebrated worldwide for handwoven Tangail sarees and iconic Porabari Chomchom sweets.',
  },
  u72: {
    famousForBn: 'তারাকান্দির যমুনা সার কারখানা, ঐতিহাসিক জগন্নাথগঞ্জ ঘাট এবং পাট-ধান কৃষি ও রেলসংযোগ',
    famousForEn: 'Jamuna Fertilizer Factory at Tarakandi, historic Jagannathganj Ghat, jute farming, and railway links',
    landmarksBn: [
      'যমুনা ফার্টিলাইজার কোম্পানি লিমিটেড (তারাকান্দি)',
      'জগন্নাথগঞ্জ ঘাট ও যমুনা-ঝিনাই তীর',
      'পিংনা ঐতিহাসিক বন্দর ও সরিষাবাড়ী রেলস্টেশন',
      'বীর ধনু মিয়া ও মুক্তিযুদ্ধ স্মৃতিসৌধ',
    ],
    landmarksEn: [
      'Jamuna Fertilizer Company Limited (Tarakandi)',
      'Jagannathganj Ghat & Jamuna–Jhenai Riverside',
      'Historic Pingna Trade Center & Sarishabari Railway Station',
      'Sarishabari Liberation War Memorial',
    ],
    interestingFactsBn: [
      'সরিষাবাড়ীর তারাকান্দিতে বাংলাদেশের অন্যতম বৃহৎ সরকারি ইউরিয়া সার কারখানা ‘যমুনা ফার্টিলাইজার’ অবস্থিত।',
      'ময়মনসিংহ বিভাগে অবস্থিত হলেও সরিষাবাড়ী সরাসরি ঢাকা (টাঙ্গাইল) ও রাজশাহী (বগুড়া ও সিরাজগঞ্জ)—৩টি ভিন্ন বিভাগের জেলার সাথে সীমান্ত স্পর্শ করেছে।',
      'ব্রিটিশ ও পাকিস্তান আমলে সরিষাবাড়ীর জগন্নাথগঞ্জ ঘাট ও পিংনা নদীবন্দর উত্তরবঙ্গের অন্যতম ব্যস্ত পাট ও স্টিমার ঘাট ছিল।',
      'সরিষাবাড়ীতে মোট ৮টি পার্শ্ববর্তী উপজেলা রয়েছে, যার মধ্যে ৫টিই নিজ জেলা জামালপুরের বাইরের।',
    ],
    interestingFactsEn: [
      'Hosts Jamuna Fertilizer Company Ltd. at Tarakandi—one of Bangladesh’s largest urea fertilizer plants.',
      'Situated in Mymensingh Division, Sarishabari touches districts from three divisions simultaneously (Jamalpur, Tangail, Bogura, and Sirajganj).',
      'Jagannathganj Ghat and Pingna historically served as bustling river-steamer and jute hubs linking northern and central Bengal.',
      'Surrounded by 8 bordering upazilas—5 of which lie across neighboring districts.',
    ],
    specialtiesBn: 'ইউরিয়া সার উৎপাদন, সোনালি আঁশ পাট, বোরো ধান, সরিষা ও মিঠাপানির মাছ',
    specialtiesEn: 'Urea fertilizer production, golden jute fiber, Boro rice, mustard & river fish',
    historyEconomyBn: 'জামালপুর জেলার দক্ষিণাঞ্চলের প্রধান শিল্প ও কৃষি কেন্দ্র। তারাকান্দির যমুনা সার কারখানা জাতীয় কৃষি সরবরাহে গুরুত্বপূর্ণ ভূমিকা রাখে; পাশাপাশি ঝিনাই ও যমুনা অববাহিকায় পাট ও ধান চাষ সমৃদ্ধ।',
    historyEconomyEn: 'A major industrial-agrarian hub of southern Jamalpur anchored by the Tarakandi urea fertilizer complex and fertile jute and paddy plains.',
    connectivityBn: 'জামালপুর-সরিষাবাড়ী-তারাকান্দি-ভূঞাপুর মহাসড়ক ও তারাকান্দি-বঙ্গবন্ধু সেতু পূর্ব রেলপথ',
    connectivityEn: 'Jamalpur–Sarishabari–Bhuapur Highway and Tarakandi–Jamuna Bridge East Railway',
    summaryBn: 'জামালপুর জেলার দক্ষিণ প্রান্তের সমৃদ্ধ উপজেলা সরিষাবাড়ী; তারাকান্দি যমুনা সার কারখানা, ঐতিহাসিক জগন্নাথগঞ্জ ঘাট ও পাট-কৃষির জন্য পরিচিত।',
    summaryEn: 'At the southern tip of Jamalpur District, Sarishabari is renowned for the Jamuna Fertilizer Factory, historic Jagannathganj Ghat, and jute cultivation.',
  },

  // Chattogram Division & Hill Tracts & Cox's Bazar
  u378: {
    famousForBn: 'চন্দ্রনাথ পাহাড় ও মন্দির, গুলিয়াখালী সমুদ্রসৈকত, মহামায়া-বাঁশবাড়িয়া এবং দেশের বৃহত্তম জাহাজভাঙা শিল্প',
    famousForEn: 'Chandranath Hill & Temple, Guliakhali Sea Beach, Mahamaya-adjacent hills, and ship-recycling coast',
    landmarksBn: ['চন্দ্রনাথ পাহাড় ও মন্দির', 'গুলিয়াখালী সমুদ্রসৈকত (সবুজ ঘাসের সৈকত)', 'বাঁশবাড়িয়া সমুদ্রসৈকত', 'সীতাকুণ্ড ইকোপার্ক (সহস্রধারা ও সুপ্তধারা ঝরনা)', 'কুমিরা-সন্দ্বীপ ফেরিঘাট'],
    landmarksEn: ['Chandranath Hill & Shrine', 'Guliakhali Sea Beach', 'Sitakunda Eco-Park & Waterfalls', 'Banshbaria Beach'],
    specialtiesBn: 'সীতাকুণ্ডের শিম, পাহাড়ি জলপ্রপাত, ইস্পাত ও জাহাজভাঙা শিল্প',
    specialtiesEn: 'Winter hyacinth beans, waterfall trails, and coastal steel/ship-recycling industry',
    connectivityBn: 'ঢাকা-চট্টগ্রাম মহাসড়ক (N1) ও রেলপথ',
    connectivityEn: 'Dhaka–Chattogram Highway (N1) and Railway',
    summaryBn: 'একদিকে সুউচ্চ চন্দ্রনাথ পাহাড় ও ঝরনা, অন্যদিকে বঙ্গোপসাগরের গুলিয়াখালী সৈকত—সীতাকুণ্ড প্রকৃতিপ্রেমীদের প্রিয় গন্তব্য।',
    summaryEn: 'Flanked by the Sitakunda hill range and the Bay of Bengal, Sitakunda combines Chandranath peak, waterfalls, and Guliakhali beach.',
    isCoastal: true,
    isHill: true,
  },
  u376: {
    famousForBn: 'বঙ্গোপসাগরের বুকে বিচ্ছিন্ন ঐতিহাসিক দ্বীপ উপজেলা; নারিকেল ও সন্দ্বীপ চ্যানেলের ফেরি/স্টিমার পথ',
    famousForEn: 'Historic offshore island upazila in the Bay of Bengal, known for maritime culture and green coastal chars',
    landmarksBn: ['রহমতপুর ও গাছুয়া বেড়িবাঁধ', 'সন্দ্বীপ স্টিমার ঘাট (গুপ্তছড়া)', 'মরিয়ম বিবি শাহী মসজিদ', 'উরির চর'],
    landmarksEn: ['Guptachhara Ghat', 'Sandwip Coastal Embankment', 'Mariam Bibi Shahi Mosque', 'Urir Char'],
    specialtiesBn: 'সন্দ্বীপের মিষ্টি আলু, ইলিশ, খেজুরের গুড় ও প্রবাসী রেমিট্যান্স অর্থনীতি',
    specialtiesEn: 'Island hilsa, sweet potatoes, coconut, and seafaring heritage',
    connectivityBn: 'সীতাকুণ্ড (কুমিরা)-গুপ্তছড়া ফেরি/স্পিডবোট ও স্টিমার',
    connectivityEn: 'Sea ferry & speedboat links to Kumira (Sitakunda) and Chattogram',
    summaryBn: 'বঙ্গোপসাগরের উত্তর-পূর্ব মোহনায় অবস্থিত প্রাচীন দ্বীপ সন্দ্বীপ; সমুদ্রযাত্রা ও সামুদ্রিক ঐতিহ্যের জন্য খ্যাত।',
    summaryEn: 'An ancient offshore island at the Meghna estuary, Sandwip is renowned for its maritime history and fertile island agriculture.',
    isCoastal: true,
  },
  u372: {
    famousForBn: 'পতেঙ্গা সমুদ্রসৈকত, কর্ণফুলী টানেল (উত্তর প্রান্ত), শাহ আমানত আন্তর্জাতিক বিমানবন্দর ও নেভাল একাডেমি',
    famousForEn: 'Patenga Sea Beach, Karnaphuli Underwater Tunnel portal, and Shah Amanat International Airport',
    landmarksBn: ['পতেঙ্গা সমুদ্রসৈকত', 'কর্ণফুলী নদীর মোহনা (নেভাল-২)', 'কর্ণফুলী টানেল পতেঙ্গা প্রান্ত', 'প্রজাপতি পার্ক'],
    landmarksEn: ['Patenga Sea Beach', 'Karnaphuli River Estuary (Naval Beach)', 'Karnaphuli Tunnel Portal', 'Butterfly Park'],
    specialtiesBn: 'সমুদ্রসৈকত পর্যটন, ইপিজেড শিল্পাঞ্চল ও তেল-গ্যাস টার্মিনাল',
    specialtiesEn: 'Coastal tourism, Chattogram EPZ, and maritime port/airport logistics',
    connectivityBn: 'শাহ আমানত বিমানবন্দর, কর্ণফুলী টানেল ও আউটার রিং রোড',
    connectivityEn: 'Shah Amanat Int’l Airport, Karnaphuli Tunnel, and Marine Drive Ring Road',
    summaryBn: 'কর্ণফুলী নদী ও বঙ্গোপসাগরের সঙ্গমস্থলে অবস্থিত পতেঙ্গা চট্টগ্রাম শহরের অন্যতম প্রধান বিনোদন ও কৌশলগত বিমান-নৌ কেন্দ্র।',
    summaryEn: 'Where the Karnaphuli meets the Bay of Bengal, Patenga hosts Chattogram’s iconic sunset beach, international airport, and underwater tunnel.',
    isCoastal: true,
    isUrbanThana: true,
  },
  u367: {
    famousForBn: 'চট্টগ্রাম শহরের ঐতিহাসিক কেন্দ্র, চট্টগ্রাম বন্দর সংলগ্ন সদরঘাট, নিউমার্কেট ও পাহাড়তলী-সিআরবি এলাকা',
    famousForEn: 'Historic commercial core of Chattogram city, CRB greenery, Court Building Hill, and port gateway',
    landmarksBn: ['সিআরবি (CRB) ও শিরীষ তলা', 'কোর্ট বিল্ডিং হিল (পরীর পাহাড়)', 'আন্দরকিল্লা শাহী জামে মসজিদ (১৬৬৭)', 'চট্টগ্রাম স্টেশন রোড ও ফিরিঙ্গিবাজার'],
    landmarksEn: ['CRB Heritage Hills', 'Court Building (Fairy Hill)', 'Anderkilla Shahi Mosque (1667)', 'Firingi Bazar'],
    specialtiesBn: 'বাণিজ্যিক কেন্দ্র, ঐতিহ্যবাহী মেজবানি খাবার ও পাহাড়ি নগর সংস্কৃতি',
    specialtiesEn: 'Commercial trade, traditional Mezban cuisine, and colonial-era hilltop landmarks',
    connectivityBn: 'চট্টগ্রাম রেলওয়ে স্টেশন ও কর্ণফুলী নদীর পাড়',
    connectivityEn: 'Chattogram Railway Station and Karnaphuli riverfront',
    summaryBn: 'বন্দরনগরী চট্টগ্রামের ঐতিহাসিক ও বাণিজ্যিক হৃদয় কোতোয়ালী; ১৬৬৭ সালের আন্দরকিল্লা মসজিদ ও সিআরবি পাহাড়ের জন্য প্রসিদ্ধ।',
    summaryEn: 'The historic core of Chattogram port city, bridging 17th-century Mughal mosques, hilltop colonial buildings, and bustling markets.',
    isUrbanThana: true,
  },
  u396: {
    famousForBn: 'বিশ্বের দীর্ঘতম প্রাকৃতিক সমুদ্রসৈকত (কলাতলী-লাবণী), মেরিন ড্রাইভ ও আন্তর্জাতিক পর্যটন রাজধানী',
    famousForEn: 'World’s longest unbroken sea beach (Laboni–Kolatoli), Marine Drive, and Bangladesh’s tourism capital',
    landmarksBn: ['লাবণী, সুগন্ধা ও কলাতলী সমুদ্রসৈকত', 'কক্সবাজার আন্তর্জাতিক রেলস্টেশন (ঝিনুক আকৃতি)', 'বৌদ্ধ মন্দির (অগ্গমেধা ক্যাং) ও বার্মিজ মার্কেট', 'কক্সবাজার-টেকনাফ মেরিন ড্রাইভ শুরু'],
    landmarksEn: ['Laboni & Kolatoli Sea Beach', 'Oyster-Shaped Cox’s Bazar Railway Station', 'Aggmeda Khyang Monastery', 'Marine Drive Gateway'],
    specialtiesBn: 'সামুদ্রিক শুঁটকি, শামুক-ঝিনুক শিল্প, লবণ ও পর্যটন আতিথেয়তা',
    specialtiesEn: 'Dried marine fish (shutki), shell crafts, coastal salt, and hospitality',
    connectivityBn: 'কক্সবাজার বিমানবন্দর, ঢাকা-কক্সবাজার রেলপথ ও চট্টগ্রাম-কক্সবাজার মহাসড়ক',
    connectivityEn: 'Cox’s Bazar Airport, Rail Link, and Chattogram–Cox’s Bazar Highway',
    summaryBn: 'বঙ্গোপসাগরের তীরে কক্সবাজার সদর দেশের প্রধান পর্যটন নগরী; সুবিস্তৃত বালুকাময় সৈকত ও পাহাড়ের মেলবন্ধনে অনন্য।',
    summaryEn: 'Facing the Bay of Bengal, Cox’s Bazar Sadar anchors Bangladesh’s premier coastal resort city and scenic Marine Drive.',
    isCoastal: true,
  },
  u398: {
    famousForBn: 'দেশের একমাত্র পাহাড়ি দ্বীপ উপজেলা; আদিনাথ মন্দির, মাতারবাড়ি গভীর সমুদ্রবন্দর ও পানের বরজ',
    famousForEn: 'Bangladesh’s only hilly island upazila; Adinath Temple, Matarbari deep seaport, and betel-leaf hills',
    landmarksBn: ['মৈনাক পাহাড়ে আদিনাথ মন্দির', 'মাতারবাড়ি গভীর সমুদ্রবন্দর ও বিদ্যুৎ কেন্দ্র', 'সোনাদিয়া দ্বীপ ও প্যারাবন', 'মহেশখালী জেটি ও শুঁটকি পল্লি'],
    landmarksEn: ['Adinath Temple on Mainak Hill', 'Matarbari Deep-Sea Port', 'Sonadia Island Mangroves', 'Maheshkhali Jetty'],
    specialtiesBn: 'মহেশখালীর বিখ্যাত মিষ্টি পান, সমুদ্রের লবণ ও শুঁটকি',
    specialtiesEn: 'Renowned Maheshkhali sweet betel leaf, sea salt, and dried fish',
    connectivityBn: 'কক্সবাজার ৬ নম্বর ঘাট থেকে স্পিডবোট/ট্রলার ও চকরিয়া-বদরখালী সেতু',
    connectivityEn: 'Speedboat from Cox’s Bazar and Badarkhali bridge road',
    summaryBn: 'পাহাড়, সাগর ও ম্যানগ্রোভ নিয়ে গঠিত দ্বীপ মহেশখালী; মিষ্টি পান, আদিনাথ মন্দির ও মাতারবাড়ি গভীর সমুদ্রবন্দরের জন্য খ্যাত।',
    summaryEn: 'Bangladesh’s sole hilly island, Maheshkhali blends Mainak Hill temples, sweet betel leaf farms, and the Matarbari deep-sea port.',
    isCoastal: true,
    isHill: true,
  },
  u402: {
    famousForBn: 'বাংলাদেশের সর্বদক্ষিণের মূল ভূখণ্ড, সেন্ট মার্টিন্স দ্বীপ (নারিকেল জিঞ্জিরা), নাফ নদী ও মেরিন ড্রাইভের শেষ প্রান্ত',
    famousForEn: 'Mainland Bangladesh’s southernmost point, gateway to St. Martin’s coral island, Naf River, and Marine Drive',
    landmarksBn: ['সেন্ট মার্টিন্স দ্বীপ ও ছেঁড়াদ্বীপ', 'শাহপরীর দ্বীপ', 'টেকনাফ গেম রিজার্ভ ও নেচার পার্ক', 'মাথিনের কূপ ও নাফ নদী তীর', 'সাবরাং ও মেরিন ড্রাইভ'],
    landmarksEn: ['St. Martin’s Island & Chhera Dwip', 'Shah Porir Dwip', 'Teknaf Wildlife Sanctuary', 'Mathin’s Well & Naf Riverfront'],
    specialtiesBn: 'সেন্ট মার্টিন্সের ডাব, সামুদ্রিক মাছ, শুঁটকি ও মিয়ানমার সীমান্ত বাণিজ্য',
    specialtiesEn: 'St. Martin’s coconuts, marine seafood, dried fish, and Teknaf land port trade',
    connectivityBn: 'মেরিন ড্রাইভ (কক্সবাজার-টেকনাফ ৮০ কিমি) ও কক্সবাজার-টেকনাফ মহাসড়ক',
    connectivityEn: '80 km Cox’s Bazar–Teknaf Marine Drive and N1 Highway',
    summaryBn: 'নাফ নদী ও বঙ্গোপসাগরের মধ্যবর্তী সরু উপদ্বীপ টেকনাফ; বাংলাদেশের প্রবাল দ্বীপ সেন্ট মার্টিন্সের প্রবেশদ্বার।',
    summaryEn: 'Stretching down to Bangladesh’s southernmost tip between the Naf River and the Bay of Bengal, Teknaf is the gateway to St. Martin’s Island.',
    isCoastal: true,
    isHill: true,
  },
  u426: {
    famousForBn: 'নিঝুম দ্বীপ জাতীয় উদ্যান (চিত্রা হরিণের অভয়ারণ্য), মেঘনা মোহনা ও প্রাচীন দ্বীপাঞ্চল',
    famousForEn: 'Nijhum Dwip National Park (spotted deer sanctuary), Meghna estuary, and coastal islands',
    landmarksBn: ['নিঝুম দ্বীপ জাতীয় উদ্যান ও কেওড়া বন', 'কমলার দ্বীপ ও নামার বাজার সৈকত', 'চেয়ারম্যান ঘাট-নলচিরা নৌপথ'],
    landmarksEn: ['Nijhum Dwip National Park', 'Namar Bazar Beach', 'Char Ishwar & Nalchira Jetty'],
    specialtiesBn: 'মেঘনা মোহনার ইলিশ, মহিষের দই ও নারিকেল',
    specialtiesEn: 'Estuary hilsa, buffalo curd, and island coconuts',
    connectivityBn: 'নোয়াখালী চেয়ারম্যান ঘাট ও চট্টগ্রাম থেকে সি-ট্রাক/ট্রলার',
    connectivityEn: 'Sea-truck and ferries from Noakhali Chairman Ghat',
    summaryBn: 'বঙ্গোপসাগরের কোলে অবস্থিত নোয়াখালীর বিশাল দ্বীপ উপজেলা হাতিয়া; নিঝুম দ্বীপের চিত্রা হরিণ ও ম্যানগ্রোভ বনের জন্য বিখ্যাত।',
    summaryEn: 'At the mouth of the Meghna estuary, Hatiya Island encompasses Nijhum Dwip National Park, famous for spotted deer and mangrove shores.',
    isCoastal: true,
  },
  u432: {
    famousForBn: 'মেঘের উপত্যকা সাজেক ভ্যালি (রুইলুই ও কংলাক পাড়া) এবং বাংলাদেশের আয়তনে বৃহত্তম উপজেলা',
    famousForEn: 'Cloud-draped Sajek Valley (Ruilui & Konglak peaks) and the largest upazila in Bangladesh by area',
    landmarksBn: ['সাজেক ভ্যালি (রুইলুই ও কংলাক পাড়া)', 'কাচালং নদী ও মাসালং ভ্যালি', 'সাজেক হেলিপ্যাড ও সূর্যোদয় পয়েন্ট'],
    landmarksEn: ['Sajek Valley (Ruilui & Konglak Para)', 'Kachalong River Valley', 'Sajek Sunrise Viewpoints'],
    specialtiesBn: 'পাহাড়ি জুম চাষ, কমলা, বাঁশ কোড়ল ও পাহাড়ি হস্তশিল্প',
    specialtiesEn: 'Jhum hill farming, hill oranges, bamboo crafts, and cloud-top eco-tourism',
    connectivityBn: 'খাগড়াছড়ি-দীঘিনালা-বাঘাইহাট সড়ক (সাজেক রুট) ও কাচালং নৌপথ',
    connectivityEn: 'Dighinala–Baghaihat Mountain Road (via Khagrachhari) and Kachalong River',
    summaryBn: 'রাঙ্গামাটির উত্তরে অবস্থিত আয়তনে দেশের বৃহত্তম উপজেলা বাঘাইছড়ি; মনোরম সাজেক ভ্যালির মেঘের রাজ্যের জন্য বিখ্যাত।',
    summaryEn: 'Bangladesh’s largest upazila by area in northern Rangamati, Baghaichhari is celebrated nationwide for cloud-kissed Sajek Valley.',
    isHill: true,
  },
  u436: {
    famousForBn: 'কাপ্তাই হ্রদ, দেশের একমাত্র জলবিদ্যুৎ কেন্দ্র, কর্ণফুলী কাগজকল ও কাপ্তাই জাতীয় উদ্যান',
    famousForEn: 'Kaptai Lake, Bangladesh’s only hydroelectric power station, Karnaphuli River, and National Park',
    landmarksBn: ['কাপ্তাই জলবিদ্যুৎ কেন্দ্র ও বাঁধ', 'কাপ্তাই জাতীয় উদ্যান (রামপাহাড়-সীতা পাহাড়)', 'কায়াকিং ও প্রশান্তি পার্ক', 'চিৎমরম বৌদ্ধ বিহার ও নেভি ক্যাম্প'],
    landmarksEn: ['Kaptai Hydroelectric Dam', 'Kaptai National Park', 'Chitmaram Buddhist Temple', 'Karnaphuli Kayaking Points'],
    specialtiesBn: 'জলবিদ্যুৎ, কাঠ-বাঁশ ও কাপ্তাই হ্রদের মাছ',
    specialtiesEn: 'Hydroelectricity, forestry, kayaking tourism, and lake fisheries',
    connectivityBn: 'চট্টগ্রাম-কাপ্তাই সড়ক ও কর্ণফুলী নদী',
    connectivityEn: 'Chattogram–Kaptai Highway and Karnaphuli Waterway',
    summaryBn: 'সবুজ পাহাড়, নীল কাপ্তাই হ্রদ ও কর্ণফুলী নদীর অপরূপ দৃশ্যের জন্য কাপ্তাই পার্বত্য চট্টগ্রামের অন্যতম আকর্ষণীয় জনপদ।',
    summaryEn: 'Cradled between forested hills, Kaptai Lake, and the Karnaphuli River, Kaptai is home to Bangladesh’s sole hydroelectric dam.',
    isHill: true,
  },
  u441: {
    famousForBn: 'কাপ্তাই হ্রদের ওপর ঝুলন্ত সেতু, শুভলং ঝরনা নৌপথ, রাজবন বিহার ও পাহাড়ি পর্যটন শহর',
    famousForEn: 'Iconic Hanging Bridge over Kaptai Lake, Shuvolong boat route, and Rajbana Vihara',
    landmarksBn: ['রাঙ্গামাটি ঝুলন্ত সেতু', 'রাজবন বিহার ও চাকমা রাজবাড়ি', 'পলওয়েল পার্ক ও আরণ্যক', 'কাপ্তাই হ্রদ নৌবিহার'],
    landmarksEn: ['Rangamati Hanging Bridge', 'Rajbana Vihara & Chakma Rajbari', 'Polwel Park', 'Kaptai Lake Cruises'],
    specialtiesBn: 'চাকমা-মারমা তাঁতবস্ত্র (পিনন-হাদি), বাঁশ-বেত ও পাহাড়ি ফল',
    specialtiesEn: 'Indigenous Chakma textiles, bamboo handicrafts, and hill fruits',
    connectivityBn: 'চট্টগ্রাম-রাঙ্গামাটি মহাসড়ক ও কাপ্তাই হ্রদ নৌপথ',
    connectivityEn: 'Chattogram–Rangamati Highway and Kaptai Lake ferries',
    summaryBn: 'কাপ্তাই হ্রদে ঘেরা পাহাড়ি শহর রাঙ্গামাটি সদর ঝুলন্ত সেতু, বৌদ্ধ বিহার ও আদিবাসী ঐতিহ্যের জন্য খ্যাত।',
    summaryEn: 'Wrapped in the winding arms of Kaptai Lake, Rangamati Sadar is celebrated for its hanging bridge, Rajbana Vihara, and hill textiles.',
    isHill: true,
  },
  u335: {
    famousForBn: 'বগালেক, কেওক্রাডং চূড়া, রিজুক ঝরনা এবং সাঙ্গু নদীর ওপর অ্যাডভেঞ্চার ট্রেকিংয়ের মূল কেন্দ্র',
    famousForEn: 'Boga Lake, Keokradong peak, Rijuk Waterfall, and premier trekking hub along the Sangu River',
    landmarksBn: ['বগালেক (প্রাকৃতিক পাহাড়ি হ্রদ)', 'কেওক্রাডং পাহাড় চূড়া', 'রিজুক জলপ্রপাত (সাঙ্গু নদী)', 'দার্জিলিং পাড়া ও জাদিপাই ঝরনা'],
    landmarksEn: ['Boga Lake', 'Keokradong Summit', 'Rijuk Waterfall', 'Jadipai Waterfall & Darjeeling Para'],
    specialtiesBn: 'পাহাড়ি কমলা, কফি, জুম ফসল ও ইকো-ট্রেকিং',
    specialtiesEn: 'Hilltop oranges, wild coffee, and adventure mountain trekking',
    connectivityBn: 'বান্দরবান-রুমা সড়ক ও সাঙ্গু নদী',
    connectivityEn: 'Bandarban–Ruma Mountain Road and Sangu River',
    summaryBn: 'বান্দরবানের রুমা উপজেলা দেশের উচ্চতম পর্বত ট্রেকিং পথ—বগালেক ও কেওক্রাডংয়ের প্রধান প্রবেশদ্বার।',
    summaryEn: 'Ruma is Bangladesh’s premier mountain trekking hub, offering access to natural alpine Boga Lake, Rijuk Falls, and Keokradong.',
    isHill: true,
  },
  u336: {
    famousForBn: 'নাফাখুম, আমিয়াখুম ও রেমাক্রি জলপ্রপাত, তাজিংডং-সাকা হাফং সীমান্ত পর্বতশ্রেণি ও সাঙ্গু নদীর উৎস',
    famousForEn: 'Nafakhum & Amiakhum waterfalls, Remakri, Saka Haphong range, and upper Sangu River gorge',
    landmarksBn: ['নাফাখুম ও আমিয়াখুম জলপ্রপাত', 'রেমাক্রি খাল ও পাথুরে নাফাকুম পথ', 'তিন্দু ও রাজা পাথর', 'ডিম পাহাড় (আলীকদম-থানচি রোড, দেশের সর্বোচ্চ সড়ক)'],
    landmarksEn: ['Nafakhum & Amiakhum Waterfalls', 'Tindu Stone Gorge (Raja Pathor)', 'Remakri Valley', 'Dim Pahar (Bangladesh’s Highest Road)'],
    specialtiesBn: 'অ্যাডভেঞ্চার পর্যটন, পাহাড়ি জুম চাষ ও সাঙ্গু বন্যপ্রাণী অভয়ারণ্য',
    specialtiesEn: 'Adventure eco-tourism, Sangu Reserve Forest, and highland hill cultures',
    connectivityBn: 'বান্দরবান-চিম্বুক-থানচি সড়ক ও সাঙ্গু নদীর ইঞ্জিনচালিত নৌকা',
    connectivityEn: 'Bandarban–Chimbuk–Thanchi Road and Sangu River boats',
    summaryBn: 'বাংলাদেশের দক্ষিণ-পূর্ব সীমান্তে সুউচ্চ পাহাড় ও নাফাখুম-আমিয়াখুম ঝরনার জন্য বিখ্যাত অনন্য জনপদ থানচি।',
    summaryEn: 'In far southeastern Bandarban, Thanchi harbors dramatic Sangu river gorges, Dim Pahar, and the famous Nafakhum and Amiakhum cascades.',
    isHill: true,
  },
  u332: {
    famousForBn: 'নীলাচল, মেঘলা পর্যটন কমপ্লেক্স, স্বর্ণমন্দির (বুদ্ধ ধাতু জাদি) ও শৈলপ্রপাত',
    famousForEn: 'Nilachal cloud viewpoint, Meghla resort, Golden Temple (Buddha Dhatu Jadi), and Shoilo Propat',
    landmarksBn: ['নীলাচল পর্যটন কেন্দ্র', 'বুদ্ধ ধাতু জাদি (স্বর্ণমন্দির)', 'মেঘলা পর্যটন কমপ্লেক্স ও ঝুলন্ত সেতু', 'শৈলপ্রপাত (চিম্বুক রোড)'],
    landmarksEn: ['Nilachal Viewpoint', 'Buddha Dhatu Jadi (Golden Temple)', 'Meghla Lake & Resort', 'Shoilo Propat Waterfall'],
    specialtiesBn: 'মারমা-ত্রিপুরা হস্তশিল্প, পাহাড়ি ফল ও পর্যটন সেবা',
    specialtiesEn: 'Hill crafts, bamboo shoots, pineapples, and mountain hospitality',
    connectivityBn: 'চট্টগ্রাম-কেরানিহাট-বান্দরবান মহাসড়ক',
    connectivityEn: 'Chattogram–Keranihat–Bandarban Highway',
    summaryBn: 'সাঙ্গু নদীর তীরে পাহাড়ি শহর বান্দরবান সদর স্বর্ণমন্দির ও নীলাচলের মেঘের দৃশ্যের জন্য সুপরিচিত।',
    summaryEn: 'Along the Sangu River, Bandarban Sadar serves as the gateway to Nilachal, the Golden Temple, and Chimbuk hill ranges.',
    isHill: true,
  },
  u338: {
    famousForBn: 'আশুগঞ্জ তাপবিদ্যুৎ কেন্দ্র, মেঘনা নদী বন্দর (ভৈরব সেতু) ও প্রসিদ্ধ চাতাল/চাল প্রক্রিয়াকরণ কেন্দ্র',
    famousForEn: 'Major power generation hub, Meghna river port & railway bridges, and eastern rice-milling center',
    landmarksBn: ['সৈয়দ নজরুল ইসলাম সড়ক সেতু ও রেল সেতু (ভৈরব-আশুগঞ্জ)', 'আশুগঞ্জ নদী বন্দর', 'ভাস্কর্য "জাগ্রত বাংলা"'],
    landmarksEn: ['Syed Nazrul Islam & Railway Bridges across Meghna', 'Ashuganj River Port', 'Ashuganj Power Hub'],
    specialtiesBn: 'বিদ্যুৎ উৎপাদন, চাল কল ও মেঘনা নদীর মিঠাপানির মাছ',
    specialtiesEn: 'Power generation, rice milling, and Meghna river logistics',
    connectivityBn: 'ঢাকা-সিলেট মহাসড়ক (N2) ও ঢাকা-চট্টগ্রাম/সিলেট রেলপথ',
    connectivityEn: 'Dhaka–Sylhet Highway (N2), Meghna Bridges, and Eastern Rail Corridor',
    summaryBn: 'মেঘনা নদীর পূর্ব তীরে অবস্থিত আশুগঞ্জ বিদ্যুৎ উৎপাদন, নদী বন্দর ও পূর্বাঞ্চলের প্রধান সড়ক-রেল সেতুর সংযোগস্থল।',
    summaryEn: 'On the eastern bank of the Meghna, Ashuganj is a vital energy, river-port, and bridge gateway linking Dhaka to Sylhet and Chattogram.',
  },
  u345: {
    famousForBn: 'বিশ্বখ্যাত সরাইল গ্রেহাউন্ড কুকুর, ঐতিহাসিক আরিফাইল মসজিদ (সপ্তদশ শতক) ও হাওরাঞ্চল',
    famousForEn: 'Historic 17th-century Arifail Mosque, famous Sarail Hound dog breed, and haor wetlands',
    landmarksBn: ['আরিফাইল মসজিদ ও জোড়া কবর', 'ধরন্তি হাওর ও পর্যটন বাঁধ', 'হাটখোলা মসজিদ'],
    landmarksEn: ['Arifail Mosque (17th Century)', 'Dharanti Haor Viewpoint', 'Hatkhola Mosque'],
    specialtiesBn: 'ঐতিহ্যবাহী সরাইল গ্রেহাউন্ড কুকুর, বোরো ধান ও হাওরের মাছ',
    specialtiesEn: 'Historic Sarail Hound breed, haor rice, and freshwater fish',
    connectivityBn: 'ঢাকা-সিলেট মহাসড়ক (বিশ্বরোড) ও তিতাস-মেঘনা সংযোগ',
    connectivityEn: 'Dhaka–Sylhet Highway (Bishwaroad) and local riverways',
    summaryBn: 'ব্রাহ্মণবাড়িয়ার সরাইল সপ্তদশ শতকের আরিফাইল মসজিদ, ধরন্তি হাওর ও ঐতিহাসিক সরাইল কুকুরের জন্য প্রসিদ্ধ।',
    summaryEn: 'Known for the 17th-century Arifail Mosque, scenic Dharanti Haor, and the heritage Sarail Hound breed.',
    isHaor: true,
  },

  // Sylhet Division (Sreemangal, Jaflong, Sada Pathor, Tanguar Haor, Chhatak)
  u456: {
    famousForBn: 'বাংলাদেশের চায়ের রাজধানী, লাউয়াছড়া জাতীয় উদ্যান, বাইক্কা বিল ও মাধবপুর লেক',
    famousForEn: 'Tea capital of Bangladesh, Lawachara National Park, Baikka Beel bird sanctuary, and Madhabpur Lake',
    landmarksBn: ['সাত রঙের চা ও চা বাগান (ফিনলে ও জেরিন টি এস্টেট)', 'লাউয়াছড়া জাতীয় উদ্যান', 'বাইক্কা বিল পাখির অভয়ারণ্য (হাইল হাওর)', 'বাংলাদেশ চা গবেষণা ইনস্টিটিউট (BTRI)', 'বধ্যভূমি ৭১ ও নীলকণ্ঠ চা কেবিন'],
    landmarksEn: ['Rolling Tea Estates & BTRI', 'Lawachara National Park', 'Baikka Beel Bird Sanctuary', 'Seven-Layer Tea Cabin'],
    specialtiesBn: 'সিলেটি চা, সাত রঙের চা, শ্রীমঙ্গলের লেবু ও রসালো আনারস',
    specialtiesEn: 'Single-origin tea, seven-layer tea, fragrant lemons, and juicy hill pineapples',
    connectivityBn: 'ঢাকা-সিলেট-শ্রীমঙ্গল রেল ও মহাসড়ক',
    connectivityEn: 'Dhaka–Sylhet Railway and Highway corridor',
    summaryBn: 'পাহাড়ি ঢাল, সবুজ চা বাগান আর লাউয়াছড়া বনের জন্য মৌলভীবাজারের শ্রীমঙ্গল "বাংলাদেশের চায়ের রাজধানী" হিসেবে খ্যাত।',
    summaryEn: 'Celebrated as Bangladesh’s tea capital, Sreemangal pairs emerald tea gardens with Lawachara rainforest and Baikka Beel wetlands.',
  },
  u475: {
    famousForBn: 'মেঘালয় পাহাড়ের পাদদেশে জাফলং পাথর কোয়ারি, বিছনাকান্দি ও রাতারগুল জলারবন (সোয়াম্প ফরেস্ট)',
    famousForEn: 'Jaflong stone river, Bichhanakandi mountain stream, and Ratargul Freshwater Swamp Forest',
    landmarksBn: ['জাফলং ও পিয়াইন নদী (ডাউকি পাহাড়ের দৃশ্য)', 'রাতারগুল সোয়াম্প ফরেস্ট (দেশের একমাত্র জলারবন)', 'বিছনাকান্দি পাথর ও জলপ্রবাহ', 'পান্তুমাই (বড়হিল ঝরনা দৃশ্য)'],
    landmarksEn: ['Jaflong & Piyain River', 'Ratargul Swamp Forest', 'Bichhanakandi Riverbed', 'Pantumai Waterfall View'],
    specialtiesBn: 'প্রাকৃতিক পাথর, পান-সুপারি, খাসিয়া পুঞ্জি ও প্রকৃতি-পর্যটন',
    specialtiesEn: 'River boulders, Khasi betel leaf gardens, and eco-tourism',
    connectivityBn: 'সিলেট-তামাবিল মহাসড়ক ও পিয়াইন-গোয়াইন নদী',
    connectivityEn: 'Sylhet–Tamabil Highway and Piyain–Gowainghat Waterways',
    summaryBn: 'জাফলং, রাতারগুল জলারবন ও বিছনাকান্দির মতো বাংলাদেশের তিনটি অন্যতম সেরা প্রাকৃতিক সৌন্দর্যের স্থান গোয়াইনঘাটে অবস্থিত।',
    summaryEn: 'On the Meghalaya border north of Sylhet, Gowainghat hosts Jaflong, Bichhanakandi, and Ratargul—Bangladesh’s famed swamp forest.',
  },
  u471: {
    famousForBn: 'ভোলাগঞ্জ সাদা পাথর পর্যটন কেন্দ্র, ধলাই নদী ও বাংলাদেশের বৃহত্তম প্রাকৃতিক পাথর কোয়ারি',
    famousForEn: 'Bholaganj Sada Pathor (White Stone) river bed, crystal Dhalai River, and Meghalaya hill backdrop',
    landmarksBn: ['ভোলাগঞ্জ সাদা পাথর', 'ধলাই নদীর জিরো পয়েন্ট', 'উৎমাছড়া ও তুরুংছড়া', 'রোপওয়ে বাংকার এলাকা'],
    landmarksEn: ['Bholaganj Sada Pathor', 'Dhalai River Zero Point', 'Utmachhara Stream', 'Ropeway Bunker Zone'],
    specialtiesBn: 'সাদা নুড়ি পাথর, স্বচ্ছ পাহাড়ি পানি ও ইকো-ট্যুরিজম',
    specialtiesEn: 'White river cobbles, crystal mountain waters, and tourism',
    connectivityBn: 'সিলেট-কোম্পানীগঞ্জ (ভোলাগঞ্জ) মহাসড়ক',
    connectivityEn: 'Sylhet–Companiganj (Bholaganj) Highway',
    summaryBn: 'ধলাই নদীর স্বচ্ছ জলের তলে অসংখ্য সাদা পাথরের সমাহারের জন্য সিলেটের কোম্পানীগঞ্জ (ভোলাগঞ্জ) দেশব্যাপী বিখ্যাত।',
    summaryEn: 'Famous for the crystal Dhalai River flowing over dazzling white boulders at Bholaganj Sada Pathor.',
  },
  u467: {
    famousForBn: 'বিশ্ব ঐতিহ্য রামসার সাইট টাঙ্গুয়ার হাওর, নীলাদ্রি লেক (শহীদ সিরাজ লেক), শিমুল বাগান ও যাদুকাটা নদী',
    famousForEn: 'Tanguar Haor (Ramsar Wetland), Niladri Lake, Jadukata River, and Shimul Bagan',
    landmarksBn: ['টাঙ্গুয়ার হাওর (রামসার সাইট ও হাউসবোট পর্যটন)', 'নীলাদ্রি / শহীদ সিরাজ লেক (টেকেরঘাট)', 'যাদুকাটা নদী ও বারিক্কা টিলা', 'জয়নাল আবেদীন শিমুল বাগান'],
    landmarksEn: ['Tanguar Haor Ramsar Wetland', 'Niladri (Shaheed Siraj) Lake', 'Jadukata River & Barikka Tila', 'Shimul Bagan'],
    specialtiesBn: 'হাওরের মাছ, শীতকালীন অতিথি পাখি, বোরো ধান ও কয়লা-চুনাপাথর বাণিজ্য',
    specialtiesEn: 'Wetland biodiversity, migratory birds, boro rice, and cross-border limestone',
    connectivityBn: 'সুনামগঞ্জ-তাহিরপুর সড়ক ও সুরমা-বাউলাই নৌপথ',
    connectivityEn: 'Sunamganj–Tahirpur Road and Haor houseboat waterways',
    summaryBn: 'মেঘালয় পাহাড়ের পাদদেশে টাঙ্গুয়ার হাওর, নীলাদ্রি লেক ও যাদুকাটা নদীর অপার সৌন্দর্য নিয়ে সুনামগঞ্জের তাহিরপুর অবস্থিত।',
    summaryEn: 'Cradled below the Meghalaya hills in Sunamganj, Tahirpur is home to Tanguar Haor Ramsar wetland, Niladri Lake, and the Jadukata River.',
    isHaor: true,
  },
  u458: {
    famousForBn: 'বাংলাদেশের প্রথম ও বৃহৎ সিমেন্ট কারখানা (ছাতক সিমেন্ট), সুরমা নদী ও কমলা-পাথর বাণিজ্য',
    famousForEn: 'Surma River limestone & cement industry (Chhatak Cement), hillocks, and historic river trade',
    landmarksBn: ['ছাতক সিমেন্ট কারখানা (১৯৩৭)', 'সুরমা নদীর পাড় ও রোপওয়ে', 'টেংরাটিলা ও দোয়ারা সীমান্ত টিলা', 'লাফার্জ হোলসিম ক্লিংকার কনভেয়ার'],
    landmarksEn: ['Chhatak Cement Factory (1937)', 'Surma Riverfront', 'Cross-Border Limestone Conveyor'],
    specialtiesBn: 'সিমেন্ট, চুনাপাথর, ছাতকের কমলা ও পাথর-বালু ব্যবসা',
    specialtiesEn: 'Cement manufacturing, limestone quarrying, and oranges',
    connectivityBn: 'সিলেট-ছাতক সড়ক ও রেলপথ, সুরমা নদী',
    connectivityEn: 'Sylhet–Chhatak Road, Rail Spur, and Surma River',
    summaryBn: 'সুরমা নদীর তীরে অবস্থিত সুনামগঞ্জের শিল্প ও বাণিজ্যনগরী ছাতক দেশের প্রাচীনতম সিমেন্ট কারখানার জন্য সুপরিচিত।',
    summaryEn: 'Sitting on the Surma River, Chhatak is an industrial river-port town famous for Bangladesh’s oldest cement plant and limestone trade.',
  },

  // Rangpur & Rajshahi Divisions
  u278: {
    famousForBn: 'বাংলাদেশের সর্বউত্তরের উপজেলা; বাংলাবান্ধা জিরো পয়েন্ট, সমতল ভূমির চা বাগান ও কাঞ্চনজঙ্ঘা দর্শন',
    famousForEn: 'Northernmost upazila of Bangladesh; Banglabandha Zero Point, plains tea gardens, and Kanchenjunga views',
    landmarksBn: ['বাংলাবান্ধা জিরো পয়েন্ট ও স্থলবন্দর', 'তেঁতুলিয়া ডাকবাংলো (মহানন্দা নদীর পাড়)', 'সমতল ভূমির চা বাগান ও রওশনপুর কাজী টি এস্টেট', 'শীতকালে কাঞ্চনজঙ্ঘার চূড়া দর্শন'],
    landmarksEn: ['Banglabandha Zero Point & Quad-Border Port', 'Tetulia Dak Bungalow on Mahananda', 'Plains Tea Estates', 'Winter Kanchenjunga Viewpoint'],
    specialtiesBn: 'সমতল ভূমির অর্গানিক চা, নুড়ি পাথর ও শীতল জলবায়ু',
    specialtiesEn: 'Organic plains tea, river pebbles, and cool Himalayan foothill climate',
    connectivityBn: 'তেঁতুলিয়া-বাংলাবান্ধা-পঞ্চগড় মহাসড়ক (N5)',
    connectivityEn: 'N5 Highway terminating at Banglabandha Land Port',
    summaryBn: 'হিমালয়ের কোলঘেঁষে মহানন্দা নদীর তীরে অবস্থিত তেঁতুলিয়া বাংলাদেশের সর্বউত্তরের প্রান্ত; এখান থেকে শরৎ-শীতে কাঞ্চনজঙ্ঘা দেখা যায়।',
    summaryEn: 'At Bangladesh’s northernmost tip along the Mahananda River, Tentulia is famed for plains tea gardens and clear-sky views of Kanchenjunga.',
  },
  u267: {
    famousForBn: 'তিস্তা-ধরলা উপত্যকার ঐতিহাসিক তিনবিঘা করিডোর ও দহগ্রাম-আঙ্গরপোতা ছিটমহল সংযোগ',
    famousForEn: 'Historic Tin Bigha Corridor, Dahagram–Angorpota enclave link, and Burimari Land Port',
    landmarksBn: ['তিনবিঘা করিডোর', 'দহগ্রাম-আঙ্গরপোতা', 'বুড়িমারী আন্তর্জাতিক স্থলবন্দর', 'ধরলা ও তিস্তা নদীর চর'],
    landmarksEn: ['Tin Bigha Corridor', 'Dahagram–Angorpota', 'Burimari Land Port', 'Dharla Riverbanks'],
    specialtiesBn: 'ভুট্টা, তামাক, আলু ও ভারত-ভুটান স্থলবন্দর বাণিজ্য',
    specialtiesEn: 'Maize, potatoes, cross-border Bhutan/India trade via Burimari',
    connectivityBn: 'লালমনিরহাট-বুড়িমারী মহাসড়ক ও রেলপথ',
    connectivityEn: 'Lalmonirhat–Burimari Highway and Railway',
    summaryBn: 'লালমনিরহাটের পাটগ্রাম উপজেলা ঐতিহাসিক তিনবিঘা করিডোর ও বুড়িমারী আন্তর্জাতিক স্থলবন্দরের জন্য দেশব্যাপী পরিচিত।',
    summaryEn: 'In northern Lalmonirhat, Patgram connects the historic Tin Bigha Corridor and operates the busy Burimari international land port.',
  },
  u264: {
    famousForBn: 'তিস্তা ব্যারেজ ও ডালিয়া প্রকল্প, তিস্তা নদীর তীরবর্তী কৃষি জনপদ',
    famousForEn: 'Teesta Barrage irrigation project vicinity and northern Teesta floodplain',
    landmarksBn: ['তিস্তা ব্যারেজ প্রকল্প সংলগ্ন চর ও পাড়', 'সিন্দুরমতি দিঘি সংযোগ'],
    landmarksEn: ['Teesta Barrage Zone', 'Teesta River Char Lands'],
    specialtiesBn: 'ভুট্টা, তিস্তার চরের বাদাম, আলু ও শীতকালীন সবজি',
    specialtiesEn: 'Char-land peanuts, maize, potatoes, and winter vegetables',
    connectivityBn: 'লালমনিরহাট-পাটগ্রাম মহাসড়ক',
    connectivityEn: 'Lalmonirhat–Patgram Highway',
    summaryBn: 'তিস্তা নদীর উত্তর তীরে লালমনিরহাটের হাতিবান্ধা উপজেলা বাংলাদেশের বৃহত্তম সেচ প্রকল্প তিস্তা ব্যারেজের জন্য প্রসিদ্ধ।',
    summaryEn: 'Along the Teesta River in Lalmonirhat, Hatibandha is anchored by the Teesta Barrage irrigation hub and fertile char plains.',
  },
  u256: {
    famousForBn: 'ভাওয়াইয়া সম্রাট আব্বাসউদ্দীনের গানে অমর "চিলমারী বন্দর", ব্রহ্মপুত্র নদ ও অষ্টমীর স্নান',
    famousForEn: 'Historic Chilmari River Port immortalized in Bhawaiya folk songs, Brahmaputra River, and Ashtami Snan',
    landmarksBn: ['ঐতিহাসিক চিলমারী নদীবন্দর (রমনা ঘাট)', 'ব্রহ্মপুত্র নদের চর ও অষ্টমীর স্নান ঘাট'],
    landmarksEn: ['Historic Chilmari River Port', 'Brahmaputra Riverbank & Ashtami Bathing Ghat'],
    specialtiesBn: 'ব্রহ্মপুত্রের মাছ, মরিচ, ভুট্টা ও ভাওয়াইয়া লোকসংগীত ঐতিহ্য',
    specialtiesEn: 'Brahmaputra river trade, chilies, maize, and Bhawaiya folk heritage',
    connectivityBn: 'কুড়িগ্রাম-চিলমারী সড়ক, রেল ও ব্রহ্মপুত্র নৌপথ',
    connectivityEn: 'Kurigram–Chilmari Road, Rail & Brahmaputra Waterway',
    summaryBn: '"ও কি গাড়িয়াল ভাই" ও "হাঁকাও গাড়ি তুই চিলমারীর বন্দরে"—ভাওয়াইয়া গানে অমর হয়ে থাকা চিলমারী কুড়িগ্রামের প্রাচীন নদীবন্দর।',
    summaryEn: 'Immortalized in classic Bhawaiya folk ballads, Chilmari sits on the wide Brahmaputra River in southern Kurigram.',
  },
  u273: {
    famousForBn: 'উত্তরাঞ্চলের অন্যতম প্রধান রেল ও বিমানবন্দর শহর, বাংলাদেশের বৃহত্তম রেলওয়ে কারখানা ও চিনি মসজিদ',
    famousForEn: 'Northern aviation & rail junction, Bangladesh’s largest railway workshop (1870), and Chini Mosque',
    landmarksBn: ['চিনি মসজিদ (ইসলামপুর, ১৮৬৩)', 'সৈয়দপুর রেলওয়ে কারখানা (১৮৭০)', 'সৈয়দপুর অভ্যন্তরীণ বিমানবন্দর', 'নীলসাগর সংযোগ ও বিসিক শিল্পনগরী'],
    landmarksEn: ['Chini Mosque (Chinese-tile Mosaic Mosque)', 'Saidpur Railway Workshop (1870)', 'Saidpur Airport'],
    specialtiesBn: 'হালকা প্রকৌশল, ঝুট কাপড় পুনঃপ্রক্রিয়াজাত শিল্প ও রেল-বিমান যোগাযোগ',
    specialtiesEn: 'Light engineering, apparel upcycling, and regional transport services',
    connectivityBn: 'সৈয়দপুর বিমানবন্দর, ব্রডগেজ রেলওয়ে ও রংপুর-দিনাজপুর মহাসড়ক',
    connectivityEn: 'Saidpur Airport, Major Rail Junction, and Rangpur–Dinajpur Highway',
    summaryBn: 'উত্তরবঙ্গের প্রবেশদ্বার হিসেবে পরিচিত সৈয়দপুর একটি আধুনিক বিমানবন্দর, ঐতিহাসিক চিনি মসজিদ ও বৃহৎ রেল কারখানার শহর।',
    summaryEn: 'A vital transport hub in Nilphamari, Saidpur hosts northern Bangladesh’s airport, the historic 1870 railway workshop, and the mosaic Chini Mosque.',
  },
  u287: {
    famousForBn: '২০০ বছরের পুরনো হরিপুর রাজবাড়ি ও এশিয়ার অন্যতম বৃহৎ ঐতিহ্যবাহী সূর্যপুরী আমগাছ',
    famousForEn: '200-year-old Haripur Rajbari palace and the giant centuries-old Suryapuri mango tree',
    landmarksBn: ['হরিনমারি বিশাল সূর্যপুরী আমগাছ (প্রায় ২ বিঘা জুড়ে বিস্তৃত)', 'হরিপুর রাজবাড়ি', 'গোবিন্দ জিউ মন্দির ও নাগর-তীরনই নদী'],
    landmarksEn: ['Giant Ancient Suryapuri Mango Tree (Harinmari)', 'Haripur Rajbari Palace', 'Nagar River Valley'],
    specialtiesBn: 'সূর্যপুরী আম, ভুট্টা, গম ও সুপারি',
    specialtiesEn: 'Suryapuri mangoes, wheat, maize, and betel nuts',
    connectivityBn: 'ঠাকুরগাঁও-বালিয়াডাঙ্গী সড়ক',
    connectivityEn: 'Thakurgaon–Baliadangi Road',
    summaryBn: 'ঠাকুরগাঁওয়ের পশ্চিম সীমান্তবর্তী বালিয়াডাঙ্গী প্রকাণ্ড প্রাচীন আমগাছ ও হরিপুর রাজবাড়ির জন্য পর্যটকদের কাছে বিশেষ আকর্ষণীয়।',
    summaryEn: 'On Thakurgaon’s western border, Baliadangi is renowned for its sprawling two-century-old mango tree and historic Haripur Rajbari.',
  },
  u243: {
    famousForBn: 'টেরাকোটা অলংকরণের শ্রেষ্ঠ নিদর্শন ঐতিহাসিক কান্তজিউ মন্দির (১৭৫২) ও নয়াবাদ মসজিদ',
    famousForEn: 'Terracotta masterpiece Kantajew Temple (1752) and historic Nayabad Mosque along the Dhepa River',
    landmarksBn: ['কান্তজিউ মন্দির (কান্তনগর, ১৭৫২)', 'নয়াবাদ মসজিদ (১৭৯৩)', 'ঢেপা নদী ও কান্তনগর মেলা'],
    landmarksEn: ['Kantajew Terracotta Temple (1752)', 'Nayabad Mosque (1793)', 'Dhepa River'],
    specialtiesBn: 'টেরাকোটা স্থাপত্য ঐতিহ্য, দিনাজপুরের লিচু ও কাটারিভোগ চাল',
    specialtiesEn: 'Terracotta heritage tourism, Dinajpur litchi, and aromatic Kataribhog rice',
    connectivityBn: 'দিনাজপুর-পঞ্চগড় মহাসড়ক (N508)',
    connectivityEn: 'Dinajpur–Panchagarh Highway',
    summaryBn: 'পোড়ামাটির ফলকের অনন্য স্থাপত্য কান্তজিউ মন্দির ও নয়াবাদ মসজিদের জন্য দিনাজপুরের কাহারোল বিশ্বজুড়ে সুপরিচিত।',
    summaryEn: 'Home to the extraordinary 18th-century Kantajew Temple covered in intricate terracotta panels and the historic Nayabad Mosque.',
  },
  u174: {
    famousForBn: 'প্রাচীন পুণ্ড্রবর্ধনের রাজধানী মহাস্থানগড়, বেহুলার বাসরঘর ও গোবিন্দ ভিটা',
    famousForEn: 'Ancient Mahasthangarh citadel (Pundranagara), Behula’s Lakshindarer Medh, and Govinda Bhita',
    landmarksBn: ['মহাস্থানগড় প্রত্নতাত্ত্বিক দুর্গ ও জাদুঘর', 'বেহুলার বাসরঘর (গোকুল মেধ)', 'শাহ সুলতান বলখীর মাজার', 'ভাসু বিহার ও মশলার গবেষণা কেন্দ্র'],
    landmarksEn: ['Mahasthangarh Citadel & Museum', 'Behula’s Basar Ghar (Gokul Medh)', 'Vasu Vihara', 'Shah Sultan Balkhi Shrine'],
    specialtiesBn: 'সবজি (শিবগঞ্জের আলু ও কলা), কটকটি ও প্রত্নতাত্ত্বিক পর্যটন',
    specialtiesEn: 'Mahasthan famous Katkati sweet, potatoes, bananas, and archaeological tourism',
    connectivityBn: 'বগুড়া-রংপুর মহাসড়ক (N5) ও করতোয়া নদী',
    connectivityEn: 'Bogura–Rangpur Highway (N5) and Karatoya River',
    summaryBn: 'করতোয়া নদীর তীরে প্রায় আড়াই হাজার বছরের পুরনো নগরী মহাস্থানগড় নিয়ে বগুড়ার শিবগঞ্জ বাংলাদেশের অন্যতম সমৃদ্ধ প্রত্নস্থল।',
    summaryEn: 'Along the Karatoya River in northern Bogura, Shibganj preserves Mahasthangarh—the 2,400-year-old capital of ancient Pundravardhana.',
  },
  u182: {
    famousForBn: 'ইউনেস্কো বিশ্ব ঐতিহ্য পাহাড়পুর বৌদ্ধ বিহার (সোমপুর মহাবিহার) ও হলুদ বিহার',
    famousForEn: 'UNESCO World Heritage Somapura Mahavihara (Paharpur Buddhist Monastery) and Halud Vihara',
    landmarksBn: ['পাহাড়পুর বৌদ্ধ বিহার (সোমপুর মহাবিহার, অষ্টম শতক)', 'পাহাড়পুর প্রত্নতাত্ত্বিক জাদুঘর', 'সত্যপীরের ভিটা ও হলুদ বিহার'],
    landmarksEn: ['Somapura Mahavihara (8th-Century UNESCO Site)', 'Paharpur Archaeological Museum', 'Satyapir Bhita'],
    specialtiesBn: 'বিশ্ব ঐতিহ্য পর্যটন, ধান, আখ ও ছাতু-গুড়',
    specialtiesEn: 'UNESCO archaeological heritage, rice, and sugarcane',
    connectivityBn: 'নওগাঁ-জয়পুরহাট সড়ক ও জামালগঞ্জ রেলস্টেশন',
    connectivityEn: 'Naogaon–Joypurhat Road and Jamalganj Railway Station',
    summaryBn: 'পাল বংশের রাজা ধর্মপালের নির্মিত অষ্টম শতকের সোমপুর মহাবিহার (পাহাড়পুর বৌদ্ধ বিহার) নওগাঁর বদলগাছীতে অবস্থিত।',
    summaryEn: 'Badalgachhi in Naogaon houses Paharpur (Somapura Mahavihara), a monumental 8th-century Pala-era UNESCO World Heritage monastery.',
  },
  u202: {
    famousForBn: 'সুলতানি স্থাপত্যের অনন্য নিদর্শন ছোট সোনা মসজিদ, সোনামসজিদ স্থলবন্দর ও আম্রকানন',
    famousForEn: '15th-century Choto Sona Mosque, Sonamasjid Land Port, and famous Chapainawabganj mango orchards',
    landmarksBn: ['ছোট সোনা মসজিদ (১৪৯৩–১৫১৯)', 'তাহাখানা কমপ্লেক্স ও শাহ নিয়ামতউল্লাহ মসজিদ', 'দারাসবাড়ি মসজিদ ও মাদ্রাসা', 'সোনামসজিদ আন্তর্জাতিক স্থলবন্দর'],
    landmarksEn: ['Choto Sona Mosque (1493–1519)', 'Tahakhana Mughal Complex', 'Darasbari Mosque', 'Sonamasjid Land Port'],
    specialtiesBn: 'ফজলি, ল্যাংড়া, ক্ষীরসাপাত ও আম্রপালি আম (দেশের বৃহত্তম আমবাগান)',
    specialtiesEn: 'Fazli, Langra, and Khirsapat mangoes and Sultanate terracotta mosques',
    connectivityBn: 'চাঁপাইনবাবগঞ্জ-সোনামসজিদ মহাসড়ক ও পাগলা-মহানন্দা নদী',
    connectivityEn: 'Chapainawabganj–Sonamasjid Highway and Mahananda River',
    summaryBn: 'গৌড় বাংলার প্রাচীন ঐতিহ্যবাহী ছোট সোনা মসজিদ আর বাংলাদেশের বৃহত্তম আমবাগানের জন্য শিবগঞ্জ দেশবিখ্যাত।',
    summaryEn: 'Bordering historic Gaur in Chapainawabganj, Shibganj preserves the exquisite 15th-century Choto Sona Mosque and endless mango orchards.',
  },
  u221: {
    famousForBn: 'পুঠিয়া রাজবাড়ি, বাংলাদেশের সবচেয়ে বড় শিবমন্দির ও গোবিন্দ-পঞ্চরত্ন মন্দির কমপ্লেক্স',
    famousForEn: 'Puthia Rajbari palace, Bangladesh’s largest Shiva Temple, and terracotta Govinda shrines',
    landmarksBn: ['পুঠিয়া রাজবাড়ি (১৮৯৫)', 'বড় শিবমন্দির (১৮২৩)', 'পঞ্চরত্ন গোবিন্দ মন্দির ও দোলমন্দির', 'বড় আহ্নিক মন্দির ও শ্যামসাগর দিঘি'],
    landmarksEn: ['Puthia Rajbari Palace (1895)', 'Bara Shiva Temple (1823)', 'Pancharatna Govinda Temple', 'Dolmandir'],
    specialtiesBn: 'মন্দির স্থাপত্য ঐতিহ্য, পান বরজ, আম ও খেজুরের গুড়',
    specialtiesEn: 'Terracotta temple architecture, betel leaf, mangoes, and date jaggery',
    connectivityBn: 'ঢাকা-রাজশাহী মহাসড়ক (N6)',
    connectivityEn: 'Dhaka–Rajshahi Highway (N6)',
    summaryBn: 'বাংলাদেশের সর্বাধিক সংখ্যক প্রাচীন হিন্দু মন্দির ও রাজপ্রাসাদ নিয়ে রাজশাহীর পুঠিয়া "মন্দিরের শহর" নামে পরিচিত।',
    summaryEn: 'Just east of Rajshahi city along the N6 highway, Puthia boasts Bangladesh’s finest concentration of historic Rajbari palaces and terracotta temples.',
  },
  u212: {
    famousForBn: 'ষোড়শ শতকের বাঘা শাহী মসজিদ (টাকার নোটে মুদ্রিত ঐতিহ্য), বাঘা দিঘি ও পদ্মা পাড়ের আম',
    famousForEn: '16th-century Bagha Shahi Mosque (featured on Bangladesh currency), Bagha Dighi, and Padma orchards',
    landmarksBn: ['বাঘা শাহী মসজিদ (১৫২৩, সুলতান নুসরত শাহ)', 'বাঘা জাদুঘর ও বিশাল দিঘি', 'হযরত শাহ দৌলার মাজার', 'পদ্মা নদীর পাড়'],
    landmarksEn: ['Bagha Shahi Mosque (1523)', 'Bagha Dighi & Museum', 'Padma Riverbank Orchards'],
    specialtiesBn: 'বাঘার সুস্বাদু আম, খেজুরের গুড় ও সুলতানি টেরাকোটা শিল্প',
    specialtiesEn: 'Export-grade Rajshahi mangoes, date-palm molasses, and Sultanate terracotta art',
    connectivityBn: 'রাজশাহী-চারঘাট-বাঘা-ঈশ্বরদী সড়ক',
    connectivityEn: 'Rajshahi–Bagha–Ishwardi Corridor',
    summaryBn: 'পদ্মা নদীর উত্তর তীরে অবস্থিত বাঘা ১৫২৩ সালে নির্মিত টেরাকোটা খচিত বাঘা শাহী মসজিদ ও আমবাগানের জন্য বিখ্যাত।',
    summaryEn: 'On the Padma River’s northern bank, Bagha preserves the 1523 Sultanate Shahi Mosque and lush mango orchards.',
  },
  u197: {
    famousForBn: 'চলনবিলের প্রাণকেন্দ্র, জলাভূমির জীববৈচিত্র্য ও মিঠাপানির মাছের ভাণ্ডার',
    famousForEn: 'Heart of Chalan Beel—Bangladesh’s largest inland wetland—and freshwater fisheries',
    landmarksBn: ['চলনবিল পর্যটন এলাকা ও তিসীখালী মাজার', 'আত্রাই-গুর নদী ও সাবমার্জিবল সড়ক'],
    landmarksEn: ['Chalan Beel Wetland Horizon', 'Atrai–Gur River Basin', 'Tisikhali Heritage Site'],
    specialtiesBn: 'চলনবিলের শুঁটকি, বোয়াল-কই-শিং মাছ, রসুন ও আমন ধান',
    specialtiesEn: 'Chalan Beel dried fish, native freshwater fish, garlic, and paddy',
    connectivityBn: 'বগুড়া-নাটোর মহাসড়ক',
    connectivityEn: 'Bogura–Natore Highway',
    summaryBn: 'বাংলাদেশের বৃহত্তম বিল "চলনবিল"-এর সিংহভাগ জুড়ে বিস্তৃত নাটোরের সিংড়া উপজেলা মাছ ও বর্ষার জলাভূমির জন্য খ্যাত।',
    summaryEn: 'Anchoring the expanse of Chalan Beel, Singra transforms into a shimmering inland wetland during monsoon and yields rich winter garlic and paddy.',
  },
  u230: {
    famousForBn: 'রবীন্দ্রনাথ ঠাকুরের কাছারিবাড়ি (সাজাদপুর), বাঘাবাড়ি নদী বন্দর ও দেশের প্রধান দুগ্ধ উৎপাদন অঞ্চল (মিল্ক ভিটা)',
    famousForEn: 'Rabindranath Tagore’s Kachari Bari estate, Baghabari River Port, and Bangladesh’s dairy capital (Milk Vita)',
    landmarksBn: ['রবীন্দ্রনাথ ঠাকুরের কাছারিবাড়ি ও জাদুঘর', 'মখদুম শাহদৌলা শহীদ ইয়ামেনীর মাজার ও মসজিদ', 'বাঘাবাড়ি নদীবন্দর ও মিল্ক ভিটা'],
    landmarksEn: ['Rabindranath Tagore’s Kachari Bari', 'Makhdum Shahdowla Shrine & Mosque', 'Baghabari Port & Milk Vita'],
    specialtiesBn: 'গরুর খাঁটি দুধ, ঘি, দই (মিল্ক ভিটা) ও হস্তচালিত তাঁতশিল্প',
    specialtiesEn: 'Fresh dairy milk, ghee, yogurt (Milk Vita hub), and traditional handlooms',
    connectivityBn: 'বগুড়া-নগরবাড়ি মহাসড়ক (N507) ও করতোয়া-হুরাসাগর নদী',
    connectivityEn: 'N507 Highway, Baghabari River Port, and Railway via Ullapara',
    summaryBn: 'রবীন্দ্রনাথ ঠাকুরের স্মৃতিবিজড়িত কাছারিবাড়ি আর দেশের সবচেয়ে সমৃদ্ধ দুগ্ধ ও তাঁতশিল্পের কেন্দ্র হিসেবে সিরাজগঞ্জের শাহজাদপুর বিখ্যাত।',
    summaryEn: 'Celebrated for Rabindranath Tagore’s Kachari Bari and Milk Vita’s dairy cooperative heartland along the Hurasagar–Karatoya.',
  },

  // Khulna & Barishal Divisions
  u543: {
    famousForBn: 'বিশ্ব ঐতিহ্য সুন্দরবনের পশ্চিম অংশ (কলাগাছিয়া-মান্দারবাড়িয়া), ঐতিহাসিক ঈশ্বরীপুর ও সুন্দরবনের মধু',
    famousForEn: 'Gateway to Western Sundarbans mangrove forest, 16th-century Ishwaripur ruins, and wild honey',
    landmarksBn: ['সুন্দরবন পশ্চিম রেঞ্জ (কলাগাছিয়া ইকো-ট্যুরিজম ও আকাশলীনা)', 'যশোরেশ্বরী কালীমন্দির ও ঈশ্বরীপুর হাম্মামখানা', 'তেঁতুলিয়া-মুন্সীগঞ্জ ম্যানগ্রোভ নৌপথ', 'মান্দারবাড়িয়া সমুদ্রসৈকত'],
    landmarksEn: ['Western Sundarbans (Kalagachia & Akashlina)', 'Ishwaripur Hammamkhana & Temple', 'Mandarbaria Forest Beach'],
    specialtiesBn: 'সুন্দরবনের প্রাকৃতিক খলিশা মধু (জিআই), বাগদা চিংড়ি ও কাঁকড়া',
    specialtiesEn: 'Sundarbans wild honey (GI), export tiger shrimp, and mud crabs',
    connectivityBn: 'সাতক্ষীরা-মুন্সীগঞ্জ সড়ক ও সুন্দরবন নদীপথ',
    connectivityEn: 'Satkhira–Munshiganj Highway and Sundarbans waterways',
    summaryBn: 'দক্ষিণ-পশ্চিম প্রান্তে সুন্দরবনের কোলঘেঁষে শ্যামনগর উপজেলা ম্যানগ্রোভ অরণ্য, মধু আহরণ ও রাজা প্রতাপাদিত্যের ইতিহাসের জন্য খ্যাত।',
    summaryEn: 'The gateway to the western Sundarbans, Shyamnagar combines mangrove eco-tours, wild honey harvesting, and 16th-century heritage.',
    isCoastal: true,
  },
  u485: {
    famousForBn: 'বাংলাদেশের দ্বিতীয় প্রধান সমুদ্রবন্দর মোংলা, সুন্দরবন পূর্ব রেঞ্জ (করমজল) ও খান জাহান আলী বিমানবন্দর প্রকল্প',
    famousForEn: 'Bangladesh’s second seaport (Mongla), Sundarbans Karamjal wildlife center, and Pashur River estuary',
    landmarksBn: ['করমজল বন্যপ্রাণী প্রজনন কেন্দ্র (সুন্দরবন)', 'মোংলা সমুদ্রবন্দর ও পশুর নদী', 'জয়মনি-হারবাড়িয়া ইকো-ট্যুরিজম কেন্দ্র'],
    landmarksEn: ['Karamjal Wildlife Center (Sundarbans)', 'Mongla Seaport on Pashur River', 'Harbaria Eco-Tourism Center'],
    specialtiesBn: 'সামুদ্রিক বন্দর বাণিজ্য, চিংড়ি রপ্তানি ও সুন্দরবন পর্যটন',
    specialtiesEn: 'Seaport logistics, frozen shrimp export, and Sundarbans eco-cruises',
    connectivityBn: 'খুলনা-মোংলা রেলপথ ও মহাসড়ক (N7), পশুর নদী',
    connectivityEn: 'Khulna–Mongla Rail Link & Highway (N7), Pashur River',
    summaryBn: 'পশুর নদীর তীরে অবস্থিত মোংলা দেশের দ্বিতীয় বৃহত্তম সমুদ্রবন্দর এবং সুন্দরবনের করমজল-হারবাড়িয়া ভ্রমণের প্রধান প্রবেশপথ।',
    summaryEn: 'Positioned along the Pashur River, Mongla operates Bangladesh’s second seaport and serves as the main hub for Sundarbans tours.',
    isCoastal: true,
  },
  u480: {
    famousForBn: 'ইউনেস্কো বিশ্ব ঐতিহ্য ষাটগম্বুজ মসজিদ (বাগেরহাট মসজিদ নগরী) ও খান জাহান আলীর মাজার',
    famousForEn: 'UNESCO World Heritage Sixty Dome Mosque (Shat Gombuj) and Khan Jahan Ali’s historic Mosque City',
    landmarksBn: ['ষাটগম্বুজ মসজিদ (পঞ্চদশ শতক)', 'খান জাহান আলীর মাজার ও ঠাকুর দিঘি', 'নয়গম্বুজ ও সিঙ্গার মসজিদ', 'বাগেরহাট জাদুঘর'],
    landmarksEn: ['Sixty Dome Mosque (UNESCO Heritage)', 'Tomb of Khan Jahan Ali', 'Nine Dome Mosque', 'Bagerhat Museum'],
    specialtiesBn: 'সুলতানি মসজিদ স্থাপত্য, নারিকেল-সুপারি ও চিংড়ি চাষ',
    specialtiesEn: '15th-century Sultanate architecture, coconuts, and aquaculture',
    connectivityBn: 'খুলনা-বাগেরহাট মহাসড়ক ও রেলপথ',
    connectivityEn: 'Khulna–Bagerhat Highway and Rail Link',
    summaryBn: 'পঞ্চদশ শতকে হযরত খান জাহান আলী (রহ.) প্রতিষ্ঠিত ঐতিহাসিক খলিফাতাবাদ নগরী—ষাটগম্বুজ মসজিদের জন্য বাগেরহাট সদর বিশ্ববিখ্যাত।',
    summaryEn: 'Home to the UNESCO World Heritage Mosque City of Khalifatabad, centered on the iconic 15th-century Sixty Dome Mosque.',
  },
  u497: {
    famousForBn: 'বাংলাদেশের "ফুলের রাজধানী" গদখালী; সারা দেশে সরবরাহকৃত গোলাপ, গাঁদা, রজনীগন্ধা ও জারবেরা ফুলের মূল উৎস',
    famousForEn: 'Gadkhali—the "Flower Capital of Bangladesh"—supplying roses, marigolds, and gerberas nationwide',
    landmarksBn: ['গদখালী ফুলের বাজার ও বাগানসমূহ (পানিসারা)', 'কপোতাক্ষ নদের পাড়'],
    landmarksEn: ['Gadkhali Wholesale Flower Market & Fields', 'Kopotakkho Riverbank'],
    specialtiesBn: 'বাণিজ্যিক ফুল চাষ (গদখালী), যশোরের খেজুর গুড় ও সবজি',
    specialtiesEn: 'Commercial floriculture (Gadkhali), date-palm jaggery, and vegetables',
    connectivityBn: 'যশোর-বেনাপোল মহাসড়ক (N706)',
    connectivityEn: 'Jashore–Benapole Highway (N706)',
    summaryBn: 'যশোরের ঝিকরগাছা উপজেলার গদখালী দেশের সবচেয়ে বড় ফুল উৎপাদন ও বিপণন কেন্দ্র হিসেবে পরিচিত।',
    summaryEn: 'Famous nationwide for Gadkhali’s vibrant flower fields, Jhikargachha drives Bangladesh’s commercial floriculture.',
  },
  u501: {
    famousForBn: 'দেশের বৃহত্তম স্থলবন্দর বেনাপোল, ভারত-বাংলাদেশ প্রধান আন্তর্জাতিক প্রবেশপথ',
    famousForEn: 'Benapole—Bangladesh’s largest international land port—and border trade hub with West Bengal',
    landmarksBn: ['বেনাপোল আন্তর্জাতিক স্থলবন্দর ও ইমিগ্রেশন চেকপোস্ট', 'নাভারন-শার্শা ঐতিহাসিক সড়ক'],
    landmarksEn: ['Benapole International Land Port & Border Checkpost', 'Shata-Rupa Border Corridor'],
    specialtiesBn: 'আন্তর্জাতিক স্থল বাণিজ্য, আমদানি-রপ্তানি লজিস্টিকস ও কৃষি',
    specialtiesEn: 'Cross-border trade, customs logistics, and fertile western agriculture',
    connectivityBn: 'যশোর-বেনাপোল-কলকাতা মহাসড়ক ও রেলপথ (মৈত্রী/বন্ধন এক্সপ্রেস)',
    connectivityEn: 'Benapole–Kolkata Highway & Cross-Border Railway',
    summaryBn: 'যশোরের পশ্চিম সীমান্তবর্তী শার্শা উপজেলা দেশের বৃহত্তম ও ব্যস্ততম বেনাপোল আন্তর্জাতিক স্থলবন্দরের জন্য পরিচিত।',
    summaryEn: 'On the western border of Jashore, Sharsha hosts Benapole—the busiest international land port between Bangladesh and India.',
  },
  u498: {
    famousForBn: 'মহাকবি মাইকেল মধুসূদন দত্তের জন্মস্থান সাগরদাঁড়ি (কপোতাক্ষ নদের তীরে) ও ভরত ভায়না বৌদ্ধ স্তূপ',
    famousForEn: 'Birthplace of poet Michael Madhusudan Dutt at Sagardari on the Kopotakkho River and Bharat Bhayna mound',
    landmarksBn: ['মাইকেল মধুসূদন দত্তের বাড়ি ও জাদুঘর (সাগরদাঁড়ি)', 'কপোতাক্ষ নদের তীর', 'ভরত ভায়না প্রাচীন প্রত্নতাত্ত্বিক স্তূপ', 'কালাপাহাড়-পাঁজিয়া'],
    landmarksEn: ['Michael Madhusudan Dutt’s Homestead (Sagardari)', 'Kopotakkho Riverfront', 'Bharat Bhayna Archaeological Mound'],
    specialtiesBn: 'মধুসূদন সাহিত্য ঐতিহ্য, খেজুরের গুড় ও মিঠাপানির মাছ',
    specialtiesEn: 'Bengali literary heritage, date-palm molasses, and river fisheries',
    connectivityBn: 'যশোর-চুকনগর-সাতক্ষীরা সড়ক',
    connectivityEn: 'Jashore–Chuknagar–Satkhira Highway',
    summaryBn: 'কপোতাক্ষ নদের তীরে সাগরদাঁড়িতে বাংলা সাহিত্যের সনেট ও অমিত্রাক্ষর ছন্দের প্রবর্তক মাইকেল মধুসূদন দত্তের জন্মভূমি।',
    summaryEn: 'Home to Sagardari on the banks of the Kopotakkho River, birthplace of pioneering Bengali poet Michael Madhusudan Dutt.',
  },
  u534: {
    famousForBn: '১৯৭১ সালের ১৭ এপ্রিল বাংলাদেশের প্রথম অস্থায়ী সরকার শপথ গ্রহণের স্থান—ঐতিহাসিক মুজিবনগর (বৈদ্যনাথতলা)',
    famousForEn: 'Historic Mujibnagar (Baidyanathtala) where Bangladesh’s first provisional government took oath on 17 April 1971',
    landmarksBn: ['মুজিবনগর স্মৃতিসৌধ কমপ্লেক্স ও ঐতিহাসিক আম্রকানন', 'মুক্তিযুদ্ধের মানচিত্র ভাস্কর্য', 'স্বাধীনতার প্রথম রাজধানী জাদুঘর'],
    landmarksEn: ['Mujibnagar Memorial Complex & Mango Grove', '1971 Sector Map Sculpture', 'Liberation Heritage Museum'],
    specialtiesBn: 'মুক্তিযুদ্ধের গৌরবময় ইতিহাস, মেহেরপুরের হিমসাগর আম ও সবজি',
    specialtiesEn: 'Liberation War heritage, mangoes, and borderland agriculture',
    connectivityBn: 'মেহেরপুর-মুজিবনগর সড়ক',
    connectivityEn: 'Meherpur–Mujibnagar Highway',
    summaryBn: 'মেহেরপুরের মুজিবনগর বাংলাদেশের ইতিহাসে চিরস্মরণীয়—১৯৭১ সালের ১৭ এপ্রিল এখানেই স্বাধীন বাংলাদেশের প্রথম সরকার শপথ গ্রহণ করে।',
    summaryEn: 'A sacred landmark of 1971 history, Mujibnagar in Meherpur hosted the swearing-in of Bangladesh’s first provisional government.',
  },
  u525: {
    famousForBn: 'বাউল সম্রাট ফকির লালন শাহের আখড়া (ছেঁউড়িয়া), কাঙাল হরিনাথের ছাপাখানা ও দেশের অন্যতম প্রধান তাঁতশিল্প',
    famousForEn: 'Lalon Shah’s Akhara (Chheuria), Kangal Harinath’s 19th-century press, and vibrant handloom weaving',
    landmarksBn: ['লালন শাহের মাজার ও আখড়া (ছেঁউড়িয়া)', 'কাঙাল হরিনাথ স্মৃতি জাদুঘর', 'কুমারখালী-পান্টি তাঁতপল্লি', 'গড়াই নদী'],
    landmarksEn: ['Lalon Shah Akhara & Mausoleum (Chheuria)', 'Kangal Harinath Museum', 'Kumarkhali Textile Markets'],
    specialtiesBn: 'লুঙ্গি-গামছা-বেডশিট বয়ন শিল্প, বাউল সংগীত ও তিলের খাজা',
    specialtiesEn: 'Traditional lungi, gamcha, & textile weaving, Baul music, and sesame sweets',
    connectivityBn: 'কুষ্টিয়া-রাজবাড়ী মহাসড়ক (R710) ও রেলপথ',
    connectivityEn: 'Kushtia–Rajbari Highway (R710) and Railway',
    summaryBn: 'গড়াই নদীর তীরে কুমারখালী ও ছেঁউড়িয়া লালন ফকিরের মাজার এবং সমৃদ্ধ তাঁত-বস্ত্র শিল্পের জন্য দেশজুড়ে খ্যাত।',
    summaryEn: 'Along the Gorai River in Kushtia, Kumarkhali encompasses Lalon Shah’s spiritual shrine at Chheuria and a thriving textile industry.',
  },
  u526: {
    famousForBn: 'বিশ্বকবি রবীন্দ্রনাথ ঠাকুরের কুঠিবাড়ি (শিলাইদহ), মীর মশাররফ হোসেনের বাস্তুভিটা সংযোগ ও কুষ্টিয়ার তিলের খাজা',
    famousForEn: 'Rabindranath Tagore’s Shilaidaha Kuthibari manor, Garai–Padma cultural legacy, and sesame khaja sweets',
    landmarksBn: ['শিলাইদহ রবীন্দ্র কুঠিবাড়ি (কুমারখালী সীমান্ত সংলগ্ন)', 'ইসলামী বিশ্ববিদ্যালয় (শান্তিডাঙ্গা)', 'কুষ্টিয়া তিলের খাজা কারখানা', 'গড়াই রেলসেতু ও পদ্মা-গড়াই মোহনা'],
    landmarksEn: ['Islamic University Campus', 'Garai Railway Bridge', 'Kushtia Municipal Heritage & Parks'],
    specialtiesBn: 'কুষ্টিয়ার বিখ্যাত তিলের খাজা, কুলফি মালাই, চাল কল ও সাহিত্য ঐতিহ্য',
    specialtiesEn: 'Famous Kushtia Tiler Khaja, rice milling, and literary heritage',
    connectivityBn: 'কুষ্টিয়া-ঝিনাইদহ মহাসড়ক (N704) ও রেলপথ',
    connectivityEn: 'Kushtia–Jhenaidah Highway (N704) and Western Railway',
    summaryBn: 'বাংলাদেশের সাংস্কৃতিক রাজধানী খ্যাত কুষ্টিয়া সদর চাল উৎপাদন, তিলের খাজা ও সাহিত্য-সংগীতের ঐতিহ্যের জন্য সুপরিচিত।',
    summaryEn: 'Often celebrated as Bangladesh’s cultural heartland in the southwest, Kushtia Sadar anchors literature, rice mills, and famous sesame sweets.',
  },
  u322: {
    famousForBn: 'সাগরকন্যা কুয়াকাটা সমুদ্রসৈকত (যেখান থেকে একই স্থানে সূর্যোদয় ও সূর্যাস্ত দেখা যায়), পায়রা বন্দর সংলগ্ন ও রাখাইন পল্লি',
    famousForEn: 'Kuakata Sea Beach ("Daughter of the Sea") offering both sunrise and sunset over the Bay of Bengal, and Payra Port',
    landmarksBn: ['কুয়াকাটা সমুদ্রসৈকত (১৮ কিমি দীর্ঘ)', 'গঙ্গামতির চর ও ফাতরার চর (ম্যানগ্রোভ)', 'মিশ্রিপাড়া বৌদ্ধ বিহার ও রাখাইন পল্লি', 'পায়রা সমুদ্রবন্দর ও সাবমেরিন কেবল স্টেশন'],
    landmarksEn: ['Kuakata Sea Beach (Sunrise & Sunset)', 'Gangamati & Fatrar Char Mangroves', 'Misripara Rakhine Buddhist Temple', 'Payra Seaport'],
    specialtiesBn: 'সামুদ্রিক মাছ, রাখাইন তাঁতবস্ত্র, শুঁটকি ও নারিকেল',
    specialtiesEn: 'Rakhine handloom fabrics, marine hilsa, dried fish, and beach tourism',
    connectivityBn: 'পটুয়াখালী-কুয়াকাটা মহাসড়ক (পায়রা ও লেবুখালী সেতু হয়ে)',
    connectivityEn: 'Barishal–Patuakhali–Kuakata Highway via Payra Bridge',
    summaryBn: 'বঙ্গোপসাগরের তীরে কলাপাড়া উপজেলায় অবস্থিত কুয়াকাটা সৈকত থেকে একই সাথে সূর্যোদয় ও সূর্যাস্তের বিরল দৃশ্য দেখা যায়।',
    summaryEn: 'At the southern tip of Patuakhali, Kalapara hosts Kuakata—one of the rare beaches in the world offering both sunrise and sunset over the sea—plus Payra Seaport.',
    isCoastal: true,
  },
  u309: {
    famousForBn: 'কুকরি-মুকরি বন্যপ্রাণী অভয়ারণ্য, ঢালচর, জ্যাকব টাওয়ার এবং ভোলার সর্বদক্ষিণ দ্বীপাঞ্চল',
    famousForEn: 'Kukri Mukri coastal mangrove sanctuary, Jacob Watchtower, and southern island chars of Bhola',
    landmarksBn: ['চর কুকরি-মুকরি বন্যপ্রাণী অভয়ারণ্য ও তারুয়া সৈকত', 'জ্যাকব টাওয়ার (১৯তলা পর্যবেক্ষণ টাওয়ার)', 'মনপুরা-বেতুয়া লঞ্চঘাট ও মেঘনা মোহনা'],
    landmarksEn: ['Char Kukri Mukri Wildlife Sanctuary & Tarua Beach', 'Jacob Observation Tower', 'Betua Riverfront'],
    specialtiesBn: 'ভোলার মহিষের দই, ইলিশ, ম্যানগ্রোভ মধু ও নারিকেল',
    specialtiesEn: 'Buffalo curd, Meghna estuary hilsa, mangrove tourism, and coconuts',
    connectivityBn: 'ভোলা-চরফ্যাশন মহাসড়ক ও বেতুয়া-ঢাকা লঞ্চ সার্ভিস',
    connectivityEn: 'Bhola–Char Fasson Highway and Dhaka–Betua Launch Route',
    summaryBn: 'বঙ্গোপসাগরের মোহনায় ভোলার চর ফ্যাশন জ্যাকব টাওয়ার ও চর কুকরি-মুকরির ম্যানগ্রোভ সৈকতের জন্য ভ্রমণকারীদের কাছে প্রসিদ্ধ।',
    summaryEn: 'At the southern tip of Bhola Island, Char Fasson draws visitors to towering Jacob Tower and the wild mangrove beaches of Char Kukri Mukri.',
    isCoastal: true,
  },
  u329: {
    famousForBn: 'আটঘর কুড়িয়ানা ভাসমান পেয়ারা বাজার (বাংলার ভেনিস), ব্যাকওয়াটার খাল ও কাঠের নৌকা শিল্প',
    famousForEn: 'Floating guava market of Atghar Kuriana, scenic backwater canals, and traditional wooden boat building',
    landmarksBn: ['আটঘর কুড়িয়ানা ভাসমান পেয়ারা বাজার', 'সন্ধ্যা ও স্বরূপকাঠী নদীর কাঠ ও নৌকার হাট', 'ভীমরুলী সংযোগ জলপথ'],
    landmarksEn: ['Atghar Kuriana Floating Guava Market', 'Swarupkathi Timber & Boat Bazaar', 'Backwater Canal Cruises'],
    specialtiesBn: 'স্বরূপকাঠীর পেয়ারা, আমড়া, কাঠের আসবাব ও নৌকা তৈরি',
    specialtiesEn: 'Kuriana guavas, hog-plums (amra), timber trade, and hand-built wooden boats',
    connectivityBn: 'বরিশাল-বানারীপাড়া-স্বরূপকাঠী সড়ক ও সন্ধ্যা নদী',
    connectivityEn: 'Barishal–Banaripara–Swarupkathi Road and Sandhya River',
    summaryBn: 'জালিয়া-খাল আর শত শত বাগানের জন্য বিখ্যাত পিরোজপুরের নেছারাবাদ (স্বরূপকাঠী)—আটঘর কুড়িয়ানার ভাসমান পেয়ারা বাজার এখানেই।',
    summaryEn: 'Known locally as Swarupkathi, Nesarabad is famed for its labyrinth of canals, floating guava markets at Kuriana, and boat-building yards.',
  },
};

const COASTAL_DISTRICTS = new Set(['34', '35', '36', '37', '38', '39', '43', '45', '46', '49', '55', '59', '64']);
const HAOR_DISTRICTS = new Set(['6', '13', '41', '51', '52', '53', '54']);
const HILL_DISTRICTS = new Set(['40', '47', '50']);
const BARIND_DISTRICTS = new Set(['18', '19', '20', '21', '22', '24', '26', '27', '33']);

export function hasCuratedUpazilaDetail(id: string): boolean {
  return Boolean(CURATED_UPAZILAS[id]);
}

export function getRelativeOffsetLabel(u: GeoUpazila, d: GeoDistrict): { bn: string; en: string } {
  const w = Math.max(10, d.bbox[2] - d.bbox[0]);
  const h = Math.max(10, d.bbox[3] - d.bbox[1]);
  const dx = (u.cx - d.cx) / w;
  const dy = (u.cy - d.cy) / h;

  const ns = dy < -0.14 ? 'north' : dy > 0.14 ? 'south' : '';
  const ew = dx < -0.14 ? 'west' : dx > 0.14 ? 'east' : '';

  if (ns === 'north' && ew === 'east') return { bn: 'জেলার উত্তর-পূর্ব অংশ', en: 'Northeastern part of district' };
  if (ns === 'north' && ew === 'west') return { bn: 'জেলার উত্তর-পশ্চিম অংশ', en: 'Northwestern part of district' };
  if (ns === 'south' && ew === 'east') return { bn: 'জেলার দক্ষিণ-পূর্ব অংশ', en: 'Southeastern part of district' };
  if (ns === 'south' && ew === 'west') return { bn: 'জেলার দক্ষিণ-পশ্চিম অংশ', en: 'Southwestern part of district' };
  if (ns === 'north') return { bn: 'জেলার উত্তর অংশ', en: 'Northern part of district' };
  if (ns === 'south') return { bn: 'জেলার দক্ষিণ অংশ', en: 'Southern part of district' };
  if (ew === 'east') return { bn: 'জেলার পূর্ব অংশ', en: 'Eastern part of district' };
  if (ew === 'west') return { bn: 'জেলার পশ্চিম অংশ', en: 'Western part of district' };
  return { bn: 'জেলার মধ্যভাগ', en: 'Central part of district' };
}

export interface UpazilaDetailOptions {
  districtUpazilas?: GeoUpazila[];
  crossDistrictNamesBn?: string[];
  crossDistrictNamesEn?: string[];
}

export function getUpazilaDetail(
  upazila: GeoUpazila,
  parentDistrict: GeoDistrict,
  parentDivision: GeoDivision,
  riverNamesBn: string[],
  riverNamesEn: string[],
  options: UpazilaDetailOptions = {}
): UpazilaDetail {
  const distDetail = DISTRICT_DETAILS[parentDistrict.id];
  const divMeta = DIVISION_META[parentDivision.id];
  const curated = CURATED_UPAZILAS[upazila.id];

  const relPos = getRelativeOffsetLabel(upazila, parentDistrict);
  const directionLabelBn = `${distDetail?.directionLabelBn || divMeta?.directionBn || ''} · ${relPos.bn}`;
  const directionLabelEn = `${distDetail?.directionLabelEn || divMeta?.directionEn || ''} · ${relPos.en}`;

  const lowerName = upazila.name.toLowerCase();
  const isSadar = lowerName.includes('sadar') || lowerName === 'kotwali';
  const isUrbanThana =
    curated?.isUrbanThana ??
    (upazila.areaKm2 <= 32 && ['1', '43', '59', '24'].includes(parentDistrict.id));
  const isHill = curated?.isHill ?? HILL_DISTRICTS.has(parentDistrict.id);
  const isHaor = curated?.isHaor ?? HAOR_DISTRICTS.has(parentDistrict.id);
  const isCoastal =
    curated?.isCoastal ??
    (COASTAL_DISTRICTS.has(parentDistrict.id) &&
      (lowerName.includes('char') ||
        lowerName.includes('dwip') ||
        lowerName.includes('hatiya') ||
        lowerName.includes('sandwip') ||
        lowerName.includes('kutubdia') ||
        lowerName.includes('monpura') ||
        lowerName.includes('patharghata') ||
        lowerName.includes('taltali') ||
        lowerName.includes('mongla') ||
        lowerName.includes('shyamnagar') ||
        lowerName.includes('kalapara') ||
        lowerName.includes('teknaf') ||
        lowerName.includes('maheshkhali') ||
        lowerName.includes('ukhiya') ||
        lowerName.includes('ramu') ||
        lowerName.includes('banskhali') ||
        lowerName.includes('anwara') ||
        lowerName.includes('mirsharai') ||
        lowerName.includes('subarnachar')));
  const isBarind = BARIND_DISTRICTS.has(parentDistrict.id);

  const riversPhraseBn =
    riverNamesBn.length > 0
      ? `${riverNamesBn.join(', ')} নদীর অববাহিকা`
      : `${parentDistrict.bnName} জেলার সমৃদ্ধ অববাহিকা`;
  const riversPhraseEn =
    riverNamesEn.length > 0
      ? `${riverNamesEn.join(', ')} river basin`
      : `fertile plains of ${parentDistrict.name}`;

  const defaultFamousBn = isUrbanThana
    ? `${parentDistrict.bnName} মহানগরীর গুরুত্বপূর্ণ প্রশাসনিক ও বাণিজ্যিক থানা এলাকা; নগর সেবা, শিক্ষাপ্রতিষ্ঠান ও বাজারের জন্য পরিচিত`
    : isSadar
    ? `${parentDistrict.bnName} জেলার প্রশাসনিক সদর ও প্রধান বাণিজ্য কেন্দ্র; ${distDetail?.famousForBn || ''}`
    : isHill
    ? `${parentDistrict.bnName} পার্বত্য অঞ্চলের সবুজ পাহাড়, ঝিরি ও বৈচিত্র্যময় পাহাড়ি জনগোষ্ঠীর সংস্কৃতিসমৃদ্ধ উপজেলা`
    : isHaor
    ? `বিস্তীর্ণ হাওর-বিল, বোরো ধানের মাঠ এবং ${riversPhraseBn}-নির্ভর জলজ ও মৎস্য সম্পদের জন্য পরিচিত`
    : isCoastal
    ? `উপকূলীয় ম্যানগ্রোভ বেষ্টনী, ${riversPhraseBn} ও সামুদ্রিক-মৎস্য অর্থনীতির গুরুত্বপূর্ণ জনপদ`
    : isBarind
    ? `বরেন্দ্রভূমির উর্বর কৃষি, ${riversPhraseBn} এবং ${parentDistrict.bnName} জেলার আঞ্চলিক ঐতিহ্যের অংশীদার`
    : `${riversPhraseBn}, সবুজ কৃষি অর্থনীতি ও ${parentDistrict.bnName} জেলার আঞ্চলিক ঐতিহ্যের গুরুত্বপূর্ণ জনপদ`;

  const defaultFamousEn = isUrbanThana
    ? `Key metropolitan thana of ${parentDistrict.name} city, serving as an urban, residential, and commercial center`
    : isSadar
    ? `Administrative headquarters and primary commercial hub of ${parentDistrict.name} District; ${distDetail?.famousForEn || ''}`
    : isHill
    ? `Scenic hill-tract upazila of ${parentDistrict.name} known for forested ridges, mountain streams, and indigenous heritage`
    : isHaor
    ? `Seasonal haor wetland heartland known for boro paddy cultivation and freshwater fisheries along the ${riversPhraseEn}`
    : isCoastal
    ? `Coastal delta upazila along the ${riversPhraseEn}, shaped by tidal estuaries, aquaculture, and maritime livelihoods`
    : isBarind
    ? `Productive Barind agricultural upazila in ${parentDistrict.name}, rooted in the ${riversPhraseEn}`
    : `Important agricultural and riverine upazila of ${parentDistrict.name} District along the ${riversPhraseEn}`;

  const distLandmarksBn = distDetail?.landmarksBn.slice(0, 3) || [];
  const distLandmarksEn = distDetail?.landmarksEn.slice(0, 3) || [];

  const defaultLandmarksBn = isUrbanThana
    ? [
        `${upazila.bnName} প্রধান বাণিজ্যিক ও সাংস্কৃতিক কেন্দ্র`,
        `${upazila.bnName} শিক্ষাপ্রতিষ্ঠান ও নাগরিক সেবা বলয়`,
      ]
    : isSadar
    ? [
        `${parentDistrict.bnName} জেলা প্রশাসনিক ও কেন্দ্রীয় উদ্যান এলাকা`,
        ...distLandmarksBn,
      ]
    : [
        `${upazila.bnName} উপজেলা কেন্দ্রীয় বাজার ও ঐতিহ্যবাহী এলাকা`,
        ...(riverNamesBn.length > 0
          ? [`${riverNamesBn[0]} নদীর পাড় ও প্রাকৃতিক দৃশ্য`]
          : []),
        `${upazila.bnName} গ্রামীণ কৃষি ও জনপদ`,
      ];

  const defaultLandmarksEn = isUrbanThana
    ? [
        `${upazila.name} commercial and civic corridor`,
        `${upazila.name} educational and urban hub`,
      ]
    : isSadar
    ? [`${parentDistrict.name} Central Civic & Park Zone`, ...distLandmarksEn]
    : [
        `${upazila.name} central market and heritage zone`,
        ...(riverNamesEn.length > 0
          ? [`${riverNamesEn[0]} riverbank vistas`]
          : []),
        `${upazila.name} countryside and riverine trails`,
      ];

  const defaultSpecialtiesBn =
    isUrbanThana
      ? 'বাণিজ্যিক সেবা, ক্ষুদ্র ও মাঝারি ব্যবসা, শিক্ষাপ্রতিষ্ঠান ও নাগরিক সংস্কৃতি'
      : isHaor
      ? 'বোরো ধান, হাওরের মিঠাপানির মাছ, শুঁটকি ও হাঁস পালন'
      : isHill
      ? 'পাহাড়ি ফল (আনারস, কমলা, কাজুবাদাম), জুম চাষ, আদা-হলুদ ও বাঁশ-বেত শিল্প'
      : isCoastal
      ? 'ইলিশ-চিংড়ি, নারিকেল-সুপারি, মৎস্য চাষ ও উপকূলীয় লবণ-কৃষি'
      : isBarind
      ? 'উচ্চফলনশীল আমন-বোরো ধান, আম, আলু, ভুট্টা ও মসলা'
      : 'আমন ও বোরো ধান, মৌসুমি সবজি, পাট এবং মিঠাপানির মাছ';

  const defaultSpecialtiesEn =
    isUrbanThana
      ? 'Urban commerce, services, retail hubs, and civic institutions'
      : isHaor
      ? 'Boro rice, native haor freshwater fish, dried fish, and duck farming'
      : isHill
      ? 'Hilltop pineapples, cashew nuts, bananas, spices, and bamboo crafts'
      : isCoastal
      ? 'Hilsa & shrimp aquaculture, coconut, betel nut, and coastal farming'
      : isBarind
      ? 'High-yield rice, Barind mangoes, potatoes, maize, and spices'
      : 'Paddy, jute, seasonal vegetables, and freshwater aquaculture';

  const areaBn = toBnDigits(upazila.areaKm2.toLocaleString('en-US'));
  const pop = upazila.population || 0;
  const popBn = toBnDigits(pop.toLocaleString('en-US'));
  const popEn = pop.toLocaleString('en-US');
  const density = upazila.areaKm2 > 0 ? Math.round(pop / upazila.areaKm2) : 0;
  const densityBn = toBnDigits(density.toLocaleString('en-US'));
  const unitBn = isUrbanThana ? 'থানা' : 'উপজেলা';
  const unitEn = isUrbanThana ? 'thana' : 'upazila';

  const defaultHistoryBn = isUrbanThana
    ? `${parentDistrict.bnName} মহানগরীর প্রায় ${areaBn} বর্গকিমি জুড়ে বিস্তৃত এই ${unitBn} এলাকায় আধুনিক নাগরিক সেবা, ব্যবসা-বাণিজ্য ও শিক্ষা প্রতিষ্ঠান কেন্দ্রীভূত।`
    : `${parentDistrict.bnName} জেলার ${relPos.bn}ে প্রায় ${areaBn} বর্গকিমি এলাকা জুড়ে বিস্তৃত ${upazila.bnName} উপজেলা; কৃষি, হাট-বাজার ও ${
        riverNamesBn.length > 0 ? `${riverNamesBn[0]} নদীকেন্দ্রিক` : 'স্থানীয়'
      } অর্থনীতি এখানকার মানুষের জীবিকার প্রধান ভিত্তি।`;

  const defaultHistoryEn = isUrbanThana
    ? `Covering ${upazila.areaKm2.toLocaleString()} km² within metropolitan ${parentDistrict.name}, ${upazila.name} supports dense civic, commercial, and educational activity.`
    : `Spanning ${upazila.areaKm2.toLocaleString()} km² in the ${relPos.en.toLowerCase()}, ${upazila.name} sustains ${parentDistrict.name}’s rural commerce, farming, and ${
        riverNamesEn.length > 0 ? `${riverNamesEn[0]}-side` : 'local'
      } trade.`;

  const defaultConnectivityBn =
    riverNamesBn.length > 0
      ? `${parentDistrict.bnName} জেলা সদর সংযোগকারী আঞ্চলিক মহাসড়ক এবং ${riverNamesBn.join(', ')} নদীপথ`
      : distDetail?.connectivityBn || `${parentDistrict.bnName} জেলা সংযোগকারী আঞ্চলিক সড়কপথ`;

  const defaultConnectivityEn =
    riverNamesEn.length > 0
      ? `Regional highways linking ${parentDistrict.name} headquarters and ${riverNamesEn.join(', ')} waterways`
      : distDetail?.connectivityEn || `Regional highway network connecting ${parentDistrict.name}`;

  const defaultSummaryBn = `${parentDivision.bnName} বিভাগের ${parentDistrict.bnName} জেলার ${
    isUrbanThana ? 'গুরুত্বপূর্ণ থানা' : 'অন্যতম গুরুত্বপূর্ণ উপজেলা'
  } ${upazila.bnName} (${areaBn} বর্গকিমি, জনসংখ্যা ~${popBn}); ${
    riverNamesBn.length > 0 ? `${riverNamesBn.join(' ও ')} নদীর প্রবাহ এবং ` : ''
  }${relPos.bn}ের অনন্য ভৌগোলিক অবস্থানের জন্য পরিচিত।`;

  const defaultSummaryEn = `${upazila.name} (${upazila.areaKm2.toLocaleString()} km², pop. ~${popEn}) is a key ${
    isUrbanThana ? 'metropolitan thana' : 'upazila'
  } in ${parentDistrict.name} District, ${parentDivision.name} Division, ${
    riverNamesEn.length > 0
      ? `crossed by the ${riverNamesEn.join(' and ')} river system.`
      : `anchored in the ${relPos.en.toLowerCase()}.`
  }`;

  // Build 3-4 accurate, non-generic Interesting Facts specific to this Upazila
  const generatedFactsBn: string[] = [];
  const generatedFactsEn: string[] = [];

  if (pop > 0) {
    generatedFactsBn.push(
      `২০২২ সালের আদমশুমারি অনুযায়ী ${upazila.bnName} ${unitBn}র জনসংখ্যা প্রায় ${popBn} এবং প্রতি বর্গকিলোমিটারে জনঘনত্ব প্রায় ${densityBn} জন।`
    );
    generatedFactsEn.push(
      `As of the 2022 census, ${upazila.name} ${unitEn} has a population of ~${popEn} with a density of ~${density.toLocaleString()} people per km².`
    );
  }

  const siblings = options.districtUpazilas && options.districtUpazilas.length > 0 ? options.districtUpazilas : [];
  if (siblings.length >= 2) {
    const byArea = [...siblings].sort((a, b) => b.areaKm2 - a.areaKm2);
    const areaRank = byArea.findIndex((s) => s.id === upazila.id) + 1;
    const byPop = [...siblings].sort((a, b) => (b.population || 0) - (a.population || 0));
    const popRank = byPop.findIndex((s) => s.id === upazila.id) + 1;
    const totalSibs = siblings.length;

    const toBnOrd = (n: number) => {
      if (n === 1) return '১ম';
      if (n === 2) return '২য়';
      if (n === 3) return '৩য়';
      if (n === 4) return '৪র্থ';
      if (n === 5) return '৫ম';
      if (n === 6) return '৬ষ্ঠ';
      if (n >= 7 && n <= 10) return `${toBnDigits(String(n))}ম`;
      return `${toBnDigits(String(n))}তম`;
    };

    const areaRankBn =
      areaRank === 1
        ? `আয়তনের দিক থেকে ${upazila.bnName} ${parentDistrict.bnName} জেলার বৃহত্তম ${unitBn} (${areaBn} কিমি²)`
        : areaRank === totalSibs
        ? `আয়তনের দিক থেকে ${upazila.bnName} ${parentDistrict.bnName} জেলার ক্ষুদ্রতম ${unitBn} (${areaBn} কিমি²)`
        : `আয়তনে এটি ${parentDistrict.bnName} জেলার ${toBnDigits(totalSibs)}টি ইউনিটের মধ্যে ${toBnOrd(areaRank)} (${areaBn} কিমি²)`;

    const popRankBn =
      popRank === 1
        ? `জনসংখ্যায় জেলার শীর্ষে (১ম)।`
        : popRank === totalSibs
        ? `জনসংখ্যায় জেলার সর্বনিম্ন।`
        : `জনসংখ্যার দিক থেকে জেলায় ${toBnOrd(popRank)} স্থানে রয়েছে।`;

    generatedFactsBn.push(`${areaRankBn} এবং ${popRankBn}`);

    const areaRankEn =
      areaRank === 1
        ? `largest by area (${upazila.areaKm2} km²)`
        : areaRank === totalSibs
        ? `smallest by area (${upazila.areaKm2} km²)`
        : `ranks #${areaRank} of ${totalSibs} by area (${upazila.areaKm2} km²)`;
    const popRankEn =
      popRank === 1
        ? `most populous`
        : popRank === totalSibs
        ? `least populous`
        : `ranks #${popRank} in population`;
    generatedFactsEn.push(
      `Within ${parentDistrict.name} District, ${upazila.name} is ${areaRankEn} and ${popRankEn}.`
    );
  }

  const extDistsBn = options.crossDistrictNamesBn || [];
  const extDistsEn = options.crossDistrictNamesEn || [];
  if (upazila.neighbors.length === 0) {
    generatedFactsBn.push(
      `স্থলপথে কোনো পার্শ্ববর্তী উপজেলার সাথে সরাসরি যুক্ত নয়—${upazila.bnName} একটি সম্পূর্ণ বিচ্ছিন্ন দ্বীপ জনপদ।`
    );
    generatedFactsEn.push(
      `With 0 land-bordering neighbors, ${upazila.name} is a geographically detached offshore island upazila.`
    );
  } else if (extDistsBn.length > 0) {
    generatedFactsBn.push(
      `মোট ${toBnDigits(upazila.neighbors.length)}টি পার্শ্ববর্তী উপজেলার সাথে সীমান্ত রয়েছে; নিজ জেলা ${parentDistrict.bnName} ছাড়াও ${extDistsBn.join(', ')} জেলার সাথে সরাসরি যুক্ত।`
    );
    generatedFactsEn.push(
      `Borders ${upazila.neighbors.length} neighboring units, touching external district(s) ${extDistsEn.join(', ')} beyond ${parentDistrict.name}.`
    );
  } else {
    generatedFactsBn.push(
      `${parentDistrict.bnName} জেলার সম্পূর্ণ অভ্যন্তরে অবস্থিত এই ${unitBn}টির চারপাশে মোট ${toBnDigits(upazila.neighbors.length)}টি পার্শ্ববর্তী উপজেলা/থানা রয়েছে।`
    );
    generatedFactsEn.push(
      `Completely nestled inside ${parentDistrict.name} District, surrounded directly by ${upazila.neighbors.length} neighboring upazilas/thanas.`
    );
  }

  if (riverNamesBn.length > 0) {
    generatedFactsBn.push(
      `বাংলাদেশের মানচিত্রের প্রধান ৩০টি নদ-নদীর মধ্যে ${riverNamesBn.join(' ও ')} সরাসরি ${upazila.bnName}-এর ওপর দিয়ে প্রবাহিত হয়েছে।`
    );
    generatedFactsEn.push(
      `Among Bangladesh’s 30 major mapped rivers, the ${riverNamesEn.join(' and ')} flow(s) directly through ${upazila.name}.`
    );
  } else {
    const geoTagBn = isUrbanThana
      ? `${parentDistrict.bnName} মহানগরীর ঘনবসতিপূর্ণ ও গুরুত্বপূর্ণ নগর সেবা অঞ্চল হিসেবে পরিচিত।`
      : isHaor
      ? `বর্ষায় বিস্তীর্ণ হাওর জলরাশি ও শীতে দেশের অন্যতম প্রধান বোরো ধান ও মৎস্য উৎপাদক অঞ্চল।`
      : isCoastal
      ? `বঙ্গোপসাগর উপকূলের জোয়ার-ভাটা, ম্যানগ্রোভ ও চরাঞ্চলীয় মৎস্য সম্পদে সমৃদ্ধ জনপদ।`
      : isHill
      ? `সবুজ পাহাড়ি টিলা, ঝিরি ও প্রাকৃতিক বনাঞ্চলবেষ্টিত ভৌগোলিকভাবে বৈচিত্র্যময় এলাকা।`
      : `${parentDistrict.bnName} জেলার ${relPos.bn}ে অবস্থিত উর্বর কৃষি, হাট-বাজার ও গ্রামীণ অর্থনীতির প্রাণবন্ত জনপদ।`;
    const geoTagEn = isUrbanThana
      ? `Functions as a high-density urban civic and commercial quarter of metropolitan ${parentDistrict.name}.`
      : isHaor
      ? `Transforms into a vast inland wetland during the monsoon and yields abundant Boro rice in winter.`
      : isCoastal
      ? `Shaped by tidal estuaries, mangrove ecosystems, and coastal aquaculture along the Bay of Bengal belt.`
      : isHill
      ? `Distinguished by lush forested hill ridges, mountain streams, and rich upland biodiversity.`
      : `Anchored in the ${relPos.en.toLowerCase()} of ${parentDistrict.name}, sustaining fertile plains and local markets.`;
    generatedFactsBn.push(geoTagBn);
    generatedFactsEn.push(geoTagEn);
  }

  const interestingFactsBn = curated?.interestingFactsBn
    ? [...curated.interestingFactsBn.slice(0, 3), ...generatedFactsBn.slice(0, 1)]
    : generatedFactsBn.slice(0, 4);
  const interestingFactsEn = curated?.interestingFactsEn
    ? [...curated.interestingFactsEn.slice(0, 3), ...generatedFactsEn.slice(0, 1)]
    : generatedFactsEn.slice(0, 4);

  return {
    directionLabelBn,
    directionLabelEn,
    famousForBn: curated?.famousForBn || defaultFamousBn,
    famousForEn: curated?.famousForEn || defaultFamousEn,
    landmarksBn: curated?.landmarksBn || defaultLandmarksBn,
    landmarksEn: curated?.landmarksEn || defaultLandmarksEn,
    specialtiesBn: curated?.specialtiesBn || defaultSpecialtiesBn,
    specialtiesEn: curated?.specialtiesEn || defaultSpecialtiesEn,
    historyEconomyBn: curated?.historyEconomyBn || defaultHistoryBn,
    historyEconomyEn: curated?.historyEconomyEn || defaultHistoryEn,
    connectivityBn: curated?.connectivityBn || defaultConnectivityBn,
    connectivityEn: curated?.connectivityEn || defaultConnectivityEn,
    summaryBn: curated?.summaryBn || defaultSummaryBn,
    summaryEn: curated?.summaryEn || defaultSummaryEn,
    interestingFactsBn,
    interestingFactsEn,
    isUrbanThana,
    isCoastal,
    isHaor,
    isHill,
  };
}
