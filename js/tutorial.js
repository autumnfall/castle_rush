import { SUIT_SYMBOLS, rankName } from './config.js';

const face = card => SUIT_SYMBOLS[card.suit] + rankName(card.rank);

// Layer order follows the basic game's keep, hall and gate layout.
const enemyFaces = [
  '♥K','♦K','♣K','♠K', '♣Q','♥3','♠Q','♠8',
  '♥Q','♦4','♣8', '♣J','♥9', '♥7','♠J','♦6',
];
const dealOrder = [
  '♣A','♣3','♣4','♦8','♦10', '♦2','♣2', // Initial hand and supplies
  '♥6','♠3','♣5','♦5','♥5',                 // First mulligan
  '♥2','♠2','♦3', '♣6','♥4','♠4', '♣7','♦7','♥8',
  '♣9','♥10','♠6', '♣10','♥A','♦9',
];

export function arrangeDeal(cards, enemies) {
  const remaining = new Map(cards.map(card => [face(card), card]));
  function take(key) {
    const card = remaining.get(key);
    if (!card) throw new Error('教程牌序重复或缺牌 ' + key);
    remaining.delete(key);
    return card;
  }
  enemies.forEach((enemy,i) => Object.assign(enemy, take(enemyFaces[i])));
  const ordered = dealOrder.map(take);
  return [...remaining.values(), ...ordered.reverse()];
}

const attack = (hand, enemy, title, hint) => ({hand, enemy, title, hint});
const supply = (cost, title, hint) => ({cost, title, hint});
const route = [
  {title:'通关目标与重调', hint:'清空场上全部 16 名敌人即可通关。开局有 5 张手牌和 2 张物资。这手只有梅花和方片，先点蓝框标出的「重调手牌」。尽量让四种花色各有一张，遇到不同敌人时更容易匹配。'},
  {title:'保留起手', hint:'现在五张手牌已覆盖四种花色，两张 5 还能留给协同。点击「确认手牌」。'},
  attack('♠3','♦6','试攻暗牌','选中 ♠3，试攻前排最右侧的暗牌。只有未被覆盖的敌人可选；暗牌要在攻城时才知道能否匹配。'),
  attack('♥6','♦6','用相同点数攻城','刚才攻城失败，♠3 进入弃牌堆，敌人 ♦6 明置。现在用 ♥6 攻打它：花色不同，点数相同也能击败并缴获敌人。'),
  {...supply('♦2','♦ 侦查','缴获的 ♦6 已进入物资区。点击「发动战术」，用起始物资 ♦2 侦查，再依次点亮前排剩余的两张暗牌。'), reveal:['♥7','♠J']},
  attack('♥5','♥7','用相同花色攻城','侦查看到了 ♥7。用 ♥5 攻打它：点数不同，花色相同也能成功。'),
  supply('♥7','♥ 补给','点击「发动战术」，用刚缴获的 ♥7 换三张手牌。'),
  {...supply('♣2','♣ 强攻','点击「发动战术」，用 ♣2 强攻已明置的 ♠J。直接击败它并收为物资，保留手牌。'), target:'♠J'},
  attack('♥2','♣J','♠ 防御','用 ♥2 试攻标出的暗牌。攻城手牌将被弃掉时，确认用上一步缴获、攻城前已在物资区的 ♠J 代弃，便能保留 ♥2。'),
  {title:'两张同点数手牌协同', synergy:true, hint:'点击「发动战术」→「协同」，选中 ♣5 和 ♦5。本次选择补给，弃两张 5 抽三张。实战还可以通过协同发动侦查或强攻。'},
];

const controls = '.hand-card, .enemy-card, #basic-tactics, #supply-pile .pile-card, #skill-section button, #mulligan-bar button';
function completed(step,g) {
  if (step.hand) return g.turn > g.tutorial.startTurn || g.phase === 'gameover';
  if (g.tutorial.index === 0) return g.mulliganCount > 0;
  if (g.phase !== 'playing') return false;
  if (step.cost) return g.discard.some(c => face(c) === step.cost);
  if (step.synergy) return ['♣5','♦5'].every(key => g.discard.some(c => face(c) === key));
  return true;
}

