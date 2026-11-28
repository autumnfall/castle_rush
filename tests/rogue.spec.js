import { test, expect } from '@playwright/test';
import { makeCard, makeEnemy, patchGameState, clickSupplyBySuit } from './helpers.js';

const choices = page => page.locator('#modal-extra button');
async function start(page) {
  page.on('pageerror', e => { throw e; });
  await page.goto('/castle_rush/');
  expect(await page.locator('.mode-card').evaluateAll(items=>items.map(el=>el.dataset.mode))).toEqual(['basic','commander','rogue']);
  await expect(page.locator('[data-mode="rogue"] .mode-name')).toHaveText('创造模式');
  await page.click('[data-mode="rogue"]');
  await page.click('#btn-mode-confirm');
  await expect(page.locator('.hand-card')).toHaveCount(5);
  await expect(page.locator('#supply-count')).toHaveText('3');
  await page.getByText('确认手牌',{exact:true}).click();
  await expect(page.locator('#rogue-panel h2')).toHaveText('无名 · 等级 1');
}
async function tactic(page,suit) {
  await page.click('#basic-tactics');
  await clickSupplyBySuit(page,suit);
}

test('每个击败一次机会；16项战术无放回异色二选一，五张可保留，第六张才弃置奖励', async ({page}) => {
  await start(page);
  const seen = new Set();
  for (let i=0;i<8;i++) {
    const supply = Array.from({length:i},(_,j)=>makeCard('hearts',j+1));
    await patchGameState(page,{
      hand:[makeCard('hearts',5),makeCard('clubs',3)],supply,
      enemies:[makeEnemy('hearts',1,4,i,1),makeEnemy('clubs',3,3,0,1)]
    });
    await page.locator('.hand-card').first().click();
    await page.locator('.enemy-card.selectable').click();
    await expect(page.locator('#modal-title')).toContainText('击败奖励');
    await choices(page).first().click();
    const options = await choices(page).allTextContents();
    expect(options).toHaveLength(2);
    const suits = options.map(text=>text.match(/[♥♦♣♠]/)[0]);
    expect(suits[0]).not.toBe(suits[1]);
    options.forEach(text=>{ expect(seen.has(text)).toBe(false); seen.add(text); });
    await choices(page).first().click();
    await page.getByRole('button',{name:i === 0 ? '直接装备':'放入背包',exact:true}).click();
    if (i >= 5) {
      await expect(page.locator('#modal-title')).toContainText('必须弃置');
      await expect(choices(page)).toHaveCount(6);
      await choices(page).last().click();
      await choices(page).filter({hasText:'抽一张手牌'}).click();
    }
    await expect(page.locator('#modal-overlay')).not.toHaveClass(/show/);
    const r = await page.evaluate(()=>window.gameState.rogue);
    expect(r.bag.length).toBe(Math.min(i+1,5));
    expect(r.level).toBe(i+2);
    if (!i) expect(r.bag[0]).toMatch(/^base\//);
    expect(await page.locator('#supply-count').textContent()).toBe(String(i));
  }
  expect(seen.size).toBe(16);
});

test('初始侦查付手牌翻第二名，唯一明敌强攻要弃手牌', async ({page}) => {
  await start(page);
  await patchGameState(page,{supply:[makeCard('diamonds',2),makeCard('hearts',4)],hand:[makeCard('hearts',3)],
    enemies:[makeEnemy('clubs',3,4,0,1),makeEnemy('hearts',5,4,1,3)]});
  await tactic(page,'diamonds');
  await choices(page).first().click();
  await choices(page).first().click();
  await choices(page).first().click();
  await expect(page.locator('.enemy-card.front')).toHaveCount(2);
  await expect(page.locator('.hand-card')).toHaveCount(0);
  await patchGameState(page,{supply:[makeCard('clubs',2)],hand:[makeCard('hearts',3)],
    enemies:[makeEnemy('clubs',8,4,0,1,true),makeEnemy('hearts',9,3,0,1)]});
  await tactic(page,'clubs');
  await choices(page).first().click();
  await choices(page).first().click();
  await choices(page).filter({hasText:'跳过'}).click();
  await expect(page.locator('.hand-card')).toHaveCount(0);
  await expect(page.locator('.enemy-card')).toHaveCount(1);
  await expect(page.locator('#supply-count')).toHaveText('1');
});
test('升级门槛不够时不抽卡，弃置奖励可以强化背包中的初始战术并换装', async ({page}) => {
  await start(page);
  await page.evaluate(()=>{
    const r=window.gameState.rogue;
    r.level=3;r.equipped.hearts='intel/hearts';r.bag=['base/hearts','logistics/diamonds'];
  });
  await patchGameState(page,{hand:[makeCard('clubs',2),makeCard('diamonds',3)],supply:[],
    enemies:[makeEnemy('clubs',8,4,0,1),makeEnemy('spades',9,3,0,1)]});
  await page.locator('.hand-card').first().click();
  await page.locator('.enemy-card.selectable').click();
  await expect(page.locator('#modal-overlay')).not.toHaveClass(/show/);
  await page.getByText('管理背包与装备').click();
  await choices(page).filter({hasText:'优势侦查'}).click();
  await choices(page).filter({hasText:'弃置并领取'}).click();
  await choices(page).filter({hasText:'升级初始补给'}).click();
  await page.getByText('管理背包与装备').click();
  await choices(page).filter({hasText:'初始补给 +1'}).click();
  await choices(page).filter({hasText:'换上此战术'}).click();
  const state = await page.evaluate(()=>window.gameState.rogue);
  expect(state.equipped.hearts).toBe('base/hearts');
  expect(state.bag).toEqual(['intel/hearts']);
  expect(state.seen).toEqual([]);
});
test('二次强化方块可以击败敌人，满级黑桃可以代弃再交换', async ({page})=>{
  await start(page);
  await page.evaluate(()=>{Object.assign(window.gameState.rogue.ranks,{diamonds:2,spades:2});});
  await patchGameState(page,{hand:[makeCard('hearts',2)],supply:[makeCard('diamonds',2),makeCard('spades',6)],
    enemies:[makeEnemy('clubs',5,4,0,1),makeEnemy('diamonds',8,3,0,1)]});
  await tactic(page,'diamonds');
  await choices(page).first().click();
  await choices(page).first().click();
  await choices(page).filter({hasText:'跳过'}).click();
  await page.locator('.hand-card').first().click();
  await page.locator('.enemy-card.selectable').click();
  await choices(page).filter({hasText:'♠6'}).click();
  await choices(page).first().click();
  await choices(page).filter({hasText:'♦2'}).click();
  await expect(page.locator('.hand-card')).toHaveText('2♦');
  await expect(page.locator('#turn-count')).toHaveText('2');
});

test('混装指挥官战术使用对应的原有效果，渗透失败不获得击败升级',async({page})=>{
  await start(page);
  page.on('dialog',dialog=>dialog.accept());
  await page.evaluate(()=>{
    Object.assign(window.gameState.rogue.equipped,{clubs:'intel/clubs',hearts:'tactician/hearts'});
  });
  await patchGameState(page,{
    hand:[makeCard('clubs',2)],supply:[makeCard('diamonds',2),makeCard('clubs',3),makeCard('hearts',5)],
    enemies:[makeEnemy('hearts',5,4,0,1,true),makeEnemy('spades',6,4,1,3),makeEnemy('clubs',4,3,0,1)]
  });
  await tactic(page,'hearts');
  await choices(page).filter({hasText:'按花色抽3张'}).click();
  await expect(page.locator('.hand-card')).toHaveCount(4);
  await tactic(page,'clubs');
  await page.locator('.enemy-card.front.selectable').click();
  await page.locator('.enemy-card.back.selectable').click();
  await expect(page.locator('.enemy-card')).toHaveCount(2);
  await expect(page.locator('#modal-overlay')).not.toHaveClass(/show/);
  expect(await page.evaluate(()=>window.gameState.rogue.level)).toBe(1);
});

test('弃置背包初始战术只奖励一次，奖励排除已弃置或已满级的初始战术', async ({page})=>{
  await start(page);
  await page.evaluate(()=>{
    const g=window.gameState, r=g.rogue;
    Object.assign(r.equipped,{clubs:'intel/clubs',hearts:'assault/hearts'});
    r.bag=['base/clubs','base/hearts'];
    r.ranks.spades=2;
    window.renderAll();
  });
  await page.getByText('管理背包与装备').click();
  await choices(page).filter({hasText:'初始强攻'}).click();
  await choices(page).filter({hasText:'弃置并领取'}).click();
  await expect(choices(page)).toHaveCount(3);
  await expect(choices(page).filter({hasText:'升级初始强攻'})).toHaveCount(0);
  await expect(choices(page).filter({hasText:'升级初始防御'})).toHaveCount(0);
  await choices(page).filter({hasText:'升级初始补给'}).click();
  await expect(page.locator('#modal-overlay')).not.toHaveClass(/show/);
  const r=await page.evaluate(()=>window.gameState.rogue);
  expect(r.bag).toEqual(['base/hearts']);
  expect(r.ranks.hearts).toBe(1);
  expect(r.ranks.clubs).toBe(0);
});

test('四个装备槽始终有战术，开局不能弃装备领奖', async ({page})=>{
  await start(page);
  await expect(page.getByText('管理背包与装备')).toBeDisabled();
  const gear=await page.evaluate(()=>Object.values(window.gameState.rogue.equipped));
  expect(gear).toEqual(['base/hearts','base/diamonds','base/clubs','base/spades']);
});

test('创造模式突破战术不能用本次缴获的黑桃代弃', async ({page}) => {
  await start(page);
  await page.evaluate(() => { window.gameState.rogue.equipped.spades = 'assault/spades'; window.gameState.rogue.level = 20; });
  const hand = makeCard('hearts',6);
  const target = makeEnemy('spades',6,4,0,1,true);
  await patchGameState(page,{ hand:[hand], supply:[], discard:[], enemies:[target,makeEnemy('clubs',8,4,1,3)] });
  page.on('dialog', dialog => dialog.accept());
  await page.locator('.hand-card').click();
  await page.locator('.enemy-card.selectable.front').click();
  expect(await page.evaluate(() => {
    const g = window.gameState;
    return [g.hand.map(c=>c.id),g.supply.map(c=>c.id),g.discard.map(c=>c.id),g.turn,g.phase];
  })).toEqual([[],[target.id],[hand.id],2,'playing']);
});

test('首页和创造模式对局内均可查阅四花色的三档初始战术', async ({page}) => {
  await page.goto('/');
  for (const inGame of [false,true]) {
    if (inGame) await start(page);
    await page.getByRole('button',{name:inGame ? '规则说明' : '阅读规则',exact:true}).click();
    await expect(page.locator('.tab-btn.active')).toHaveText(inGame ? '创造模式' : '基础规则');
    await page.getByRole('button',{name:'初始战术升级预览'}).click();
    const panel = page.locator('#tab-upgrades');
    await expect(panel).toBeVisible();
    await expect(panel.locator('h4')).toHaveCount(4);
    await expect(panel.locator('li')).toHaveCount(12);
    await expect(panel).toContainText('攻城成功或失败');
    await page.locator('#modal > button').click();
  }
});

test('创造模式各级防御仅可选择攻城前持有的黑桃', async ({page}) => {
  await start(page);
  for (const rank of [0,1,2]) {
    await page.evaluate(rank => {
      window.gameState.rogue.level = 20;
      window.gameState.rogue.ranks.spades = rank;
    },rank);
    for (const [hit, stocked] of [[true,false],[true,true],[false,true]]) {
      const h = makeCard('hearts',5), spare = makeCard('clubs',2);
      const target = makeEnemy(hit ? 'spades':'clubs',hit ? 5:7,4,0,1);
      const payment = makeCard('spades',8);
      await patchGameState(page,{hand:[h,spare],supply:stocked ? [payment]:[],discard:[],
        enemies:[target,makeEnemy('diamonds',9,4,1,3)]});
      await page.locator('.hand-card').first().click();
      await page.locator('.enemy-card.selectable').first().click();
      const replaces = stocked && (rank > 0 || !hit);
      if (replaces) {
        await expect(choices(page)).toHaveCount(2);
        await choices(page).filter({hasText:'♠8'}).click();
        if (rank === 2) await choices(page).filter({hasText:'跳过'}).click();
      }
      await expect(page.locator('#modal-overlay')).not.toHaveClass(/show/);
      const piles = await page.evaluate(() => ['hand','supply','discard'].map(zone=>window.gameState[zone].map(c=>c.id)));
      expect(piles).toEqual([
        replaces ? [h.id,spare.id] : [spare.id],
        [...(stocked && !replaces ? [payment.id] : []), ...(hit ? [target.id] : [])],
        [replaces ? payment.id : h.id],
      ]);
    }
  }
});
