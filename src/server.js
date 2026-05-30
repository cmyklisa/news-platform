const path = require('path');
const express = require('express');
const cron = require('node-cron');
const { db, stmts, dateKeyFromMs } = require('./db');
const { fetchAll, backfillCategories } = require('./fetcher');
const { CATEGORIES, REGIONS, REGION_LABELS } = require('./categorizer');
const keywords = require('./keywords');

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
  if (region !== 'all' && REGIONS[region]) {
    const kw = REGIONS[region];
    items = all.filter(h => kw.some(k => h.title.includes(k) || (h.summary || '').includes(k)));
  }
  res.json({
    region,
    region_label: REGION_LABELS[region] || region,
    date,
    items: items.slice(0, limit),
    available_regions: ['all', ...Object.keys(REGIONS)].map(r => ({
      code: r, label: REGION_LABELS[r] || r,
    })),
  });
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
  const perCat = Math.min(parseInt(req.query.limit, 10) || 60, 200);
  const today = dateKeyFromMs(Date.now());
  const countMap = new Map(
    stmts.categoryCountsToday.all(today).map(r => [r.category, r.total])
  );
  const result = CATEGORIES.map(c => ({
    code: c.code,
    name: c.name,
    total_today: countMap.get(c.code) || 0,
    items: stmts.headlinesByCategory.all(c.code, perCat),
  }));
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
