/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link2, Volume2, VolumeX } from 'lucide-react';
import { ConfettiBurst, ConfettiOverlay } from './components/ConfettiOverlay';
import { QuickStudyModal, StickerModal, SyncModal } from './components/Modals';
import { PlaygroundView } from './components/PlaygroundView';
import { QuizView } from './components/QuizView';
import { SetupView } from './components/SetupView';
import {
  BASIC_SAMPLE_WORDS,
  CURRENT_DICTATION,
  DEFAULT_SETTINGS,
  STICKERS,
  STORAGE_KEY_OLD_WORDS,
  STORAGE_KEY_REWARDS,
  STORAGE_KEY_SETTINGS,
  STORAGE_KEY_UNITS,
} from './constants/dictationData';
import {
  AppSettings,
  DictationUnit,
  RewardGrant,
  RewardsState,
  TabName,
  UnitStore,
} from './types/dictation';
import { getAudioContext, initSpeechVoices, playPopSound, playSuccessSound, stopAllSpeech } from './utils/audio';
import { parseSyncPayloadFromString, parseWords } from './utils/parser';

function loadInitialUnitStore(): UnitStore {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_UNITS) || 'null');
    if (saved && Array.isArray(saved.units) && saved.units.length > 0) {
      return saved as UnitStore;
    }
    const oldWords = localStorage.getItem(STORAGE_KEY_OLD_WORDS);
    const initial: UnitStore = {
      activeId: 'u_beach',
      units: [
        {
          id: 'u_beach',
          title: '沙灘與郊遊默書 (Part A+B)',
          content: oldWords && oldWords.trim() ? oldWords : CURRENT_DICTATION,
        },
        {
          id: 'u_basic',
          title: '小三基礎生字練習',
          content: BASIC_SAMPLE_WORDS,
        },
      ],
    };
    localStorage.setItem(STORAGE_KEY_UNITS, JSON.stringify(initial));
    return initial;
  } catch {
    return {
      activeId: 'u_beach',
      units: [
        { id: 'u_beach', title: '沙灘與郊遊默書 (Part A+B)', content: CURRENT_DICTATION },
        { id: 'u_basic', title: '小三基礎生字練習', content: BASIC_SAMPLE_WORDS },
      ],
    };
  }
}

function loadInitialSettings(): AppSettings {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || 'null');
    if (saved && typeof saved === 'object') {
      return { ...DEFAULT_SETTINGS, ...saved };
    }
  } catch {
    // ignore storage parse failure
  }
  return DEFAULT_SETTINGS;
}

function loadInitialRewards(): RewardsState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY_REWARDS) || 'null');
    if (saved && typeof saved.stars === 'number') {
      return {
        stars: saved.stars || 0,
        unlocked:
          Array.isArray(saved.unlocked) && saved.unlocked.length > 0
            ? saved.unlocked
            : ['unicorn'],
        avatar: saved.avatar || '🦄',
      };
    }
  } catch {
    // ignore storage parse failure
  }
  return { stars: 0, unlocked: ['unicorn'], avatar: '🦄' };
}

