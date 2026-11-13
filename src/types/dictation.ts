export type WordType = 'phrase' | 'sentence';

export interface WordItem {
  en: string;
  zh: string;
  type: WordType;
}

export interface DictationUnit {
  id: string;
  title: string;
  content: string;
}

export interface UnitStore {
  activeId: string;
  units: DictationUnit[];
}

export type AccentOption = 'en-GB' | 'en-US';

export interface AppSettings {
  accent: AccentOption;
  shuffle: boolean;
  autoPlay: boolean;
  sentenceStrict: boolean;
  phraseStrict: boolean;
}

export interface RewardsState {
  stars: number;
  unlocked: string[];
  avatar: string;
}

export interface StickerItem {
  id: string;
  emoji: string;
  name: string;
}

export type TabName = 'setup' | 'playground' | 'quiz';

export type ScopeType = 'all' | 'phrase' | 'sentence';

export type MiniGameType = 'scramble' | 'missing' | 'balloon' | 'memory';

export interface QuizResultItem {
  en: string;
  zh: string;
  userAnswer: string;
  isCorrect: boolean;
}

export interface DiffToken {
  kind: 'ok' | 'wrong-sub' | 'missing' | 'extra';
  text: string;
  expected?: string;
}

export interface RewardGrant {
  starsEarned: number;
  newSticker: StickerItem | null;
}
