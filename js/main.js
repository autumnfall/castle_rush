import { SUIT_NAMES, rankName } from './config.js';
import { getCommander, COMMANDERS, DEFENSE_COMMANDERS } from './commanders.js';
import * as Core from './core.js';
import * as Combat from './combat.js';
import * as Skills from './skills.js';
import * as Board from './board.js';
import * as UI from './ui.js';

// ==================== 全局状态 ====================
window.gameState = {
  selectedMode: null,
  selectedCommander: null
};

// ==================== 渲染聚合 ====================
function renderAll() {
  Board.renderEnemies();
  Board.renderHand();
  UI.renderPiles();
  UI.updateInfo();
  if (window.gameState.message) {
    document.getElementById('message').textContent = window.gameState.message;
  }
}

// ==================== 将共享函数挂载到 window ====================
window.renderAll = renderAll;
window.renderEnemies = Board.renderEnemies;
window.renderHand = Board.renderHand;
window.setMessage = UI.setMessage;
window.updateCommanderBar = UI.updateCommanderBar;
window.showModal = UI.showModal;
window.switchTab = UI.switchTab;
window.useSupplyCard = Skills.useSupplyCard;
window.finishSkill = Skills.finishSkill;
window.finishAttack = Combat.finishAttack;
window.askDefense = Combat.askDefense;
window.askDefenseIntel = Combat.askDefenseIntel;
window.askDefenseTactician = Combat.askDefenseTactician;
window.askBlitzkriegDefense = askBlitzkriegDefense;
window.askAttritionDefense = askAttritionDefense;
window.skipPhase = skipPhase;
window.draw = Core.draw;
window.computeCoverage = Core.computeCoverage;
window.checkGameOver = Core.checkGameOver;
window.isSelectable = Core.isSelectable;
window.onSupplyClick = Skills.onSupplyClick;
window.performAttack = Combat.performAttack;

// ==================== 模式与指挥官选择 ====================
export function selectMode(mode) {
  window.gameState.selectedMode = mode;
  document.querySelectorAll('.mode-card').forEach(el => el.classList.remove('selected'));
  document.querySelector(`.mode-card[data-mode="${mode}"]`).classList.add('selected');
  const labels = { basic: '基础游戏', commander: '指挥官扩展', defense: '城防扩展', 'commander+defense': '指挥官+城防' };
  document.getElementById('btn-mode-confirm').textContent = `确认选择：${labels[mode]}`;
  document.getElementById('btn-mode-confirm').disabled = false;
}

export function confirmMode() {
  if (!window.gameState.selectedMode) return;
  if (window.gameState.selectedMode.includes('commander')) {
    showCommanderSelect();
  } else {
    startGame();
  }
}

export function showCommanderSelect() {
  document.getElementById('mode-select').classList.add('hidden');
  document.getElementById('commander-select').classList.remove('hidden');
  const list = document.getElementById('commander-list');
  list.innerHTML = '';

  const addCmd = (key, cmd) => {
    const el = document.createElement('div');
    el.className = 'commander-card';
    el.dataset.key = key;
    el.innerHTML = `
      <div class="cmd-name">${cmd.icon} ${cmd.name}</div>
      <div class="cmd-res">🎴${cmd.hand}  📦${cmd.supply}  🔄${cmd.mulligan}</div>
      <div class="cmd-desc">${cmd.desc}</div>
    `;
    el.onclick = () => selectCommander(key, cmd, el);
    list.appendChild(el);
  };

  // 新手指挥官
  addCmd('novice', COMMANDERS.novice);
  // 基础指挥官
  addCmd('logistics', COMMANDERS.logistics);
  addCmd('intel', COMMANDERS.intel);
  addCmd('tactician', COMMANDERS.tactician);
  addCmd('assault', COMMANDERS.assault);
  // 城防指挥官
  if (window.gameState.selectedMode.includes('defense')) {
    addCmd('blitzkrieg', DEFENSE_COMMANDERS.blitzkrieg);
    addCmd('attrition', DEFENSE_COMMANDERS.attrition);
  }
}

export function selectCommander(key, cmd, el) {
  window.gameState.selectedCommander = key;
  document.querySelectorAll('.commander-card').forEach(c => c.classList.remove('selected'));
  el.classList.add('selected');
  const detail = document.getElementById('commander-detail');
  detail.innerHTML = `<b style="color:#ffd700">${cmd.icon} ${cmd.name}</b><br>
    <span style="color:#aaa">初始手牌 ${cmd.hand} 张 | 初始物资 ${cmd.supply} 张 | 重调 ${cmd.mulligan} 次</span><br><br>
    ${Object.values(cmd.skillDesc).map(d => `• ${d}`).join('<br>')}`;
  document.getElementById('btn-cmd-confirm').textContent = `确认选择：${cmd.name}`;
  document.getElementById('btn-cmd-confirm').disabled = false;
}

