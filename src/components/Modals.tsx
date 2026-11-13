import React, { useEffect, useState } from 'react';
import { Check, Copy, Share2, Volume2, X } from 'lucide-react';
import { STICKERS } from '../constants/dictationData';
import { AccentOption, DictationUnit, RewardsState, WordItem } from '../types/dictation';
import { speakText } from '../utils/audio';
import { encodeShareData } from '../utils/parser';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeUnit: DictationUnit;
  units: DictationUnit[];
  rewards: RewardsState;
  onImportString: (raw: string) => boolean;
  onToast: (msg: string) => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({
  isOpen,
  onClose,
  activeUnit,
  units,
  rewards,
  onImportString,
  onToast,
}) => {
  const [manualInput, setManualInput] = useState('');
  const [importError, setImportError] = useState('');
  const [generatedUrl, setGeneratedUrl] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    setManualInput('');
    setImportError('');
    setGeneratedUrl('');
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const buildShareUrl = (mode: 'unit' | 'all') => {
    const base =
      window.location.protocol === 'http:' || window.location.protocol === 'https:'
        ? window.location.origin + window.location.pathname
        : window.location.href.split('#')[0];

    if (mode === 'unit') {
      const payload = encodeShareData({ id: activeUnit.id, t: activeUnit.title, c: activeUnit.content });
      return `${base}#u=${payload}`;
    }
    const payload = encodeShareData({ units, activeId: activeUnit.id, rewards });
    return `${base}#sync=${payload}`;
  };

  const handleShare = async (mode: 'unit' | 'all', preferNative: boolean) => {
    const url = buildShareUrl(mode);
    const title =
      mode === 'unit' ? `英文默書單元：${activeUnit.title}` : '小三英文默書完整同步備份';

    if (preferNative && typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title,
          text:
            mode === 'unit'
              ? `撳條連結就即刻溫到「${activeUnit.title}」啦！`
              : '撳條連結同步所有默書單元同貼紙進度！',
          url,
        });
        onToast('已傳送分享連結！');
        return;
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      onToast('已複製同步連結！可以去 WhatsApp / AirDrop 貼上俾另一部機');
      setGeneratedUrl('');
    } catch {
      setGeneratedUrl(url);
      onToast('請複製下方連結傳送到另一部機');
    }
  };

  const handleManualImport = () => {
    const trimmed = manualInput.trim();
    if (!trimmed) {
      setImportError('請先貼上分享連結或同步代碼');
      return;
    }
    const ok = onImportString(trimmed);
    if (ok) {
      onClose();
    } else {
      setImportError('搵唔到有效嘅同步代碼，請確認有無複製齊成條連結');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sync-modal-title"
    >
      <div className="animate-pop-in max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 id="sync-modal-title" className="text-xl font-bold text-slate-900">
              一鍵分享及跨裝置同步
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              支援 iPhone / iPad 經 AirDrop 或 WhatsApp 直接傳送，無需註冊帳號
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            aria-label="關閉視窗"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-4">
            <h3 className="text-base font-bold text-sky-900">
              方法 1：只傳送今課單元去 iPad 溫習
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              目前單元：<span className="font-semibold text-slate-900">{activeUnit.title}</span>
            </p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => handleShare('unit', true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-sky-700 whitespace-nowrap shrink-0"
              >
                <Share2 className="h-4 w-4" />
                傳送此課 (AirDrop / WhatsApp)
              </button>
              <button
                type="button"
                onClick={() => handleShare('unit', false)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Copy className="h-4 w-4" />
                複製單元連結
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-teal-200 bg-teal-50/70 p-4">
            <h3 className="text-base font-bold text-teal-900">
              方法 2：兩部機同步「全部單元 ＋ 貼紙星星」
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              一次過將全部 {units.length} 個單元同已解鎖貼紙進度備份過去另一部裝置
            </p>
            <div className="mt-3 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={() => handleShare('all', true)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-teal-700 whitespace-nowrap shrink-0"
              >
                <Share2 className="h-4 w-4" />
                傳送全部備份
              </button>
              <button
                type="button"
                onClick={() => handleShare('all', false)}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                <Copy className="h-4 w-4" />
                複製全部同步連結
              </button>
            </div>
          </div>

          {generatedUrl && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
              <label className="block text-sm font-bold text-amber-900">
                手動複製以下同步連結：
              </label>
              <input
                type="text"
                readOnly
                value={generatedUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="font-mono-code mt-2 w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs text-slate-800"
              />
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-base font-bold text-slate-900">
              喺呢部機手動貼上同步連結或代碼
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              如果已將網頁加到 iPad 主畫面當 App 開，直接貼上連結即可匯入
            </p>
            <textarea
              value={manualInput}
              onChange={(e) => {
                setManualInput(e.target.value);
                setImportError('');
              }}
              placeholder="貼上從 iPhone / WhatsApp 複製過嚟嘅分享連結..."
              rows={3}
              className="mt-3 w-full rounded-xl border border-slate-300 bg-white p-3 text-sm text-slate-800 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
            {importError && (
              <p className="mt-1.5 text-sm font-semibold text-rose-600">{importError}</p>
            )}
            <div className="mt-3">
              <button
                type="button"
                onClick={handleManualImport}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800 whitespace-nowrap shrink-0"
              >
                <Check className="h-4 w-4" />
                立即匯入並同步
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface QuickStudyModalProps {
  isOpen: boolean;
  onClose: () => void;
  unitTitle: string;
  wordList: WordItem[];
  accent: AccentOption;
}

export const QuickStudyModal: React.FC<QuickStudyModalProps> = ({
  isOpen,
  onClose,
  unitTitle,
  wordList,
  accent,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-study-title"
    >
      <div className="animate-pop-in max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 id="quick-study-title" className="text-xl font-bold text-slate-900">
              今課默書內容表
            </h2>
            <p className="mt-0.5 text-sm text-slate-500">
              {unitTitle} · 共 {wordList.length} 題
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            aria-label="關閉視窗"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {wordList.length === 0 ? (
          <p className="py-12 text-center text-base font-semibold text-slate-500">
            暫時未有內容，請先去「生字簿」輸入默書詞語或句子。
          </p>
        ) : (
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {wordList.map((item, idx) => (
              <div
                key={`${item.en}-${idx}`}
                className="flex flex-col justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4"
              >
                <div>
                  <span className="text-xs font-semibold text-slate-500">
                    {item.type === 'sentence' ? 'Part B 句子' : 'Part A 詞語'}
                  </span>
                  <div
                    className={`mt-1 font-bold text-slate-900 leading-snug ${
                      item.type === 'sentence' ? 'text-base' : 'text-lg'
                    }`}
                  >
                    {item.en}
                  </div>
                  {item.zh && <div className="mt-1 text-sm font-medium text-slate-600">{item.zh}</div>}
                </div>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => speakText(item.en, accent, 1.0)}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-sky-700 whitespace-nowrap shrink-0"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    正常讀音
                  </button>
                  <button
                    type="button"
                    onClick={() => speakText(item.en, accent, 0.65)}
                    className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                  >
                    🐢 慢讀
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface StickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  rewards: RewardsState;
  onSelectAvatar: (stickerId: string) => void;
}

export const StickerModal: React.FC<StickerModalProps> = ({
  isOpen,
  onClose,
  rewards,
  onSelectAvatar,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="sticker-modal-title"
    >
      <div className="animate-pop-in max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h2 id="sticker-modal-title" className="text-xl font-bold text-slate-900">
              我嘅可愛貼紙簿
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              玩遊戲過關或者默書攞 80% 以上就會隨機解鎖貼紙！點選已解鎖貼紙即可設為頭像。
            </p>
            <div className="mt-2 flex items-center gap-2 text-xs font-semibold text-slate-500 tabular-nums">
              <span>已收集 {rewards.unlocked.length} / {STICKERS.length} 款</span>
              <span aria-hidden="true">·</span>
              <span>累積星星 {rewards.stars} 粒</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-10 min-w-10 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
            aria-label="關閉視窗"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STICKERS.map((s) => {
            const isUnlocked = rewards.unlocked.includes(s.id);
            const isAvatar = rewards.avatar === s.emoji;
            return (
              <button
                key={s.id}
                type="button"
                disabled={!isUnlocked}
                onClick={() => isUnlocked && onSelectAvatar(s.id)}
                className={`flex min-h-28 flex-col items-center justify-center rounded-xl border p-3 text-center transition-transform ${
                  isAvatar
                    ? 'border-rose-400 bg-rose-50 ring-2 ring-rose-300/60'
                    : isUnlocked
                    ? 'border-amber-200 bg-amber-50/70 hover:-translate-y-0.5 cursor-pointer'
                    : 'border-slate-200 bg-slate-50 opacity-50 grayscale cursor-not-allowed'
                }`}
              >
                <span className="text-4xl leading-none">{isUnlocked ? s.emoji : '❓'}</span>
                <span className="mt-2 text-xs font-bold text-slate-800">
                  {isUnlocked ? s.name : '未解鎖'}
                </span>
                {isAvatar && (
                  <span className="mt-1 text-[11px] font-bold text-rose-600">目前頭像</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
