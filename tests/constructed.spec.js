import { test, expect } from '@playwright/test';
import { patchGameState, makeCard, makeEnemy } from './helpers.js';
import { cards, talents, presets, cardCost, validDeck } from '../js/deck-catalog.js';

async function select(page, name) {
  page.on('pageerror', error => { throw error; });
  await page.goto('/castle_rush/');
  await page.evaluate(() => window.selectMode('constructed'));
  await page.click('#btn-mode-confirm');
  await page.getByRole('button', { name }).click();
}
async function initialSkill(page) {
  await page.getByText('确认手牌', { exact: true }).click();
  await expect(page.locator('#modal-title')).toHaveText('免费学习首个技能');
  await expect(page.locator('#modal-extra button')).toHaveCount(2);
  await page.locator('#modal-extra button').first().click();
  await expect(page.locator('#constructed-panel')).toContainText('已学 1 项');
  await expect(page.locator('#supply-count')).toHaveText('2');
}

test('四花色费用分布、单卡上限、八套预组与 10 费边界', () => {
  for (const suit of ['H','D','C','S']) {
    const costs = Object.keys(cards).filter(id => id.startsWith(suit)).map(cardCost).sort();
    expect(costs).toEqual([1,1,1,1,2,2,2,3,3,4]);
    for (const [rank, cost] of [['J',1],['Q',2],['K',3]]) {
      expect(talents[suit + rank]).toBeTruthy();
      expect(cardCost(suit + rank)).toBe(cost);
    }
  }
  for (const p of Object.values(presets)) expect(validDeck(p)).toBe(true);
  expect(validDeck({talent:'HK',list:['HA','HA','H3','C5','H6']})).toBe(false);
  expect(validDeck({talent:'HK',list:['HA','H2','H3','C3','H6']})).toBe(false);
  expect(validDeck({talent:'HK',list:['HA','H2','H3','C3','C10']})).toBe(false);
});

test('学习只付一次，候选不同名，学会后永久保留且不再进入候选', async ({ page }) => {
  await select(page, /粮道不绝/);
  await initialSkill(page);
  await page.evaluate(() => {
    Object.assign(window.gameState.constructed, { learned:['H2'], deck:['H3','H4'] });
  });
  await patchGameState(page, { supply:[makeCard('hearts', 6),makeCard('clubs', 3)] });
  const learn = page.getByRole('button', { name:'学习技能 · 1 物资' });
  await learn.click();
  await page.locator('#modal-extra').getByText('取消').click();
  await expect(page.locator('#supply-count')).toHaveText('2');
  await learn.click();
  await page.locator('#modal-extra').getByText('♥6').click();
  await expect(page.locator('#modal-extra button')).toHaveCount(2);
  await page.locator('#modal-extra').getByRole('button', {name:/量入为出/}).click();
  const state = await page.evaluate(() => window.gameState);
  expect(state.hand).toHaveLength(5);
  expect(state.constructed.deck).toEqual(['H3']);
  expect(state.constructed.learned).toEqual(['H2','H4']);
  await learn.click();
  await page.locator('#modal-extra').getByText('♣3').click();
  await expect(page.locator('#modal-extra button')).toHaveCount(1);
  await page.locator('#modal-extra button').click();
  await expect(learn).toBeDisabled();
});

test('异色物资只能发动兼色技能，攻城后恢复，单纯学习技能没有自动收益', async ({ page }) => {
  await select(page, /先登破城/);
  await initialSkill(page);
  await page.evaluate(() => { window.gameState.constructed.learned = ['H8','H5']; });
  await patchGameState(page, {
    hand:[makeCard('diamonds',5)], supply:[makeCard('clubs',4),makeCard('clubs',6)],
    enemies:[makeEnemy('diamonds',6,4,0,1,true),makeEnemy('clubs',8,3,0,1)]
  });
  const skill = page.getByRole('button',{name:/木牛流马/});
  await expect(page.getByRole('button',{name:/合券征粮/})).toBeDisabled();
  await skill.click();
  await page.locator('#modal-extra').getByText('♣4').click();
  await expect(skill).toBeDisabled();
  expect(await page.locator('.hand-card').count()).toBe(3);
  await page.locator('.hand-card').first().click();
  await page.locator('.enemy-card.selectable').first().click();
  await expect(skill).toBeEnabled();
  expect(await page.locator('.hand-card').count()).toBe(2);
});

