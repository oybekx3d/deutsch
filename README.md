# 🇩🇪 German5K

**A fast, offline-first Spaced Repetition (SRS) web application for mastering the 5,000 most common German words with English translations.**

![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-10B981?style=flat-square)
![Vanilla JS](https://img.shields.io/badge/stack-HTML5%20%7C%20CSS3%20%7C%20ES6%2B-3B82F6?style=flat-square)
![PWA Ready](https://img.shields.io/badge/PWA-Offline%20Ready-F59E0B?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-94A3B8?style=flat-square)

---

## 📖 Overview & Purpose

Learning the **top 5,000 most frequent German words** covers roughly **90% to 95% of everyday spoken and written German**, spanning CEFR levels **A1 through B2/C1**.

Most language apps either lock frequency lists behind subscriptions, bloat the interface with slow animations, or ignore German grammatical gender (`der`, `die`, `das`) and noun plurals. **German5K** was built to solve this as a lightweight, zero-backend static web application hosted on **GitHub Pages**:

- **Learn in strict frequency order:** Unlock new words daily starting from rank `#1` up to `#5000`.
- **Internalize noun genders visually:** Every card and dictionary entry is dynamically color-coded by grammatical gender (**Blue** for masculine *der*, **Rose** for feminine *die*, **Emerald** for neuter *das*).
- **100% private & serverless:** All study progress, review intervals, and daily streaks live in a compact `localStorage` state (under `100 KB` for all 5,000 words) with one-click JSON backup and restore to move progress between your phone and PC.

---

## ✨ Key Features

- **🧠 Modified SM-2 / 5-Box Leitner SRS Engine:**
  - Four grading buttons (**Again**, **Hard**, **Good**, **Easy**) schedule reviews right before you forget.
  - Failed cards are automatically re-queued in the active session until mastered.
  - Configurable daily new-word limit (default: `20 words/day`) and study direction (`DE → EN`, `EN → DE`, or `Mixed`).
- **🎨 German Grammatical Gender Color System:**
  - **Masculine (`der`):** Blue (`#3B82F6`)
  - **Feminine (`die`):** Rose (`#F43F5E`)
  - **Neuter (`das`):** Emerald (`#10B981`)
  - **Verbs / Adjectives / Other POS:** Violet (`#8B5CF6`)
- **🔥 Daily Streaks & 14-Day Activity Tracker:**
  - Tracks consecutive study days based on your local calendar timezone.
  - Visual 14-day activity bar chart and daily goal progress ring on the dashboard.
- **🔊 Native Offline German Audio (`de-DE`):**
  - Uses the browser's built-in Web Speech API (`window.speechSynthesis`) for instant German pronunciation of words and example sentences—no external MP3 files required.
- **⚡ High-Performance 5,000-Word Browser:**
  - Instant `150ms` debounced search across German words, English definitions, and example sentences.
  - Filter by SRS Status (`All`, `Due`, `Learning`, `Mastered`, `Unseen`), Grammatical Gender (`der`, `die`, `das`, `Non-Nouns`), and Frequency Band (`1–500`, `501–1000`, etc.).
  - Uses chunked rendering (`50 items` per batch via `IntersectionObserver`) to maintain 60fps scrolling on mobile and desktop.
- **📱 Installable Offline PWA:**
  - Includes a `manifest.json` and Service Worker (`sw.js`) that cache the app shell and all 5,000 words (`./data/words.json`) for 100% offline use on Android, iOS, and desktop.
- **💾 One-Click JSON Backup & Restore:**
  - Export your entire study history to a timestamped `german5k-backup-YYYY-MM-DD.json` file and import it on any other device.

---

## 🛠️ Tech Stack

| Layer | Technology Used | Purpose |
| :--- | :--- | :--- |
| **Core Frontend** | Semantic HTML5, Modern CSS3, ES6+ Vanilla JS | Zero-dependency, zero-build-step architecture |
| **Styling & Motion** | CSS Custom Properties, CSS Grid/Flexbox, 3D Transforms | Adaptive Dark/Light UI & hardware-accelerated 3D card flips |
| **Spaced Repetition** | Custom Modified SM-2 / 5-Box Leitner Scheduler (`js/srs.js`) | Interval calculation, daily queue generation, cram mode |
| **State & Persistence** | Browser `localStorage` (`german5k_state_v1`) | Compact tuple storage `[box, nextReviewDayEpoch, reps, lapses]` |
| **Pronunciation** | Web Speech API (`window.speechSynthesis` `de-DE`) | Native offline German text-to-speech |
| **Offline Support** | Service Worker API (`sw.js`) & Web App Manifest | Full offline caching & mobile "Add to Home Screen" |
| **Data Pipeline** | Node.js (Native `fetch`, SQLite / TSV parsers) | Automated extraction & enrichment of `./data/words.json` |
| **Hosting** | GitHub Pages | Free static hosting directly from the repository branch |

---

## 📚 Vocabulary Data Sources & Attribution

The 5,000-word dataset (`./data/words.json`) is compiled and cross-referenced from open linguistic corpora and frequency dictionaries:

1. **Wiktionary — Matthias Buchmeier's German Frequency List (1–5000):**
   - Sourced via the official [Wiktionary MediaWiki API](https://en.wiktionary.org/wiki/User:Matthias_Buchmeier/German_frequency_list-1-5000), derived from spoken and written subtitle corpora, paired with Wiktionary morphological templates for grammatical gender (`der`/`die`/`das`) and plural suffixes.
2. **Routledge / Leipzig Corpus Frequency Lists (Anki Shared Decks):**
   - Compatible with digitized editions of Tschirner & Möhring's *A Frequency Dictionary of German* via community Anki decks:
     - [English-German Sorted by Frequency (#1431033948)](https://ankiweb.net/shared/info/1431033948)
     - [German 5000 Frequency Words + Conjugations + Goethe V2 (#38922074)](https://ankiweb.net/shared/info/38922074)
     - [5000 German Words Sorted by Frequency (#107258650)](https://ankiweb.net/shared/info/107258650)
3. **FrequencyWords (`de_50k`):**
   - Cross-checked against [HermitDave's OpenSubtitles FrequencyWords repository](https://github.com/hermitdave/FrequencyWords).

### `data/words.json` Schema
Each word entry in `./data/words.json` follows this structure:
```json
{
  "id": 1,
  "de": "Haus",
  "article": "das",
  "plural": "Häuser",
  "en": "house, building",
  "pos": "noun",
  "exDe": "Wir haben ein altes Haus gekauft.",
  "exEn": "We bought an old house."
}
```

---

## 📂 Project Structure

```text
german5k/
├── index.html              # Single-page app shell & semantic views
├── manifest.json           # PWA Web App Manifest for mobile installation
├── sw.js                   # Offline-first Service Worker cache
├── css/
│   └── styles.css          # Design tokens, Dark/Light themes, 3D card animations
├── js/
│   ├── app.js              # UI controller, router, keyboard shortcuts, virtualized list
│   ├── srs.js              # SM-2 / 5-box Leitner scheduler & queue builder
│   ├── storage.js          # localStorage state, streak engine, JSON import/export
│   └── audio.js            # Web Speech API (de-DE) wrapper
├── convert-words.js        # Offline TSV/CSV/Anki-to-JSON converter utility
├── data/
│   └── words.json          # Top 5,000 German words sorted by frequency (1–5000)
└── scripts/
    └── build-words.js      # Automated Node.js Wiktionary/corpus dataset builder
```

---

## 🚀 Getting Started & Deployment

### 1. Run Locally
Because **German5K** uses `fetch('./data/words.json')` and a Service Worker, serve the folder over a local static HTTP server:

```bash
# Option A: Using Node.js (npx)
npx serve .

# Option B: Using Python 3
python3 -m http.server 8080
```
Then open `http://localhost:8080` in your browser.

### 2. Build or Update `data/words.json`
To automatically fetch and build the 5,000-word dataset from Wiktionary/FrequencyWords, or to convert an exported TSV/CSV/Anki file:

```bash
# Automatically fetch and build all 5,000 words
node ./scripts/build-words.js

# Or convert a local TSV/CSV frequency list
node convert-words.js raw_words.tsv
```

### 3. Deploy to GitHub Pages
1. Push this repository to GitHub.
2. Go to **Settings → Pages** in your GitHub repository.
3. Under **Build and deployment**, set **Source** to **Deploy from a branch** and select `main` / `/ (root)`.
4. Click **Save**—your app will be live at `https://<your-username>.github.io/german5k/` and installable on mobile via **Add to Home Screen**.

---

## ⌨️ Keyboard Shortcuts (Desktop)

| Key | Action |
| :--- | :--- |
| `Space` / `Enter` | Flip current flashcard |
| `1` | Grade **Again** (Reset to Box 1 & re-queue in session) |
| `2` | Grade **Hard** (Box 2 / 1 day) |
| `3` | Grade **Good** (Advance +1 box) |
| `4` | Grade **Easy** (Advance +2 boxes) |
| `R` | Replay German audio pronunciation |
| `Esc` | Exit active study session back to Dashboard |

---

## 📄 License

Released under the [MIT License](LICENSE). Free for personal and educational use.