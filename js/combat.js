import { SUIT_NAMES, rankName } from './config.js';
import { computeCoverage, checkGameOver } from './core.js';
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
  window.gameState.turn++;
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
    window.setMessage(`♠️ 佯攻发动！用♠️${rankName(defense.rank)}代替手牌。请选择一张明置敌人变为暗置。`);
    window.gameState.phase = 'skill'; window.gameState.skillMode = 'feint';
    window.renderAll();
  } else {
    window.gameState.discard.push(handCard);
    window.setMessage(`💥 攻城失败！敌人已明置。`);
    finishAttack();
  }
}

// 战术大师修整
export function askDefenseTactician(handCard, enemy, defense) {
  const useDef = confirm(`你有♠️${rankName(defense.rank)}防御物资，是否使用它代替 ${SUIT_NAMES[handCard.suit]}${rankName(handCard.rank)} 进入弃牌堆？\n（战争艺术：根据物资花色数获得额外效果）`);
  if (useDef) {
    const idx = window.gameState.supply.findIndex(c => c.id === defense.id);
    window.gameState.discard.push(window.gameState.supply.splice(idx, 1)[0]);
    window.gameState._skipHandRemove = true;
    const uniqueSuits = new Set(window.gameState.supply.map(c => c.suit)).size;
    let extra = '';
    if (uniqueSuits >= 4) extra = '翻1张暗置+抽1张牌';
    else if (uniqueSuits >= 3) extra = '抽1张牌';
    else if (uniqueSuits >= 2) extra = '翻1张暗置牌';
    else extra = '无额外效果（物资花色种类不足2种）';
    window.setMessage(`♠️ 战争艺术发动！用♠️${rankName(defense.rank)}代替手牌。物资花色${uniqueSuits}种，${extra}。`);
    if (uniqueSuits >= 2) {
      window.gameState._tacticianSuits = uniqueSuits;
      window.gameState.phase = 'skill'; window.gameState.skillMode = 'tactician_bonus';
      window.renderAll();
      return;
    }
  } else {
    window.gameState.discard.push(handCard);
    window.setMessage(`💥 攻城失败！敌人已明置。`);
  }
  finishAttack();
}
