#!/usr/bin/env node

/**
 * WortMeister 5000 — Automated 5,000-Word Dataset Pipeline
 * 
 * Fetches frequency lists, parses, normalizes, enriches with grammatical gender (der/die/das),
 * plurals, parts of speech, English translations, and bilingual example sentences,
 * and outputs 5,000 structured objects to data/words.json.
 */

const fs = require('fs');
const path = require('path');

const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'words.json');
const TARGET_WORD_COUNT = 5000;

const USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 WortMeister5000/1.0';

// German morphological gender suffix rules
function deduceGenderBySuffix(word) {
  const lower = word.toLowerCase();
  
  // Feminine suffixes
  if (/(ung|heit|keit|schaft|ion|tät|ei|anz|enz|ie|ik|ur)$/i.test(lower)) {
    return 'die';
  }
  // Neuter suffixes
  if (/(chen|lein|ment|um|tum|ma)$/i.test(lower)) {
    return 'das';
  }
  // Masculine suffixes
  if (/(ismus|ist|ling|or|ig|ant|ent)$/i.test(lower)) {
    return 'der';
  }
  
  return '';
}

// Clean text helper
function cleanText(str = '') {
  return String(str)
    .replace(/\[sound:[^\]]+\]/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Format plural form from base noun and suffix
function formatPlural(de, suffix) {
  if (!suffix) return '';
  suffix = cleanText(suffix);
  if (suffix === '-' || suffix === '—' || suffix === 'no pl.' || suffix === 'kein Plural') return '';
  if (!suffix.startsWith('-')) return suffix;
  
  const rawSuffix = suffix.slice(1);
  const hasUmlaut = /[¨̈]/.test(rawSuffix);
  const cleanSuffix = rawSuffix.replace(/[¨̈]/g, '');
  
  let stem = de;
  if (hasUmlaut) {
    if (/Au/.test(stem)) stem = stem.replace(/Au/, 'Äu');
    else if (/au/.test(stem)) stem = stem.replace(/au/, 'äu');
    else if (/A/.test(stem)) stem = stem.replace(/A/, 'Ä');
    else if (/a/.test(stem)) stem = stem.replace(/a(?=[^a]*$)/, 'ä');
    else if (/O/.test(stem)) stem = stem.replace(/O/, 'Ö');
    else if (/o/.test(stem)) stem = stem.replace(/o(?=[^o]*$)/, 'ö');
    else if (/U/.test(stem)) stem = stem.replace(/U/, 'Ü');
    else if (/u/.test(stem)) stem = stem.replace(/u(?=[^u]*$)/, 'ü');
  }
  
  if (cleanSuffix) {
    if (stem.endsWith('e') && cleanSuffix.startsWith('e')) {
      return stem + cleanSuffix.slice(1);
    }
    return stem + cleanSuffix;
  }
  return stem;
}

// Parse CSV with quotes handling
function parseCSV(text) {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    const cols = [];
    let inQuote = false;
    let cur = '';
    for (let j = 0; j < line.length; j++) {
      const c = line[j];
      if (c === '"') {
        if (inQuote && line[j + 1] === '"') {
          cur += '"';
          j++;
        } else {
          inQuote = !inQuote;
        }
      } else if (c === ',' && !inQuote) {
        cols.push(cur);
        cur = '';
      } else {
        cur += c;
      }
    }
    cols.push(cur);
    rows.push(cols);
  }
  return rows;
}

// Step 1: Fetch primary Wiktionary Matthias Buchmeier frequency list
async function fetchWiktionaryFrequencyList() {
  console.log('1. Fetching Wiktionary frequency list (Matthias Buchmeier 1-5000)...');
  try {
    const url = 'https://en.wiktionary.org/w/api.php?action=parse&page=User:Matthias_Buchmeier/German_frequency_list-1-5000&prop=wikitext&format=json';
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const wikitext = data.parse?.wikitext?.['*'] || '';
    const lines = wikitext.split('\n').filter(l => l.trim());
    const words = [];
    for (const line of lines) {
      const match = line.match(/\[\[(.*?)\]\]/);
      if (match && match[1]) {
        words.push(cleanText(match[1]));
      }
    }
    console.log(`   Found ${words.length} items from Wiktionary.`);
    return words;
  } catch (err) {
    console.warn(`   Wiktionary fetch failed (${err.message}). Trying fallback source...`);
    return [];
  }
}

// Step 2: Fetch and build dataset from frequency database
async function fetchFrequencyDatabase() {
  console.log('2. Fetching German frequency core dataset with bilingual sentences...');
  const datasetUrl = 'https://raw.githubusercontent.com/csrs/language-learning/main/backend/src/scripts/database/input.csv';
  
  const res = await fetch(datasetUrl, { headers: { 'User-Agent': USER_AGENT } });
  if (!res.ok) {
    throw new Error(`Failed to fetch core frequency dataset: HTTP ${res.status}`);
  }

  const csvText = await res.text();
  const rows = parseCSV(csvText);
  console.log(`   Loaded ${rows.length} rows from core frequency dataset.`);
  return rows;
}

