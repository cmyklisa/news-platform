// 我的最愛頁：全螢幕報紙
const clippingsEl = document.getElementById('clippings');
const paperDateEl = document.getElementById('paperDate');
const paperCountEl = document.getElementById('paperCount');
const paperTitleH1 = document.getElementById('paperTitleH1');
const issueNumEl = document.getElementById('issueNum');

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

// ===== clippings =====
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

// 把 favs 依儲存日期分群 -> [[dateKey, [favs]], ...] 由新到舊
function groupFavsByDate(favs) {
  const groups = new Map();
  for (const f of favs) {
    const d = new Date(f.savedAt);
    const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  return [...groups.entries()].sort((a, b) => b[0].localeCompare(a[0]));
}

function issueNumberFor(date) {
  return Math.floor((date.getTime() - ISSUE_BASE) / 86400000) + 1;
}

function weekdayCh(d) {
  return ['日','一','二','三','四','五','六'][d.getDay()];
}

function clipsHtml(favs, fullMap) {
  return favs.map((fav, i) => {
    const full = fullMap.get(fav.id);
    const title = (full && full.title) || fav.title;
    const tier = tierForIndex(i);
    return `
      <article class="clip ${tier}" data-url="${escapeHTML(fav.url)}" data-id="${full ? full.id : ''}">
        <h2 class="clip-title">${window.highlightBiasText(title)}</h2>
        <button class="clip-rm" type="button" aria-label="取消收藏">×</button>
      </article>
    `;
  }).join('');
}

async function renderClippings() {
  const favs = window.Favorites.list();
  paperCountEl.textContent = `${favs.length} 則剪報`;
  paperDateEl.textContent = formatPaperDate();

  if (favs.length === 0) {
    clippingsEl.innerHTML = `
      <div class="paper-empty">
        <strong>本期報紙還沒有剪報</strong>
        回首頁，把滑鼠移到任何標題、點愛心即可收藏到這份報紙。
      </div>`;
    return;
  }

  const fullMap = await loadFullHeadlines(favs);
  const grouped = groupFavsByDate(favs);
  const todayKey = new Date().toISOString().slice(0, 10);

  let html = '';
  grouped.forEach(([dateKey, items], idx) => {
    if (idx === 0 && dateKey === todayKey) {
      // 今天直接用主報頭（已經渲染在 masthead），這裡只放 clippings
      html += `<div class="issue-clippings">${clipsHtml(items, fullMap)}</div>`;
    } else {
      const [y, m, d] = dateKey.split('-').map(Number);
      const dt = new Date(y, m - 1, d);
      const issueN = issueNumberFor(dt);
      html += `
        <section class="past-issue">
          <header class="past-masthead">
            <div class="masthead-rule double"></div>
            <div class="past-meta">
              <span class="past-title-l">第 ${issueN.toLocaleString('en-US')} 期</span>
              <span class="past-date">${y} 年 ${m} 月 ${d} 日　星期${weekdayCh(dt)}</span>
              <span class="past-count">${items.length} 則剪報</span>
            </div>
            <div class="masthead-rule"></div>
          </header>
          <div class="issue-clippings">${clipsHtml(items, fullMap)}</div>
        </section>
      `;
    }
  });
  if (grouped.length > 1) {
    html += `<div class="paper-end">— 本報所有歷史 —</div>`;
  }

  clippingsEl.innerHTML = html;

  clippingsEl.querySelectorAll('.clip').forEach(card => {
    const url = card.dataset.url;
    const id = parseInt(card.dataset.id, 10);
    card.addEventListener('click', e => {
      if (e.target.closest('.clip-rm')) return;
      if (id) window.openDrawer(id, url);
      else window.open(url, '_blank', 'noopener');
    });
    card.querySelector('.clip-rm').addEventListener('click', e => {
      e.stopPropagation();
      window.Favorites.remove(url);
      renderClippings();
    });
  });
}

// ===== 主播語音泡泡：循環顯示今日新聞標題 =====
const anchorBubble = document.getElementById('anchorBubble');
let anchorPool = [];
let anchorIdx = 0;
let anchorTimer = null;

function cycleAnchor() {
  if (!anchorPool.length || !anchorBubble) return;
  const item = anchorPool[anchorIdx % anchorPool.length];
  anchorBubble.innerHTML = window.highlightBiasText(item.title);
  anchorBubble.classList.add('show');
  anchorIdx++;
  clearTimeout(anchorTimer);
  anchorTimer = setTimeout(() => {
    anchorBubble.classList.remove('show');
    setTimeout(cycleAnchor, 600);
  }, 5400);
}

function loadAnchorPool() {
  fetch('/api/categories?limit=15')
    .then(r => r.json())
    .then(data => {
      const titles = [];
      for (const c of data.categories || []) {
        for (const it of c.items || []) titles.push({ title: it.title });
      }
      // 洗牌
      for (let i = titles.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [titles[i], titles[j]] = [titles[j], titles[i]];
      }
      anchorPool = titles.slice(0, 40);
      if (anchorPool.length) cycleAnchor();
    })
    .catch(() => {});
}
loadAnchorPool();
setInterval(loadAnchorPool, 10 * 60 * 1000);

// ===== search (今日所有標題) =====
const paperSearch = document.getElementById('paperSearch');
const paperSearchResults = document.getElementById('paperSearchResults');
let searchTimer = null;
let searchAbort = null;
async function runSearch(q) {
  if (searchAbort) searchAbort.abort();
  searchAbort = new AbortController();
  try {
    const r = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=80`, { signal: searchAbort.signal });
    const { items = [] } = await r.json();
    if (items.length === 0) {
      paperSearchResults.innerHTML = `<div class="paper-search-empty">沒有符合「${escapeHTML(q)}」的標題</div>`;
    } else {
      paperSearchResults.innerHTML = `
        <div class="paper-search-count">找到 ${items.length} 則</div>
        ${items.map(it => `
          <div class="paper-search-result" data-id="${it.id}" data-url="${escapeHTML(it.url)}">
            ${window.highlightBiasText(it.title)}
          </div>
        `).join('')}
      `;
      paperSearchResults.querySelectorAll('.paper-search-result').forEach(el => {
        el.addEventListener('click', () => {
          window.openDrawer(parseInt(el.dataset.id, 10), el.dataset.url);
          paperSearchResults.hidden = true;
          paperSearch.value = '';
        });
      });
    }
    paperSearchResults.hidden = false;
  } catch (err) { if (err.name !== 'AbortError') console.error(err); }
}
paperSearch.addEventListener('input', () => {
  const q = paperSearch.value.trim();
  clearTimeout(searchTimer);
  if (!q) { paperSearchResults.hidden = true; paperSearchResults.innerHTML = ''; return; }
  paperSearchResults.innerHTML = '<div class="paper-search-empty">搜尋中…</div>';
  paperSearchResults.hidden = false;
  searchTimer = setTimeout(() => runSearch(q), 180);
});
paperSearch.addEventListener('keydown', e => {
  if (e.key === 'Escape') { paperSearch.value = ''; paperSearchResults.hidden = true; }
});
document.addEventListener('click', e => {
  if (!e.target.closest('.paper-search')) paperSearchResults.hidden = true;
});

window.addEventListener('favorites:changed', renderClippings);
window.addEventListener('storage', e => {
  if (e.key === 'tw-news-favorites') renderClippings();
});

renderClippings();
