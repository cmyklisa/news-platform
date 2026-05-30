const mapEl = document.getElementById('twMap');
const citiesG = document.getElementById('mapCities');
const summaryEl = document.getElementById('wxSummary');
const alertsEl = document.getElementById('wxAlerts');
const statusEl = document.getElementById('status');
const popoverEl = document.getElementById('wxPopover');
const popoverCardEl = document.getElementById('wxPopoverCard');
const popoverBackdrop = document.getElementById('wxPopoverBackdrop');

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function formatTime(ms) {
  const d = new Date(ms);
  const p = n => String(n).padStart(2, '0');
  return `${d.getMonth()+1}/${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
function weekdayCh(d) { return ['日','一','二','三','四','五','六'][d.getDay()]; }

// === 由天氣 type 決定地圖點點顏色／emoji ===
function legendOf(type) {
  if (type === 'sunny')              return 'lg-sunny';
  if (['mostly','partly'].includes(type)) return 'lg-cloudy';
  if (type === 'overcast' || type === 'fog') return 'lg-overcast';
  if (['drizzle','rain','showers'].includes(type)) return 'lg-rain';
  if (['storm','snow_sh'].includes(type)) return 'lg-storm';
  return '';
}

// === 渲染台灣地圖點點 ===
let CITIES = [];
function renderMap(cities) {
  CITIES = cities;
  citiesG.innerHTML = '';
  for (const c of cities) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('class', 'map-city');
    g.dataset.code = c.code;
    g.setAttribute('transform', `translate(${c.x} ${c.y})`);
    const popBadge = (c.pop != null && c.pop > 0)
      ? `<g transform="translate(11 -11)">
           <rect x="-8" y="-6" width="22" height="12" rx="6"
                 fill="#2a78b8" stroke="#0c0d10" stroke-width="0.8" />
           <text x="3" y="3" text-anchor="middle" font-size="7"
                 fill="#fff" font-weight="800" font-family="sans-serif">${c.pop}%</text>
         </g>`
      : '';
    g.innerHTML = `
      <circle r="14" fill="${c.color}" stroke="#0c0d10" stroke-width="1.6"
              filter="drop-shadow(0 1px 2px rgba(0,0,0,0.6))" />
      <text y="3" text-anchor="middle" font-size="9" fill="#0c0d10"
            font-weight="800" font-family="serif" letter-spacing="1">${c.temp != null ? c.temp + '°' : '-'}</text>
      <text y="28" text-anchor="middle" font-size="10" fill="#e7e8ea"
            font-weight="700" font-family="serif" stroke="#0c0d10" stroke-width="3" paint-order="stroke">${c.name}</text>
      ${popBadge}
    `;
    g.addEventListener('click', () => openCityDetail(c));
    citiesG.appendChild(g);
  }
}

// === 中央大型概況 ===
function renderSummary(cities) {
  if (!cities.length) return;
  const main = cities.find(c => c.code === 'TPE') || cities[0];
  // 平均氣溫
  const temps = cities.map(c => c.temp).filter(t => typeof t === 'number');
  const avg = temps.length ? Math.round(temps.reduce((s,t)=>s+t,0) / temps.length) : null;
  // 是否多數下雨
  const rainCount = cities.filter(c => ['rain','drizzle','showers','storm'].includes(c.type)).length;
  const stormCount = cities.filter(c => c.type === 'storm').length;
  const isRainy = rainCount >= Math.ceil(cities.length / 3);
  const dominant = (
    stormCount > 0 ? cities.find(c => c.type === 'storm')
    : isRainy ? cities.find(c => ['rain','showers','drizzle'].includes(c.type))
    : main
  );

  summaryEl.innerHTML = `
    <div class="wx-big">
      <div class="wx-big-icon">${dominant.icon || '⛅'}</div>
      <div class="wx-big-body">
        <div class="wx-big-temp">${main.temp ?? '-'}<span>°C</span></div>
        <div class="wx-big-label">${main.name}　${main.label}</div>
        <div class="wx-big-sub">
          全台均溫 <strong>${avg ?? '-'}°C</strong>
          ${rainCount > 0 ? `· 有 ${rainCount} 縣市下雨` : ''}
          ${stormCount > 0 ? `· ${stormCount} 處雷雨` : ''}
        </div>
      </div>
    </div>
    <div class="wx-detail-grid">
      <div class="wx-stat"><span class="wx-stat-l">濕度</span><span class="wx-stat-v">${main.humidity ?? '-'}%</span></div>
      <div class="wx-stat"><span class="wx-stat-l">風速</span><span class="wx-stat-v">${main.wind ?? '-'} km/h</span></div>
      <div class="wx-stat"><span class="wx-stat-l">資料來源</span><span class="wx-stat-v">Open-Meteo</span></div>
    </div>
  `;
}

// === 點縣市彈出詳情 ===
function openCityDetail(c) {
  popoverCardEl.innerHTML = `
    <button class="wx-popover-x" type="button" aria-label="關閉">✕</button>
    <div class="wx-pop-head" style="--accent:${c.color}">
      <div class="wx-pop-icon">${c.icon}</div>
      <div>
        <div class="wx-pop-name">${escapeHTML(c.name)}</div>
        <div class="wx-pop-temp">${c.temp ?? '-'}°C　<small>${escapeHTML(c.label)}</small></div>
      </div>
    </div>
    <div class="wx-pop-stats">
      <div><span>濕度</span><strong>${c.humidity ?? '-'}%</strong></div>
      <div><span>風速</span><strong>${c.wind ?? '-'} km/h</strong></div>
      <div><span>降雨機率</span><strong>${c.pop != null ? c.pop + '%' : '-'}</strong></div>
    </div>
    <div class="wx-pop-forecast">
      ${(c.forecast || []).map((f, i) => {
        const d = new Date(f.date);
        const label = i === 0 ? '今日' : i === 1 ? '明日' : `${d.getMonth()+1}/${d.getDate()}`;
        return `
          <div class="wx-day">
            <div class="wx-day-label">${label} 週${weekdayCh(d)}</div>
            <div class="wx-day-icon">${f.icon}</div>
            <div class="wx-day-cond">${escapeHTML(f.label)}</div>
            <div class="wx-day-temp">${f.tmin ?? '-'}° / <strong>${f.tmax ?? '-'}°</strong></div>
            ${f.pop != null ? `<div class="wx-day-pop">☂ ${f.pop}%</div>` : ''}
            ${f.precip != null && f.precip > 0 ? `<div class="wx-day-precip">${f.precip.toFixed(1)}mm</div>` : ''}
          </div>
        `;
      }).join('')}
    </div>
  `;
  popoverCardEl.querySelector('.wx-popover-x').addEventListener('click', closePopover);
  popoverEl.hidden = false;
}
function closePopover() { popoverEl.hidden = true; }
popoverBackdrop.addEventListener('click', closePopover);
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !popoverEl.hidden) closePopover();
});

// === 警報卡片（仍用既有 weather 類別新聞） ===
function detectAlertType(text) {
  const t = text || '';
  if (/海嘯/.test(t))                                return { icon:'🌊', label:'海嘯',     accent:'#0070c0', sev:3 };
  if (/強震|大地震|7級|6級|規模 ?[67]/i.test(t))      return { icon:'⚠️', label:'強震',     accent:'#ff3030', sev:3 };
  if (/地震|餘震|震度|規模/.test(t))                  return { icon:'🟠', label:'地震',     accent:'#e85d2f', sev:2 };
  if (/強颱|颱風假|陸上颱風警報|海上颱風警報/.test(t)) return { icon:'🌀', label:'颱風警報', accent:'#a13fd6', sev:3 };
  if (/颱風|中颱|輕颱|熱帶低壓|熱帶性低氣壓/.test(t)) return { icon:'🌀', label:'颱風',     accent:'#7e3fa6', sev:2 };
  if (/超大豪雨|大豪雨/.test(t))                      return { icon:'⛈️', label:'大豪雨',   accent:'#1e5fa1', sev:3 };
  if (/豪雨|大雨特報|雨彈|雷雨/.test(t))              return { icon:'🌧️', label:'豪雨',     accent:'#2a78b8', sev:2 };
  if (/寒流|寒潮|寒害|低溫/.test(t))                  return { icon:'❄️', label:'寒流',     accent:'#3aa8d4', sev:2 };
  if (/閃電|打雷|雷擊/.test(t))                       return { icon:'⚡', label:'雷電',     accent:'#c2a022', sev:2 };
  return null;
}

function renderAlerts(items) {
  // 只顯示嚴重事件
  const flagged = items
    .map(it => ({ it, info: detectAlertType(it.title + ' ' + (it.summary || '')) }))
    .filter(x => x.info && x.info.sev >= 2);

  if (flagged.length === 0) {
    alertsEl.innerHTML = `<div class="empty">目前無重大氣象警示</div>`;
    return;
  }
  alertsEl.innerHTML = flagged.slice(0, 12).map(({ it, info }) => `
    <article class="wx-alert" style="--accent:${info.accent}"
             data-id="${it.id}" data-url="${escapeHTML(it.url)}">
      <div class="wx-alert-icon">${info.icon}</div>
      <div class="wx-alert-body">
        <div class="wx-alert-type">${escapeHTML(info.label)}</div>
        <div class="wx-alert-title">${window.highlightBiasText(it.title)}</div>
        <div class="wx-alert-time">${formatTime(it.published_at)}</div>
      </div>
    </article>
  `).join('');
  alertsEl.querySelectorAll('.wx-alert').forEach(card => {
    card.addEventListener('click', () => {
      window.openDrawer(parseInt(card.dataset.id, 10), card.dataset.url);
    });
  });
}

// === 載入 ===
async function loadLive() {
  statusEl.textContent = '更新中…';
  try {
    const r = await fetch('/api/weather/live');
    const data = await r.json();
    if (!data || !data.cities) throw new Error(data.error || '無資料');
    renderMap(data.cities);
    renderSummary(data.cities);
    statusEl.textContent = `更新於 ${formatTime(data.fetched_at)}`;
  } catch (err) {
    summaryEl.innerHTML = `<div class="empty">無法取得即時氣象（${escapeHTML(err.message || '')}）<br><small>稍後自動重試</small></div>`;
    statusEl.textContent = '載入失敗';
  }
}
async function loadAlerts() {
  try {
    const r = await fetch('/api/weather?region=all&limit=120');
    const data = await r.json();
    renderAlerts(data.items || []);
  } catch (err) {
    alertsEl.innerHTML = `<div class="empty">警報資料載入失敗</div>`;
  }
}

loadLive();
loadAlerts();
setInterval(loadLive, 15 * 60 * 1000);   // 15 分鐘更新一次即時天氣
setInterval(loadAlerts, 5 * 60 * 1000);  // 5 分鐘更新警報
