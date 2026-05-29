// 主頁：桌機橫向滑動 + 12 類別 + 標籤雲在首位 + 聚寶盆 radial + 全站搜尋
const pagesEl = document.getElementById('pages');
const sideNavEl = document.getElementById('sideNav');
const statusEl = document.getElementById('status');
const favCountEl = document.getElementById('favCount');
const refreshBtn = document.getElementById('refreshBtn');
const topSearchInput = document.getElementById('topSearch');
const topSearchResults = document.getElementById('topSearchResults');

const BIAS_WORDS = (window.BIAS_WORDS || []).slice().sort((a, b) => b.length - a.length);
const HEART_PATH = 'M12 21s-7-4.6-7-10.3A4.7 4.7 0 0 1 9.7 6c1.6 0 3 .8 3.8 2 .8-1.2 2.2-2 3.8-2A4.7 4.7 0 0 1 22 10.7C22 16.4 12 21 12 21z';

const SIZE_POOL = [
  ...Array(6).fill('size-l'),
  ...Array(9).fill('size-m'),
  ...Array(7).fill('size-s'),
];

const isMobile = () => window.innerWidth <= 768;

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

// ===== brick =====
function buildBrick(item) {
  const a = document.createElement('a');
  a.className = `brick ${randomSize()}`;
  a.href = item.url;
  a.target = '_blank';
  a.rel = 'noopener';
  a.dataset.url = item.url;
  a.dataset.id = item.id;
  if (item.cluster_size != null) a.dataset.clusterSize = item.cluster_size;

  const isFav = window.Favorites.has(item.url);
  if (isFav) a.classList.add('favored');

  a.innerHTML = `
    <span class="brick-text">${highlightBias(item.title)}</span>
    <button class="fav-btn" type="button" aria-label="收藏">
      <svg viewBox="0 0 24 24"><path d="${HEART_PATH}" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"/></svg>
    </button>
  `;

  a.querySelector('.fav-btn').addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    const nowFav = window.Favorites.toggle({ id: item.id, url: item.url, title: item.title });
    document.querySelectorAll(`.brick[data-url="${CSS.escape(item.url)}"]`).forEach(el => {
      el.classList.toggle('favored', nowFav);
      const path = el.querySelector('.fav-btn svg path');
      if (path) path.setAttribute('fill', nowFav ? 'currentColor' : 'none');
    });
    updateFavCount();
  });

  // mobile long-press shows heart
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
    const dx = e.touches[0].clientX - startX, dy = e.touches[0].clientY - startY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearTimeout(pressTimer);
  }, { passive: true });
  a.addEventListener('touchend', () => {
    clearTimeout(pressTimer);
    if (a.classList.contains('show-fav')) {
      a.dataset.suppressClick = '1';
      setTimeout(() => a.classList.remove('show-fav'), 5000);
    }
  });

  a.addEventListener('click', e => {
    if (a.dataset.suppressClick === '1') {
      e.preventDefault(); a.dataset.suppressClick = '0'; return;
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    if (item.cluster_size && item.cluster_size > 1) openRadial(item);
    else window.openDrawer(item.id, item.url);
  });
  return a;
}

// ===== 聚寶盆 radial (cross-swap content) =====
let radialEl = null;
let radialState = null;  // {center, siblings, all (array of {id, url, title})}

function ensureRadial() {
  if (radialEl) return radialEl;
  radialEl = document.createElement('div');
  radialEl.className = 'radial';
  radialEl.hidden = true;
  radialEl.innerHTML = `
    <div class="radial-backdrop"></div>
    <div class="radial-hint">同事件其他來源 · 點任一標題與中央互換 · 點中央看摘要 · ESC 關閉</div>
    <button class="radial-close" type="button" aria-label="關閉">✕</button>
    <div class="radial-stage"><div class="radial-cluster"></div></div>
  `;
  document.body.appendChild(radialEl);
  radialEl.querySelector('.radial-backdrop').addEventListener('click', closeRadial);
  radialEl.querySelector('.radial-close').addEventListener('click', closeRadial);
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && !radialEl.hidden) closeRadial();
  });
  return radialEl;
}
function closeRadial() { if (radialEl) radialEl.hidden = true; radialState = null; }

