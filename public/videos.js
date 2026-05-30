const vidSearch = document.getElementById('vidSearch');
const vidGrid = document.getElementById('vidGrid');
const vidMeta = document.getElementById('vidMeta');
const statusEl = document.getElementById('status');

const BIAS_WORDS = (window.BIAS_WORDS || []).slice().sort((a, b) => b.length - a.length);

// 已知台灣新聞 YouTube 頻道，給對應品牌色
const CHANNEL_INFO = [
  { match: /TVBS|TVBSNEWS/i,           name: 'TVBS 新聞',  color: '#003a87' },
  { match: /公視|PTSNEWS|ptsnews/i,    name: '公視新聞網', color: '#0f6b8b' },
  { match: /民視|FTV|FTVNEWS/i,        name: '民視新聞',   color: '#c41e3a' },
  { match: /三立|SETN|SET News|setnews|setn/i, name: '三立新聞', color: '#0d9a3a' },
  { match: /中央社|CNA/i,              name: '中央社 CNA', color: '#5a4f40' },
  { match: /鏡新聞|MirrorMedia/i,      name: '鏡新聞',     color: '#1a1a1a' },
  { match: /東森|EBC/i,                name: '東森新聞',   color: '#e88800' },
  { match: /中視|CTV/i,                name: '中視新聞',   color: '#1b6cb5' },
  { match: /台視|TTV/i,                name: '台視新聞',   color: '#bd1d24' },
  { match: /中天/i,                    name: '中天新聞',   color: '#9b1b1b' },
  { match: /年代/i,                    name: '年代新聞',   color: '#6b3aa6' },
  { match: /八大/i,                    name: '八大新聞',   color: '#2a8a99' },
];
const DEFAULT_CHANNEL = { name: 'YouTube 新聞', color: '#cc0000' };

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

function cleanTitle(title) {
  return (title || '')
    .replace(/\s*[-–—]\s*YouTube\s*$/i, '')
    .replace(/\s*@[A-Za-z0-9_]+\s*$/, '')
    .replace(/\s*\|\s*[^|]+?\s*$/, m => m.length < 18 ? m : '')  // strip trailing |媒體名 if short
    .trim();
}

function detectChannel(title) {
  for (const ch of CHANNEL_INFO) {
    if (ch.match.test(title)) return ch;
  }
  return DEFAULT_CHANNEL;
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
    const ch = detectChannel(it.title || '');
    const cleaned = cleanTitle(it.title);
    return `
      <a class="vid-card" href="${escapeHTML(it.url)}" target="_blank" rel="noopener"
         style="--ch-color:${ch.color}">
        <div class="vid-poster">
          <div class="vid-poster-bg"></div>
          <div class="vid-channel-badge">${escapeHTML(ch.name)}</div>
          <div class="vid-play-big">▶</div>
          <div class="vid-corner">YouTube · 點開觀看</div>
        </div>
        <div class="vid-body">
          <h3 class="vid-title">${highlight(cleaned)}</h3>
          <div class="vid-meta-row">
            <span class="vid-time">${timeAgo(it.published_at)}</span>
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
      : `${items.length} 部影音 · 點任一卡片在 YouTube 觀看`;
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
setInterval(() => { if (!vidSearch.value.trim()) load(); }, 5 * 60 * 1000);
