// Run against a local preview, e.g. node scripts/playtest-decks.mjs http://127.0.0.1:8080 32
import { writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { presets } from '../js/deck-catalog.js';
const [url = 'http://127.0.0.1:8080', games = '32', firstSeed = '1', reportPath] = process.argv.slice(2);
const browser = await chromium.launch({executablePath:process.env.CASTLE_CHROMIUM || undefined});
const page = await browser.newPage();
page.on('pageerror', error => { throw error; });
await page.goto(url);
await page.waitForFunction(() => !!window.confirmMode);
const reports = [];
try {
  for (const preset of Object.values(presets)) {
    const results = await page.evaluate(async ({preset,games,firstSeed}) => {
      const all = css => [...document.querySelectorAll(css)];
      const first = css => document.querySelector(css);
      const suit = b => b.querySelector('.suit')?.textContent;
      const rank = b => b.querySelector('.rank')?.textContent;
      const supply = () => all('#supply-pile .pile-card').map(b => b.textContent.at(-1));
      const priority = ['木牛流马','兵粮寸积','一鼓作气','烽火连台','诱敌露隙','斩将夺旗','候骑先行','合券征粮','偃旗息鼓','尽知虚实','长驱直入','金蝉脱壳','量入为出','断后疑兵','买通耳目','拔除鹿角'];
      const favored = preset.name[0];
      const results = [];
      for (let seed = firstSeed; seed < firstSeed + games; seed++) {
        let rng = seed;
        Math.random = () => { rng = (Math.imul(1664525,rng) + 1013904223) >>> 0; return rng / 4294967296; };
        window.selectMode('constructed'); // Archived mode has no public menu button.
        first('#btn-mode-confirm').click();
        all('#modal-extra button').find(b => b.textContent === preset.name).click();
        for (let i=0;i<2 && new Set(all('.hand-card').map(suit)).size < 3;i++) first('#btn-mulligan').click();
        all('#mulligan-bar button').at(-1).click();
        let attacks = 0, steps = 0, activations = 0;
        let last = '';
        const trace = [];
        while (++steps < 500) {
          for (let i=0;i<20;i++) await Promise.resolve();
          const buttons = all('#modal-overlay.show #modal-extra button');
          const title = first('#modal-title').textContent;
          if (first('#modal-overlay.show') && /胜利|失败/.test(title) && !buttons.length) break;
          if (buttons.length) {
            let choice = buttons[0];
            if (/学习首个|选择永久/.test(title)) {
              const score = b => {
                const text = b.textContent;
                const ix = priority.findIndex(name => text.includes(name));
                return Number(supply().includes(text[0]) || /木牛流马|诱敌露隙|烽火连台|一鼓作气/.test(text))*20 + (ix < 0 ? 0 : 15-ix);
              };
              choice = buttons.reduce((best,b) => score(b)>score(best)?b:best);
            } else if (title.includes('弃一物资学习')) {
              choice = buttons.find(b => b.textContent[0] !== favored && b.textContent !== '取消') || choice;
            } else if (title.includes('选择强攻目标') && last.includes('一鼓作气')) {
              const weak = buttons.find(b => /号 [♥♦♣♠][A2-7]$/.test(b.textContent));
              choice = weak || buttons.find(b=>b.textContent.includes('暗敌')) || choice;
            } else if (title.includes('破阵余势') && !last.includes('一鼓作气') && !all('.enemy-card.front.selectable').length) {
              choice = buttons[0];
            } else if (/转为物资|督粮官|与弃堆顶|盖回|改为手牌|收编|弃手牌侦查/.test(title)) {
              const skip = buttons.find(b => /跳过|取消/.test(b.textContent));
              if (/收编/.test(title)) choice = all('.hand-card').length <= 3 ? choice : skip || choice;
              else choice = skip || choice;
            } else if (title.includes('侦查目标') && last.includes('候骑') && buttons.at(-1).textContent === '取消') {
              choice = buttons.at(-1);
            } else if (title.includes('支付追击') || title.includes('选择发动')) {
              choice = buttons.find(b => b.textContent[0] === last[0]) || choice;
            }
            if (/学习首个|选择永久/.test(title)) trace.push('学习 ' + choice.textContent.split(' · ')[0]);
            choice.click(); continue;
          }
          const hand = all('.hand-card'), enemies = all('.enemy-card.selectable');
          const pairs = hand.flatMap((h,i) => enemies.filter(e => e.classList.contains('front') &&
            (rank(h) === rank(e) || suit(h) === suit(e))).map(e => [i,e]));
          const dark = enemies.find(e => e.classList.contains('back'));
          const actions = all('#constructed-panel button:not(:disabled)');
          const skills = actions.filter(b => !b.textContent.includes('学习技能'));
          const guards = skills.filter(b => b.textContent.startsWith('♠'));
          const guard = guards.find(b => /诱敌露隙|反客为主/.test(b.textContent)) ||
            guards.find(b => pairs.length ? /S4|收拢散卒|收兵整队/.test(b.textContent) : /断后疑兵|留有后手/.test(b.textContent));
          const draw = skills.find(b => b.textContent.startsWith('♥'));
          const strike = skills.find(b => b.textContent.includes('一鼓作气')) || skills.find(b => b.textContent.startsWith('♣'));
          const scout = skills.find(b => b.textContent.startsWith('♦'));
          const learn = actions.find(b => b.textContent.startsWith('学习技能'));
          let action = hand.length <= 2 && draw;
          if (!action && (!pairs.length || !hand.length || supply().length >= 3)) action = strike || scout;
          if (!action && guard && hand.length) action = guard;
          if (!action && draw && hand.length <= 4) action = draw;
          if (!action && learn && (supply().length >= 3 || (!pairs.length && !skills.length && !first('#constructed-panel').textContent.includes('本次攻城已准备')))) action = learn;
          if (!action && !hand.length) action = skills[0] || learn;
          if (action) {
            last = action.textContent;
            if (action !== learn) { activations++; trace.push('发动 ' + last.split(' · ')[0]); }
            action.click(); continue;
          }
          if (!enemies.length || !hand.length) throw Error('未结算的死局 ' + preset.name + ' seed ' + seed);
          const [idx,target] = pairs[0] || [0,dark || enemies[0]];
          const enemyIndex = all('.enemy-card').indexOf(target);
          trace.push('普通攻城 ' + suit(hand[idx]) + rank(hand[idx]) + ' → ' + (suit(target) ? suit(target) + rank(target) : '暗敌'));
          hand[idx].click();
          all('.enemy-card')[enemyIndex].click(); attacks++;
        }
        if (steps >= 500) throw Error('行动超限 ' + preset.name + seed + last + first("#modal-title").textContent);
        const remaining = Number(first('#enemy-count').textContent);
        results.push({seed,remaining,attacks,activations,hand:all('.hand-card').length,stock:supply().length,trace:remaining === 0 && !results.some(r=>r.remaining === 0) ? trace : undefined});
        first('#modal > button').click();
        first('button[onclick="resetGame()"]').click();
      }
      return results;
    }, {preset,games:Number(games),firstSeed:Number(firstSeed)});
    const wins = results.filter(r => r.remaining === 0);
    reports.push({deck:preset.name, results});
    console.log(JSON.stringify({deck:preset.name, games:results.length, wins:wins.length, firstWin:wins[0] && {...wins[0],trace:undefined}, best:Math.min(...results.map(r=>r.remaining)), meanRemaining:results.reduce((sum,r)=>sum+r.remaining,0)/results.length}));
  }
  if (reportPath) await writeFile(reportPath,JSON.stringify(reports));
} finally { await browser.close(); }
