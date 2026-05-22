import { SUIT_NAMES, SUIT_SYMBOLS, rankName, isRed } from './config.js';
import { draw, computeCoverage, checkGameOver, isSelectable } from './core.js';
import { getCommander, COMMANDERS } from './commanders.js';

// ==================== 技能系统 ====================
export function showSkillPanel() {
  if (window.gameState.phase === 'mulligan' || window.gameState.phase === 'gameover') return;
  if (window.gameState.phase === 'skill') return;
  if (window.gameState.supply.length === 0 && window.gameState.hand.length < 2) { window.setMessage('物资牌堆为空且手牌不足2张，无法发动战术技能！'); return; }
  window.gameState.phase = 'skill';
  window.gameState.skillMode = 'select_supply';
  window.gameState.selectedSupply = null;
  document.getElementById('skill-section').style.display = 'block';
  window.setMessage(window.gameState.supply.length === 0
    ? '物资牌堆为空，只能选择协同或取消。'
    : '点击物资牌堆中的牌发动对应战术，或选择协同/取消。');
  window.renderAll();
}

export function cancelSkill() {
  // 处理攻击/防御流程中触发的异步子模式，取消后需正确结束攻击流程
  const asyncModes = ['breakthrough_reveal', 'tactician_bonus', 'feint', 'feint_reveal'];
  if (window.gameState.phase === 'skill' && asyncModes.includes(window.gameState.skillMode)) {
    window.gameState._breakthroughNewIds = undefined;
    window.gameState._tacticianBonusMode = undefined;
    window.gameState._feintDarkened = undefined;
    window.gameState.phase = 'playing';
    window.gameState.skillMode = null;
    document.getElementById('skill-section').style.display = 'none';
    window.setMessage('已取消，回到正常阶段。');
    const isDef = (window.gameState.selectedMode === 'defense' || window.gameState.selectedMode === 'commander+defense');
    if (isDef) {
      // 城防扩展：取消后回到当前阶段，不推进
      window.renderAll();
    } else {
      window.finishAttack();
    }
    return;
  }
  window.gameState.phase = 'playing';
  window.gameState.skillMode = null;
  window.gameState.selectedSupply = null;
  document.getElementById('skill-section').style.display = 'none';
  window.setMessage('已取消技能发动。');
  window.renderAll();
}

