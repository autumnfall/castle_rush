import { test, expect } from '@playwright/test';
import { makeCard, makeEnemy, patchGameState } from './helpers.js';

const triggers = {
  basic: [true, false], novice: [true, false], logistics: [true], intel: [false],
  tactician: [true, false], assault: [true], blitzkrieg: [true], attrition: [false],
};

for (const [key, outcomes] of Object.entries(triggers)) {
  test(key + ' 攻城结算逐张核对黑桃物资与手牌', async ({page}) => {
    const mode = ['blitzkrieg','attrition'].includes(key) ? 'commander+defense' : key === 'basic' ? 'basic' : 'commander';
    await page.goto('/');
    await page.evaluate(mode => window.selectMode(mode), mode);
    await page.click('#btn-mode-confirm');
    if (key !== 'basic') {
      await page.click('[data-key="' + key + '"]');
      await page.click('#btn-cmd-confirm');
    }
    await page.getByText('确认手牌',{exact:true}).click();
    let accept, prompts;
    page.on('dialog', dialog => {
      prompts++;
      return accept ? dialog.accept() : dialog.dismiss();
    });
    for (const [success, hasSpade] of [[true,false],[true,true],[false,true]]) {
      const eligible = outcomes.includes(success) && hasSpade;
      for (accept of eligible ? [true, false] : [false]) {
        prompts = 0;
        const attacker = makeCard('spades', 5), spare = makeCard('diamonds', 2);
        const target = makeEnemy(success ? 'spades' : 'clubs', success ? 9 : 7, 4, 0, 1);
        const spade = makeCard('spades', 4);
        const deck = [makeCard('clubs', 3), makeCard('clubs', 4), makeCard('clubs', 6)];
        await patchGameState(page, {
          hand: [attacker, spare], enemies: [target, makeEnemy('clubs', 9, 4, 1, 3)],
          discard: [], supply: hasSpade ? [spade] : [], deck, timeDeck: [],
          turnPhase: 'siege', phaseActions: {}, turn: 1,
        });
        await page.locator('.hand-card').first().click();
        await page.locator('.enemy-card.selectable').first().click();
        if (key === 'intel' && accept) await page.locator('#skill-section button').filter({hasText:'取消'}).click();
        const state = await page.evaluate(() => {
          const g = window.gameState;
          return { hand:g.hand.map(c => c.id), supply:g.supply.map(c => c.id),
            discard:g.discard.map(c => c.id), defeated:g.enemies[0].defeated, phase:g.phase };
        });
        expect(prompts).toBe(Number(eligible));
        const replaces = accept && key !== 'logistics';
        const drawCount = accept ? ({ logistics: 2, blitzkrieg: 1 }[key] || 0) : 0;
        expect(state.hand).toEqual([...(replaces ? [attacker.id] : []), spare.id,
          ...[...deck].reverse().slice(0,drawCount).map(c => c.id)]);
        expect(state.discard).toEqual([...(replaces ? [] : [attacker.id]), ...(accept ? [spade.id] : [])]);
        expect(state.supply).toEqual([...(hasSpade && !accept ? [spade.id] : []), ...(success ? [target.id] : [])]);
        expect(state.defeated).toBe(success);
        expect(state.phase).toBe('playing');
      }
    }
  });
}

test('战争艺术的额外效果不计本次缴获的新花色', async ({page}) => {
  await page.goto('/');
  await page.click('[data-mode="commander"]');
  await page.click('#btn-mode-confirm');
  await page.click('[data-key="tactician"]');
  await page.click('#btn-cmd-confirm');
  await page.getByText('确认手牌',{exact:true}).click();
  const spade = makeCard('spades',9);
  const enemy = makeEnemy('hearts',8,4,0,1);
  await patchGameState(page, {
    hand:[makeCard('hearts',2)], supply:[spade], discard:[],
    enemies:[enemy,makeEnemy('clubs',7,4,1,3)],
  });
  page.on('dialog',dialog => dialog.accept());
  await page.locator('.hand-card').click();
  await page.locator('.enemy-card.selectable').first().click();
  await expect(page.locator('#modal-overlay')).not.toHaveClass(/show/);
  expect(await page.evaluate(()=>window.gameState.discard.map(c=>c.id))).toEqual([spade.id]);
  expect(await page.evaluate(()=>window.gameState.supply.map(c=>c.id))).toEqual([enemy.id]);
});
