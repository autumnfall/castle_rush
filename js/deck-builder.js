import { cards, talents, cardCost, deckCost, validDeck } from './deck-catalog.js';

const storageKey = 'castle-rush.custom-deck.v1';

function previousDeck() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    if (saved?.talent === 'hearts') saved.talent = 'HK';
    if (saved?.talent === 'clubs') saved.talent = 'CJ';
    if (saved && Object.hasOwn(talents, saved.talent) && Array.isArray(saved.list) &&
        saved.list.every(id => Object.hasOwn(cards, id))) return { ...saved, list: [...new Set(saved.list)] };
  } catch {
    // Storage may be unavailable in private browsing.
  }
  return { talent: null, list: [] };
}

export function openDeckBuilder(startGame) {
  const page = document.getElementById('deck-builder');
  const menu = document.getElementById('mode-select');
  const form = document.getElementById('builder-form');
  const saved = previousDeck();

  document.getElementById('builder-talents').innerHTML = Object.entries(talents).map(([key, [name, text]]) =>
    `<label class="builder-card"><span><input type="radio" name="talent" value="${key}" ${saved.talent === key ? 'checked' : ''}>
    <b>${name}</b> · ${cardCost(key)} 费</span><small>${text}</small></label>`
  ).join('');
  const catalog = document.getElementById('builder-cards');
  catalog.innerHTML = '';
  for (const [suit, suitName] of Object.entries({ H:'♥ 红桃', D:'♦ 方块', C:'♣ 梅花', S:'♠ 黑桃' })) {
    const group = document.createElement('details');
    group.open = suit === 'H' || saved.list.some(id => id.startsWith(suit));
    const ranks = ['A','2','3','4','5','6','7','8','9','10'];
    group.innerHTML = '<summary>' + suitName + '</summary><div class="builder-grid">' + ranks.map(rank => {
      const id = suit + rank;
      const [name, text] = cards[id];
      return `<label class="builder-card"><span><input type="checkbox" name="skill" value="${id}" ${saved.list.includes(id) ? 'checked' : ''}>
        <b>${name}</b> · ${cardCost(id)} 费</span><small>${text}</small></label>`;
    }).join('') + '</div>';
    catalog.append(group);
  }

  function selection() {
    const fields = new FormData(form);
    const list = fields.getAll('skill');
    return { talent: fields.get('talent'), list };
  }
  function update() {
    const deck = selection();
    document.getElementById('builder-count').textContent =
      '天赋 ' + Number(!!deck.talent) + '/1 · 普通技能 ' + deck.list.length + '/5 · 总费用 ' + deckCost(deck) + '/10';
    document.getElementById('builder-start').disabled = !validDeck(deck);
  }
  form.onchange = update;
  form.onsubmit = event => {
    event.preventDefault();
    const deck = selection();
    if (!validDeck(deck)) return;
    try { localStorage.setItem(storageKey, JSON.stringify(deck)); } catch { /* Keep playing without storage. */ }
    page.classList.add('hidden');
    startGame(deck);
    window.scrollTo(0, 0);
  };
  document.getElementById('builder-back').onclick = () => {
    page.classList.add('hidden');
    menu.classList.remove('hidden');
    document.getElementById('btn-mode-confirm').focus();
  };
  update();
  menu.classList.add('hidden');
  page.classList.remove('hidden');
  document.getElementById('builder-title').focus();
}
