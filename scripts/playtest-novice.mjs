import { chromium } from 'playwright';

const browser = await chromium.launch({executablePath: process.env.CASTLE_CHROMIUM || undefined});
try {
  const page = await browser.newPage();
  page.on('dialog', dialog => dialog.accept());
  page.on('pageerror', error => { throw error; });
  await page.goto(process.argv[2] || 'http://127.0.0.1:8080');
  await page.waitForFunction(() => !!window.confirmMode);
  const results = await page.evaluate(async games => {
    const first = s => document.querySelector(s);
    const all = s => [...document.querySelectorAll(s)];
    const hand = () => all('.hand-card');
    const stock = () => all('#supply-pile .pile-card');
    const enemies = () => all('.enemy-card.selectable');
    const symbol = c => c.querySelector('.suit')?.textContent;
    const rank = c => c.querySelector('.rank')?.textContent;
    const check = (condition,reason) => { if (!condition) throw Error(reason); };
    const results = [];
    for (let seed = 1; seed <= games; seed++) {
      let rng = seed;
      Math.random = () => { rng = (Math.imul(1664525,rng) + 1013904223) >>> 0; return rng / 4294967296; };
      first('[data-mode="commander"]').click();
      first('#btn-mode-confirm').click();
      first('[data-key="novice"]').click();
      first('#btn-cmd-confirm').click();
      for (let i = 0; i < 2 && new Set(hand().map(symbol)).size < 3; i++) first('#btn-mulligan').click();
      all('#mulligan-bar button').at(-1).click();
      const used = { '♥':0,'♦':0,'♣':0,'♠':0 };
      const trace = [];
      let stuck = false;
      for (let step = 0; step < 120 && !first('#modal-overlay.show'); step++) {
        const n = hand().length, supply = stock().length, remaining = all('.enemy-card').length;
        const front = enemies();
        const bright = front.filter(e => e.classList.contains('front'));
        const dark = front.filter(e => e.classList.contains('back'));
        const match = hand().flatMap((c,i) => bright.filter(e => symbol(c) === symbol(e) || rank(c) === rank(e)).map(e => [i,e]))[0];
        const available = s => stock().some(c => c.textContent.endsWith(s));
        let tactic;
        if (available('♥') && n <= 4) tactic = '♥';
        else if (available('♣') && bright.length) tactic = '♣';
        else if (available('♦') && dark.length && !match) tactic = '♦';
        if (tactic) {
          first('#basic-tactics').click();
          stock().find(c => c.textContent.endsWith(tactic)).click();
          if (tactic === '♥') check(hand().length === n + 3 && stock().length === supply-1,'补给结算异常');
          if (tactic === '♦') {
            for (let i=0;i<Math.min(2,dark.length);i++) first('.enemy-card.selectable.back').click();
            check(stock().length === supply-1 && enemies().filter(e=>e.classList.contains('front')).length === bright.length + Math.min(2,dark.length),'侦查结算异常');
          }
          if (tactic === '♣') {
            const target = first('.enemy-card.selectable.front');
            const loot = symbol(target);
            target.click();
            check(all('.enemy-card').length === remaining-1 && stock().length === supply && stock().at(-1).textContent.endsWith(loot),'强攻缴获异常');
          }
          used[tactic]++; trace.push(tactic); continue;
        }
        if (!n || !front.length) { stuck = true; break; }
        const [idx,target] = match || [0,dark[0] || front[0]];
        const enemyIndex = all('.enemy-card').indexOf(target);
        hand()[idx].click(); all('.enemy-card')[enemyIndex].click();
        const won = all('.enemy-card').length < remaining;
        if (first('#message').textContent.includes('防御发动')) {
          check(hand().length === n && stock().length === supply - 1 + Number(won),'黑桃未正确代弃');
          used['♠']++; trace.push('♠');
        } else trace.push(all('.enemy-card').length < remaining ? '中' : '失');
      }
      results.push({seed,won:all('.enemy-card').length === 0,stuck,used,hand:hand().length,stock:stock().length,trace:trace.join(' ')});
      first('#modal > button').click(); first('button[onclick="resetGame()"]').click();
    }
    return results;
  }, Number(process.argv[3] || 32));
  console.log(JSON.stringify({games:results.length,wins:results.filter(r=>r.won).length,stuck:results.filter(r=>r.stuck).length,
    example:results.find(r=>r.won && Object.values(r.used).every(n=>n>0))}));
} finally { await browser.close(); }
