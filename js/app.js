/**
 * German5K — Main Application Controller & View Router
 */

import {
  initStorage,
  getState,
  saveState,
  updateSettings,
  recordCardReview,
  exportBackup,
  importBackup,
  resetAllProgress,
  getMasteryStats,
  get14DayActivity,
  getTodayDayEpoch
} from './storage.js';

import {
  buildDailyQueue,
  buildPracticeQueue,
  buildBonusQueue,
  calculateNextReview,
  getIntervalPreview
} from './srs.js';

import {
  speakWord,
  speakSentence,
  cancelAudio,
  isAudioSupported
} from './audio.js';

// --- State Variables ---
let wordsList = [];
let wordsMap = new Map();
let currentRoute = '#dashboard';

// Study Session State
let sessionMode = 'daily'; // 'daily' | 'practice' | 'bonus'
let sessionQueue = [];
let currentCardIndex = 0;
let isCardFlipped = false;
let sessionStats = {
  totalInitial: 0,
  reviewsDone: 0,
  goodOrEasyCount: 0,
  newLearnedCount: 0
};

// Browser View State
let filteredWords = [];
let browserRenderedCount = 0;
const BROWSER_CHUNK_SIZE = 50;
let browserSentinelObserver = null;
let searchDebounceTimer = null;

// --- DOM Element References ---
const elements = {};

function cacheDOMElements() {
  // Views
  elements.views = {
    dashboard: document.getElementById('view-dashboard'),
    study: document.getElementById('view-study'),
    browser: document.getElementById('view-browser'),
    settings: document.getElementById('view-settings')
  };

  // Nav links
  elements.navLinks = document.querySelectorAll('.nav-link, .bottom-nav-item');
  elements.themeToggle = document.getElementById('btn-theme-toggle');
  elements.headerStreakCount = document.getElementById('header-streak-count');
  elements.headerStreakPill = document.getElementById('header-streak-pill');

  // Dashboard elements
  elements.dashStreakCount = document.getElementById('dash-streak-count');
  elements.dashLongestStreak = document.getElementById('dash-longest-streak');
  elements.dashStreakFlame = document.getElementById('dash-streak-flame');
  elements.dashGoalText = document.getElementById('dash-goal-text');
  elements.dashGoalBarFill = document.getElementById('dash-goal-bar-fill');
  elements.dashStreakBanner = document.getElementById('dash-streak-banner');
  elements.dashActivityStrip = document.getElementById('dash-activity-strip');

  elements.dashMasteryBar = document.getElementById('dash-mastery-bar');
  elements.dashMasteredPct = document.getElementById('dash-mastered-pct');
  elements.dashLearningPct = document.getElementById('dash-learning-pct');
  elements.dashUnseenPct = document.getElementById('dash-unseen-pct');

  elements.statDueNow = document.getElementById('stat-due-now');
  elements.statNewToday = document.getElementById('stat-new-today');
  elements.statLearning = document.getElementById('stat-learning');
  elements.statMastered = document.getElementById('stat-mastered');

  elements.btnStartSession = document.getElementById('btn-start-session');
  elements.btnQuickPractice = document.getElementById('btn-quick-practice');

  // Study View elements
  elements.studySessionProgress = document.getElementById('study-session-progress');
  elements.studyProgressText = document.getElementById('study-progress-text');
  elements.studyAccuracyBadge = document.getElementById('study-accuracy-badge');
  elements.btnExitSession = document.getElementById('btn-exit-session');

  elements.flashcardScene = document.getElementById('flashcard-scene');
  elements.flashcardInner = document.getElementById('flashcard-inner');
  elements.cardFront = document.getElementById('card-front');
  elements.cardBack = document.getElementById('card-back');
  elements.gradingContainer = document.getElementById('grading-container');

  elements.gradeAgain = document.getElementById('grade-again');
  elements.gradeHard = document.getElementById('grade-hard');
  elements.gradeGood = document.getElementById('grade-good');
  elements.gradeEasy = document.getElementById('grade-easy');

  // Browser View elements
  elements.browserSearchInput = document.getElementById('browser-search-input');
  elements.btnClearSearch = document.getElementById('btn-clear-search');
  elements.filterSrs = document.getElementById('filter-srs');
  elements.filterGender = document.getElementById('filter-gender');
  elements.filterBand = document.getElementById('filter-band');
  elements.browserCountIndicator = document.getElementById('browser-count-indicator');
  elements.wordListContainer = document.getElementById('word-list-container');
  elements.browserSentinel = document.getElementById('browser-sentinel');
  elements.btnLoadMore = document.getElementById('btn-load-more');

  // Settings View elements
  elements.sliderDailyNew = document.getElementById('slider-daily-new');
  elements.valDailyNew = document.getElementById('val-daily-new');
  elements.sliderDailyGoal = document.getElementById('slider-daily-goal');
  elements.valDailyGoal = document.getElementById('val-daily-goal');
  elements.directionBtns = document.querySelectorAll('.direction-option');
  elements.toggleAutoAudio = document.getElementById('toggle-auto-audio');
  elements.toggleTheme = document.getElementById('toggle-theme');

  elements.btnExportBackup = document.getElementById('btn-export-backup');
  elements.inputImportBackup = document.getElementById('input-import-backup');
  elements.btnTriggerImport = document.getElementById('btn-trigger-import');
  elements.btnResetProgress = document.getElementById('btn-reset-progress');

  // Modals & Toast
  elements.modalComplete = document.getElementById('modal-session-complete');
  elements.modalCompleteCards = document.getElementById('summary-cards-reviewed');
  elements.modalCompleteAccuracy = document.getElementById('summary-accuracy');
  elements.modalCompleteNew = document.getElementById('summary-new-words');
  elements.btnFinishSession = document.getElementById('btn-finish-session');
  elements.btnBonusSession = document.getElementById('btn-bonus-session');

  elements.modalReset = document.getElementById('modal-reset-confirm');
  elements.btnConfirmReset = document.getElementById('btn-confirm-reset');
  elements.btnCancelReset = document.getElementById('btn-cancel-reset');

  elements.toastContainer = document.getElementById('toast-container');
}