test('旧卡组可在移动端重新编辑并按新版预算开局', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.addInitScript(() => localStorage.setItem('castle-rush.custom-deck.v1', JSON.stringify({
    talent:'hearts',list:['HA','HA','H2','H2','H3','H4','H5','H6','H8']
  })));
  await select(page, '手动构筑');
  const submit = page.locator('#builder-start');
  await expect(submit).toBeDisabled();
  await expect(page.locator('input[value="HA"]')).toBeChecked();
  await expect(page.locator('input[value="HK"]')).toBeChecked();
  for (const id of ['H4','H8']) await page.locator('input[value="'+id+'"]').uncheck();
  await submit.click();
  await initialSkill(page);
  await patchGameState(page,{discard:[makeCard('hearts',2),makeCard('clubs',5)]});
  await page.getByRole('button',{name:'查看普通弃牌顺序'}).click();
  await expect(page.locator('.pile-order li')).toHaveText(['♣5 · 堆顶','♥2 · 堆底']);
});

test('方块与黑桃混构，开局天赋与付费侦查、失败响应结算', async ({ page }) => {
  await select(page, '手动构筑');
  await page.locator('input[value="SQ"]').check();
  await page.getByText('♦ 方块', {exact:true}).click();
  await page.getByText('♠ 黑桃', {exact:true}).click();
  for (const id of ['D3','D4','S3','S7','S9']) await page.locator('input[value="'+id+'"]').check();
  await page.locator('#builder-start').click();
  await initialSkill(page);
  await page.evaluate(() => { window.gameState.constructed.learned = ['D3','S5']; });
  await patchGameState(page, {
    hand:[makeCard('hearts',1)], supply:[makeCard('diamonds',2),makeCard('spades',3)],
    enemies:[0,1,2].map((i) => makeEnemy('clubs',i+5,4,i,i*2,false))
  });
  const choices = page.locator('#modal-extra button');
  await page.getByRole('button',{name:/买通耳目/}).click();
  for (let i=0;i<3;i++) await choices.first().click();
  expect(await page.evaluate(() => window.gameState.enemies.filter(e=>e.revealed).length)).toBe(2);
  await page.locator('.hand-card').first().click();
  await page.locator('.enemy-card.back.selectable').click();
  await choices.filter({hasText:'偃旗息鼓'}).click();
  await choices.filter({hasText:'♠3'}).click();
  await expect(page.locator('.hand-card')).toHaveCount(1);
  await expect(page.locator('#supply-count')).toHaveText('0');
});

test('尽知虚实先支付两张物资，只清除本次翻出的同花色可选目标', async ({page}) => {
  await select(page,/火线军报/);
  await initialSkill(page);
  await page.evaluate(() => { window.gameState.constructed.learned = ['D10']; });
  await patchGameState(page,{
    supply:[makeCard('diamonds',2),makeCard('clubs',3)],
    enemies:[makeEnemy('hearts',4,4,0,1),makeEnemy('hearts',6,4,1,3),makeEnemy('clubs',7,4,2,5),
      makeEnemy('hearts',9,3,0,1)]
  });
  await page.getByRole('button',{name:/尽知虚实/}).click();
  const buttons = page.locator('#modal-extra button');
  await buttons.first().click();
  await buttons.first().click();
  await buttons.first().click();
  await buttons.filter({hasText:'取消'}).click();
  await expect(page.locator('.enemy-card')).toHaveCount(2);
  await expect(page.locator('.enemy-card.back')).toHaveCount(1);
  await expect(page.locator('#supply-count')).toHaveText('2');
});
