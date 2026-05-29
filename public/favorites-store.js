// 共用收藏模組（主頁與我的最愛頁面都會用）
// localStorage key: 'tw-news-favorites'
// 結構: { [url]: { id, url, title, savedAt } }
(function () {
  const KEY = 'tw-news-favorites';

  function read() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return (parsed && typeof parsed === 'object') ? parsed : {};
    } catch { return {}; }
  }

  function write(map) {
    localStorage.setItem(KEY, JSON.stringify(map));
    // 通知本頁其他元件（storage event 預設不會在同一個 tab 觸發）
    window.dispatchEvent(new CustomEvent('favorites:changed'));
  }

  function has(url) { return !!read()[url]; }

  function toggle({ id, url, title }) {
    const map = read();
    if (map[url]) {
      delete map[url];
    } else {
      map[url] = { id, url, title, savedAt: Date.now() };
    }
    write(map);
    return !!map[url];
  }

  function list() {
    return Object.values(read()).sort((a, b) => b.savedAt - a.savedAt);
  }

  function count() { return Object.keys(read()).length; }

  function remove(url) {
    const map = read();
    if (map[url]) {
      delete map[url];
      write(map);
    }
  }

  window.Favorites = { has, toggle, list, count, remove };
})();
