export interface LanguageInfo {
  code: string;
  name: string;
  nativeName: string;
  script: string;
  isRtl?: boolean;
  isIndian?: boolean;
}

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  // 22 Scheduled Indian Languages + English
  { code: 'en', name: 'English', nativeName: 'English', script: 'Latin' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', script: 'Devanagari', isIndian: true },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', script: 'Tamil', isIndian: true },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', script: 'Telugu', isIndian: true },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', script: 'Kannada', isIndian: true },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', script: 'Malayalam', isIndian: true },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', script: 'Bengali', isIndian: true },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', script: 'Devanagari', isIndian: true },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', script: 'Gujarati', isIndian: true },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', script: 'Gurmukhi', isIndian: true },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', script: 'Odia', isIndian: true },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', script: 'Arabic', isRtl: true, isIndian: true },
  { code: 'as', name: 'Assamese', nativeName: 'অসমীয়া', script: 'Bengali', isIndian: true },
  { code: 'sa', name: 'Sanskrit', nativeName: 'संस्कृतम्', script: 'Devanagari', isIndian: true },
  { code: 'ne', name: 'Nepali', nativeName: 'नेपाली', script: 'Devanagari', isIndian: true },
  { code: 'kok', name: 'Konkani', nativeName: 'कोंकणी', script: 'Devanagari', isIndian: true },
  { code: 'mai', name: 'Maithili', nativeName: 'मैथिली', script: 'Devanagari', isIndian: true },
  { code: 'doi', name: 'Dogri', nativeName: 'डोगरी', script: 'Devanagari', isIndian: true },
  { code: 'brx', name: 'Bodo', nativeName: 'बड़ो', script: 'Devanagari', isIndian: true },
  { code: 'ks', name: 'Kashmiri', nativeName: 'کٲشُر / कॉशुर', script: 'Arabic', isRtl: true, isIndian: true },
  { code: 'sd', name: 'Sindhi', nativeName: 'سنڌي / सिन्धी', script: 'Arabic', isRtl: true, isIndian: true },
  { code: 'mni', name: 'Manipuri (Meitei)', nativeName: 'মৈতৈলোন্ / ꯃꯩꯇꯩꯂꯣꯟ', script: 'Meetei Mayek', isIndian: true },
  { code: 'sat', name: 'Santali', nativeName: 'ᱥᱟᱱᱛᱟᱲᱤ', script: 'Ol Chiki', isIndian: true },

  // Extras
  { code: 'es', name: 'Spanish', nativeName: 'Español', script: 'Latin' },
  { code: 'fr', name: 'French', nativeName: 'Français', script: 'Latin' },
  { code: 'de', name: 'German', nativeName: 'Deutsch', script: 'Latin' },
  { code: 'pt', name: 'Portuguese', nativeName: 'Português', script: 'Latin' },
  { code: 'ar', name: 'Arabic', nativeName: 'العربية', script: 'Arabic', isRtl: true },
  { code: 'zh', name: 'Chinese', nativeName: '中文', script: 'Han' },
  { code: 'ja', name: 'Japanese', nativeName: '日本語', script: 'Japanese' },
  { code: 'ko', name: 'Korean', nativeName: '한국어', script: 'Hangul' },
];

export const RTL_LANGUAGES = new Set(['ur', 'ks', 'sd', 'ar']);

export function isRtlLanguage(code: string): boolean {
  return RTL_LANGUAGES.has(code);
}

export function getLanguageByCode(code: string): LanguageInfo | undefined {
  return SUPPORTED_LANGUAGES.find((lang) => lang.code === code);
}

export interface ScriptDetectionResult {
  script: string;
  candidateLanguages: string[];
  requiresLlmDisambiguation: boolean;
  isRomanized?: boolean;
}

