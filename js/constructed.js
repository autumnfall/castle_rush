import { SUIT_SYMBOLS, rankName, shuffle, isRed } from './config.js';
import { draw, computeCoverage, isSelectable, checkGameOver } from './core.js';
import { showChoiceModal, showModal, setMessage } from './ui.js';

import { cards, talents, presets, validDeck } from './deck-catalog.js';

export function createDeck(preset) {
  const custom = typeof preset !== 'string';
  const recipe = custom ? preset : presets[preset];
  if (!validDeck(recipe)) throw new Error('技能卡组不符合构筑规则');
  const deck = shuffle([...recipe.list]);
  return {
    talent: recipe.talent, name: custom ? '自选卡组' : presets[preset].name, list: [...recipe.list],
    deck, learned: [], used: [], talentTurn: 0
  };
}

const label = c => SUIT_SYMBOLS[c.suit] + rankName(c.rank);
const enemyLabel = e => '第' + (e.layer + 1) + '层 · ' + (e.index + 1) + '号 ' + (e.revealed ? label(e) : '暗敌');
const options = (items, describe) => items.map(value => ({ label: describe(value), value }));
const choose = (title, hint, choices) => new Promise(resolve => showChoiceModal(title, hint, choices, resolve));
const cancel = { label: '取消', value: null };
const pick = (title, items, describe, optional = false) =>
  choose(title, '', [...options(items, describe), ...(optional ? [cancel] : [])]);
const take = (pile, card) => pile.splice(pile.indexOf(card), 1)[0];



export async function learn() {
  const g = window.gameState;
  const d = g.constructed;
  if (g.phase !== 'playing' || !d.deck.length) return;
  const free = !d.learned.length;
  if (!free && !g.supply.length) return;
  g.phase = 'constructed-action';
  let payment;
  if (!free) {
    payment = await pick('弃一物资学习技能', g.supply, label, true);
    if (!payment) {
      g.phase = 'playing';
      window.renderAll();
      return;
    }
    g.discard.push(take(g.supply, payment));
  }
  const offers = d.deck.splice(-2).reverse();
  const learned = await pick(free ? '免费学习首个技能' : '选择永久技能', offers, id => cards[id].join(' · '));
  d.learned.push(learned);
  d.deck.unshift(...offers.filter(id => id !== learned));
  setMessage('已学会 ' + cards[learned][0] + '，本局持续可用。');
  g.phase = 'playing';
  finish(g);
}

const suits = { H: 'hearts', D: 'diamonds', C: 'clubs', S: 'spades' };
const red = c => isRed(c.suit);
const front = g => g.enemies.filter(isSelectable);
const recovery = (g, c) => g.hand.push(take(g.discard, c));
const talent = (g, id) => g.constructed.talent === id && g.constructed.talentTurn !== g.turn;
const spentTalent = g => { g.constructed.talentTurn = g.turn; };
const optional = (title, hint) => choose(title, hint, [{ label: '发动', value: true }, { label: '跳过', value: false }]);
const extraSupply = id => ['H10','D10','C10','S10'].includes(id);
const extraHand = id => ['H9','D9','C9','S9'].includes(id);

