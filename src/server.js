const path = require('path');
const express = require('express');
const cron = require('node-cron');
const { db, stmts, dateKeyFromMs } = require('./db');
const { fetchAll, backfillCategories } = require('./fetcher');
const { CATEGORIES, REGIONS, REGION_LABELS, NATIONWIDE_HINTS } = require('./categorizer');
const keywords = require('./keywords');

// === Live weather (Open-Meteo) ===
const TW_CITIES = [
  { code:'KEE', name:'基隆', lat:25.128, lon:121.739, x:172, y: 64 },
  { code:'TPE', name:'台北', lat:25.033, lon:121.565, x:148, y: 82 },
  { code:'NTP', name:'新北', lat:25.012, lon:121.466, x:138, y: 92 },
  { code:'YIL', name:'宜蘭', lat:24.702, lon:121.738, x:178, y:108 },
  { code:'TYC', name:'桃園', lat:24.994, lon:121.301, x:118, y:100 },
  { code:'HSC', name:'新竹市', lat:24.814, lon:120.968, x: 96, y:122 },
  { code:'HSH', name:'新竹縣', lat:24.838, lon:121.018, x:106, y:128 },
  { code:'MIA', name:'苗栗', lat:24.560, lon:120.821, x: 88, y:148 },
  { code:'TXG', name:'台中', lat:24.148, lon:120.674, x: 92, y:172 },
  { code:'CHA', name:'彰化', lat:24.052, lon:120.516, x: 78, y:190 },
  { code:'NAN', name:'南投', lat:23.960, lon:120.972, x:114, y:194 },
  { code:'YUN', name:'雲林', lat:23.709, lon:120.431, x: 76, y:214 },
  { code:'CYI', name:'嘉義市', lat:23.480, lon:120.449, x: 84, y:232 },
  { code:'CYH', name:'嘉義縣', lat:23.452, lon:120.255, x: 72, y:242 },
  { code:'TNN', name:'台南', lat:22.999, lon:120.227, x: 80, y:268 },
  { code:'KHH', name:'高雄', lat:22.627, lon:120.301, x: 92, y:298 },
  { code:'PTH', name:'屏東', lat:22.672, lon:120.488, x:112, y:312 },
  { code:'HUA', name:'花蓮', lat:23.987, lon:121.601, x:158, y:196 },
  { code:'TTT', name:'台東', lat:22.797, lon:121.171, x:138, y:290 },
  { code:'PEH', name:'澎湖', lat:23.571, lon:119.579, x: 30, y:236 },
  { code:'KIN', name:'金門', lat:24.449, lon:118.377, x: 14, y:206 },
  { code:'LNN', name:'連江', lat:26.151, lon:119.929, x: 18, y: 58 },
];

const WMO_MAP = {
  0:  { type:'sunny',    label:'晴',     icon:'☀️', color:'#f7c52b' },
  1:  { type:'mostly',   label:'多雲時晴', icon:'🌤️', color:'#e9c668' },
  2:  { type:'partly',   label:'多雲',     icon:'⛅', color:'#cfb87c' },
  3:  { type:'overcast', label:'陰',     icon:'☁️', color:'#98a0aa' },
  45: { type:'fog',      label:'起霧',     icon:'🌫️', color:'#aab0b8' },
  48: { type:'fog',      label:'凍霧',     icon:'🌫️', color:'#aab0b8' },
  51: { type:'drizzle',  label:'毛毛雨',   icon:'🌦️', color:'#5fa9d4' },
  53: { type:'drizzle',  label:'毛毛雨',   icon:'🌦️', color:'#5fa9d4' },
  55: { type:'drizzle',  label:'濃毛雨',   icon:'🌧️', color:'#3a8fc7' },
  56: { type:'drizzle',  label:'凍雨',     icon:'🌧️', color:'#3a8fc7' },
  57: { type:'drizzle',  label:'濃凍雨',   icon:'🌧️', color:'#3a8fc7' },
  61: { type:'rain',     label:'小雨',     icon:'🌧️', color:'#3a8fc7' },
  63: { type:'rain',     label:'雨',       icon:'🌧️', color:'#2a78b8' },
  65: { type:'rain',     label:'大雨',     icon:'🌧️', color:'#1e5fa1' },
  66: { type:'rain',     label:'凍雨',     icon:'🌧️', color:'#1e5fa1' },
  67: { type:'rain',     label:'大凍雨',   icon:'🌧️', color:'#1e5fa1' },
  71: { type:'snow',     label:'小雪',     icon:'🌨️', color:'#8fc3e0' },
  73: { type:'snow',     label:'雪',       icon:'🌨️', color:'#8fc3e0' },
  75: { type:'snow',     label:'大雪',     icon:'❄️', color:'#a8d2e8' },
  77: { type:'snow',     label:'冰珠',     icon:'❄️', color:'#a8d2e8' },
  80: { type:'showers',  label:'陣雨',     icon:'🌦️', color:'#3a8fc7' },
  81: { type:'showers',  label:'陣雨',     icon:'🌧️', color:'#2a78b8' },
  82: { type:'showers',  label:'大陣雨',   icon:'⛈️', color:'#1e5fa1' },
  85: { type:'snow_sh',  label:'陣雪',     icon:'🌨️', color:'#8fc3e0' },
  86: { type:'snow_sh',  label:'大陣雪',   icon:'❄️', color:'#a8d2e8' },
  95: { type:'storm',    label:'雷雨',     icon:'⛈️', color:'#7e3fa6' },
  96: { type:'storm',    label:'雷雨夾雹', icon:'⛈️', color:'#5a3aa8' },
  99: { type:'storm',    label:'強雷雨',   icon:'⛈️', color:'#5a3aa8' },
};
const WMO_DEFAULT = { type:'unknown', label:'—', icon:'❔', color:'#666' };