function markCards(container, cards, keys) {
  const elements = document.getElementById(container).children;
  cards.forEach((card,i) => {
    if (keys.includes(face(card))) elements[i].classList.add('tutorial-target');
  });
}

function markControls(step,g) {
  const mark = selector => document.querySelector(selector).classList.add('tutorial-target');
  const enemy = keys => markCards('board-area',g.enemies.filter(e => !e.defeated),keys);
  if (g.phase === 'mulligan') {
    mark(g.mulliganCount ? '#mulligan-bar button:last-child' : '#btn-mulligan');
  } else if (step.hand) {
    if (g.selectedHand === null) markCards('hand-container',g.hand,[step.hand]);
    else enemy([step.enemy]);
  } else if (g.phase === 'playing') {
    mark('#basic-tactics');
  } else if (g.phase === 'synergy') {
    markCards('hand-container',g.hand,['♣5','♦5']);
  } else if (g.skillMode === 'select_supply') {
    if (step.synergy) mark('#skill-section .skill');
    else markCards('supply-pile',g.supply,[step.cost]);
  } else if (g.skillMode === 'reveal') {
    enemy(g.enemies.filter(e => !e.revealed && step.reveal.includes(face(e))).map(face));
  } else if (g.skillMode === 'attack') {
    enemy([step.target]);
  }
}

function finishTutorial(startGame) {
  window.showChoiceModal('基础教程完成', '四种花色战术和协同都已演示完毕。你可以自己继续完成这一局，或开启一局新的基础游戏。', [
    {label:'继续当前牌局', value:'continue'},
    {label:'开启新游戏', value:'new'},
  ], choice => {
    if (choice === 'new') {
      startGame();
    } else {
      window.gameState.tutorial = null;
      window.setMessage('自由攻城：选择手牌和目标，或发动战术，清空剩余敌人。');
      window.renderAll();
    }
  });
  document.querySelector('#modal-extra button').focus();
}

export function render(startGame) {
  const g = window.gameState, guide = g.tutorial;
  const panel = document.getElementById('tutorial-panel');
  panel.classList.toggle('hidden', !guide);
  document.querySelectorAll('.tutorial-target').forEach(el => el.classList.remove('tutorial-target'));
  if (!guide) return;
  let step = route[guide.index];
  if (!step) return;
  if (completed(step,g)) {
    guide.index++;
    guide.startTurn = g.turn;
    step = route[guide.index];
  }
  if (!step) {
    finishTutorial(startGame);
    return;
  }
  document.getElementById('tutorial-title').textContent = '基础教程 · ' + step.title;
  document.getElementById('tutorial-hint').textContent = step.hint;
  markControls(step,g);
}

function displayInvite(visible) {
  document.getElementById('intro-description').hidden = visible;
  document.getElementById('tutorial-invite').hidden = !visible;
  document.getElementById('tutorial-dismiss').hidden = !visible;
}

export function hideInvite() {
  displayInvite(false);
}

export function bind(startGame, resetGame, selectMode) {
  const visitKey = 'castle-rush:seen-tutorial-invite';
  let firstVisit = true;
  try {
    firstVisit = localStorage.getItem(visitKey) === null;
    if (firstVisit) localStorage.setItem(visitKey, '1');
  } catch {
    // The invitation and both choices also work when storage is unavailable.
  }
  displayInvite(firstVisit);
  document.getElementById('tutorial-dismiss').onclick = () => {
    hideInvite();
    document.querySelector('.mode-card').focus();
  };
  document.getElementById('basic-tutorial-start').onclick = () => {
    selectMode('basic');
    startGame('tutorial');
    document.getElementById('tutorial-title').focus();
  };
  document.getElementById('tutorial-exit').onclick = resetGame;
  const screen = document.getElementById('game-screen');
  screen.addEventListener('click', event => {
    if (!window.gameState.tutorial) return;
    const control = event.target.closest(controls);
    if (control && !control.classList.contains('tutorial-target')) {
      event.preventDefault();
      event.stopPropagation();
    }
  }, true);
  // Hand selection and the first scout flip only redraw their respective cards.
  screen.addEventListener('click', () => { if (window.gameState.tutorial) render(startGame); });
}
