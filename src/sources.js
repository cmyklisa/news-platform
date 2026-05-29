// 每個來源可選擇性指定 parser='pchome' 走自訂解析
module.exports = [
  { name: 'google_tw',    url: 'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant' },
  { name: 'ltn',          url: 'https://news.ltn.com.tw/rss/all.xml' },
  { name: 'pts',          url: 'https://news.pts.org.tw/xml/newsfeed.xml' },
  { name: 'newtalk',      url: 'https://newtalk.tw/rss/all' },
  { name: 'pchome',       url: 'https://news.pchome.com.tw/rss', parser: 'pchome' },

  // 美食/餐飲相關
  { name: 'newsmarket',   url: 'https://www.newsmarket.com.tw/feed/' },
  { name: 'google_food',  url: 'https://news.google.com/rss/search?q=%E7%BE%8E%E9%A3%9F+OR+%E9%A4%90%E5%BB%B3+OR+%E9%A3%9F%E5%AE%89&hl=zh-TW&gl=TW&ceid=TW:zh-Hant' },
  { name: 'google_resto', url: 'https://news.google.com/rss/search?q=%E6%96%B0%E9%96%8B%E5%B9%95+OR+%E5%BF%85%E5%90%83+OR+%E5%B0%8F%E5%90%83+OR+%E7%B1%B3%E5%85%B6%E6%9E%97&hl=zh-TW&gl=TW&ceid=TW:zh-Hant' },
];
