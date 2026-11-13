import { AccentOption } from '../types/dictation';

let audioCtx: AudioContext | null = null;
let speechCancelled = false;
let activeTimeouts: number[] = [];

export function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

function playTone(
  freq: number,
  startTime: number,
  duration: number,
  sfxEnabled: boolean,
  type: OscillatorType = 'sine',
  volume = 0.16
) {
  const ctx = getAudioContext();
  if (!ctx || !sfxEnabled) return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  gain.gain.setValueAtTime(volume, startTime);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

export function playPopSound(sfxEnabled: boolean) {
  const ctx = getAudioContext();
  if (ctx && sfxEnabled) playTone(680, ctx.currentTime, 0.06, sfxEnabled, 'sine', 0.13);
}

export function playSuccessSound(sfxEnabled: boolean) {
  const ctx = getAudioContext();
  if (!ctx || !sfxEnabled) return;
  const now = ctx.currentTime;
  playTone(523.25, now, 0.14, sfxEnabled, 'triangle', 0.18);
  playTone(659.25, now + 0.09, 0.14, sfxEnabled, 'triangle', 0.18);
  playTone(783.99, now + 0.18, 0.16, sfxEnabled, 'triangle', 0.18);
  playTone(1046.5, now + 0.27, 0.34, sfxEnabled, 'triangle', 0.22);
}

export function playErrorSound(sfxEnabled: boolean) {
  const ctx = getAudioContext();
  if (!ctx || !sfxEnabled) return;
  const now = ctx.currentTime;
  playTone(280, now, 0.16, sfxEnabled, 'sine', 0.16);
  playTone(220, now + 0.14, 0.24, sfxEnabled, 'sine', 0.16);
}

export function playFanfareSound(sfxEnabled: boolean) {
  const ctx = getAudioContext();
  if (!ctx || !sfxEnabled) return;
  const now = ctx.currentTime;
  const notes = [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5];
  const offsets = [0, 0.1, 0.2, 0.32, 0.48, 0.6];
  notes.forEach((n, i) => {
    playTone(n, now + offsets[i], i === 5 ? 0.48 : 0.15, sfxEnabled, 'triangle', 0.2);
  });
}

export function clearSpeechTimeouts() {
  activeTimeouts.forEach((id) => window.clearTimeout(id));
  activeTimeouts = [];
}

export function scheduleManagedTimeout(fn: () => void, ms: number): number {
  const id = window.setTimeout(fn, ms);
  activeTimeouts.push(id);
  return id;
}

export function stopAllSpeech() {
  speechCancelled = true;
  clearSpeechTimeouts();
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}

function createUtterance(text: string, accent: AccentOption, rate = 1.0): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  u.lang = accent;
  u.rate = rate;
  u.pitch = 1.04;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    const exactMatch = voices.find((v) => v.lang.replace('_', '-') === accent);
    const langMatch = voices.find((v) => v.lang.startsWith('en'));
    if (exactMatch) u.voice = exactMatch;
    else if (langMatch) u.voice = langMatch;
  }
  return u;
}

export function speakText(text: string, accent: AccentOption, rate = 1.0) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  stopAllSpeech();
  speechCancelled = false;
  window.speechSynthesis.speak(createUtterance(text, accent, rate));
}

export function speakSentenceInChunks(text: string, accent: AccentOption) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  stopAllSpeech();
  speechCancelled = false;

  let cleanText = text.trim();
  let endPunctSpeak = '';
  if (cleanText.endsWith('.')) {
    endPunctSpeak = 'full stop';
    cleanText = cleanText.slice(0, -1).trim();
  } else if (cleanText.endsWith('?')) {
    endPunctSpeak = 'question mark';
    cleanText = cleanText.slice(0, -1).trim();
  }

  const rawChunks = cleanText
    .replace(/\s+(because|and|but|so|when|before|after)\s+/gi, ' | $1 ')
    .replace(/,\s*/g, ', | ')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

  const finalChunks: string[] = [];
  for (const ch of rawChunks) {
    const words = ch.split(/\s+/);
    if (words.length > 6) {
      const mid = Math.ceil(words.length / 2);
      finalChunks.push(words.slice(0, mid).join(' '), words.slice(mid).join(' '));
    } else {
      finalChunks.push(ch);
    }
  }
  if (endPunctSpeak) finalChunks.push(endPunctSpeak);

  let i = 0;
  function speakNextChunk() {
    if (speechCancelled || i >= finalChunks.length) return;
    const u = createUtterance(finalChunks[i], accent, 0.85);
    u.onend = () => {
      if (!speechCancelled && ++i < finalChunks.length) {
        scheduleManagedTimeout(speakNextChunk, 950);
      }
    };
    window.speechSynthesis.speak(u);
  }
  speakNextChunk();
}

export function initSpeechVoices() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.getVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }
}
