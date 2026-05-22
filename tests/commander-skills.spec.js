import { test, expect } from '@playwright/test';
import {
  setupCommanderGame,
  patchGameState,
  getGameState,
  acceptDialogs,
  dismissDialogs,
  waitForMessage,
  getMessage,
  makeCard,
  makeEnemy,
  clickSupplyBySuit,
  clickHandBySuit,
  clickSelectableDarkEnemy,
  clickSelectableRevealedEnemy,
  clickSelectableEnemy,
} from './helpers.js';

// ==================== 新手指挥官 ====================
test.describe('新手指挥官', () => {
  test.beforeEach(async ({ page }) => {
    await setupCommanderGame(page, 'novice');
  });

  test('♥️ 补给：确认发动后弃♥️物资并抽3张手牌', async ({ page }) => {
    acceptDialogs(page);
    await patchGameState(page, {
      supply: [makeCard('hearts', 5)],
      hand: [],
      deck: [makeCard('clubs', 2), makeCard('diamonds', 3), makeCard('spades', 4), makeCard('hearts', 6)],
    });
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'hearts');
    const state = await getGameState(page);
    expect(state.handCount).toBe(3);
    expect(state.supplyCount).toBe(0);
    expect(state.discardCount).toBe(1);
    expect(state.message).toContain('补给');
  });

  test('♥️ 补给：取消发动后技能应结束，物资保留', async ({ page }) => {
    dismissDialogs(page);
    await patchGameState(page, {
      supply: [makeCard('hearts', 5)],
      hand: [makeCard('clubs', 2)],
    });
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'hearts');
    const state = await getGameState(page);
    expect(state.phase).toBe('playing');
    expect(state.supplyCount).toBe(1);
  });

  test('♦️ 侦查：确认后翻至多2张暗置敌人', async ({ page }) => {
    acceptDialogs(page);
    const e1 = makeEnemy('clubs', 5, 4, 0, 1, false);
    const e2 = makeEnemy('diamonds', 7, 4, 1, 3, false);
    const e3 = makeEnemy('spades', 9, 4, 2, 5, false);
    await patchGameState(page, {
      supply: [makeCard('diamonds', 3)],
      enemies: [e1, e2, e3],
    });
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'diamonds');
    await waitForMessage(page, '侦查发动');
    await clickSelectableDarkEnemy(page);
    await clickSelectableDarkEnemy(page);
    const state = await getGameState(page);
    expect(state.enemies.filter(e => e.revealed).length).toBe(2);
    expect(state.phase).toBe('playing');
  });

  test('♦️ 侦查：无暗置可选敌人时应直接结束', async ({ page }) => {
    acceptDialogs(page);
    await patchGameState(page, {
      supply: [makeCard('diamonds', 3)],
      enemies: [],
    });
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'diamonds');
    const state = await getGameState(page);
    expect(state.phase).toBe('playing');
    expect(state.message).toContain('没有可选中的暗置牌');
  });

  test('♣️ 强攻：确认后击败1张明置敌人', async ({ page }) => {
    acceptDialogs(page);
    await patchGameState(page, {
      supply: [makeCard('clubs', 3)],
      enemies: [
        makeEnemy('hearts', 5, 4, 0, 1, true),
        makeEnemy('clubs', 7, 4, 1, 3, false),
        makeEnemy('diamonds', 9, 4, 2, 5, false),
      ],
    });
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'clubs');
    await waitForMessage(page, '强攻发动');
    await clickSelectableRevealedEnemy(page);
    const state = await getGameState(page);
    expect(state.enemies[0].defeated).toBe(true);
    expect(state.phase).toBe('playing');
  });

  test('♣️ 强攻：无明置敌人时应直接结束', async ({ page }) => {
    acceptDialogs(page);
    await patchGameState(page, {
      supply: [makeCard('clubs', 3)],
      enemies: [makeEnemy('hearts', 5, 4, 0, 1, false)],
    });
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'clubs');
    const state = await getGameState(page);
    expect(state.phase).toBe('playing');
  });

  test('♠️ 防御：攻城失败时询问是否使用♠️物资代替手牌', async ({ page }) => {
    // 使用♠️防御（确定）
    page.on('dialog', async dialog => {
      if (dialog.message().includes('防御')) await dialog.accept();
      else await dialog.accept();
    });
    const enemy = makeEnemy('hearts', 5, 4, 0, 1, false);
    await patchGameState(page, {
      hand: [makeCard('clubs', 2)],
      supply: [makeCard('spades', 8)],
      enemies: [enemy],
    });
    await clickHandBySuit(page, 'clubs');
    await clickSelectableEnemy(page);
    await waitForMessage(page, '防御');
    const state = await getGameState(page);
    // 使用♠️防御时，手牌保留在手中，♠️物资代替手牌进入弃牌堆
    expect(state.handCount).toBe(1);
    expect(state.discardCount).toBe(1); // ♠️进入弃牌
    expect(state.supplyCount).toBe(0);
    expect(state.enemies[0].revealed).toBe(true);
  });
});

