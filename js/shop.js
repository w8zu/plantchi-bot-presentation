// 꾸미기 상점 (추가 기능). 서버 API 없이 이 브라우저에만 저장한다(localStorage).
// 포인트·젬·보유 아이템을 서버에 저장하려면 backend에 API를 추가해야 한다([계약 변경] PR).

const PlantchiShop = (() => {
  const KEY = 'plantchi.shop';
  const HAPPY_POINT_MS = 60 * 1000; // 행복한 상태 1분마다 +1P

  const NUTRIENTS = [
    { icon: '🧪', name: '앱 영양제', desc: '영양 센서(EC)를 달면 “아파요” 표정을 회복시키는 기록용 아이템', price: '50 P' },
    { icon: '🧴', name: '식물 액체비료 500ml', desc: '실물 배송 · 구매하면 앱 영양제 5개 지급', price: '₩8,900' },
    { icon: '💉', name: '꽂아 두는 영양 앰플 10입', desc: '실물 배송 · 바쁜 집사용', price: '₩5,900' },
  ];
  const GEM_PACKS = [
    { gem: 10, krw: '₩1,200' },
    { gem: 55, krw: '₩5,900', bonus: '+5 보너스' },
    { gem: 120, krw: '₩11,000', bonus: '+20 보너스' },
    { gem: 330, krw: '₩29,000', bonus: '+80 보너스' },
  ];

  let data = { pt: 0, gem: 0, owned: [], equipped: {}, happyMs: 0 };
  let tryOn = {};
  let species = 'basil';
  let slotFilter = 'all';
  let toast = () => {};
  let onChange = () => {};
  let fitting = null;

  const $ = (id) => document.getElementById(id);

  function load() {
    try { data = { ...data, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { /* 기본값 사용 */ }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* 저장 실패해도 이번 화면에서는 동작 */ }
  }

  const priceText = (price) => (price.gem ? `💎 ${price.gem}` : `🌱 ${price.pt} P`);
  const canAfford = (price) => (price.gem ? data.gem >= price.gem : data.pt >= price.pt);
  const isOwned = (item) => item.free || data.owned.includes(item.id);
  // 배경은 늘 하나를 쓰고 있다(아무것도 안 골랐거나 예전 배경 아이템이면 기본 배경)
  const currentBg = () => (PlantchiArt.BACKGROUNDS[data.equipped.bg] ? data.equipped.bg : PlantchiArt.DEFAULT_BG);
  const isWorn = (item) => (item.slot === 'bg' ? currentBg() === item.id : data.equipped[item.slot] === item.id);

  function render() {
    $('wallet-pt').textContent = data.pt;
    $('wallet-gem').textContent = data.gem;
    PlantchiArt.updateStage(fitting, {
      species, stage: PlantchiGrowth.seenStage(species), mood: 'happy', equipped: { ...data.equipped, ...tryOn },
    });
    renderItems();
  }

  function renderItems() {
    const grid = $('item-grid');
    grid.innerHTML = '';
    for (const item of PlantchiArt.ITEMS) {
      if (slotFilter !== 'all' && item.slot !== slotFilter) continue;
      const owned = isOwned(item);
      const worn = isWorn(item);
      const trying = tryOn[item.slot] === item.id;
      const card = document.createElement('article');
      card.className = `item${worn ? ' is-worn' : ''}${trying ? ' is-trying' : ''}`;
      const preview = item.svg ? item.svg : `<img class="bg-thumb" src="${PlantchiArt.BACKGROUNDS[item.id].day}" alt="">`;
      let action;
      if (worn && item.slot === 'bg') action = '<button class="btn-sm ghost" disabled>사용 중</button>';
      else if (worn) action = '<button class="btn-sm ghost" data-do="unequip">벗기</button>';
      else if (owned) action = `<button class="btn-sm" data-do="equip">${item.slot === 'bg' ? '사용' : '착용'}</button>`;
      else action = `<button class="btn-sm buy" data-do="buy" ${canAfford(item.price) ? '' : 'disabled'}>${priceText(item.price)}</button>`;
      card.innerHTML = `
        <button class="item-preview" data-do="try" title="입어 보기">${preview}</button>
        <div class="item-meta"><b>${item.name}</b><span class="muted">${PlantchiArt.SLOT_NAMES[item.slot]}${item.free ? ' · 기본' : owned ? ' · 보유' : ''}</span></div>
        ${action}`;
      card.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-do]');
        if (btn) handle(item, btn.dataset.do);
      });
      grid.append(card);
    }
  }

  function handle(item, what) {
    if (what === 'try') {
      if (tryOn[item.slot] === item.id) delete tryOn[item.slot];
      else tryOn[item.slot] = item.id;
    } else if (what === 'buy') {
      if (!canAfford(item.price)) { toast(item.price.gem ? '젬이 부족해요' : '포인트가 부족해요'); return; }
      if (item.price.gem) data.gem -= item.price.gem; else data.pt -= item.price.pt;
      data.owned.push(item.id);
      data.equipped[item.slot] = item.id;
      delete tryOn[item.slot];
      toast(`${item.name}을(를) 샀어요! 바로 ${item.slot === 'bg' ? '바꿨어요' : '착용했어요'}`);
    } else if (what === 'equip') {
      if (item.free) delete data.equipped[item.slot]; else data.equipped[item.slot] = item.id;
      delete tryOn[item.slot];
    } else if (what === 'unequip') {
      delete data.equipped[item.slot];
    }
    save();
    render();
    onChange();
  }

  function renderStatic() {
    const filter = $('slot-filter');
    for (const [slot, name] of [['all', '전체'], ...Object.entries(PlantchiArt.SLOT_NAMES)]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `pill${slot === slotFilter ? ' is-active' : ''}`;
      b.textContent = name;
      b.addEventListener('click', () => {
        slotFilter = slot;
        filter.querySelectorAll('.pill').forEach((p) => p.classList.toggle('is-active', p === b));
        renderItems();
      });
      filter.append(b);
    }

    $('nutri-grid').innerHTML = NUTRIENTS.map((n) => `
      <article class="item">
        <span class="item-preview emoji">${n.icon}</span>
        <div class="item-meta"><b>${n.name}</b><span class="muted">${n.desc}</span></div>
        <button class="btn-sm" disabled>${n.price} · 준비 중</button>
      </article>`).join('');

    const gemGrid = $('gem-grid');
    gemGrid.innerHTML = GEM_PACKS.map((p, i) => `
      <article class="item">
        <span class="item-preview emoji">💎</span>
        <div class="item-meta"><b>젬 ${p.gem}개</b><span class="muted">${p.bonus || '기본 상품'}</span></div>
        <button class="btn-sm buy" data-pack="${i}">${p.krw}</button>
      </article>`).join('');
    gemGrid.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-pack]');
      if (!btn) return;
      data.gem += GEM_PACKS[Number(btn.dataset.pack)].gem;
      save();
      render();
      toast('데모: 결제 없이 젬을 충전했어요');
    });

    document.querySelectorAll('.shop-tabs .seg').forEach((tab) => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.shop-tabs .seg').forEach((t) => t.classList.toggle('is-active', t === tab));
        document.querySelectorAll('.shop-panel').forEach((p) => p.classList.toggle('is-active', p.dataset.shop === tab.dataset.shop));
      });
    });

    $('btn-try-reset').addEventListener('click', () => { tryOn = {}; render(); });
  }

  return {
    init(opts) {
      species = opts.species;
      toast = opts.toast;
      onChange = opts.onChange;
      load();
      fitting = PlantchiArt.createStage($('fitting-stage'));
      renderStatic();
      render();
    },
    equipped: () => ({ ...data.equipped }),
    setSpecies(id) { species = id; render(); },
    refresh: () => render(),
    addPoints(n) { data.pt += n; save(); render(); },
    tickHappy(dt) {
      data.happyMs += dt;
      if (data.happyMs < HAPPY_POINT_MS) return;
      data.pt += Math.floor(data.happyMs / HAPPY_POINT_MS);
      data.happyMs %= HAPPY_POINT_MS;
      save();
      render();
    },
  };
})();
