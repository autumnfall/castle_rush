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
    for (const success of [true, false]) {
      for (accept of outcomes.includes(success) ? [true, false] : [false]) {
        prompts = 0;
        const attacker = makeCard('hearts', 5), spare = makeCard('diamonds', 2);
        const target = makeEnemy(success ? 'spades' : 'clubs', success ? 5 : 7, 4, 0, 1);
        const spade = success ? target : makeCard('spades', 4);
        const deck = [makeCard('clubs', 3), makeCard('clubs', 4), makeCard('clubs', 6)];
        await patchGameState(page, {
          hand: [attacker, spare], enemies: [target, makeEnemy('clubs', 9, 4, 1, 3)],
          discard: [], supply: success ? [] : [spade], deck, timeDeck: [],
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
        expect(prompts).toBe(Number(outcomes.includes(success)));
        const replaces = accept && key !== 'logistics';
        const drawCount = accept ? ({ logistics: 2, blitzkrieg: 1 }[key] || 0) : 0;
        expect(state.hand).toEqual([...(replaces ? [attacker.id] : []), spare.id,
          ...[...deck].reverse().slice(0,drawCount).map(c => c.id)]);
        expect(state.discard).toEqual([...(replaces ? [] : [attacker.id]), ...(accept ? [spade.id] : [])]);
        expect(state.supply).toEqual(accept ? [] : [spade.id]);
        expect(state.defeated).toBe(success);
        expect(state.phase).toBe('playing');
      }
    }
  });
}
