import { DiffToken, DictationUnit, RewardsState, WordItem } from '../types/dictation';

export function parseWords(rawText: string): WordItem[] {
  const parsed: WordItem[] = [];
  for (const rawLine of rawText.split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || /^(part\s*[a-z0-9]|詞語|句子|生字)/i.test(line)) continue;
    line = line.replace(/^\(?\d+\)?[.)、\s]+/, '').trim();
    if (!line) continue;

    let en = line;
    let zh = '';
    const match = line.match(/^(.+?)(?:\s*[,，:：\t]\s*|\s+[-–]\s+)(.+)$/);
    if (match) {
      en = match[1].trim();
      zh = match[2].trim();
    }
    if (!en) continue;
    const type = /[.?!]$/.test(en) || en.split(/\s+/).length >= 5 ? 'sentence' : 'phrase';
    parsed.push({ en, zh, type });
  }
  return parsed;
}

export function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function extractKeywordsFromSentences(sentences: WordItem[]): WordItem[] {
  const stopWords = new Set([
    'i', 'to', 'the', 'a', 'an', 'and', 'or', 'in', 'on', 'at', 'is', 'am', 'are',
    'go', 'she', 'he', 'it', 'we', 'they', 'want', 'have',
  ]);
  const seen = new Set<string>();
  const extracted: WordItem[] = [];
  for (const s of sentences) {
    for (const w of s.en.replace(/[.,?!]/g, '').split(/\s+/)) {
      const low = w.toLowerCase();
      if (w.length >= 4 && !stopWords.has(low) && !seen.has(low)) {
        seen.add(low);
        extracted.push({ en: w, zh: '（句子重點生字）', type: 'phrase' });
      }
    }
  }
  return extracted;
}

export function generateSpellingDecoys(word: string): string[] {
  const decoys = new Set<string>();
  const targetLower = word.toLowerCase();
  const rules: [RegExp, string][] = [
    [/ph/gi, 'f'], [/ee/gi, 'ea'], [/ea/gi, 'ee'], [/ai/gi, 'ay'],
    [/ou/gi, 'ow'], [/ow/gi, 'ou'], [/ck/gi, 'k'], [/ue/gi, 'u'],
    [/c([eiy])/gi, 's$1'], [/sc/gi, 's'], [/st/gi, 's'],
    [/a/i, 'e'], [/e/i, 'a'], [/i/i, 'e'], [/o/i, 'u'], [/u/i, 'o'],
    [/([a-z])\1/i, '$1'],
  ];

  for (const [regex, rep] of shuffleArray(rules)) {
    if (regex.test(word)) {
      const fake = word.replace(regex, rep);
      if (fake.toLowerCase() !== targetLower) decoys.add(fake);
    }
    if (decoys.size >= 3) break;
  }

  let attempts = 0;
  while (decoys.size < 3 && attempts++ < 30) {
    const chars = Array.from(word);
    const validPos: number[] = [];
    for (let i = 1; i < chars.length - 1; i++) {
      if (/[a-zA-Z]/.test(chars[i]) && /[a-zA-Z]/.test(chars[i + 1]) && chars[i] !== chars[i + 1]) {
        validPos.push(i);
      }
    }
    if (validPos.length > 0 && attempts < 15) {
      const p = validPos[Math.floor(Math.random() * validPos.length)];
      [chars[p], chars[p + 1]] = [chars[p + 1], chars[p]];
      const fake = chars.join('');
      if (fake.toLowerCase() !== targetLower) decoys.add(fake);
    } else {
      const letterPos: number[] = [];
      chars.forEach((c, i) => {
        if (/[a-zA-Z]/.test(c)) letterPos.push(i);
      });
      if (letterPos.length > 0) {
        const p = letterPos[Math.floor(Math.random() * letterPos.length)];
        const pool = /[aeiou]/i.test(chars[p]) ? 'aeiou' : 'rstlnmpbd';
        const nc = pool[Math.floor(Math.random() * pool.length)];
        chars[p] = chars[p] === chars[p].toUpperCase() ? nc.toUpperCase() : nc;
        const fake = chars.join('');
        if (fake.toLowerCase() !== targetLower) decoys.add(fake);
      }
    }
  }
  return Array.from(decoys).slice(0, 3);
}

export function buildWordDiff(targetStr: string, userStr: string, strictCase: boolean): DiffToken[] {
  const targetWords = targetStr.trim().split(/\s+/);
  const userWords = userStr.trim().split(/\s+/);
  const n = targetWords.length;
  const m = userWords.length;
  const eq = (a: string, b: string) => (strictCase ? a === b : a.toLowerCase() === b.toLowerCase());

  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = eq(targetWords[i], userWords[j])
        ? 1 + dp[i + 1][j + 1]
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const tokens: DiffToken[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (eq(targetWords[i], userWords[j])) {
      tokens.push({ kind: 'ok', text: targetWords[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      if (i + 1 < n && j + 1 < m && eq(targetWords[i + 1], userWords[j + 1])) {
        tokens.push({ kind: 'wrong-sub', text: userWords[j], expected: targetWords[i] });
        i++;
        j++;
      } else {
        tokens.push({ kind: 'missing', text: targetWords[i] });
        i++;
      }
    } else {
      tokens.push({ kind: 'extra', text: userWords[j] });
      j++;
    }
  }
  while (i < n) {
    tokens.push({ kind: 'missing', text: targetWords[i] });
    i++;
  }
  while (j < m) {
    tokens.push({ kind: 'extra', text: userWords[j] });
    j++;
  }
  return tokens;
}

export function encodeShareData(obj: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function decodeShareData<T>(str: string): T {
  let b64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4) b64 += '=';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
}

export interface ParsedSyncPayload {
  kind: 'unit' | 'all';
  unit?: { id?: string; t?: string; c: string };
  all?: { units: DictationUnit[]; activeId?: string; rewards?: Partial<RewardsState> };
}

export function parseSyncPayloadFromString(rawStr: string): ParsedSyncPayload | null {
  if (!rawStr) return null;
  const unitMatch = rawStr.match(/#u=([A-Za-z0-9\-_]+)/);
  const syncMatch = rawStr.match(/#sync=([A-Za-z0-9\-_]+)/);

  if (unitMatch) {
    try {
      const data = decodeShareData<{ id?: string; t?: string; c?: string }>(unitMatch[1]);
      if (data && typeof data.c === 'string') {
        return { kind: 'unit', unit: { id: data.id, t: data.t, c: data.c } };
      }
    } catch {
      return null;
    }
  } else if (syncMatch) {
    try {
      const data = decodeShareData<{ units?: DictationUnit[]; activeId?: string; rewards?: Partial<RewardsState> }>(
        syncMatch[1]
      );
      if (data && Array.isArray(data.units) && data.units.length > 0) {
        return {
          kind: 'all',
          all: { units: data.units, activeId: data.activeId, rewards: data.rewards },
        };
      }
    } catch {
      return null;
    }
  }
  return null;
}
