# German5K — Product Requirements Document (PRD) & Technical Specification

**Version:** 1.0.0  
**Target Platform:** GitHub Pages (Static Web App + Offline PWA)  
**Tech Stack:** Semantic HTML5, Modern CSS3 (Custom Properties, Grid, Flexbox), Vanilla ES6+ JavaScript Modules, `localStorage`, Web Speech API (`de-DE`), Service Worker  
**Dependencies:** Zero external runtime libraries or build steps required  

---

## 1. Product Overview & Objectives

**German5K** is a fast, offline-capable static web application designed to help English speakers master the 5,000 most frequent German words. It operates entirely in the browser using a static `data/words.json` dataset and persists all learning progress, spaced repetition schedules, and daily streaks inside `localStorage` with one-click JSON export and import for cross-device syncing.

### Core Engineering Goals
1. **Zero-Cost, Zero-Build Hosting:** Runs directly from any GitHub Pages repository (`https://username.github.io/repo-name/`) using strictly relative asset paths (`./`).
2. **Instant 60fps Performance with 5,000 Items:** Loads `words.json` once into an in-memory `Map` and uses chunked DOM rendering (`50` items per batch) and debounced search (`150ms`) so the UI never lags.
3. **Sub-100KB Storage Footprint:** Compresses user progress in `localStorage` into compact numeric arrays keyed by word ID, keeping all 5,000 progress records well under `100 KB`.
4. **German-Specific Visual Pedagogy:** Automatically color-codes nouns by grammatical gender (`der` = Blue, `die` = Rose, `das` = Emerald) across flashcards, badges, and dictionary rows.

---

## 2. Project File Architecture

All asset references across HTML, CSS, JS, and Service Worker files **must** use relative paths (`./`) to ensure compatibility with GitHub Pages project subdirectories.

```text
/
├── index.html          # Single-page app shell, semantic views, SVG icons, navigation
├── manifest.json       # PWA Web App Manifest for mobile "Add to Home Screen"
├── sw.js               # Service Worker caching app shell + ./data/words.json for offline use
├── convert-words.js    # Node.js CLI utility (offline dev script) to build data/words.json
├── css/
│   └── styles.css      # Design tokens, Light/Dark themes, 3D card flip, responsive layout
├── js/
│   ├── app.js          # Main UI controller, view router, keyboard shortcuts, browser list
│   ├── srs.js          # Modified SM-2 / 5-box Leitner scheduler & daily queue builder
│   ├── storage.js      # localStorage state manager, streak tracker, JSON import/export
│   └── audio.js        # Web Speech API (de-DE) pronunciation controller
└── data/
    └── words.json      # 5,000 German-English frequency dataset
```

---

## 3. Dataset Schema (`data/words.json`)

On startup, the application fetches `./data/words.json` and indexes the array into an in-memory `Map<number, WordItem>` keyed by `id`.

### 3.1 JSON Schema Specification

```json
[
  {
    "id": 1,
    "de": "Haus",
    "article": "das",
    "plural": "Häuser",
    "en": "house, building",
    "pos": "noun",
    "exDe": "Wir haben ein altes Haus gekauft.",
    "exEn": "We bought an old house."
  },
  {
    "id": 2,
    "de": "machen",
    "article": "",
    "plural": "",
    "en": "to make, to do",
    "pos": "verb",
    "exDe": "Was machst du heute Abend?",
    "exEn": "What are you doing tonight?"
  }
]
```

### 3.2 Field Rules
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `id` | `number` | Yes | Frequency rank (`1` = most common word, up to `5000`). Used as primary key in `localStorage`. |
| `de` | `string` | Yes | Base German headword (without leading article for nouns). |
| `article` | `string` | Yes | `"der"`, `"die"`, `"das"` for nouns, or `""` (empty string) for non-nouns or plural-only entries. |
| `plural` | `string` | No | Plural form or suffix (e.g., `"Häuser"`, `"-en"`, `""`). |
| `en` | `string` | Yes | Concise English translation(s). |
| `pos` | `string` | Yes | Part of speech (`"noun"`, `"verb"`, `"adj"`, `"adv"`, `"prep"`, `"conj"`, `"pron"`, `"other"`). |
| `exDe` | `string` | No | Example sentence in German. |
| `exEn` | `string` | No | English translation of the example sentence. |

