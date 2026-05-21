import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://localhost:8080');

  // 选择指挥官扩展
  await page.click('[data-mode="commander"]');
  await page.click('#btn-mode-confirm');
  await page.waitForTimeout(300);

  // 选择后勤专家
  await page.locator('.commander-card', { hasText: '后勤专家' }).click();
  await page.click('#btn-cmd-confirm');
  await page.waitForTimeout(300);

  // 确认手牌
  await page.click('button:has-text("确认手牌")');
  await page.waitForTimeout(300);

  // 点击发动战术
  await page.click('button:has-text("发动战术")');
  await page.waitForTimeout(300);

  // 获取当前消息
  const msg1 = await page.locator('#message').textContent();
  console.log('After showSkillPanel:', msg1);

  // 获取物资牌堆中的牌
  const supplyCards = await page.locator('#supply-pile .pile-card').count();
  console.log('Supply cards count:', supplyCards);

  // 如果有♦️物资牌，点击它
  const diamondCard = await page.locator('#supply-pile .pile-card', { hasText: '♦️' }).first();
  if (await diamondCard.count() > 0) {
    // 处理 confirm 弹窗（自动点击确定）
    page.on('dialog', async dialog => {
      console.log('Dialog appeared:', dialog.type(), dialog.message().substring(0, 80));
      await dialog.accept();
    });

    await diamondCard.click();
    await page.waitForTimeout(500);

    const msg2 = await page.locator('#message').textContent();
    console.log('After clicking diamond:', msg2);

    // 检查 skill-section 是否还显示
    const skillVisible = await page.locator('#skill-section').isVisible();
    console.log('Skill section visible:', skillVisible);

    // 检查 phase 和 skillMode（通过 evaluate）
    const state = await page.evaluate(() => ({
      phase: window.gameState.phase,
      skillMode: window.gameState.skillMode,
      maxReveal: window.gameState._maxReveal,
    }));
    console.log('Game state:', state);

    // 如果有可选中的暗置敌人，点击第一个
    const darkEnemy = await page.locator('.enemy-card.selectable.back').first();
    if (await darkEnemy.count() > 0) {
      await darkEnemy.click();
      await page.waitForTimeout(300);
      const msg3 = await page.locator('#message').textContent();
      console.log('After clicking dark enemy:', msg3);
    } else {
      console.log('No selectable dark enemies found');
    }
  } else {
    console.log('No diamond supply card found');
  }

  await browser.close();
})();
