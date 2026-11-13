import { AppSettings, StickerItem } from '../types/dictation';

export const CURRENT_DICTATION = `PART A 詞語
1. build sandcastles, 堆沙堡
2. look at shells, 睇貝殼
3. have a picnic, 去野餐
4. take photos, 影相
5. go camping, 去露營

PART B 句子
1. I want to go to the beach because I want to have a barbecue., 我想去沙灘，因為我想燒烤。
2. Sally wants to go to the country park because she wants to fly a kite., Sally 想去郊野公園，因為她想放風箏。`;

export const BASIC_SAMPLE_WORDS = `library, 圖書館
playground, 操場
homework, 功課
breakfast, 早餐
umbrella, 雨傘
elephant, 大象
delicious, 美味的
Wednesday, 星期三`;

export const STICKERS: StickerItem[] = [
  { id: 'unicorn', emoji: '🦄', name: '閃亮獨角獸' },
  { id: 'cat', emoji: '🐱', name: '軟萌小貓' },
  { id: 'cupcake', emoji: '🧁', name: '士多啤梨蛋糕' },
  { id: 'rainbow', emoji: '🌈', name: '彩虹泡泡' },
  { id: 'bunny', emoji: '🐰', name: '棉花糖兔仔' },
  { id: 'butterfly', emoji: '🦋', name: '蝴蝶仙子' },
  { id: 'strawberry', emoji: '🍓', name: '香甜士多啤梨' },
  { id: 'icecream', emoji: '🍦', name: '夢幻雪糕' },
  { id: 'panda', emoji: '🐼', name: '開心熊貓' },
  { id: 'flower', emoji: '🌸', name: '櫻花小花' },
  { id: 'ribbon', emoji: '🎀', name: '粉紅蝴蝶結' },
  { id: 'star', emoji: '🌟', name: '金色許願星' },
  { id: 'fox', emoji: '🦊', name: '聰明小狐狸' },
  { id: 'dolphin', emoji: '🐬', name: '微笑海豚' },
  { id: 'palette', emoji: '🎨', name: '魔法畫板' },
  { id: 'crown', emoji: '👑', name: '默書小公主' },
];

export const STORAGE_KEY_UNITS = 'p3_dictation_units_v4';
export const STORAGE_KEY_OLD_WORDS = 'p3_dictation_words_v3';
export const STORAGE_KEY_SETTINGS = 'p3_dictation_settings_v3';
export const STORAGE_KEY_REWARDS = 'p3_dictation_rewards_v2';

export const DEFAULT_SETTINGS: AppSettings = {
  accent: 'en-GB',
  shuffle: true,
  autoPlay: true,
  sentenceStrict: true,
  phraseStrict: false,
};

export const PRAISE_WORDS = [
  '好叻呀！完全正確！',
  '嘩！滿分表現！',
  '太犀利啦，一百分！',
  '串得非常準確！',
  '繼續保持，好棒！',
];

export const GRAMMAR_DECOYS: Record<string, string[]> = {
  want: ['wants', 'wanted', 'like'],
  wants: ['want', 'wanted', 'likes'],
  have: ['has', 'had', 'having'],
  has: ['have', 'had'],
  go: ['goes', 'going', 'went'],
  goes: ['go', 'going'],
  fly: ['flies', 'flying', 'play'],
  flies: ['fly', 'flying'],
  because: ['so', 'and', 'but'],
  beach: ['park', 'peach', 'camp'],
  barbecue: ['picnic', 'photos', 'sandcastles'],
  country: ['city', 'beach', 'garden'],
  kite: ['bike', 'cake', 'photos'],
  park: ['beach', 'camp', 'zoo'],
  she: ['he', 'her', 'they'],
  to: ['for', 'at', 'in'],
};
