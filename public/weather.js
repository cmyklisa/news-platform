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

// 由標題判斷天氣類型，回傳 {icon, type, severity, accent}
function detectType(text) {
  const t = text || '';
  if (/海嘯|海溢|嘯/i.test(t))                    return { icon: '🌊', type: '海嘯',      severity: 3, accent: '#0070c0' };
  if (/強震|大地震|7級|6級|規模7|規模6/i.test(t))  return { icon: '⚠️', type: '強震',      severity: 3, accent: '#ff3030' };
  if (/地震|餘震|震度|規模/i.test(t))              return { icon: '🟠', type: '地震',      severity: 2, accent: '#e85d2f' };
  if (/強颱|颱風假|陸上颱風警報|海上颱風警報/i.test(t)) return { icon: '🌀', type: '颱風警報', severity: 3, accent: '#a13fd6' };
  if (/颱風|中颱|輕颱|熱帶低壓|熱帶性低氣壓/i.test(t)) return { icon: '🌀', type: '颱風',      severity: 2, accent: '#7e3fa6' };
  if (/超大豪雨|大豪雨/i.test(t))                   return { icon: '⛈️', type: '大豪雨',    severity: 3, accent: '#1e5fa1' };
  if (/豪雨|大雨特報|雨彈|雷雨/i.test(t))           return { icon: '🌧️', type: '豪雨',      severity: 2, accent: '#2a78b8' };
  if (/降雨|陣雨|短暫雨|午後雷陣雨/i.test(t))        return { icon: '☔', type: '降雨',      severity: 1, accent: '#3a8fc7' };
  if (/高溫|熱浪|酷暑|體感/i.test(t))               return { icon: '🌡️', type: '高溫',      severity: 1, accent: '#e69b2f' };
  if (/寒流|寒潮|寒害|低溫/i.test(t))               return { icon: '❄️', type: '寒流',      severity: 2, accent: '#3aa8d4' };
  if (/沙塵|霾|空汙|空污|PM2\.5/i.test(t))         return { icon: '🟫', type: '空汙',      severity: 1, accent: '#8a6a3a' };
  if (/閃電|打雷|雷擊/i.test(t))                    return { icon: '⚡', type: '雷電',      severity: 2, accent: '#c2a022' };
  if (/晴|多雲|陰天/i.test(t))                      return { icon: '⛅', type: '一般預報',  severity: 0, accent: '#5fa9d4' };
  return                                            { icon: '🌤️', type: '天氣',      severity: 0, accent: '#5fa9d4' };
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

function buildAlertBanner(items) {
  // 找出嚴重度 >= 3 的事件，依類別分組
  const severe = items
    .map(it => ({ it, info: detectType(it.title + ' ' + (it.summary || '')) }))
    .filter(x => x.info.severity >= 2);
  if (severe.length === 0) return '';

  // 按類別組
  const byType = {};
  for (const { it, info } of severe) {
    if (!byType[info.type]) byType[info.type] = { info, items: [] };
    byType[info.type].items.push(it);
  }
  const cards = Object.values(byType)
    .sort((a, b) => b.info.severity - a.info.severity)
    .slice(0, 4)
    .map(g => `
      <div class="alert-card" style="--accent:${g.info.accent}" data-id="${g.items[0].id}" data-url="${escapeHTML(g.items[0].url)}">
        <div class="alert-icon">${g.info.icon}</div>
        <div class="alert-body">
          <div class="alert-type">${escapeHTML(g.info.type)}</div>
          <div class="alert-title">${window.highlightBiasText(g.items[0].title)}</div>
          <div class="alert-meta">${g.items.length} 則相關 · 點看詳情</div>
        </div>
      </div>
    `).join('');
  return `<div class="alert-banner">${cards}</div>`;
}

function renderList(data) {
  const items = data.items || [];
  if (items.length === 0) {
    listEl.innerHTML = `<div class="empty">${escapeHTML(data.region_label || '')}今日尚無天氣相關新聞</div>`;
    return;
  }

  const banner = buildAlertBanner(items);
  const fallbackNote = data.fallback
    ? `<div class="region-fallback">「${escapeHTML(data.region_label)}」今日無特定區域氣象新聞，以下顯示全台天氣動態</div>`
    : '';

  const cards = items.map(it => {
    const info = detectType(it.title + ' ' + (it.summary || ''));
    const sourceName = (window.SOURCE_NAMES && window.SOURCE_NAMES[it.source]) || it.source;
    return `
      <article class="weather-card sev-${info.severity}"
               style="--accent:${info.accent}"
               data-id="${it.id}" data-url="${escapeHTML(it.url)}">
        <div class="wc-icon">${info.icon}</div>
        <div class="wc-body">
          <div class="wc-type">${escapeHTML(info.type)}</div>
          <h2 class="weather-title">${window.highlightBiasText(it.title)}</h2>
          ${it.summary ? `<p class="weather-summary">${window.highlightBiasText(it.summary.slice(0, 160))}${it.summary.length > 160 ? '…' : ''}</p>` : ''}
          <div class="weather-meta">
            <span class="weather-source">${escapeHTML(sourceName)}</span>
            <span>·</span>
            <span>${formatTime(it.published_at)}</span>
          </div>
        </div>
      </article>
    `;
  }).join('');

  listEl.innerHTML = fallbackNote + banner + cards;

  listEl.querySelectorAll('.weather-card, .alert-card').forEach(card => {
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
