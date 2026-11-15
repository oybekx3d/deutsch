/**
 * German5K - Spaced Repetition System (SRS)
 * Modified SM-2 / 5-box Leitner scheduler and queue engine.
 */

import { getTodayDayEpoch } from './storage.js';

export const BOX_INTERVALS = {
  // Good grade (Box + 1)
  good: {
    1: 1,
    2: 3,
    3: 7,
    4: 14,
    5: 30
  },
  // Easy grade (Box + 2)
  easy: {
    1: 4,
    2: 4,
    3: 10,
    4: 21,
    5: 45
  }
};

/**
 * Calculates new box and scheduled interval (in days)
 * @param {number} currentBox (0 for unseen, 1..5 for learned)
 * @param {number} grade (1: Again, 2: Hard, 3: Good, 4: Easy)
 * @returns {{ newBox: number, intervalDays: number, queueAction: 'reinsert'|'remove' }}
 */
export function calculateNextReview(currentBox = 0, grade) {
  let newBox = 1;
  let intervalDays = 0;
  let queueAction = 'remove';

  switch (grade) {
    case 1: // Again
      newBox = 1;
      intervalDays = 0;
      queueAction = 'reinsert';
      break;

    case 2: // Hard
      newBox = Math.max(1, currentBox || 1);
      intervalDays = 1;
      queueAction = 'remove';
      break;

    case 3: // Good
      newBox = Math.min(5, (currentBox || 0) + 1);
      intervalDays = BOX_INTERVALS.good[newBox] || 1;
      queueAction = 'remove';
      break;

    case 4: // Easy
      newBox = Math.min(5, (currentBox || 0) + 2);
      intervalDays = BOX_INTERVALS.easy[newBox] || 4;
      queueAction = 'remove';
      break;

    default:
      newBox = 1;
      intervalDays = 1;
      queueAction = 'remove';
  }

  return { newBox, intervalDays, queueAction };
}

/**
 * Helper to get preview label for SRS buttons
 * e.g., Again (<10m), Hard (1d), Good (3d), Easy (7d)
 */
export function getIntervalPreview(currentBox = 0) {
  const goodBox = Math.min(5, (currentBox || 0) + 1);
  const easyBox = Math.min(5, (currentBox || 0) + 2);

  return {
    again: '< 10m',
    hard: '1d',
    good: `${BOX_INTERVALS.good[goodBox]}d`,
    easy: `${BOX_INTERVALS.easy[easyBox]}d`
  };
}

/**
 * Builds the daily study queue:
 * 1. Due reviews first (sorted by box ascending, then id ascending)
 * 2. Daily new words (up to remaining daily limit, id ascending)
 * 3. Interleaved 1 new word after every 3 due reviews
 * 
 * @param {Array} wordsList All words sorted by frequency id
 * @param {Object} state Application state from storage
 * @returns {Array} Array of { word, isNew, currentBox }
 */
export function buildDailyQueue(wordsList, state) {
  const today = getTodayDayEpoch();
  const dueItems = [];
  const newItems = [];

  // Index words by id for quick lookup
  const wordsMap = new Map();
  for (const w of wordsList) {
    wordsMap.set(w.id, w);
  }

  // 1. Due Reviews
  for (const idStr in state.progress) {
    const wordId = Number(idStr);
    const progress = state.progress[idStr];
    const box = progress[0];
    const nextReview = progress[1];

    if (nextReview <= today && wordsMap.has(wordId)) {
      dueItems.push({
        word: wordsMap.get(wordId),
        isNew: false,
        currentBox: box
      });
    }
  }

  // Sort due reviews: lowest box first, then lowest id (highest frequency)
  dueItems.sort((a, b) => {
    if (a.currentBox !== b.currentBox) {
      return a.currentBox - b.currentBox;
    }
    return a.word.id - b.word.id;
  });

  // 2. New Words
  const remainingNewQuota = Math.max(
    0,
    (state.settings.dailyNewLimit || 20) - (state.streak.todayNewCount || 0)
  );

  if (remainingNewQuota > 0) {
    for (const w of wordsList) {
      if (!state.progress[w.id]) {
        newItems.push({
          word: w,
          isNew: true,
          currentBox: 0
        });
        if (newItems.length >= remainingNewQuota) break;
      }
    }
  }

  // 3. Interleaving: 1 new word after every 3 due reviews
  const sessionQueue = [];
  let dueIdx = 0;
  let newIdx = 0;

  while (dueIdx < dueItems.length || newIdx < newItems.length) {
    // Add up to 3 due cards
    for (let i = 0; i < 3 && dueIdx < dueItems.length; i++) {
      sessionQueue.push(dueItems[dueIdx++]);
    }
    // Add 1 new card if available
    if (newIdx < newItems.length) {
      sessionQueue.push(newItems[newIdx++]);
    }
    // If no more due cards, drain all remaining new cards
    if (dueIdx >= dueItems.length) {
      while (newIdx < newItems.length) {
        sessionQueue.push(newItems[newIdx++]);
      }
    }
  }

  return {
    queue: sessionQueue,
    dueCount: dueItems.length,
    newCount: newItems.length
  };
}

/**
 * Builds a practice/cram queue of random learned words
 * @param {Array} wordsList
 * @param {Object} state
 * @param {number} count Default 15
 */
export function buildPracticeQueue(wordsList, state, count = 15) {
  const learnedIds = Object.keys(state.progress).map(Number);
  const wordsMap = new Map(wordsList.map(w => [w.id, w]));

  let pool = [];

  if (learnedIds.length > 0) {
    for (const id of learnedIds) {
      if (wordsMap.has(id)) {
        pool.push({
          word: wordsMap.get(id),
          isNew: false,
          currentBox: state.progress[id][0]
        });
      }
    }
  }

  // If no learned words or fewer than count, supplement with top unseen words
  if (pool.length < count) {
    for (const w of wordsList) {
      if (!state.progress[w.id]) {
        pool.push({
          word: w,
          isNew: true,
          currentBox: 0
        });
        if (pool.length >= count * 2) break;
      }
    }
  }

  // Fisher-Yates shuffle
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Builds a bonus session of 10 words
 */
export function buildBonusQueue(wordsList, state, count = 10) {
  return buildPracticeQueue(wordsList, state, count);
}
