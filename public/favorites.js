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

window.addEventListener('favorites:changed', renderClippings);
window.addEventListener('storage', e => {
  if (e.key === 'tw-news-favorites') renderClippings();
});

renderClippings();