// ==================== 后勤专家 ====================
test.describe('后勤专家', () => {
  test.beforeEach(async ({ page }) => {
    await setupCommanderGame(page, 'logistics');
  });

  test('♥️ 临时补给：物资≥3时抽3张', async ({ page }) => {
    acceptDialogs(page);
    await patchGameState(page, {
      supply: [makeCard('hearts', 5), makeCard('clubs', 2), makeCard('diamonds', 3)],
      hand: [],
      deck: [makeCard('spades', 4), makeCard('clubs', 6), makeCard('hearts', 7), makeCard('diamonds', 8)],
    });
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'hearts');
    const state = await getGameState(page);
    expect(state.handCount).toBe(3);
    expect(state.message).toContain('临时补给');
  });

  test('♥️ 临时补给：物资<3时抽2张', async ({ page }) => {
    acceptDialogs(page);
    await patchGameState(page, {
      supply: [makeCard('hearts', 5)],
      hand: [],
      deck: [makeCard('spades', 4), makeCard('clubs', 6), makeCard('hearts', 7)],
    });
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'hearts');
    const state = await getGameState(page);
    expect(state.handCount).toBe(2);
  });

  test('♦️ 优势侦查：手牌≥5时翻2张', async ({ page }) => {
    acceptDialogs(page);
    await patchGameState(page, {
      supply: [makeCard('diamonds', 3)],
      hand: [makeCard('hearts', 2), makeCard('clubs', 4), makeCard('diamonds', 6), makeCard('spades', 8), makeCard('hearts', 10)],
      enemies: [
        makeEnemy('clubs', 5, 4, 0, 1, false),
        makeEnemy('diamonds', 7, 4, 1, 3, false),
      ],
    });
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'diamonds');
    await waitForMessage(page, '优势侦查');
    await clickSelectableDarkEnemy(page);
    await clickSelectableDarkEnemy(page);
    const state = await getGameState(page);
    expect(state.enemies.filter(e => e.revealed).length).toBe(2);
  });

  test('♦️ 优势侦查：手牌<5时翻1张', async ({ page }) => {
    acceptDialogs(page);
    await patchGameState(page, {
      supply: [makeCard('diamonds', 3)],
      hand: [makeCard('hearts', 2), makeCard('clubs', 4)],
      enemies: [
        makeEnemy('clubs', 5, 4, 0, 1, false),
        makeEnemy('diamonds', 7, 4, 1, 3, false),
      ],
    });
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'diamonds');
    await waitForMessage(page, '优势侦查');
    await clickSelectableDarkEnemy(page);
    const state = await getGameState(page);
    expect(state.enemies.filter(e => e.revealed).length).toBe(1);
    expect(state.phase).toBe('playing');
  });

  test('♣️ 火力压制：有明置敌人时进入强攻模式', async ({ page }) => {
    acceptDialogs(page);
    await patchGameState(page, {
      supply: [makeCard('clubs', 3)],
      enemies: [makeEnemy('hearts', 5, 4, 0, 1, true)],
    });
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'clubs');
    await waitForMessage(page, '火力压制');
    await clickSelectableRevealedEnemy(page);
    const state = await getGameState(page);
    expect(state.enemies[0].defeated).toBe(true);
    expect(state.phase).toBe('playing');
  });

  test('♣️ 火力压制：无明置敌人时弃手牌击败暗置敌人', async ({ page }) => {
    acceptDialogs(page);
    await patchGameState(page, {
      supply: [makeCard('clubs', 3)],
      hand: [makeCard('spades', 8)],
      enemies: [makeEnemy('hearts', 5, 4, 0, 1, false)],
    });
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'clubs');
    await waitForMessage(page, '火力压制');
    // 先选择手牌弃掉
    await clickHandBySuit(page, 'spades');
    await clickSelectableDarkEnemy(page);
    const state = await getGameState(page);
    expect(state.enemies[0].defeated).toBe(true);
    expect(state.handCount).toBe(0);
    expect(state.phase).toBe('playing');
  });

  test('♠️ 攻城增援：成功时询问消耗♠️物资抽2张', async ({ page }) => {
    page.on('dialog', async dialog => {
      if (dialog.message().includes('攻城增援')) await dialog.accept();
      else await dialog.accept();
    });
    await patchGameState(page, {
      hand: [makeCard('hearts', 5)],
      supply: [makeCard('spades', 8)],
      deck: [makeCard('clubs', 2), makeCard('diamonds', 3)],
      enemies: [makeEnemy('hearts', 5, 4, 0, 1, true)],
    });
    await clickHandBySuit(page, 'hearts');
    await clickSelectableEnemy(page);
    await waitForMessage(page, '攻城增援');
    const state = await getGameState(page);
    expect(state.discardCount).toBe(2); // 手牌+♠️
    expect(state.handCount).toBe(2); // 抽2张
  });

  test('♠️ 攻城增援：成功时拒绝则不抽牌', async ({ page }) => {
    page.on('dialog', async dialog => {
      if (dialog.message().includes('攻城增援')) await dialog.dismiss();
      else await dialog.accept();
    });
    await patchGameState(page, {
      hand: [makeCard('hearts', 5)],
      supply: [makeCard('spades', 8)],
      enemies: [makeEnemy('hearts', 5, 4, 0, 1, true)],
    });
    await clickHandBySuit(page, 'hearts');
    await clickSelectableEnemy(page);
    const state = await getGameState(page);
    expect(state.handCount).toBe(0);
    expect(state.supplyCount).toBe(1); // ♠️还在
  });
});