// --- Toast Notifications ---
export function showToast(message, type = 'info', duration = 3000) {
  if (!elements.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  let iconSvg = '';
  if (type === 'streak') {
    iconSvg = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 23c-4.97 0-9-3.8-9-8.5 0-3.37 2.05-6.57 4.24-8.86a1 1 0 0 1 1.63.48c.36 1.76 1.25 3.33 2.5 4.46.22-1.78.96-3.88 2.25-5.63a1 1 0 0 1 1.76.38c.67 3.23 2.76 5.8 4.62 8.15C20.48 15.34 21 16.92 21 18.5c0 4.7-4.03 8.5-9 8.5z"/></svg>';
  } else if (type === 'success') {
    iconSvg = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>';
  } else if (type === 'error') {
    iconSvg = '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>';
  }

  toast.innerHTML = `${iconSvg}<span>${message}</span>`;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(12px) scale(0.95)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 200);
  }, duration);
}

// --- Theme Management ---
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const isDark = theme === 'dark';
  if (elements.toggleTheme) {
    elements.toggleTheme.checked = !isDark; // checked = light mode toggle
  }
}

function toggleTheme() {
  const state = getState();
  const currentTheme = state.settings.theme || 'dark';
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
  updateSettings({ theme: newTheme });
  applyTheme(newTheme);
  showToast(`Switched to ${newTheme === 'dark' ? 'Dark' : 'Light'} theme`, 'info', 2000);
}

// --- Router ---
function navigateTo(route) {
  if (!route.startsWith('#')) route = '#' + route;
  window.location.hash = route;
}

