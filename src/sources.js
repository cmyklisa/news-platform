// 每個來源可選擇性指定 parser='pchome' 走自訂解析
module.exports = [
  { name: 'google_tw',    url: 'https://news.google.com/rss?hl=zh-TW&gl=TW&ceid=TW:zh-Hant' },
  { name: 'ltn',          url: 'https://news.ltn.com.tw/rss/all.xml' },
  { name: 'pts',          url: 'https://news.pts.org.tw/xml/newsfeed.xml' },
  { name: 'newtalk',      url: 'https://newtalk.tw/rss/all' },
  { name: 'pchome',       url: 'https://news.pchome.com.tw/rss', parser: 'pchome' },

  // 國際 / 美國 / 大陸 / 政策 — Google News topic 來源
  { name: 'gn_world',  url: 'https://news.google.com/rss/search?q=%E5%9C%8B%E9%9A%9B+OR+%E6%97%A5%E6%9C%AC+OR+%E9%9F%93%E5%9C%8B+OR+%E6%AD%90%E7%9B%9F+OR+%E4%BF%84%E7%BE%85%E6%96%AF+OR+%E7%83%8F%E5%85%8B%E8%98%AD+OR+%E4%BB%A5%E8%89%B2%E5%88%97&hl=zh-TW&gl=TW&ceid=TW:zh-Hant' },
  { name: 'gn_usa',    url: 'https://news.google.com/rss/search?q=%E7%BE%8E%E5%9C%8B+OR+%E5%B7%9D%E6%99%AE+OR+%E7%99%BD%E5%AE%AE+OR+%E8%81%AF%E6%BA%96%E6%9C%83+OR+%E8%8F%AF%E5%BA%9C+OR+FBI&hl=zh-TW&gl=TW&ceid=TW:zh-Hant' },
  { name: 'gn_cross',  url: 'https://news.google.com/rss/search?q=%E5%85%A9%E5%B2%B8+OR+%E5%A4%A7%E9%99%B8+OR+%E5%9C%8B%E5%8F%B0%E8%BE%A6+OR+%E5%85%B1%E8%BB%8D+OR+%E7%BF%92%E8%BF%91%E5%B9%B3&hl=zh-TW&gl=TW&ceid=TW:zh-Hant' },
  { name: 'gn_policy', url: 'https://news.google.com/rss/search?q=%E8%A1%8C%E6%94%BF%E9%99%A2+OR+%E7%AB%8B%E6%B3%95%E9%99%A2+OR+%E6%94%BF%E7%AD%96+OR+%E4%BF%AE%E6%B3%95+OR+%E9%A0%90%E7%AE%97+OR+%E6%B3%95%E6%A1%88&hl=zh-TW&gl=TW&ceid=TW:zh-Hant' },
  // BBC 中文（國際視角）
  { name: 'bbc_zh',    url: 'https://feeds.bbci.co.uk/zhongwen/trad/rss.xml' },

  // 美食/餐飲相關
  { name: 'newsmarket',   url: 'https://www.newsmarket.com.tw/feed/' },
  { name: 'google_food',  url: 'https://news.google.com/rss/search?q=%E7%BE%8E%E9%A3%9F+OR+%E9%A4%90%E5%BB%B3+OR+%E9%A3%9F%E5%AE%89&hl=zh-TW&gl=TW&ceid=TW:zh-Hant' },
  { name: 'google_resto', url: 'https://news.google.com/rss/search?q=%E6%96%B0%E9%96%8B%E5%B9%95+OR+%E5%BF%85%E5%90%83+OR+%E5%B0%8F%E5%90%83+OR+%E7%B1%B3%E5%85%B6%E6%9E%97&hl=zh-TW&gl=TW&ceid=TW:zh-Hant' },

  // 天氣/災害（颱風、地震、豪雨、氣象預報）
  { name: 'google_wx',    url: 'https://news.google.com/rss/search?q=%E9%A2%B1%E9%A2%A8+OR+%E6%B0%A3%E8%B1%A1%E7%BD%B2+OR+%E5%A4%A9%E6%B0%A3%E9%A0%90%E5%A0%B1+OR+%E8%B1%AA%E9%9B%A8+OR+%E5%A4%A7%E9%9B%A8%E7%89%B9%E5%A0%B1&hl=zh-TW&gl=TW&ceid=TW:zh-Hant' },
  { name: 'google_quake', url: 'https://news.google.com/rss/search?q=%E5%9C%B0%E9%9C%87+OR+%E9%A4%98%E9%9C%87+OR+%E9%9C%87%E5%BA%A6+OR+%E6%B5%B7%E5%98%AF&hl=zh-TW&gl=TW&ceid=TW:zh-Hant' },

  // 影音新聞：以 Google News 過濾 site:youtube.com，命中各大新聞台官方上傳
  { name: 'gn_yt_news',    url: 'https://news.google.com/rss/search?q=site%3Ayoutube.com+%E6%96%B0%E8%81%9E&hl=zh-TW&gl=TW&ceid=TW:zh-Hant' },
  { name: 'gn_yt_taiwan',  url: 'https://news.google.com/rss/search?q=site%3Ayoutube.com+%E5%8F%B0%E7%81%A3&hl=zh-TW&gl=TW&ceid=TW:zh-Hant' },
  { name: 'gn_yt_politic', url: 'https://news.google.com/rss/search?q=site%3Ayoutube.com+%E7%B8%BD%E7%B5%B1+OR+%E7%AB%8B%E5%A7%94+OR+%E6%94%BF%E5%BA%9C&hl=zh-TW&gl=TW&ceid=TW:zh-Hant' },
];