export function confirmCommander() {
  if (!window.gameState.selectedCommander) return;
  startGame();
}

export function backToMode() {
  document.getElementById('commander-select').classList.add('hidden');
  document.getElementById('mode-select').classList.remove('hidden');
  window.gameState.selectedCommander = null;
  document.getElementById('btn-cmd-confirm').disabled = true;
}

export function startGame() {
  document.getElementById('mode-select').classList.add('hidden');
  document.getElementById('commander-select').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  Core.initGame();
}

// ==================== 核心交互 ====================
export function onHandCardClick(idx) {
  if (window.gameState.phase !== 'playing' && window.gameState.phase !== 'synergy' && window.gameState.phase !== 'skill') return;

  // 火力压制 - 选择手牌弃掉
  if (window.gameState.phase === 'skill' && window.gameState.skillMode === 'assault_dark') {
    window.gameState._assaultDarkHand = idx;
    window.setMessage('已选择手牌弃掉，现在点击一个可选中的暗置敌人进行击败。');
    Board.renderHand();
    return;
  }

  if (window.gameState.phase === 'synergy') { Skills.handleSynergyHandSelect(idx); return; }
  if (window.gameState.selectedHand === idx) window.gameState.selectedHand = null;
  else window.gameState.selectedHand = idx;
  Board.renderHand();
  Board.renderEnemies();
}

// ==================== 城防扩展指挥官被动技能 ====================
export function skipPhase() {
  if (!Core.isDefenseExpansion()) return;
  if (window.gameState.turnPhase === 'time_flow') {
    window.setMessage('⏳ 时间流逝阶段无法跳过！');
    return;
  }
  Core.advanceTurnPhase();
  window.renderAll();
}

export function askBlitzkriegDefense(handCard, enemy, defense) {
  const useDef = confirm(`是否发动 ♠️ 缓兵之计？用♠️${rankName(defense.rank)}代替原手牌进入弃牌堆。`);
  if (useDef) {
    const idx = window.gameState.supply.findIndex(c => c.id === defense.id);
    window.gameState.discard.push(window.gameState.supply.splice(idx, 1)[0]);
    window.gameState._skipHandRemove = true;
    const timeDeck = window.gameState.timeDeck;
    const hasDark = timeDeck.some(t => !t.revealed);
    let msg = '♠️ 缓兵之计发动！';
    if (hasDark) {
      const discardTime = confirm('是否弃置时间牌堆中1张暗置牌？（取消则抽1张牌）');
      if (discardTime) {
        const darkIdx = timeDeck.findIndex(t => !t.revealed);
        if (darkIdx >= 0) {
          const darkCard = timeDeck.splice(darkIdx, 1)[0];
          window.gameState.discard.push(darkCard);
          msg += '已弃置1张暗置时间牌。';
        }
      } else {
        const drawn = Core.draw(1);
        if (drawn.length > 0) {
          window.gameState.hand.push(drawn[0]);
          msg += `抽了${SUIT_NAMES[drawn[0].suit]}${rankName(drawn[0].rank)}。`;
        }
      }
    } else {
      const drawn = Core.draw(1);
      if (drawn.length > 0) {
        window.gameState.hand.push(drawn[0]);
        msg += `抽了${SUIT_NAMES[drawn[0].suit]}${rankName(drawn[0].rank)}。`;
      }
    }
    window.gameState.supply.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
    enemy.defeated = true;
    window.setMessage(msg);
    window.finishAttack();
  } else {
    window.gameState.discard.push(handCard);
    window.gameState.supply.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
    enemy.defeated = true;
    window.setMessage(`🎉 攻城成功！${SUIT_NAMES[handCard.suit]}${rankName(handCard.rank)} 击败了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}！`);
    window.finishAttack();
  }
}