function strikeTargets(g, id, preferred) {
  return front(g).filter(e => {
    if (!e.revealed) return false;
    if (id === 'CA' || (id === 'C8' && !preferred)) return e.rank <= 7;
    if (id === 'C2') return !red(e);
    if (id === 'C3') return g.enemies.some(other => !other.defeated && other.coveredBy.includes(e.id));
    return true;
  });
}
function scouts(g, id, deepUsed = false) {
  const deep = !deepUsed && (id === 'D7' || talent(g,'DQ'));
  return g.enemies.filter(e => !e.defeated && !e.revealed &&
    (isSelectable(e) || (deep && e.coveredBy.length === 1)));
}
function paymentChoices(g,id,reserved) {
  const suit = suits[id[0]];
  if (extraSupply(id) && g.supply.length < 2) return [];
  if (extraHand(id) && !g.hand.length) return [];
  const convertible = (talent(g,'HK') && suit === 'hearts') || (talent(g,'SQ') && suit === 'spades');
  return g.supply.flatMap(card => {
    const choices = [];
    if (card.suit === suit || id.slice(1) === '8') choices.push({card, preferred: card.suit === suit});
    if (card.suit !== suit && convertible && g.hand.some(h => h.suit === suit && h !== reserved)) choices.push({card, convert:true, preferred:true});
    return choices;
  }).filter(p => {
    if (id === 'D8' || id === 'C8') return true;
    if (id[0] === 'D') return scouts(g,id).length;
    if (id[0] === 'C') return strikeTargets(g,id,p.preferred).length ||
      (talent(g,'CQ') && g.hand.length > Number(extraHand(id)) && front(g).some(e => !e.revealed));
    if (id[0] === 'S') return !g.constructed.guard && g.hand.length > Number(extraHand(id));
    return true;
  });
}
function playable(g,id) {
  return !g.constructed.used.includes(id) && paymentChoices(g,id).length > 0;
}
export function hasAction(g) {
  const d = g.constructed;
  return g.hand.length || (d.deck.length && (!d.learned.length || g.supply.length)) ||
    d.learned.some(id => playable(g,id));
}
async function payment(g,id,reserved) {
  const p = await pick('选择发动技能的物资',paymentChoices(g,id,reserved),
    v => label(v.card) + (v.convert ? ' · 与本家手牌交换' : ''),true);
  if (!p) return;
  const convert = p.convert && await pick('用于交换的手牌',g.hand.filter(c => c.suit === suits[id[0]] && c !== reserved),label,true);
  if (p.convert && !convert) return;
  const second = extraSupply(id) && await pick('再支付一张物资',g.supply.filter(c => c !== p.card),label,true);
  if (extraSupply(id) && !second) return;
  const handCost = extraHand(id) && await pick('再弃一张手牌',convert ? [...g.hand.filter(c => c !== convert),p.card] : g.hand,label,true);
  if (extraHand(id) && !handCost) return;
  if (convert) {
    g.hand[g.hand.indexOf(convert)] = p.card;
    g.supply[g.supply.indexOf(p.card)] = convert;
    p.card = convert;
    spentTalent(g);
  }
  g.discard.push(take(g.supply,p.card));
  if (second) g.discard.push(take(g.supply,second));
  if (handCost) g.discard.push(take(g.hand,handCost));
  return {...p, second, handCost};
}
function defeat(g,e,reward = true) {
  e.defeated = true;
  const c = {id:e.id,rank:e.rank,suit:e.suit};
  (reward ? g.supply : g.discard).push(c);
  computeCoverage();
  return c;
}
async function moveSome(title, from, to, limit) {
  for (let i = 0; i < limit && from.length; i++) {
    const c = await pick(title,from,label,true);
    if (!c) break;
    to.push(take(from,c));
  }
}
async function heart(g,id,p) {
  const counts = { HA:2,H2:3,H3:2,H4:1,H5:3,H6:3,H7:2,H8:p.preferred ? 4 : 2,H9:4,H10:p.second?.suit === 'hearts' ? 6 : 4 };
  if (id === 'H4' || id === 'H7') {
    const pool = g.discard.filter(c => c !== p.card);
    if (pool.length) recovery(g,id === 'H4' ? pool.at(-1) : await pick('选一张弃牌加入手牌',pool,label));
    else if (id === 'H7') counts.H7++;
  }
  const sift = talent(g,'HQ') && await optional('随军粮道','多看一张，再将其中一张放回库顶。');
  const drawn = draw(counts[id] + Number(sift));
  if (sift && drawn.length) {
    g.deck.push(take(drawn,await pick('放回普通牌库顶',drawn,label)));
    spentTalent(g);
  }
  if (id === 'H2' && drawn.length) g.deck.unshift(take(drawn,await pick('放回普通牌库底',drawn,label)));
  if (id === 'H3' && drawn.length) g.supply.push(take(drawn,await pick('转为物资',drawn,label)));
  if (id === 'H6' || id === 'H10') await moveSome('将抽到的牌转为物资',drawn,g.supply,id === 'H6' ? 1 : 2);
  if (talent(g,'HJ') && drawn.length) {
    const c = await pick('督粮官 · 将一张转为物资',drawn,label,true);
    if (c) { g.supply.push(take(drawn,c)); spentTalent(g); }
  }
  g.hand.push(...drawn);
  if (id === 'H9' && p.handCost.suit === 'hearts') g.supply.push(...draw(1));
}
async function diamonds(g,id,p) {
  const limits = { DA:1,D2:1,D3:2,D4:1,D5:2,D6:2,D7:2,D8:p.preferred ? 3 : 1,D9:2,D10:Infinity };
  const seen = [];
  let deep = false;
  while (seen.length < limits[id]) {
    const pool = scouts(g,id,deep).filter(e => id !== 'D3' || !seen.length || seen[0].layer === e.layer);
    if (!pool.length) break;
    const e = id === 'D10' ? pool.find(isSelectable) || await pick('斥候接力 · 侦查后排',pool,enemyLabel,true)
      : await pick('选择侦查目标',pool,enemyLabel,seen.length > 0 || id === 'D8');
    if (!e) break;
    if (!isSelectable(e)) {
      deep = true;
      if (id !== 'D7' && talent(g,'DQ')) spentTalent(g);
    }
    e.revealed = true;
    seen.push(e);
    window.renderAll();
  }
  if (id === 'D8') {
    g.hand.push(...draw(1));
    const pool = g.discard.filter(c => seen.some(e => red(c) === red(e)));
    if (pool.length) recovery(g,await pick('军报 · 取回同色牌',pool,label));
  }
  if (id === 'D2' && g.deck.length && await optional('夜观星象',label(g.deck.at(-1)) + ' 放到库底？')) g.deck.unshift(g.deck.pop());
  if (id === 'D4' && g.hand.length && g.discard.length) {
    const h = await pick('与弃堆顶 ' + label(g.discard.at(-1)) + ' 交换',g.hand,label,true);
    if (h) { g.hand[g.hand.indexOf(h)] = g.discard.pop(); g.discard.push(h); }
  }
  if (id === 'D6' && seen.length === 1) g.hand.push(...draw(1));
  if (id === 'D9' || id === 'D10') {
    const legal = seen.filter(e => isSelectable(e) && (id === 'D10' || e.suit === p.handCost.suit));
    if (legal.length) {
      const e = await pick('选择击败目标',legal,enemyLabel,true);
      if (e) for (const target of legal.filter(t => t === e || (id === 'D10' && t.suit === e.suit))) defeat(g,target);
    }
  }
  const live = seen.filter(e => !e.defeated);
  if (talent(g,'DJ') && live.length) {
    const e = await pick('掌书记 · 盖回一名换一张手牌',live,enemyLabel,true);
    if (e) { e.revealed = false; g.hand.push(...draw(1)); spentTalent(g); }
  }
  if (talent(g,'DK')) {
    const legal = live.filter(e => isSelectable(e) && g.hand.some(h => h.suit === e.suit));
    if (!legal.length) return;
    const e = await pick('料敌如神 · 弃同花手牌击败',legal,enemyLabel,true);
    if (e) {
      g.discard.push(take(g.hand,await pick('支付同花色手牌',g.hand.filter(h => h.suit === e.suit),label)));
      defeat(g,e);
      spentTalent(g);
    }
  }
}
async function clubs(g,id,p) {
  const original = new Set(front(g));
  if (talent(g,'CQ') && g.hand.length && front(g).some(e => !e.revealed)) {
    const c = await pick('破阵余势 · 弃手牌侦查',g.hand,label,true);
    if (c) {
      g.discard.push(take(g.hand,c));
      (await pick('翻明暗敌',front(g).filter(e => !e.revealed),enemyLabel)).revealed = true;
      spentTalent(g);
    }
  }
  const pool = id === 'C8' ? front(g) : strikeTargets(g,id,p.preferred);
  if (!pool.length) return;
  const first = await pick('选择强攻目标',pool,enemyLabel);
  first.revealed = true;
  if (id === 'C8' && !p.preferred && first.rank > 7) {
    const pool = g.discard.filter(c => c.suit === first.suit);
    if (pool.length) recovery(g,await pick('取回与目标同花色的牌',pool,label));
    return;
  }
  const loot = defeat(g,first,id !== 'C4');
  if (id !== 'C4' && (id === 'C7' || talent(g,'CJ')) && await optional('收编守军',label(loot) + ' 改为手牌？')) {
    g.hand.push(take(g.supply,loot));
    if (id !== 'C7') spentTalent(g);
  } else if (id === 'C6' && await optional('两翼夹攻','用牌库顶一张替换缴获？')) {
    g.discard.push(take(g.supply,loot)); g.supply.push(...draw(1));
  }
  let previous = original;
  for (let step = 0; step < (id === 'C10' ? 2 : Number(id === 'C9')); step++) {
    const next = front(g).filter(e => !previous.has(e));
    if (!next.length) break;
    const e = await pick('追击新露出的目标',next,enemyLabel,true);
    if (!e) break;
    previous = new Set(front(g));
    e.revealed = true;
    if (id === 'C9' && red(e) !== red(p.handCost)) break;
    if (id === 'C10') {
      const matches = g.hand.filter(h => h.suit === e.suit || h.rank === e.rank);
      if (!matches.length) break;
      const h = await pick('支付追击手牌',matches,label,true);
      if (!h) break;
      g.discard.push(take(g.hand,h));
    }
    defeat(g,e);
  }
  const opened = front(g).filter(e => !original.has(e));
  if (talent(g,'CK') && opened.length && g.supply.length) {
    const supply = await pick('连营拔寨 · 支付追加物资',g.supply,label,true);
    if (supply) {
      g.discard.push(take(g.supply,supply));
      defeat(g,await pick('弃置新目标',opened,enemyLabel),false);
      spentTalent(g);
    }
  }
}
function finish(g) {
  g.selectedHand = null;
  g.phase = 'playing';
  checkGameOver();
  window.renderAll();
}
export async function attack(e) {
  const g = window.gameState;
  const d = g.constructed;
  g.phase = 'constructed-action';
  const c = g.hand[g.selectedHand];
  const seen = e.revealed;
  const hit = c.suit === e.suit || c.rank === e.rank;
  e.revealed = true;
  if (!d.guard) {
    const reactions = d.learned.filter(skill => ['S5','S6','S7'].includes(skill) && !d.used.includes(skill) && paymentChoices(g,skill,c).length);
    if (reactions.length) {
      const skill = await choose('黑桃防御 · 亮牌后支付', label(c) + ' 攻打 ' + label(e) + (hit ? ' 成功' : ' 失败'),
        [...options(reactions,id => cards[id][0]),cancel]);
      if (skill) {
        // 保留正在攻城的牌，不可将其用于天赋换资。
        const paid = await payment(g,skill,c);
        if (paid) d.guard = {id:skill,preferred:paid.preferred};
      }
    }
  }
  take(g.hand,c);
  const {id,preferred} = d.guard || {};
  const protectedCard = !!id && ({SA:!hit,S2:!seen,S3:seen,S4:hit}[id] ?? true);
  e.revealed = true;
  if (hit || id === 'S10') defeat(g,e);
  if (protectedCard) g.hand.push(c);
  else g.discard.push(c);
  if (protectedCard) {
    if (id === 'S6' && !hit && g.discard.length && await optional('回马一枪','换取 ' + label(g.discard.at(-1)) + '？')) {
      g.hand.push(g.discard.pop()); g.discard.push(take(g.hand,c));
    }
    if (((id === 'S7' && hit) || talent(g,'SJ')) && g.hand.includes(c) && await optional('转为物资','将 ' + label(c) + ' 转为物资并抽一张？')) {
      g.supply.push(take(g.hand,c)); g.hand.push(...draw(1));
      if (id !== 'S7' || !hit) spentTalent(g);
    }
    if (id === 'S8') {
      const pool = g.discard.filter(h => h.suit === e.suit);
      if (!hit && pool.length && (preferred || g.hand.includes(c))) {
        const chosen = await pick('诱敌露隙 · 取回敌人同花色弃牌',pool,label,true);
        if (chosen) {
          recovery(g,chosen);
          if (!preferred) g.discard.push(take(g.hand,c));
        }
      }
      const dark = front(g).filter(t => !t.revealed);
      if (preferred && dark.length) {
        const other = await pick('诱敌露隙 · 侦查',dark,enemyLabel,true);
        if (other) other.revealed = true;
      }
    }
    if (id === 'S9') await moveSome('金蝉脱壳 · 取回弃牌',g.discard,g.hand,2);
    if (id === 'S10' || (talent(g,'SK') && g.hand.includes(c))) {
      const counter = id === 'S10';
      const eligible = front(g).filter(t => t !== e && t.revealed &&
        (counter ? g.hand.some(h => h.suit === t.suit) : red(t) === red(c)));
      if (eligible.length) {
        const target = await pick('选择反击目标',eligible,enemyLabel,true);
        if (target) {
          const cost = counter ? await pick('弃一张同花色手牌',g.hand.filter(h => h.suit === target.suit),label) : c;
          g.discard.push(take(g.hand,cost)); defeat(g,target);
          if (!counter) spentTalent(g);
        }
      }
    }
  }
  d.guard = null;
  d.used = [];
  d.talentTurn = 0;
  g.turn++;
  setMessage(label(c) + (hit ? ' 攻城成功，缴获 ' : id === 'S10' ? ' 反击得手，缴获 ' : ' 攻城失手，敌人为 ') + label(e));
  finish(g);
}
async function act(id) {
  const g = window.gameState;
  const d = g.constructed;
  if (g.phase !== 'playing' || !d.learned.includes(id) || !playable(g,id)) return;
  g.phase = 'constructed-action';
  const p = await payment(g,id);
  if (p) {
    d.used.push(id);
    if (id[0] === 'H') await heart(g,id,p);
    if (id[0] === 'D') await diamonds(g,id,p);
    if (id[0] === 'C') await clubs(g,id,p);
    if (id[0] === 'S') d.guard = {id,preferred:p.preferred};
    setMessage('已发动 ' + cards[id][0]);
  }
  finish(g);
}
export function render() {
  const g = window.gameState;
  const d = g.constructed;
  const panel = document.getElementById('constructed-panel');
  document.getElementById('basic-tactics').classList.toggle('hidden', !!d);
  panel.classList.toggle('hidden', !d);
  if (!d) return;
  const [talent, text] = talents[d.talent];
  panel.innerHTML = '<h2 class="section-title">' + d.name + '</h2><p>' + talent + ' · ' + text +
    '</p><p>已学 ' + d.learned.length + ' 项 · 待学 ' + new Set(d.deck).size + ' 项</p>';
  function button(title, enabled, onClick) {
    const b = document.createElement('button');
    b.textContent = title;
    b.disabled = g.phase !== 'playing' || !enabled;
    b.onclick = onClick;
    panel.append(b);
  }
  button(d.learned.length ? '学习技能 · 1 物资' : '免费学习首个技能',
    d.deck.length && (!d.learned.length || g.supply.length), learn);
  if (d.guard) {
    const hint = document.createElement('p');
    hint.textContent = '本次攻城已准备：' + cards[d.guard.id][0];
    panel.append(hint);
  }
  for (const id of d.learned) {
    const used = d.used.includes(id);
    button(cards[id].join(' · ') + (used ? '（本回合已用）' : ''), playable(g,id), () => act(id));
  }
}
export function showRules() {
  const d = window.gameState.constructed;
  const [talent, text] = talents[d.talent];
  showModal('技能构筑 · ' + d.name, '以同花色或同点数的手牌攻打未被覆盖的敌人，击败全部敌人获胜。天赋开局入手并持续生效，确认手牌后免费二选一学习首个技能。之后每弃一张任意物资可再学一项，优先展示两个不同名的未学技能。所学技能整局保留。主动技能每回合各可发动一次，普通攻城后恢复；每次攻城只能预备一项黑桃防御，天赋每回合限用一次。支付完成后结算技能。<br><br>' +
    talent + ' · ' + text + '<br><br>' + [...new Set(d.list)].map(id => cards[id][0] + ' ×' + d.list.filter(c => c === id).length + ' · ' + cards[id][1]).join('<br>'));
}