let weatherCache = null;   // { at, data }
const WEATHER_TTL = 25 * 60 * 1000;

async function fetchLiveWeather() {
  if (weatherCache && (Date.now() - weatherCache.at) < WEATHER_TTL) {
    return weatherCache.data;
  }
  const lats = TW_CITIES.map(c => c.lat).join(',');
  const lons = TW_CITIES.map(c => c.lon).join(',');
  const url = `https://api.open-meteo.com/v1/forecast`
    + `?latitude=${lats}&longitude=${lons}`
    + `&current=temperature_2m,weather_code,relative_humidity_2m,wind_speed_10m`
    + `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum`
    + `&forecast_days=3&timezone=Asia%2FTaipei`;
  const res = await fetch(url, { headers: { 'User-Agent': 'TWNewsRadar/0.1' } });
  if (!res.ok) throw new Error('open-meteo ' + res.status);
  const json = await res.json();
  const arr = Array.isArray(json) ? json : [json];
  const cities = TW_CITIES.map((c, i) => {
    const d = arr[i] || {};
    const cur = d.current || {};
    const code = cur.weather_code != null ? cur.weather_code : null;
    const w = (code != null && WMO_MAP[code]) || WMO_DEFAULT;
    const daily = d.daily || {};
    return {
      code: c.code, name: c.name, lat: c.lat, lon: c.lon, x: c.x, y: c.y,
      temp: cur.temperature_2m != null ? Math.round(cur.temperature_2m) : null,
      humidity: cur.relative_humidity_2m != null ? Math.round(cur.relative_humidity_2m) : null,
      wind: cur.wind_speed_10m != null ? Math.round(cur.wind_speed_10m) : null,
      weather_code: code,
      label: w.label, icon: w.icon, color: w.color, type: w.type,
      forecast: (daily.time || []).map((t, j) => {
        const dc = daily.weather_code ? daily.weather_code[j] : null;
        const dw = (dc != null && WMO_MAP[dc]) || WMO_DEFAULT;
        return {
          date: t,
          weather_code: dc,
          icon: dw.icon, label: dw.label, color: dw.color,
          tmax: daily.temperature_2m_max ? Math.round(daily.temperature_2m_max[j]) : null,
          tmin: daily.temperature_2m_min ? Math.round(daily.temperature_2m_min[j]) : null,
          precip: daily.precipitation_sum ? daily.precipitation_sum[j] : null,
        };
      }),
    };
  });
  weatherCache = { at: Date.now(), data: { cities, fetched_at: Date.now() } };
  return weatherCache.data;
}

