import { test, expect } from '@playwright/test';
import {
  setupCommanderGame, patchGameState, getGameState,
  acceptDialogs, dismissDialogs, waitForMessage, getMessage,
  makeCard, makeEnemy, clickSupplyBySuit, clickHandBySuit,
  clickSelectableDarkEnemy, clickSelectableRevealedEnemy, clickSelectableEnemy
} from './helpers.js';

/**
 * 进入城防扩展模式（不带指挥官）
 */
async function setupDefenseGame(page) {
  await page.goto('/');
  await page.click('[data-mode="defense"]');
  await page.click('#btn-mode-confirm');
  await page.waitForSelector('#mulligan-bar', { state: 'visible' });
  await page.click('button:has-text("确认手牌")');
  await page.waitForSelector('#mulligan-bar', { state: 'hidden' });
}

/**
 * 进入城防+指挥官模式
 */
async function setupDefenseCommanderGame(page, commanderKey) {
  await page.goto('/');
  await page.click('[data-mode="commander+defense"]');
  await page.click('#btn-mode-confirm');
  await page.locator(`.commander-card[data-key="${commanderKey}"]`).click();
  await page.click('#btn-cmd-confirm');
  await page.waitForSelector('#mulligan-bar', { state: 'visible' });
  await page.click('button:has-text("确认手牌")');
  await page.waitForSelector('#mulligan-bar', { state: 'hidden' });
}

// ==================== 基础城防系统 ====================

test.describe('城防扩展基础', () => {
  test('城防UI应显示阶段、时间牌和疲劳计数', async ({ page }) => {
    await setupDefenseGame(page);
    await page.waitForSelector('#defense-bar', { state: 'visible' });
    const phaseText = await page.locator('#phase-display').textContent();
    expect(phaseText).toContain('侦查阶段');
    const fatigue = await page.locator('#fatigue-count').textContent();
    expect(fatigue).toBe('0');
  });

  test('跳过阶段按钮应推进回合阶段', async ({ page }) => {
    await setupDefenseGame(page);
    await page.waitForSelector('#defense-bar', { state: 'visible' });
    // confirmMulligan 后已经是 scout，点击跳过应进入 siege
    await page.click('#btn-skip-phase');
    await page.waitForFunction(() => document.getElementById('phase-display').textContent.includes('攻城'));
    const phaseText = await page.locator('#phase-display').textContent();
    expect(phaseText).toContain('攻城');
  });

  test('白天城防限制：同花色手牌不能攻城', async ({ page }) => {
    await setupDefenseGame(page);
    dismissDialogs(page);
    // 构造场景：时间牌为明置 hearts，手牌有 hearts
    // 使用 layer 4 的敌人确保可点击
    const enemy = makeEnemy('clubs', 5, 4, 0, [50, 50], true);
    await patchGameState(page, {
      turnPhase: 'siege',
      timeDeck: [{ id: 'time1', suit: 'hearts', rank: 7, revealed: true }],
      hand: [
        makeCard('hearts', 3),
        makeCard('diamonds', 5),
      ],
      enemies: [enemy],
    });
    // 选择 hearts 手牌
    await clickHandBySuit(page, 'hearts');
    // 点击敌人（使用 force 避免被遮挡问题）
    await page.locator('.enemy-card.selectable.front').first().click({ force: true });
    const msg = await getMessage(page);
    expect(msg).toContain('城防限制');
  });

  test('白天城防限制：可弃牌忽略后允许攻城', async ({ page }) => {
    await setupDefenseGame(page);
    // 先取消一次，再确认
    page.on('dialog', async dialog => {
      if (dialog.type() === 'confirm') {
        await dialog.accept();
      } else {
        await dialog.accept();
      }
    });
    // 敌人与手牌同点数，攻城会成功
    const enemy = makeEnemy('clubs', 3, 4, 0, [50, 50], true);
    await patchGameState(page, {
      turnPhase: 'siege',
      timeDeck: [{ id: 'time1', suit: 'hearts', rank: 7, revealed: true }],
      hand: [
        makeCard('hearts', 3),
        makeCard('hearts', 5),
        makeCard('diamonds', 8),
      ],
      enemies: [enemy],
    });
    await clickHandBySuit(page, 'hearts');
    await page.locator('.enemy-card.selectable.front').first().click({ force: true });
    // 等待攻城结果消息
    await waitForMessage(page, '成功');
  });

  test('疲劳规则：第二次重洗触发游戏结束', async ({ page }) => {
    await setupDefenseGame(page);
    acceptDialogs(page);
    // 构造场景：牌库空，弃牌堆有牌，已重洗1次
    await patchGameState(page, {
      deck: [],
      discard: [makeCard('hearts', 1), makeCard('diamonds', 2)],
      reshuffleCount: 1,
      turnPhase: 'supply',
    });
    // 尝试抽牌触发重洗
    await page.evaluate(() => {
      window.draw(1);
      window.renderAll();
    });
    await page.waitForSelector('#modal-overlay.show', { state: 'visible' });
    const modalTitle = await page.locator('#modal-title').textContent();
    expect(modalTitle).toContain('疲劳');
  });
});