function renderRadialNodes() {
  if (!radialState) return;
  const cluster = radialEl.querySelector('.radial-cluster');
  const { center, siblings } = radialState;
  const n = siblings.length;
  cluster.innerHTML = `
    <a class="radial-center" data-id="${center.id}" data-url="${escapeHTML(center.url)}">
      ${highlightBias(center.title)}
      <span class="radial-cue">點此看摘要</span>
    </a>
    ${siblings.map((s, i) => {
      const angle = -90 + (i * 360 / n);
      const delay = (0.05 + i * 0.06).toFixed(2);
      return `<a class="radial-sibling" data-idx="${i}"
                 style="--angle:${angle}deg;--delay:${delay}s">${highlightBias(s.title)}</a>`;
    }).join('')}
  `;
  // center → open drawer
  cluster.querySelector('.radial-center').addEventListener('click', e => {
    e.preventDefault(); e.stopPropagation();
    const c = radialState.center;
    closeRadial();
    window.openDrawer(c.id, c.url);
  });
  // sibling → swap with center
  cluster.querySelectorAll('.radial-sibling').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      const idx = parseInt(el.dataset.idx, 10);
      swapWithCenter(idx);
    });
  });
}

function swapWithCenter(sibIdx) {
  if (!radialState) return;
  const cluster = radialEl.querySelector('.radial-cluster');
  const centerEl = cluster.querySelector('.radial-center');
  const sibEl = cluster.querySelector(`.radial-sibling[data-idx="${sibIdx}"]`);
  if (!centerEl || !sibEl) return;

  // fade both, swap data, fade back — 聚寶盆 cross-swap
  centerEl.classList.add('swapping');
  sibEl.classList.add('swapping');

  setTimeout(() => {
    const oldCenter = radialState.center;
    const newCenter = radialState.siblings[sibIdx];
    radialState.center = newCenter;
    radialState.siblings[sibIdx] = oldCenter;

    centerEl.dataset.id = newCenter.id;
    centerEl.dataset.url = newCenter.url;
    centerEl.innerHTML = `${highlightBias(newCenter.title)}<span class="radial-cue">點此看摘要</span>`;
    sibEl.innerHTML = highlightBias(oldCenter.title);

    centerEl.classList.remove('swapping');
    sibEl.classList.remove('swapping');
  }, 250);
}

async function openRadial(item) {
  const el = ensureRadial();
  const cluster = el.querySelector('.radial-cluster');
  cluster.innerHTML = `<div class="radial-center radial-loading">載入中…</div>`;
  el.hidden = false;
  try {
    const r = await fetch(`/api/headline/${item.id}`);
    const { headline, siblings } = await r.json();
    if (!siblings || siblings.length === 0) {
      closeRadial();
      window.openDrawer(item.id, item.url);
      return;
    }
    radialState = {
      center: { id: headline.id, url: headline.url, title: headline.title },
      siblings: siblings.map(s => ({ id: s.id, url: s.url, title: s.title })),
    };
    renderRadialNodes();
  } catch {
    cluster.innerHTML = `<div class="radial-center">載入失敗</div>`;
    setTimeout(closeRadial, 1200);
  }
}

// ===== reshuffle font sizes when panel becomes active (desktop) =====
function reshuffleSizes(container) {
  container.querySelectorAll('.brick').forEach(b => {
    b.classList.remove('size-l', 'size-m', 'size-s');
    b.classList.add(randomSize());
  });
}

