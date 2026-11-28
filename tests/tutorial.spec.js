import { test, expect } from '@playwright/test';

test('基础教程用真实攻城与战术完成五步，然后进入标准开局', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  page.on('dialog', dialog => dialog.accept());
  await page.goto('/');
  const entry = page.getByRole('button',{name:'基础游戏教程'});
  for (const mode of ['commander','rogue']) {
    await page.click('[data-mode="' + mode + '"]');
    await expect(entry).toBeHidden();
  }
  await page.click('[data-mode="basic"]');
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
  await attack();
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