---

## 4. Design System, Color Palette & UI Tokens

### 4.1 Color Tokens (`css/styles.css`)
The UI defaults to **Dark Mode** (`[data-theme="dark"]`) to reduce eye strain during study sessions and includes a one-click toggle to **Light Mode** (`[data-theme="light"]`).

```css
:root,
[data-theme="dark"] {
  /* Surfaces & Backgrounds */
  --bg-primary: #0B0F19;
  --bg-surface: #111827;
  --bg-elevated: #1E293B;
  --bg-glass: rgba(17, 24, 39, 0.85);
  --border-subtle: #1E293B;
  --border-focus: #334155;

  /* Typography */
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --text-muted: #64748B;

  /* Brand & Status Accents */
  --accent-primary: #10B981;       /* Emerald — Primary CTA & Mastery */
  --accent-primary-hover: #059669;
  --accent-primary-soft: rgba(16, 185, 129, 0.14);
  --streak-amber: #FBBF24;         /* Day Streak Flame & Goal Ring */
  --streak-amber-soft: rgba(251, 191, 36, 0.15);

  /* SRS Grading Button Colors */
  --srs-again: #EF4444;            /* Box 1 / Reset */
  --srs-hard: #F59E0B;             /* Box 2 / 1d */
  --srs-good: #3B82F6;             /* Box +1 */
  --srs-easy: #10B981;             /* Box +2 */

  /* German Grammatical Gender Colors (CRITICAL) */
  --gender-der: #60A5FA;           /* Masculine (der) — Blue */
  --gender-der-bg: rgba(96, 165, 250, 0.14);
  --gender-der-border: rgba(96, 165, 250, 0.4);

  --gender-die: #FB7185;           /* Feminine (die) — Rose */
  --gender-die-bg: rgba(251, 113, 133, 0.14);
  --gender-die-border: rgba(251, 113, 133, 0.4);

  --gender-das: #34D399;           /* Neuter (das) — Emerald */
  --gender-das-bg: rgba(52, 211, 153, 0.14);
  --gender-das-border: rgba(52, 211, 153, 0.4);

  --gender-other: #A78BFA;         /* Verbs / Adjectives / Other — Violet */
  --gender-other-bg: rgba(167, 139, 250, 0.14);
  --gender-other-border: rgba(167, 139, 250, 0.4);

  /* Elevation & Radii */
  --shadow-card: 0 20px 25px -5px rgba(0, 0, 0, 0.45), 0 8px 10px -6px rgba(0, 0, 0, 0.35);
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 20px;
  --radius-pill: 9999px;
}

[data-theme="light"] {
  --bg-primary: #F8FAFC;
  --bg-surface: #FFFFFF;
  --bg-elevated: #F1F5F9;
  --bg-glass: rgba(255, 255, 255, 0.88);
  --border-subtle: #E2E8F0;
  --border-focus: #CBD5E1;

  --text-primary: #0F172A;
  --text-secondary: #475569;
  --text-muted: #94A3B8;

  --accent-primary: #059669;
  --accent-primary-hover: #047857;
  --accent-primary-soft: rgba(5, 150, 105, 0.12);
  --streak-amber: #D97706;
  --streak-amber-soft: rgba(217, 119, 6, 0.12);

  --gender-der: #2563EB;
  --gender-der-bg: rgba(37, 99, 235, 0.1);
  --gender-der-border: rgba(37, 99, 235, 0.35);

  --gender-die: #E11D48;
  --gender-die-bg: rgba(225, 29, 72, 0.1);
  --gender-die-border: rgba(225, 29, 72, 0.35);

  --gender-das: #059669;
  --gender-das-bg: rgba(5, 150, 105, 0.1);
  --gender-das-border: rgba(5, 150, 105, 0.35);

  --gender-other: #7C3AED;
  --gender-other-bg: rgba(124, 58, 237, 0.1);
  --gender-other-border: rgba(124, 58, 237, 0.35);

  --shadow-card: 0 12px 24px -4px rgba(15, 23, 42, 0.08), 0 4px 8px -2px rgba(15, 23, 42, 0.04);
}
```

