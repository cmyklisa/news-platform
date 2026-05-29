const Parser = require('rss-parser');
const { db, stmts, dateKeyFromMs } = require('./db');
const { bigrams, findCluster } = require('./grouper');
const { categorize } = require('./categorizer');
const SOURCES = require('./sources');

const parser = new Parser({
  timeout: 15000,
  headers: { 'User-Agent': 'Mozilla/5.0 TWNewsRadar/0.1' },
});

// 修補常見的 XML 違規：未轉義的 & 字元
function sanitizeXml(xml) {
  return xml.replace(/&(?!(?:amp|lt|gt|quot|apos|#\d+|#x[0-9A-Fa-f]+);)/g, '&amp;');
}

async function parseFeed(url) {
  try {
    return await parser.parseURL(url);
  } catch (err) {
    // 後備：手動抓 + 清洗 + parseString
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 TWNewsRadar/0.1' } });
    const text = await res.text();
    return await parser.parseString(sanitizeXml(text));
  }
}

// PChome 的 <news><item><title><link><pubdate> 自訂格式
async function parsePChome(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 TWNewsRadar/0.1' } });
  const xml = await res.text();
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  const pick = (block, tag) => {
    const m = block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`, 'i'));
    return m ? m[1].trim() : '';
  };
  let m;
  while ((m = re.exec(xml)) !== null) {
    const block = m[1];
    const title = pick(block, 'title');
    const link = pick(block, 'link');
    const pubdate = pick(block, 'pubdate') || pick(block, 'pubDate');
    if (!title || !link) continue;
    const desc = pick(block, 'desc') || pick(block, 'description');
    items.push({ title, link, isoDate: pubdate.replace(' ', 'T') + '+08:00', _desc: desc });
  }
  return { items };
}

// 為了在批次內進行分群，維護一個「當日叢集 -> 代表 bigrams」的記憶體索引。
// 啟動或新一天時會從 DB 重建。
const clusterCache = new Map(); // key: cluster_id -> { id, rep_title, bigrams, date_key }
let cacheDateKey = null;

function rebuildClusterCache(dateKey) {
  clusterCache.clear();
  cacheDateKey = dateKey;
  const rows = db.prepare(
    `SELECT c.id, c.rep_title, c.date_key
     FROM clusters c
     WHERE c.date_key = ?`
  ).all(dateKey);
  for (const r of rows) {
    clusterCache.set(r.id, {
      id: r.id,
      rep_title: r.rep_title,
      bigrams: bigrams(r.rep_title),
      date_key: r.date_key,
    });
  }
}

function ensureCacheFor(dateKey) {
  if (cacheDateKey !== dateKey) rebuildClusterCache(dateKey);
}

function assignCluster(title, dateKey, publishedAt) {
  ensureCacheFor(dateKey);
  const candidates = Array.from(clusterCache.values());
  const hit = findCluster(title, candidates);
  if (hit) {
    stmts.touchCluster.run(publishedAt, hit.id);
    return hit.id;
  }
  const info = stmts.insertCluster.run(title, publishedAt, publishedAt, dateKey);
  const newId = info.lastInsertRowid;
  clusterCache.set(newId, {
    id: newId,
    rep_title: title,
    bigrams: bigrams(title),
    date_key: dateKey,
  });
  return newId;
}

function extractSummary(item) {
  const raw = item.contentSnippet
    || item.content
    || item.description
    || item.summary
    || item._desc
    || '';
  return String(raw)
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 800);
}

function pickPublishedMs(item) {
  const candidates = [item.isoDate, item.pubDate, item.date];
  for (const c of candidates) {
    if (!c) continue;
    const t = Date.parse(c);
    if (!Number.isNaN(t)) return t;
  }
  return Date.now();
}

async function fetchOne(source) {
  try {
    const feed = source.parser === 'pchome'
      ? await parsePChome(source.url)
      : await parseFeed(source.url);
    let inserted = 0;
    const now = Date.now();
    for (const item of feed.items || []) {
      const url = (item.link || '').trim();
      const title = (item.title || '').trim();
      if (!url || !title) continue;
      const publishedAt = pickPublishedMs(item);
      const dateKey = dateKeyFromMs(publishedAt);
      const clusterId = assignCluster(title, dateKey, publishedAt);
      const category = categorize({
        title, url,
        rssCategories: item.categories || [],
      });
      const summary = extractSummary(item);
      const info = stmts.insertHeadline.run(
        url, title, source.name, publishedAt, now, clusterId, dateKey, category, summary
      );
      if (info.changes > 0) inserted++;
      else if (summary) stmts.updateSummaryIfEmpty.run(summary, url);
    }
    return { source: source.name, count: feed.items?.length || 0, inserted };
  } catch (err) {
    return { source: source.name, error: err.message };
  }
}

async function fetchAll() {
  const results = await Promise.all(SOURCES.map(fetchOne));
  const summary = {
    at: new Date().toISOString(),
    results,
    totalInserted: results.reduce((s, r) => s + (r.inserted || 0), 0),
  };
  console.log('[fetch]', JSON.stringify(summary));
  return summary;
}

// 全表 recategorize：類別 KW 表有更動時要呼叫，把所有舊資料重打
function backfillCategories() {
  const rows = stmts.allHeadlinesForCategorize.all();
  let changed = 0;
  for (const r of rows) {
    const cat = categorize({ title: r.title, url: r.url });
    if (cat !== r.category) {
      stmts.updateHeadlineCategory.run(cat, r.id);
      changed++;
    }
  }
  console.log(`[backfill] scanned ${rows.length}, recategorized ${changed}`);
}

module.exports = { fetchAll, fetchOne, backfillCategories };
