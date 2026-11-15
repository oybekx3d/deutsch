/**
 * German5K - Web Speech API (de-DE) Pronunciation Engine
 */

let cachedVoice = null;
let voicesLoaded = false;

function loadGermanVoice() {
  if (typeof window === 'undefined' || !window.speechSynthesis) {
    return null;
  }

  const voices = window.speechSynthesis.getVoices() || [];
  if (voices.length === 0) {
    return null;
  }

  voicesLoaded = true;

  // 1. Filter German voices
  const deVoices = voices.filter(v => v.lang && v.lang.toLowerCase().startsWith('de'));
  if (deVoices.length === 0) {
    return null;
  }

  // 2. High-quality priority match
  const preferredRegex = /Google Deutsch|Anna|Helena|Martin|Petra|Natural|Yannick|Hedda/i;
  const highQuality = deVoices.find(v => preferredRegex.test(v.name));
  if (highQuality) {
    cachedVoice = highQuality;
    return cachedVoice;
  }

  // 3. Exact de-DE match
  const deDeVoice = deVoices.find(v => v.lang.toLowerCase() === 'de-de');
  if (deDeVoice) {
    cachedVoice = deDeVoice;
    return cachedVoice;
  }

  // 4. Any German voice
  cachedVoice = deVoices[0];
  return cachedVoice;
}

// Listen for async voice loading
if (typeof window !== 'undefined' && window.speechSynthesis) {
  loadGermanVoice();
  if (window.speechSynthesis.onvoiceschanged !== undefined) {
    window.speechSynthesis.onvoiceschanged = () => {
      loadGermanVoice();
    };
  }
}

/**
 * Checks if speech synthesis is available
 */
export function isAudioSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/**
 * Pronounces a German word with its article (if noun)
 * @param {Object} wordItem WordItem object { de, article, ... }
 * @param {Function} onStart Optional callback
 * @param {Function} onEnd Optional callback
 */
export function speakWord(wordItem, onStart, onEnd) {
  if (!isAudioSupported()) return;

  const text = wordItem.article ? `${wordItem.article} ${wordItem.de}` : wordItem.de;
  speakText(text, onStart, onEnd);
}

/**
 * Pronounces a German sentence or phrase
 * @param {string} text Text to pronounce
 * @param {Function} onStart Optional callback
 * @param {Function} onEnd Optional callback
 */
export function speakSentence(text, onStart, onEnd) {
  if (!isAudioSupported() || !text) return;
  speakText(text, onStart, onEnd);
}

/**
 * Speaks arbitrary German text with rate 0.95
 */
export function speakText(text, onStart, onEnd) {
  if (!isAudioSupported() || !text) return;

  // Prevent queued overlapping utterances
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'de-DE';
  utterance.rate = 0.95;

  const voice = cachedVoice || loadGermanVoice();
  if (voice) {
    utterance.voice = voice;
  }

  if (typeof onStart === 'function') {
    utterance.onstart = onStart;
  }
  if (typeof onEnd === 'function') {
    utterance.onend = onEnd;
    utterance.onerror = onEnd;
  }

  window.speechSynthesis.speak(utterance);
}

/**
 * Cancels any active speech
 */
export function cancelAudio() {
  if (isAudioSupported()) {
    window.speechSynthesis.cancel();
  }
}
