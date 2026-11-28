import { test, expect } from '@playwright/test';

test('首次邀请可跳过，刷新后仍可从首页直接开始教程', async ({page}) => {
  await page.goto('/');
  await page.getByRole('button',{name:'跳过教程'}).click();
  await expect(page.locator('#tutorial-invite')).toBeHidden();
  await page.reload();
  await expect(page.getByRole('button',{name:'跳过教程'})).toBeHidden();
  await page.getByRole('button',{name:'基础游戏教程'}).click();
  await expect(page.locator('#tutorial-title')).toContainText('通关目标与重调');
  expect(await page.evaluate(()=>window.gameState.selectedMode)).toBe('basic');
});

for (const choice of ['继续当前牌局','开启新游戏']) {
test('四种战术和协同结算后可以' + choice, async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  const prompts = [];
  page.on('dialog', async dialog => { prompts.push(dialog.message()); await dialog.accept(); });
  page.on('pageerror', e => { throw e; });
  await page.goto('/');
  await page.getByRole('button',{name:'基础游戏教程'}).click();
  const state = () => page.evaluate(() => {
    const g = window.gameState;
    const keys = arr => arr.map(c => c.suit + c.rank);
    const cards = [...g.hand,...g.deck,...g.discard,...g.supply,...g.enemies.filter(e=>!e.defeated)];
    return {index:g.tutorial?.index, hand:keys(g.hand), discarded:keys(g.discard), supply:keys(g.supply),
      alive:g.enemies.filter(e=>!e.defeated).length, deck:g.deck.length, ids:cards.map(c=>c.id).sort(),
      faces:new Set(keys(cards)).size, layers:[0,1,2,3,4].map(n=>g.enemies.filter(e=>e.layer===n).length)};
  });
  const opening = await state();
  expect(opening).toMatchObject({alive:16,deck:29,faces:52,layers:[4,4,3,2,3]});
  expect(opening.hand).toHaveLength(5);
  expect(opening.supply).toHaveLength(2);
  await expect(page.locator('#tutorial-hint')).toContainText('清空场上全部 16 名敌人');
  const seen = new Set();
  for (let clicks=0;clicks<120;clicks++) {
    const before = await state();
    expect(before.ids).toEqual(opening.ids);
    if (before.index === 10) break;
    if (!seen.has(before.index)) {
      seen.add(before.index);
      if (before.index === 1) expect(new Set(before.hand.map(c=>c.replace(/\d+$/,''))).size).toBe(4);
      if (before.index === 3) { expect(before.alive).toBe(16); expect(before.discarded).toContain('spades3'); }
      if (before.index === 4) { expect(before.supply).toContain('diamonds6'); expect(before.discarded).toContain('hearts6'); }
      if (before.index === 5) {
        const front = page.getByRole('button',{name:'红桃7敌人'});
        await front.scrollIntoViewIfNeeded();
        const onTop = await front.evaluate(el => {
          const rear = [...document.querySelectorAll('.enemy-card.back')].find(card =>
            card.style.zIndex === '3' && card.offsetLeft > el.offsetLeft);
          const a = el.getBoundingClientRect(), b = rear.getBoundingClientRect();
          const left = Math.max(a.left,b.left), right = Math.min(a.right,b.right);
          const top = Math.max(a.top,b.top), bottom = Math.min(a.bottom,b.bottom);
          return left < right && top < bottom && el.contains(document.elementFromPoint((left+right)/2,(top+bottom)/2));
        });
        expect(onTop).toBe(true);
      }
      if (before.index === 6) { expect(before.supply).toContain('hearts7'); expect(before.discarded).toContain('hearts5'); }
      if (before.index === 9) { expect(before.hand).toContain('hearts2'); expect(before.discarded).toContain('spades11'); }
    }
    if (await page.locator('#modal-overlay.show').count()) {
      await page.getByRole('button',{name:/补给.*抽3张/}).click();
    } else {
      const targets = page.locator('.tutorial-target:not(.synergy-target)');
      expect(await targets.count(), '教程步骤 ' + before.index).toBeGreaterThan(0);
      await targets.first().click();
    }
  }
  await expect(page.locator('#modal-title')).toHaveText('基础教程完成');
  const checkpoint = await state();
  expect(checkpoint.discarded).toEqual(expect.arrayContaining(['clubs5','diamonds5']));
  expect(checkpoint.alive).toBe(13);
  expect(seen.size).toBe(10);
  expect(prompts.some(text=>text.includes('防御物资'))).toBeTruthy();
  await page.getByRole('button',{name:choice}).click();
  await expect(page.locator('#tutorial-panel')).toBeHidden();
  await expect(page.locator('.tutorial-target')).toHaveCount(0);
  const after = await state();
  if (choice === '开启新游戏') {
    await expect(page.locator('#mulligan-bar')).toBeVisible();
    expect(after).toMatchObject({alive:16,deck:29,discarded:[]});
    expect(after.ids).not.toEqual(opening.ids);
  } else {
    expect(after).toEqual({...checkpoint,index:undefined});
    // Attack a different enemy from the guided route using a freely chosen hand.
    await page.getByRole('button',{name:'红桃2手牌'}).click();
    await page.locator('.enemy-card.selectable.back').last().click();
    expect((await state()).alive).toBe(12);
    await expect(page.locator('#modal-overlay')).not.toHaveClass(/show/);
  }
});
}