function handleRoute() {
  const hash = window.location.hash || '#dashboard';
  currentRoute = hash;

  // Update nav links active status
  elements.navLinks.forEach((link) => {
    const target = link.getAttribute('href');
    if (target === currentRoute) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Toggle view visibility
  for (const viewKey in elements.views) {
    const viewEl = elements.views[viewKey];
    if (viewEl) {
      if (`#${viewKey}` === currentRoute || `#view-${viewKey}` === currentRoute) {
        viewEl.classList.add('active');
      } else {
        viewEl.classList.remove('active');
      }
    }
  }

  // View specific setups
  if (currentRoute === '#dashboard') {
    renderDashboard();
  } else if (currentRoute === '#browser') {
    renderBrowserList(true);
  } else if (currentRoute === '#settings') {
    renderSettings();
  }
}

// --- Dashboard View Renderer ---
function renderDashboard() {
  const state = getState();
  const today = getTodayDayEpoch();
  const stats = getMasteryStats(wordsList.length);

  // Streak counters
  const currentStreak = state.streak.current || 0;
  const longestStreak = state.streak.longest || 0;
  if (elements.headerStreakCount) elements.headerStreakCount.textContent = currentStreak;
  if (elements.dashStreakCount) elements.dashStreakCount.textContent = currentStreak;
  if (elements.dashLongestStreak) elements.dashLongestStreak.textContent = `Longest: ${longestStreak} days`;

  const studiedToday = state.streak.todayStudiedCount || 0;
  const goal = state.settings.dailyStreakGoal || 15;
  const goalProgress = Math.min(100, Math.round((studiedToday / goal) * 100));

  if (elements.dashGoalText) {
    elements.dashGoalText.textContent = `${studiedToday} / ${goal} cards`;
  }
  if (elements.dashGoalBarFill) {
    elements.dashGoalBarFill.style.width = `${goalProgress}%`;
  }

  const goalMet = studiedToday >= goal;
  if (elements.headerStreakPill) {
    elements.headerStreakPill.classList.toggle('pulse', goalMet);
  }
  if (elements.dashStreakFlame) {
    elements.dashStreakFlame.classList.toggle('pulse', goalMet);
  }

  if (elements.dashStreakBanner) {
    if (goalMet) {
      elements.dashStreakBanner.className = 'streak-status-banner completed';
      elements.dashStreakBanner.innerHTML = '★ Daily goal complete! Streak extended for today.';
    } else {
      const remaining = goal - studiedToday;
      elements.dashStreakBanner.className = 'streak-status-banner';
      elements.dashStreakBanner.textContent = `Keep going! ${remaining} more reviews to lock in today's streak.`;
    }
  }

  // 14-Day Activity Strip
  const days = get14DayActivity();
  if (elements.dashActivityStrip) {
    elements.dashActivityStrip.innerHTML = '';
    const maxVal = Math.max(goal, ...days.map(d => d.count), 1);

    days.forEach((day) => {
      const col = document.createElement('div');
      col.className = 'activity-day-col';
      if (day.isToday) col.classList.add('is-today');
      if (day.count > 0) col.classList.add('has-activity');
      if (day.goalMet) col.classList.add('goal-met');

      const heightPercent = Math.max(10, Math.min(100, (day.count / maxVal) * 100));

      col.innerHTML = `
        <div class="activity-tooltip">${day.dateStr}: ${day.count} cards</div>
        <div class="activity-bar" style="height: ${heightPercent}%;"></div>
        <div class="activity-day-label">${day.dayLabel}</div>
      `;
      elements.dashActivityStrip.appendChild(col);
    });
  }

  // Mastery Bar Proportions
  const masteredPct = ((stats.masteredCount / stats.totalWordsCount) * 100).toFixed(1);
  const learningPct = ((stats.learningCount / stats.totalWordsCount) * 100).toFixed(1);
  const unseenPct = (100 - parseFloat(masteredPct) - parseFloat(learningPct)).toFixed(1);

  if (elements.dashMasteryBar) {
    elements.dashMasteryBar.innerHTML = `
      <div class="mastery-segment mastered" style="width: ${masteredPct}%;" title="Mastered: ${stats.masteredCount}"></div>
      <div class="mastery-segment learning" style="width: ${learningPct}%;" title="Learning: ${stats.learningCount}"></div>
      <div class="mastery-segment unseen" style="width: ${unseenPct}%;" title="Unseen: ${stats.unseenCount}"></div>
    `;
  }
  if (elements.dashMasteredPct) elements.dashMasteredPct.textContent = `${masteredPct}%`;
  if (elements.dashLearningPct) elements.dashLearningPct.textContent = `${learningPct}%`;
  if (elements.dashUnseenPct) elements.dashUnseenPct.textContent = `${unseenPct}%`;

  // 4 Stat Cards
  const remainingNew = Math.max(0, (state.settings.dailyNewLimit || 20) - (state.streak.todayNewCount || 0));
  if (elements.statDueNow) elements.statDueNow.textContent = stats.dueCount;
  if (elements.statNewToday) elements.statNewToday.textContent = remainingNew;
  if (elements.statLearning) elements.statLearning.textContent = stats.learningCount;
  if (elements.statMastered) elements.statMastered.textContent = stats.masteredCount;

  // Start CTA Button
  if (elements.btnStartSession) {
    elements.btnStartSession.innerHTML = `
      <svg viewBox="0 0 24 24" width="22" height="22"><path d="M8 5v14l11-7z"/></svg>
      <span>Start Today's Session (Due: ${stats.dueCount} • New: ${remainingNew})</span>
    `;
  }
}

// --- Study Session Engine ---
function startStudySession(mode = 'daily') {
  sessionMode = mode;
  const state = getState();

  if (mode === 'daily') {
    const queueData = buildDailyQueue(wordsList, state);
    sessionQueue = queueData.queue;
  } else if (mode === 'practice') {
    sessionQueue = buildPracticeQueue(wordsList, state, 15);
  } else if (mode === 'bonus') {
    sessionQueue = buildBonusQueue(wordsList, state, 10);
  }

  if (sessionQueue.length === 0) {
    showToast('No cards due! Starting Quick Practice session instead.', 'info', 2500);
    sessionMode = 'practice';
    sessionQueue = buildPracticeQueue(wordsList, state, 15);
  }

  currentCardIndex = 0;
  isCardFlipped = false;
  sessionStats = {
    totalInitial: sessionQueue.length,
    reviewsDone: 0,
    goodOrEasyCount: 0,
    newLearnedCount: 0
  };

  navigateTo('#study');
  renderCurrentCard();
}

function renderCurrentCard() {
  if (currentCardIndex >= sessionQueue.length) {
    finishSession();
    return;
  }

  const currentItem = sessionQueue[currentCardIndex];
  const word = currentItem.word;
  const state = getState();
  const direction = state.settings.direction || 'de-en';

  isCardFlipped = false;
  elements.flashcardInner.classList.remove('is-flipped');
  elements.gradingContainer.classList.remove('visible');

  // Update Session Top Header
  const progressRatio = Math.min(100, Math.round((sessionStats.reviewsDone / Math.max(1, sessionStats.totalInitial)) * 100));
  if (elements.studySessionProgress) {
    elements.studySessionProgress.style.width = `${progressRatio}%`;
  }
  if (elements.studyProgressText) {
    elements.studyProgressText.textContent = `Card ${currentCardIndex + 1} of ${sessionQueue.length}`;
  }

  const accuracy = sessionStats.reviewsDone > 0
    ? Math.round((sessionStats.goodOrEasyCount / sessionStats.reviewsDone) * 100)
    : 100;
  if (elements.studyAccuracyBadge) {
    elements.studyAccuracyBadge.textContent = `${accuracy}% Acc`;
  }

  // Determine direction for this card
  let isGermanFront = true;
  if (direction === 'en-de') {
    isGermanFront = false;
  } else if (direction === 'mixed') {
    isGermanFront = word.id % 2 === 0;
  }

  // Gender styling
  const gender = word.article || (word.pos === 'noun' ? 'other' : 'other');
  elements.flashcardInner.setAttribute('data-gender', gender);

  const posClass = `pos-badge gender-${gender}`;
  const articleHtml = word.article ? `<span class="article-badge ${word.article}">${word.article}</span>` : '';
  const pluralHtml = word.plural ? `<span class="card-plural">pl. ${word.plural}</span>` : '';

  // Render Front Face
  if (isGermanFront) {
    elements.cardFront.innerHTML = `
      <div class="card-top-bar">
        <span class="rank-badge">#${word.id} / 5000</span>
        <span class="${posClass}">${word.pos}</span>
      </div>
      <div class="card-center-block">
        ${articleHtml}
        <h2 class="card-headword">${word.de}</h2>
        <button class="audio-btn-circle" id="btn-front-audio" title="Listen to German pronunciation (Shortcut: R)">
          <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
        </button>
      </div>
      <div class="card-prompt-footer">
        <svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
        <span>Tap card or press [Space] to reveal answer</span>
      </div>
    `;
  } else {
    // English Prompt Front Face
    elements.cardFront.innerHTML = `
      <div class="card-top-bar">
        <span class="rank-badge">#${word.id} / 5000</span>
        <span class="${posClass}">${word.pos}</span>
      </div>
      <div class="card-center-block">
        <span class="card-plural">Translate to German:</span>
        <h2 class="card-headword">${word.en}</h2>
      </div>
      <div class="card-prompt-footer">
        <svg viewBox="0 0 24 24"><path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/></svg>
        <span>Tap card or press [Space] to reveal German word</span>
      </div>
    `;
  }

  // Render Back Face
  const exampleDeHtml = word.exDe ? `
    <div class="card-example-block">
      <div class="example-de-row">
        <span class="example-de">${word.exDe}</span>
        <button class="example-speaker-btn" id="btn-example-audio" title="Listen to example sentence">
          <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
        </button>
      </div>
      <span class="example-en">${word.exEn || ''}</span>
    </div>
  ` : '';

  elements.cardBack.innerHTML = `
    <div class="card-top-bar">
      <span class="rank-badge">#${word.id} / 5000</span>
      <span class="${posClass}">${word.pos}</span>
    </div>
    <div class="card-center-block">
      <div class="word-row-head">
        ${articleHtml}
        <h2 class="card-headword">${word.de}</h2>
      </div>
      ${pluralHtml}
      <div class="card-english-sub">${word.en}</div>
      <button class="audio-btn-circle" id="btn-back-audio" title="Repeat pronunciation (Shortcut: R)">
        <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
      </button>
    </div>
    ${exampleDeHtml}
    <div class="card-prompt-footer">
      <span>Select recall quality (1–4) below</span>
    </div>
  `;

  // Update SRS grading intervals preview
  const intervals = getIntervalPreview(currentItem.currentBox || 0);
  const intervalEls = {
    again: elements.gradeAgain.querySelector('.grade-interval'),
    hard: elements.gradeHard.querySelector('.grade-interval'),
    good: elements.gradeGood.querySelector('.grade-interval'),
    easy: elements.gradeEasy.querySelector('.grade-interval')
  };
  if (intervalEls.again) intervalEls.again.textContent = intervals.again;
  if (intervalEls.hard) intervalEls.hard.textContent = intervals.hard;
  if (intervalEls.good) intervalEls.good.textContent = intervals.good;
  if (intervalEls.easy) intervalEls.easy.textContent = intervals.easy;

  // Audio button handlers
  const frontAudioBtn = document.getElementById('btn-front-audio');
  if (frontAudioBtn) {
    frontAudioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speakWord(word);
    });
  }

  const backAudioBtn = document.getElementById('btn-back-audio');
  if (backAudioBtn) {
    backAudioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speakWord(word);
    });
  }

  const exampleAudioBtn = document.getElementById('btn-example-audio');
  if (exampleAudioBtn) {
    exampleAudioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speakSentence(word.exDe);
    });
  }
}

