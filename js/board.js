import { SUIT_SYMBOLS, SUIT_NAMES, rankName, isRed } from './config.js';
import { isSelectable } from './core.js';

export function renderEnemies() {
  const board = document.getElementById('board-area');
  board.innerHTML = '';
  for (const enemy of window.gameState.enemies) {
    if (enemy.defeated) continue;
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'enemy-card';
    if (enemy.revealed) {
      el.classList.add('front');
      if (isRed(enemy.suit)) el.classList.add('red');
      el.innerHTML = `<span class="rank">${rankName(enemy.rank)}</span><span class="suit">${SUIT_SYMBOLS[enemy.suit]}</span>`;
    } else {
      el.classList.add('back');
      el.setAttribute('aria-label', '暗置敌人');
    }

    if (enemy.revealed) el.setAttribute('aria-label', `${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}敌人`);
    const selectable = isSelectable(enemy);
    if (selectable && window.gameState.phase === 'playing') {
      const isDef = (window.gameState.selectedMode === 'defense' || window.gameState.selectedMode === 'commander+defense');
      if (isDef && window.gameState.turnPhase === 'siege' && window.gameState.phaseActions?.attack) {
        // 城防扩展：siege 阶段已攻城，敌人不再可点击
      } else {
        el.classList.add('selectable');
      }
    }
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

    // 保持原有牌阵的相对间距，让棋盘可以随屏幕宽度缩放。
    el.style.left = `${enemy.pos * (45 / 342) * 100}%`;
    el.style.top = `calc(${enemy.layer} * var(--row-step))`;
    el.tabIndex = el.classList.contains('selectable') ? 0 : -1;
    el.onclick = () => window.onEnemyClick(enemy.id);
    board.appendChild(el);
  }
}

export function renderHand() {
  const container = document.getElementById('hand-container');
  const focusedIndex = Array.from(container.children).indexOf(document.activeElement);
  container.innerHTML = '';
  window.gameState.hand.forEach((card, idx) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'hand-card';
    if (isRed(card.suit)) el.classList.add('red');
    el.innerHTML = `<span class="rank">${rankName(card.rank)}</span><span class="suit">${SUIT_SYMBOLS[card.suit]}</span>`;
    if (window.gameState.selectedHand === idx) el.classList.add('selected');
    if (window.gameState.phase === 'synergy') {
      const selected = window.gameState.synergyCards.find(c => c.idx === idx);
      if (selected) el.classList.add('synergy-target');
    }
    if (window.gameState.phase === 'skill' && window.gameState.skillMode === 'assault_dark' && window.gameState._assaultDarkHand === idx) {
      el.classList.add('synergy-target');
    }
    el.setAttribute('aria-label', `${SUIT_NAMES[card.suit]}${rankName(card.rank)}手牌`);
    el.setAttribute('aria-pressed', String(el.matches('.selected, .synergy-target')));
    el.onclick = () => window.onHandCardClick(idx);
    container.appendChild(el);
  });
  container.children[focusedIndex]?.focus({ preventScroll: true });
}
