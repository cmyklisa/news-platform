const tabsEl = document.getElementById('regionTabs');
const listEl = document.getElementById('weatherList');
const statusEl = document.getElementById('status');

const REGION_KEY = 'tw-news-weather-region';
let currentRegion = localStorage.getItem(REGION_KEY) || 'all';

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function formatTime(ms) {
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  return `${d.getMonth()+1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

function renderTabs(available) {
  tabsEl.innerHTML = available.map(r => `
    <button data-region="${r.code}" class="region-tab ${r.code === currentRegion ? 'active' : ''}">
      ${escapeHTML(r.label)}
    </button>
  `).join('');
  tabsEl.querySelectorAll('.region-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      currentRegion = btn.dataset.region;
      localStorage.setItem(REGION_KEY, currentRegion);
      tabsEl.querySelectorAll('.region-tab').forEach(b =>
        b.classList.toggle('active', b.dataset.region === currentRegion));
      load();
    });
  });
}

function renderList(data) {
  const items = data.items || [];
  if (items.length === 0) {
    listEl.innerHTML = `<div class="empty">${escapeHTML(data.region_label || '')}今日尚無天氣相關新聞</div>`;
    return;
  }
  listEl.innerHTML = items.map(it => {
    const sourceName = (window.SOURCE_NAMES && window.SOURCE_NAMES[it.source]) || it.source;
    return `
      <article class="weather-card" data-id="${it.id}" data-url="${escapeHTML(it.url)}">
        <h2 class="weather-title">${window.highlightBiasText(it.title)}</h2>
        ${it.summary ? `<p class="weather-summary">${window.highlightBiasText(it.summary.slice(0, 160))}${it.summary.length > 160 ? '…' : ''}</p>` : ''}
        <div class="weather-meta">
          <span class="weather-source">${escapeHTML(sourceName)}</span>
          <span>·</span>
          <span>${formatTime(it.published_at)}</span>
        </div>
      </article>
    `;
  }).join('');
  listEl.querySelectorAll('.weather-card').forEach(card => {
    card.addEventListener('click', () => {
      window.openDrawer(parseInt(card.dataset.id, 10), card.dataset.url);
    });
  });
}

function load() {
  statusEl.textContent = '載入中…';
  fetch(`/api/weather?region=${encodeURIComponent(currentRegion)}&limit=80`)
    .then(r => r.json())
    .then(data => {
      renderTabs(data.available_regions || [{ code: 'all', label: '全台' }]);
      renderList(data);
      statusEl.textContent = `${data.region_label || ''} · ${(data.items || []).length} 則 · ${data.date}`;
    })
    .catch(err => {
      statusEl.textContent = '載入失敗';
      listEl.innerHTML = `<div class="empty">無法載入天氣資料：${escapeHTML(err.message || '')}</div>`;
    });
}

load();
setInterval(load, 5 * 60 * 1000);
