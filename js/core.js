import { createCard, shuffle, LAYER_CONFIG } from './config.js';
import { getCommander } from './commanders.js';

// ==================== 城防扩展辅助 ====================
export function isDefenseExpansion() {
  const mode = window.gameState?.selectedMode;
  return mode === 'defense' || mode === 'commander+defense';
}

// ==================== 初始化 ====================
export function initGame() {
  const cmd = getCommander();
  const handSize = cmd ? cmd.hand : 5;
  const supplySize = cmd ? cmd.supply : 2;
  const mulliganLimit = cmd ? cmd.mulligan : 2;

  const fullDeck = [];
  for (const suit of ['hearts', 'diamonds', 'clubs', 'spades']) {
    for (let r = 1; r <= 13; r++) {
      fullDeck.push(createCard(suit, r));
    }
  }

  const kings = shuffle(fullDeck.filter(c => c.rank === 13));
  const queens = shuffle(fullDeck.filter(c => c.rank === 12));
  const jacks = shuffle(fullDeck.filter(c => c.rank === 11));
  const normalCards = shuffle(fullDeck.filter(c => c.rank !== 13 && c.rank !== 12 && c.rank !== 11));

  const enemies = [];
  const layer0Cards = kings.slice(0, 4);
  for (let i = 0; i < 4; i++) {
    enemies.push({ ...layer0Cards[i], layer: 0, index: i, pos: LAYER_CONFIG[0].positions[i], revealed: false, defeated: false, coveredBy: [] });
  }
  const hallCards = shuffle([...queens.slice(0, 3), ...normalCards.slice(0, 4)]);
  for (let i = 0; i < 4; i++) {
    enemies.push({ ...hallCards[i], layer: 1, index: i, pos: LAYER_CONFIG[1].positions[i], revealed: false, defeated: false, coveredBy: [] });
  }
  for (let i = 0; i < 3; i++) {
    enemies.push({ ...hallCards[4 + i], layer: 2, index: i, pos: LAYER_CONFIG[2].positions[i], revealed: false, defeated: false, coveredBy: [] });
  }
  const gateCards = shuffle([...jacks.slice(0, 2), ...normalCards.slice(4, 7)]);
  for (let i = 0; i < 2; i++) {
    enemies.push({ ...gateCards[i], layer: 3, index: i, pos: LAYER_CONFIG[3].positions[i], revealed: false, defeated: false, coveredBy: [] });
  }
  for (let i = 0; i < 3; i++) {
    enemies.push({ ...gateCards[2 + i], layer: 4, index: i, pos: LAYER_CONFIG[4].positions[i], revealed: false, defeated: false, coveredBy: [] });
  }

  const playerDeck = shuffle([...normalCards.slice(7), ...queens.slice(3), ...jacks.slice(2)]);

  const selectedMode = window.gameState.selectedMode;
  const selectedCommander = window.gameState.selectedCommander;
  const defenseMode = selectedMode === 'defense' || selectedMode === 'commander+defense';
  window.gameState = {
    selectedMode,
    selectedCommander,
    deck: playerDeck,
    hand: [],
    supply: [],
    discard: [],
    enemies: enemies,
    phase: 'mulligan',
    selectedHand: null,
    selectedSupply: null,
    skillMode: null,
    synergyCards: [],
    mulliganCount: 0,
    mulliganLimit: mulliganLimit,
    turn: 1,
    message: '请抽取初始手牌并选择是否重调',
    // 城防扩展字段
    turnPhase: defenseMode ? 'time_flow' : null,
    timeDeck: [],
    reshuffleCount: 0,
    phaseActions: {}
  };

  computeCoverage();
  drawHand(handSize);
  drawToSupply(supplySize);

  window.renderAll();
  window.updateCommanderBar();
  showMulligan();
}

// ==================== 覆盖逻辑 ====================
export function computeCoverage() {
  for (const e of window.gameState.enemies) e.coveredBy = [];
  for (let lower = 1; lower <= 4; lower++) {
    for (let upper = 0; upper < lower; upper++) {
      const lowerCards = window.gameState.enemies.filter(e => e.layer === lower && !e.defeated);
      const upperCards = window.gameState.enemies.filter(e => e.layer === upper && !e.defeated);
      for (const l of lowerCards) {
        for (const u of upperCards) {
          if (rangesOverlap(l.pos - 1, l.pos + 1, u.pos - 1, u.pos + 1)) {
            if (!u.coveredBy.includes(l.id)) u.coveredBy.push(l.id);
          }
        }
      }
    }
  }
}

function rangesOverlap(a1, a2, b1, b2) { return a1 < b2 && a2 > b1; }

export function isSelectable(enemy) { return !enemy.defeated && enemy.coveredBy.length === 0; }

