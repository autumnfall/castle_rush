import { SUIT_SYMBOLS, rankName, isRed } from './config.js';
import { isSelectable } from './core.js';

export function renderEnemies() {
  const board = document.getElementById('board-area');
  board.innerHTML = '';
  const style = getComputedStyle(document.documentElement);
  const cardW = parseInt(style.getPropertyValue('--board-card-w')) || 72;
  const gap = parseInt(style.getPropertyValue('--board-gap')) || 18;
  const baseX = parseInt(style.getPropertyValue('--board-base-x')) || 30;
  const stepY = parseInt(style.getPropertyValue('--board-step-y')) || 52;
  const baseY = 0;

  for (const enemy of window.gameState.enemies) {
    if (enemy.defeated) continue;
    const el = document.createElement('div');
    el.className = 'enemy-card';
    if (enemy.revealed) {
      el.classList.add('front');
      if (isRed(enemy.suit)) el.classList.add('red');
      el.innerHTML = `<div class="rank">${rankName(enemy.rank)}</div><div class="suit">${SUIT_SYMBOLS[enemy.suit]}</div>`;
    } else {
      el.classList.add('back');
      el.textContent = '?';
    }

    const selectable = isSelectable(enemy);
    if (selectable && window.gameState.phase === 'playing') el.classList.add('selectable');
    if (window.gameState.phase === 'skill' && window.gameState.skillMode === 'reveal' && selectable && !enemy.revealed) el.classList.add('selectable');
    if (window.gameState.phase === 'skill' && window.gameState.skillMode === 'attack' && selectable && enemy.revealed) el.classList.add('selectable');
    if (window.gameState.phase === 'skill' && window.gameState.skillMode === 'assault_dark' && selectable && !enemy.revealed) el.classList.add('selectable');
    if (window.gameState.phase === 'skill' && window.gameState.skillMode === 'infiltrate_pick' && selectable && enemy.revealed) el.classList.add('selectable');
    if (window.gameState.phase === 'skill' && window.gameState.skillMode === 'infiltrate_target' && selectable && enemy.id !== window.gameState._infiltrateWeapon?.id) el.classList.add('selectable');
    if (window.gameState.phase === 'skill' && window.gameState.skillMode === 'tactician_scout' && selectable && !enemy.revealed) el.classList.add('selectable');
    if (window.gameState.phase === 'skill' && window.gameState.skillMode === 'harvest' && selectable && enemy.revealed) el.classList.add('selectable');
    const coversDark = window.gameState.enemies.some(other => other.id !== enemy.id && !other.defeated && !other.revealed && other.coveredBy.includes(enemy.id));
    if (window.gameState.phase === 'skill' && window.gameState.skillMode === 'disrupt' && selectable && coversDark) el.classList.add('selectable');
    const src = window.gameState._disruptSource;
    const coveredBySrc = src && enemy.coveredBy.includes(src.id);
    if (window.gameState.phase === 'skill' && window.gameState.skillMode === 'disrupt_target' && coveredBySrc && !enemy.revealed) el.classList.add('selectable');
    if (window.gameState.phase === 'skill' && window.gameState.skillMode === 'push' && selectable && enemy.revealed) el.classList.add('selectable');
    if (window.gameState.phase === 'skill' && window.gameState.skillMode === 'push_chain' && selectable && window.gameState._pushNewIds?.includes(enemy.id)) el.classList.add('selectable');
    if (window.gameState.phase === 'skill' && window.gameState.skillMode === 'breakthrough_reveal' && selectable && !enemy.revealed && window.gameState._breakthroughNewIds?.includes(enemy.id)) el.classList.add('selectable');
    if (window.gameState.phase === 'skill' && window.gameState.skillMode === 'feint' && enemy.revealed) el.classList.add('selectable');
    if (window.gameState.phase === 'skill' && window.gameState.skillMode === 'blitzkrieg_scout' && selectable && !enemy.revealed) el.classList.add('selectable');
    if (window.gameState.phase === 'skill' && window.gameState.skillMode === 'blitzkrieg_assault' && selectable && enemy.revealed) el.classList.add('selectable');
    if (window.gameState.phase === 'skill' && window.gameState.skillMode === 'feint_reveal' && selectable && !enemy.revealed && enemy.id !== window.gameState._feintDarkened?.id) el.classList.add('selectable');
    if (window.gameState.phase === 'skill' && window.gameState.skillMode === 'tactician_bonus' && selectable && !enemy.revealed) el.classList.add('selectable');

    el.style.left = (baseX + enemy.pos * (cardW / 2 + gap / 2)) + 'px';
    el.style.top = (baseY + enemy.layer * stepY) + 'px';
    el.onclick = () => window.onEnemyClick(enemy.id);
    board.appendChild(el);
  }
}

export function renderHand() {
  const container = document.getElementById('hand-container');
  container.innerHTML = '';
  window.gameState.hand.forEach((card, idx) => {
    const el = document.createElement('div');
    el.className = 'hand-card';
    if (isRed(card.suit)) el.classList.add('red');
    el.innerHTML = `<div class="rank">${rankName(card.rank)}</div><div class="suit">${SUIT_SYMBOLS[card.suit]}</div>`;
    if (window.gameState.selectedHand === idx) el.classList.add('selected');
    if (window.gameState.phase === 'synergy') {
      const selected = window.gameState.synergyCards.find(c => c.idx === idx);
      if (selected) el.classList.add('synergy-target');
    }
    if (window.gameState.phase === 'skill' && window.gameState.skillMode === 'assault_dark' && window.gameState._assaultDarkHand === idx) {
      el.classList.add('synergy-target');
    }
    el.onclick = () => window.onHandCardClick(idx);
    container.appendChild(el);
  });
}
