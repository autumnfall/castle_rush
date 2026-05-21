// ==================== 常量 ====================
export const SUITS = ['hearts', 'diamonds', 'clubs', 'spades'];
export const SUIT_SYMBOLS = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
export const SUIT_NAMES = { hearts: '红桃', diamonds: '方片', clubs: '梅花', spades: '黑桃' };
export const RANK_NAMES = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
export const RED_SUITS = new Set(['hearts', 'diamonds']);

export const LAYER_CONFIG = [
  { type: 'K', count: 4, positions: [0, 2, 4, 6] },
  { type: 'Q', count: 4, positions: [0, 2, 4, 6] },
  { type: 'Q', count: 3, positions: [1, 3, 5] },
  { type: 'J', count: 2, positions: [2, 4] },
  { type: 'J', count: 3, positions: [1, 3, 5] }
];

// ==================== 工具函数 ====================
export function createCard(suit, rank) {
  return { id: Math.random().toString(36).slice(2), suit, rank };
}

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function rankName(rank) {
  return RANK_NAMES[rank] || rank;
}

export function isRed(suit) {
  return RED_SUITS.has(suit);
}

export function rangesOverlap(a1, a2, b1, b2) {
  return a1 < b2 && a2 > b1;
}