### 4.2 Typography & Layout Tokens
* **Font Stack:** `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif` (zero external font network blocking).
* **Flashcard Headword Size:** `clamp(2rem, 5vw, 3rem)`, font-weight `700`, letter-spacing `-0.02em`.
* **Responsive Breakpoints:**
  * **Mobile (`< 768px`):** Fixed bottom navigation bar (`64px` height, `backdrop-filter: blur(12px)`), full-width flashcard container, thumb-friendly 2×2 or 4-column SRS grading grid at the bottom of the viewport.
  * **Desktop (`>= 768px`):** Sticky top navigation bar (`max-width: 1040px` centered container), keyboard shortcut hint badges (`[Space]`, `[1]`, `[2]`, `[3]`, `[4]`, `[R]`) visible on controls.
* **Touch Targets:** Minimum `48px × 48px` on all interactive buttons.

---

## 5. Animation & Micro-Interaction Specifications

1. **3D Flashcard Flip:**
   * Parent `.flashcard-scene` uses `perspective: 1200px`.
   * `.flashcard-inner` uses `transform-style: preserve-3d` and `transition: transform 0.45s cubic-bezier(0.22, 1, 0.36, 1)`.
   * Toggling `.is-flipped` applies `transform: rotateY(180deg)`. Front and back faces use `backface-visibility: hidden`.
2. **Card Transition (Next Word):**
   * Exiting card fades and slides slightly left (`transform: translateX(-16px) scale(0.98); opacity: 0; duration: 160ms`).
   * Entering card slides in (`transform: translateX(0) scale(1); opacity: 1; duration: 220ms cubic-bezier(0.22, 1, 0.36, 1)`).
3. **Gender Glow Accent:**
   * When a German noun is revealed (or on the front face in `DE -> EN` mode), the top `4px` accent border and subtle radial aura of the card transition smoothly to `--gender-der`, `--gender-die`, or `--gender-das`.
4. **Streak Flame Pulse:**
   * When today's streak goal is completed, the SVG flame icon scales with a spring keyframe animation and glows in `--streak-amber`.
5. **Accessibility (`prefers-reduced-motion`):**
   * When `@media (prefers-reduced-motion: reduce)` is active, replace 3D rotation with an instant `120ms` opacity crossfade.

---

## 6. Core Views & Functional Specifications

### 6.1 View 1: Dashboard (`#dashboard`)
* **Hero Streak & Daily Goal Card:**
  * Displays **Current Day Streak** (with flame SVG), **Longest Streak**, and **Today's Progress Ring** (`cardsStudiedToday / dailyStreakGoal`).
  * Status banner shows either *"Keep going! X more reviews to lock in today's streak"* or *"Daily goal complete! Streak extended"*.
* **14-Day Activity Strip:**
  * Horizontal row of 14 vertical bar/pill indicators representing the last 14 calendar days (`YYYY-MM-DD`), with tooltip showing date and cards reviewed.
* **5,000-Word Mastery Progress Bar & Stat Grid:**
  * Multi-segment horizontal progress bar showing proportion of `Mastered (Box 5)`, `Learning (Boxes 1–4)`, and `Unseen`.
  * 4 stat cards:
    1. **Due Now:** Count of learned words where `nextReviewDay <= todayDayEpoch`.
    2. **New Today:** Remaining daily new-word allowance (`max(0, dailyNewLimit - newWordsIntroducedToday)`).
    3. **Learning:** Count of words in Boxes `1–4`.
    4. **Mastered:** Count of words in Box `5` (`id` count + percentage of 5,000).
