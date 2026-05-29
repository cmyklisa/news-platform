// 簡易中文事件分群：字元 bigram + Jaccard 相似度。
// 對 MVP 而言足夠：同事件不同來源標題通常會有大量重疊字。
const STOP_CHARS = new Set([
  '的', '了', '在', '是', '和', '與', '及', '為',
  '「', '」', '『', '』', '（', '）', '(', ')',
  '：', ':', '，', ',', '。', '.', '？', '?', '！', '!',
  ' ', '　', '\t', '\n', '\r',
  '-', '—', '/', '|', '｜',
]);

function normalize(text) {
  return Array.from(text || '')
    .filter(ch => !STOP_CHARS.has(ch))
    .join('')
    .toLowerCase();
}

function bigrams(text) {
  const t = normalize(text);
  const set = new Set();
  if (t.length < 2) {
    if (t.length === 1) set.add(t);
    return set;
  }
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return inter / union;
}

const SIM_THRESHOLD = 0.45;

// 在當日叢集池中為新標題找一個叢集；找不到則回傳 null 由呼叫者建立新叢集
function findCluster(newTitle, candidates) {
  const ng = bigrams(newTitle);
  let best = null;
  let bestScore = 0;
  for (const c of candidates) {
    const score = jaccard(ng, c.bigrams);
    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }
  return bestScore >= SIM_THRESHOLD ? best : null;
}

module.exports = { bigrams, jaccard, findCluster, normalize, SIM_THRESHOLD };
