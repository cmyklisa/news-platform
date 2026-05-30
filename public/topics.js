const listEl = document.getElementById('tpList');
const resultsEl = document.getElementById('tpResults');
const statusEl = document.getElementById('status');

function escapeHTML(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

let currentWord = null;

async function loadKeywords() {
  statusEl.textContent = '載入中…';
  try {
    const r = await fetch('/api/keywords?limit=30');
    const data = await r.json();
    const items = data.items || [];
    listEl.innerHTML = items.map((it, i) => `
      <li class="tp-item ${i < 3 ? 'top' : ''}" data-word="${escapeHTML(it.word)}">
        <span class="tp-rank">${i + 1}</span>
        <span class="tp-word">${escapeHTML(it.word)}</span>
        <span class="tp-count">${it.count}</span>
      </li>
    `).join('');
    listEl.querySelectorAll('.tp-item').forEach(li => {
      li.addEventListener('click', () => selectWord(li.dataset.word));
    });
    statusEl.textContent = `${items.length} 個關鍵字 · ${data.date}`;
  } catch (err) {
    statusEl.textContent = '載入失敗';
    listEl.innerHTML = `<li class="empty">無法載入</li>`;
  }
}

async function selectWord(word) {
  currentWord = word;
  listEl.querySelectorAll('.tp-item').forEach(li => {
    li.classList.toggle('active', li.dataset.word === word);
  });
  resultsEl.innerHTML = `<div class="tp-loading">載入「${escapeHTML(word)}」相關報導…</div>`;
  try {
    const r = await fetch(`/api/keywords/headlines?word=${encodeURIComponent(word)}&limit=200`);
    const data = await r.json();
    const items = data.items || [];
    renderResults(word, items);
  } catch (err) {
    resultsEl.innerHTML = `<div class="empty">載入失敗</div>`;
  }
}

function renderResults(word, items) {
  if (items.length === 0) {
    resultsEl.innerHTML = `<div class="empty">「${escapeHTML(word)}」今日沒有相關報導</div>`;
    return;
  }

  // 依 cluster_id 分組：同一事件多家報導擺一起
  const clusters = new Map();
  const solos = [];
  for (const it of items) {
    if (it.cluster_id != null) {
      if (!clusters.has(it.cluster_id)) clusters.set(it.cluster_id, []);
      clusters.get(it.cluster_id).push(it);
    } else {
      solos.push(it);
    }
  }

  // 多家報導的 cluster 排前面，依來源/則數排
  const multiClusters = [...clusters.values()].filter(arr => arr.length > 1);
  const singleClusters = [...clusters.values()].filter(arr => arr.length === 1).flat();
  multiClusters.sort((a, b) => b.length - a.length);

  const SOURCE = (window.SOURCE_NAMES) || {
    google_tw: 'Google 新聞', ltn: '自由時報', pts: '公視新聞',
    newtalk: 'Newtalk', pchome: 'PChome 新聞',
  };

  const sourceName = c => SOURCE[c] || c;

  const eventCards = multiClusters.map(group => {
    const rep = group[0]; // 最新一則代表
    return `
      <article class="tp-event" data-id="${rep.id}" data-url="${escapeHTML(rep.url)}">
        <div class="tp-event-head">
          <span class="tp-event-badge">同一事件 · ${group.length} 家媒體</span>
          <h3 class="tp-event-title">${window.highlightBiasText(rep.title)}</h3>
        </div>
        <div class="tp-event-others">
          ${group.slice(1).map(it => `
            <a class="tp-sibling" href="${escapeHTML(it.url)}" target="_blank" rel="noopener" data-id="${it.id}">
              <span class="tp-sib-src">${escapeHTML(sourceName(it.source))}</span>
              <span class="tp-sib-title">${window.highlightBiasText(it.title)}</span>
            </a>
          `).join('')}
        </div>
      </article>
    `;
  }).join('');

  const soloList = [...singleClusters, ...solos];
  const soloCards = soloList.length === 0 ? '' : `
    <div class="tp-solo-section">
      <h3 class="tp-solo-head">其他相關報導 · ${soloList.length} 則</h3>
      <div class="tp-solo-grid">
        ${soloList.map(it => `
          <article class="tp-solo" data-id="${it.id}" data-url="${escapeHTML(it.url)}">
            <span class="tp-solo-src">${escapeHTML(sourceName(it.source))}</span>
            <span class="tp-solo-title">${window.highlightBiasText(it.title)}</span>
          </article>
        `).join('')}
      </div>
    </div>
  `;

  resultsEl.innerHTML = `
    <div class="tp-results-head">
      <h2>關於「<span class="tp-results-word">${escapeHTML(word)}</span>」</h2>
      <div class="tp-results-meta">
        共 ${items.length} 則 · ${multiClusters.length} 個事件被多家報導
      </div>
    </div>
    ${eventCards}
    ${soloCards}
  `;

  resultsEl.querySelectorAll('.tp-event, .tp-solo').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.tp-sibling')) return;
      window.openDrawer(parseInt(card.dataset.id, 10), card.dataset.url);
    });
  });
  resultsEl.querySelectorAll('.tp-sibling').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      window.openDrawer(parseInt(el.dataset.id, 10), el.href);
    });
  });
}

loadKeywords();
setInterval(loadKeywords, 10 * 60 * 1000);
