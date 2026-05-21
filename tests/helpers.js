/**
 * 进入游戏并选择指定指挥官
 */
export async function setupCommanderGame(page, commanderKey) {
  await page.goto('/');
  await page.click('[data-mode="commander"]');
  await page.click('#btn-mode-confirm');
  await page.locator(`.commander-card[data-key="${commanderKey}"]`).click();
  await page.click('#btn-cmd-confirm');
  await page.waitForSelector('#mulligan-bar', { state: 'visible' });
  await page.click('button:has-text("确认手牌")');
  await page.waitForSelector('#mulligan-bar', { state: 'hidden' });
}

/**
 * 通过 evaluate 修改游戏状态（用于构造稳定测试场景）
 */
export async function patchGameState(page, patch) {
  await page.evaluate((patch) => {
    Object.assign(window.gameState, patch);
    if (window.gameState.enemies) {
      window.computeCoverage();
    }
    window.renderAll();
  }, patch);
}

/**
 * 读取游戏状态
 */
export async function getGameState(page) {
  return page.evaluate(() => ({
    phase: window.gameState.phase,
    skillMode: window.gameState.skillMode,
    handCount: window.gameState.hand.length,
    supplyCount: window.gameState.supply.length,
    discardCount: window.gameState.discard.length,
    deckCount: window.gameState.deck.length,
    turn: window.gameState.turn,
    message: window.gameState.message,
    enemies: window.gameState.enemies.map(e => ({
      id: e.id,
      suit: e.suit,
      rank: e.rank,
      revealed: e.revealed,
      defeated: e.defeated,
      layer: e.layer,
      coveredBy: e.coveredBy.length,
    })),
    supply: window.gameState.supply.map(c => ({ suit: c.suit, rank: c.rank })),
    hand: window.gameState.hand.map(c => ({ suit: c.suit, rank: c.rank })),
  }));
}

/**
 * 自动接受所有 confirm/alert/prompt 弹窗
 */
export function acceptDialogs(page, response = true) {
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') {
      await dialog.accept(String(response));
    } else {
      await dialog.accept();
    }
  });
}

/**
 * 自动取消所有 confirm 弹窗
 */
export function dismissDialogs(page) {
  page.on('dialog', async dialog => {
    await dialog.dismiss();
  });
}

/**
 * 等待消息栏包含指定文本
 */
export async function waitForMessage(page, text) {
  await page.waitForFunction(
    (t) => document.getElementById('message')?.textContent?.includes(t),
    text,
    { timeout: 3000 }
  );
}

/**
 * 获取当前消息栏文本
 */
export async function getMessage(page) {
  return page.locator('#message').textContent();
}

/**
 * 创建一张牌的对象（用于 patchGameState）
 */
export function makeCard(suit, rank) {
  return { id: `test_${suit}_${rank}_${Math.random().toString(36).slice(2, 7)}`, suit, rank };
}

/**
 * 创建敌人对象（用于 patchGameState）
 */
export function makeEnemy(suit, rank, layer, index, pos, revealed = false) {
  return {
    id: `test_e_${suit}_${rank}_${index}`,
    suit, rank, layer, index, pos,
    revealed, defeated: false, coveredBy: [],
  };
}

/**
 * 点击物资牌堆中指定花色的牌
 */
export async function clickSupplyBySuit(page, suit) {
  const map = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
  const card = page.locator('#supply-pile .pile-card', { hasText: map[suit] }).first();
  await card.click();
}

/**
 * 点击手牌中指定花色的牌（返回索引）
 */
export async function clickHandBySuit(page, suit) {
  const map = { hearts: '♥', diamonds: '♦', clubs: '♣', spades: '♠' };
  const cards = await page.locator('#hand-container .hand-card').all();
  for (let i = 0; i < cards.length; i++) {
    const text = await cards[i].textContent();
    if (text.includes(map[suit])) {
      await cards[i].click();
      return i;
    }
  }
  return -1;
}

/**
 * 点击第一个可选中的暗置敌人
 */
export async function clickSelectableDarkEnemy(page) {
  const el = page.locator('.enemy-card.selectable.back').first();
  await el.click();
}

/**
 * 点击第一个可选中的明置敌人
 */
export async function clickSelectableRevealedEnemy(page) {
  const el = page.locator('.enemy-card.selectable.front').first();
  await el.click();
}

/**
 * 点击第一个可选中的敌人（不论明暗）
 */
export async function clickSelectableEnemy(page) {
  const el = page.locator('.enemy-card.selectable').first();
  await el.click();
}