export default function App() {
  const [unitStore, setUnitStore] = useState<UnitStore>(loadInitialUnitStore);
  const [settings, setSettings] = useState<AppSettings>(loadInitialSettings);
  const [rewards, setRewards] = useState<RewardsState>(loadInitialRewards);
  const [activeTab, setActiveTab] = useState<TabName>('setup');
  const [sfxEnabled, setSfxEnabled] = useState(true);

  const [syncOpen, setSyncOpen] = useState(false);
  const [quickStudyOpen, setQuickStudyOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);

  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [confettiBurst, setConfettiBurst] = useState<ConfettiBurst | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const confettiIdRef = useRef(0);

  const activeUnit: DictationUnit = useMemo(() => {
    return unitStore.units.find((u) => u.id === unitStore.activeId) || unitStore.units[0];
  }, [unitStore]);

  const wordList = useMemo(() => parseWords(activeUnit?.content || ''), [activeUnit]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => setToastMsg(null), 3200);
  }, []);

  const launchConfetti = useCallback((count = 28) => {
    confettiIdRef.current += 1;
    setConfettiBurst({ id: confettiIdRef.current, count });
  }, []);

  // Persist unitStore, settings, rewards
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_UNITS, JSON.stringify(unitStore));
    } catch {
      // ignore quota error
    }
  }, [unitStore]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
    } catch {
      // ignore quota error
    }
  }, [settings]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_REWARDS, JSON.stringify(rewards));
    } catch {
      // ignore quota error
    }
  }, [rewards]);

  const applySyncString = useCallback(
    (rawStr: string): boolean => {
      const parsed = parseSyncPayloadFromString(rawStr);
      if (!parsed) return false;

      if (parsed.kind === 'unit' && parsed.unit) {
        const incoming = parsed.unit;
        const incomingId = incoming.id || 'u_' + Date.now().toString(36);
        setUnitStore((prev) => {
          const exists = prev.units.some((u) => u.id === incomingId);
          const nextUnits = exists
            ? prev.units.map((u) =>
                u.id === incomingId
                  ? { ...u, title: incoming.t || u.title, content: incoming.c }
                  : u
              )
            : [{ id: incomingId, title: incoming.t || '收到嘅默書單元', content: incoming.c }, ...prev.units];
          return { activeId: incomingId, units: nextUnits };
        });
        try {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        } catch {
          // ignore
        }
        showToast(`成功匯入單元：「${incoming.t || '新單元'}」`);
        playSuccessSound(sfxEnabled);
        launchConfetti(25);
        return true;
      }

      if (parsed.kind === 'all' && parsed.all) {
        const incomingAll = parsed.all;
        setUnitStore((prev) => {
          const merged = [...prev.units];
          for (const inc of incomingAll.units) {
            const idx = merged.findIndex((u) => u.id === inc.id);
            if (idx >= 0) merged[idx] = inc;
            else merged.push(inc);
          }
          return {
            activeId: incomingAll.activeId || prev.activeId,
            units: merged,
          };
        });
        if (incomingAll.rewards) {
          const r = incomingAll.rewards;
          setRewards((prev) => ({
            stars: Math.max(prev.stars, r.stars || 0),
            unlocked: Array.from(new Set([...prev.unlocked, ...(r.unlocked || [])])),
            avatar: r.avatar || prev.avatar,
          }));
        }
        try {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        } catch {
          // ignore
        }
        showToast(`同步完成！已匯入 ${incomingAll.units.length} 個單元及貼紙進度`);
        playSuccessSound(sfxEnabled);
        launchConfetti(25);
        return true;
      }

      return false;
    },
    [launchConfetti, sfxEnabled, showToast]
  );

  // Initialize Speech Voices & listen for URL hash sync
  useEffect(() => {
    initSpeechVoices();
    if (window.location.hash) {
      applySyncString(window.location.hash);
    }
    const handleHashChange = () => {
      if (window.location.hash) applySyncString(window.location.hash);
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      stopAllSpeech();
    };
  }, [applySyncString]);

  const handleSwitchTab = (tab: TabName) => {
    getAudioContext();
    stopAllSpeech();
    setActiveTab(tab);
  };

  const handleSelectUnit = (id: string) => {
    playPopSound(sfxEnabled);
    setUnitStore((prev) => ({ ...prev, activeId: id }));
  };

  const handleCreateUnit = (title: string) => {
    const newId = 'u_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    const newUnit: DictationUnit = { id: newId, title, content: '' };
    setUnitStore((prev) => ({
      activeId: newId,
      units: [newUnit, ...prev.units],
    }));
    showToast(`已新增單元「${title}」`);
  };

  const handleDeleteCurrentUnit = () => {
    if (unitStore.units.length <= 1) return;
    setUnitStore((prev) => {
      const remaining = prev.units.filter((u) => u.id !== activeUnit.id);
      return {
        activeId: remaining[0].id,
        units: remaining,
      };
    });
    showToast('已刪除單元');
  };

  const handleRenameUnit = (title: string) => {
    setUnitStore((prev) => ({
      ...prev,
      units: prev.units.map((u) => (u.id === activeUnit.id ? { ...u, title } : u)),
    }));
  };

  const handleUpdateContent = (content: string) => {
    setUnitStore((prev) => ({
      ...prev,
      units: prev.units.map((u) => (u.id === activeUnit.id ? { ...u, content } : u)),
    }));
  };

  const handleLoadSample = () => {
    handleUpdateContent(CURRENT_DICTATION);
    showToast('已填入沙灘默書範例');
  };

  const handleClearContent = () => {
    handleUpdateContent('');
    showToast('已清空本頁文字');
  };

  const handleUpdateSettings = (patch: Partial<AppSettings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
  };

  const rewardsRef = useRef<RewardsState>(rewards);
  rewardsRef.current = rewards;

  const handleGrantReward = useCallback(
    (starAmount: number, tryUnlockSticker: boolean): RewardGrant => {
      const current = rewardsRef.current;
      const locked = STICKERS.filter((s) => !current.unlocked.includes(s.id));
      const newSticker =
        tryUnlockSticker && locked.length > 0
          ? locked[Math.floor(Math.random() * locked.length)]
          : null;

      setRewards((prev) => ({
        ...prev,
        stars: prev.stars + starAmount,
        unlocked:
          newSticker && !prev.unlocked.includes(newSticker.id)
            ? [...prev.unlocked, newSticker.id]
            : prev.unlocked,
      }));

      return { starsEarned: starAmount, newSticker };
    },
    []
  );

  const handleSelectAvatar = (stickerId: string) => {
    const found = STICKERS.find((s) => s.id === stickerId);
    if (!found) return;
    playPopSound(sfxEnabled);
    setRewards((prev) => ({ ...prev, avatar: found.emoji }));
  };

  const handleToggleSfx = () => {
    const next = !sfxEnabled;
    setSfxEnabled(next);
    if (next) playPopSound(true);
  };

  return (
    <div className="min-h-screen bg-[#fafaf7] text-slate-900">
      <ConfettiOverlay burst={confettiBurst} />

      {/* Top Navigation Bar — clean 3-zone structure */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur-xs">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:gap-8 sm:px-6">
          {/* Zone 1: Brand Wordmark */}
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setStickerOpen(true)}
              title="撳呢度揀頭像及睇貼紙簿"
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-xl transition-transform hover:scale-105 cursor-pointer shrink-0"
            >
              {rewards.avatar}
            </button>
            <span className="font-display text-base font-bold tracking-tight text-slate-900 sm:text-lg whitespace-nowrap shrink-0">
              小三英文默書遊樂場
            </span>
          </div>

          {/* Zone 2: Primary Navigation (Desktop inline) */}
          <nav className="hidden items-center gap-6 md:flex" aria-label="主要功能分頁">
            {(
              [
                { id: 'setup', label: '生字簿' },
                { id: 'playground', label: '溫習遊樂場' },
                { id: 'quiz', label: '默書挑戰' },
              ] as { id: TabName; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSwitchTab(item.id)}
                className={`relative py-2 text-sm font-bold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  activeTab === item.id
                    ? 'text-teal-700'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {item.label}
                {activeTab === item.id && (
                  <span className="absolute right-0 bottom-0 left-0 h-0.5 rounded-full bg-teal-600" />
                )}
              </button>
            ))}
          </nav>

          {/* Zone 3: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setStickerOpen(true)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100 tabular-nums whitespace-nowrap shrink-0 cursor-pointer"
              title="打開貼紙簿"
            >
              <span>🌟 {rewards.stars}</span>
              <span aria-hidden="true">·</span>
              <span>
                🎀 {rewards.unlocked.length}/{STICKERS.length}
              </span>
            </button>

            <button
              type="button"
              onClick={handleToggleSfx}
              aria-label={sfxEnabled ? '關閉音效' : '開啟音效'}
              title={sfxEnabled ? '音效：開' : '音效：關'}
              className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0 cursor-pointer"
            >
              {sfxEnabled ? <Volume2 className="h-4 w-4 text-teal-600" /> : <VolumeX className="h-4 w-4 text-slate-400" />}
            </button>

            <button
              type="button"
              onClick={() => setSyncOpen(true)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-bold text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Link2 className="h-3.5 w-3.5" />
              分享 / 同步
            </button>
          </div>
        </div>

        {/* Mobile Segmented Navigation */}
        <div className="border-t border-slate-100 px-4 py-2 md:hidden">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
            {(
              [
                { id: 'setup', label: '📝 生字簿' },
                { id: 'playground', label: '🎮 遊樂場' },
                { id: 'quiz', label: '✍️ 默書挑戰' },
              ] as { id: TabName; label: string }[]
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSwitchTab(item.id)}
                className={`min-h-10 rounded-lg px-2 py-1.5 text-xs font-bold transition-colors whitespace-nowrap shrink-0 ${
                  activeTab === item.id
                    ? 'bg-white text-teal-800 shadow-xs'
                    : 'text-slate-600'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {activeTab === 'setup' && (
          <SetupView
            units={unitStore.units}
            activeUnit={activeUnit}
            wordList={wordList}
            settings={settings}
            onSelectUnit={handleSelectUnit}
            onCreateUnit={handleCreateUnit}
            onDeleteCurrentUnit={handleDeleteCurrentUnit}
            onRenameUnit={handleRenameUnit}
            onUpdateContent={handleUpdateContent}
            onLoadSample={handleLoadSample}
            onClearContent={handleClearContent}
            onUpdateSettings={handleUpdateSettings}
            onOpenSync={() => setSyncOpen(true)}
            onGoPlayground={() => handleSwitchTab('playground')}
            onGoQuiz={() => handleSwitchTab('quiz')}
          />
        )}

        {activeTab === 'playground' && (
          <PlaygroundView
            unitTitle={activeUnit.title}
            wordList={wordList}
            accent={settings.accent}
            autoPlay={settings.autoPlay}
            sfxEnabled={sfxEnabled}
            onOpenQuickStudy={() => setQuickStudyOpen(true)}
            onOpenStickers={() => setStickerOpen(true)}
            onGrantReward={handleGrantReward}
            onConfetti={launchConfetti}
            onGoSetup={() => handleSwitchTab('setup')}
            onGoQuiz={() => handleSwitchTab('quiz')}
            onToast={showToast}
          />
        )}

        {activeTab === 'quiz' && (
          <QuizView
            unitTitle={activeUnit.title}
            wordList={wordList}
            settings={settings}
            sfxEnabled={sfxEnabled}
            onGrantReward={handleGrantReward}
            onConfetti={launchConfetti}
            onGoSetup={() => handleSwitchTab('setup')}
            onGoPlayground={() => handleSwitchTab('playground')}
            onToast={showToast}
          />
        )}
      </main>

      {/* Modals */}
      <SyncModal
        isOpen={syncOpen}
        onClose={() => setSyncOpen(false)}
        activeUnit={activeUnit}
        units={unitStore.units}
        rewards={rewards}
        onImportString={applySyncString}
        onToast={showToast}
      />

      <QuickStudyModal
        isOpen={quickStudyOpen}
        onClose={() => setQuickStudyOpen(false)}
        unitTitle={activeUnit.title}
        wordList={wordList}
        accent={settings.accent}
      />

      <StickerModal
        isOpen={stickerOpen}
        onClose={() => setStickerOpen(false)}
        rewards={rewards}
        onSelectAvatar={handleSelectAvatar}
      />

      {/* Toast Notification */}
      {toastMsg && (
        <div
          role="status"
          aria-live="polite"
          className="animate-pop-in fixed bottom-6 left-1/2 z-50 max-w-[90vw] -translate-x-1/2 rounded-full bg-slate-900 px-5 py-2.5 text-center text-sm font-bold text-white shadow-lg"
        >
          {toastMsg}
        </div>
      )}
    </div>
  );
}