function flipCard() {
  if (isCardFlipped) return;
  isCardFlipped = true;
  elements.flashcardInner.classList.add('is-flipped');
  elements.gradingContainer.classList.add('visible');

  // Auto-audio on flip if enabled
  const state = getState();
  if (state.settings.autoAudio) {
    const currentItem = sessionQueue[currentCardIndex];
    if (currentItem) {
      speakWord(currentItem.word);
    }
  }
}

function gradeCard(grade) {
  if (!isCardFlipped) {
    flipCard();
    return;
  }

  const currentItem = sessionQueue[currentCardIndex];
  if (!currentItem) return;

  const { newBox, intervalDays, queueAction } = calculateNextReview(currentItem.currentBox, grade);

  // Update storage & streak
  recordCardReview(currentItem.word.id, grade, newBox, intervalDays, currentItem.isNew);

  // Update session stats
  sessionStats.reviewsDone++;
  if (grade >= 3) {
    sessionStats.goodOrEasyCount++;
  }
  if (currentItem.isNew && grade >= 2) {
    sessionStats.newLearnedCount++;
  }

  // Handle Again (<10m) re-insertion
  if (queueAction === 'reinsert') {
    // Reinsert 4 cards ahead
    const targetIdx = Math.min(sessionQueue.length, currentCardIndex + 4);
    sessionQueue.splice(targetIdx, 0, {
      ...currentItem,
      currentBox: 1,
      isNew: false
    });
  }

  // Animation: slide card out, then advance
  elements.flashcardInner.classList.add('card-exit-left');
  setTimeout(() => {
    elements.flashcardInner.classList.remove('card-exit-left');
    currentCardIndex++;
    if (currentCardIndex < sessionQueue.length) {
      elements.flashcardInner.classList.add('card-enter-right');
      renderCurrentCard();
      setTimeout(() => {
        elements.flashcardInner.classList.remove('card-enter-right');
      }, 250);
    } else {
      finishSession();
    }
  }, 160);
}

