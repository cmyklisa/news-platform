// 共用預覽抽屜（主頁與我的最愛頁面都用）
// 對外：window.openDrawer(id, fallbackUrl), window.closeDrawer(),
//      window.SOURCE_NAMES, window.sourceName(code), window.highlightBiasText(s)
(function () {
  const SOURCE_NAMES = {
    google_tw: 'Google 新聞',
    ltn:       '自由時報',
    pts:       '公視新聞',
    newtalk:   'Newtalk 新聞',
    pchome:    'PChome 新聞',
  };
  const BIAS_WORDS = (window.BIAS_WORDS || []).slice().sort((a, b) => b.length - a.length);
  const HEART_PATH = 'M12 21s-7-4.6-7-10.3A4.7 4.7 0 0 1 9.7 6c1.6 0 3 .8 3.8 2 .8-1.2 2.2-2 3.8-2A4.7 4.7 0 0 1 22 10.7C22 16.4 12 21 12 21z';

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeRegExp(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function highlight(text) {
    let safe = escapeHTML(text || '');
    for (const w of BIAS_WORDS) {
      if (!w) continue;
      safe = safe.replace(new RegExp(escapeRegExp(w), 'g'), `<span class="bias">${w}</span>`);
    }
    return safe;
  }
  function sourceName(code) { return SOURCE_NAMES[code] || code; }
  function formatFullTime(ms) {
    const d = new Date(ms);
    const p = n => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }

  // ----- inject drawer DOM -----
  const root = document.createElement('aside');
  root.id = 'drawer';
  root.className = 'drawer';
  root.setAttribute('aria-hidden', 'true');
  root.innerHTML = `
    <div class="drawer-backdrop"></div>
    <div class="drawer-panel" role="dialog" aria-labelledby="drawerTitle">
      <header class="drawer-head">
        <div class="drawer-meta">
          <span class="drawer-source" id="drawerSource" hidden></span>
          <span class="drawer-time" id="drawerTime" hidden></span>
        </div>
        <div class="drawer-head-actions">
          <button class="drawer-fav" type="button" aria-label="收藏">
            <svg viewBox="0 0 24 24" width="14" height="14"><path d="${HEART_PATH}" fill="none" stroke="currentColor" stroke-width="2"/></svg>
          </button>
          <button class="drawer-x" type="button" aria-label="關閉">✕</button>
        </div>
      </header>
      <div class="drawer-body">
        <h2 id="drawerTitle" class="drawer-title"></h2>
        <div id="drawerSummary" class="drawer-summary"></div>
        <section class="drawer-others" id="drawerOthers" hidden>
          <h3>其他媒體怎麼說 <span class="count" id="drawerOthersCount">0</span></h3>
          <ul id="drawerOthersList"></ul>
        </section>
      </div>
      <footer class="drawer-foot">
        <button class="drawer-secondary" type="button">關閉</button>
        <a class="drawer-primary" id="drawerPrimary" target="_blank" rel="noopener">看全文 →</a>
      </footer>
    </div>
  `;
  document.body.appendChild(root);

  const elSource = root.querySelector('#drawerSource');
  const elTime = root.querySelector('#drawerTime');
  const elTitle = root.querySelector('#drawerTitle');
  const elSummary = root.querySelector('#drawerSummary');
  const elOthers = root.querySelector('#drawerOthers');
  const elOthersCount = root.querySelector('#drawerOthersCount');
  const elOthersList = root.querySelector('#drawerOthersList');
  const elPrimary = root.querySelector('#drawerPrimary');
  const elFavBtn = root.querySelector('.drawer-fav');
  let currentHeadline = null;

  function close() {
    root.classList.remove('open');
    root.setAttribute('aria-hidden', 'true');
  }
  root.querySelector('.drawer-backdrop').addEventListener('click', close);
  root.querySelector('.drawer-x').addEventListener('click', close);
  root.querySelector('.drawer-secondary').addEventListener('click', close);
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape' && root.classList.contains('open')) close();
  });

  function syncFavBtn() {
    if (!currentHeadline) return;
    const fav = window.Favorites && window.Favorites.has(currentHeadline.url);
    elFavBtn.classList.toggle('on', !!fav);
    const path = elFavBtn.querySelector('svg path');
    if (path) path.setAttribute('fill', fav ? 'currentColor' : 'none');
  }
  elFavBtn.addEventListener('click', () => {
    if (!currentHeadline || !window.Favorites) return;
    window.Favorites.toggle({
      id: currentHeadline.id,
      url: currentHeadline.url,
      title: currentHeadline.title,
    });
    syncFavBtn();
  });
  window.addEventListener('favorites:changed', syncFavBtn);

  async function open(id, fallbackUrl) {
    currentHeadline = null;
    elTitle.textContent = '載入中…';
    elSummary.textContent = '';
    elSummary.classList.remove('empty');
    elSource.textContent = '';
    elTime.textContent = '';
    elOthers.hidden = true;
    elPrimary.href = fallbackUrl || '#';
    elFavBtn.classList.remove('on');
    root.classList.add('open');
    root.setAttribute('aria-hidden', 'false');

    try {
      const r = await fetch(`/api/headline/${id}`);
      if (!r.ok) throw new Error('not found');
      const { headline, siblings } = await r.json();
      currentHeadline = headline;

      // 來源/時間：有才顯示，否則隱藏整個欄位
      if (headline.source) {
        elSource.textContent = sourceName(headline.source);
        elSource.hidden = false;
      } else {
        elSource.hidden = true;
      }
      if (headline.published_at) {
        elTime.textContent = formatFullTime(headline.published_at);
        elTime.hidden = false;
      } else {
        elTime.hidden = true;
      }
      elTitle.innerHTML = highlight(headline.title);
      elPrimary.href = headline.url;

      // 摘要為空就完全不顯示
      if (headline.summary && headline.summary.trim()) {
        elSummary.innerHTML = highlight(headline.summary);
        elSummary.hidden = false;
      } else {
        elSummary.innerHTML = '';
        elSummary.hidden = true;
      }

      if (siblings && siblings.length > 0) {
        elOthersCount.textContent = siblings.length;
        elOthersList.innerHTML = siblings.map(s => `
          <li>
            <a href="${escapeHTML(s.url)}" target="_blank" rel="noopener">
              ${highlight(s.title)}
              <div class="alt-meta">
                <span class="alt-source">${escapeHTML(sourceName(s.source))}</span>
                <span>${formatFullTime(s.published_at)}</span>
              </div>
            </a>
          </li>
        `).join('');
        elOthers.hidden = false;
      } else {
        elOthers.hidden = true;
      }
      syncFavBtn();
    } catch (err) {
      elTitle.textContent = '載入失敗';
      elSummary.textContent = (err && err.message) || '無法取得這則新聞的詳細資料。';
      elSummary.classList.add('empty');
    }
  }

  window.openDrawer = open;
  window.closeDrawer = close;
  window.SOURCE_NAMES = SOURCE_NAMES;
  window.sourceName = sourceName;
  window.highlightBiasText = highlight;
  window.formatFullTime = formatFullTime;
})();
