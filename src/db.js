const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

// 預設寫在 repo 內 data/，PaaS 若提供持久卷請設定 NEWS_DB_DIR
const DATA_DIR = process.env.NEWS_DB_DIR || path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'news.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS headlines (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    url          TEXT UNIQUE NOT NULL,
    title        TEXT NOT NULL,
    source       TEXT NOT NULL,
    published_at INTEGER NOT NULL,
    fetched_at   INTEGER NOT NULL,
    cluster_id   INTEGER,
    date_key     TEXT NOT NULL,
    category     TEXT NOT NULL DEFAULT 'domestic',
    summary      TEXT NOT NULL DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS clusters (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    rep_title    TEXT NOT NULL,
    first_seen   INTEGER NOT NULL,
    last_seen    INTEGER NOT NULL,
    date_key     TEXT NOT NULL
  );
`);

// 軟性 migrations
function hasCol(name) {
  return !!db.prepare(`PRAGMA table_info(headlines)`).all().find(c => c.name === name);
}
if (!hasCol('category')) {
  db.exec(`ALTER TABLE headlines ADD COLUMN category TEXT NOT NULL DEFAULT 'domestic'`);
}
if (!hasCol('summary')) {
  db.exec(`ALTER TABLE headlines ADD COLUMN summary TEXT NOT NULL DEFAULT ''`);
}

db.exec(`
  CREATE INDEX IF NOT EXISTS idx_headlines_published ON headlines(published_at DESC);
  CREATE INDEX IF NOT EXISTS idx_headlines_date_key  ON headlines(date_key);
  CREATE INDEX IF NOT EXISTS idx_headlines_cluster   ON headlines(cluster_id);
  CREATE INDEX IF NOT EXISTS idx_headlines_cat_date  ON headlines(category, date_key);
  CREATE INDEX IF NOT EXISTS idx_clusters_date       ON clusters(date_key);
`);

const stmts = {
  insertHeadline: db.prepare(`
    INSERT OR IGNORE INTO headlines
      (url, title, source, published_at, fetched_at, cluster_id, date_key, category, summary)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `),
  updateSummaryIfEmpty: db.prepare(`
    UPDATE headlines SET summary = ?
    WHERE url = ? AND (summary IS NULL OR summary = '')
  `),
  getHeadlineFull: db.prepare(`
    SELECT id, url, title, source, published_at, cluster_id, category, summary
    FROM headlines WHERE id = ?
  `),
  siblingsInCluster: db.prepare(`
    SELECT id, url, title, source, published_at
    FROM headlines
    WHERE cluster_id = ? AND id != ?
    ORDER BY published_at DESC
  `),
  updateHeadlineCategory: db.prepare(`UPDATE headlines SET category = ? WHERE id = ?`),
  headlinesMissingCategory: db.prepare(`SELECT id, title, url FROM headlines WHERE category = 'domestic' OR category IS NULL`),
  allHeadlinesForCategorize: db.prepare(`SELECT id, title, url, category FROM headlines`),
  headlinesByCategory: db.prepare(`
    SELECT id, url, title, source, published_at, cluster_id, category
    FROM headlines
    WHERE category = ?
    ORDER BY published_at DESC
    LIMIT ?
  `),
  categoryCountsToday: db.prepare(`
    SELECT category, COUNT(*) AS total
    FROM headlines
    WHERE date_key = ?
    GROUP BY category
  `),
  updateCluster: db.prepare(`UPDATE headlines SET cluster_id = ? WHERE id = ?`),
  insertCluster: db.prepare(`
    INSERT INTO clusters (rep_title, first_seen, last_seen, date_key)
    VALUES (?, ?, ?, ?)
  `),
  touchCluster: db.prepare(`UPDATE clusters SET last_seen = ? WHERE id = ?`),
  headlinesByDate: db.prepare(`
    SELECT id, url, title, source, published_at, cluster_id
    FROM headlines
    WHERE date_key = ?
    ORDER BY published_at DESC
    LIMIT ?
  `),
  recentHeadlines: db.prepare(`
    SELECT id, url, title, source, published_at, cluster_id
    FROM headlines
    ORDER BY published_at DESC
    LIMIT ?
  `),
  trending: db.prepare(`
    SELECT
      h.cluster_id              AS cluster_id,
      c.rep_title               AS rep_title,
      COUNT(*)                  AS total,
      COUNT(DISTINCT h.source)  AS source_count,
      MAX(h.published_at)       AS last_seen,
      (SELECT id  FROM headlines x WHERE x.cluster_id = h.cluster_id ORDER BY x.published_at DESC LIMIT 1) AS latest_id,
      (SELECT url FROM headlines x WHERE x.cluster_id = h.cluster_id ORDER BY x.published_at DESC LIMIT 1) AS latest_url
    FROM headlines h
    JOIN clusters c ON c.id = h.cluster_id
    WHERE h.date_key = ?
    GROUP BY h.cluster_id
    ORDER BY source_count DESC, total DESC, last_seen DESC
    LIMIT ?
  `),
  todaysClustersWithTitles: db.prepare(`
    SELECT id, title, cluster_id, published_at
    FROM headlines
    WHERE cluster_id IS NOT NULL AND date_key = ?
  `),
  availableDates: db.prepare(`
    SELECT date_key, COUNT(*) AS total
    FROM headlines
    GROUP BY date_key
    ORDER BY date_key DESC
    LIMIT 60
  `),
};

function dateKeyFromMs(ms) {
  const d = new Date(ms);
  const tzOffsetMin = -480;
  const local = new Date(ms - (d.getTimezoneOffset() - tzOffsetMin) * 60000);
  return local.toISOString().slice(0, 10);
}

module.exports = { db, stmts, dateKeyFromMs };
