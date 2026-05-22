import { SUIT_NAMES, rankName } from './config.js';
import { computeCoverage, checkGameOver, draw } from './core.js';
import { getCommander, COMMANDERS } from './commanders.js';

// ==================== 核心攻城 ====================
export function performAttack(handCard, enemy) {
  const cmd = getCommander();
  const success = (handCard.suit === enemy.suit) || (handCard.rank === enemy.rank);
  enemy.revealed = true;

  if (success) {
    const done = cmd ? cmd.onAttackSuccess(handCard, enemy) : COMMANDERS.novice.onAttackSuccess(handCard, enemy);
    if (done) finishAttack();
  } else {
    const done = cmd ? cmd.onAttackFail(handCard, enemy) : COMMANDERS.novice.onAttackFail(handCard, enemy);
    if (done) finishAttack();
  }
}

export function finishAttack() {
  if (window.gameState.selectedHand !== null && !window.gameState._skipHandRemove) {
    window.gameState.hand.splice(window.gameState.selectedHand, 1);
  }
  window.gameState._skipHandRemove = false;
  window.gameState.selectedHand = null;
  const isDef = (window.gameState.selectedMode === 'defense' || window.gameState.selectedMode === 'commander+defense');
  if (isDef) {
    // 城防扩展：标记本阶段已攻城，不自动推进阶段
    window.gameState.phaseActions = window.gameState.phaseActions || {};
    window.gameState.phaseActions.attack = true;
  } else {
    window.gameState.turn++;
  }
  computeCoverage();
  checkGameOver();
  window.renderAll();
}

export function askDefense(handCard, enemy, defense) {
  const useDef = confirm(`你有♠️${rankName(defense.rank)}防御物资，是否使用它代替 ${SUIT_NAMES[handCard.suit]}${rankName(handCard.rank)} 进入弃牌堆？`);
  if (useDef) {
    const idx = window.gameState.supply.findIndex(c => c.id === defense.id);
    window.gameState.discard.push(window.gameState.supply.splice(idx, 1)[0]);
    window.gameState._skipHandRemove = true;
    window.setMessage(`♠️ 防御发动！用♠️${rankName(defense.rank)}代替手牌进入弃牌堆。敌人已明置。`);
  } else {
    window.gameState.discard.push(handCard);
    window.setMessage(`💥 攻城失败！${SUIT_NAMES[handCard.suit]}${rankName(handCard.rank)} 无法攻克 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}。敌人已明置。`);
  }
  finishAttack();
}

// 情报专家佯攻
export function askDefenseIntel(handCard, enemy, defense) {
  const useDef = confirm(`你有♠️${rankName(defense.rank)}防御物资，是否使用它代替 ${SUIT_NAMES[handCard.suit]}${rankName(handCard.rank)} 进入弃牌堆？\n（佯攻：之后可将一张明置敌人变暗置，使另一张暗置变明置）`);
  if (useDef) {
    const idx = window.gameState.supply.findIndex(c => c.id === defense.id);
    window.gameState.discard.push(window.gameState.supply.splice(idx, 1)[0]);
    window.gameState._skipHandRemove = true;
    const revealedSelectable = window.gameState.enemies.filter(e => !e.defeated && e.revealed && e.coveredBy.length === 0);
    if (revealedSelectable.length === 0) {
      window.setMessage(`♠️ 佯攻发动！用♠️${rankName(defense.rank)}代替手牌。但没有可选中的明置敌人，直接结束。`);
      finishAttack();
      return;
    }
    window.setMessage(`♠️ 佯攻发动！用♠️${rankName(defense.rank)}代替手牌。请选择一张明置敌人变为暗置。`);
    window.gameState.phase = 'skill'; window.gameState.skillMode = 'feint';
    document.getElementById('skill-section').style.display = 'block';
    window.renderAll();
  } else {
    window.gameState.discard.push(handCard);
    window.setMessage(`💥 攻城失败！敌人已明置。`);
    finishAttack();
  }
}