// ===== build category panel =====
function buildPage(cat) {
  const page = document.createElement('section');
  page.className = 'page';
  page.dataset.code = cat.code;

  page.innerHTML = `
    <div class="page-header">${escapeHTML(cat.name)}<span class="ph-count">今日 ${cat.total_today} 則</span></div>
    <div class="watermark">${escapeHTML(cat.name)}</div>
    <div class="watermark-meta">今日 ${cat.total_today} 則 · 顯示 ${cat.items.length}</div>
    <div class="brick-rail" data-code="${cat.code}"></div>
  `;
  const rail = page.querySelector('.brick-rail');
  const items = cat.items || [];
  if (items.length === 0) {
    rail.innerHTML = `<div style="grid-column:1/-1;grid-row:1/-1;display:flex;align-items:center;justify-content:center;color:var(--muted);font-family:var(--sans)">此類別尚無資料</div>`;
    return page;
  }
  for (const it of items) rail.appendChild(buildBrick(it));
  return page;
}

// ===== build cloud (tag cloud) panel =====
function buildCloudPage(cloudItems) {
  const page = document.createElement('section');
  page.className = 'page cloud-page';
  page.dataset.code = 'cloud';
  const counts = cloudItems.map(k => k.count);
  const maxC = counts.length ? Math.max(...counts) : 1;
  const minC = counts.length ? Math.min(...counts) : 1;
  const words = cloudItems.map(k => {
    const ratio = maxC === minC ? 1 : (k.count - minC) / (maxC - minC);
    const size = Math.round(15 + ratio * 56);
    const opacity = (0.55 + ratio * 0.45).toFixed(2);
    return `<span class="cloud-word" data-word="${escapeHTML(k.word)}"
                  style="font-size:${size}px;opacity:${opacity}">${escapeHTML(k.word)}<em class="cloud-count">${k.count}</em></span>`;
  }).join(' ');

  page.innerHTML = `
    <div class="watermark">熱門</div>
    <div class="watermark-meta">今日熱門關鍵字 · 點擊查看相關新聞</div>
    <div class="cloud-wrap">
      <div class="cloud-title">TODAY · TRENDING</div>
      <div class="cloud">${words || '<span style="color:var(--muted);font-family:var(--sans);font-size:14px">資料尚少，再多幾次抓取後產生</span>'}</div>
    </div>
  `;
  page.querySelectorAll('.cloud-word').forEach(el => {
    el.addEventListener('click', async () => {
      const word = el.dataset.word;
      try {
        const r = await fetch(`/api/keywords/headlines?word=${encodeURIComponent(word)}&limit=1`);
        const d = await r.json();
        if (d.items && d.items[0]) window.openDrawer(d.items[0].id, d.items[0].url);
      } catch {}
    });
  });
  return page;
}

function buildSideNav(items) {
  sideNavEl.innerHTML = `<ul>${items.map((c, i) => `
    <li data-i="${i}" data-count="${c.total_today ?? c.total ?? ''}">${escapeHTML(c.name)}</li>
  `).join('')}</ul>`;
  sideNavEl.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', () => {
      const i = parseInt(li.dataset.i, 10);
      const target = pagesEl.children[i];
      if (!target) return;
      if (isMobile()) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else pagesEl.scrollTo({ left: i * window.innerWidth, behavior: 'smooth' });
    });
  });
}

function setupObserver() {
  const opts = isMobile()
    ? { threshold: [0, 0.55] }
    : { root: pagesEl, threshold: [0, 0.55] };
  const obs = new IntersectionObserver(entries => {
    for (const e of entries) {
      const active = e.intersectionRatio > 0.55;
      e.target.classList.toggle('active', active);
      if (active) {
        const i = Array.from(pagesEl.children).indexOf(e.target);
        sideNavEl.querySelectorAll('li').forEach((b, j) => b.classList.toggle('active', j === i));
        if (!isMobile()) {
          const rail = e.target.querySelector('.brick-rail');
          if (rail) {
            if (rail.dataset.first) reshuffleSizes(rail);
            else rail.dataset.first = '1';
          }
        }
      }
    }
  }, opts);
  pagesEl.querySelectorAll('.page').forEach(p => obs.observe(p));
}

