// 我的最愛頁：左欄熱門關鍵字 (TOP 20) + 右欄報紙質感剪報
const layout = document.getElementById('favLayout');
const trendingEl = document.getElementById('trending');
const trendDateEl = document.getElementById('trendDate');
const trendToggle = document.getElementById('trendToggle');
const trendExpand = document.getElementById('trendExpand');

const clippingsEl = document.getElementById('clippings');
const paperDateEl = document.getElementById('paperDate');
const paperCountEl = document.getElementById('paperCount');
const paperTitleH1 = document.getElementById('paperTitleH1');
const issueNumEl = document.getElementById('issueNum');

const COLLAPSE_KEY = 'tw-news-trend-collapsed';
const TITLE_KEY = 'tw-news-paper-title';
const ISSUE_BASE = new Date('2024-01-01T00:00:00+08:00').getTime();

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function formatPaperDate(d = new Date()) {
  const weekdays = ['日','一','二','三','四','五','六'];
  return `${d.getFullYear()} 年 ${d.getMonth() + 1} 月 ${d.getDate()} 日　星期${weekdays[d.getDay()]}`;
}

function formatSaved(ms) {
  const d = new Date(ms);
  const today = new Date();
  const sameDay = d.toDateString() === today.toDateString();
  const p = n => String(n).padStart(2, '0');
  return sameDay
    ? `今日 ${p(d.getHours())}:${p(d.getMinutes())}`
    : `${d.getMonth() + 1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function firstTwoSentences(text) {
  if (!text) return '';
  const t = text.replace(/\s+/g, ' ').trim();
  const parts = t.split(/(?<=[。！？!?])\s*/);
  const out = parts.slice(0, 2).join('').trim();
  return out || t.slice(0, 90) + (t.length > 90 ? '…' : '');
}

// ===== editable paper title =====
const savedTitle = localStorage.getItem(TITLE_KEY);
if (savedTitle) paperTitleH1.textContent = savedTitle;
paperTitleH1.addEventListener('input', () => {
  const t = paperTitleH1.textContent.trim();
  localStorage.setItem(TITLE_KEY, t || '我的每日情報');
});
paperTitleH1.addEventListener('blur', () => {
  if (!paperTitleH1.textContent.trim()) paperTitleH1.textContent = '我的每日情報';
});
paperTitleH1.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); paperTitleH1.blur(); }
});

// ===== issue number =====
function refreshIssueNum() {
  const days = Math.floor((Date.now() - ISSUE_BASE) / 86400000) + 1;
  issueNumEl.textContent = days.toLocaleString('en-US');
}
refreshIssueNum();

// ===== 熱門關鍵字 =====
async function expandKeyword(li, word) {
  if (li.classList.contains('expanded')) {
    li.classList.remove('expanded');
    const box = li.querySelector('.kw-headlines');
    if (box) box.remove();
    return;
  }
  // collapse others
  trendingEl.querySelectorAll('.kw-item.expanded').forEach(other => {
    other.classList.remove('expanded');
    const b = other.querySelector('.kw-headlines');
    if (b) b.remove();
  });

  li.classList.add('expanded');
  const box = document.createElement('div');
  box.className = 'kw-headlines';
  box.innerHTML = '<div class="kw-headlines-loading">載入中…</div>';
  li.appendChild(box);

  try {
    const r = await fetch(`/api/keywords/headlines?word=${encodeURIComponent(word)}&limit=80`);
    const data = await r.json();
    const items = data.items || [];
    if (items.length === 0) {
      box.innerHTML = '<div class="kw-headlines-loading">尚無標題</div>';
      return;
    }
    box.innerHTML = items.map(it => `
      <div class="kw-headline" data-id="${it.id}" data-url="${escapeHTML(it.url)}">
        ${window.highlightBiasText(it.title)}
      </div>
    `).join('') + `<div class="kw-headlines-foot">共 ${items.length} 則含「${escapeHTML(word)}」</div>`;
    box.querySelectorAll('.kw-headline').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        window.openDrawer(parseInt(el.dataset.id, 10), el.dataset.url);
      });
    });
  } catch (err) {
    box.innerHTML = '<div class="kw-headlines-loading">載入失敗</div>';
  }
}

function buildKeywordItem(it, rank) {
  const li = document.createElement('li');
  li.className = 'kw-item' + (rank < 3 ? ' top' : '');
  li.innerHTML = `
    <span class="kw-rank">${rank + 1}</span>
    <span class="kw-word">${escapeHTML(it.word)}</span>
    <span class="kw-count">${it.count}</span>
  `;
  li.addEventListener('click', () => expandKeyword(li, it.word));
  return li;
}

function loadKeywords() {
  fetch('/api/keywords?limit=20')
    .then(r => r.json())
    .then(data => {
      const items = data.items || [];
      trendDateEl.textContent = `TOP ${items.length}`;
      if (items.length === 0) {
        trendingEl.innerHTML = '<li style="color:var(--muted);padding:24px;text-align:center;list-style:none">資料尚少，再多幾次抓取後產生</li>';
        return;
      }
      trendingEl.innerHTML = '';
      items.forEach((it, i) => trendingEl.appendChild(buildKeywordItem(it, i)));
    })
    .catch(err => console.error('keywords failed', err));
}

// ===== collapsible left column =====
function applyCollapsed(state) {
  layout.classList.toggle('trend-collapsed', state);
  trendToggle.textContent = state ? '›' : '‹';
  trendToggle.title = state ? '展開' : '收合';
  trendExpand.hidden = !state;
  localStorage.setItem(COLLAPSE_KEY, state ? '1' : '0');
}
trendToggle.addEventListener('click', () => {
  applyCollapsed(!layout.classList.contains('trend-collapsed'));
});
trendExpand.addEventListener('click', () => applyCollapsed(false));
applyCollapsed(localStorage.getItem(COLLAPSE_KEY) === '1');

// ===== newspaper clippings =====
function tierForIndex(i) {
  if (i === 0) return 'lead';
  if (i <= 2) return 'feature';
  if (i <= 6) return 'brief';
  return 'short';
}

async function loadFullHeadlines(favs) {
  if (favs.length === 0) return new Map();
  const ids = favs.map(f => f.id).filter(Boolean);
  if (ids.length === 0) return new Map();
  try {
    const r = await fetch(`/api/headlines/batch?ids=${ids.join(',')}`);
    const { headlines } = await r.json();
    const map = new Map();
    for (const h of headlines || []) map.set(h.id, h);
    return map;
  } catch (e) { return new Map(); }
}

async function renderClippings() {
  const favs = window.Favorites.list();
  paperCountEl.textContent = `${favs.length} 則剪報`;
  paperDateEl.textContent = formatPaperDate();

  if (favs.length === 0) {
    clippingsEl.innerHTML = `
      <div class="paper-empty">
        <strong>本期報紙還沒有剪報</strong>
        回首頁滑動軸，把滑鼠移到任何標題、點愛心即可收藏到這份報紙。
      </div>`;
    return;
  }

  const fullMap = await loadFullHeadlines(favs);

  clippingsEl.innerHTML = favs.map((fav, i) => {
    const full = fullMap.get(fav.id);
    const title = (full && full.title) || fav.title;
    const summaryRaw = full && full.summary ? full.summary : '';
    const summary = summaryRaw ? firstTwoSentences(summaryRaw) : '';
    const source = full && full.source ? window.sourceName(full.source) : '';
    const published = full && full.published_at ? full.published_at : null;
    const tier = tierForIndex(i);

    return `
      <article class="clip ${tier}" data-url="${escapeHTML(fav.url)}" data-id="${full ? full.id : ''}">
        <h2 class="clip-title">${window.highlightBiasText(title)}</h2>
        ${summary ? `<p class="clip-deck">${window.highlightBiasText(summary)}</p>` : ''}
        <div class="clip-byline">
          ${source ? `<span class="src">${escapeHTML(source)}</span><span class="sep">·</span>` : ''}
          ${published ? `<span>${window.formatFullTime(published)}</span><span class="sep">·</span>` : ''}
          <span>收藏於 ${formatSaved(fav.savedAt)}</span>
          <button class="rm" type="button">取消收藏</button>
        </div>
      </article>
    `;
  }).join('');

  clippingsEl.querySelectorAll('.clip').forEach(card => {
    const url = card.dataset.url;
    const id = parseInt(card.dataset.id, 10);
    card.addEventListener('click', e => {
      if (e.target.closest('.rm')) return;
      if (id) window.openDrawer(id, url);
      else window.open(url, '_blank', 'noopener');
    });
    card.querySelector('.rm').addEventListener('click', e => {
      e.stopPropagation();
      window.Favorites.remove(url);
      renderClippings();
    });
  });
}

// ===== search =====
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const trendingList = document.getElementById('trending');
const trendColHead = document.getElementById('trendColHead');
const trendColTitle = document.getElementById('trendColTitle');
let searchTimer = null;
let searchAbort = null;

function runSearch(q) {
  if (searchAbort) searchAbort.abort();
  searchAbort = new AbortController();
  fetch(`/api/search?q=${encodeURIComponent(q)}&limit=100`, { signal: searchAbort.signal })
    .then(r => r.json())
    .then(data => {
      const items = data.items || [];
      if (items.length === 0) {
        searchResults.innerHTML = `<div class="search-empty">沒有符合「${escapeHTML(q)}」的標題</div>`;
        return;
      }
      searchResults.innerHTML = `
        <div class="search-count">找到 ${items.length} 則含「${escapeHTML(q)}」的標題</div>
        ${items.map(it => `
          <div class="search-result" data-id="${it.id}" data-url="${escapeHTML(it.url)}">
            ${window.highlightBiasText(it.title)}
          </div>
        `).join('')}
      `;
      searchResults.querySelectorAll('.search-result').forEach(el => {
        el.addEventListener('click', () => {
          window.openDrawer(parseInt(el.dataset.id, 10), el.dataset.url);
        });
      });
    })
    .catch(err => { if (err.name !== 'AbortError') console.error(err); });
}

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  clearTimeout(searchTimer);
  if (!q) {
    searchResults.hidden = true;
    searchResults.innerHTML = '';
    trendingList.hidden = false;
    trendColTitle.innerHTML = '今日熱門關鍵字 <span class="count" id="trendDate">' +
      (document.getElementById('trendDate')?.textContent || '') + '</span>';
    return;
  }
  trendingList.hidden = true;
  searchResults.hidden = false;
  trendColTitle.innerHTML = `搜尋結果 <span class="count">「${escapeHTML(q)}」</span>`;
  searchResults.innerHTML = '<div class="search-empty">搜尋中…</div>';
  searchTimer = setTimeout(() => runSearch(q), 180);
});
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Escape') { searchInput.value = ''; searchInput.dispatchEvent(new Event('input')); }
});

window.addEventListener('favorites:changed', renderClippings);
window.addEventListener('storage', e => {
  if (e.key === 'tw-news-favorites') renderClippings();
});

renderClippings();
loadKeywords();