export function onSupplyClick(card) {
  if (window.gameState.phase !== 'skill' || window.gameState.skillMode !== 'select_supply') return;
  // 城防扩展：阶段行为次数限制
  const isDef = (window.gameState.selectedMode === 'defense' || window.gameState.selectedMode === 'commander+defense');
  if (isDef) {
    window.gameState.phaseActions = window.gameState.phaseActions || {};
    if (card.suit === 'diamonds' && window.gameState.phaseActions.diamondsSkill) {
      window.setMessage('🕵️ 本阶段已经使用过♦️技能！'); return;
    }
    if (card.suit === 'clubs' && window.gameState.phaseActions.clubsSkill) {
      window.setMessage('⚔️ 本阶段已经使用过♣️技能！'); return;
    }
    if (card.suit === 'hearts' && window.gameState.phaseActions.heartsSkill) {
      window.setMessage('📦 本阶段已经使用过♥️技能！'); return;
    }
  }
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
  window.gameState._breakthroughNewIds = undefined;
  window.gameState._pushNewIds = undefined;
  window.gameState._tacticianBonusMode = undefined;
  window.gameState._feintDarkened = undefined;
  document.getElementById('skill-section').style.display = 'none';
  // 城防扩展：标记本阶段已使用对应技能，若无可再做之事则自动推进阶段
  const isDef = (window.gameState.selectedMode === 'defense' || window.gameState.selectedMode === 'commander+defense');
  let shouldAdvance = false;
  if (isDef && window.gameState.turnPhase) {
    window.gameState.phaseActions = window.gameState.phaseActions || {};
    if (window.gameState.turnPhase === 'scout') {
      window.gameState.phaseActions.diamondsSkill = true;
      shouldAdvance = true; // scout 只有 ♦️ 技能一件事
    } else if (window.gameState.turnPhase === 'siege') {
      window.gameState.phaseActions.clubsSkill = true;
      const hasAttack = !window.gameState.phaseActions.attack && window.gameState.hand.length > 0;
      if (!hasAttack) shouldAdvance = true;
    } else if (window.gameState.turnPhase === 'supply') {
      window.gameState.phaseActions.heartsSkill = true;
      shouldAdvance = true; // supply 只有 ♥️ 技能一件事
    }
  }
  if (shouldAdvance) {
    Core.advanceTurnPhase();
  } else {
    window.renderAll();
  }
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
    if (!top) {
      window.setMessage('牌库已空，无法继续侦查。');
      finishSkill();
      return;
    }
    window.gameState.discard.push(top);
    window.setMessage(`♦️ 谨慎侦查：翻开了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}，牌堆顶是 ${SUIT_NAMES[top.suit]}${rankName(top.rank)}。`);
    window.renderAll();

    const revealables = window.gameState.enemies.filter(e => !e.defeated && !e.revealed && isSelectable(e));
    const canContinue = revealables.length > 0 && top.suit === enemy.suit;

    if (canContinue) {
      const again = confirm(`牌堆顶 ${SUIT_NAMES[top.suit]}${rankName(top.rank)} 与敌人花色一致！是否继续侦查？`);
      if (again) {
        return; // 继续等待玩家选择下一个敌人
      }
    } else if (top.suit === enemy.suit && revealables.length === 0) {
      window.setMessage('没有更多可选中的暗置敌人了。');
    }

    // 进入交换步骤：不一致、选择不继续、或没有暗置敌人
    if (window.gameState.supply.length > 0) {
      const swap = confirm(`♦️ 谨慎侦查：是否用一张已有物资牌与刚弃掉的牌堆顶牌 ${SUIT_NAMES[top.suit]}${rankName(top.rank)} 交换？`);
      if (swap) {
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
    enemy.defeated = true;
    setTimeout(() => {
      const discardIt = confirm(`是否将 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)} 弃掉，从牌库顶抽1张牌作为物资？\n（取消则将其作为普通物资）`);
      if (discardIt) {
        window.gameState.discard.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
        const drawn = draw(1)[0];
        if (drawn) {
          window.gameState.supply.push(drawn);
          window.setMessage(`♣️ 收割：击败了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}，弃掉后从牌库抽到 ${SUIT_NAMES[drawn.suit]}${rankName(drawn.rank)} 作为物资。`);
        } else {
          window.setMessage(`♣️ 收割：击败了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}，但牌库已空。`);
        }
      } else {
        window.gameState.supply.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
        window.setMessage(`♣️ 收割：击败了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}，将其作为物资。`);
      }
      computeCoverage();
      finishSkill();
      checkGameOver();
      window.renderAll();
    }, 100);
    return;
  }

  // 扰乱侦查 - 选择可选中且覆盖暗置敌人的牌
  if (window.gameState.skillMode === 'disrupt') {
    if (!isSelectable(enemy)) { window.setMessage('该敌人被覆盖，无法选中！'); return; }
    const coversDark = window.gameState.enemies.some(other => other.id !== enemy.id && !other.defeated && !other.revealed && other.coveredBy.includes(enemy.id));
    if (!coversDark) { window.setMessage('该敌人没有覆盖暗置敌人，无法选中！'); return; }
    window.gameState._disruptSource = enemy;
    window.gameState.skillMode = 'disrupt_target';
    window.setMessage('♦️ 扰乱侦查：现在选择被该敌人覆盖的暗置敌人交换位置。');
    window.renderAll();
    return;
  }

  // 扰乱侦查 - 选择被源覆盖的暗置敌人
  if (window.gameState.skillMode === 'disrupt_target') {
    const src = window.gameState._disruptSource;
    if (enemy.revealed) { window.setMessage('请选择一个暗置敌人交换！'); return; }
    if (!src || !enemy.coveredBy.includes(src.id)) { window.setMessage('该敌人未被源覆盖，无法交换！'); return; }
    // 交换位置
    const tmpPos = src.pos; src.pos = enemy.pos; enemy.pos = tmpPos;
    const tmpLayer = src.layer; src.layer = enemy.layer; enemy.layer = tmpLayer;
    const tmpIndex = src.index; src.index = enemy.index; enemy.index = tmpIndex;
    // 重新计算覆盖
    computeCoverage();
    // 翻转明暗：目标到了源位置，若 selectable 且暗置则翻明置；源到了目标位置，若明置且不可选中则翻暗置
    if (!enemy.revealed && isSelectable(enemy)) {
      enemy.revealed = true;
    }
    const srcBecameDark = src.revealed && !isSelectable(src);
    if (srcBecameDark) {
      src.revealed = false;
      const drawn = draw(1);
      if (drawn.length > 0) window.gameState.hand.push(drawn[0]);
    }
    window.gameState._disruptSource = undefined;
    window.setMessage(`♦️ 扰乱侦查：交换完成${srcBecameDark ? '，源变暗置，抽1张牌' : ''}。`);
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
    const beforeSelectableIds = new Set(window.gameState.enemies.filter(e => !e.defeated && isSelectable(e)).map(e => e.id));
    window.gameState.supply.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
    enemy.defeated = true;
    window.setMessage(`♣️ 推进：直接击败了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}！`);
    computeCoverage();
    // 检查是否有新产生的可选中敌人
    const newOnes = window.gameState.enemies.filter(e => !e.defeated && isSelectable(e) && !beforeSelectableIds.has(e.id));
    if (newOnes.length > 0) {
      const nonClub = window.gameState.supply.filter(c => c.suit !== 'clubs');
      if (nonClub.length > 0) {
        window.gameState._pushNewIds = newOnes.map(e => e.id);
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
    if (!window.gameState._pushNewIds?.includes(enemy.id)) { window.setMessage('只能选择新产生的可选中敌人！'); return; }
    const nonClub = window.gameState.supply.find(c => c.suit !== 'clubs');
    if (!nonClub) { window.setMessage('没有非♣️物资可用于连锁推进。'); finishSkill(); return; }
    const idx = window.gameState.supply.findIndex(c => c.id === nonClub.id);
    window.gameState.discard.push(window.gameState.supply.splice(idx, 1)[0]);
    // 不获得奖励，直接弃掉
    window.gameState.discard.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
    enemy.defeated = true;
    window.setMessage(`♣️ 推进连锁：消耗${SUIT_NAMES[nonClub.suit]}${rankName(nonClub.rank)}，击败了${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}！`);
    window.gameState._pushNewIds = undefined;
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
    if (!window.gameState._breakthroughNewIds?.includes(enemy.id)) { window.setMessage('只能选择新产生的可选中敌人！'); return; }
    enemy.revealed = true;
    window.setMessage(`♠️ 突破战术：将新敌人 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)} 翻为明置。`);
    window.gameState.phase = 'playing';
    window.gameState.skillMode = null;
    window.gameState._breakthroughNewIds = undefined;
    document.getElementById('skill-section').style.display = 'none';
    window.finishAttack();
    return;
  }

  // 佯攻 - 选择明置敌人变暗置
  if (window.gameState.skillMode === 'feint') {
    if (!enemy.revealed) { window.setMessage('请选择一张明置敌人变为暗置！'); return; }
    enemy.revealed = false;
    window.gameState._feintDarkened = enemy;
    // 检查是否有可选中的暗置敌人可以翻为明置
    const darkSelectable = window.gameState.enemies.filter(e => !e.defeated && !e.revealed && isSelectable(e));
    if (darkSelectable.length === 0) {
      window.setMessage('♠️ 佯攻：没有可选中的暗置敌人可以翻为明置，直接结束。');
      window.gameState._feintDarkened = undefined;
      window.gameState._skipHandRemove = true;
      window.gameState.phase = 'playing';
      window.gameState.skillMode = null;
      document.getElementById('skill-section').style.display = 'none';
      window.finishAttack();
      return;
    }
    window.gameState.skillMode = 'feint_reveal';
    window.setMessage('♠️ 佯攻：已将一张明置敌人变暗置。现在选择另一张可选中的暗置敌人变为明置。');
    document.getElementById('skill-section').style.display = 'block';
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
    if (!enemy.revealed && isSelectable(enemy)) {
      enemy.revealed = true;
      if (window.gameState._tacticianBonusMode === 'reveal') {
        window.setMessage(`♠️ 战争艺术：翻开了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}。`);
        window.gameState._tacticianBonusMode = undefined;
        window.gameState._skipHandRemove = true;
        window.gameState.phase = 'playing';
        window.gameState.skillMode = null;
        document.getElementById('skill-section').style.display = 'none';
        window.finishAttack();
        return;
      } else if (window.gameState._tacticianBonusMode === 'reveal_draw') {
        const drawn = draw(1);
        if (drawn.length > 0) window.gameState.hand.push(drawn[0]);
        window.setMessage(`♠️ 战争艺术：翻开了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}，并抽了${drawn.length > 0 ? SUIT_NAMES[drawn[0].suit] + rankName(drawn[0].rank) : '0张'}。`);
        window.gameState._tacticianBonusMode = undefined;
        window.gameState._skipHandRemove = true;
        window.gameState.phase = 'playing';
        window.gameState.skillMode = null;
        document.getElementById('skill-section').style.display = 'none';
        window.finishAttack();
        return;
      }
    }
    window.setMessage('请选择一个可选中的暗置敌人！');
    return;
  }

  // 闪电战专家 ♦️急速侦查
  if (window.gameState.skillMode === 'blitzkrieg_scout') {
    if (enemy.revealed) { window.setMessage('只能选择暗置的敌人！'); return; }
    if (!isSelectable(enemy)) { window.setMessage('该敌人被覆盖，无法选中！'); return; }
    enemy.revealed = true;
    const timeTop = window.gameState.timeDeck[window.gameState.timeDeck.length - 1];
    if (timeTop && !timeTop.revealed) {
      const discardIt = confirm('时间牌为暗置（夜晚），是否弃掉该敌人？');
      if (discardIt) {
        window.gameState.discard.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
        enemy.defeated = true;
        window.setMessage(`♦️ 急速侦查：翻开了${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}并将其弃掉。`);
      } else {
        window.setMessage(`♦️ 急速侦查：翻开了${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}。`);
      }
    } else {
      const drawn = draw(1);
      if (drawn.length > 0) {
        window.gameState.hand.push(drawn[0]);
        window.setMessage(`♦️ 急速侦查：翻开了${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}，抽到${SUIT_NAMES[drawn[0].suit]}${rankName(drawn[0].rank)}。`);
        if (timeTop && timeTop.revealed) {
          const swap = confirm(`是否用抽到的${SUIT_NAMES[drawn[0].suit]}${rankName(drawn[0].rank)}与当前明置时间牌${SUIT_NAMES[timeTop.suit]}${rankName(timeTop.rank)}交换？`);
          if (swap) {
            const handIdx = window.gameState.hand.findIndex(c => c.id === drawn[0].id);
            if (handIdx >= 0) {
              window.gameState.hand[handIdx] = timeTop;
              window.gameState.timeDeck[window.gameState.timeDeck.length - 1] = drawn[0];
              drawn[0].revealed = true;
              window.setMessage(`♦️ 急速侦查：已用${SUIT_NAMES[drawn[0].suit]}${rankName(drawn[0].rank)}替换了时间牌。`);
            }
          }
        }
      } else {
        window.setMessage(`♦️ 急速侦查：翻开了${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}，但牌库已空。`);
      }
    }
    computeCoverage();
    finishSkill();
    checkGameOver();
    window.renderAll();
    return;
  }

  // 闪电战专家 ♣️突袭
  if (window.gameState.skillMode === 'blitzkrieg_assault') {
    if (!enemy.revealed) { window.setMessage('只能选择明置的敌人！'); return; }
    if (!isSelectable(enemy)) { window.setMessage('该敌人被覆盖，无法选中！'); return; }
    window.gameState.supply.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
    enemy.defeated = true;
    const timeCount = window.gameState.timeDeck.length;
    let msg = `♣️ 突袭：直接击败了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}！`;
    if (timeCount <= 5) {
      const drawn = draw(1);
      if (drawn.length > 0) {
        window.gameState.hand.push(drawn[0]);
        msg += ` 时间牌堆${timeCount}张≤5，抽了${SUIT_NAMES[drawn[0].suit]}${rankName(drawn[0].rank)}。`;
      }
    }
    window.setMessage(msg);
    computeCoverage();
    finishSkill();
    checkGameOver();
    window.renderAll();
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
  window.showChoiceModal('🔄 协同成功', '请选择要发动的技能：', choices, (suit) => {
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
  });
}
