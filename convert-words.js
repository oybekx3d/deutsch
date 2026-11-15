// Usage: node convert-words.js raw_words.tsv
const fs = require('fs');
const path = require('path');

const inputFile = process.argv[2] || 'raw_words.tsv';
const outputFile = path.join(__dirname, 'data', 'words.json');

if (!fs.existsSync(inputFile)) {
  console.error(`Error: Input file "${inputFile}" not found.`);
  process.exit(1);
}

function cleanText(str = '') {
  return String(str)
    .replace(/\[sound:[^\]]+\]/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseGermanTerm(rawDe, explicitArticle = '', explicitPlural = '') {
  let text = cleanText(rawDe);
  let article = cleanText(explicitArticle).toLowerCase();
  let plural = cleanText(explicitPlural);

  // Extract plural if formatted like "der Tisch, -e"
  const commaMatch = text.match(/^(.+?),\s*(-?[a-zA-ZäöüÄÖÜß¨]+)$/);
  if (commaMatch && !plural) {
    text = commaMatch[1].trim();
    plural = commaMatch[2].trim();
  }

  // Extract leading "der ", "die ", "das "
  const prefixMatch = text.match(/^(der|die|das)\s+(.+)$/i);
  if (prefixMatch && !article) {
    article = prefixMatch[1].toLowerCase();
    text = prefixMatch[2].trim();
  }

  // Extract trailing "Tisch, der"
  const suffixMatch = text.match(/^(.+?),\s*(der|die|das)$/i);
  if (suffixMatch && !article) {
    text = suffixMatch[1].trim();
    article = suffixMatch[2].toLowerCase();
  }

  const validArticles = new Set(['der', 'die', 'das']);
  if (!validArticles.has(article)) article = '';

  const isCapitalized = /^[A-ZÄÖÜ]/.test(text);
  const pos = article || isCapitalized ? 'noun' : 'other';

  return { de: text, article, plural, pos };
}

function convert() {
  const rawContent = fs.readFileSync(inputFile, 'utf8');
  let records = [];

  if (inputFile.endsWith('.json')) {
    const parsed = JSON.parse(rawContent);
    records = Array.isArray(parsed) ? parsed : parsed.words || [];
  } else {
    const lines = rawContent
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.startsWith('#'));

    const delimiter = lines[0].includes('\t') ? '\t' : ',';

    records = lines.map((line) => {
      const cols = line.split(delimiter).map(cleanText);
      return {
        de: cols[0] || '',
        en: cols[1] || '',
        exDe: cols[2] || '',
        exEn: cols[3] || ''
      };
    });
  }

  const seen = new Set();
  const output = [];

  for (const item of records) {
    const rawDe = item.de || item.german || item.word || '';
    const rawEn = cleanText(item.en || item.english || item.translation || '');
    if (!rawDe || !rawEn) continue;

    if (/^(german|deutsch|word)$/i.test(rawDe) && /^(english|translation)$/i.test(rawEn)) {
      continue;
    }

    const { de, article, plural, pos } = parseGermanTerm(
      rawDe,
      item.article,
      item.plural
    );

    const dedupeKey = `${article}:${de.toLowerCase()}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    output.push({
      id: output.length + 1,
      de,
      article,
      plural,
      en: rawEn,
      pos: item.pos || pos,
      exDe: cleanText(item.exDe || item.sentenceDe || ''),
      exEn: cleanText(item.exEn || item.sentenceEn || '')
    });

    if (output.length >= 5000) break;
  }

  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, JSON.stringify(output, null, 2), 'utf8');
  console.log(`Successfully wrote ${output.length} words to ${outputFile}`);
}

convert();
