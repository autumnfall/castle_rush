import { test, expect } from '@playwright/test';

test('基础教程用真实攻城与战术完成五步，然后进入标准开局', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/');
  const entry = page.getByRole('button',{name:'基础游戏教程'});
  await expect(page.locator('#tutorial-invite')).toBeVisible();
  await entry.click();
  await page.getByRole('button',{name:'退出教程'}).click();
  await page.click('[data-mode="basic"]');
  await entry.click();
  const next = page.locator('#tutorial-next');
  const attack = async () => {
    await page.locator('.hand-card').first().click();
    await page.locator('.enemy-card.selectable').first().click();
  };
  await expect(next).toBeDisabled();
  const front = page.getByRole('button',{name:'红桃7敌人'});
  const rear = page.getByRole('button',{name:'暗置敌人'});
  await front.scrollIntoViewIfNeeded();
  const a = await front.boundingBox(), b = await rear.boundingBox();
  const left = Math.max(a.x,b.x), right = Math.min(a.x+a.width,b.x+b.width);
  const top = Math.max(a.y,b.y), bottom = Math.min(a.y+a.height,b.y+b.height);
  expect(right).toBeGreaterThan(left);
  expect(bottom).toBeGreaterThan(top);
  await page.locator('.hand-card').click();
  await front.click({position:{x:(left+right)/2-a.x,y:(top+bottom)/2-a.y}});
  await expect(rear).toHaveClass(/selectable/);
  await expect(next).toBeEnabled();
  await page.getByRole('button',{name:'重试本步'}).click();
  await expect(next).toBeDisabled();
  await attack();
  await next.click();
  for (const skill of ['补给','侦查','强攻']) {
    await expect(page.locator('#tutorial-title')).toContainText(skill);
    await page.click('#basic-tactics');
    await page.locator('.selectable-supply').click();
    if (skill === '侦查') {
      await page.locator('.enemy-card.selectable.back').first().click();
      await page.locator('.enemy-card.selectable.back').click();
    }
    if (skill === '强攻') await page.locator('.enemy-card.selectable.front').click();
    await next.click();
  }
  await attack();
  await expect(page.locator('#tutorial-hint')).toContainText('♥5 仍在手中');
  await page.getByRole('button',{name:'开始基础游戏'}).click();
  await expect(page.locator('#tutorial-panel')).toBeHidden();
  await expect(page.locator('#mulligan-bar')).toBeVisible();
  await expect(page.locator('.enemy-card')).toHaveCount(16);
});

test('首次邀请可跳过，刷新后仍可从首页直接开始教程', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'跳过教程'}).click();
  await expect(page.locator('#tutorial-invite')).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button',{name:'跳过教程'})).toBeHidden();
  await page.getByRole('button',{name:'基础游戏教程'}).click();
  await expect(page.locator('#tutorial-title')).toContainText('基础教程 1/5');
  expect(await page.evaluate(()=>window.gameState.selectedMode)).toBe('basic');
});
