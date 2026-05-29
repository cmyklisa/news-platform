// 主頁：12 類別、磁磚牆、點擊放射展開、全站搜尋、點擊音效、RWD
const pagesEl = document.getElementById('pages');
const sideNavEl = document.getElementById('sideNav');
const statusEl = document.getElementById('status');
const favCountEl = document.getElementById('favCount');
const refreshBtn = document.getElementById('refreshBtn');
const soundToggle = document.getElementById('soundToggle');
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
const rowCount = () => (isMobile() ? 1 : 6);
const copyCount = () => (isMobile() ? 1 : 6);

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

// ===== Click sound (Web Audio API) =====
const SOUND_KEY = 'tw-news-sound-on';
let soundOn = localStorage.getItem(SOUND_KEY) !== '0';
let audioCtx = null;
function applySoundUI() {
  soundToggle.textContent = soundOn ? '🔊' : '🔇';
  soundToggle.classList.toggle('muted', !soundOn);
  soundToggle.title = soundOn ? '點擊音效：開' : '點擊音效：關';
}
soundToggle.addEventListener('click', () => {
  soundOn = !soundOn;
  localStorage.setItem(SOUND_KEY, soundOn ? '1' : '0');
  applySoundUI();
  if (soundOn) playClick(); // 開啟時試播一下
});
applySoundUI();

function playClick() {
  if (!soundOn) return;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(2200, t);
    osc.frequency.exponentialRampToValueAtTime(700, t + 0.05);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.07, t + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(t);
    osc.stop(t + 0.1);
  } catch (e) { /* ignore */ }
}

// ===== brick =====
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

  // touch long-press shows fav
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

  a.addEventListener('click', e => {
    if (a.dataset.suppressClick === '1') {
      e.preventDefault(); a.dataset.suppressClick = '0'; return;
    }
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
    e.preventDefault();
    playClick();
    if (item.cluster_size && item.cluster_size > 1) openRadial(item);
    else window.openDrawer(item.id, item.url);
  });
  return a;
}

// ===== Radial =====
let radialEl = null;
function ensureRadial() {
  if (radialEl) return radialEl;
  radialEl = document.createElement('div');
  radialEl.className = 'radial';
  radialEl.hidden = true;
  radialEl.innerHTML = `
    <div class="radial-backdrop"></div>
    <div class="radial-hint">同事件其他來源 · 點選任一標題看摘要 · ESC 關閉</div>
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
function closeRadial() { if (radialEl) radialEl.hidden = true; }
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
    const n = siblings.length;
    const sibsHtml = siblings.map((s, i) => {
      const angle = -90 + (i * 360 / n);
      const delay = (0.06 + i * 0.07).toFixed(2);
      return `<a class="radial-sibling" data-id="${s.id}" data-url="${escapeHTML(s.url)}"
                 style="--angle:${angle}deg;--delay:${delay}s">${highlightBias(s.title)}</a>`;
    }).join('');
    cluster.innerHTML = `
      <a class="radial-center" data-id="${headline.id}" data-url="${escapeHTML(headline.url)}">
        ${highlightBias(headline.title)}
      </a>
      ${sibsHtml}
    `;
    cluster.querySelectorAll('.radial-center, .radial-sibling').forEach(node => {
      node.addEventListener('click', e => {
        e.preventDefault(); e.stopPropagation();
        playClick();
        const id = parseInt(node.dataset.id, 10);
        const url = node.dataset.url;
        closeRadial();
        window.openDrawer(id, url);
      });
    });
  } catch (err) {
    cluster.innerHTML = `<div class="radial-center">載入失敗</div>`;
    setTimeout(closeRadial, 1200);
  }
}

// ===== reshuffle font sizes (re-enter page on desktop) =====
function reshuffleSizes(container) {
  container.querySelectorAll('.brick').forEach(b => {
    b.classList.remove('size-l', 'size-m', 'size-s');
    b.classList.add(randomSize());
  });
}

// ===== build page =====
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
    rail.style.display = 'flex';
    rail.style.alignItems = 'center';
    rail.style.justifyContent = 'center';
    return page;
  }

  const rows = rowCount();
  const copies = copyCount();
  const rowEls = [];
  for (let r = 0; r < rows; r++) {
    const row = document.createElement('div');
    row.className = 'brick-row' + (r % 2 === 1 ? ' offset' : '');
    rail.appendChild(row);
    rowEls.push(row);
  }
  let idx = 0;
  for (let copy = 0; copy < copies; copy++) {
    for (const it of items) {
      rowEls[idx % rows].appendChild(buildBrick(it));
      idx++;
    }
  }
  return page;
}

function buildSideNav(items) {
  sideNavEl.innerHTML = `<ul>${items.map((c, i) => `
    <li data-i="${i}" data-count="${c.total_today ?? ''}">${escapeHTML(c.name)}</li>
  `).join('')}</ul>`;
  sideNavEl.querySelectorAll('li').forEach(li => {
    li.addEventListener('click', () => {
      const i = parseInt(li.dataset.i, 10);
      pagesEl.scrollTo({ top: i * window.innerHeight, behavior: 'smooth' });
    });
  });
}

function setupObserver() {
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
  }, { root: isMobile() ? null : pagesEl, threshold: [0, 0.55] });
  pagesEl.querySelectorAll('.page').forEach(p => obs.observe(p));
}

function loadCategories() {
  statusEl.textContent = '載入中…';
  fetch('/api/categories?limit=80')
    .then(r => r.json())
    .then(data => {
      const cats = data.categories || [];
      pagesEl.innerHTML = '';
      for (const cat of cats) pagesEl.appendChild(buildPage(cat));
      buildSideNav(cats);
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

window.addEventListener('keydown', e => {
  if (isMobile()) return;
  if (document.activeElement && document.activeElement.tagName === 'INPUT') return;
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
          playClick();
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
  if (e.key === 'Escape') {
    topSearchInput.value = ''; topSearchResults.hidden = true;
  }
});
document.addEventListener('click', e => {
  if (!e.target.closest('.top-search')) topSearchResults.hidden = true;
});

updateFavCount();
loadCategories();
setInterval(loadCategories, 5 * 60 * 1000);