function finishSession() {
  const accuracy = sessionStats.reviewsDone > 0
    ? Math.round((sessionStats.goodOrEasyCount / sessionStats.reviewsDone) * 100)
    : 100;

  if (elements.modalCompleteCards) {
    elements.modalCompleteCards.textContent = sessionStats.reviewsDone;
  }
  if (elements.modalCompleteAccuracy) {
    elements.modalCompleteAccuracy.textContent = `${accuracy}%`;
  }
  if (elements.modalCompleteNew) {
    elements.modalCompleteNew.textContent = sessionStats.newLearnedCount;
  }

  elements.modalComplete.classList.add('active');
}

// --- 5,000-Word Browser Engine ---
function normalizeGerman(text = '') {
  return text
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function filterWords() {
  const query = elements.browserSearchInput.value.trim();
  const normalizedQuery = normalizeGerman(query);
  const srsFilter = elements.filterSrs.value;
  const genderFilter = elements.filterGender.value;
  const bandFilter = elements.filterBand.value;

  const state = getState();
  const today = getTodayDayEpoch();

  filteredWords = wordsList.filter((word) => {
    // 1. Text Search
    if (query) {
      const matchDe = normalizeGerman(word.de).includes(normalizedQuery);
      const matchEn = normalizeGerman(word.en).includes(normalizedQuery);
      if (!matchDe && !matchEn) return false;
    }

    // 2. SRS Status Filter
    const progress = state.progress[word.id];
    if (srsFilter === 'due') {
      if (!progress || progress[1] > today) return false;
    } else if (srsFilter === 'learning') {
      if (!progress || progress[0] < 1 || progress[0] > 4) return false;
    } else if (srsFilter === 'mastered') {
      if (!progress || progress[0] !== 5) return false;
    } else if (srsFilter === 'unseen') {
      if (progress) return false;
    }

    // 3. Gender / POS Filter
    if (genderFilter === 'der' && word.article !== 'der') return false;
    if (genderFilter === 'die' && word.article !== 'die') return false;
    if (genderFilter === 'das' && word.article !== 'das') return false;
    if (genderFilter === 'other' && word.article) return false;

    // 4. Frequency Band Filter
    if (bandFilter !== 'all') {
      const [minStr, maxStr] = bandFilter.split('-');
      const min = parseInt(minStr, 10);
      const max = parseInt(maxStr, 10);
      if (word.id < min || word.id > max) return false;
    }

    return true;
  });

  renderBrowserList(true);
}

function renderBrowserList(reset = false) {
  if (reset) {
    browserRenderedCount = 0;
    elements.wordListContainer.innerHTML = '';
  }

  const start = browserRenderedCount;
  const end = Math.min(filteredWords.length, start + BROWSER_CHUNK_SIZE);
  const chunk = filteredWords.slice(start, end);

  const state = getState();
  const fragment = document.createDocumentFragment();

  chunk.forEach((word) => {
    const row = document.createElement('div');
    row.className = 'word-row';

    const progress = state.progress[word.id];
    let boxBadgeHtml = '<span class="box-badge new">New</span>';
    if (progress) {
      const box = progress[0];
      if (box === 5) {
        boxBadgeHtml = '<span class="box-badge mastered">Box 5 (Mastered)</span>';
      } else {
        boxBadgeHtml = `<span class="box-badge learning">Box ${box}</span>`;
      }
    }

    const articleHtml = word.article ? `<span class="word-row-article ${word.article}">${word.article}</span>` : '';
    const pluralHtml = word.plural ? `<span class="word-row-plural">pl. ${word.plural}</span>` : '';

    row.innerHTML = `
      <div class="word-row-left">
        <span class="word-row-rank">#${word.id}</span>
        <div class="word-row-content">
          <div class="word-row-head">
            ${articleHtml}
            <span class="word-row-term">${word.de}</span>
            ${pluralHtml}
          </div>
          <span class="word-row-en">${word.en}</span>
        </div>
      </div>
      <div class="word-row-right">
        ${boxBadgeHtml}
        <button class="audio-btn-row" data-id="${word.id}" title="Pronounce ${word.de}">
          <svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
        </button>
      </div>
    `;

    // Audio click handler
    const audioBtn = row.querySelector('.audio-btn-row');
    audioBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      speakWord(word);
    });

    fragment.appendChild(row);
  });

  elements.wordListContainer.appendChild(fragment);
  browserRenderedCount = end;

  // Update count indicator
  if (elements.browserCountIndicator) {
    elements.browserCountIndicator.textContent = `Showing ${browserRenderedCount} of ${filteredWords.length} words`;
  }

  // Toggle "Load More" button visibility
  if (elements.btnLoadMore) {
    elements.btnLoadMore.style.display = browserRenderedCount < filteredWords.length ? 'block' : 'none';
  }
}