// ==================== 情报专家 ====================
test.describe('情报专家', () => {
  test.beforeEach(async ({ page }) => {
    await setupCommanderGame(page, 'intel');
  });

  test('♥️ 窃取补给：根据明置敌人数量抽牌', async ({ page }) => {
    acceptDialogs(page);
    await patchGameState(page, {
      supply: [makeCard('hearts', 5)],
      hand: [],
      deck: [makeCard('clubs', 2), makeCard('diamonds', 3), makeCard('spades', 4), makeCard('hearts', 6)],
      enemies: [
        makeEnemy('clubs', 5, 4, 0, 1, true),
        makeEnemy('diamonds', 7, 4, 1, 3, true),
      ],
    });
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'hearts');
    const state = await getGameState(page);
    expect(state.handCount).toBe(3); // 1+2=3
    expect(state.message).toContain('窃取补给');
  });

  test('♦️ 广域侦查：翻至多3张暗置敌人', async ({ page }) => {
    acceptDialogs(page);
    await patchGameState(page, {
      supply: [makeCard('diamonds', 3)],
      enemies: [
        makeEnemy('clubs', 5, 4, 0, 1, false),
        makeEnemy('diamonds', 7, 4, 1, 3, false),
        makeEnemy('spades', 9, 4, 2, 5, false),
      ],
    });
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'diamonds');
    await waitForMessage(page, '广域侦查');
    await clickSelectableDarkEnemy(page);
    await clickSelectableDarkEnemy(page);
    await clickSelectableDarkEnemy(page);
    const state = await getGameState(page);
    expect(state.enemies.filter(e => e.revealed).length).toBe(3);
  });

  test('♣️ 渗透打击：选择明置敌人作为武器攻城', async ({ page }) => {
    acceptDialogs(page);
    await patchGameState(page, {
      supply: [makeCard('clubs', 3)],
      enemies: [
        makeEnemy('hearts', 5, 4, 0, 1, true), // 武器
        makeEnemy('hearts', 5, 4, 1, 3, false), // 目标（同花色，成功）
      ],
    });
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'clubs');
    await waitForMessage(page, '渗透打击');
    await clickSelectableRevealedEnemy(page); // 选武器
    await clickSelectableEnemy(page); // 选目标
    const state = await getGameState(page);
    expect(state.enemies[1].defeated).toBe(true);
    expect(state.phase).toBe('playing');
  });

  test('♠️ 佯攻：失败时消耗♠️并交换明暗', async ({ page }) => {
    page.on('dialog', async dialog => {
      if (dialog.message().includes('佯攻')) await dialog.accept();
      else if (dialog.message().includes('明置')) await dialog.accept();
      else await dialog.accept();
    });
    await patchGameState(page, {
      hand: [makeCard('clubs', 2)],
      supply: [makeCard('spades', 8)],
      enemies: [
        makeEnemy('hearts', 5, 4, 0, 1, true), // 明置，用于变暗置
        makeEnemy('diamonds', 7, 4, 1, 3, false), // 暗置，用于变明置
      ],
    });
    await clickHandBySuit(page, 'clubs');
    await clickSelectableEnemy(page);
    await waitForMessage(page, '佯攻');
    // 先选明置变暗置
    await clickSelectableRevealedEnemy(page);
    // 再选暗置变明置
    await clickSelectableDarkEnemy(page);
    const state = await getGameState(page);
    expect(state.enemies[0].revealed).toBe(false);
    expect(state.enemies[1].revealed).toBe(true);
  });
});