* **Action CTAs:**
  * Primary button: **"Start Today's Session (Due: X • New: Y)"**.
  * Secondary button: **"Quick Practice (15 Random Learned Words)"** (available anytime, especially when `Due + New == 0`).

### 6.2 View 2: Study Session (`#study`)
* **Session Header:**
  * Linear progress bar (`completedInSession / totalSessionQueue`), live session accuracy badge (`%` of cards graded `Good` or `Easy`), and `Exit to Dashboard` button.
* **Flashcard Front Face:**
  * Top row: Frequency Rank pill (`#42` of 5000) and Part of Speech badge (`noun`, `verb`, etc.).
  * Center content (when direction is `DE -> EN`):
    * Gender article badge (`der` / `die` / `das`) + German headword (`de`).
    * Audio pronunciation button (speaker icon) + keyboard hint `[R]`.
  * Center content (when direction is `EN -> DE`):
    * English translation (`en`) + POS hint, prompting active recall of the German word and its gender article.
  * Footer prompt: *"Tap card or press [Space] to reveal answer"*.
* **Flashcard Back Face:**
  * Full color-coded German noun with article + plural form (`das Haus • pl. Häuser`).
  * English translation (`en`).
  * Bilingual example block (`exDe` with clickable speaker icon to hear the full German sentence, plus `exEn` below it).
* **SRS Grading Bar (Revealed only when card is flipped):**
  * 4 buttons displaying the action label, keyboard shortcut, and next interval preview:
    * `[1] Again` (`< 10m` — re-inserts card 4 positions back in the active session queue and sets Box to `1`)
    * `[2] Hard` (`1d` — sets Box to `2`)
    * `[3] Good` (`3d / 7d / 14d / 30d` — increments Box by `+1`, max `5`)
    * `[4] Easy` (`7d / 21d / 45d` — increments Box by `+2`, max `5`)
* **Session Complete Summary Modal/Screen:**
  * Displays total cards reviewed, accuracy percentage, new words learned, streak celebration if today's goal was crossed during the session, and a button to return to the Dashboard or review 10 bonus words.

### 6.3 View 3: 5,000-Word Browser (`#browser`)
* **Search & Filter Controls:**
  * Search input with `150ms` debounce matching `de` (case-insensitive, umlaut-friendly: `ae->ä`, `oe->ö`, `ue->ü`, `ss->ß`) and `en`.
  * Filter dropdowns / pills:
    * **SRS Status:** `All`, `Due Now`, `Learning (Box 1-4)`, `Mastered (Box 5)`, `Unseen`.
    * **Gender / POS:** `All`, `der (Masc)`, `die (Fem)`, `das (Neut)`, `Verbs & Other`.
    * **Frequency Band:** `All (1-5000)`, `1–500`, `501–1000`, `1001–2000`, `2001–3500`, `3501–5000`.
* **Virtualized / Chunked List Rendering:**
  * Renders `50` word rows initially.
  * Uses an `IntersectionObserver` sentinel at the bottom of the list (plus a fallback `"Load Next 50"` button) to append the next `50` matching items smoothly.
  * Each row displays: Frequency Rank `#id`, Gender-colored article + `de` + `plural`, `en` translation, example preview, current SRS Box badge (`New` or `Box 1–5`), and an audio play button.

### 6.4 View 4: Settings & Backup (`#settings`)
* **Study Preferences:**
  * **Daily New Words Limit:** Numeric stepper / slider (`5` to `100`, default `20`).
  * **Daily Streak Goal (Cards/Day):** Numeric stepper / slider (`5` to `100`, default `15`).
  * **Study Direction:** Segmented control (`DE → EN`, `EN → DE`, `Mixed`).
  * **Auto-Play German Audio on Flip:** Toggle switch (`On` / `Off`, default `On`).
  * **Theme:** Toggle switch (`Dark` / `Light`).