export function detectScriptFromUnicode(text: string): ScriptDetectionResult {
  const sample = text.trim();
  if (!sample) {
    return { script: 'Latin', candidateLanguages: ['en'], requiresLlmDisambiguation: false };
  }

  // Count character matches across major Unicode script ranges
  const scripts = [
    { name: 'Tamil', regex: /[\u0B80-\u0BFF]/g, langs: ['ta'] },
    { name: 'Telugu', regex: /[\u0C00-\u0C7F]/g, langs: ['te'] },
    { name: 'Kannada', regex: /[\u0C80-\u0CFF]/g, langs: ['kn'] },
    { name: 'Malayalam', regex: /[\u0D00-\u0D7F]/g, langs: ['ml'] },
    { name: 'Gujarati', regex: /[\u0A80-\u0AFF]/g, langs: ['gu'] },
    { name: 'Gurmukhi', regex: /[\u0A00-\u0A7F]/g, langs: ['pa'] },
    { name: 'Odia', regex: /[\u0B00-\u0B7F]/g, langs: ['or'] },
    { name: 'Ol Chiki', regex: /[\u1C50-\u1C7F]/g, langs: ['sat'] },
    { name: 'Meetei Mayek', regex: /[\uABC0-\uABFF\uAAE0-\uAAFF]/g, langs: ['mni'] },
    {
      name: 'Devanagari',
      regex: /[\u0900-\u097F]/g,
      langs: ['hi', 'mr', 'ne', 'kok', 'mai', 'doi', 'brx', 'sa'],
      shared: true,
    },
    {
      name: 'Bengali-Assamese',
      regex: /[\u0980-\u09FF]/g,
      langs: ['bn', 'as'],
      shared: true,
    },
    {
      name: 'Arabic-Perso',
      regex: /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g,
      langs: ['ur', 'ar', 'ks', 'sd'],
      shared: true,
    },
    { name: 'Han', regex: /[\u4E00-\u9FFF]/g, langs: ['zh'] },
    { name: 'Japanese', regex: /[\u3040-\u309F\u30A0-\u30FF]/g, langs: ['ja'] },
    { name: 'Hangul', regex: /[\uAC00-\uD7AF\u1100-\u11FF]/g, langs: ['ko'] },
  ];

  let bestScript = '';
  let maxCount = 0;
  let candidateLangs: string[] = ['en'];
  let shared = false;

  for (const s of scripts) {
    const matches = sample.match(s.regex);
    const count = matches ? matches.length : 0;
    if (count > maxCount) {
      maxCount = count;
      bestScript = s.name;
      candidateLangs = s.langs;
      shared = !!s.shared;
    }
  }

  // If non-Latin script dominant
  if (maxCount >= 2 || (maxCount > 0 && sample.length < 10)) {
    // If Devanagari, Marathi vs Hindi heuristic check
    if (bestScript === 'Devanagari') {
      // Characteristic Marathi characters/words: ळ (U+0933), आहे, नाही, काय, कसे, मला, तुला
      if (/ळ|आहे|नाही|काय|कसे|मला|तुला|करणार|झाले|होते|आहात/i.test(sample)) {
        return {
          script: 'Devanagari',
          candidateLanguages: ['mr'],
          requiresLlmDisambiguation: false,
        };
      }
      // Common Nepali words: छ, छैन, गर्छु, भयो, हुन्छ
      if (/छ|छैन|गर्छु|भयो|हुन्छ/i.test(sample)) {
        return {
          script: 'Devanagari',
          candidateLanguages: ['ne'],
          requiresLlmDisambiguation: false,
        };
      }
      // Characteristic Hindi words: है, हैं, क्या, कैसे, मुझे, करो, और, नहीं
      if (/है|हैं|क्या|कैसे|मुझे|करो|और|नहीं|होता|सकता/i.test(sample)) {
        return {
          script: 'Devanagari',
          candidateLanguages: ['hi'],
          requiresLlmDisambiguation: false,
        };
      }
    }

    // Assamese vs Bengali heuristic:
    // Assamese specific characters: ৰ (U+09F0), ৱ (U+09F1)
    if (bestScript === 'Bengali-Assamese') {
      if (/[\u09F0\u09F1]|নহয়|আছে|কৰি|মই|তুমি/i.test(sample)) {
        return {
          script: 'Bengali-Assamese',
          candidateLanguages: ['as'],
          requiresLlmDisambiguation: false,
        };
      }
      if (/আছি|করব|করছি|কি|কেন|তুমি|ভালো/i.test(sample)) {
        return {
          script: 'Bengali-Assamese',
          candidateLanguages: ['bn'],
          requiresLlmDisambiguation: false,
        };
      }
    }

    return {
      script: bestScript,
      candidateLanguages: candidateLangs,
      requiresLlmDisambiguation: shared,
    };
  }

  // Latin text: detect if romanized Indic (Hinglish, Tanglish, Manglish, etc.)
  const lower = sample.toLowerCase();

  // Tanglish markers: vanakkam, enna, epdi, nalla, irukeengala, romba, theriyum, pannunga, sollunga, inga, anga
  if (/\b(vanakkam|epdi|nalla|irukken|irukeengala|romba|enna|sollunga|pannunga|theriyum|illai|aama|yaar|yen|enga)\b/i.test(lower)) {
    return {
      script: 'Latin',
      candidateLanguages: ['ta'],
      requiresLlmDisambiguation: false,
      isRomanized: true,
    };
  }

  // Hinglish markers: namaste, kya, kaise, ho, achha, theek, batao, karna, hoga, nahi, mujhe, aapka
  if (/\b(namaste|kya|kaise|achha|theek|batao|karna|hoga|nahi|mujhe|tumhara|aapka|bhai|yaar|chal|sahi|kuch)\b/i.test(lower)) {
    return {
      script: 'Latin',
      candidateLanguages: ['hi'],
      requiresLlmDisambiguation: false,
      isRomanized: true,
    };
  }

  // Default to English Latin
  return {
    script: 'Latin',
    candidateLanguages: ['en'],
    requiresLlmDisambiguation: false,
    isRomanized: false,
  };
}

/**
 * Split document text into sentence chunks respecting Indic sentence terminators:
 * "." (Latin/general), "।" (Danda / Devanagari/Bengali/etc.), "॥" (Double Danda),
 * "?" (Question), "!" (Exclamation), "۔" (Urdu / Arabic full stop U+06D4)
 */
export function splitIndicSentences(text: string): string[] {
  if (!text) return [];
  // Regex splitting on Indic & standard sentence punctuation followed by space or newline
  const sentenceEndPattern = /([.!?।॥۔]+[\s\r\n]+)/g;
  const parts = text.split(sentenceEndPattern);
  const sentences: string[] = [];

  for (let i = 0; i < parts.length; i += 2) {
    const chunk = parts[i] || '';
    const punct = parts[i + 1] || '';
    const full = (chunk + punct).trim();
    if (full.length > 0) {
      sentences.push(full);
    }
  }

  return sentences.length > 0 ? sentences : [text.trim()];
}
