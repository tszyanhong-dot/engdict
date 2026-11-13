import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Gamepad2, Lightbulb, RotateCcw, Volume2 } from 'lucide-react';
import { PRAISE_WORDS } from '../constants/dictationData';
import {
  AppSettings,
  DiffToken,
  QuizResultItem,
  RewardGrant,
  ScopeType,
  WordItem,
} from '../types/dictation';
import {
  playErrorSound,
  playFanfareSound,
  playPopSound,
  playSuccessSound,
  speakSentenceInChunks,
  speakText,
  stopAllSpeech,
} from '../utils/audio';
import { buildWordDiff, shuffleArray } from '../utils/parser';

interface QuizViewProps {
  unitTitle: string;
  wordList: WordItem[];
  settings: AppSettings;
  sfxEnabled: boolean;
  onGrantReward: (stars: number, unlockSticker: boolean) => RewardGrant;
  onConfetti: (count: number) => void;
  onGoSetup: () => void;
  onGoPlayground: () => void;
  onToast: (msg: string) => void;
}

export const QuizView: React.FC<QuizViewProps> = ({
  unitTitle,
  wordList,
  settings,
  sfxEnabled,
  onGrantReward,
  onConfetti,
  onGoSetup,
  onGoPlayground,
  onToast,
}) => {
  const [scope, setScope] = useState<ScopeType>('all');
  const [mistakesOnlyMode, setMistakesOnlyMode] = useState(false);
  const [queue, setQueue] = useState<WordItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [isAnswered, setIsAnswered] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [praiseText, setPraiseText] = useState('');
  const [diffTokens, setDiffTokens] = useState<DiffToken[]>([]);
  const [hintLevel, setHintLevel] = useState(0);
  const [hintText, setHintText] = useState('');
  const [results, setResults] = useState<QuizResultItem[]>([]);
  const [wrongWords, setWrongWords] = useState<WordItem[]>([]);
  const [showSummary, setShowSummary] = useState(false);
  const [summaryReward, setSummaryReward] = useState<RewardGrant | null>(null);
  const [shakeKey, setShakeKey] = useState(0);

  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const startSession = useCallback(
    (onlyMistakes: boolean, targetScope: ScopeType, customWrongList?: WordItem[]) => {
      stopAllSpeech();

      const filtered =
        targetScope === 'phrase'
          ? wordList.filter((w) => w.type === 'phrase')
          : targetScope === 'sentence'
          ? wordList.filter((w) => w.type === 'sentence')
          : wordList;

      let source = onlyMistakes ? customWrongList ?? wrongWords : filtered;
      let nextScope = targetScope;

      if (!onlyMistakes && source.length === 0) {
        source = wordList;
        nextScope = 'all';
        setScope('all');
      }

      if (source.length === 0) {
        onToast('呢個單元未有生字，請先喺「生字簿」輸入！');
        onGoSetup();
        return;
      }

      const nextQueue = settings.shuffle ? shuffleArray(source) : [...source];
      setScope(nextScope);
      setMistakesOnlyMode(onlyMistakes);
      setQueue(nextQueue);
      setCurrentIndex(0);
      setScore(0);
      setUserAnswer('');
      setIsAnswered(false);
      setLastCorrect(null);
      setDiffTokens([]);
      setHintLevel(0);
      setHintText('');
      setResults([]);
      setWrongWords([]);
      setShowSummary(false);
      setSummaryReward(null);
    },
    [wordList, wrongWords, settings.shuffle, onToast, onGoSetup]
  );

  // Initialize quiz when component mounts or unit changes
  useEffect(() => {
    startSession(false, scope);
    return () => stopAllSpeech();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unitTitle, wordList.length]);

  const currentItem = queue[currentIndex];

  // Auto-play audio & focus input when question changes
  useEffect(() => {
    if (showSummary || !currentItem) return;
    setUserAnswer('');
    setIsAnswered(false);
    setLastCorrect(null);
    setDiffTokens([]);
    setHintLevel(0);
    setHintText('');

    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 60);
    let speechTimer: number | undefined;
    if (settings.autoPlay) {
      speechTimer = window.setTimeout(() => {
        if (currentItem.type === 'sentence') {
          speakSentenceInChunks(currentItem.en, settings.accent);
        } else {
          speakText(currentItem.en, settings.accent, 1.0);
        }
      }, 260);
    }

    return () => {
      window.clearTimeout(focusTimer);
      if (speechTimer) window.clearTimeout(speechTimer);
    };
  }, [currentIndex, queue, showSummary, currentItem, settings.autoPlay, settings.accent]);

  const handleScopeChange = (nextScope: ScopeType) => {
    playPopSound(sfxEnabled);
    startSession(false, nextScope);
  };

  const handleShowHint = () => {
    if (!currentItem) return;
    const nextLevel = hintLevel + 1;
    setHintLevel(nextLevel);
    const words = currentItem.en.split(/\s+/);
    const masked =
      currentItem.type === 'sentence'
        ? words
            .map((w, idx) =>
              (nextLevel >= 2 && idx % 2 === 0) || w.length <= 2
                ? w
                : w[0] + ' ' + Array(Math.min(w.length - 1, 4)).fill('_').join('')
            )
            .join('  ')
        : words
            .map((w) => {
              if (w.length <= 1) return w;
              const rc = Math.min(nextLevel, Math.max(1, Math.ceil(w.length / 2)));
              return w.slice(0, rc) + ' ' + Array(w.length - rc).fill('_').join(' ');
            })
            .join('   ');
    setHintText(masked);
    inputRef.current?.focus();
  };

  const handleCheckAnswer = () => {
    if (isAnswered || !currentItem) return;
    stopAllSpeech();

    const userRaw = userAnswer.trim();
    if (!userRaw) {
      setShakeKey((k) => k + 1);
      inputRef.current?.focus();
      return;
    }

    setIsAnswered(true);
    const isSentence = currentItem.type === 'sentence';
    const target = currentItem.en.trim();
    const strictCheck = isSentence ? settings.sentenceStrict : settings.phraseStrict;
    const normUser = userRaw.replace(/\s+/g, ' ').replace(/\s+([.?!,])/g, '$1');
    const normTarget = target.replace(/\s+/g, ' ');
    const stripPunct = (s: string) => s.replace(/[.?!]+$/, '').toLowerCase();

    const isCorrect = strictCheck
      ? normUser === normTarget
      : isSentence
      ? stripPunct(normUser) === stripPunct(normTarget)
      : normUser.toLowerCase() === normTarget.toLowerCase();

    setLastCorrect(isCorrect);
    if (isCorrect) {
      setScore((s) => s + 1);
      setPraiseText(PRAISE_WORDS[Math.floor(Math.random() * PRAISE_WORDS.length)]);
      playSuccessSound(sfxEnabled);
      onConfetti(28);
    } else {
      setShakeKey((k) => k + 1);
      if (isSentence || target.includes(' ')) {
        setDiffTokens(buildWordDiff(normTarget, normUser, strictCheck));
      } else {
        setDiffTokens([]);
      }
      setWrongWords((prev) => [...prev, currentItem]);
      playErrorSound(sfxEnabled);
    }

    setResults((prev) => [
      ...prev,
      { en: target, zh: currentItem.zh, userAnswer: normUser, isCorrect },
    ]);
  };

  const handleNext = () => {
    stopAllSpeech();
    if (currentIndex + 1 < queue.length) {
      setCurrentIndex((i) => i + 1);
    } else {
      const total = queue.length;
      const percent = Math.round((score / total) * 100);
      if (percent >= 80) {
        playFanfareSound(sfxEnabled);
        onConfetti(percent === 100 ? 60 : 35);
      }
      if (score > 0) {
        const reward = onGrantReward(percent >= 80 ? 3 : 1, percent >= 80);
        setSummaryReward(reward);
      } else {
        setSummaryReward(null);
      }
      setShowSummary(true);
    }
  };

  if (queue.length === 0) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-base font-semibold text-slate-600">
          呢個單元暫時無生字，請先去「生字簿」輸入！
        </p>
        <button
          type="button"
          onClick={onGoSetup}
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-teal-600 px-5 py-2 text-sm font-bold text-white hover:bg-teal-700"
        >
          返回生字簿
        </button>
      </section>
    );
  }

  const total = queue.length;
  const percent = Math.round((score / total) * 100);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-4">
        <span className="text-xs font-semibold text-slate-500">目前單元：{unitTitle}</span>

        {!mistakesOnlyMode && !showSummary && (
          <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
            {(
              [
                { id: 'all', label: '考全部' },
                { id: 'phrase', label: '只考 Part A 詞語' },
                { id: 'sentence', label: '只考 Part B 句子' },
              ] as { id: ScopeType; label: string }[]
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleScopeChange(tab.id)}
                className={`min-h-9 rounded-lg px-3 py-1 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                  scope === tab.id
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {!showSummary && currentItem && (
        <div className="mt-5">
          {/* Progress Header */}
          <div className="flex items-center justify-between text-sm font-bold tabular-nums">
            <span className="text-slate-700">
              第 {currentIndex + 1} / {total} 題
            </span>
            <span className="text-amber-700">⭐ 得分：{score}</span>
          </div>

          <div className="mt-2 h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-teal-600 transition-all duration-300"
              style={{
                width: `${((isAnswered ? currentIndex + 1 : currentIndex) / total) * 100}%`,
              }}
            />
          </div>

          {/* Prompt */}
          <div className="mt-6 text-center">
            <div className="text-xs font-bold text-slate-500">
              {currentItem.type === 'sentence'
                ? 'Part B 句子默寫（留意大楷同句號）'
                : 'Part A 詞語默寫'}
            </div>
            <p className="mt-1 text-sm font-medium text-slate-600">
              {currentItem.type === 'sentence'
                ? '請細心聽老師分段讀出句子，再寫出完整英文句子：'
                : '請聽發音，拼寫出英文詞語：'}
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
              {currentItem.zh || '（請留心聽英文讀音）'}
            </h2>

            {/* Audio Controls */}
            <div className="mt-5 flex flex-wrap justify-center gap-2.5">
              <button
                type="button"
                onClick={() => speakText(currentItem.en, settings.accent, 1.0)}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700 whitespace-nowrap shrink-0"
              >
                <Volume2 className="h-4 w-4" />
                讀出英文
              </button>

              {currentItem.type === 'sentence' ? (
                <button
                  type="button"
                  onClick={() => speakSentenceInChunks(currentItem.en, settings.accent)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  老師分段慢讀
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => speakText(currentItem.en, settings.accent, 0.65)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  🐢 慢讀
                </button>
              )}

              <button
                type="button"
                onClick={handleShowHint}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Lightbulb className="h-4 w-4 text-amber-500" />
                提示
              </button>
            </div>

            {hintText && (
              <div className="font-mono-code mt-4 inline-block max-w-full rounded-xl border border-dashed border-amber-300 bg-amber-50 px-4 py-2 text-lg font-bold tracking-wider text-amber-900">
                {hintText}
              </div>
            )}

            {/* Answer Input */}
            <div key={shakeKey} className={`mx-auto mt-5 max-w-2xl ${!isAnswered && shakeKey > 0 ? 'animate-shake' : ''}`}>
              <textarea
                ref={inputRef}
                value={userAnswer}
                readOnly={isAnswered}
                onChange={(e) => setUserAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!isAnswered) handleCheckAnswer();
                    else handleNext();
                  }
                }}
                rows={currentItem.type === 'sentence' ? 3 : 1}
                placeholder={
                  currentItem.type === 'sentence'
                    ? '喺呢度寫完整英文句子（記得大楷同句號）...'
                    : '喺呢度串字...'
                }
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="done"
                className={`w-full resize-none rounded-2xl border-2 px-4 py-3.5 font-bold transition-colors focus:outline-none ${
                  currentItem.type === 'sentence'
                    ? 'min-h-[108px] text-left text-xl leading-relaxed'
                    : 'text-center text-2xl tracking-wide'
                } ${
                  lastCorrect === true
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                    : lastCorrect === false
                    ? 'animate-shake border-rose-500 bg-rose-50 text-rose-900'
                    : 'border-slate-300 bg-white text-slate-900 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20'
                }`}
              />
            </div>

            {/* Feedback Box */}
            {isAnswered && (
              <div
                className={`animate-pop-in mx-auto mt-4 max-w-2xl rounded-2xl border p-4 text-center ${
                  lastCorrect
                    ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
                    : 'border-rose-300 bg-rose-50 text-rose-900'
                }`}
              >
                <div className="text-lg font-bold">
                  {lastCorrect ? `✓ ${praiseText}` : '✕ 差少少咋，睇下邊度要微調：'}
                </div>

                {lastCorrect ? (
                  <div className="mt-2 inline-block rounded-xl border border-emerald-200 bg-white px-4 py-2 text-lg font-bold text-emerald-800">
                    {currentItem.en}
                  </div>
                ) : (
                  <div className="mt-2 space-y-2.5">
                    {diffTokens.length > 0 && (
                      <div>
                        <div className="text-xs font-bold text-slate-600">逐字對比：</div>
                        <div className="mt-1.5 flex flex-wrap justify-center gap-1.5 rounded-xl border border-rose-200 bg-white p-3">
                          {diffTokens.map((tok, i) => {
                            if (tok.kind === 'ok') {
                              return (
                                <span
                                  key={i}
                                  className="rounded-md bg-emerald-100 px-2 py-0.5 text-sm font-bold text-emerald-900"
                                >
                                  ✓ {tok.text}
                                </span>
                              );
                            }
                            if (tok.kind === 'wrong-sub') {
                              return (
                                <span
                                  key={i}
                                  className="rounded-md bg-rose-100 px-2 py-0.5 text-sm font-bold text-rose-900"
                                >
                                  ✕ {tok.text} → {tok.expected}
                                </span>
                              );
                            }
                            if (tok.kind === 'missing') {
                              return (
                                <span
                                  key={i}
                                  className="rounded-md border border-dashed border-amber-400 bg-amber-50 px-2 py-0.5 text-sm font-bold text-amber-900"
                                >
                                  漏咗：{tok.text}
                                </span>
                              );
                            }
                            return (
                              <span
                                key={i}
                                className="rounded-md bg-rose-100 px-2 py-0.5 text-sm font-bold text-rose-900"
                              >
                                多咗：{tok.text}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-bold text-slate-600">完整正確答案：</div>
                      <div className="mt-1 inline-block rounded-xl border border-sky-200 bg-white px-4 py-2 text-lg font-bold text-sky-900">
                        {currentItem.en}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Submit / Next */}
            <div className="mx-auto mt-5 flex max-w-md justify-center">
              {!isAnswered ? (
                <button
                  type="button"
                  onClick={handleCheckAnswer}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-base font-bold text-white shadow-xs hover:bg-teal-700"
                >
                  <Check className="h-5 w-5" />
                  檢查答案
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleNext}
                  className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-amber-500 px-6 py-3 text-base font-bold text-white shadow-xs hover:bg-amber-600"
                >
                  {currentIndex === total - 1 ? '查看成績單 🏆' : '下一題 →'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Summary View */}
      {showSummary && (
        <div className="py-2 text-center">
          <div className="text-6xl leading-none">
            {percent === 100 ? '🏆' : percent >= 80 ? '🥇' : percent >= 50 ? '🥈' : '🌱'}
          </div>
          <h2 className="mt-3 text-2xl font-bold text-slate-900">
            {percent === 100
              ? '一百分大滿貫！'
              : percent >= 80
              ? '表現非常優秀！'
              : percent >= 50
              ? '做得唔錯呀！'
              : '好嘅開始！'}
          </h2>
          <div className="mt-2 text-3xl font-bold text-teal-700 tabular-nums">
            {score} / {total} 題答對 ({percent}%)
          </div>
          <p className="mt-1.5 text-sm font-medium text-slate-600">
            {percent === 100
              ? '無論詞語定長句子都難唔到你，太犀利啦！'
              : percent >= 80
              ? '就快滿分啦，試下重溫埋錯嗰一兩題！'
              : percent >= 50
              ? '已經掌握超過一半內容，加油再試多一次！'
              : '不如去「溫習遊樂場」玩下積木同填空遊戲再挑戰！'}
          </p>

          {summaryReward && (
            <div className="mx-auto mt-4 max-w-md rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
              默書獎勵：⭐ +{summaryReward.starsEarned} 粒星星
              {summaryReward.newSticker
                ? ` · 解鎖新貼紙：${summaryReward.newSticker.emoji} ${summaryReward.newSticker.name}`
                : ''}
            </div>
          )}

          <div className="mx-auto mt-6 max-w-2xl space-y-2.5 text-left">
            {results.map((r, i) => (
              <div
                key={i}
                className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 ${
                  r.isCorrect
                    ? 'border-slate-200 bg-slate-50/70'
                    : 'border-rose-200 bg-rose-50/70'
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="text-base font-bold text-slate-900">
                    {r.isCorrect ? '✓' : '✕'} {r.en}
                  </div>
                  {r.zh && <div className="mt-0.5 text-xs font-medium text-slate-600">{r.zh}</div>}
                  {!r.isCorrect && (
                    <div className="mt-1 text-xs font-bold text-rose-700">
                      你寫咗：{r.userAnswer}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => speakText(r.en, settings.accent, 1.0)}
                  className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-slate-700 hover:bg-slate-50 shrink-0"
                  aria-label={`讀出 ${r.en}`}
                >
                  <Volume2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          <div className="mx-auto mt-7 flex max-w-xl flex-col gap-3 sm:flex-row">
            {wrongWords.length > 0 && (
              <button
                type="button"
                onClick={() => startSession(true, scope, wrongWords)}
                className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-600 whitespace-nowrap"
              >
                <RotateCcw className="h-4 w-4" />
                只重溫答錯 ({wrongWords.length}題)
              </button>
            )}
            <button
              type="button"
              onClick={() => startSession(false, scope)}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700 whitespace-nowrap"
            >
              <RotateCcw className="h-4 w-4" />
              再默一次
            </button>
            <button
              type="button"
              onClick={onGoPlayground}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Gamepad2 className="h-4 w-4" />
              返遊樂場
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
