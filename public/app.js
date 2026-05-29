// 主頁：12 類別全螢幕分頁 + 砌磚牆寬扁磁磚（錯位交錯）+ 左側類別導覽
const pagesEl = document.getElementById('pages');
const sideNavEl = document.getElementById('sideNav');
const statusEl = document.getElementById('status');
const favCountEl = document.getElementById('favCount');
const refreshBtn = document.getElementById('refreshBtn');

const BIAS_WORDS = (window.BIAS_WORDS || []).slice().sort((a, b) => b.length - a.length);
const HEART_PATH = 'M12 21s-7-4.6-7-10.3A4.7 4.7 0 0 1 9.7 6c1.6 0 3 .8 3.8 2 .8-1.2 2.2-2 3.8-2A4.7 4.7 0 0 1 22 10.7C22 16.4 12 21 12 21z';

// 字級隨機池（決定每塊磚的文字大小）
const SIZE_POOL = [
  ...Array(6).fill('size-l'),
  ...Array(9).fill('size-m'),
  ...Array(7).fill('size-s'),
];
const COPIES = 6; // 每類別重複幾份做出「滑很久」的感覺

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function highlightBias(title) {
  let safe = escapeHTML(title);
  for (const w of BIAS_WORDS) {
    if (!w) continue;
    safe = safe.replace(new RegExp(escapeRegExp(w), 'g'), `<span class="bias">${w}</span>`);
  }
  return safe;
}
function randomSize() { return SIZE_POOL[Math.floor(Math.random() * SIZE_POOL.length)]; }
function formatTime(ms) {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function updateFavCount() { favCountEl.textContent = window.Favorites.count(); }

// 桌機 6 排、手機 4 排
function rowCount() { return window.innerWidth <= 760 ? 4 : 6; }

function buildBrick(item) {
  const a = document.createElement('a');
  a.className = `brick ${randomSize()}`;
  a.href = item.url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.dataset.url = item.url;
  a.dataset.id = item.id;

  const isFav = window.Favorites.has(item.url);
  if (isFav) a.classList.add('favored');

  a.innerHTML = `
    <span class="brick-text">${highlightBias(item.title)}</span>
    <button class="fav-btn" type="button" aria-label="收藏">
      <svg viewBox="0 0 24 24"><path d="${HEART_PATH}" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"/></svg>
    </button>
  `;

  const favBtn = a.querySelector('.fav-btn');
  favBtn.addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    const nowFav = window.Favorites.toggle({
      id: item.id, url: item.url, title: item.title,
    });
    document.querySelectorAll(`.brick[data-url="${CSS.escape(item.url)}"]`).forEach(el => {
      el.classList.toggle('favored', nowFav);
      const path = el.querySelector('.fav-btn svg path');
      if (path) path.setAttribute('fill', nowFav ? 'currentColor' : 'none');
    });
    updateFavCount();
  });

  // 手機長按顯示愛心
  let pressTimer = null;
  let startX = 0, startY = 0;
  a.addEventListener('touchstart', e => {
    if (e.touches[0]) { startX = e.touches[0].clientX; startY = e.touches[0].clientY; }
    pressTimer = setTimeout(() => {
      a.classList.add('show-fav');
      if (navigator.vibrate) navigator.vibrate(15);
    }, 550);
  }, { passive: true });
  a.addEventListener('touchmove', e => {
    if (!e.touches[0]) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearTimeout(pressTimer);
  }, { passive: true });
  a.addEventListener('touchend', () => {
    clearTimeout(pressTimer);
    if (a.classList.contains('show-fav')) {
      a.dataset.suppressClick = '1';
      setTimeout(() => a.classList.remove('show-fav'), 5000);
    }
  });

  // 點開抽屜（cmd/ctrl/shift/中鍵 仍直開原文）
  a.addEventListener('click', e => {
    if (a.dataset.suppressClick === '1') {
      e.preventDefault();
      a.dataset.suppressClick = '0';
      return;
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    window.openDrawer(item.id, item.url);
  });
  return a;
}

function reshuffleSizes(rail) {
  rail.querySelectorAll('.brick').forEach(b => {
    b.classList.remove('size-l', 'size-m', 'size-s');
    b.classList.add(randomSize());
  });
}

function buildPage(cat) {
  const page = document.createElement('section');
  page.className = 'page';
  page.dataset.code = cat.code;

  page.innerHTML = `
    <div class="watermark">${escapeHTML(cat.name)}</div>
    <div class="watermark-meta">今日 ${cat.total_today} 則 · 顯示 ${cat.items.length}</div>
    <div class="brick-rail" data-code="${cat.code}"></div>
    <div class="scroll-hint">↔ 橫向滑看更多　·　↓ 切換類別</div>
  `;

  const rail = page.querySelector('.brick-rail');
  const items = cat.items || [];
  if (items.length === 0) {
    rail.innerHTML = `<div style="margin:auto;color:var(--muted);font-family:var(--sans)">此類別尚無資料</div>`;
    rail.style.display = 'flex';
    rail.style.alignItems = 'center';
    rail.style.justifyContent = 'center';
    return page;
  }

  const rows = rowCount();
  const rowEls = [];
  for (let r = 0; r < rows; r++) {
    const row = document.createElement('div');
    row.className = 'brick-row' + (r % 2 === 1 ? ' offset' : '');
    rail.appendChild(row);
    rowEls.push(row);
  }
  // 重複 COPIES 份；round-robin 分配到各 row
  let idx = 0;
  for (let copy = 0; copy < COPIES; copy++) {
    for (const it of items) {
      rowEls[idx % rows].appendChild(buildBrick(it));
      idx++;
    }
  }
  return page;
}

