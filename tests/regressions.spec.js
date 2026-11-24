import { test, expect } from '@playwright/test';
import { patchGameState, makeCard, makeEnemy, acceptDialogs } from './helpers.js';

async function start(page, mode = 'defense') {
  await page.goto('/castle_rush/');
  await page.click(`[data-mode="${mode}"]`);
  await page.click('#btn-mode-confirm');
  await page.getByRole('button', { name: '确认手牌', exact: true }).click();
}

test.beforeEach(async ({ page }) => {
  // A visible UI assertion alone misses exceptions raised after state mutation.
  page.on('pageerror', error => { throw error; });
});

test('项目子路径下所有模式均可启动', async ({ page }) => {
  for (const mode of ['basic', 'commander', 'defense', 'commander+defense']) {
    const failed = [];
    const onResponse = response => { if (response.status() >= 400) failed.push(response.url()); };
    page.on('response', onResponse);
    await page.goto('/castle_rush/');
    await page.click(`[data-mode="${mode}"]`);
    await page.click('#btn-mode-confirm');
    if (mode.includes('commander')) {
      await page.locator('[data-key="novice"]').click();
      await page.click('#btn-cmd-confirm');
    }
    await expect(page.locator('.enemy-card')).toHaveCount(16);
    await page.getByRole('button', { name: '确认手牌', exact: true }).click();
    expect(await page.evaluate(() => window.gameState.phase)).toBe('playing');
    expect(failed).toEqual([]);
    page.off('response', onResponse);
  }
});

test('城防攻城结算更新覆盖关系并只推进一次', async ({ page }) => {
  await start(page);
  await patchGameState(page, {
    turnPhase: 'siege', phaseActions: {}, timeDeck: [], supply: [],
    hand: [makeCard('hearts', 5), makeCard('clubs', 8)],
    enemies: [makeEnemy('hearts', 7, 4, 0, 1, true), makeEnemy('diamonds', 4, 3, 0, 1, true)],
  });
  await page.locator('.hand-card').first().click();
  await page.locator('.enemy-card.selectable').click();
  const state = await page.evaluate(() => window.gameState);
  expect(state.turnPhase).toBe('supply');
  expect(state.hand).toHaveLength(1);
  expect(state.enemies[1].coveredBy).toEqual([]);
});

test('弃置前面的手牌忽略城防后仍消耗正确的攻城牌', async ({ page }) => {
  await start(page);
  acceptDialogs(page);
  await patchGameState(page, {
    turnPhase: 'siege', timeDeck: [{ ...makeCard('hearts', 7), revealed: true }],
    hand: [makeCard('hearts', 2), makeCard('hearts', 5), makeCard('diamonds', 8)], supply: [],
    enemies: [makeEnemy('hearts', 5, 4, 0, 1, true)],
  });
  await page.locator('.hand-card').nth(1).click();
  await page.locator('.enemy-card.selectable').click();
  const state = await page.evaluate(() => window.gameState);
  expect(state.hand.map(card => card.rank)).toEqual([8]);
  expect(state.phase).toBe('gameover');
  await expect(page.locator('#modal-title')).toContainText('胜利');
});

test('补给技能只推进一个阶段且不允许在侦查阶段攻城', async ({ page }) => {
  await start(page);
  acceptDialogs(page);
  await patchGameState(page, {
    turnPhase: 'supply', timeDeck: [{ ...makeCard('clubs', 1), revealed: true }],
    supply: [makeCard('hearts', 3)],
  });
  const before = await page.evaluate(() => ({ turn: window.gameState.turn, hand: window.gameState.hand.length }));
  await page.getByRole('button', { name: '⚡ 发动战术', exact: true }).click();
  await page.locator('#supply-pile .pile-card').click();
  expect(await page.evaluate(() => window.gameState.turnPhase)).toBe('scout');
  expect(await page.evaluate(() => window.gameState.turn)).toBe(before.turn + 1);
  expect(await page.evaluate(() => window.gameState.hand.length)).toBe(before.hand + 3);
  await page.locator('.hand-card').first().click();
  await page.locator('.enemy-card.selectable').first().click();
  await expect(page.locator('#message')).toContainText('请在攻城阶段');
});

test('技能选择期间不能跳过阶段，错误花色不会消耗物资', async ({ page }) => {
  await start(page);
  await patchGameState(page, { supply: [makeCard('hearts', 3)], turnPhase: 'scout' });
  await page.getByRole('button', { name: '⚡ 发动战术', exact: true }).click();
  await page.click('#btn-skip-phase');
  expect(await page.evaluate(() => window.gameState.turnPhase)).toBe('scout');
  await page.locator('#supply-pile .pile-card').click();
  expect(await page.evaluate(() => window.gameState.supply.length)).toBe(1);
  await expect(page.locator('#message')).toContainText('当前阶段不能');
});

test('协同补给传递选择并抽三张牌', async ({ page }) => {
  await start(page, 'basic');
  await patchGameState(page, {
    hand: [makeCard('hearts', 5), makeCard('diamonds', 5)], supply: [],
    deck: [makeCard('clubs', 1), makeCard('clubs', 2), makeCard('clubs', 3)], discard: [],
  });
  await page.getByRole('button', { name: '⚡ 发动战术', exact: true }).click();
  await page.getByRole('button', { name: /协同 \(弃2张同点数\)/ }).click();
  await page.locator('.hand-card').first().click();
  await page.locator('.hand-card').nth(1).click();
  await page.getByRole('button', { name: '♥️ 补给 (抽3张)', exact: true }).click();
  const state = await page.evaluate(() => window.gameState);
  expect(state.hand).toHaveLength(3);
  expect(state.discard).toHaveLength(2);
  expect(state.phase).toBe('playing');
});

test('补给中触发疲劳失败不会重新进入游戏', async ({ page }) => {
  await start(page);
  acceptDialogs(page);
  await patchGameState(page, {
    turnPhase: 'supply', deck: [], discard: [makeCard('clubs', 4)],
    reshuffleCount: 1, supply: [makeCard('hearts', 3)],
  });
  await page.getByRole('button', { name: '⚡ 发动战术', exact: true }).click();
  await page.locator('#supply-pile .pile-card').click();
  expect(await page.evaluate(() => window.gameState.phase)).toBe('gameover');
  await expect(page.locator('#modal-title')).toContainText('疲劳');
});

test('手机屏幕上游戏不产生水平溢出', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await start(page, 'basic');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('战时补给等待玩家选择后才推进城防阶段', async ({ page }) => {
  await start(page);
  acceptDialogs(page);
  await patchGameState(page, {
    selectedMode: 'commander+defense', selectedCommander: 'tactician',
    turnPhase: 'supply', supply: [makeCard('hearts', 3)],
    timeDeck: [{ ...makeCard('clubs', 1), revealed: true }],
  });
  await page.getByRole('button', { name: '⚡ 发动战术', exact: true }).click();
  await page.locator('#supply-pile .pile-card').click();
  expect(await page.evaluate(() => window.gameState.turnPhase)).toBe('supply');
  expect(await page.evaluate(() => window.gameState.phase)).toBe('skill');
  await page.getByRole('button', { name: 'B) 固定抽2张', exact: true }).click();
  expect(await page.evaluate(() => window.gameState.turnPhase)).toBe('scout');
});