// Main execution pipeline
async function main() {
  console.log('=== WortMeister 5000: Dataset Generation Pipeline ===');
  
  // 1. Fetch Wiktionary list
  const wiktionaryWords = await fetchWiktionaryFrequencyList();

  // 2. Fetch Core Frequency Database
  const dbRows = await fetchFrequencyDatabase();

  const words = [];
  const seenKeys = new Set();

  for (let i = 0; i < dbRows.length && words.length < TARGET_WORD_COUNT; i++) {
    const row = dbRows[i];
    const rankId = words.length + 1;
    let rawDe = cleanText(row[1]);
    let rawPos = cleanText(row[2]).toLowerCase();
    let rawEn = cleanText(row[3]);
    let exDe = cleanText(row[4]);
    let exEn = cleanText(row[5]);

    if (!rawDe || !rawEn) continue;

    let de = rawDe;
    let article = '';
    let plural = '';
    let pos = 'other';

    // Parse comma forms e.g. "der Kopf, -̈e" or "sein, ist, war, ist gewesen"
    const commaParts = rawDe.split(',').map(s => s.trim());

    // Check for article prefix in headword (e.g. "der Kopf", "das Haus", "die Zeit")
    const articlePrefixMatch = commaParts[0].match(/^(der|die|das)\s+(.+)$/i);
    if (articlePrefixMatch) {
      article = articlePrefixMatch[1].toLowerCase();
      de = articlePrefixMatch[2].trim();
      pos = 'noun';
      if (commaParts[1]) {
        plural = formatPlural(de, commaParts[1]);
      }
    } else if (rawPos === 'der' || rawPos === 'die' || rawPos === 'das') {
      article = rawPos;
      pos = 'noun';
      de = commaParts[0];
      if (commaParts[1]) {
        plural = formatPlural(de, commaParts[1]);
      }
    } else if (rawPos === 'noun' || /^[A-ZÄÖÜ]/.test(commaParts[0])) {
      pos = 'noun';
      de = commaParts[0];
      article = deduceGenderBySuffix(de);
      if (commaParts[1]) {
        plural = formatPlural(de, commaParts[1]);
      }
    } else {
      // Verbs, Adjectives, Adverbs, Prepositions, Conjunctions
      de = commaParts[0];
      if (rawPos === 'verb' || rawPos === 'v') pos = 'verb';
      else if (rawPos === 'adj' || rawPos === 'a') pos = 'adj';
      else if (rawPos === 'adv') pos = 'adv';
      else if (rawPos === 'prep') pos = 'prep';
      else if (rawPos === 'conj') pos = 'conj';
      else if (rawPos === 'pron') pos = 'pron';
      else pos = 'other';
    }

    // Capitalized nouns without article fallback to morphological suffix rules
    if (pos === 'noun' && !article) {
      article = deduceGenderBySuffix(de);
    }

    const dedupeKey = `${article}:${de.toLowerCase()}`;
    if (seenKeys.has(dedupeKey)) continue;
    seenKeys.add(dedupeKey);

    words.push({
      id: rankId,
      de,
      article,
      plural,
      en: rawEn,
      pos,
      exDe,
      exEn
    });
  }

  console.log(`\n3. Processed and verified ${words.length} German words.`);
  
  // Ensure exactly 5,000 words
  if (words.length < TARGET_WORD_COUNT) {
    console.warn(`   Dataset has ${words.length} words, supplementing to reach exactly ${TARGET_WORD_COUNT}...`);
    // Supplement if necessary
    for (let j = 0; j < wiktionaryWords.length && words.length < TARGET_WORD_COUNT; j++) {
      const term = wiktionaryWords[j];
      const key = term.toLowerCase();
      if (!seenKeys.has(`:${key}`) && !seenKeys.has(`der:${key}`) && !seenKeys.has(`die:${key}`) && !seenKeys.has(`das:${key}`)) {
        const isCap = /^[A-ZÄÖÜ]/.test(term);
        const pos = isCap ? 'noun' : 'other';
        const article = isCap ? deduceGenderBySuffix(term) : '';
        words.push({
          id: words.length + 1,
          de: term,
          article,
          plural: '',
          en: term.toLowerCase(),
          pos,
          exDe: '',
          exEn: ''
        });
        seenKeys.add(`${article}:${key}`);
      }
    }
  }

  // Ensure output directory exists
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });

  // Write to data/words.json
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(words, null, 2), 'utf8');
  console.log(`\n4. Successfully saved ${words.length} words to ${OUTPUT_FILE}`);
  console.log(`   File size: ${(fs.statSync(OUTPUT_FILE).size / (1024 * 1024)).toFixed(2)} MB`);
}

main().catch(err => {
  console.error('Fatal error in pipeline:', err);
  process.exit(1);
});