function fetchTitlesForDate(dateKey) {
  // 同一 cluster 只算一次，避免單一事件多則改寫淹沒關鍵字統計
  const rows = db.prepare(
    `SELECT title, cluster_id, id FROM headlines WHERE date_key = ?`
  ).all(dateKey);
  const seen = new Set();
  const out = [];
  for (const r of rows) {
    const key = r.cluster_id != null ? `c${r.cluster_id}` : `h${r.id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ title: r.title });
  }
  return out;
}

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '..', 'public')));

function groupByCluster(rows) {
  const map = new Map();
  for (const r of rows) {
    const key = r.cluster_id ?? `solo-${r.id}`;
    if (!map.has(key)) {
      map.set(key, {
        cluster_id: r.cluster_id,
        items: [],
        latest: r.published_at,
      });
    }
    const g = map.get(key);
    g.items.push({
      id: r.id,
      url: r.url,
      title: r.title,
      published_at: r.published_at,
    });
    if (r.published_at > g.latest) g.latest = r.published_at;
  }
  return Array.from(map.values()).sort((a, b) => b.latest - a.latest);
}

app.get('/api/feed', (req, res) => {
  const limit = Math.min(parseInt(req.query.limit, 10) || 200, 500);
  const date = req.query.date;
  const rows = date
    ? stmts.headlinesByDate.all(date, limit)
    : stmts.recentHeadlines.all(limit);
  res.json({ groups: groupByCluster(rows), total: rows.length });
});

app.get('/api/trending', (req, res) => {
  const date = req.query.date || dateKeyFromMs(Date.now());
  const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
  const rows = stmts.trending.all(date, limit);
  res.json({ date, items: rows });
});

app.get('/api/dates', (req, res) => {
  res.json({ dates: stmts.availableDates.all() });
});

// 今日熱門關鍵字
app.get('/api/keywords', (req, res) => {
  const date = req.query.date || dateKeyFromMs(Date.now());
  const limit = Math.min(parseInt(req.query.limit, 10) || 20, 100);
  const items = keywords.getTrending(fetchTitlesForDate, date, limit);
  res.json({ date, items });
});

// 即時天氣（Open-Meteo 22 縣市快取）
app.get('/api/weather/live', async (req, res) => {
  try {
    const data = await fetchLiveWeather();
    res.json(data);
  } catch (err) {
    res.status(502).json({ error: String(err && err.message || err) });
  }
});

// 天氣頁：取出 weather 類別標題；可按區域過濾
app.get('/api/weather', (req, res) => {
  const region = (req.query.region || 'all').trim();
  const date = req.query.date || dateKeyFromMs(Date.now());
  const limit = Math.min(parseInt(req.query.limit, 10) || 60, 200);
  const all = db.prepare(
    `SELECT id, url, title, source, published_at, summary
     FROM headlines
     WHERE category = 'weather' AND date_key = ?
     ORDER BY published_at DESC
     LIMIT 500`
  ).all(date);

  let items = all;
  let fallback = false;
  if (region !== 'all' && REGIONS[region]) {
    const kw = REGIONS[region];
    // 命中區域地名，或者是全台/地震/颱風等不分區事件
    items = all.filter(h => {
      const text = h.title + ' ' + (h.summary || '');
      if (kw.some(k => text.includes(k))) return true;
      if (NATIONWIDE_HINTS.some(k => h.title.includes(k))) return true;
      return false;
    });
    // 若還是抓不到，退回顯示全部，並標記 fallback
    if (items.length === 0) {
      items = all;
      fallback = true;
    }
  }

  res.json({
    region,
    region_label: REGION_LABELS[region] || region,
    fallback,
    date,
    items: items.slice(0, limit),
    available_regions: ['all', ...Object.keys(REGIONS)].map(r => ({
      code: r, label: REGION_LABELS[r] || r,
    })),
  });
});

// 影音新聞：YouTube RSS 來源累積；支援搜尋
app.get('/api/videos', (req, res) => {
  const q = (req.query.q || '').trim();
  const limit = Math.min(parseInt(req.query.limit, 10) || 80, 300);
  let sql = `SELECT id, url, title, source, published_at, summary FROM headlines WHERE category = 'video'`;
  const params = [];
  if (q) { sql += ` AND title LIKE ?`; params.push(`%${q}%`); }
  sql += ` ORDER BY published_at DESC LIMIT ?`;
  params.push(limit);
  const items = db.prepare(sql).all(...params);
  res.json({ q, items });
});

// 任意關鍵字搜尋（最愛頁搜尋框用）
app.get('/api/search', (req, res) => {
  const q = (req.query.q || '').trim();
  if (!q) return res.json({ q: '', items: [] });
  const date = req.query.date || dateKeyFromMs(Date.now());
  const limit = Math.min(parseInt(req.query.limit, 10) || 80, 300);
  const items = stmts.searchTitles.all(date, `%${q}%`, limit);
  res.json({ q, date, items });
});

// 點某關鍵字 → 列出今日所有包含該詞的標題
app.get('/api/keywords/headlines', (req, res) => {
  const word = (req.query.word || '').trim();
  if (!word) return res.json({ word: '', items: [] });
  const date = req.query.date || dateKeyFromMs(Date.now());
  const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
  const items = db.prepare(
    `SELECT id, url, title, source, published_at
     FROM headlines WHERE date_key = ? AND title LIKE ?
     ORDER BY published_at DESC LIMIT ?`
  ).all(date, `%${word}%`, limit);
  res.json({ word, date, items });
});

app.post('/api/refresh', async (req, res) => {
  const summary = await fetchAll();
  res.json(summary);
});

// 批次取多筆標題完整資料（我的最愛頁顯示報紙時用）
app.get('/api/headlines/batch', (req, res) => {
  const idsParam = (req.query.ids || '').trim();
  if (!idsParam) return res.json({ headlines: [] });
  const ids = idsParam.split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => Number.isFinite(n))
    .slice(0, 500);
  if (ids.length === 0) return res.json({ headlines: [] });
  const placeholders = ids.map(() => '?').join(',');
  const rows = db.prepare(
    `SELECT id, url, title, source, published_at, cluster_id, category, summary
     FROM headlines WHERE id IN (${placeholders})`
  ).all(...ids);
  res.json({ headlines: rows });
});

// 單筆標題完整資料 + 同事件其他來源（給側欄預覽用）
app.get('/api/headline/:id', (req, res) => {
  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: 'invalid id' });
  const h = stmts.getHeadlineFull.get(id);
  if (!h) return res.status(404).json({ error: 'not found' });
  const siblings = h.cluster_id ? stmts.siblingsInCluster.all(h.cluster_id, h.id) : [];
  res.json({ headline: h, siblings });
});

app.get('/api/health', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS c FROM headlines').get().c;
  res.json({ ok: true, total });
});

// 一次回傳 6 個類別的最新標題與今日總數，給主頁橫向滑動軸用
app.get('/api/categories', (req, res) => {
  const perCat = Math.min(parseInt(req.query.limit, 10) || 60, 500);
  const today = dateKeyFromMs(Date.now());
  const countMap = new Map(
    stmts.categoryCountsToday.all(today).map(r => [r.category, r.total])
  );

  // 熱門：今日 cluster_size >= 2 的事件，依被報導媒體數排序，取每個 cluster 的最新代表
  const hotItems = db.prepare(`
    SELECT h.id, h.url, h.title, h.source, h.published_at, h.cluster_id, h.category,
           cs.size AS cluster_size
    FROM headlines h
    JOIN (
      SELECT cluster_id, COUNT(*) AS size, MAX(published_at) AS latest
      FROM headlines
      WHERE date_key = ? AND cluster_id IS NOT NULL AND category NOT IN ('video','weather')
      GROUP BY cluster_id
      HAVING size >= 2
    ) cs ON cs.cluster_id = h.cluster_id AND h.published_at = cs.latest
    ORDER BY cs.size DESC, h.published_at DESC
    LIMIT ?
  `).all(today, perCat);

  const result = [
    { code: 'hot', name: '熱門', total_today: hotItems.length, items: hotItems },
    ...CATEGORIES.map(c => ({
      code: c.code,
      name: c.name,
      total_today: countMap.get(c.code) || 0,
      items: stmts.headlinesByCategory.all(c.code, perCat),
    })),
  ];
  res.json({ categories: result, today });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] http://localhost:${PORT}`);
  backfillCategories();
  fetchAll().then(() => keywords.invalidate()).catch(err => console.error('[fetch] initial failed', err));
  cron.schedule('*/5 * * * *', () => {
    fetchAll().then(() => keywords.invalidate())
      .catch(err => console.error('[fetch] scheduled failed', err));
  });
  // 每小時重算一次關鍵字（即使 5 分鐘 fetch 也沒新資料時保險）
  cron.schedule('0 * * * *', () => keywords.invalidate());
});