* **Data Management (`localStorage` Backup & Restore):**
  * **Export Progress (`.json`):** Triggers an instant browser file download named `german5k-backup-YYYY-MM-DD.json`.
  * **Import Progress (`.json`):** File picker accepting `.json`, validating schema integrity (`version`, `progress`, `streak`, `settings`), saving to `localStorage`, and refreshing state with a success toast.
  * **Reset All Progress:** Protected by a confirmation modal requiring the user to confirm deletion.

---

## 7. Spaced Repetition System (SRS) & Queue Specification

### 7.1 Compact Per-Word State Tuple
Each learned word is stored in `state.progress[wordId]` as a 4-element numeric array to keep `localStorage` small:

```text
[box, nextReviewDayEpoch, reps, lapses]
```
* `box` (`1` to `5`): Current Leitner / mastery box (`5` = Mastered).
* `nextReviewDayEpoch` (`integer`): `Math.floor(Date.now() / 86400000) + intervalDays`.
* `reps` (`integer`): Total successful reviews.
* `lapses` (`integer`): Total times graded `Again (1)`.

### 7.2 Interval Calculation Matrix (`js/srs.js`)
Let `today = Math.floor(Date.now() / 86400000)` and `currentBox` be `0` for unseen words or `1..5` for seen words:

| Grade Button | New Box | Scheduled Interval (`intervalDays`) | Session Queue Behavior |
| :--- | :--- | :--- | :--- |
| **1 — Again** | `1` | `0` (due again today) | Re-append card to current session queue (+4 cards ahead) until graded `>= 2`. Increment `lapses`. |
| **2 — Hard** | `max(1, currentBox)` (or `1` if unseen) | `1` day | Removes card from current session queue. Increment `reps`. |
| **3 — Good** | `min(5, currentBox + 1)` | Box 1→`1d`, Box 2→`3d`, Box 3→`7d`, Box 4→`14d`, Box 5→`30d` | Removes card from current session queue. Increment `reps`. |
| **4 — Easy** | `min(5, currentBox + 2)` | Box 1/2→`4d`, Box 3→`10d`, Box 4→`21d`, Box 5→`45d` | Removes card from current session queue. Increment `reps`. |

### 7.3 Daily Session Queue Construction
1. **Due Reviews First:** Collect all words in `state.progress` where `nextReviewDayEpoch <= today`, sorted by lowest `box` first, then by lowest `id` (highest frequency).
2. **Daily New Words Second:** Calculate `remainingNewQuota = max(0, settings.dailyNewLimit - dailyStats.newIntroducedToday)`. Iterate `words.json` in ascending frequency order (`id = 1` to `5000`) and pick the first `remainingNewQuota` words not yet present in `state.progress`.
3. **Interleaving:** Interleave 1 new word after every 3 due reviews (or append at the end if fewer than 3 due reviews exist) so new vocabulary is introduced gradually.

---

## 8. `localStorage` & Streak Engine Specification (`js/storage.js`)

### 8.1 Storage Key & Complete JSON Structure
All application state is stored under a single `localStorage` key: **`german5k_state_v1`** (with automatic migration from legacy storage keys).

```json
{
  "version": 1,
  "settings": {
    "dailyNewLimit": 20,
    "dailyStreakGoal": 15,
    "direction": "de-en",
    "autoAudio": true,
    "theme": "dark"
  },
  "streak": {
    "current": 5,
    "longest": 12,
    "lastGoalMetDate": "2026-11-15",
    "todayDate": "2026-11-15",
    "todayStudiedCount": 18,
    "todayNewCount": 10,
    "history": {
      "2026-11-13": 22,
      "2026-11-14": 16,
      "2026-11-15": 18
    }
  },
  "progress": {
    "1": [5, 20810, 6, 0],
    "2": [3, 20780, 3, 1]
  }
}
```

