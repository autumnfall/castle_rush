import { createCard } from './config.js';
import { computeCoverage } from './core.js';

// Each exercise starts from its own small position and uses the basic game's actions.
const lessons = [
  {
    title: '用手牌攻城',
    hint: '选中 ♥5 手牌，再点金边的 ♥7 敌人。花色或点数相同就能攻克。只有未被覆盖的敌人可以选中。',
    result: '♥5 进入弃牌堆，缴获的 ♥7 成为物资。前排被击败后，后面的敌人也露出来了。',
    done: g => g.enemies[0].defeated,
  },
  {
    title: '♥ 补给',
    hint: '点击「发动战术」，再点物资区的 ♥2 并确认。红桃物资可以换三张手牌。',
    result: '♥2 进入弃牌堆，三张新牌加入手牌。',
    suit: 'hearts', done: g => g.hand.length === 4,
  },
  {
    title: '♦ 侦查',
    hint: '点击「发动战术」，选择 ♦2 并确认，再依次点击两名金边暗敌。明置后就能看清它们的花色和点数。',
    result: '两名敌人都已明置，现在可以判断该用哪张手牌攻城。',
    suit: 'diamonds', done: g => g.enemies.every(e => e.revealed && !e.defeated),
  },
  {
    title: '♣ 强攻',
    hint: '点击「发动战术」，选择 ♣2 并确认，再点击明置的 ♥7。强攻可以直接击败明置敌人并缴获它。',
    result: '♣2 进入弃牌堆，♥7 进入物资区，你保留了手牌。',
    suit: 'clubs', done: g => g.enemies[0].defeated && g.discard.some(c => c.suit === 'clubs' && c.rank === 2),
  },
  {
    title: '♠ 防御',
    hint: '用 ♥5 攻击金边暗敌。这次花色和点数都不匹配，攻城会失败。提示出现时，确认用 ♠2 代替手牌进入弃牌堆。',
    result: '敌人已明置，♥5 仍在手中。你已学会四种战术，正式对局的目标是击败全部 16 名敌人。',
    suit: 'spades', done: g => g.enemies[0].revealed && g.hand.length === 1 && g.discard.some(c => c.suit === 'spades'),
  },
];

function openLesson(index, startGame) {
  startGame();
  const g = window.gameState;
  const lesson = lessons[index];
  const scouting = lesson.suit === 'diamonds';
  const defending = lesson.suit === 'spades';
  const front = createCard(defending ? 'clubs' : 'hearts', 7);
  const rear = createCard('diamonds', 9);
  Object.assign(g, {
    tutorial: index, hand: [createCard('hearts',5)],
    supply: lesson.suit ? [createCard(lesson.suit,2)] : [],
    deck: [createCard('clubs',6),createCard('spades',4),createCard('diamonds',8)],
    enemies: [
      { ...front, layer:4, index:0, pos:1, revealed:!scouting && !defending, defeated:false },
      { ...rear, layer:scouting ? 4 : 3, index:1, pos:scouting ? 5 : 2, revealed:false, defeated:false },
    ],
    phase:'playing', message:'按上方教程提示操作，可随时重试本步。',
  });
  computeCoverage();
  document.getElementById('mulligan-bar').style.display = 'none';
  document.getElementById('skill-section').style.display = 'none';
  window.renderAll();
  document.getElementById('tutorial-title').focus();
}

export function render() {
  const g = window.gameState;
  const panel = document.getElementById('tutorial-panel');
  const lesson = lessons[g.tutorial];
  panel.classList.toggle('hidden', !lesson);
  if (!lesson) return;
  const complete = lesson.done(g);
  document.getElementById('tutorial-title').textContent = `基础教程 ${g.tutorial + 1}/${lessons.length} · ${lesson.title}`;
  document.getElementById('tutorial-hint').textContent = complete ? lesson.result : lesson.hint;
  const next = document.getElementById('tutorial-next');
  next.disabled = !complete;
  next.textContent = g.tutorial === lessons.length - 1 ? '开始基础游戏' : '下一步';
}

export function bind(startGame, resetGame) {
  document.getElementById('basic-tutorial-start').onclick = () => openLesson(0, startGame);
  document.getElementById('tutorial-retry').onclick = () => openLesson(window.gameState.tutorial, startGame);
  document.getElementById('tutorial-exit').onclick = resetGame;
  document.getElementById('tutorial-next').onclick = () => {
    const next = window.gameState.tutorial + 1;
    if (next < lessons.length) openLesson(next, startGame);
    else startGame();
  };
}
