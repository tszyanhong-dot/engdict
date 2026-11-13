import React, { useState } from 'react';
import { BookPlus, Eraser, Gamepad2, PenLine, Share2, Sparkles, Trash2 } from 'lucide-react';
import { AppSettings, DictationUnit, WordItem } from '../types/dictation';

interface SetupViewProps {
  units: DictationUnit[];
  activeUnit: DictationUnit;
  wordList: WordItem[];
  settings: AppSettings;
  onSelectUnit: (id: string) => void;
  onCreateUnit: (title: string) => void;
  onDeleteCurrentUnit: () => void;
  onRenameUnit: (title: string) => void;
  onUpdateContent: (content: string) => void;
  onLoadSample: () => void;
  onClearContent: () => void;
  onUpdateSettings: (patch: Partial<AppSettings>) => void;
  onOpenSync: () => void;
  onGoPlayground: () => void;
  onGoQuiz: () => void;
}

export const SetupView: React.FC<SetupViewProps> = ({
  units,
  activeUnit,
  wordList,
  settings,
  onSelectUnit,
  onCreateUnit,
  onDeleteCurrentUnit,
  onRenameUnit,
  onUpdateContent,
  onLoadSample,
  onClearContent,
  onUpdateSettings,
  onOpenSync,
  onGoPlayground,
  onGoQuiz,
}) => {
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [newUnitTitle, setNewUnitTitle] = useState('');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const phraseCount = wordList.filter((w) => w.type === 'phrase').length;
  const sentenceCount = wordList.filter((w) => w.type === 'sentence').length;

  const handleConfirmCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = newUnitTitle.trim() || `新默書單元 ${units.length + 1}`;
    onCreateUnit(finalName);
    setNewUnitTitle('');
    setIsAddingUnit(false);
  };

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      {/* Unit Management Bar */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-bold text-slate-900">多單元默書生字簿</h2>
          <span className="text-xs font-semibold text-slate-500 tabular-nums">
            共 {units.length} 個單元
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <select
            aria-label="選擇默書單元"
            value={activeUnit.id}
            onChange={(e) => {
              onSelectUnit(e.target.value);
              setConfirmingDelete(false);
            }}
            className="min-h-11 min-w-[200px] flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-bold text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          >
            {units.map((u) => (
              <option key={u.id} value={u.id}>
                {u.title}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => {
              setIsAddingUnit((v) => !v);
              setConfirmingDelete(false);
            }}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-teal-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-teal-700 whitespace-nowrap shrink-0"
          >
            <BookPlus className="h-4 w-4" />
            新增單元
          </button>

          <button
            type="button"
            onClick={onOpenSync}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Share2 className="h-4 w-4" />
            分享此課
          </button>

          {units.length > 1 && !confirmingDelete && (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-rose-600 transition-colors hover:bg-rose-50 whitespace-nowrap shrink-0"
            >
              <Trash2 className="h-4 w-4" />
              刪除
            </button>
          )}

          {confirmingDelete && (
            <div className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5">
              <span className="text-xs font-bold text-rose-800">確定刪除？</span>
              <button
                type="button"
                onClick={() => {
                  onDeleteCurrentUnit();
                  setConfirmingDelete(false);
                }}
                className="min-h-8 rounded-lg bg-rose-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-rose-700 whitespace-nowrap shrink-0"
              >
                確認
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="min-h-8 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
              >
                取消
              </button>
            </div>
          )}
        </div>

        {isAddingUnit && (
          <form
            onSubmit={handleConfirmCreate}
            className="animate-pop-in mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-teal-200 bg-white p-3"
          >
            <input
              type="text"
              autoFocus
              value={newUnitTitle}
              onChange={(e) => setNewUnitTitle(e.target.value)}
              placeholder={`例如：Unit ${units.length + 3} 默書`}
              className="min-h-10 min-w-[200px] flex-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-900 focus:border-teal-600 focus:outline-none"
            />
            <button
              type="submit"
              className="min-h-10 rounded-lg bg-teal-600 px-4 py-1.5 text-sm font-bold text-white hover:bg-teal-700 whitespace-nowrap shrink-0"
            >
              建立單元
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAddingUnit(false);
                setNewUnitTitle('');
              }}
              className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              取消
            </button>
          </form>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <label htmlFor="unit-title-input" className="text-sm font-bold text-slate-700">
            單元名稱
          </label>
          <input
            id="unit-title-input"
            type="text"
            value={activeUnit.title}
            onChange={(e) => onRenameUnit(e.target.value)}
            placeholder="例如：Unit 4 默書"
            className="min-h-10 min-w-[220px] flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-1.5 text-sm font-bold text-teal-800 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
      </div>

      {/* Instructions Note (clean hairline border, no thick left bar) */}
      <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/60 px-4 py-3 text-sm leading-relaxed text-slate-700">
        <span className="font-bold text-sky-900">貼上貼士：</span>
        直接貼上學校默書表（有 <code className="font-mono-code rounded bg-white px-1.5 py-0.5 text-xs">PART A</code>、
        <code className="font-mono-code rounded bg-white px-1.5 py-0.5 text-xs">1. 2.</code> 編號都自動識過濾）。想顯示中文意思，用逗號分隔即可：
        <code className="font-mono-code ml-1 rounded bg-white px-1.5 py-0.5 text-xs text-teal-800">
          build sandcastles, 堆沙堡
        </code>
      </div>

      {/* Textarea */}
      <div className="mt-4">
        <textarea
          aria-label="默書詞語及句子輸入區"
          value={activeUnit.content}
          onChange={(e) => onUpdateContent(e.target.value)}
          placeholder="每行輸入一個詞語或句子..."
          rows={9}
          className="w-full rounded-xl border border-slate-300 bg-white p-4 text-base leading-relaxed text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
        />
      </div>

      {/* Metadata & Toolbar */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 tabular-nums">
          <span className="text-teal-700">{phraseCount} 個詞語</span>
          <span aria-hidden="true">·</span>
          <span className="text-sky-700">{sentenceCount} 條句子</span>
          <span aria-hidden="true">·</span>
          <span>自動儲存</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onLoadSample}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            填入沙灘默書範例
          </button>

          {!confirmingClear ? (
            <button
              type="button"
              onClick={() => setConfirmingClear(true)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <Eraser className="h-3.5 w-3.5" />
              清空本頁文字
            </button>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1">
              <span className="text-xs font-bold text-amber-900">確定清空？</span>
              <button
                type="button"
                onClick={() => {
                  onClearContent();
                  setConfirmingClear(false);
                }}
                className="rounded bg-amber-600 px-2 py-0.5 text-xs font-bold text-white hover:bg-amber-700 whitespace-nowrap shrink-0"
              >
                確定
              </button>
              <button
                type="button"
                onClick={() => setConfirmingClear(false)}
                className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 whitespace-nowrap shrink-0"
              >
                取消
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Settings Grid */}
      <div className="mt-5 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="flex items-center justify-between gap-3 text-sm font-semibold text-slate-800">
          <span>英文口音</span>
          <select
            value={settings.accent}
            onChange={(e) => onUpdateSettings({ accent: e.target.value as 'en-GB' | 'en-US' })}
            className="min-h-9 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-sm font-semibold text-slate-800 focus:border-teal-600 focus:outline-none"
          >
            <option value="en-GB">英式英文 (UK)</option>
            <option value="en-US">美式英文 (US)</option>
          </select>
        </label>

        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-slate-800">
          <span>隨機出題順序</span>
          <input
            type="checkbox"
            checked={settings.shuffle}
            onChange={(e) => onUpdateSettings({ shuffle: e.target.checked })}
            className="h-5 w-5 rounded accent-teal-600 cursor-pointer"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-slate-800">
          <span>出題自動讀出</span>
          <input
            type="checkbox"
            checked={settings.autoPlay}
            onChange={(e) => onUpdateSettings({ autoPlay: e.target.checked })}
            className="h-5 w-5 rounded accent-teal-600 cursor-pointer"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-slate-800">
          <span>句子檢查大寫及句號</span>
          <input
            type="checkbox"
            checked={settings.sentenceStrict}
            onChange={(e) => onUpdateSettings({ sentenceStrict: e.target.checked })}
            className="h-5 w-5 rounded accent-teal-600 cursor-pointer"
          />
        </label>

        <label className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-slate-800">
          <span>詞語檢查大小寫</span>
          <input
            type="checkbox"
            checked={settings.phraseStrict}
            onChange={(e) => onUpdateSettings({ phraseStrict: e.target.checked })}
            className="h-5 w-5 rounded accent-teal-600 cursor-pointer"
          />
        </label>
      </div>

      {/* Primary Action Row — 1 primary CTA + 1 secondary action */}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={onGoPlayground}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-base font-bold text-rose-700 transition-colors hover:bg-rose-100 whitespace-nowrap"
        >
          <Gamepad2 className="h-5 w-5" />
          去遊樂場邊玩邊記
        </button>
        <button
          type="button"
          onClick={onGoQuiz}
          className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-teal-600 px-5 py-3 text-base font-bold text-white shadow-xs transition-colors hover:bg-teal-700 whitespace-nowrap"
        >
          <PenLine className="h-5 w-5" />
          直接去默書挑戰
        </button>
      </div>
    </section>
  );
};
