// 中文新聞標題關鍵字統計
// 規則：抽出所有 2-4 字漢字 n-gram，去停用詞、去重複包含的短詞，依出現次數排行

// 新聞媒體/發行商相關詞（出現在標題尾巴或前綴的雜訊）
const PUBLISHER_STOP = [
  '自由','時報','聯合','中時','蘋果','三立','TVBS','民視','公視','東森','華視',
  '中央社','中央通訊','中央通訊社','上報','風傳媒','天下','商周','鏡傳媒','鏡週刊','鏡新聞',
  'ETtoday','NOWnews','UDN','LTN','PChome','Yahoo','YAHOO','奇摩','MSN','BBC','CNN','NHK','REUTERS',
  '自由時報','聯合報','中國時報','蘋果日報','風傳媒網','新頭殼','關鍵評論','TVBS新聞',
  '新聞網','新聞台','新聞稿','聞網','新聞','財經','體育版','地方版',
  'YOUTUBE','YT','YT影音','頻道','直播','TVBS','ETTODAY','SETN','UDN','LTN',
  '蕃新聞','登山口','山口','打上','本報','蕃薯藤','奇摩新聞','新頭殼',
  '快報','聯合新聞','聯合新聞網','聯合報新聞','中時新聞','中時電子報',
  '影音','影音新聞','直播新聞','新聞影音','畫面','畫面曝光','曝光畫面',
  'GAMEREA','GAMER','TECHCRUNCH','NEWTALK',
];

const STOP_PHRASES = new Set([
  // 單字（停用，但仍是合法 ngram 子字元，所以也判 substring）
  '的','了','是','在','和','與','也','都','但','及','為','從','到','於','對','而','由','把','被','讓','使',
  '這','那','個','些','並','即','就','還','又','卻','才','已','將','要','等','過','來','去','以','向','其',
  '中','出','上','下','內','外','前','後','左','右','間','次','面','片',
  '大','小','多','少','高','低','好','壞','新','舊','全','兩','三',
  '一','二','三','四','五','六','七','八','九','十','零','百','千','萬','億',
  // 兩字常見虛詞 / 通用副詞
  '一個','兩個','三個','這個','那個','這些','那些','其他','其中','其實','其後','此外','此次','另外','本次',
  '可能','可以','應該','必須','需要','希望','表示','認為','指出','強調','回應',
  '發生','進行','舉行','宣布','決定','發表','說明','解釋','介紹',
  '因為','所以','但是','然而','因此','不過','如果','假如','假設','要是',
  '雖然','即使','即便','儘管','除非','由於','基於','關於','對於','至於','作為','成為','變成',
  '透過','經由','藉由','針對','根據','依據','按照','依照','尤其','特別','非常','十分',
  '今天','明天','昨天','今日','明日','昨日','今年','明年','去年','本週','上週','下週','本月','上月','下月',
  '日前','日後','當天','當日','當時','當前','當下','現在','剛剛','馬上','立刻','立即',
  '報導','報道','記者','編輯','撰文','專訪','新聞','本報','本台','記者會','發言人',
  '一日','二日','三日','四日','五日','六日','七日','八日','九日','十日',
  '快訊','獨家','直擊','即時','最新','突發','重大','重磅','驚爆','曝光','證實','傳出',
  '影片','照片','圖／','圖卡','圖片','圖文','畫面','直播','現場',
  '專欄','專家','學者','分析','觀察','評論','社論',
  '台灣','台灣人','一名','一位','幾名','數名','多名','部分','少數','多數','全部',
  // 三字常見虛詞
  '一直以','以及其','以及在','可能會','應該要','必須要','也就是','也就是說','看起來','似乎是',
  ...PUBLISHER_STOP,
]);

// 純停用單字（用來判斷整段 ngram 是否「全是虛字」）
const STOP_CHARS = new Set([
  '的','了','是','在','和','與','也','都','但','及','為','從','到','於','對','而','由','把','被','讓','使',
  '這','那','個','些','並','即','就','還','又','卻','才','已','將','要','等','過','來','去','以','向','其',
  '中','出','上','下','內','外','前','後','間','次','面','片',
  '大','小','多','少','高','低','好','壞','新','舊','全','兩',
  '一','二','三','四','五','六','七','八','九','十','零','百','千','萬','億',
  '日','月','年','時','分','秒','點','週',
]);

function extractNgrams(title) {
  const out = new Set();
  if (!title) return out;
  const runs = title.match(/[一-鿿]+/g) || [];
  // 英數縮寫詞 (AI, NBA, F-16, ETF...)
  const tokens = title.match(/[A-Za-z][A-Za-z0-9.\-]{1,}/g) || [];
  for (const t of tokens) {
    const upper = t.toUpperCase();
    if (t.length >= 2 && t.length <= 12 && !STOP_PHRASES.has(upper)) out.add(upper);
  }
  for (const run of runs) {
    for (const len of [5, 4, 3, 2]) {
      if (run.length < len) continue;
      for (let i = 0; i <= run.length - len; i++) {
        const ng = run.slice(i, i + len);
        if (STOP_PHRASES.has(ng)) continue;
        // 整段都是停用字 → 跳過
        let allStop = true;
        for (const ch of ng) if (!STOP_CHARS.has(ch)) { allStop = false; break; }
        if (allStop) continue;
        out.add(ng);
      }
    }
  }
  return out;
}

function buildKeywordTrending(headlines, limit = 20) {
  const counts = new Map();
  for (const h of headlines) {
    const ngs = extractNgrams(h.title || '');
    for (const ng of ngs) counts.set(ng, (counts.get(ng) || 0) + 1);
  }
  // 至少出現 2 次才入候選
  const arr = [...counts.entries()].filter(([, c]) => c >= 2);
  // 先依長度遞減，同長度按次數遞減 — 讓最長的詞先被收進來
  arr.sort((a, b) => b[0].length - a[0].length || b[1] - a[1]);

  const kept = [];
  for (const [w, c] of arr) {
    // 已收進來的詞 (一般比 w 長) 若包含 w 且次數接近 → w 是 substring 雜訊，丟掉
    let suppress = false;
    for (const k of kept) {
      if (k.word.includes(w) && Math.abs(k.count - c) <= 1) { suppress = true; break; }
    }
    if (suppress) continue;
    kept.push({ word: w, count: c });
  }
  // 最後依次數排序回去
  kept.sort((a, b) => b.count - a.count || b.word.length - a.word.length);
  return kept.slice(0, limit);
}

// 簡單快取：每個 date_key 一份，TTL 1 小時
const cache = new Map(); // date -> { items, builtAt }
const TTL_MS = 60 * 60 * 1000;

function getTrending(getHeadlinesByDate, dateKey, limit = 20) {
  const now = Date.now();
  const c = cache.get(dateKey);
  if (c && (now - c.builtAt) < TTL_MS && c.items.length >= limit) {
    return c.items.slice(0, limit);
  }
  const rows = getHeadlinesByDate(dateKey); // 由呼叫方注入 db 存取
  const items = buildKeywordTrending(rows, 50);
  cache.set(dateKey, { items, builtAt: now });
  return items.slice(0, limit);
}

function invalidate(dateKey) {
  if (dateKey) cache.delete(dateKey);
  else cache.clear();
}

module.exports = { extractNgrams, buildKeywordTrending, getTrending, invalidate };
