/**
 * WortMeister 5000 - Storage & Streak Engine
 * Compact localStorage persistence for 5,000 words.
 */

export const STORAGE_KEY = 'wm5k_state_v1';

export function getLocalDateString(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getTodayDayEpoch() {
  return Math.floor(Date.now() / 86400000);
}

export function getDefaultState() {
  const today = getLocalDateString();
  return {
    version: 1,
    settings: {
      dailyNewLimit: 20,
      dailyStreakGoal: 15,
      direction: 'de-en', // 'de-en' | 'en-de' | 'mixed'
      autoAudio: true,
      theme: 'dark' // 'dark' | 'light'
    },
    streak: {
      current: 0,
      longest: 0,
      lastGoalMetDate: null,
      todayDate: today,
      todayStudiedCount: 0,
      todayNewCount: 0,
      history: {}
    },
    progress: {} // [box, nextReviewDayEpoch, reps, lapses]
  };
}

let activeState = null;

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      activeState = getDefaultState();
      saveState(activeState);
      return activeState;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || !parsed.version) {
      activeState = getDefaultState();
      saveState(activeState);
      return activeState;
    }
    // Deep merge settings and streak with defaults to ensure all keys exist
    const defaults = getDefaultState();
    activeState = {
      version: parsed.version || 1,
      settings: { ...defaults.settings, ...(parsed.settings || {}) },
      streak: { ...defaults.streak, ...(parsed.streak || {}) },
      progress: parsed.progress && typeof parsed.progress === 'object' ? parsed.progress : {}
    };
    return activeState;
  } catch (err) {
    console.error('Failed to load storage state, resetting to default:', err);
    activeState = getDefaultState();
    saveState(activeState);
    return activeState;
  }
}

export function saveState(state = activeState) {
  try {
    if (!state) return;
    activeState = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save state to localStorage:', err);
  }
}

export function initStorage() {
  const state = loadState();
  const today = getLocalDateString();

  if (state.streak.todayDate !== today) {
    // Check if streak was maintained yesterday
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = getLocalDateString(yesterdayDate);

    if (state.streak.lastGoalMetDate !== today && state.streak.lastGoalMetDate !== yesterday) {
      // Streak broken
      state.streak.current = 0;
    }

    state.streak.todayStudiedCount = 0;
    state.streak.todayNewCount = 0;
    state.streak.todayDate = today;
    saveState(state);
  }

  return state;
}

export function getState() {
  if (!activeState) {
    return initStorage();
  }
  return activeState;
}

export function updateSettings(newSettings) {
  const state = getState();
  state.settings = { ...state.settings, ...newSettings };
  saveState(state);
  window.dispatchEvent(new CustomEvent('wm5k:settings-changed', { detail: state.settings }));
  return state.settings;
}

export function recordCardReview(wordId, grade, newBox, intervalDays, isNewWord = false) {
  const state = getState();
  const todayEpoch = getTodayDayEpoch();
  const todayStr = getLocalDateString();
  const nextReviewEpoch = todayEpoch + intervalDays;

  const existing = state.progress[wordId] || [0, 0, 0, 0];
  const prevReps = existing[2] || 0;
  const prevLapses = existing[3] || 0;

  const newReps = grade >= 2 ? prevReps + 1 : prevReps;
  const newLapses = grade === 1 ? prevLapses + 1 : prevLapses;

  state.progress[wordId] = [newBox, nextReviewEpoch, newReps, newLapses];

  // Daily streak & counts
  state.streak.todayStudiedCount = (state.streak.todayStudiedCount || 0) + 1;
  if (isNewWord) {
    state.streak.todayNewCount = (state.streak.todayNewCount || 0) + 1;
  }

  // Activity history
  state.streak.history[todayStr] = (state.streak.history[todayStr] || 0) + 1;

  // Prune history older than 30 days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoffStr = getLocalDateString(cutoffDate);
  for (const dateKey of Object.keys(state.streak.history)) {
    if (dateKey < cutoffStr) {
      delete state.streak.history[dateKey];
    }
  }

  // Streak goal check
  const goalMet = state.streak.todayStudiedCount >= state.settings.dailyStreakGoal;
  if (goalMet && state.streak.lastGoalMetDate !== todayStr) {
    state.streak.current = (state.streak.current || 0) + 1;
    state.streak.longest = Math.max(state.streak.longest || 0, state.streak.current);
    state.streak.lastGoalMetDate = todayStr;
    window.dispatchEvent(new CustomEvent('wm5k:streak-achieved', {
      detail: { currentStreak: state.streak.current }
    }));
  }

  saveState(state);
  return state;
}

export function exportBackup() {
  const state = getState();
  const jsonStr = JSON.stringify(state, null, 2);
  const today = getLocalDateString();
  const filename = `wortmeister-5000-backup-${today}.json`;

  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return filename;
}

export function importBackup(jsonString) {
  try {
    const data = JSON.parse(jsonString);
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid JSON format: Root must be an object.');
    }
    if (!data.version || typeof data.version !== 'number') {
      throw new Error('Invalid backup: Missing version number.');
    }
    if (!data.settings || typeof data.settings !== 'object') {
      throw new Error('Invalid backup: Missing settings.');
    }
    if (!data.streak || typeof data.streak !== 'object') {
      throw new Error('Invalid backup: Missing streak data.');
    }
    if (!data.progress || typeof data.progress !== 'object') {
      throw new Error('Invalid backup: Missing progress data.');
    }

    // Merge safely with defaults
    const defaults = getDefaultState();
    const validatedState = {
      version: data.version,
      settings: { ...defaults.settings, ...data.settings },
      streak: { ...defaults.streak, ...data.streak },
      progress: data.progress
    };

    saveState(validatedState);
    initStorage();
    window.dispatchEvent(new CustomEvent('wm5k:data-imported'));
    return { success: true };
  } catch (err) {
    console.error('Import error:', err);
    return { success: false, error: err.message || 'Corrupted backup file' };
  }
}

export function resetAllProgress() {
  const state = getState();
  const defaults = getDefaultState();
  state.streak = defaults.streak;
  state.progress = {};
  saveState(state);
  window.dispatchEvent(new CustomEvent('wm5k:progress-reset'));
  return state;
}

export function getWordProgress(wordId) {
  const state = getState();
  return state.progress[wordId] || null;
}

export function getMasteryStats(totalWordsCount = 5000) {
  const state = getState();
  const todayEpoch = getTodayDayEpoch();
  let dueCount = 0;
  let learningCount = 0;
  let masteredCount = 0;

  for (const key in state.progress) {
    const item = state.progress[key];
    const box = item[0];
    const nextReview = item[1];

    if (box === 5) {
      masteredCount++;
    } else if (box >= 1 && box <= 4) {
      learningCount++;
    }

    if (nextReview <= todayEpoch) {
      dueCount++;
    }
  }

  const seenCount = Object.keys(state.progress).length;
  const unseenCount = Math.max(0, totalWordsCount - seenCount);

  return {
    dueCount,
    learningCount,
    masteredCount,
    unseenCount,
    seenCount,
    totalWordsCount
  };
}

export function get14DayActivity() {
  const state = getState();
  const days = [];
  const today = new Date();

  for (let i = 13; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = getLocalDateString(d);
    const count = state.streak.history[dateStr] || 0;
    const isToday = i === 0;
    const dayLabel = d.toLocaleDateString(undefined, { weekday: 'narrow' });
    days.push({
      dateStr,
      count,
      isToday,
      dayLabel,
      goalMet: count >= state.settings.dailyStreakGoal
    });
  }

  return days;
}
