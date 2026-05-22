import { SUIT_NAMES, SUIT_SYMBOLS, rankName, isRed } from './config.js';
import { draw, computeCoverage, checkGameOver, isSelectable } from './core.js';
import { getCommander, COMMANDERS } from './commanders.js';

// ==================== 技能系统 ====================
export function showSkillPanel() {
  if (window.gameState.phase === 'mulligan' || window.gameState.phase === 'gameover') return;
  if (window.gameState.phase === 'skill') return;
  if (window.gameState.supply.length === 0) { window.setMessage('物资牌堆为空，无法发动战术技能！'); return; }
  window.gameState.phase = 'skill';
  window.gameState.skillMode = 'select_supply';
  window.gameState.selectedSupply = null;
  document.getElementById('skill-section').style.display = 'block';
  window.setMessage('点击物资牌堆中的牌发动对应战术，或选择协同/取消。');
  window.renderAll();
}

export function cancelSkill() {
  window.gameState.phase = 'playing';
  window.gameState.skillMode = null;
  window.gameState.selectedSupply = null;
  document.getElementById('skill-section').style.display = 'none';
  window.setMessage('已取消技能发动。');
  window.renderAll();
}

export function onSupplyClick(card) {
  if (window.gameState.phase !== 'skill' || window.gameState.skillMode !== 'select_supply') return;
  const cmd = getCommander() || COMMANDERS.novice;
  if (card.suit === 'hearts') {
    const done = cmd.onSkillHearts(card);
    if (done) { finishSkill(); }
  } else if (card.suit === 'diamonds') {
    const done = cmd.onSkillDiamonds(card);
    if (done) { finishSkill(); }
  } else if (card.suit === 'clubs') {
    const done = cmd.onSkillClubs(card);
    if (done) { finishSkill(); }
  } else if (card.suit === 'spades') {
    const done = cmd.onSkillSpades();
    if (done) { finishSkill(); }
  }
}

export function useSupplyCard(card, callback) {
  const idx = window.gameState.supply.findIndex(c => c.id === card.id);
  if (idx >= 0) window.gameState.discard.push(window.gameState.supply.splice(idx, 1)[0]);
  if (callback) callback();
}

export function finishSkill() {
  window.gameState.phase = 'playing';
  window.gameState.skillMode = null;
  window.gameState._revealedCount = 0;
  window.gameState._maxReveal = 0;
  document.getElementById('skill-section').style.display = 'none';
  window.renderAll();
}