### 8.2 Local Date & Day Streak Rollover Logic
1. **Local Date Helper:** Always compute calendar dates in the user's local timezone as `"YYYY-MM-DD"`:
   ```javascript
   function getLocalDateString(date = new Date()) {
     const y = date.getFullYear();
     const m = String(date.getMonth() + 1).padStart(2, '0');
     const d = String(date.getDate()).padStart(2, '0');
     return `${y}-${m}-${d}`;
   }
   ```
2. **Startup Rollover Check (`initStorage()`):**
   * Compare `state.streak.todayDate` with `getLocalDateString()`.
   * If they differ, reset `todayStudiedCount = 0` and `todayNewCount = 0`, and set `todayDate = getLocalDateString()`.
   * Check `lastGoalMetDate`: if `lastGoalMetDate` is neither `today` nor `yesterday` (in local calendar days), reset `state.streak.current = 0`.
3. **Incrementing the Streak (`recordCardReview(isNewWord)`):**
   * Increment `todayStudiedCount += 1` (and `todayNewCount += 1` if `isNewWord`).
   * Increment `state.streak.history[today] = (state.streak.history[today] || 0) + 1`.
   * Prune `state.streak.history` keys older than 30 days to keep `localStorage` lean.
   * **Goal Trigger:** When `todayStudiedCount >= settings.dailyStreakGoal` (or when all due + daily new words for today are completed and `todayStudiedCount > 0`) AND `lastGoalMetDate !== today`:
     * Increment `state.streak.current += 1`.
     * Set `state.streak.longest = Math.max(state.streak.longest, state.streak.current)`.
     * Set `state.streak.lastGoalMetDate = today`.
     * Dispatch a custom DOM event `german5k:streak-achieved` to trigger the UI celebration toast and flame animation.

---

## 9. Web Speech API (`de-DE`) Audio Specification (`js/audio.js`)

* Uses native browser `window.speechSynthesis` so zero MP3 assets are needed for 5,000 words.
* **Voice Selection Priority:**
  1. Filter `speechSynthesis.getVoices()` where `voice.lang.toLowerCase().startsWith('de')`.
  2. Prefer high-quality voices matching `/Google Deutsch|Anna|Helena|Martin|Petra|Natural/i`, falling back to the first `de-DE` voice.
* **Spoken String Construction:**
  * For nouns with an article (`article !== ""`), pronounce `"${article} ${de}"` (e.g., `"das Haus"`) so the learner hears the article + noun together.
  * Set `utterance.lang = 'de-DE'` and `utterance.rate = 0.95`.
  * Call `speechSynthesis.cancel()` before speaking a new utterance to prevent overlapping audio queues when flipping cards rapidly.

---

## 10. Data Conversion Pipeline (`convert-words.js`)

Save the script below in your project root as `convert-words.js`. It converts any raw TSV, CSV, or JSON German-English frequency list (such as an Anki plain-text export or GitHub CSV) into `./data/words.json`.

```javascript
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
```

---

## 11. Master Prompt for `agy CLI`

To build the entire application in one command, save this file as `PRD.md` in your workspace and pass the prompt below to `agy CLI`:

```text
Read PRD.md in the project root and implement the complete "German5K" static web application following every architectural, UI token, color system, animation, SRS, streak, and localStorage specification in PRD.md.

Generate all required files:
1. index.html
2. css/styles.css
3. js/storage.js
4. js/srs.js
5. js/audio.js
6. js/app.js
7. manifest.json
8. sw.js
9. convert-words.js
10. data/words.json (seed with 40 authentic, high-frequency German words across ranks 1–40 including nouns with der/die/das + plurals, verbs, and adjectives with realistic bilingual example sentences so the app works immediately out of the box).

Ensure zero external runtime dependencies, strict relative asset paths (./) for GitHub Pages compatibility, smooth 3D card flip animations, full keyboard shortcut support (Space/Enter, 1-4, R), chunked 50-item rendering in the 5,000-word browser, and working JSON progress export/import.
```