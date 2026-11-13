import React, { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, Volume2 } from 'lucide-react';
import { GRAMMAR_DECOYS } from '../constants/dictationData';
import { AccentOption, WordItem } from '../types/dictation';
import {
  playErrorSound,
  playPopSound,
  playSuccessSound,
  speakSentenceInChunks,
  speakText,
  stopAllSpeech,
} from '../utils/audio';
import { extractKeywordsFromSentences, generateSpellingDecoys, shuffleArray } from '../utils/parser';

interface GameCallbacks {
  accent: AccentOption;
  autoPlay: boolean;
  sfxEnabled: boolean;
  onConfetti: (count: number) => void;
  onProgressLabel: (label: string) => void;
  onFinish: (title: string, desc: string) => void;
}

// ==========================================
// 1. 積木砌一砌 (Scramble Game)
// ==========================================
interface ScrambleSlot {
  type: 'slot' | 'fixed';
  expected?: string;
  char?: string;
  placedTileId: number | null;
}

interface ScrambleTile {
  id: number;
  text: string;
  used: boolean;
}

export const ScrambleGame: React.FC<GameCallbacks & { queue: WordItem[] }> = ({
  queue,
  accent,
  autoPlay,
  sfxEnabled,
  onConfetti,
  onProgressLabel,
  onFinish,
}) => {
  const [idx, setIdx] = useState(0);
  const [firstTryHits, setFirstTryHits] = useState(0);
  const [mode, setMode] = useState<'letter' | 'word'>('letter');
  const [slots, setSlots] = useState<ScrambleSlot[]>([]);
  const [tiles, setTiles] = useState<ScrambleTile[]>([]);
  const [hadMistake, setHadMistake] = useState(false);
  const [locked, setLocked] = useState(false);
  const [validated, setValidated] = useState<boolean | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const timerRef = useRef<number | null>(null);

  const currentItem = queue[idx];

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      stopAllSpeech();
    };
  }, []);

  useEffect(() => {
    if (!currentItem) return;
    onProgressLabel(`第 ${idx + 1} / ${queue.length} 題`);
    setHadMistake(false);
    setLocked(false);
    setValidated(null);

    if (currentItem.type === 'sentence') {
      let clean = currentItem.en.trim();
      let endPunct = '';
      if (/[.?!]$/.test(clean)) {
        endPunct = clean.slice(-1);
        clean = clean.slice(0, -1).trim();
      }
      const words = clean.split(/\s+/);
      const nextSlots: ScrambleSlot[] = words.map((w) => ({
        type: 'slot',
        expected: w,
        placedTileId: null,
      }));
      if (endPunct) {
        nextSlots.push({ type: 'fixed', char: endPunct, placedTileId: null });
      }
      setMode('word');
      setSlots(nextSlots);
      setTiles(shuffleArray(words).map((w, i) => ({ id: i, text: w, used: false })));
    } else {
      const letterChars: string[] = [];
      const nextSlots: ScrambleSlot[] = Array.from(currentItem.en).map((ch) => {
        if (/[a-zA-Z]/.test(ch)) {
          letterChars.push(ch);
          return { type: 'slot', expected: ch, placedTileId: null };
        }
        return { type: 'fixed', char: ch, placedTileId: null };
      });
      setMode('letter');
      setSlots(nextSlots);
      setTiles(shuffleArray(letterChars).map((ch, i) => ({ id: i, text: ch, used: false })));
    }

    if (autoPlay) {
      const t = window.setTimeout(() => {
        if (currentItem.type === 'sentence') speakSentenceInChunks(currentItem.en, accent);
        else speakText(currentItem.en, accent, 1.0);
      }, 240);
      return () => window.clearTimeout(t);
    }
  }, [idx, currentItem, queue.length, autoPlay, accent, onProgressLabel]);

  if (!currentItem) return null;

  const nextEmptyIdx = slots.findIndex((s) => s.type === 'slot' && s.placedTileId === null);

  const handleTapTile = (tileId: number) => {
    if (locked) return;
    const tile = tiles.find((t) => t.id === tileId);
    if (!tile || tile.used || nextEmptyIdx === -1) return;

    playPopSound(sfxEnabled);
    const updatedTiles = tiles.map((t) => (t.id === tileId ? { ...t, used: true } : t));
    const updatedSlots = slots.map((s, i) =>
      i === nextEmptyIdx ? { ...s, placedTileId: tileId } : s
    );

    setTiles(updatedTiles);
    setSlots(updatedSlots);
    setValidated(null);

    const allFilled = !updatedSlots.some((s) => s.type === 'slot' && s.placedTileId === null);
    if (allFilled) {
      const isAllMatch = updatedSlots.every((s) => {
        if (s.type !== 'slot') return true;
        const placedText = updatedTiles.find((t) => t.id === s.placedTileId)?.text ?? '';
        return mode === 'word'
          ? placedText === s.expected
          : placedText.toLowerCase() === (s.expected ?? '').toLowerCase();
      });

      setValidated(isAllMatch);
      if (isAllMatch) {
        setLocked(true);
        const nextHits = !hadMistake ? firstTryHits + 1 : firstTryHits;
        if (!hadMistake) setFirstTryHits(nextHits);
        playSuccessSound(sfxEnabled);
        onConfetti(22);
        speakText(currentItem.en, accent, 1.0);

        timerRef.current = window.setTimeout(() => {
          if (idx + 1 < queue.length) {
            setIdx((prev) => prev + 1);
          } else {
            onFinish(
              '積木砌砌樂完成！',
              `一共完成 ${queue.length} 題，其中 ${nextHits} 題一次過關！`
            );
          }
        }, 1400);
      } else {
        setHadMistake(true);
        setShakeKey((k) => k + 1);
        playErrorSound(sfxEnabled);
      }
    }
  };

  const handleRemoveSlot = (slotIdx: number) => {
    if (locked) return;
    const slot = slots[slotIdx];
    if (!slot || slot.type !== 'slot' || slot.placedTileId === null) return;
    playPopSound(sfxEnabled);
    const removedId = slot.placedTileId;
    setTiles((prev) => prev.map((t) => (t.id === removedId ? { ...t, used: false } : t)));
    setSlots((prev) => prev.map((s, i) => (i === slotIdx ? { ...s, placedTileId: null } : s)));
    setValidated(null);
  };

  const handleReset = () => {
    if (locked) return;
    playPopSound(sfxEnabled);
    setTiles((prev) => prev.map((t) => ({ ...t, used: false })));
    setSlots((prev) =>
      prev.map((s) => (s.type === 'slot' ? { ...s, placedTileId: null } : s))
    );
    setValidated(null);
  };

  return (
    <div className="text-center">
      <p className="text-xs font-bold text-slate-500">
        {mode === 'word' ? '句子排排坐 · 順序撳下面啲詞語砌返成句' : '字母積木 · 聽住讀音順序砌出英文'}
      </p>

      {currentItem.zh && (
        <h3 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{currentItem.zh}</h3>
      )}

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => speakText(currentItem.en, accent, 1.0)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-sky-700 whitespace-nowrap shrink-0"
        >
          <Volume2 className="h-4 w-4" />
          讀音
        </button>
        {mode === 'word' ? (
          <button
            type="button"
            onClick={() => speakSentenceInChunks(currentItem.en, accent)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            分段慢讀
          </button>
        ) : (
          <button
            type="button"
            onClick={() => speakText(currentItem.en, accent, 0.65)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            🐢 慢讀
          </button>
        )}
        <button
          type="button"
          onClick={handleReset}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          <RotateCcw className="h-4 w-4" />
          清空重砌
        </button>
      </div>

      {/* Slots */}
      <div
        key={shakeKey}
        className={`mx-auto mt-6 flex min-h-20 max-w-3xl flex-wrap items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-4 ${
          validated === false ? 'animate-shake' : ''
        }`}
      >
        {slots.map((s, slotIdx) => {
          if (s.type === 'fixed') {
            if (s.char === ' ') return <div key={slotIdx} className="w-4" />;
            return (
              <span key={slotIdx} className="px-1 text-2xl font-bold text-slate-700">
                {s.char}
              </span>
            );
          }

          const tile = s.placedTileId !== null ? tiles.find((t) => t.id === s.placedTileId) : null;
          const isCursor = slotIdx === nextEmptyIdx;
          const isSlotMatch =
            validated !== null && tile
              ? mode === 'word'
                ? tile.text === s.expected
                : tile.text.toLowerCase() === (s.expected ?? '').toLowerCase()
              : null;

          let stateCls = 'border-slate-300 bg-white text-teal-900';
          if (isSlotMatch === true) {
            stateCls = 'border-emerald-500 bg-emerald-50 text-emerald-900';
          } else if (isSlotMatch === false) {
            stateCls = 'border-rose-500 bg-rose-50 text-rose-900';
          } else if (tile) {
            stateCls = 'border-sky-500 bg-sky-50 text-sky-900 shadow-xs';
          } else if (isCursor) {
            stateCls = 'border-amber-500 bg-amber-50/70 ring-2 ring-amber-300/60';
          }

          return (
            <button
              key={slotIdx}
              type="button"
              onClick={() => handleRemoveSlot(slotIdx)}
              className={`flex items-center justify-center rounded-xl border-2 font-bold transition-transform select-none ${stateCls} ${
                mode === 'word'
                  ? 'min-h-12 min-w-[72px] px-3 text-base'
                  : 'h-13 min-w-[46px] px-2 text-2xl'
              }`}
            >
              {tile ? tile.text : ''}
            </button>
          );
        })}
      </div>

      {/* Tile Pool */}
      <div className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2.5">
        {tiles.map((t) => (
          <button
            key={t.id}
            type="button"
            disabled={t.used || locked}
            onClick={() => handleTapTile(t.id)}
            className={`rounded-xl border-2 border-amber-300 bg-amber-50 font-bold text-amber-950 shadow-xs transition-all select-none ${
              mode === 'word'
                ? 'min-h-12 min-w-[68px] px-4 text-base'
                : 'h-13 min-w-[50px] px-3 text-2xl'
            } ${
              t.used
                ? 'scale-90 opacity-20 cursor-default'
                : 'hover:-translate-y-0.5 hover:bg-amber-100 active:translate-y-0.5 cursor-pointer'
            }`}
          >
            {t.text}
          </button>
        ))}
      </div>

      <div className="mt-5 min-h-7 text-base font-bold">
        {validated === true && <span className="text-emerald-700">✓ 好叻呀！完全砌啱晒！</span>}
        {validated === false && (
          <span className="text-rose-600">✕ 紅色嗰幾個位唔係好啱，撳返佢落嚟調位再試！</span>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 2. 捉返走失嘅字 (Missing Game)
// ==========================================
interface MissingWordToken {
  word: string;
  punct: string;
}

export const MissingGame: React.FC<GameCallbacks & { queue: WordItem[] }> = ({
  queue,
  accent,
  autoPlay,
  sfxEnabled,
  onConfetti,
  onProgressLabel,
  onFinish,
}) => {
  const [idx, setIdx] = useState(0);
  const [firstTryHits, setFirstTryHits] = useState(0);
  const [mode, setMode] = useState<'letter' | 'word'>('letter');
  const [wordTokens, setWordTokens] = useState<MissingWordToken[]>([]);
  const [charTokens, setCharTokens] = useState<string[]>([]);
  const [blankIndices, setBlankIndices] = useState<number[]>([]);
  const [solvedMap, setSolvedMap] = useState<Record<number, string>>({});
  const [currentBlankPos, setCurrentBlankPos] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [hadMistake, setHadMistake] = useState(false);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const timerRef = useRef<number | null>(null);

  const currentItem = queue[idx];

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      stopAllSpeech();
    };
  }, []);

  useEffect(() => {
    if (!currentItem) return;
    onProgressLabel(`第 ${idx + 1} / ${queue.length} 題`);
    setSolvedMap({});
    setCurrentBlankPos(0);
    setHadMistake(false);
    setLocked(false);
    setFeedback(null);

    if (currentItem.type === 'sentence') {
      const parsedTokens: MissingWordToken[] = currentItem.en
        .trim()
        .split(/\s+/)
        .map((tok) => {
          const m = tok.match(/^([a-zA-Z']+)(.*)$/);
          return m ? { word: m[1], punct: m[2] } : { word: tok, punct: '' };
        });
      const prio: number[] = [];
      const fall: number[] = [];
      parsedTokens.forEach((t, i) => {
        if (GRAMMAR_DECOYS[t.word.toLowerCase()] || t.word.length >= 5) prio.push(i);
        else if (t.word.length >= 2) fall.push(i);
      });
      const hideCount = Math.min(3, Math.max(2, Math.floor(parsedTokens.length / 4)));
      const blanks = [...shuffleArray(prio), ...shuffleArray(fall)]
        .slice(0, hideCount)
        .sort((a, b) => a - b);

      const needed = blanks.map((i) => parsedTokens[i].word);
      const optSet = new Set(needed);
      for (const w of needed) {
        for (const d of GRAMMAR_DECOYS[w.toLowerCase()] || []) {
          if (optSet.size < needed.length + 3) optSet.add(d);
        }
      }
      for (const ex of shuffleArray(['have', 'has', 'want', 'wants', 'because', 'so', 'go', 'take'])) {
        if (optSet.size < needed.length + 3) optSet.add(ex);
      }

      setMode('word');
      setWordTokens(parsedTokens);
      setBlankIndices(blanks);
      setOptions(shuffleArray(Array.from(optSet)));
    } else {
      const chars = Array.from(currentItem.en);
      const lIdx: number[] = [];
      const vIdx: number[] = [];
      chars.forEach((ch, i) => {
        if (/[a-zA-Z]/.test(ch)) {
          lIdx.push(i);
          if (/[aeiouAEIOU]/.test(ch)) vIdx.push(i);
        }
      });
      const hideCount = lIdx.length >= 7 ? 3 : lIdx.length >= 4 ? 2 : 1;
      const blanks = [...shuffleArray(vIdx), ...shuffleArray(lIdx.filter((i) => !vIdx.includes(i)))]
        .slice(0, hideCount)
        .sort((a, b) => a - b);
      const needed = blanks.map((i) => chars[i]);
      const optSet = new Set(needed.map((c) => c.toLowerCase()));
      const optChars = [...needed];
      const decoySrc = 'aeiourstlndmpbc';
      let safety = 0;
      while (optChars.length < Math.min(8, needed.length + 4) && safety++ < 40) {
        const rc = decoySrc[Math.floor(Math.random() * decoySrc.length)];
        if (!optSet.has(rc)) {
          optSet.add(rc);
          optChars.push(rc);
        }
      }

      setMode('letter');
      setCharTokens(chars);
      setBlankIndices(blanks);
      setOptions(shuffleArray(optChars));
    }

    if (autoPlay) {
      const t = window.setTimeout(() => {
        if (currentItem.type === 'sentence') speakSentenceInChunks(currentItem.en, accent);
        else speakText(currentItem.en, accent, 1.0);
      }, 240);
      return () => window.clearTimeout(t);
    }
  }, [idx, currentItem, queue.length, autoPlay, accent, onProgressLabel]);

  if (!currentItem) return null;

  const activeBlankIdx = blankIndices[currentBlankPos];

  const handleTapOption = (chosen: string) => {
    if (locked || activeBlankIdx === undefined) return;
    const expected =
      mode === 'word' ? wordTokens[activeBlankIdx].word : charTokens[activeBlankIdx];

    if (chosen.toLowerCase() === expected.toLowerCase()) {
      playPopSound(sfxEnabled);
      const nextSolved = { ...solvedMap, [activeBlankIdx]: expected };
      const nextPos = currentBlankPos + 1;
      setSolvedMap(nextSolved);
      setCurrentBlankPos(nextPos);
      setFeedback(null);

      if (nextPos >= blankIndices.length) {
        setLocked(true);
        const nextHits = !hadMistake ? firstTryHits + 1 : firstTryHits;
        if (!hadMistake) setFirstTryHits(nextHits);
        playSuccessSound(sfxEnabled);
        onConfetti(20);
        setFeedback({ ok: true, msg: '✓ 補齊晒啦！好眼力！' });
        speakText(currentItem.en, accent, 1.0);

        timerRef.current = window.setTimeout(() => {
          if (idx + 1 < queue.length) setIdx((p) => p + 1);
          else {
            onFinish(
              '捉字任務完成！',
              `全部 ${queue.length} 題都補完好啦（一次答中 ${nextHits} 題）！`
            );
          }
        }, 1350);
      }
    } else {
      setHadMistake(true);
      setShakeKey((k) => k + 1);
      playErrorSound(sfxEnabled);
      setFeedback({
        ok: false,
        msg:
          mode === 'word'
            ? '✕ 唔係呢個字呀，留意 Grammar 同讀音再揀過！'
            : '✕ 唔係呢粒呀，聽多一次讀音再揀過！',
      });
    }
  };

  return (
    <div className="text-center">
      <p className="text-xs font-bold text-slate-500">
        {mode === 'word'
          ? '句子大填空 · 幫發光空位搵返啱嘅生字或動詞'
          : '字母補漏 · 幫發光空位搵返走失咗嘅字母'}
      </p>

      {currentItem.zh && (
        <h3 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{currentItem.zh}</h3>
      )}

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={() => speakText(currentItem.en, accent, 1.0)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-sky-700 whitespace-nowrap shrink-0"
        >
          <Volume2 className="h-4 w-4" />
          讀音
        </button>
        {mode === 'word' ? (
          <button
            type="button"
            onClick={() => speakSentenceInChunks(currentItem.en, accent)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            分段慢讀
          </button>
        ) : (
          <button
            type="button"
            onClick={() => speakText(currentItem.en, accent, 0.65)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            🐢 慢讀
          </button>
        )}
      </div>

      {/* Display Box */}
      <div
        key={shakeKey}
        className={`mx-auto mt-6 flex max-w-3xl flex-wrap items-center justify-center gap-1.5 rounded-2xl border-2 border-amber-200 bg-amber-50/40 p-5 leading-relaxed ${
          feedback && !feedback.ok ? 'animate-shake' : ''
        }`}
      >
        {mode === 'word'
          ? wordTokens.map((tok, i) => {
              if (!blankIndices.includes(i)) {
                return (
                  <span key={i} className="px-1 text-xl font-bold text-slate-800">
                    {tok.word + tok.punct}
                  </span>
                );
              }
              const solved = solvedMap[i] !== undefined;
              const isCurr = i === activeBlankIdx && !solved;
              return (
                <span key={i} className="inline-flex items-center">
                  <span
                    className={`inline-flex min-h-11 min-w-[88px] items-center justify-center rounded-xl border-2 px-3 text-lg font-bold ${
                      solved
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                        : isCurr
                        ? 'border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-300/60'
                        : 'border-dashed border-amber-400 bg-white text-slate-400'
                    }`}
                  >
                    {solved ? solvedMap[i] : '____'}
                  </span>
                  {tok.punct && (
                    <span className="pl-0.5 text-xl font-bold text-slate-800">{tok.punct}</span>
                  )}
                </span>
              );
            })
          : charTokens.map((ch, i) => {
              if (ch === ' ') return <div key={i} className="w-4" />;
              if (!blankIndices.includes(i)) {
                return (
                  <span
                    key={i}
                    className="inline-flex h-12 min-w-[26px] items-center justify-center text-3xl font-bold text-slate-800"
                  >
                    {ch}
                  </span>
                );
              }
              const solved = solvedMap[i] !== undefined;
              const isCurr = i === activeBlankIdx && !solved;
              return (
                <span
                  key={i}
                  className={`mx-0.5 inline-flex h-12 min-w-[46px] items-center justify-center rounded-xl border-2 px-2 text-2xl font-bold ${
                    solved
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                      : isCurr
                      ? 'border-rose-500 bg-rose-50 text-rose-700 ring-2 ring-rose-300/60'
                      : 'border-dashed border-amber-400 bg-white text-slate-400'
                  }`}
                >
                  {solved ? solvedMap[i] : '_'}
                </span>
              );
            })}
      </div>

      {/* Options */}
      <div className="mx-auto mt-6 flex max-w-2xl flex-wrap justify-center gap-2.5">
        {options.map((opt, oIdx) => (
          <button
            key={`${opt}-${oIdx}`}
            type="button"
            disabled={locked}
            onClick={() => handleTapOption(opt)}
            className={`rounded-xl border-2 border-amber-300 bg-amber-50 font-bold text-amber-950 shadow-xs transition-all hover:-translate-y-0.5 hover:bg-amber-100 active:translate-y-0.5 cursor-pointer select-none ${
              mode === 'word'
                ? 'min-h-12 min-w-[72px] px-4 text-base'
                : 'h-13 min-w-[52px] px-3 text-2xl'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      <div className="mt-5 min-h-7 text-base font-bold">
        {feedback && (
          <span className={feedback.ok ? 'text-emerald-700' : 'text-rose-600'}>
            {feedback.msg}
          </span>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 3. 邊個先係真身？ (Balloon Game)
// ==========================================
interface BalloonChoice {
  text: string;
  isCorrect: boolean;
  eliminated: boolean;
}

export const BalloonGame: React.FC<GameCallbacks & { queue: WordItem[] }> = ({
  queue,
  accent,
  autoPlay,
  sfxEnabled,
  onConfetti,
  onProgressLabel,
  onFinish,
}) => {
  const [idx, setIdx] = useState(0);
  const [firstTryHits, setFirstTryHits] = useState(0);
  const [choices, setChoices] = useState<BalloonChoice[]>([]);
  const [hadMistake, setHadMistake] = useState(false);
  const [locked, setLocked] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; msg: string } | null>(null);
  const timerRef = useRef<number | null>(null);

  const currentItem = queue[idx];

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      stopAllSpeech();
    };
  }, []);

  useEffect(() => {
    if (!currentItem) return;
    onProgressLabel(`第 ${idx + 1} / ${queue.length} 題`);
    setHadMistake(false);
    setLocked(false);
    setFeedback(null);

    const decoys = generateSpellingDecoys(currentItem.en).map((d) => ({
      text: d,
      isCorrect: false,
      eliminated: false,
    }));
    setChoices(
      shuffleArray([{ text: currentItem.en, isCorrect: true, eliminated: false }, ...decoys])
    );

    if (autoPlay) {
      const t = window.setTimeout(() => speakText(currentItem.en, accent, 1.0), 220);
      return () => window.clearTimeout(t);
    }
  }, [idx, currentItem, queue.length, autoPlay, accent, onProgressLabel]);

  if (!currentItem) return null;

  const handleTapBalloon = (cIdx: number) => {
    if (locked) return;
    const choice = choices[cIdx];
    if (!choice || choice.eliminated) return;

    if (choice.isCorrect) {
      setLocked(true);
      const nextHits = !hadMistake ? firstTryHits + 1 : firstTryHits;
      if (!hadMistake) setFirstTryHits(nextHits);
      playSuccessSound(sfxEnabled);
      onConfetti(22);
      setFeedback({ ok: true, msg: '✓ 眼明手快！捉到真身啦！' });
      speakText(currentItem.en, accent, 1.0);

      timerRef.current = window.setTimeout(() => {
        if (idx + 1 < queue.length) setIdx((p) => p + 1);
        else {
          onFinish(
            '火眼金睛挑戰完成！',
            `一共捉到 ${queue.length} 個真身氣球（一次答中 ${nextHits} 題）！`
          );
        }
      }, 1200);
    } else {
      setHadMistake(true);
      playErrorSound(sfxEnabled);
      setChoices((prev) =>
        prev.map((c, i) => (i === cIdx ? { ...c, eliminated: true } : c))
      );
      setFeedback({ ok: false, msg: '✕ 呢個係假氣球呀，睇清楚字母再揀過！' });
    }
  };

  const balloonStyles = [
    'border-rose-300 bg-rose-50/80 hover:bg-rose-100',
    'border-sky-300 bg-sky-50/80 hover:bg-sky-100',
    'border-amber-300 bg-amber-50/80 hover:bg-amber-100',
    'border-teal-300 bg-teal-50/80 hover:bg-teal-100',
  ];

  return (
    <div className="text-center">
      <p className="text-xs font-bold text-slate-500">
        邊個氣球先係串啱咗嘅「真身」？快啲撳爆佢
      </p>

      {currentItem.zh && (
        <h3 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">{currentItem.zh}</h3>
      )}

      <div className="mt-4 flex justify-center gap-2">
        <button
          type="button"
          onClick={() => speakText(currentItem.en, accent, 1.0)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-sky-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-sky-700 whitespace-nowrap shrink-0"
        >
          <Volume2 className="h-4 w-4" />
          讀音
        </button>
        <button
          type="button"
          onClick={() => speakText(currentItem.en, accent, 0.65)}
          className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
        >
          🐢 慢讀
        </button>
      </div>

      <div className="mx-auto mt-6 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
        {choices.map((c, cIdx) => {
          const isWon = locked && c.isCorrect;
          return (
            <button
              key={`${c.text}-${cIdx}`}
              type="button"
              disabled={c.eliminated || locked}
              onClick={() => handleTapBalloon(cIdx)}
              className={`min-h-20 rounded-3xl border-2 px-5 py-4 text-xl font-bold break-words transition-all select-none ${
                isWon
                  ? 'scale-105 border-emerald-500 bg-emerald-50 text-emerald-900 shadow-sm'
                  : c.eliminated
                  ? 'animate-shake scale-95 border-slate-200 bg-slate-100 text-slate-400 line-through opacity-45 cursor-not-allowed'
                  : `${balloonStyles[cIdx % 4]} text-slate-900 shadow-xs hover:-translate-y-0.5 cursor-pointer`
              }`}
            >
              {isWon ? `💥 ${c.text}` : `🎈 ${c.text}`}
            </button>
          );
        })}
      </div>

      <div className="mt-5 min-h-7 text-base font-bold">
        {feedback && (
          <span className={feedback.ok ? 'text-emerald-700' : 'text-rose-600'}>
            {feedback.msg}
          </span>
        )}
      </div>
    </div>
  );
};

// ==========================================
// 4. 聲音記憶翻翻樂 (Memory Game)
// ==========================================
interface MemCard {
  uid: number;
  pairId: number;
  type: 'en' | 'zh' | 'audio';
  text: string;
  en: string;
  flipped: boolean;
  matched: boolean;
}

export const MemoryGame: React.FC<
  Omit<GameCallbacks, 'autoPlay'> & { pool: WordItem[] }
> = ({ pool, accent, sfxEnabled, onProgressLabel, onFinish }) => {
  const initialData = useMemo(() => {
    const phrases = pool.filter((x) => x.type === 'phrase');
    const keywords = extractKeywordsFromSentences(pool.filter((x) => x.type === 'sentence'));
    const existingLower = new Set(phrases.map((p) => p.en.toLowerCase()));
    const memPool = [...phrases, ...keywords.filter((k) => !existingLower.has(k.en.toLowerCase()))];
    const chosen = shuffleArray(memPool.length > 0 ? memPool : pool).slice(
      0,
      Math.min(memPool.length || pool.length, 6)
    );
    const raw: Omit<MemCard, 'uid'>[] = [];
    chosen.forEach((item, pairId) => {
      const hasRealZh = Boolean(item.zh && item.zh !== '（句子重點生字）');
      raw.push({ pairId, type: 'en', text: item.en, en: item.en, flipped: false, matched: false });
      raw.push(
        hasRealZh
          ? { pairId, type: 'zh', text: item.zh, en: item.en, flipped: false, matched: false }
          : {
              pairId,
              type: 'audio',
              text: '🔊 聽讀音配對',
              en: item.en,
              flipped: false,
              matched: false,
            }
      );
    });
    return {
      totalPairs: chosen.length,
      cards: shuffleArray(raw).map((c, uid) => ({ ...c, uid })),
    };
  }, [pool]);

  const [cards, setCards] = useState<MemCard[]>(initialData.cards);
  const [flippedUids, setFlippedUids] = useState<number[]>([]);
  const [matchedPairs, setMatchedPairs] = useState(0);
  const [moves, setMoves] = useState(0);
  const [locked, setLocked] = useState(false);
  const [msg, setMsg] = useState('');
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    onProgressLabel(`已配對 ${matchedPairs} / ${initialData.totalPairs} 對`);
  }, [matchedPairs, initialData.totalPairs, onProgressLabel]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => window.clearTimeout(t));
      stopAllSpeech();
    };
  }, []);

  const handleFlip = (uid: number) => {
    if (locked) return;
    const card = cards.find((c) => c.uid === uid);
    if (!card || card.flipped || card.matched) return;

    if (card.type === 'en' || card.type === 'audio') {
      speakText(card.en, accent, 1.0);
    } else {
      playPopSound(sfxEnabled);
    }

    const nextCards = cards.map((c) => (c.uid === uid ? { ...c, flipped: true } : c));
    const nextFlipped = [...flippedUids, uid];
    setCards(nextCards);
    setFlippedUids(nextFlipped);

    if (nextFlipped.length === 2) {
      const nextMoves = moves + 1;
      setMoves(nextMoves);
      setLocked(true);

      const [u1, u2] = nextFlipped;
      const c1 = nextCards.find((c) => c.uid === u1)!;
      const c2 = nextCards.find((c) => c.uid === u2)!;

      if (c1.pairId === c2.pairId) {
        const nextMatched = matchedPairs + 1;
        const t1 = window.setTimeout(() => {
          setCards((prev) =>
            prev.map((c) => (c.uid === u1 || c.uid === u2 ? { ...c, matched: true } : c))
          );
          setMatchedPairs(nextMatched);
          setFlippedUids([]);
          setMsg(`配對成功！（步數：${nextMoves}）`);
          playSuccessSound(sfxEnabled);
          setLocked(false);

          if (nextMatched === initialData.totalPairs) {
            const t2 = window.setTimeout(() => {
              onFinish(
                '記憶翻翻樂過關！',
                `你用咗 ${nextMoves} 步就配對晒全部 ${initialData.totalPairs} 對生字！`
              );
            }, 650);
            timersRef.current.push(t2);
          }
        }, 300);
        timersRef.current.push(t1);
      } else {
        const t1 = window.setTimeout(() => {
          setCards((prev) =>
            prev.map((c) => (c.uid === u1 || c.uid === u2 ? { ...c, flipped: false } : c))
          );
          setFlippedUids([]);
          setMsg(`再試下記住佢哋嘅位置（步數：${nextMoves}）`);
          setLocked(false);
        }, 900);
        timersRef.current.push(t1);
      }
    }
  };

  return (
    <div className="text-center">
      <p className="text-xs font-bold text-slate-500">
        翻開兩張卡片，將英文同意思（或讀音）配成一對
      </p>

      <div className="mx-auto mt-5 grid max-w-2xl grid-cols-3 gap-2.5 sm:grid-cols-4 sm:gap-3">
        {cards.map((c) => {
          const isOpen = c.flipped || c.matched;
          return (
            <button
              key={c.uid}
              type="button"
              onClick={() => handleFlip(c.uid)}
              className="mem-perspective aspect-4/3 min-h-[84px] w-full cursor-pointer select-none"
            >
              <div className={`mem-card-inner ${isOpen ? 'is-flipped' : ''}`}>
                <div className="mem-face flex items-center justify-center rounded-2xl border-2 border-teal-500 bg-teal-600 text-2xl font-bold text-white shadow-xs">
                  ?
                </div>
                <div
                  className={`mem-face mem-back flex flex-col items-center justify-center rounded-2xl border-2 p-2 text-center font-bold break-words ${
                    c.matched
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                      : c.type === 'audio'
                      ? 'border-sky-400 bg-sky-50 text-sky-900'
                      : 'border-sky-300 bg-white text-slate-900'
                  }`}
                >
                  <span className="text-sm leading-tight sm:text-base">{c.text}</span>
                  {c.type === 'en' && (
                    <span className="mt-1 text-[11px] font-semibold text-sky-600">🔊</span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 min-h-6 text-sm font-bold text-teal-800 tabular-nums">
        {msg || `翻開步數：${moves}`}
      </div>
    </div>
  );
};