export function askAttritionDefense(handCard, enemy, defense) {
  const useDef = confirm(`是否发动 ♠️ 修整战术？用♠️${rankName(defense.rank)}代替原手牌进入弃牌堆。`);
  if (useDef) {
    const idx = window.gameState.supply.findIndex(c => c.id === defense.id);
    window.gameState.discard.push(window.gameState.supply.splice(idx, 1)[0]);
    window.gameState._skipHandRemove = true;
    const peekCount = window.gameState.timeDeck.length;
    const temp = [];
    for (let i = 0; i < peekCount; i++) {
      if (window.gameState.deck.length === 0) break;
      temp.push(window.gameState.deck.pop());
    }
    let msg = '♠️ 修整战术发动！';
    if (temp.length > 0) {
      const options = temp.map((c, i) => `${i+1}. ${SUIT_NAMES[c.suit]}${rankName(c.rank)}`).join('\n');
      const input = prompt(`从牌库查看${temp.length}张牌，选择1张加入手牌（输入编号，取消则都不选）：\n${options}`);
      const choice = parseInt(input);
      if (choice >= 1 && choice <= temp.length) {
        window.gameState.hand.push(temp[choice - 1]);
        msg += `选择了${SUIT_NAMES[temp[choice-1].suit]}${rankName(temp[choice-1].rank)}加入手牌。`;
        // 其余按 reverse 顺序放回牌库顶
        for (let i = temp.length - 1; i >= 0; i--) {
          if (i !== choice - 1) {
            window.gameState.deck.push(temp[i]);
          }
        }
      } else {
        msg += '没有选择牌。';
        // 全部按 reverse 顺序放回
        for (let i = temp.length - 1; i >= 0; i--) {
          window.gameState.deck.push(temp[i]);
        }
      }
    } else {
      msg += '牌库已空，无法查看。';
    }
    window.setMessage(msg);
    window.finishAttack();
  } else {
    window.gameState.discard.push(handCard);
    window.setMessage(`💥 攻城失败！${SUIT_NAMES[handCard.suit]}${rankName(handCard.rank)} 无法攻克 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}。敌人已明置。`);
    window.finishAttack();
  }
}

export function onEnemyClick(enemyId) {
  const enemy = window.gameState.enemies.find(e => e.id === enemyId);
  if (!enemy || enemy.defeated) return;

  if (window.gameState.phase === 'playing') {
    if (window.gameState.selectedHand === null) { window.setMessage('请先选择一张手牌！'); return; }
    if (!Core.isSelectable(enemy)) { window.setMessage('该敌人被其他牌覆盖，无法选中！'); return; }
    const handCard = window.gameState.hand[window.gameState.selectedHand];
    // 城防扩展：白天城防限制检查
    const isDef = (window.gameState.selectedMode === 'defense' || window.gameState.selectedMode === 'commander+defense');
    if (isDef && window.gameState.turnPhase === 'siege') {
      const timeDeck = window.gameState.timeDeck;
      const timeTop = timeDeck.length > 0 ? timeDeck[timeDeck.length - 1] : null;
      if (timeTop && timeTop.revealed && timeTop.suit === handCard.suit) {
        // 查找可弃的手牌（同花色或同点数）
        const bypassIdx = window.gameState.hand.findIndex((c, i) => i !== window.gameState.selectedHand && (c.suit === timeTop.suit || c.rank === timeTop.rank));
        if (bypassIdx >= 0) {
          const bypassCard = window.gameState.hand[bypassIdx];
          const bypass = confirm(`🏛️ 城防限制：白天不能使用 ${handCard.suit} 手牌攻城！\n是否弃掉 ${bypassCard.suit}${bypassCard.rank} 来忽略城防？`);
          if (bypass) {
            window.gameState.discard.push(window.gameState.hand.splice(bypassIdx, 1)[0]);
            window.setMessage('已弃牌忽略城防，继续攻城！');
            window.renderAll();
          } else {
            window.setMessage('城防限制：请选择其他花色的手牌。');
            return;
          }
        } else {
          window.setMessage('城防限制：你没有可弃的同花色/同点数手牌来忽略城防。');
          return;
        }
      }
    }
    Combat.performAttack(handCard, enemy);
  } else if (window.gameState.phase === 'skill') {
    Skills.handleSkillEnemySelect(enemy);
  }
}

// ==================== 重置 ====================
export function resetGame() {
  window.gameState.selectedCommander = null;
  window.gameState.selectedMode = null;
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('commander-select').classList.add('hidden');
  document.getElementById('mode-select').classList.remove('hidden');
  document.querySelectorAll('.mode-card').forEach(el => el.classList.remove('selected'));
  document.getElementById('btn-mode-confirm').textContent = '请选择游戏模式';
  document.getElementById('btn-mode-confirm').disabled = true;
}

// ==================== 事件绑定 ====================
window.onHandCardClick = onHandCardClick;
window.onEnemyClick = onEnemyClick;

// 暴露给 HTML 内联事件的函数
window.selectMode = selectMode;
window.confirmMode = confirmMode;
window.confirmCommander = confirmCommander;
window.backToMode = backToMode;
window.resetGame = resetGame;
window.showSkillPanel = Skills.showSkillPanel;
window.cancelSkill = Skills.cancelSkill;
window.activateSynergy = Skills.activateSynergy;
window.doMulligan = Core.doMulligan;
window.confirmMulligan = Core.confirmMulligan;
window.showRules = UI.showRules;
window.closeModal = UI.closeModal;
window.isDefenseExpansion = Core.isDefenseExpansion;
window.doTimeFlow = Core.doTimeFlow;
window.advanceTurnPhase = Core.advanceTurnPhase;

document.addEventListener('DOMContentLoaded', () => {
  // 默认显示模式选择界面
});