function buildSideNav(items) {
  sideNavEl.innerHTML = `<ul>${items.map((c, i) => `
    <li data-i="${i}" data-count="${c.total_today ?? c.total ?? ''}">${escapeHTML(c.name)}</li>
  `).join('')}</ul>`;
  sideNavEl.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', () => {
      const i = parseInt(li.dataset.i, 10);
      pagesEl.scrollTo({ top: i * window.innerHeight, behavior: 'smooth' });
    });
  });
}

function buildCloudPage(cloudItems) {
  const page = document.createElement('section');
  page.className = 'page cloud-page';
  page.dataset.code = 'keywords';
  const counts = cloudItems.map(k => k.count);
  const maxC = counts.length ? Math.max(...counts) : 1;
  const minC = counts.length ? Math.min(...counts) : 1;

  const words = cloudItems.map(k => {
    const ratio = maxC === minC ? 1 : (k.count - minC) / (maxC - minC);
    const size = Math.round(16 + ratio * 56);  // 16~72 px
    const opacity = (0.55 + ratio * 0.45).toFixed(2);
    return `<span class="cloud-word" data-word="${escapeHTML(k.word)}"
                style="font-size:${size}px;opacity:${opacity}">${escapeHTML(k.word)}<em class="cloud-count">${k.count}</em></span>`;
  }).join(' ');

  page.innerHTML = `
    <div class="watermark">熱門</div>
    <div class="watermark-meta">今日熱門關鍵字 · 點擊查看相關標題</div>
    <div class="cloud-wrap">
      <div class="cloud">${words || '<span style="color:var(--muted);font-family:var(--sans);font-size:14px">資料尚少，再多幾次抓取後產生</span>'}</div>
    </div>
    <div class="scroll-hint">↑ 回到分類</div>
  `;

  page.querySelectorAll('.cloud-word').forEach(el => {
    el.addEventListener('click', async () => {
      const word = el.dataset.word;
      try {
        const r = await fetch(`/api/keywords/headlines?word=${encodeURIComponent(word)}&limit=1`);
        const d = await r.json();
        if (d.items && d.items[0]) {
          window.openDrawer(d.items[0].id, d.items[0].url);
        }
      } catch (e) { console.error(e); }
    });
  });
  return page;
}

function setupObserver() {
  const obs = new IntersectionObserver(entries => {
    for (const e of entries) {
      const active = e.intersectionRatio > 0.55;
      e.target.classList.toggle('active', active);
      if (active) {
        const i = Array.from(pagesEl.children).indexOf(e.target);
        sideNavEl.querySelectorAll('li').forEach((b, j) => b.classList.toggle('active', j === i));
        const rail = e.target.querySelector('.brick-rail');
        if (rail) {
          if (rail.dataset.first) reshuffleSizes(rail);
          else rail.dataset.first = '1';
        }
      }
    }
  }, { root: pagesEl, threshold: [0, 0.55] });
  pagesEl.querySelectorAll('.page').forEach(p => obs.observe(p));
}

function loadCategories() {
  statusEl.textContent = '載入中…';
  Promise.all([
    fetch('/api/categories?limit=80').then(r => r.json()),
    fetch('/api/keywords?limit=40').then(r => r.json()).catch(() => ({ items: [] })),
  ])
    .then(([catData, kwData]) => {
      const cats = catData.categories || [];
      const cloud = kwData.items || [];
      pagesEl.innerHTML = '';
      for (const cat of cats) pagesEl.appendChild(buildPage(cat));
      pagesEl.appendChild(buildCloudPage(cloud));

      const navItems = [
        ...cats.map(c => ({ name: c.name, total_today: c.total_today })),
        { name: '熱門', total_today: cloud.length },
      ];
      buildSideNav(navItems);

      requestAnimationFrame(() => {
        const first = pagesEl.querySelector('.page');
        if (first) first.classList.add('active');
        sideNavEl.querySelector('li')?.classList.add('active');
        setupObserver();
      });
      statusEl.textContent = `更新於 ${formatTime(Date.now())}`;
    })
    .catch(err => { statusEl.textContent = '載入失敗'; console.error(err); });
}

refreshBtn.addEventListener('click', async () => {
  statusEl.textContent = '抓取中…';
  try { await fetch('/api/refresh', { method: 'POST' }); } catch {}
  loadCategories();
});

// 鍵盤 ↑↓ 切換類別
window.addEventListener('keydown', e => {
  const pages = Array.from(pagesEl.querySelectorAll('.page'));
  if (!pages.length) return;
  const current = Math.round(pagesEl.scrollTop / window.innerHeight);
  let next = current;
  if (e.key === 'ArrowDown' || e.key === 'PageDown') next = Math.min(current + 1, pages.length - 1);
  else if (e.key === 'ArrowUp' || e.key === 'PageUp') next = Math.max(current - 1, 0);
  else return;
  e.preventDefault();
  pagesEl.scrollTo({ top: next * window.innerHeight, behavior: 'smooth' });
});

window.addEventListener('favorites:changed', updateFavCount);
window.addEventListener('storage', e => {
  if (e.key === 'tw-news-favorites') {
    updateFavCount();
    document.querySelectorAll('.brick').forEach(t => {
      const fav = window.Favorites.has(t.dataset.url);
      t.classList.toggle('favored', fav);
      const path = t.querySelector('.fav-btn svg path');
      if (path) path.setAttribute('fill', fav ? 'currentColor' : 'none');
    });
  }
});

// 視窗大小變化時重排（rows 數量會變）
let resizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(loadCategories, 250);
});

updateFavCount();
loadCategories();
setInterval(loadCategories, 5 * 60 * 1000);
