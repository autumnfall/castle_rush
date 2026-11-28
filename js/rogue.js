import { SUITS, SUIT_SYMBOLS, rankName, shuffle } from './config.js';
import { COMMANDERS } from './commanders.js';
import { draw, isSelectable, computeCoverage, checkGameOver } from './core.js';
import { showChoiceModal, setMessage } from './ui.js';

const owners = ['logistics','intel','tactician','assault'];
const methods = {hearts:'onSkillHearts', diamonds:'onSkillDiamonds', clubs:'onSkillClubs', spades:'onSkillSpades'};
const names = {hearts:'补给', diamonds:'侦查', clubs:'强攻', spades:'防御'};
const initial = {
  hearts:['抽2张手牌。','抽3张手牌。','抽3张，然后可交换一张手牌与一张物资。'],
  diamonds:['翻明一名可选暗敌，可弃一张手牌再翻明一名。','翻明至多两名可选暗敌。','翻明两名可选暗敌；实际不足两名时，可击败一名可选明敌。'],
  clubs:['击败并缴获一名可选明敌；若它是场上唯一明敌，还须弃一张手牌。','击败并缴获一名可选明敌。','击败并缴获一名可选的明置敌人。击败后，若场上仍有其他明置敌人，你可以抽一张手牌。'],
  spades:['攻城失败时，可用黑桃物资代弃攻城手牌。','新手防御：攻城成功或失败时，可用黑桃物资代弃攻城手牌。','手牌将弃置时，可用黑桃物资代弃，然后可交换一张手牌与一张普通弃牌。']
};
const id = (owner,suit) => owner + '/' + suit;
const pool = owners.flatMap(owner => SUITS.map(suit => id(owner,suit)));
const suitOf = key => key.split('/')[1];
const ownerOf = key => key.split('/')[0];
const base = suit => id('base',suit);
const label = c => SUIT_SYMBOLS[c.suit] + rankName(c.rank);
const enemyLabel = e => '第' + (e.layer+1) + '层 ' + (e.index+1) + '号 · ' + (e.revealed ? label(e) : '暗敌');
const remove = (pile,card) => pile.splice(pile.indexOf(card),1)[0];
const ask = (title,hint,choices) => new Promise(resolve => showChoiceModal(title,hint,choices,resolve));
const skip = {label:'跳过', value:null};
const pick = (title,items,describe,optional=false,hint='') => ask(title,hint,[
  ...items.map(value => ({label:describe(value),value})), ...(optional ? [skip] : [])
]);
function description(r,key) {
  const suit = suitOf(key), owner = ownerOf(key);
  if (owner === 'base') return '初始' + names[suit] + ' +' + r.ranks[suit] + ' · ' + initial[suit][r.ranks[suit]];
  return COMMANDERS[owner].name + ' · ' + COMMANDERS[owner].skillDesc[suit];
}
export function createRun() {
  return { level:1, equipped:Object.fromEntries(SUITS.map(s => [s,base(s)])),
    ranks:Object.fromEntries(SUITS.map(s => [s,0])), bag:[], seen:[], resolved:new Set(), pending:0 };
}
export function canSalvage(g) {
  return !!g.rogue?.bag.length;
}
function finish(g) {
  g.phase = 'playing';
  g.selectedHand = null;
  g.skillMode = null;
  document.getElementById('skill-section').style.display = 'none';
  computeCoverage();
  checkGameOver();
  window.renderAll();
}
function candidates(r) {
  const left = pool.filter(key => !r.seen.includes(key));
  // Keep the remainder pairable, so all sixteen tactics can appear across eight offers.
  const pairs = [];
  for (let i=0; i<left.length; i++) {
    for (const b of left.slice(i+1)) {
      const a = left[i];
      if (suitOf(a) === suitOf(b)) continue;
      const rest = left.filter(key => key !== a && key !== b);
      if (SUITS.every(s => rest.filter(key => suitOf(key) === s).length <= rest.length/2)) pairs.push([a,b]);
    }
  }
  return shuffle(pairs)[0];
}
function equip(r,key) {
  const suit = suitOf(key);
  if (r.bag.includes(key)) remove(r.bag,key);
  if (r.equipped[suit]) r.bag.push(r.equipped[suit]);
  r.equipped[suit] = key;
}
async function reward(g) {
  const r = g.rogue;
  const upgradable = SUITS.filter(s => r.ranks[s]<2 && (r.equipped[s]===base(s) || r.bag.includes(base(s))));
  const choice = await ask('弃置战术奖励','选择一项。',[
    {label:'抽一张手牌',value:null},
    ...upgradable.map(s => ({label:SUIT_SYMBOLS[s]+ ' 升级初始' + names[s] + ' 至 +' + (r.ranks[s]+1) + ' · ' + initial[s][r.ranks[s]+1],value:s}))
  ]);
  if (choice) r.ranks[choice]++;
  else g.hand.push(...draw(1));
}
async function upgrade(g) {
  const r = g.rogue;
  g.phase = 'rogue-upgrade';
  while (r.pending > 0) {
    r.pending--;
    if (g.supply.length < r.level || r.seen.length >= pool.length) continue;
    const payment = await pick('击败奖励 · 升级至 '+(r.level+1)+'级',g.supply,label,true,
      '现有 '+g.supply.length+' 物资，门槛 '+r.level+'。任选一张弃掉升级，也可跳过本次机会。');
    if (!payment) continue;
    const pair = candidates(r);
    if (!pair) continue;
    g.discard.push(remove(g.supply,payment));
    r.level++;
    r.seen.push(...pair);
    const chosen = await pick('选择新战术',pair,key=>description(r,key));
    const place = await ask('安置新战术',description(r,chosen),[
      {label:'直接装备',value:'equip'},{label:'放入背包',value:'bag'}
    ]);
    if (place === 'equip') equip(r,chosen);
    else r.bag.push(chosen);
    setMessage('升至 '+r.level+' 级，'+(place === 'equip' ? '装备' : '收纳')+'了 '+description(r,chosen)+'。');
    if (r.bag.length > 5) {
      const drop = await pick('背包已满 · 必须弃置一张',r.bag,key=>description(r,key));
      remove(r.bag,drop);
      await reward(g);
    }
  }
  finish(g);
}
async function manage(g) {
  if (g.phase !== 'playing') return;
  g.phase = 'rogue-manage';
  const r = g.rogue;
  const item = await pick('管理背包',r.bag,key => description(r,key),true);
  if (item) {
    const action = await ask('处理背包战术',description(r,item),[
      {label:'换上此战术',value:'equip'}, {label:'弃置并领取奖励',value:'drop'}, skip
    ]);
    if (action === 'equip') equip(r,item);
    if (action === 'drop') {
      remove(r.bag,item);
      await reward(g);
    }
  }
  finish(g);
}
export function render() {
  const g = window.gameState, r = g.rogue;
  const panel = document.getElementById('rogue-panel');
  panel.classList.toggle('hidden',!r);
  if (!r) return;
  const open = panel.querySelector('details')?.open;
  panel.innerHTML = '<h2 class="section-title">无名 · 等级 '+r.level+'</h2><p>背包 '+r.bag.length+'/5 · 已出现战术 '+r.seen.length+'/16</p>'+
    '<details><summary>已装备战术</summary>'+SUITS.map(s=>'<p>'+SUIT_SYMBOLS[s]+' '+(r.equipped[s]?description(r,r.equipped[s]):'空槽')+'</p>').join('')+'</details>';
  panel.querySelector('details').open = !!open;
  const button = document.createElement('button');
  button.textContent = '管理背包与装备';
  button.disabled = g.phase !== 'playing' || !canSalvage(g);
  button.onclick = () => manage(g);
  panel.append(button);
  // Chained defeats are collected separately and offered once the enclosing action settles.
  if (g.phase === 'playing' || g.skillMode === 'push_chain') {
    for (const e of g.enemies) {
      if (e.defeated && !r.resolved.has(e.id)) {
        r.resolved.add(e.id);
        if (g.supply.length >= r.level && r.seen.length < pool.length) r.pending++;
      }
    }
    if (g.phase === 'playing' && r.pending) void upgrade(g);
  }
}
async function swap(g,pile,title,reserved) {
  if (!g.hand.length || !pile.length) return;
  const hand = g.hand.filter(c=>c !== reserved);
  if (!hand.length) return;
  const h = await pick(title+' · 选择手牌',hand,label,true);
  if (!h) return;
  const other = await pick(title+' · 选择换入的牌',[...pile].reverse(),label,true);
  if (other) {
    g.hand[g.hand.indexOf(h)] = other;
    pile[pile.indexOf(other)] = h;
  }
}
const dark = g => g.enemies.filter(e => isSelectable(e) && !e.revealed);
const bright = g => g.enemies.filter(e => isSelectable(e) && e.revealed);
function defeat(g,e) {
  e.defeated = true;
  g.supply.push({id:e.id,suit:e.suit,rank:e.rank});
  computeCoverage();
}
async function defend(g,h,supply,reserved) {
  const card = await pick('黑桃防御 · 是否代弃 '+label(h),supply.filter(c=>c.suit==='spades'),label,true);
  if (!card) return false;
  g.discard.push(remove(g.supply,card));
  if (g.rogue.ranks.spades === 2) await swap(g,g.discard,'防御后交换',reserved);
  return true;
}
export async function discardHand(g,h,reserved) {
  if (g.rogue.equipped.spades === base('spades') && g.rogue.ranks.spades === 2 &&
      g.supply.some(c=>c.suit==='spades') && await defend(g,h,g.supply,reserved)) return;
  g.discard.push(remove(g.hand,h));
}
async function initialAction(g,card) {
  const suit = card.suit, rank = g.rogue.ranks[suit];
  g.phase = 'rogue-action';
  const pay = () => g.discard.push(remove(g.supply,card));
  if (suit === 'hearts') {
    pay();
    g.hand.push(...draw(rank === 0 ? 2 : 3));
    if (rank === 2) await swap(g,g.supply,'补给后交换');
  } else if (suit === 'diamonds') {
    let flipped = 0;
    if (!dark(g).length && !(rank===2 && bright(g).length)) return finish(g);
    pay();
    while (flipped < 2 && dark(g).length) {
      if (flipped === 1 && rank === 0) {
        if (!g.hand.length) break;
        const h = await pick('弃一张手牌，继续侦查',g.hand,label,true);
        if (!h) break;
        await discardHand(g,h);
      }
      const e = await pick('侦查 · 选择暗敌',dark(g),enemyLabel,rank === 1 && flipped === 1);
      if (!e) break;
      e.revealed = true;
      flipped++;
      window.renderAll();
    }
    if (rank === 2 && flipped < 2 && bright(g).length) {
      const e = await pick('侦查不足两名 · 可击败一名明敌',bright(g),enemyLabel,true);
      if (e) defeat(g,e);
    }
  } else {
    const only = g.enemies.filter(e=>!e.defeated && e.revealed).length === 1;
    if (!bright(g).length || (rank === 0 && only && !g.hand.length)) {
      setMessage('需要可选明敌；攻击唯一明敌时，初始强攻还需一张手牌。');
      return finish(g);
    }
    const e = await pick('强攻 · 选择明敌',bright(g),enemyLabel,true);
    if (!e) return finish(g);
    let cost;
    if (rank === 0 && only) {
      cost = await pick('强攻唯一明敌 · 选择弃牌',g.hand,label,true);
      if (!cost) return finish(g);
    }
    pay();
    if (cost) await discardHand(g,cost);
    defeat(g,e);
    if (rank === 2 && g.enemies.some(enemy => !enemy.defeated && enemy.revealed)) {
      const take = await ask('强攻 · 击败后场上仍有其他明置敌人','是否抽一张手牌？',[{label:'抽一张',value:true},skip]);
      if (take) g.hand.push(...draw(1));
    }
  }
  setMessage('已结算 '+SUIT_SYMBOLS[suit]+names[suit]+'。');
  finish(g);
}
export function supplySkill(card) {
  const g = window.gameState, key = g.rogue.equipped[card.suit];
  if (!key) { setMessage('这个花色尚未装备战术。'); return true; }
  if (ownerOf(key) !== 'base') {
    const done = COMMANDERS[ownerOf(key)][methods[card.suit]](card);
    if (done && g.phase === 'skill') window.finishSkill();
  } else if (card.suit === 'spades') {
    setMessage('防御在弃牌时发动。');
    window.finishSkill();
  } else void initialAction(g,card);
  return true;
}
export function attackCommander(g) {
  const key = g.rogue.equipped.spades;
  return key && ownerOf(key)!=='base' ? COMMANDERS[ownerOf(key)] : null;
}
export function baseDefense(g,h,e,hit,supplyAtStart) {
  const r = g.rogue, key = r.equipped.spades;
  if (key && ownerOf(key)!=='base') return false;
  async function resolveAttack() {
    if (hit) defeat(g,e);
    const can = key && (!hit || r.ranks.spades >= 1) && supplyAtStart.some(c=>c.suit==='spades');
    if (can && await defend(g,h,supplyAtStart)) g._skipHandRemove = true;
    else g.discard.push(h);
    setMessage(hit?'攻城成功，已缴获敌人。':'攻城失败，敌人已明置。');
    window.finishAttack();
  }
  void resolveAttack();
  return true;
}
export function ruleTabs() {
  const stages = ['初始', '升级 +1', '升级 +2'];
  const preview = SUITS.map(suit => `<h4>${SUIT_SYMBOLS[suit]} ${names[suit]}</h4>
    <ul>${initial[suit].map((effect, i) => `<li><b>${stages[i]}</b>　${effect}</li>`).join('')}</ul>`).join('');
  return [
    { id: 'rogue', label: '创造模式', content: '开局等级 1，持有 5 张手牌、3 张物资，装备四项初始战术。同花色物资发动对应战术。击败敌人并结算缴获后，物资数达到当前等级即可弃一张物资升一级。每次展示两项不同花色的新战术，两项都算已出现。<br><br>每个花色始终装备一项；只能用同花色战术替换，换下来的战术进背包。背包可放五张，第六张入包时必须弃一张。主动弃置背包战术（包括初始战术）也可领奖：抽一张手牌，或将仍持有的初始战术提升一级，最高 +2。背包中的初始战术也可升级。' },
    { id: 'upgrades', label: '初始战术升级预览', content: preview }
  ];
}