// ===== load =====
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
      // 標籤雲放在首位（桌機 = 左、手機 = 上）
      pagesEl.appendChild(buildCloudPage(cloud));
      for (const cat of cats) pagesEl.appendChild(buildPage(cat));

      const navItems = [
        { name: '熱門', total_today: cloud.length },
        ...cats.map(c => ({ name: c.name, total_today: c.total_today })),
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

// 鍵盤：← → 切換 panel（桌機）
window.addEventListener('keydown', e => {
  if (isMobile()) return;
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  const pages = Array.from(pagesEl.querySelectorAll('.page'));
  if (!pages.length) return;
  const current = Math.round(pagesEl.scrollLeft / window.innerWidth);
  let next = current;
  if (e.key === 'ArrowRight' || e.key === 'PageDown') next = Math.min(current + 1, pages.length - 1);
  else if (e.key === 'ArrowLeft' || e.key === 'PageUp') next = Math.max(current - 1, 0);
  else return;
  e.preventDefault();
  pagesEl.scrollTo({ left: next * window.innerWidth, behavior: 'smooth' });
});

// 桌機：轉直向滾輪 → 橫向 scroll；trackpad 橫向自然通過
let wheelAccum = 0;
let wheelRaf = null;
pagesEl.addEventListener('wheel', e => {
  if (isMobile()) return;
  // 若已有橫向 delta（trackpad swipe），直接通過
  if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
  if (Math.abs(e.deltaY) < 1) return;
  e.preventDefault();
  wheelAccum += e.deltaY * 1.4;
  if (!wheelRaf) {
    wheelRaf = requestAnimationFrame(() => {
      pagesEl.scrollLeft += wheelAccum;
      wheelAccum = 0; wheelRaf = null;
    });
  }
}, { passive: false });

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

let resizeTimer = null;
let lastIsMobile = isMobile();
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (isMobile() !== lastIsMobile) {
      lastIsMobile = isMobile();
      loadCategories();
    }
  }, 250);
});

// ===== top search (全站搜尋) =====
let searchTimer = null;
let searchAbort = null;
async function runTopSearch(q) {
  if (searchAbort) searchAbort.abort();
  searchAbort = new AbortController();
  try {
    const r = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=40`, { signal: searchAbort.signal });
    const { items = [] } = await r.json();
    if (items.length === 0) {
      topSearchResults.innerHTML = `<div class="top-search-empty">沒有符合「${escapeHTML(q)}」的標題</div>`;
    } else {
      topSearchResults.innerHTML = `
        <div class="top-search-count">找到 ${items.length} 則</div>
        ${items.map(it => `
          <div class="top-search-result" data-id="${it.id}" data-url="${escapeHTML(it.url)}">
            ${highlightBias(it.title)}
          </div>
        `).join('')}
      `;
      topSearchResults.querySelectorAll('.top-search-result').forEach(el => {
        el.addEventListener('click', () => {
          window.openDrawer(parseInt(el.dataset.id, 10), el.dataset.url);
          topSearchResults.hidden = true;
          topSearchInput.value = '';
        });
      });
    }
    topSearchResults.hidden = false;
  } catch (err) { if (err.name !== 'AbortError') console.error(err); }
}
topSearchInput.addEventListener('input', () => {
  const q = topSearchInput.value.trim();
  clearTimeout(searchTimer);
  if (!q) { topSearchResults.hidden = true; topSearchResults.innerHTML = ''; return; }
  topSearchResults.innerHTML = '<div class="top-search-empty">搜尋中…</div>';
  topSearchResults.hidden = false;
  searchTimer = setTimeout(() => runTopSearch(q), 180);
});
topSearchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') { topSearchInput.value = ''; topSearchResults.hidden = true; }
});
document.addEventListener('click', e => {
  if (!e.target.closest('.top-search')) topSearchResults.hidden = true;
});

updateFavCount();
loadCategories();
setInterval(loadCategories, 5 * 60 * 1000);
