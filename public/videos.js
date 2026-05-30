const vidSearch = document.getElementById('vidSearch');
const vidGrid = document.getElementById('vidGrid');
const vidMeta = document.getElementById('vidMeta');
const statusEl = document.getElementById('status');

const BIAS_WORDS = (window.BIAS_WORDS || []).slice().sort((a, b) => b.length - a.length);
const SOURCE = window.VIDEO_SOURCE_NAMES || {};

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function highlight(t) {
  let s = escapeHTML(t || '');
  for (const w of BIAS_WORDS) {
    if (!w) continue;
    s = s.replace(new RegExp(escapeRegExp(w), 'g'), `<span class="bias">${w}</span>`);
  }
  return s;
}

function videoIdOf(url) {
  if (!url) return null;
  const m = url.match(/[?&]v=([A-Za-z0-9_-]{6,})/)
         || url.match(/youtu\.be\/([A-Za-z0-9_-]{6,})/)
         || url.match(/\/(?:embed|shorts|live)\/([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : null;
}

function timeAgo(ms) {
  const diff = Date.now() - ms;
  const m = Math.floor(diff / 60000);
  if (m < 1) return '剛剛';
  if (m < 60) return `${m} 分鐘前`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} 小時前`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} 天前`;
  const dt = new Date(ms);
  return `${dt.getMonth()+1}/${dt.getDate()}`;
}

function render(items) {
  if (!items || items.length === 0) {
    vidGrid.innerHTML = '<div class="empty">沒有符合的影音</div>';
    return;
  }
  vidGrid.innerHTML = items.map(it => {
    const vid = videoIdOf(it.url);
    const thumb = vid ? `https://i.ytimg.com/vi/${vid}/hqdefault.jpg` : '';
    const sourceName = SOURCE[it.source] || it.source;
    return `
      <a class="vid-card" href="${escapeHTML(it.url)}" target="_blank" rel="noopener">
        <div class="vid-thumb">
          ${thumb ? `<img loading="lazy" src="${thumb}" alt="">` : '<div class="vid-thumb-fallback">▶</div>'}
          <span class="vid-play">▶</span>
        </div>
        <div class="vid-body">
          <h3 class="vid-title">${highlight(it.title)}</h3>
          <div class="vid-meta-row">
            <span class="vid-source">${escapeHTML(sourceName)}</span>
            <span class="vid-sep">·</span>
            <span>${timeAgo(it.published_at)}</span>
          </div>
        </div>
      </a>
    `;
  }).join('');
}

let searchTimer = null;
let searchAbort = null;
async function load(q = '') {
  if (searchAbort) searchAbort.abort();
  searchAbort = new AbortController();
  statusEl.textContent = '載入中…';
  try {
    const url = q
      ? `/api/videos?q=${encodeURIComponent(q)}&limit=120`
      : `/api/videos?limit=120`;
    const r = await fetch(url, { signal: searchAbort.signal });
    const { items = [] } = await r.json();
    vidMeta.textContent = q
      ? `搜尋「${q}」· ${items.length} 部影音`
      : `${items.length} 部影音 · 來源：YouTube 上各家新聞媒體（Google News 篩選）`;
    render(items);
    statusEl.textContent = '';
  } catch (err) {
    if (err.name !== 'AbortError') {
      statusEl.textContent = '載入失敗';
      vidGrid.innerHTML = `<div class="empty">無法載入：${escapeHTML(err.message || '')}</div>`;
    }
  }
}

vidSearch.addEventListener('input', () => {
  clearTimeout(searchTimer);
  const q = vidSearch.value.trim();
  searchTimer = setTimeout(() => load(q), 220);
});
vidSearch.addEventListener('keydown', e => {
  if (e.key === 'Escape') { vidSearch.value = ''; load(''); }
});

load();
setInterval(() => {
  if (!vidSearch.value.trim()) load();
}, 5 * 60 * 1000);
