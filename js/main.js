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

export function onEnemyClick(enemyId) {
  const enemy = window.gameState.enemies.find(e => e.id === enemyId);
  if (!enemy || enemy.defeated) return;

  if (window.gameState.phase === 'playing') {
    if (window.gameState.selectedHand === null) { window.setMessage('请先选择一张手牌！'); return; }
    if (!Core.isSelectable(enemy)) { window.setMessage('该敌人被其他牌覆盖，无法选中！'); return; }
    Combat.performAttack(window.gameState.hand[window.gameState.selectedHand], enemy);
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

document.addEventListener('DOMContentLoaded', () => {
  // 默认显示模式选择界面
});