// ==================== 技能子模式处理 ====================
export function handleSkillEnemySelect(enemy) {
  // 侦查 - 翻暗置牌
  if (window.gameState.skillMode === 'reveal') {
    if (enemy.revealed) { window.setMessage('该牌已经明置了！'); return; }
    if (!isSelectable(enemy)) { window.setMessage('该敌人被覆盖，无法选中！'); return; }
    enemy.revealed = true;
    window.gameState._revealedCount = (window.gameState._revealedCount || 0) + 1;
    window.setMessage(`♦️ 侦查：已将 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)} 翻为明置。(${window.gameState._revealedCount}/${window.gameState._maxReveal || 2})`);
    window.renderEnemies();
    if (window.gameState._revealedCount >= (window.gameState._maxReveal || 2)) finishSkill();
    return;
  }

  // 强攻 - 击败明置
  if (window.gameState.skillMode === 'attack') {
    if (!enemy.revealed) { window.setMessage('只能选择明置的敌人！'); return; }
    if (!isSelectable(enemy)) { window.setMessage('该敌人被覆盖，无法选中！'); return; }
    window.gameState.supply.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
    enemy.defeated = true;
    window.setMessage(`♣️ 强攻：直接击败了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}！`);
    computeCoverage();
    finishSkill();
    checkGameOver();
    window.renderAll();
    return;
  }

  // 火力压制 - 攻击暗置（先选手牌弃掉）
  if (window.gameState.skillMode === 'assault_dark') {
    if (enemy.revealed) { window.setMessage('此模式下请选择暗置敌人！'); return; }
    if (!isSelectable(enemy)) { window.setMessage('该敌人被覆盖，无法选中！'); return; }
    if (window.gameState._assaultDarkHand === undefined) { window.setMessage('请先选择一张手牌弃掉！'); return; }
    // 弃掉选择的手牌
    const handIdx = window.gameState._assaultDarkHand;
    window.gameState.discard.push(window.gameState.hand.splice(handIdx, 1)[0]);
    window.gameState.selectedHand = null;
    // 击败暗置敌人
    window.gameState.supply.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
    enemy.defeated = true;
    window.gameState._assaultDarkHand = undefined;
    window.setMessage(`♣️ 火力压制：弃掉手牌，击败了暗置的 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}！`);
    computeCoverage();
    finishSkill();
    checkGameOver();
    window.renderAll();
    return;
  }

  // 渗透打击 - 选择明置敌人作为"手牌"
  if (window.gameState.skillMode === 'infiltrate_pick') {
    if (!enemy.revealed) { window.setMessage('请选择一个明置敌人作为攻城手牌！'); return; }
    if (!isSelectable(enemy)) { window.setMessage('该敌人被覆盖，无法选中！'); return; }
    window.gameState._infiltrateWeapon = enemy;
    window.gameState.skillMode = 'infiltrate_target';
    window.setMessage(`♣️ 渗透打击：已选择 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)} 作为攻城手牌。现在选择另一个可选中的敌人进行攻城。`);
    window.renderAll();
    return;
  }

  // 渗透打击 - 对目标敌人攻城
  if (window.gameState.skillMode === 'infiltrate_target') {
    if (!isSelectable(enemy)) { window.setMessage('该敌人被覆盖，无法选中！'); return; }
    const weapon = window.gameState._infiltrateWeapon;
    if (weapon.id === enemy.id) { window.setMessage('不能选择同一个敌人作为攻击目标！'); return; }
    const success = (weapon.suit === enemy.suit) || (weapon.rank === enemy.rank);
    enemy.revealed = true;
    if (success) {
      // 武器保留原位且保持明置，目标进物资
      window.gameState.supply.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
      enemy.defeated = true;
      window.setMessage(`🎉 渗透打击成功！${SUIT_NAMES[weapon.suit]}${rankName(weapon.rank)} 击败了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}！武器保留原位。`);
    } else {
      // 武器被弃掉（从场上移除进入弃牌堆），目标明置但不进物资
      weapon.defeated = true;
      window.gameState.discard.push({ ...weapon, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
      window.setMessage(`💥 渗透打击失败！${SUIT_NAMES[weapon.suit]}${rankName(weapon.rank)} 被弃掉，${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)} 已明置。`);
    }
    window.gameState._infiltrateWeapon = undefined;
    computeCoverage();
    finishSkill();
    checkGameOver();
    window.renderAll();
    return;
  }

  // 谨慎侦查 - 翻暗置敌人
  if (window.gameState.skillMode === 'tactician_scout') {
    if (enemy.revealed) { window.setMessage('该牌已经明置了！'); return; }
    if (!isSelectable(enemy)) { window.setMessage('该敌人被覆盖，无法选中！'); return; }
    enemy.revealed = true;
    window.setMessage(`♦️ 谨慎侦查：已将 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)} 翻为明置。`);
    window.renderEnemies();
    // 弃牌堆顶一张牌
    const top = draw(1)[0];
    if (!top) { finishSkill(); return; }
    window.gameState.discard.push(top);
    window.setMessage(`♦️ 谨慎侦查：翻开了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}，牌堆顶是 ${SUIT_NAMES[top.suit]}${rankName(top.rank)}。`);
    window.renderAll();
    if (top.suit === enemy.suit) {
      const again = confirm(`牌堆顶 ${SUIT_NAMES[top.suit]}${rankName(top.rank)} 与敌人花色一致！是否继续侦查？`);
      if (again) {
        const revealables = window.gameState.enemies.filter(e => !e.defeated && !e.revealed && isSelectable(e));
        if (revealables.length === 0) { window.setMessage('没有更多可选中的暗置敌人了。'); finishSkill(); }
        return; // 继续等待玩家选择下一个敌人
      }
    } else {
      const swap = confirm(`牌堆顶 ${SUIT_NAMES[top.suit]}${rankName(top.rank)} 与敌人花色不一致。是否用一张已有物资牌与刚弃掉的牌交换？`);
      if (swap && window.gameState.supply.length > 0) {
        // 简单起见，用最后一张物资交换
        const sIdx = window.gameState.supply.length - 1;
        const sCard = window.gameState.supply[sIdx];
        const dIdx = window.gameState.discard.length - 1;
        window.gameState.supply[sIdx] = window.gameState.discard[dIdx];
        window.gameState.discard[dIdx] = sCard;
        window.setMessage(`♦️ 谨慎侦查：用物资牌 ${SUIT_NAMES[sCard.suit]}${rankName(sCard.rank)} 与弃牌 ${SUIT_NAMES[top.suit]}${rankName(top.rank)} 交换。`);
      }
    }
    finishSkill();
    return;
  }

  // 收割
  if (window.gameState.skillMode === 'harvest') {
    if (!enemy.revealed) { window.setMessage('只能选择明置的敌人！'); return; }
    if (!isSelectable(enemy)) { window.setMessage('该敌人被覆盖，无法选中！'); return; }
    const harvest = confirm(`是否将击败的 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)} 弃掉，从牌库抽一张牌替换为物资？`);
    if (harvest) {
      const drawn = draw(1)[0];
      if (drawn) {
        window.gameState.supply.push(drawn);
        window.setMessage(`♣️ 收割：击败了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}，弃掉后从牌库抽到 ${SUIT_NAMES[drawn.suit]}${rankName(drawn.rank)} 作为物资。`);
      } else {
        window.setMessage(`♣️ 收割：击败了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}，但牌库已空，无法替换。`);
      }
    } else {
      window.gameState.supply.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
      window.setMessage(`♣️ 收割：击败了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}，正常获得物资。`);
    }
    enemy.defeated = true;
    computeCoverage();
    finishSkill();
    checkGameOver();
    window.renderAll();
    return;
  }

  // 扰乱侦查 - 选择可选中敌人
  if (window.gameState.skillMode === 'disrupt') {
    if (!isSelectable(enemy)) { window.setMessage('该敌人被覆盖，无法选中！'); return; }
    window.gameState._disruptSource = enemy;
    window.gameState.skillMode = 'disrupt_target';
    window.setMessage('♦️ 扰乱侦查：现在选择一个与其相邻的暗置敌人交换位置。');
    window.renderAll();
    return;
  }

  // 扰乱侦查 - 选择相邻暗置敌人
  if (window.gameState.skillMode === 'disrupt_target') {
    if (enemy.revealed) { window.setMessage('请选择一个暗置敌人交换！'); return; }
    if (!isSelectable(enemy)) { window.setMessage('该敌人被覆盖，无法选中！'); return; }
    // 交换位置
    const src = window.gameState._disruptSource;
    const tmpPos = src.pos; src.pos = enemy.pos; enemy.pos = tmpPos;
    const tmpLayer = src.layer; src.layer = enemy.layer; enemy.layer = tmpLayer;
    const tmpIndex = src.index; src.index = enemy.index; enemy.index = tmpIndex;
    // 重新计算覆盖
    computeCoverage();
    // 翻转明暗
    let flippedDark = false;
    for (const e of window.gameState.enemies) {
      if (e.defeated) continue;
      if (!e.revealed && isSelectable(e)) { e.revealed = true; }
      else if (e.revealed && !isSelectable(e)) { e.revealed = false; flippedDark = true; }
    }
    if (flippedDark) {
      const drawn = draw(1);
      if (drawn.length > 0) window.gameState.hand.push(drawn[0]);
    }
    window.gameState._disruptSource = undefined;
    window.setMessage(`♦️ 扰乱侦查：交换完成，翻转明暗${flippedDark ? '，有敌人变暗置，抽1张牌' : ''}。`);
    computeCoverage();
    finishSkill();
    checkGameOver();
    window.renderAll();
    return;
  }

  // 推进
  if (window.gameState.skillMode === 'push') {
    if (!enemy.revealed) { window.setMessage('只能选择明置的敌人！'); return; }
    if (!isSelectable(enemy)) { window.setMessage('该敌人被覆盖，无法选中！'); return; }
    window.gameState.supply.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
    enemy.defeated = true;
    window.setMessage(`♣️ 推进：直接击败了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}！`);
    computeCoverage();
    // 检查是否有新可选中敌人
    const newOnes = window.gameState.enemies.filter(e => !e.defeated && isSelectable(e) && !e.revealed);
    if (newOnes.length > 0) {
      const nonClub = window.gameState.supply.filter(c => c.suit !== 'clubs');
      if (nonClub.length > 0) {
        window.gameState.skillMode = 'push_chain';
        window.setMessage(`♣️ 推进：产生了新的可选中敌人！可再消耗1张非♣️物资连锁击败（不获得奖励）。点击新敌人继续，或取消结束。`);
        window.renderAll();
        return;
      }
    }
    finishSkill();
    checkGameOver();
    window.renderAll();
    return;
  }

  // 推进连锁
  if (window.gameState.skillMode === 'push_chain') {
    if (!isSelectable(enemy)) { window.setMessage('该敌人被覆盖，无法选中！'); return; }
    const nonClub = window.gameState.supply.find(c => c.suit !== 'clubs');
    if (!nonClub) { window.setMessage('没有非♣️物资可用于连锁推进。'); finishSkill(); return; }
    const idx = window.gameState.supply.findIndex(c => c.id === nonClub.id);
    window.gameState.discard.push(window.gameState.supply.splice(idx, 1)[0]);
    window.gameState.supply.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
    enemy.defeated = true;
    window.setMessage(`♣️ 推进连锁：消耗${SUIT_NAMES[nonClub.suit]}${rankName(nonClub.rank)}，击败了${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}！`);
    computeCoverage();
    finishSkill();
    checkGameOver();
    window.renderAll();
    return;
  }

  // 突破战术 - 翻一张新敌人
  if (window.gameState.skillMode === 'breakthrough_reveal') {
    if (enemy.revealed) { window.setMessage('请选择暗置的敌人！'); return; }
    if (!isSelectable(enemy)) { window.setMessage('该敌人被覆盖，无法选中！'); return; }
    enemy.revealed = true;
    window.setMessage(`♠️ 突破战术：将新敌人 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)} 翻为明置。`);
    window.gameState.phase = 'playing';
    window.gameState.skillMode = null;
    document.getElementById('skill-section').style.display = 'none';
    window.finishAttack();
    return;
  }

  // 佯攻 - 选择明置敌人变暗置
  if (window.gameState.skillMode === 'feint') {
    if (!enemy.revealed) { window.setMessage('请选择一张明置敌人变为暗置！'); return; }
    enemy.revealed = false;
    window.gameState._feintDarkened = enemy;
    window.gameState.skillMode = 'feint_reveal';
    window.setMessage('♠️ 佯攻：已将一张明置敌人变暗置。现在选择另一张可选中的暗置敌人变为明置。');
    window.renderAll();
    return;
  }

  // 佯攻 - 选择暗置敌人变明置
  if (window.gameState.skillMode === 'feint_reveal') {
    if (enemy.revealed) { window.setMessage('请选择暗置敌人！'); return; }
    if (!isSelectable(enemy)) { window.setMessage('该敌人被覆盖，无法选中！'); return; }
    enemy.revealed = true;
    window.gameState._feintDarkened = undefined;
    window.gameState._skipHandRemove = true;
    window.setMessage(`♠️ 佯攻：已将 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)} 翻为明置。`);
    window.gameState.phase = 'playing';
    window.gameState.skillMode = null;
    document.getElementById('skill-section').style.display = 'none';
    window.finishAttack();
    return;
  }

  // 战术大师战争艺术额外效果
  if (window.gameState.skillMode === 'tactician_bonus') {
    const suits = window.gameState._tacticianSuits || 0;
    if (suits >= 2 && !enemy.revealed && isSelectable(enemy)) {
      enemy.revealed = true;
      window.setMessage(`♠️ 战争艺术：翻开了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}。`);
    } else if (suits >= 3) {
      const drawn = draw(1);
      if (drawn.length > 0) {
        window.gameState.hand.push(drawn[0]);
        window.setMessage(`♠️ 战争艺术：抽了 ${SUIT_NAMES[drawn[0].suit]}${rankName(drawn[0].rank)}。`);
      }
    }
    window.gameState._tacticianSuits = 0;
    window.gameState._skipHandRemove = true;
    window.gameState.phase = 'playing';
    window.gameState.skillMode = null;
    document.getElementById('skill-section').style.display = 'none';
    window.finishAttack();
    return;
  }
}

// ==================== 协同 ====================
export function activateSynergy() {
  if (window.gameState.phase !== 'skill') return;
  if (window.gameState.hand.length < 2) { window.setMessage('手牌不足2张，无法协同！'); return; }
  window.gameState.phase = 'synergy';
  window.gameState.synergyCards = [];
  window.setMessage('协同模式：请选择两张相同点数的手牌。');
  window.renderHand();
}

export function handleSynergyHandSelect(idx) {
  const card = window.gameState.hand[idx];
  const already = window.gameState.synergyCards.findIndex(c => c.idx === idx);
  if (already >= 0) {
    window.gameState.synergyCards.splice(already, 1);
    window.renderHand();
    return;
  }
  if (window.gameState.synergyCards.length >= 2) { window.setMessage('已选两张牌，请确认或重新选择。'); return; }
  if (window.gameState.synergyCards.length === 1 && window.gameState.synergyCards[0].card.rank !== card.rank) {
    window.setMessage('两张牌点数必须相同！'); return;
  }
  window.gameState.synergyCards.push({ idx, card });
  window.renderHand();
  if (window.gameState.synergyCards.length === 2) showSynergyChoice();
}

export function showSynergyChoice() {
  const choices = [
    { suit: 'hearts', label: '♥️ 补给 (抽3张)' },
    { suit: 'diamonds', label: '♦️ 侦查 (翻2张)' },
    { suit: 'clubs', label: '♣️ 强攻 (击败明置)' }
  ];
  const options = choices.map((c, i) => `${i+1}. ${c.label}`).join('\n');
  const input = prompt('协同成功！请选择要发动的技能：\n' + options);
  const choice = parseInt(input);
  if (choice >= 1 && choice <= 3) {
    const suit = choices[choice - 1].suit;
    const idxs = window.gameState.synergyCards.map(c => c.idx).sort((a, b) => b - a);
    for (const i of idxs) window.gameState.discard.push(window.gameState.hand.splice(i, 1)[0]);
    window.gameState.synergyCards = [];
    window.gameState.selectedHand = null;
    document.getElementById('skill-section').style.display = 'none';

    if (suit === 'hearts') {
      const drawn = draw(3);
      window.gameState.hand.push(...drawn);
      window.setMessage(`🔄 协同♥️ 补给！抽了 ${drawn.length} 张牌。`);
      window.gameState.phase = 'playing';
      window.renderAll();
    } else if (suit === 'diamonds') {
      const revealables = window.gameState.enemies.filter(e => !e.defeated && !e.revealed && isSelectable(e));
      if (revealables.length === 0) {
        window.setMessage('🔄 协同♦️ 侦查发动！但没有可选中的暗置牌。');
        window.gameState.phase = 'playing';
        window.renderAll();
        return;
      }
      window.gameState._maxReveal = Math.min(2, revealables.length);
      window.gameState.phase = 'skill';
      window.gameState.skillMode = 'reveal';
      window.setMessage(`🔄 协同♦️ 侦查！点击至多${window.gameState._maxReveal}张可选中的暗置敌人牌。`);
      window.renderAll();
    } else if (suit === 'clubs') {
      const attackables = window.gameState.enemies.filter(e => !e.defeated && e.revealed && isSelectable(e));
      if (attackables.length === 0) {
        window.setMessage('🔄 协同♣️ 强攻发动！但没有可击败的明置敌人。');
        window.gameState.phase = 'playing';
        window.renderAll();
        return;
      }
      window.gameState.phase = 'skill';
      window.gameState.skillMode = 'attack';
      window.setMessage('🔄 协同♣️ 强攻！点击一个明置的敌人牌直接击败。');
      window.renderAll();
    }
  } else {
    window.setMessage('取消协同。');
    window.gameState.synergyCards = [];
    window.gameState.phase = 'playing';
    document.getElementById('skill-section').style.display = 'none';
    window.renderAll();
  }
}