// Setup Sentinel Intersection Observer for infinite scrolling
function setupBrowserObserver() {
  if (!elements.browserSentinel) return;

  if (browserSentinelObserver) {
    browserSentinelObserver.disconnect();
  }

  browserSentinelObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && browserRenderedCount < filteredWords.length) {
          renderBrowserList(false);
        }
      });
    },
    { rootMargin: '200px' }
  );

  browserSentinelObserver.observe(elements.browserSentinel);
}

// --- Settings View Controller ---
function renderSettings() {
  const state = getState();
  const { dailyNewLimit, dailyStreakGoal, direction, autoAudio, theme } = state.settings;

  if (elements.sliderDailyNew) elements.sliderDailyNew.value = dailyNewLimit;
  if (elements.valDailyNew) elements.valDailyNew.textContent = dailyNewLimit;

  if (elements.sliderDailyGoal) elements.sliderDailyGoal.value = dailyStreakGoal;
  if (elements.valDailyGoal) elements.valDailyGoal.textContent = dailyStreakGoal;

  elements.directionBtns.forEach((btn) => {
    if (btn.dataset.direction === direction) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (elements.toggleAutoAudio) elements.toggleAutoAudio.checked = autoAudio;
  if (elements.toggleTheme) elements.toggleTheme.checked = theme === 'light';
}

// --- Event Listeners Setup ---
function setupEventListeners() {
  // Navigation
  window.addEventListener('hashchange', handleRoute);

  elements.navLinks.forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const href = link.getAttribute('href');
      navigateTo(href);
    });
  });

  // Theme toggle
  if (elements.themeToggle) {
    elements.themeToggle.addEventListener('click', toggleTheme);
  }

  // Dashboard CTAs
  if (elements.btnStartSession) {
    elements.btnStartSession.addEventListener('click', () => startStudySession('daily'));
  }
  if (elements.btnQuickPractice) {
    elements.btnQuickPractice.addEventListener('click', () => startStudySession('practice'));
  }

  // Study View Card & Buttons
  if (elements.flashcardScene) {
    elements.flashcardScene.addEventListener('click', flipCard);
  }

  if (elements.btnExitSession) {
    elements.btnExitSession.addEventListener('click', () => {
      cancelAudio();
      navigateTo('#dashboard');
    });
  }

  // SRS Grading Buttons
  if (elements.gradeAgain) {
    elements.gradeAgain.addEventListener('click', (e) => {
      e.stopPropagation();
      gradeCard(1);
    });
  }
  if (elements.gradeHard) {
    elements.gradeHard.addEventListener('click', (e) => {
      e.stopPropagation();
      gradeCard(2);
    });
  }
  if (elements.gradeGood) {
    elements.gradeGood.addEventListener('click', (e) => {
      e.stopPropagation();
      gradeCard(3);
    });
  }
  if (elements.gradeEasy) {
    elements.gradeEasy.addEventListener('click', (e) => {
      e.stopPropagation();
      gradeCard(4);
    });
  }

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    // Only handle if in study view and no modal is active
    const isModalActive = elements.modalComplete.classList.contains('active') ||
                          elements.modalReset.classList.contains('active');
    if (isModalActive) {
      if (e.key === 'Escape') {
        elements.modalComplete.classList.remove('active');
        elements.modalReset.classList.remove('active');
      }
      return;
    }

    if (currentRoute !== '#study') return;

    if (e.code === 'Space' || e.key === 'Enter') {
      e.preventDefault();
      if (!isCardFlipped) {
        flipCard();
      }
    } else if (e.key === '1') {
      e.preventDefault();
      gradeCard(1);
    } else if (e.key === '2') {
      e.preventDefault();
      gradeCard(2);
    } else if (e.key === '3') {
      e.preventDefault();
      gradeCard(3);
    } else if (e.key === '4') {
      e.preventDefault();
      gradeCard(4);
    } else if (e.key === 'r' || e.key === 'R') {
      e.preventDefault();
      const currentItem = sessionQueue[currentCardIndex];
      if (currentItem) {
        speakWord(currentItem.word);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancelAudio();
      navigateTo('#dashboard');
    }
  });

  // Browser Search & Filters
  if (elements.browserSearchInput) {
    elements.browserSearchInput.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(filterWords, 150);
    });
  }

  if (elements.btnClearSearch) {
    elements.btnClearSearch.addEventListener('click', () => {
      elements.browserSearchInput.value = '';
      filterWords();
    });
  }

  if (elements.filterSrs) elements.filterSrs.addEventListener('change', filterWords);
  if (elements.filterGender) elements.filterGender.addEventListener('change', filterWords);
  if (elements.filterBand) elements.filterBand.addEventListener('change', filterWords);

  if (elements.btnLoadMore) {
    elements.btnLoadMore.addEventListener('click', () => renderBrowserList(false));
  }

  // Settings Controls
  if (elements.sliderDailyNew) {
    elements.sliderDailyNew.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      elements.valDailyNew.textContent = val;
      updateSettings({ dailyNewLimit: val });
    });
  }

  if (elements.sliderDailyGoal) {
    elements.sliderDailyGoal.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      elements.valDailyGoal.textContent = val;
      updateSettings({ dailyStreakGoal: val });
    });
  }

  elements.directionBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const dir = btn.dataset.direction;
      elements.directionBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateSettings({ direction: dir });
      showToast(`Study direction set to ${btn.textContent.trim()}`, 'info', 2000);
    });
  });

  if (elements.toggleAutoAudio) {
    elements.toggleAutoAudio.addEventListener('change', (e) => {
      updateSettings({ autoAudio: e.target.checked });
    });
  }

  if (elements.toggleTheme) {
    elements.toggleTheme.addEventListener('change', (e) => {
      const newTheme = e.target.checked ? 'light' : 'dark';
      updateSettings({ theme: newTheme });
      applyTheme(newTheme);
    });
  }

  // Backup & Restore
  if (elements.btnExportBackup) {
    elements.btnExportBackup.addEventListener('click', () => {
      const filename = exportBackup();
      showToast(`Exported backup: ${filename}`, 'success');
    });
  }

  if (elements.btnTriggerImport) {
    elements.btnTriggerImport.addEventListener('click', () => {
      elements.inputImportBackup.click();
    });
  }

  if (elements.inputImportBackup) {
    elements.inputImportBackup.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (event) => {
        const result = importBackup(event.target.result);
        if (result.success) {
          showToast('Progress and settings imported successfully!', 'success');
          renderDashboard();
          renderSettings();
        } else {
          showToast(`Import failed: ${result.error}`, 'error', 4000);
        }
      };
      reader.readAsText(file);
      e.target.value = ''; // Reset file input
    });
  }

  // Reset Progress Flow
  if (elements.btnResetProgress) {
    elements.btnResetProgress.addEventListener('click', () => {
      elements.modalReset.classList.add('active');
    });
  }

  if (elements.btnCancelReset) {
    elements.btnCancelReset.addEventListener('click', () => {
      elements.modalReset.classList.remove('active');
    });
  }

  if (elements.btnConfirmReset) {
    elements.btnConfirmReset.addEventListener('click', () => {
      resetAllProgress();
      elements.modalReset.classList.remove('active');
      showToast('All learning progress has been reset.', 'info');
      renderDashboard();
    });
  }

  // Session Complete Modal Actions
  if (elements.btnFinishSession) {
    elements.btnFinishSession.addEventListener('click', () => {
      elements.modalComplete.classList.remove('active');
      navigateTo('#dashboard');
    });
  }

  if (elements.btnBonusSession) {
    elements.btnBonusSession.addEventListener('click', () => {
      elements.modalComplete.classList.remove('active');
      startStudySession('bonus');
    });
  }

  // Streak Achieved Event
  window.addEventListener('german5k:streak-achieved', (e) => {
    const streak = e.detail?.currentStreak || 1;
    showToast(`🔥 Streak Extended! ${streak} Day Streak Achieved!`, 'streak', 4000);
    renderDashboard();
  });
}

// --- App Initialization ---
async function initApp() {
  cacheDOMElements();

  // Initialize storage & theme
  const state = initStorage();
  applyTheme(state.settings.theme || 'dark');

  // Register Service Worker for offline PWA
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').then(
        (reg) => console.log('German5K ServiceWorker registered:', reg.scope),
        (err) => console.warn('German5K ServiceWorker registration failed:', err)
      );
    });
  }

  // Fetch words dataset once
  try {
    const res = await fetch('./data/words.json');
    if (!res.ok) throw new Error(`HTTP error ${res.status}`);
    wordsList = await res.json();
    wordsMap = new Map(wordsList.map(w => [w.id, w]));
    filteredWords = [...wordsList];
  } catch (err) {
    console.error('Failed to load words.json:', err);
    showToast('Failed to load vocabulary data. Check console.', 'error');
  }

  setupEventListeners();
  setupBrowserObserver();

  // Initial routing
  handleRoute();
}

// Run startup
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
