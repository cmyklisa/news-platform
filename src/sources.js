// 每個來源可選擇性指定 parser='pchome' 走自訂解析（PChome 不是標準 RSS）
module.exports = [
  { name: 'google_tw', url: 'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant' },
  { name: 'ltn',       url: 'https://news.ltn.com.tw/rss/all.xml' },
  { name: 'pts',       url: 'https://news.pts.org.tw/xml/newsfeed.xml' },
  { name: 'newtalk',   url: 'https://newtalk.tw/rss/all' },
  { name: 'pchome',    url: 'https://news.pchome.com.tw/rss', parser: 'pchome' },
];