// ==================== 战术大师 ====================
test.describe('战术大师', () => {
  test.beforeEach(async ({ page }) => {
    await setupCommanderGame(page, 'tactician');
  });

  test('♥️ 战时补给：选择按花色数量抽牌', async ({ page }) => {
    page.on('dialog', async dialog => {
      if (dialog.message().includes('战时补给')) await dialog.accept();
      else if (dialog.type() === 'prompt') await dialog.accept('A');
      else await dialog.accept();
    });
    await patchGameState(page, {
      supply: [makeCard('hearts', 5), makeCard('clubs', 2), makeCard('diamonds', 3)], // 3种花色
      hand: [],
      deck: [makeCard('spades', 4), makeCard('clubs', 6), makeCard('hearts', 7), makeCard('diamonds', 8)],
    });
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'hearts');
    const state = await getGameState(page);
    expect(state.handCount).toBe(3); // 3种花色抽3张
  });

  test('♦️ 谨慎侦查：翻暗置并查看牌堆顶', async ({ page }) => {
    acceptDialogs(page);
    await patchGameState(page, {
      supply: [makeCard('diamonds', 3)],
      deck: [makeCard('hearts', 10)],
      enemies: [makeEnemy('clubs', 5, 4, 0, 1, false)],
    });
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'diamonds');
    await waitForMessage(page, '谨慎侦查');
    await clickSelectableDarkEnemy(page);
    const state = await getGameState(page);
    expect(state.enemies[0].revealed).toBe(true);
    expect(state.discardCount).toBe(2); // ♦️+牌堆顶
  });

  test('♣️ 收割：击败明置并选择从牌库抽牌替换', async ({ page }) => {
    page.on('dialog', async dialog => {
      if (dialog.message().includes('收割')) await dialog.accept();
      else if (dialog.message().includes('是否将击败')) await dialog.accept();
      else await dialog.accept();
    });
    await patchGameState(page, {
      supply: [makeCard('clubs', 3)],
      deck: [makeCard('spades', 4)],
      enemies: [makeEnemy('hearts', 5, 4, 0, 1, true)],
    });
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'clubs');
    await waitForMessage(page, '收割');
    await clickSelectableRevealedEnemy(page);
    const state = await getGameState(page);
    expect(state.enemies[0].defeated).toBe(true);
    expect(state.supplyCount).toBe(1); // 抽到的新物资
  });

  test('♠️ 战争艺术：失败时根据物资花色数获得额外效果', async ({ page }) => {
    page.on('dialog', async dialog => {
      if (dialog.message().includes('战争艺术')) await dialog.accept();
      else await dialog.accept();
    });
    await patchGameState(page, {
      hand: [makeCard('clubs', 2)],
      supply: [makeCard('spades', 8), makeCard('hearts', 5), makeCard('diamonds', 3)], // 3种花色
      deck: [makeCard('spades', 4)],
      enemies: [makeEnemy('hearts', 5, 4, 0, 1, false)],
    });
    await clickHandBySuit(page, 'clubs');
    await clickSelectableEnemy(page);
    await waitForMessage(page, '战争艺术');
    const state = await getGameState(page);
    expect(state.handCount).toBe(1); // 抽1张
  });
});

