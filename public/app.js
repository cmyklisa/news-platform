// 主頁：桌機橫向滑動 + 12 類別 + 標籤雲在首位 + 聚寶盆 radial + 全站搜尋
const pagesEl = document.getElementById('pages');
const sideNavEl = document.getElementById('topNav');
const statusEl = document.getElementById('status');
const refreshBtn = null; // 已移除按鈕，autorefresh 每 5 分鐘照跑

const BIAS_WORDS = (window.BIAS_WORDS || []).slice().sort((a, b) => b.length - a.length);
const SIZE_POOL = [
  ...Array(6).fill('size-l'),
  ...Array(9).fill('size-m'),
  ...Array(7).fill('size-s'),
];

// 標題隨機配色（柔和明亮、對比深底）
const TITLE_COLORS = [
  '#f7d970', '#ffd089', '#ffb084', '#ff9eab', '#ff8aa0',
  '#c89efc', '#9ec1ff', '#7ed7e6', '#8be3c2', '#b8e88a',
  '#e8d670', '#d4b27a', '#f0a060', '#ff8c8c', '#ed7eb4',
];
const pickTitleColor = () => TITLE_COLORS[Math.floor(Math.random() * TITLE_COLORS.length)];

const isMobile = () => window.innerWidth <= 768;
const ROWS_DESKTOP = 6;
// 動態 COPIES：item 多就少複製，item 少就多複製，確保磚牆夠長
function copyCount(itemCount) {
  if (isMobile()) return 1;
  if (itemCount >= 50) return 1;
  if (itemCount >= 20) return Math.ceil(50 / itemCount);
  return Math.max(3, Math.ceil(60 / Math.max(itemCount, 1)));
}

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
// 簡易 toast 通知
let toastTimer = null;
function showToast(msg) {
  let t = document.getElementById('appToast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'appToast';
    t.className = 'app-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

// ===== brick (改用 div + role=link，避免 <a> 內建 navigation 與 button 競態) =====
function buildBrick(item) {
  const a = document.createElement('div');
  a.className = `brick ${randomSize()}`;
  a.setAttribute('role', 'link');
  a.setAttribute('tabindex', '0');
  a.dataset.url = item.url;
  a.dataset.id = item.id;
  a.style.setProperty('--tcolor', pickTitleColor());
  if (item.cluster_size != null) a.dataset.clusterSize = item.cluster_size;

  a.innerHTML = `<span class="brick-text">${highlightBias(item.title)}</span>`;

  // brick 點擊：開抽屜或聚寶盆；cmd/ctrl-click 直開新分頁
  a.addEventListener('click', e => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) {
      window.open(item.url, '_blank', 'noopener');
      return;
    }
    if (item.cluster_size && item.cluster_size > 1) openRadial(item);
    else window.openDrawer(item.id, item.url);
  });
  // 鍵盤無障礙：Enter / Space 等同 click
  a.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (item.cluster_size && item.cluster_size > 1) openRadial(item);
      else window.openDrawer(item.id, item.url);
    }
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
    b.style.setProperty('--tcolor', pickTitleColor());
  });
}