// ==================== 抽牌 ====================
export function draw(count) {
  const drawn = [];
  for (let i = 0; i < count; i++) {
    if (window.gameState.deck.length === 0) {
      if (window.gameState.discard.length === 0) break;
      if (isDefenseExpansion() && window.gameState.reshuffleCount >= 1) {
        window.gameState.phase = 'gameover';
        window.showModal('💀 疲劳溃败', '牌库第二次重洗，军队疲惫不堪，你输掉了游戏。');
        window.renderAll();
        break;
      }
      window.gameState.deck = shuffle([...window.gameState.discard]);
      window.gameState.discard = [];
      if (isDefenseExpansion()) window.gameState.reshuffleCount++;
    }
    if (window.gameState.deck.length > 0) drawn.push(window.gameState.deck.pop());
  }
  return drawn;
}

export function drawHand(count) { window.gameState.hand.push(...draw(count)); }
export function drawToSupply(count) { window.gameState.supply.push(...draw(count)); }

// ==================== 重调 ====================
export function showMulligan() {
  document.getElementById('mulligan-bar').style.display = 'flex';
  document.getElementById('btn-mulligan').disabled = false;
  document.getElementById('mulligan-left').textContent = Math.max(0, window.gameState.mulliganLimit - window.gameState.mulliganCount);
  window.setMessage('这是你的初始手牌。如不满意可以重调，最多' + window.gameState.mulliganLimit + '次。');
}

export function doMulligan() {
  if (window.gameState.mulliganCount >= window.gameState.mulliganLimit) return;
  window.gameState.deck.push(...window.gameState.hand);
  window.gameState.hand = [];
  window.gameState.deck = shuffle(window.gameState.deck);
  drawHand(getCommander() ? getCommander().hand : 5);
  window.gameState.mulliganCount++;
  document.getElementById('mulligan-left').textContent = Math.max(0, window.gameState.mulliganLimit - window.gameState.mulliganCount);
  if (window.gameState.mulliganCount >= window.gameState.mulliganLimit) document.getElementById('btn-mulligan').disabled = true;
  window.gameState.selectedHand = null;
  window.renderAll();
  window.setMessage('已重调手牌，还剩 ' + Math.max(0, window.gameState.mulliganLimit - window.gameState.mulliganCount) + ' 次机会。');
}

export function confirmMulligan() {
  document.getElementById('mulligan-bar').style.display = 'none';
  window.gameState.phase = 'playing';
  const cmdName = getCommander() ? getCommander().name : '基础规则';
  if (isDefenseExpansion()) {
    doTimeFlow();
    advanceTurnPhase();
    window.setMessage(`【${cmdName}】游戏开始！${window.gameState.message}`);
  } else {
    window.setMessage(`【${cmdName}】游戏开始！点击手牌选中，再点击可选中的敌人进行攻城。`);
  }
  window.renderAll();
}

// ==================== 胜负判定 ====================
export function checkGameOver() {
  const remaining = window.gameState.enemies.filter(e => !e.defeated);
  if (remaining.length === 0) {
    window.gameState.phase = 'gameover';
    const score = window.gameState.hand.length + window.gameState.supply.length;
    window.showModal('🏆 胜利！', `你成功攻破了城堡！\n剩余手牌: ${window.gameState.hand.length} 张\n剩余物资: ${window.gameState.supply.length} 张\n总分参考: ${score}`);
    return;
  }
  if (window.gameState.hand.length === 0 && window.gameState.supply.length === 0) {
    window.gameState.phase = 'gameover';
    window.showModal('💀 失败', '手牌和物资均已耗尽，无法继续攻城。再试一次吧！');
    return;
  }
}

// ==================== 城防扩展：时间流逝 ====================
export function doTimeFlow() {
  if (!isDefenseExpansion()) return;
  const td = window.gameState.timeDeck;
  const top = td.length > 0 ? td[td.length - 1] : null;
  if (top && top.revealed) {
    // 有明置牌 → 翻为暗置（进入夜晚）
    top.revealed = false;
  } else {
    // 无明置牌 → 从牌库抽一张明置（进入白天）
    const drawn = draw(1);
    if (drawn.length > 0) {
      drawn[0].revealed = true;
      td.push(drawn[0]);
    }
  }
}

// ==================== 城防扩展：阶段推进 ====================
export function advanceTurnPhase() {
  if (!isDefenseExpansion()) return;
  const phases = ['time_flow', 'scout', 'siege', 'supply'];
  const idx = phases.indexOf(window.gameState.turnPhase);
  if (idx < 0) return;
  window.gameState.phaseActions = {};
  if (idx < phases.length - 1) {
    window.gameState.turnPhase = phases[idx + 1];
    const phaseMessages = { scout: '🕵️ 侦查阶段：可使用♦️技能', siege: '⚔️ 攻城阶段：可攻城或使用♣️技能', supply: '📦 补给阶段：可使用♥️技能' };
    window.setMessage(phaseMessages[window.gameState.turnPhase] || window.gameState.message);
  } else {
    // supply 结束 → 下一回合，自动执行时间流逝并进入 scout
    window.gameState.turn++;
    doTimeFlow();
    window.gameState.turnPhase = 'scout';
    window.setMessage(`⏳ 第${window.gameState.turn}回合开始 - 🕵️ 侦查阶段：可使用♦️技能`);
  }
  window.renderAll();
}