// ==================== 推进之王 ====================
test.describe('推进之王', () => {
  test.beforeEach(async ({ page }) => {
    await setupCommanderGame(page, 'assault');
  });

  test('♥️ 紧急补给：手牌≤3时抽3张', async ({ page }) => {
    acceptDialogs(page);
    await patchGameState(page, {
      supply: [makeCard('hearts', 5)],
      hand: [makeCard('clubs', 2)],
      deck: [makeCard('spades', 4), makeCard('diamonds', 3), makeCard('hearts', 6)],
    });
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'hearts');
    const state = await getGameState(page);
    expect(state.handCount).toBe(3); // 原来1张+抽3张=4？不对，手牌没被弃
    // 实际上手牌没被选过，所以应该是 1+3=4？不，紧急补给只抽牌不弃牌
    expect(state.handCount).toBe(4);
  });

  test('♦️ 扰乱侦查：交换敌人位置并翻转明暗，有敌人变暗置时抽1张', async ({ page }) => {
    acceptDialogs(page);
    // e1: layer3 pos1 明置 — 作为源，初始可选中（上方无覆盖）
    const e1 = makeEnemy('hearts', 5, 3, 0, 1, true);
    // e2: layer4 pos3 暗置 — 作为目标，初始可选中
    const e2 = makeEnemy('diamonds', 7, 4, 1, 3, false);
    // e3: layer3 pos3 明置 — 初始被 e2 覆盖，交换后被 e1(新位置)覆盖，会翻为暗置触发抽牌
    const e3 = makeEnemy('clubs', 3, 3, 2, 3, true);
    await patchGameState(page, {
      supply: [makeCard('diamonds', 3)],
      hand: [makeCard('spades', 8)],
      deck: [makeCard('hearts', 2)],
      enemies: [e1, e2, e3],
    });
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'diamonds');
    await waitForMessage(page, '扰乱侦查');
    await clickSelectableEnemy(page); // 选源 e1
    await clickSelectableDarkEnemy(page); // 选目标 e2
    const state = await getGameState(page);
    // 阶段恢复
    expect(state.phase).toBe('playing');
    // 物资消耗
    expect(state.supplyCount).toBe(0);
    expect(state.discardCount).toBe(1);
    // 位置交换（layer / pos / index 互换）
    const positions = await page.evaluate(() =>
      window.gameState.enemies.slice(0, 2).map(e => ({ pos: e.pos, layer: e.layer, index: e.index }))
    );
    expect(positions[0].pos).toBe(3);
    expect(positions[0].layer).toBe(4);
    expect(positions[0].index).toBe(1);
    expect(positions[1].pos).toBe(1);
    expect(positions[1].layer).toBe(3);
    expect(positions[1].index).toBe(0);
    // 明暗翻转：e2 从暗置变明置；e3 因被覆盖从明置变暗置
    expect(state.enemies[0].revealed).toBe(true);  // e1 保持明置
    expect(state.enemies[1].revealed).toBe(true);  // e2 变为明置
    expect(state.enemies[2].revealed).toBe(false); // e3 被覆盖后翻为暗置
    // 有敌人变暗置，抽1张牌
    expect(state.handCount).toBe(2); // 初始1张 + 抽1张
  });

  test('♣️ 推进：击败明置敌人', async ({ page }) => {
    acceptDialogs(page);
    await patchGameState(page, {
      supply: [makeCard('clubs', 3)],
      enemies: [makeEnemy('hearts', 5, 4, 0, 1, true)],
    });
    await page.click('button:has-text("发动战术")');
    await clickSupplyBySuit(page, 'clubs');
    await waitForMessage(page, '推进');
    await clickSelectableRevealedEnemy(page);
    const state = await getGameState(page);
    expect(state.enemies[0].defeated).toBe(true);
  });

  test('♠️ 突破战术：成功后可翻一张新暗置敌人', async ({ page }) => {
    page.on('dialog', async dialog => {
      if (dialog.message().includes('突破战术')) await dialog.accept();
      else await dialog.accept();
    });
    await patchGameState(page, {
      hand: [makeCard('hearts', 5)],
      supply: [makeCard('spades', 8)],
      enemies: [
        makeEnemy('hearts', 5, 3, 0, 2, true), // 被攻击的明置敌人
        makeEnemy('clubs', 3, 4, 1, 1, false), // 新暴露的暗置敌人
      ],
    });
    await clickHandBySuit(page, 'hearts');
    await clickSelectableEnemy(page);
    await waitForMessage(page, '突破战术');
    await clickSelectableDarkEnemy(page);
    const state = await getGameState(page);
    expect(state.enemies[1].revealed).toBe(true);
  });
});

// ==================== 取消与边界场景 ====================
test.describe('通用边界场景', () => {
  test('取消技能后应能正常进行交互', async ({ page }) => {
    dismissDialogs(page);
    await setupCommanderGame(page, 'novice');
    await patchGameState(page, {
      supply: [makeCard('hearts', 5)],
      hand: [makeCard('hearts', 5)],
      enemies: [makeEnemy('hearts', 5, 4, 0, 1, true)],
    });
    await page.click('button:has-text("发动战术")');
    await page.click('button:has-text("取消")');
    const state = await getGameState(page);
    expect(state.phase).toBe('playing');
    // 验证可以正常攻城（手牌和敌人匹配，攻城成功）
    await clickHandBySuit(page, 'hearts');
    await clickSelectableEnemy(page);
    const state2 = await getGameState(page);
    expect(state2.enemies[0].defeated).toBe(true);
  });

  test('物资为空时无法发动战术', async ({ page }) => {
    await setupCommanderGame(page, 'novice');
    await patchGameState(page, {
      supply: [],
    });
    await page.click('button:has-text("发动战术")');
    const msg = await getMessage(page);
    expect(msg).toContain('物资牌堆为空');
  });
});