// ===== 捲動時磚塊文字隨距離 rail 中心放大/縮小 =====
function attachScrollScale(rail) {
  let ticking = false;
  const update = () => {
    ticking = false;
    const rect = rail.getBoundingClientRect();
    const mob = isMobile();
    const center = mob ? rect.top + rect.height / 2 : rect.left + rect.width / 2;
    const half   = mob ? rect.height / 2 : rect.width / 2;
    const safe = Math.max(half * 0.85, 100);
    rail.querySelectorAll('.brick-text').forEach(t => {
      const br = t.getBoundingClientRect();
      const bc = mob ? br.top + br.height / 2 : br.left + br.width / 2;
      const d = Math.abs(bc - center);
      const ratio = Math.min(1, d / safe);
      // 中心 1.18 倍，邊緣 0.78 倍
      const scale = (1.18 - ratio * 0.4).toFixed(2);
      t.style.setProperty('--brick-scale', scale);
    });
  };
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };
  rail.addEventListener('scroll', onScroll, { passive: true });
  // 視窗大小變更時也要重算
  window.addEventListener('resize', onScroll);
  // 初始一次
  requestAnimationFrame(update);
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
    <div class="scroll-hint">↔ 橫向滑看更多　·　↓ 切換類別</div>
  `;
  const rail = page.querySelector('.brick-rail');
  const items = cat.items || [];
  if (items.length === 0) {
    rail.innerHTML = `<div style="margin:auto;color:var(--muted);font-family:var(--sans);padding:40px">此類別尚無資料</div>`;
    rail.style.alignItems = 'center';
    rail.style.justifyContent = 'center';
    return page;
  }

  if (isMobile()) {
    // 手機：垂直列表，一則一行，rail 內部上下捲動
    for (const it of items) rail.appendChild(buildBrick(it));
  } else {
    // 桌機：6 排磚牆，依 item 數量動態決定重複次數
    const copies = copyCount(items.length);
    const rowEls = [];
    for (let r = 0; r < ROWS_DESKTOP; r++) {
      const row = document.createElement('div');
      row.className = 'brick-row' + (r % 2 === 1 ? ' offset' : '');
      rail.appendChild(row);
      rowEls.push(row);
    }
    let idx = 0;
    for (let c = 0; c < copies; c++) {
      for (const it of items) {
        rowEls[idx % ROWS_DESKTOP].appendChild(buildBrick(it));
        idx++;
      }
    }
  }
  return page;
}

function buildSideNav(items) {
  sideNavEl.innerHTML = items.map((c, i) => `
    <button class="top-nav-item" data-i="${i}" data-code="${c.code || ''}"
            data-count="${c.total_today ?? c.total ?? ''}" type="button">
      <span class="tn-name">${escapeHTML(c.name)}</span>
      <span class="tn-count">${c.total_today ?? c.total ?? ''}</span>
    </button>
  `).join('');
  sideNavEl.querySelectorAll('.top-nav-item').forEach(b => {
    b.addEventListener('click', () => {
      const i = parseInt(b.dataset.i, 10);
      if (isMobile()) pagesEl.scrollTo({ left: i * window.innerWidth, behavior: 'smooth' });
      else pagesEl.scrollTo({ top: i * window.innerHeight, behavior: 'smooth' });
    });
  });
}

// 手機底部頁面指示器
let mobileDotsEl = null;
function ensureMobileDots(count) {
  if (!isMobile()) {
    if (mobileDotsEl) mobileDotsEl.remove();
    mobileDotsEl = null;
    return;
  }
  if (!mobileDotsEl) {
    mobileDotsEl = document.createElement('div');
    mobileDotsEl.className = 'mobile-page-dots';
    document.body.appendChild(mobileDotsEl);
  }
  mobileDotsEl.innerHTML = '';
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('span');
    if (i === 0) dot.classList.add('active');
    mobileDotsEl.appendChild(dot);
  }
}

function setupObserver() {
  const obs = new IntersectionObserver(entries => {
    for (const e of entries) {
      const active = e.intersectionRatio > 0.55;
      e.target.classList.toggle('active', active);
      if (active) {
        const i = Array.from(pagesEl.children).indexOf(e.target);
        sideNavEl.querySelectorAll('.top-nav-item').forEach((b, j) => {
          const isActive = j === i;
          b.classList.toggle('active', isActive);
          if (isActive) {
            // 自動水平捲到 active 的位置
            b.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
          }
        });
        if (mobileDotsEl) {
          mobileDotsEl.querySelectorAll('span').forEach((d, j) => d.classList.toggle('active', j === i));
        }
        const rail = e.target.querySelector('.brick-rail');
        if (rail) {
          if (!isMobile()) {
            if (rail.dataset.first) reshuffleSizes(rail);
            else rail.dataset.first = '1';
          }
          // 確保 active 時尺度有更新
          rail.dispatchEvent(new Event('scroll'));
        }
      }
    }
  }, { root: pagesEl, threshold: [0, 0.55] });
  pagesEl.querySelectorAll('.page').forEach(p => obs.observe(p));
  // 為每個 rail 掛上 scroll-scale 監聽
  pagesEl.querySelectorAll('.brick-rail').forEach(attachScrollScale);
}

// ===== load =====
function loadCategories() {
  statusEl.textContent = '載入中…';
  fetch('/api/categories?limit=300')
    .then(r => r.json())
    .then(data => {
      const cats = data.categories || [];
      pagesEl.innerHTML = '';
      for (const cat of cats) pagesEl.appendChild(buildPage(cat));
      buildSideNav(cats);
      requestAnimationFrame(() => {
        const first = pagesEl.querySelector('.page');
        if (first) first.classList.add('active');
        sideNavEl.querySelector('.top-nav-item')?.classList.add('active');
        ensureMobileDots(cats.length);
        setupObserver();
      });
      statusEl.textContent = `更新於 ${formatTime(Date.now())}`;
    })
    .catch(err => { statusEl.textContent = '載入失敗'; console.error(err); });
}

// 重整按鈕已移除；setInterval(loadCategories, ...) 每 5 分鐘自動更新

// 鍵盤：桌機 ↑↓ 切類別、手機 ←→ 翻頁
window.addEventListener('keydown', e => {
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
  const pages = Array.from(pagesEl.querySelectorAll('.page'));
  if (!pages.length) return;
  const mobile = isMobile();
  const w = window.innerWidth;
  const h = window.innerHeight;
  const current = mobile
    ? Math.round(pagesEl.scrollLeft / w)
    : Math.round(pagesEl.scrollTop / h);
  let next = current;
  if (mobile) {
    if (e.key === 'ArrowRight' || e.key === 'PageDown') next = Math.min(current + 1, pages.length - 1);
    else if (e.key === 'ArrowLeft'  || e.key === 'PageUp')   next = Math.max(current - 1, 0);
    else return;
  } else {
    if (e.key === 'ArrowDown' || e.key === 'PageDown') next = Math.min(current + 1, pages.length - 1);
    else if (e.key === 'ArrowUp'   || e.key === 'PageUp')   next = Math.max(current - 1, 0);
    else return;
  }
  e.preventDefault();
  if (mobile) pagesEl.scrollTo({ left: next * w, behavior: 'smooth' });
  else        pagesEl.scrollTo({ top:  next * h, behavior: 'smooth' });
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

loadCategories();
setInterval(loadCategories, 5 * 60 * 1000);