// ==================== 闪电战专家 ====================

test.describe('闪电战专家', () => {
  test('♥️急速补给：时间牌≤5时抽3张', async ({ page }) => {
    await setupDefenseCommanderGame(page, 'blitzkrieg');
    acceptDialogs(page);
    await patchGameState(page, {
      timeDeck: [makeCard('hearts', 1), makeCard('diamonds', 2)],
      supply: [makeCard('hearts', 5)],
      turnPhase: 'supply',
    });
    const before = await getGameState(page);
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'hearts');
    // 等待一段时间让异步操作完成
    await page.waitForTimeout(500);
    const after = await getGameState(page);
    expect(after.handCount).toBe(before.handCount + 3);
  });

  test('♥️急速补给：时间牌>5时抽2张', async ({ page }) => {
    await setupDefenseCommanderGame(page, 'blitzkrieg');
    acceptDialogs(page);
    await patchGameState(page, {
      timeDeck: Array(6).fill(null).map((_, i) => makeCard('clubs', i + 1)),
      supply: [makeCard('hearts', 5)],
      turnPhase: 'supply',
    });
    const before = await getGameState(page);
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'hearts');
    await page.waitForTimeout(500);
    const after = await getGameState(page);
    expect(after.handCount).toBe(before.handCount + 2);
  });

  test('♣️突袭：击败明置敌人，时间牌≤5时抽牌', async ({ page }) => {
    await setupDefenseCommanderGame(page, 'blitzkrieg');
    acceptDialogs(page);
    const enemy = makeEnemy('diamonds', 5, 4, 0, [50, 50], true);
    await patchGameState(page, {
      timeDeck: [makeCard('clubs', 1)],
      supply: [makeCard('clubs', 7)],
      enemies: [enemy],
      turnPhase: 'siege',
    });
    const before = await getGameState(page);
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'clubs');
    await page.locator('.enemy-card.selectable.front').first().click({ force: true });
    await page.waitForTimeout(500);
    const after = await getGameState(page);
    expect(after.handCount).toBe(before.handCount + 1);
  });
});

// ==================== 持久战专家 ====================

test.describe('持久战专家', () => {
  test('♥️长线补给：抽等同于时间牌堆数量的牌', async ({ page }) => {
    await setupDefenseCommanderGame(page, 'attrition');
    acceptDialogs(page);
    await patchGameState(page, {
      timeDeck: [makeCard('hearts', 1), makeCard('diamonds', 2), makeCard('clubs', 3)],
      supply: [makeCard('hearts', 5)],
      turnPhase: 'supply',
    });
    const before = await getGameState(page);
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'hearts');
    await page.waitForTimeout(500);
    const after = await getGameState(page);
    expect(after.handCount).toBe(before.handCount + 3);
  });

  test('♦️地图勘探：翻开多个暗置敌人并抽牌替换时间牌', async ({ page }) => {
    await setupDefenseCommanderGame(page, 'attrition');
    acceptDialogs(page);
    const enemies = [
      makeEnemy('hearts', 5, 4, 0, [50, 50], false),
      makeEnemy('diamonds', 6, 4, 1, [150, 50], false),
    ];
    await patchGameState(page, {
      timeDeck: [{ id: 'time1', suit: 'clubs', rank: 7, revealed: true }],
      supply: [makeCard('diamonds', 5)],
      enemies,
      turnPhase: 'scout',
    });
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'diamonds');
    await page.waitForTimeout(500);
    const state = await getGameState(page);
    // 应该翻开了2张暗置敌人
    const revealedEnemies = state.enemies.filter(e => e.revealed);
    expect(revealedEnemies.length).toBe(2);
  });

  test('♣️歼灭：击败同花色敌人', async ({ page }) => {
    await setupDefenseCommanderGame(page, 'attrition');
    acceptDialogs(page);
    const enemies = [
      makeEnemy('hearts', 5, 4, 0, [50, 50], true),
      makeEnemy('hearts', 6, 4, 1, [150, 50], true),
      makeEnemy('diamonds', 7, 4, 2, [250, 50], true),
    ];
    await patchGameState(page, {
      timeDeck: [{ id: 'time1', suit: 'hearts', rank: 7, revealed: true }],
      supply: [makeCard('clubs', 5)],
      enemies,
      turnPhase: 'siege',
    });
    const before = await getGameState(page);
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'clubs');
    await page.waitForTimeout(500);
    const after = await getGameState(page);
    // 应该击败了2张 hearts 敌人
    const defeatedHearts = after.enemies.filter(e => e.defeated && e.suit === 'hearts');
    expect(defeatedHearts.length).toBe(2);
  });
});
