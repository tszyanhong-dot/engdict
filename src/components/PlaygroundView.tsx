import React, { useCallback, useState } from 'react';
import { ArrowLeft, BookOpen, Gamepad2, PenLine, RotateCcw, Sparkles, Sticker } from 'lucide-react';
import {
  AccentOption,
  MiniGameType,
  RewardGrant,
  ScopeType,
  WordItem,
} from '../types/dictation';
import { playFanfareSound, playPopSound, stopAllSpeech } from '../utils/audio';
import { extractKeywordsFromSentences, shuffleArray } from '../utils/parser';
import { BalloonGame, MemoryGame, MissingGame, ScrambleGame } from './MiniGames';

interface PlaygroundViewProps {
  unitTitle: string;
  wordList: WordItem[];
  accent: AccentOption;
  autoPlay: boolean;
  sfxEnabled: boolean;
  onOpenQuickStudy: () => void;
  onOpenStickers: () => void;
  onGrantReward: (stars: number, unlockSticker: boolean) => RewardGrant;
  onConfetti: (count: number) => void;
  onGoSetup: () => void;
  onGoQuiz: () => void;
  onToast: (msg: string) => void;
}

type StageView = 'lobby' | 'playing' | 'win';

export const PlaygroundView: React.FC<PlaygroundViewProps> = ({
  unitTitle,
  wordList,
  accent,
  autoPlay,
  sfxEnabled,
  onOpenQuickStudy,
  onOpenStickers,
  onGrantReward,
  onConfetti,
  onGoSetup,
  onGoQuiz,
  onToast,
}) => {
  const [scope, setScope] = useState<ScopeType>('all');
  const [stage, setStage] = useState<StageView>('lobby');
  const [activeGame, setActiveGame] = useState<MiniGameType>('scramble');
  const [gameQueue, setGameQueue] = useState<WordItem[]>([]);
  const [memoryPool, setMemoryPool] = useState<WordItem[]>([]);
  const [gameRunId, setGameRunId] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [winInfo, setWinInfo] = useState<{
    title: string;
    desc: string;
    reward: RewardGrant;
  } | null>(null);

  const getScopedPool = useCallback(
    (s: ScopeType): WordItem[] => {
      if (s === 'phrase') return wordList.filter((w) => w.type === 'phrase');
      if (s === 'sentence') return wordList.filter((w) => w.type === 'sentence');
      return wordList;
    },
    [wordList]
  );

  const handleScopeChange = (nextScope: ScopeType) => {
    setScope(nextScope);
    playPopSound(sfxEnabled);
  };

  const startGame = (type: MiniGameType) => {
    let pool = getScopedPool(scope);
    if (pool.length === 0) {
      pool = wordList;
      setScope('all');
    }
    if (pool.length === 0) {
      onToast('呢個單元暫時無生字，請先喺「生字簿」輸入！');
      onGoSetup();
      return;
    }

    stopAllSpeech();
    setActiveGame(type);
    setGameRunId((r) => r + 1);

    if (type === 'memory') {
      setMemoryPool(pool);
      setStage('playing');
      return;
    }

    if (type === 'balloon') {
      const phrases = pool.filter((x) => x.type === 'phrase');
      const keywords = extractKeywordsFromSentences(pool.filter((x) => x.type === 'sentence'));
      const existingLower = new Set(phrases.map((p) => p.en.toLowerCase()));
      const bPool = [...phrases, ...keywords.filter((k) => !existingLower.has(k.en.toLowerCase()))];
      setGameQueue(shuffleArray(bPool.length > 0 ? bPool : pool).slice(0, 8));
      setStage('playing');
      return;
    }

    setGameQueue(shuffleArray(pool).slice(0, Math.min(pool.length, 8)));
    setStage('playing');
  };

  const handleExitGame = () => {
    stopAllSpeech();
    setStage('lobby');
  };

  const handleFinishGame = useCallback(
    (title: string, desc: string) => {
      stopAllSpeech();
      const reward = onGrantReward(2, true);
      setWinInfo({ title, desc, reward });
      setStage('win');
      playFanfareSound(sfxEnabled);
      onConfetti(45);
    },
    [onGrantReward, onConfetti, sfxEnabled]
  );

  const gameMeta: {
    id: MiniGameType;
    emoji: string;
    title: string;
    desc: string;
    accentCls: string;
  }[] = [
    {
      id: 'scramble',
      emoji: '🧩',
      title: '積木砌一砌',
      desc: '詞語砌字母積木，長句子排詞語次序，邊聽讀音邊記結構',
      accentCls: 'border-sky-200 bg-sky-50/50 hover:border-sky-300',
    },
    {
      id: 'missing',
      emoji: '🕳️',
      title: '捉返走失嘅字',
      desc: '詞語填漏咗嘅字母；句子專門練填入關鍵生字同動詞 +s',
      accentCls: 'border-amber-200 bg-amber-50/50 hover:border-amber-300',
    },
    {
      id: 'balloon',
      emoji: '🎈',
      title: '邊個先係真身？',
      desc: '4 個氣球得 1 個串啱（包括句子難字），快啲篤爆真正嗰個',
      accentCls: 'border-rose-200 bg-rose-50/50 hover:border-rose-300',
    },
    {
      id: 'memory',
      emoji: '🃏',
      title: '聲音記憶翻翻樂',
      desc: '翻開卡片將讀音或中文意思同英文配對，最啱熱身',
      accentCls: 'border-teal-200 bg-teal-50/50 hover:border-teal-300',
    },
  ];

  const gameNames: Record<MiniGameType, string> = {
    scramble: '🧩 積木砌一砌',
    missing: '🕳️ 捉返走失嘅字',
    balloon: '🎈 邊個先係真身？',
    memory: '🃏 聲音記憶翻翻樂',
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      {stage === 'lobby' && (
        <div>
          {/* Clean Header Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
                <span>目前單元：{unitTitle}</span>
                <span aria-hidden="true">·</span>
                <span>過關可抽貼紙</span>
              </div>
              <h2 className="mt-1 text-2xl font-bold text-slate-900">英文串字溫習遊樂場</h2>
              <p className="mt-1 text-sm text-slate-600">
                系統會自動因應「詞語」定「句子」切換玩法，邊玩邊記更入腦
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onOpenQuickStudy}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <BookOpen className="h-4 w-4 text-teal-600" />
                偷睇今課內容
              </button>
              <button
                type="button"
                onClick={onOpenStickers}
                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-sm font-bold text-rose-700 hover:bg-rose-100 whitespace-nowrap shrink-0"
              >
                <Sticker className="h-4 w-4" />
                睇貼紙簿
              </button>
            </div>
          </div>

          {/* Scope Segmented Control */}
          <div className="mt-5 flex justify-center">
            <div className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-slate-100 p-1">
              {(
                [
                  { id: 'all', label: '全部一齊溫' },
                  { id: 'phrase', label: '只溫 Part A 詞語' },
                  { id: 'sentence', label: '只溫 Part B 句子' },
                ] as { id: ScopeType; label: string }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleScopeChange(tab.id)}
                  className={`min-h-10 rounded-lg px-4 py-1.5 text-sm font-bold transition-colors whitespace-nowrap shrink-0 ${
                    scope === tab.id
                      ? 'bg-white text-teal-800 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* 4 Mini-Game Cards */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {gameMeta.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => startGame(g.id)}
                className={`flex flex-col justify-between gap-4 rounded-2xl border p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-sm cursor-pointer ${g.accentCls}`}
              >
                <div>
                  <div className="text-3xl leading-none">{g.emoji}</div>
                  <h3 className="mt-3 text-lg font-bold text-slate-900">{g.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-slate-600">{g.desc}</p>
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-bold text-teal-700">
                  開始玩 →
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {stage === 'playing' && (
        <div>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <button
              type="button"
              onClick={handleExitGame}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              返回揀遊戲
            </button>
            <span className="text-base font-bold text-slate-900">{gameNames[activeGame]}</span>
            <span className="text-sm font-bold text-amber-700 tabular-nums">{progressLabel}</span>
          </div>

          {activeGame === 'scramble' && (
            <ScrambleGame
              key={`scramble-${gameRunId}`}
              queue={gameQueue}
              accent={accent}
              autoPlay={autoPlay}
              sfxEnabled={sfxEnabled}
              onConfetti={onConfetti}
              onProgressLabel={setProgressLabel}
              onFinish={handleFinishGame}
            />
          )}

          {activeGame === 'missing' && (
            <MissingGame
              key={`missing-${gameRunId}`}
              queue={gameQueue}
              accent={accent}
              autoPlay={autoPlay}
              sfxEnabled={sfxEnabled}
              onConfetti={onConfetti}
              onProgressLabel={setProgressLabel}
              onFinish={handleFinishGame}
            />
          )}

          {activeGame === 'balloon' && (
            <BalloonGame
              key={`balloon-${gameRunId}`}
              queue={gameQueue}
              accent={accent}
              autoPlay={autoPlay}
              sfxEnabled={sfxEnabled}
              onConfetti={onConfetti}
              onProgressLabel={setProgressLabel}
              onFinish={handleFinishGame}
            />
          )}

          {activeGame === 'memory' && (
            <MemoryGame
              key={`memory-${gameRunId}`}
              pool={memoryPool}
              accent={accent}
              sfxEnabled={sfxEnabled}
              onConfetti={onConfetti}
              onProgressLabel={setProgressLabel}
              onFinish={handleFinishGame}
            />
          )}
        </div>
      )}

      {stage === 'win' && winInfo && (
        <div className="py-4 text-center">
          <div className="text-6xl leading-none">🎉</div>
          <h2 className="mt-4 text-2xl font-bold text-teal-800 sm:text-3xl">{winInfo.title}</h2>
          <p className="mt-2 text-base font-medium text-slate-600">{winInfo.desc}</p>

          <div className="mx-auto mt-6 max-w-md rounded-2xl border border-amber-200 bg-amber-50/80 p-5">
            <div className="flex items-center justify-center gap-1.5 text-sm font-bold text-amber-800">
              <Sparkles className="h-4 w-4" />
              獲得溫習小獎勵
            </div>
            <div className="mt-2 text-lg font-bold text-slate-900">
              ⭐ +{winInfo.reward.starsEarned} 粒星星
            </div>
            {winInfo.reward.newSticker ? (
              <div className="mt-2 text-lg font-bold text-rose-700">
                解鎖新貼紙：{winInfo.reward.newSticker.emoji} {winInfo.reward.newSticker.name}
              </div>
            ) : (
              <div className="mt-1.5 text-sm font-medium text-slate-600">
                你已經收集晒全部貼紙啦，太勁啦！👑
              </div>
            )}
          </div>

          <div className="mx-auto mt-7 flex max-w-xl flex-col gap-3 sm:flex-row">
            <button
              type="button"
              onClick={() => startGame(activeGame)}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-100 whitespace-nowrap"
            >
              <RotateCcw className="h-4 w-4" />
              再玩一局
            </button>
            <button
              type="button"
              onClick={handleExitGame}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
            >
              <Gamepad2 className="h-4 w-4" />
              玩其他遊戲
            </button>
            <button
              type="button"
              onClick={onGoQuiz}
              className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-700 whitespace-nowrap"
            >
              <PenLine className="h-4 w-4" />
              去默書挑戰
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