// 战术大师战争艺术
export function askDefenseTactician(handCard, enemy, defense, isSuccess = false) {
  const useDef = confirm(`你有♠️${rankName(defense.rank)}防御物资，是否使用它代替 ${SUIT_NAMES[handCard.suit]}${rankName(handCard.rank)} 进入弃牌堆？\n（战争艺术：根据物资花色数获得额外效果）`);
  if (useDef) {
    const uniqueSuits = new Set(window.gameState.supply.map(c => c.suit)).size;
    const idx = window.gameState.supply.findIndex(c => c.id === defense.id);
    window.gameState.discard.push(window.gameState.supply.splice(idx, 1)[0]);
    window.gameState._skipHandRemove = true;
    if (isSuccess) {
      window.gameState.supply.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
      enemy.defeated = true;
    }
    if (uniqueSuits <= 1) {
      window.setMessage(`♠️ 战争艺术发动！用♠️${rankName(defense.rank)}代替手牌。物资花色仅1种，无额外效果。`);
      finishAttack();
      return;
    }
    const options = [];
    if (uniqueSuits >= 2) options.push('1. 选择一个可选中暗置敌人变为明置');
    if (uniqueSuits >= 3) options.push('2. 抽一张牌');
    if (uniqueSuits >= 4) options.push('3. 选择一个可选中暗置敌人变为明置并抽一张牌');
    const input = prompt(`♠️ 战争艺术发动！用♠️${rankName(defense.rank)}代替手牌。\n物资花色${uniqueSuits}种，请选择额外效果：\n${options.join('\n')}`);
    const choice = parseInt(input);
    const darkSelectable = window.gameState.enemies.filter(e => !e.defeated && !e.revealed && e.coveredBy.length === 0);
    if (choice === 1 && uniqueSuits >= 2) {
      if (darkSelectable.length === 0) {
        window.setMessage('♠️ 战争艺术：没有可选中的暗置敌人，无额外效果。');
        finishAttack();
        return;
      }
      window.gameState._tacticianBonusMode = 'reveal';
      window.gameState.phase = 'skill'; window.gameState.skillMode = 'tactician_bonus';
      window.setMessage('♠️ 战争艺术：选择一个可选中暗置敌人变为明置。');
      document.getElementById('skill-section').style.display = 'block';
      window.renderAll();
      return;
    } else if (choice === 2 && uniqueSuits >= 3) {
      const drawn = draw(1);
      if (drawn.length > 0) window.gameState.hand.push(drawn[0]);
      window.setMessage(`♠️ 战争艺术：抽了${drawn.length > 0 ? SUIT_NAMES[drawn[0].suit] + rankName(drawn[0].rank) : '0张'}。`);
      finishAttack();
      return;
    } else if (choice === 3 && uniqueSuits >= 4) {
      if (darkSelectable.length === 0) {
        window.setMessage('♠️ 战争艺术：没有可选中的暗置敌人，改为抽一张牌。');
        const drawn = draw(1);
        if (drawn.length > 0) window.gameState.hand.push(drawn[0]);
        finishAttack();
        return;
      }
      window.gameState._tacticianBonusMode = 'reveal_draw';
      window.gameState.phase = 'skill'; window.gameState.skillMode = 'tactician_bonus';
      window.setMessage('♠️ 战争艺术：选择一个可选中暗置敌人变为明置，然后抽一张牌。');
      document.getElementById('skill-section').style.display = 'block';
      window.renderAll();
      return;
    } else {
      window.setMessage('♠️ 战争艺术：取消选择或选择了无效选项，无额外效果。');
      finishAttack();
      return;
    }
  } else {
    window.gameState.discard.push(handCard);
    if (isSuccess) {
      window.gameState.supply.push({ ...enemy, coveredBy: undefined, pos: undefined, layer: undefined, index: undefined });
      enemy.defeated = true;
      window.setMessage(`🎉 攻城成功！${SUIT_NAMES[handCard.suit]}${rankName(handCard.rank)} 击败了 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}！`);
    } else {
      window.setMessage(`💥 攻城失败！${SUIT_NAMES[handCard.suit]}${rankName(handCard.rank)} 无法攻克 ${SUIT_NAMES[enemy.suit]}${rankName(enemy.rank)}。敌人已明置。`);
    }
    finishAttack();
  }
}
