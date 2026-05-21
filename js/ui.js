import { SUIT_NAMES, SUIT_SYMBOLS, rankName, isRed } from './config.js';
import { COMMANDERS, DEFENSE_COMMANDERS, getCommander } from './commanders.js';

export function renderPiles() {
  const supplyEl = document.getElementById('supply-pile');
  supplyEl.innerHTML = '';
  window.gameState.supply.forEach(card => {
    const el = document.createElement('div');
    el.className = 'pile-card';
    if (isRed(card.suit)) el.classList.add('red');
    el.innerHTML = `<div style="font-weight:bold">${rankName(card.rank)}</div><div>${SUIT_SYMBOLS[card.suit]}</div>`;
    if (window.gameState.phase === 'skill' && window.gameState.skillMode === 'select_supply') {
      el.classList.add('selectable-supply');
      el.onclick = () => window.onSupplyClick(card);
    }
    supplyEl.appendChild(el);
  });

  const discardEl = document.getElementById('discard-pile');
  discardEl.innerHTML = '';
  if (window.gameState.discard.length > 0) {
    const top = window.gameState.discard[window.gameState.discard.length - 1];
    const el = document.createElement('div');
    el.className = 'pile-card';
    if (isRed(top.suit)) el.classList.add('red');
    el.innerHTML = `<div style="font-weight:bold">${rankName(top.rank)}</div><div>${SUIT_SYMBOLS[top.suit]}</div>`;
    el.style.cursor = 'pointer';
    el.title = '点击查看全部弃牌';
    el.onclick = () => showDiscardModal();
    discardEl.appendChild(el);
  }
}

export function updateInfo() {
  document.getElementById('deck-count').textContent = window.gameState.deck.length;
  document.getElementById('discard-count').textContent = window.gameState.discard.length;
  document.getElementById('turn-count').textContent = window.gameState.turn;
  document.getElementById('enemy-count').textContent = window.gameState.enemies.filter(e => !e.defeated).length;
  document.getElementById('supply-count').textContent = window.gameState.supply.length;
  document.getElementById('supply-h').textContent = window.gameState.supply.filter(c => c.suit === 'hearts').length;
  document.getElementById('supply-d').textContent = window.gameState.supply.filter(c => c.suit === 'diamonds').length;
  document.getElementById('supply-c').textContent = window.gameState.supply.filter(c => c.suit === 'clubs').length;
  document.getElementById('supply-s').textContent = window.gameState.supply.filter(c => c.suit === 'spades').length;
}

export function setMessage(msg) {
  window.gameState.message = msg;
  document.getElementById('message').textContent = msg;
}

export function showDiscardModal() {
  if (window.gameState.discard.length === 0) return;
  const cards = window.gameState.discard.slice().reverse();
  const html = cards.map((c, i) => `${i === 0 ? '📌 顶部：' : ''}${SUIT_NAMES[c.suit]}${rankName(c.rank)} ${SUIT_SYMBOLS[c.suit]}`).join('<br>');
  showModal('🗑️ 弃牌堆', `共 ${window.gameState.discard.length} 张（从上到下）：<br><br>${html}`);
}

export function showModal(title, text) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-text').innerHTML = text;
  document.getElementById('modal-extra').innerHTML = '';
  document.getElementById('modal-overlay').classList.add('show');
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.remove('show');
}

export function showRules() {
  const tabs = [
    { id: 'basic', label: '基础规则' },
    { id: 'commander', label: '指挥官' },
    { id: 'defense', label: '城防扩展' }
  ];
  let html = `<div class="tab-bar">${tabs.map(t => `<button class="tab-btn" onclick="window.switchTab('${t.id}')">${t.label}</button>`).join('')}</div>`;

  html += `<div class="tab-content" id="tab-basic">
    <h4>🎴 基础规则</h4>
    <ul>
      <li><b>攻城</b>：每回合选一张手牌，再选一个未被覆盖的敌人。花色或点数相同则胜利，敌人进入物资；否则敌人明置，手牌弃掉。</li>
      <li><b>战术</b>：弃掉物资牌发动技能：♥️补给-抽3张 ♦️侦查-翻2张暗牌 ♣️强攻-击败明置 ♠️防御-代替手牌进弃牌</li>
      <li><b>协同</b>：弃两张同点数手牌，可发动任意技能。</li>
      <li><b>胜利</b>：击败全部16张敌人。<b>失败</b>：手牌和物资耗尽。</li>
    </ul>
    <h4>🎖️ 指挥官扩展</h4>
    <ul>
      <li>开始游戏前选择一位指挥官，不同指挥官初始手牌/物资/重调次数不同。</li>
      <li>每位指挥官拥有独特的战术技能，取代基础技能。</li>
      <li>部分技能为<b>被动技能</b>，满足条件时自动触发。</li>
    </ul>
  </div>`;

  html += `<div class="tab-content" id="tab-commander">
    ${Object.entries({...COMMANDERS, ...DEFENSE_COMMANDERS}).map(([key, cmd]) => `
      <h4>${cmd.icon} ${cmd.name}</h4>
      <div style="color:#aaa;margin-bottom:4px">🎴${cmd.hand} 📦${cmd.supply} 🔄${cmd.mulligan}</div>
      <div style="font-size:12px;line-height:1.6">${Object.values(cmd.skillDesc).join('<br>')}</div>
    `).join('')}
  </div>`;

  html += `<div class="tab-content" id="tab-defense">
    <h4>🏛️ 城防扩展（预留）</h4>
    <ul>
      <li><b>时间牌</b>：每回合时间牌会明置/暗置，代表白天/夜晚。</li>
      <li><b>城防效果</b>：白天时不能使用与时间牌同花色的手牌进行基本攻城。</li>
      <li><b>疲劳规则</b>：牌库第二次重洗时输掉游戏。</li>
      <li><b>回合阶段化</b>：时间流逝→侦查→攻城→补给。</li>
    </ul>
    <p style="color:#888">城防扩展的完整实现将在后续版本中更新。</p>
  </div>`;

  showModal('📖 游戏规则', html);
  setTimeout(() => {
    switchTab('basic');
  }, 10);
}

export function switchTab(id) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  const btn = Array.from(document.querySelectorAll('.tab-btn')).find(b => b.textContent.includes(id === 'basic' ? '基础' : id === 'commander' ? '指挥官' : '城防'));
  if (btn) btn.classList.add('active');
  const content = document.getElementById('tab-' + id);
  if (content) content.classList.add('active');
}

export function updateCommanderBar() {
  const bar = document.getElementById('commander-bar');
  const cmd = getCommander();
  if (!cmd) {
    bar.style.display = 'none';
    return;
  }
  bar.style.display = 'block';
  document.getElementById('cmd-title').textContent = `${cmd.icon} ${cmd.name}  🎴${cmd.hand} 📦${cmd.supply} 🔄${cmd.mulligan}`;
  const skillsDiv = document.getElementById('cmd-skills');
  skillsDiv.innerHTML = Object.entries(cmd.skillDesc).map(([suit, desc]) => {
    const short = desc.replace(/^[^\s]+\s/, ''); // 去掉花色前缀
    return `<span title="${desc}">${SUIT_SYMBOLS[suit]}${short}</span>`;
  }).join('');
}
