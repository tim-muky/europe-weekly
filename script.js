'use strict';

/* =============================================
   Europe Weekly – CMS engine + page renderers
   ============================================= */

// ── DATA LAYER ────────────────────────────────

const CMS_KEY = 'ew-cms-data';

async function getData() {
  // Load whatever is cached locally first
  const raw = localStorage.getItem(CMS_KEY);
  let local = null;
  if (raw) { try { local = JSON.parse(raw); } catch (e) { /* corrupt */ } }

  // Always fetch content.json and compare versions so bot-published updates
  // propagate to returning visitors automatically.
  try {
    const res    = await fetch('content.json?v=' + Date.now());
    const remote = await res.json();
    if (!local || (remote.version || 0) > (local.version || 0)) {
      localStorage.setItem(CMS_KEY, JSON.stringify(remote));
      return remote;
    }
  } catch (e) { /* offline – keep cached copy */ }

  return local || {};
}

function setData(data) {
  // Stamp with current time so local admin edits are not overwritten by an
  // older published content.json.
  data.version = Date.now();
  try {
    localStorage.setItem(CMS_KEY, JSON.stringify(data));
  } catch (e) {
    alert('Could not save — storage is full. Use an image URL instead of uploading large files directly.');
  }
}

// ── IMAGE COMPRESSION ─────────────────────────

function compressImage(file, maxPx = 1920, quality = 0.85) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const ratio  = Math.min(1, maxPx / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width  = Math.round(img.width  * ratio);
        canvas.height = Math.round(img.height * ratio);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// ── HELPERS ───────────────────────────────────

function catLabel(data, id) { return data.categories.find(c => c.id === id)?.label ?? id; }

function tagsHTML(data, ids) {
  return (ids || []).map(id =>
    `<a href="category.html?id=${encodeURIComponent(id)}" class="tag">${catLabel(data, id)}</a>`
  ).join('');
}

function slugId() { return Math.random().toString(36).slice(2, 9); }

function escHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function fmtTime(s) {
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(Math.floor(s % 60)).padStart(2, '0');
}

function textToHTML(str) {
  return (str || '').split(/\n\n+/)
    .map(p => `<p>${escHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

// ── SOCIAL ICONS ──────────────────────────────

const ICON_INSTAGRAM = `<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>`;

const ICON_X = `<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" aria-hidden="true"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.258 5.625L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/></svg>`;

const ICON_YOUTUBE = `<svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22" aria-hidden="true"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>`;

// ── FOOTER ────────────────────────────────────

function renderFooter(data) {
  const social  = data.settings?.social || {};
  const socialEl = document.getElementById('footer-social');
  if (!socialEl) return;
  const links = [];
  if (social.instagram) links.push(`<a href="${escHtml(social.instagram)}" target="_blank" rel="noopener" class="social-link" aria-label="Instagram">${ICON_INSTAGRAM}</a>`);
  if (social.x)         links.push(`<a href="${escHtml(social.x)}"         target="_blank" rel="noopener" class="social-link" aria-label="X (Twitter)">${ICON_X}</a>`);
  if (social.youtube)   links.push(`<a href="${escHtml(social.youtube)}"   target="_blank" rel="noopener" class="social-link" aria-label="YouTube">${ICON_YOUTUBE}</a>`);
  socialEl.innerHTML = links.join('');
}

// ── BAR CHART ─────────────────────────────────

function drawBarChart(canvasId, values, labels) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  const padL = 34, padB = 32, padT = 14, padR = 10;
  const chartW = W - padL - padR, chartH = H - padB - padT;
  const colors = ['#5ec8b8', '#1c6080', '#122c4a', '#8adeca'];
  const maxVal = Math.max(...values) * 1.15;

  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.5;
  ctx.fillStyle = '#555'; ctx.font = '9px Arial'; ctx.textAlign = 'right';
  for (let i = 0; i <= 5; i++) {
    const val = Math.round((maxVal / 5) * i);
    const y   = padT + chartH - (i / 5) * chartH;
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(padL + chartW, y); ctx.stroke();
    ctx.fillText(val, padL - 4, y + 3);
  }
  const bw = (chartW / values.length) * 0.5;
  values.forEach((val, i) => {
    const gw = chartW / values.length;
    const bh = (val / maxVal) * chartH;
    const x  = padL + i * gw + (gw - bw) / 2;
    const y  = padT + chartH - bh;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(x, y, bw, bh);
    ctx.fillStyle = '#333'; ctx.font = 'bold 9px Arial'; ctx.textAlign = 'center';
    ctx.fillText(val, x + bw / 2, y - 3);
    ctx.fillStyle = '#555'; ctx.font = '9px Arial';
    ctx.fillText(labels[i] || '', x + bw / 2, padT + chartH + 16);
  });
  ctx.strokeStyle = '#999'; ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padL, padT); ctx.lineTo(padL, padT + chartH); ctx.lineTo(padL + chartW, padT + chartH);
  ctx.stroke();
}

// ── AUDIO PLAYER ─────────────────────────────

function playerHTML(prefix) {
  return `
    <div class="audio-player">
      <div class="progress-bar-wrap">
        <div class="progress-bar" id="${prefix}progressBar">
          <div class="progress-fill"  id="${prefix}progressFill"></div>
          <div class="progress-thumb" id="${prefix}progressThumb"></div>
        </div>
        <div class="time-display">
          <span id="${prefix}currentTime">00:00</span>
          <span id="${prefix}duration">-00:00</span>
        </div>
      </div>
      <div class="controls">
        <button class="ctrl-btn" id="${prefix}prevBtn" aria-label="Previous">
          <svg viewBox="0 0 24 24" width="28" height="28"><path d="M6 6h2v12H6zm3.5 6 8.5 6V6z"/></svg>
        </button>
        <button class="ctrl-btn play-btn" id="${prefix}playBtn" aria-label="Play/Pause">
          <svg viewBox="0 0 24 24" width="36" height="36" id="${prefix}playIcon"><path d="M8 5v14l11-7z"/></svg>
          <svg viewBox="0 0 24 24" width="36" height="36" id="${prefix}pauseIcon" style="display:none"><path d="M6 19h4V5H6zm8-14v14h4V5z"/></svg>
        </button>
        <button class="ctrl-btn" id="${prefix}nextBtn" aria-label="Next">
          <svg viewBox="0 0 24 24" width="28" height="28"><path d="M6 18l8.5-6L6 6zm2.5-6 8.5 6V6z"/><path d="M16 6h2v12h-2z"/></svg>
        </button>
      </div>
    </div>`;
}

function initPlayer(total, prefix) {
  const playBtn   = document.getElementById(prefix + 'playBtn');
  const playIcon  = document.getElementById(prefix + 'playIcon');
  const pauseIcon = document.getElementById(prefix + 'pauseIcon');
  const fill      = document.getElementById(prefix + 'progressFill');
  const thumb     = document.getElementById(prefix + 'progressThumb');
  const curEl     = document.getElementById(prefix + 'currentTime');
  const durEl     = document.getElementById(prefix + 'duration');
  const bar       = document.getElementById(prefix + 'progressBar');
  if (!playBtn) return;

  let elapsed = 0, playing = false, timer = null;
  function ui() {
    const pct = total ? (elapsed / total) * 100 : 0;
    fill.style.width = pct + '%'; thumb.style.left = pct + '%';
    curEl.textContent = fmtTime(elapsed);
    durEl.textContent = '-' + fmtTime(total - elapsed);
  }
  function pause() { playing = false; playIcon.style.display = 'block'; pauseIcon.style.display = 'none'; clearInterval(timer); }
  function play()  { playing = true;  playIcon.style.display = 'none';  pauseIcon.style.display = 'block';
    timer = setInterval(() => { elapsed < total ? (elapsed++, ui()) : pause(); }, 1000); }

  playBtn.addEventListener('click', () => playing ? pause() : play());
  const prev = document.getElementById(prefix + 'prevBtn');
  const next = document.getElementById(prefix + 'nextBtn');
  if (prev) prev.addEventListener('click', () => { pause(); elapsed = 0; ui(); });
  if (next) next.addEventListener('click', () => { pause(); elapsed = 0; ui(); });
  if (bar)  bar.addEventListener('click', e => {
    const r = bar.getBoundingClientRect();
    elapsed = Math.round(((e.clientX - r.left) / r.width) * total); ui();
  });
  ui();
}

// ── NAV ───────────────────────────────────────

function renderNav(data) {
  const al = document.getElementById('nav-articles');
  const el = document.getElementById('nav-episodes');
  if (al) al.innerHTML = data.articles.map(a => `<li><a href="article.html?id=${a.id}">${escHtml(a.title)}</a></li>`).join('');
  if (el) el.innerHTML = data.episodes.map(e => `<li><a href="episodes.html">${escHtml(e.title)}</a></li>`).join('');
}

// ── HOME ──────────────────────────────────────

async function initHome() {
  const data = await getData();
  renderNav(data);
  renderFooter(data);

  // Apply background image from settings
  const bgImg = data.settings?.backgroundImage;
  if (bgImg) {
    const header = document.querySelector('.site-header');
    if (header) header.style.backgroundImage = `url('${bgImg}')`;
  }

  const art = data.articles[0];
  if (art) {
    const tl = document.getElementById('preview-title-link');
    if (tl) tl.href = `article.html?id=${art.id}`;
    const te = document.getElementById('preview-title');
    if (te) te.textContent = art.title;
    document.getElementById('preview-tags').innerHTML    = tagsHTML(data, art.categories);
    document.getElementById('preview-excerpt').textContent = art.excerpt;
    document.getElementById('preview-body').textContent    = art.body;
    document.getElementById('preview-more').href = `article.html?id=${art.id}`;
    if (art.chartData) drawBarChart('homeChart', art.chartData.values, art.chartData.labels);
  }

  const ep = data.episodes[0];
  if (ep) {
    document.getElementById('ep-title').textContent = ep.title;
    document.getElementById('ep-tags').innerHTML    = tagsHTML(data, ep.categories);
    const epTitleLink = document.getElementById('ep-title-link');
    if (epTitleLink) epTitleLink.href = `episode.html?id=${ep.id}`;
    const listenLink = document.getElementById('ep-listen');
    if (listenLink) listenLink.href = `episode.html?id=${ep.id}`;
    const wrap = document.getElementById('ep-player-wrap');
    if (wrap) { wrap.innerHTML = playerHTML('ep-'); initPlayer(ep.duration, 'ep-'); }
  }
}

// ── ARTICLE DETAIL ────────────────────────────

async function initArticle() {
  const data = await getData();
  renderNav(data);
  renderFooter(data);

  const id  = new URLSearchParams(location.search).get('id') ?? data.articles[0]?.id;
  const art = data.articles.find(a => a.id === id);
  if (!art) { document.getElementById('article-content').innerHTML = '<p>Article not found.</p>'; return; }

  document.title = art.title + ' – Europe Weekly';
  document.getElementById('article-title').textContent   = art.title;
  document.getElementById('article-tags').innerHTML      = tagsHTML(data, art.categories);
  document.getElementById('article-excerpt').textContent = art.excerpt;
  document.getElementById('article-body').textContent    = art.body;

  const cs = document.getElementById('chart-section');
  if (art.chartData && cs) { cs.style.display = ''; drawBarChart('articleChart', art.chartData.values, art.chartData.labels); }

  const kwEl = document.getElementById('article-keywords');
  if (kwEl) {
    const kws = (art.keywords || '').split(',').map(k => k.trim()).filter(Boolean);
    kwEl.innerHTML   = kws.length ? kws.map(k => `<span class="keyword">${escHtml(k)}</span>`).join('') : '';
    kwEl.style.display = kws.length ? '' : 'none';
  }
  const srcEl = document.getElementById('article-sources');
  if (srcEl) {
    srcEl.style.display = art.sources ? '' : 'none';
    srcEl.innerHTML = art.sources
      ? `<h3 class="sources-heading">Sources</h3><p class="sources-text">${escHtml(art.sources)}</p>` : '';
  }
}

// ── ARTICLES LIST ─────────────────────────────

async function initArticlesList() {
  const data = await getData();
  renderFooter(data);
  const container = document.getElementById('articles-list');
  container.innerHTML = data.articles.length
    ? data.articles.map(a => `
        <div class="cat-item">
          <a href="article.html?id=${a.id}" class="cat-item-title">${escHtml(a.title)}</a>
          <div class="cat-item-tags">${tagsHTML(data, a.categories)}</div>
          <p class="cat-item-excerpt">${escHtml(a.excerpt)}</p>
        </div>`).join('')
    : '<p class="no-results">No articles yet.</p>';
}

// ── EPISODES LIST ─────────────────────────────

async function initEpisodesList() {
  const data = await getData();
  renderFooter(data);
  const container = document.getElementById('episodes-list');
  container.innerHTML = data.episodes.length
    ? data.episodes.map(ep => `
        <a href="episode.html?id=${ep.id}" class="ep-list-card">
          ${ep.coverArt ? `<img class="ep-list-thumb" src="${escHtml(ep.coverArt)}" alt="" />` : ''}
          <div class="ep-list-body">
            <span class="episode-badge">S${ep.season || 1} · E${ep.episodeNumber || 1}</span>
            <span class="ep-list-title">${escHtml(ep.title)}</span>
            <div class="cat-item-tags">${tagsHTML(data, ep.categories)}</div>
            ${ep.notes ? `<p class="ep-list-notes">${escHtml(ep.notes.slice(0, 120))}${ep.notes.length > 120 ? '…' : ''}</p>` : ''}
          </div>
        </a>`).join('')
    : '<p class="no-results">No episodes yet.</p>';
}

// ── CATEGORY ─────────────────────────────────

async function initCategory() {
  const data  = await getData();
  renderFooter(data);
  const id    = new URLSearchParams(location.search).get('id');
  const cat   = data.categories.find(c => c.id === id);
  const label = cat?.label ?? id ?? 'Category';

  document.title = label + ' – Europe Weekly';
  document.getElementById('cat-heading').textContent = label;

  const arts = data.articles.filter(a => a.categories.includes(id));
  const eps  = data.episodes.filter(e => e.categories.includes(id));

  document.getElementById('cat-articles').innerHTML = arts.length
    ? arts.map(a => `<div class="cat-item"><a href="article.html?id=${a.id}" class="cat-item-title">${escHtml(a.title)}</a><div class="cat-item-tags">${tagsHTML(data, a.categories)}</div><p class="cat-item-excerpt">${escHtml(a.excerpt)}</p></div>`).join('')
    : '<p class="no-results">No articles in this category.</p>';

  document.getElementById('cat-episodes').innerHTML = eps.length
    ? eps.map(e => `<div class="cat-item cat-item--episode"><a href="episode.html?id=${e.id}" class="cat-item-title">${escHtml(e.title)}</a><div class="cat-item-tags">${tagsHTML(data, e.categories)}</div></div>`).join('')
    : '<p class="no-results">No episodes in this category.</p>';
}

// ── STATIC PAGES (About / Imprint) ───────────

async function initPage(pageKey, titleText) {
  const data = await getData();
  renderFooter(data);
  document.title = titleText + ' – Europe Weekly';
  const el = document.getElementById('page-content');
  if (el) el.innerHTML = textToHTML(data.pages?.[pageKey] || '');
}

// ── EPISODE DETAIL ────────────────────────────

async function initEpisodePage() {
  const data = await getData();
  renderFooter(data);

  const id = new URLSearchParams(location.search).get('id') ?? data.episodes[0]?.id;
  const ep = data.episodes.find(e => e.id === id);
  if (!ep) {
    const el = document.getElementById('episode-content');
    if (el) el.innerHTML = '<p style="color:#8ab4cc;padding:20px">Episode not found.</p>';
    return;
  }

  document.title = ep.title + ' – Europe Weekly';

  const coverEl = document.getElementById('episode-cover');
  if (coverEl) { coverEl.src = ep.coverArt || ''; coverEl.style.display = ep.coverArt ? '' : 'none'; }

  document.getElementById('episode-badge').textContent  = `S${ep.season || 1} · E${ep.episodeNumber || 1}`;
  document.getElementById('episode-title').textContent  = ep.title;
  document.getElementById('episode-tags').innerHTML     = tagsHTML(data, ep.categories);

  const wrap = document.getElementById('episode-player-wrap');
  if (wrap) { wrap.innerHTML = playerHTML('ep-single-'); initPlayer(ep.duration, 'ep-single-'); }

  const kwEl = document.getElementById('episode-keywords');
  if (kwEl) {
    const kws = (ep.keywords || '').split(',').map(k => k.trim()).filter(Boolean);
    kwEl.innerHTML   = kws.length ? kws.map(k => `<span class="keyword">${escHtml(k)}</span>`).join('') : '';
    kwEl.style.display = kws.length ? '' : 'none';
  }

  const notesEl = document.getElementById('episode-notes');
  if (notesEl) { notesEl.textContent = ep.notes || ''; notesEl.style.display = ep.notes ? '' : 'none'; }
}

// ── ADMIN ─────────────────────────────────────

async function initAdmin() {
  let data = await getData();
  renderFooter(data);

  function save() { setData(data); }

  function showSaved(btn) {
    const orig = btn.textContent;
    btn.textContent = 'Saved ✓'; btn.style.background = '#27ae60';
    setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 1500);
  }

  // ── Settings ────────────────────────────────

  function renderSettings() {
    const s      = data.settings || {};
    const social = s.social || {};
    const pages  = data.pages || {};
    const bgUrl  = document.getElementById('settings-bg-url');
    const bgPrev = document.getElementById('settings-bg-preview');
    bgUrl.value = s.backgroundImage || '';
    bgPrev.src  = s.backgroundImage || '';
    bgPrev.style.display = s.backgroundImage ? '' : 'none';
    document.getElementById('settings-instagram').value = social.instagram || '';
    document.getElementById('settings-x').value         = social.x         || '';
    document.getElementById('settings-youtube').value   = social.youtube   || '';
    document.getElementById('settings-about').value   = pages.about   || '';
    document.getElementById('settings-imprint').value = pages.imprint || '';
  }

  // Background image upload
  const bgFile = document.getElementById('settings-bg-file');
  const bgUrl  = document.getElementById('settings-bg-url');
  const bgPrev = document.getElementById('settings-bg-preview');
  bgFile.addEventListener('change', async () => {
    const file = bgFile.files[0]; if (!file) return;
    const dataUrl = await compressImage(file, 1920, 0.85);
    bgUrl.value = dataUrl; bgPrev.src = dataUrl; bgPrev.style.display = '';
  });
  bgUrl.addEventListener('input', () => { bgPrev.src = bgUrl.value; bgPrev.style.display = bgUrl.value ? '' : 'none'; });

  document.getElementById('settings-save-btn').addEventListener('click', function () {
    data.settings = data.settings || {};
    data.settings.backgroundImage = bgUrl.value.trim();
    data.settings.social = {
      instagram: document.getElementById('settings-instagram').value.trim(),
      x:         document.getElementById('settings-x').value.trim(),
      youtube:   document.getElementById('settings-youtube').value.trim()
    };
    data.pages = data.pages || {};
    data.pages.about   = document.getElementById('settings-about').value;
    data.pages.imprint = document.getElementById('settings-imprint').value;
    save(); showSaved(this);
  });

  // ── Categories ──────────────────────────────

  function renderCategories() {
    const ul = document.getElementById('admin-cat-list');
    ul.innerHTML = '';
    data.categories.forEach(cat => {
      const li = document.createElement('li');
      li.className = 'admin-cat-row';
      li.innerHTML = `<input class="admin-input" type="text" value="${escHtml(cat.label)}" data-id="${cat.id}" /><button class="admin-btn admin-btn--danger" data-del="${cat.id}">Delete</button>`;
      ul.appendChild(li);
    });
    ul.querySelectorAll('input[data-id]').forEach(inp => {
      inp.addEventListener('change', () => {
        const c = data.categories.find(c => c.id === inp.dataset.id);
        if (c) { c.label = inp.value.trim(); save(); renderArticles(); renderEpisodes(); }
      });
    });
    ul.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.del;
        if (!confirm(`Delete category "${catLabel(data, id)}"?`)) return;
        data.categories = data.categories.filter(c => c.id !== id);
        data.articles.forEach(a => { a.categories = a.categories.filter(x => x !== id); });
        data.episodes.forEach(e => { e.categories = e.categories.filter(x => x !== id); });
        save(); renderCategories(); renderArticles(); renderEpisodes();
      });
    });
  }

  document.getElementById('add-cat-btn').addEventListener('click', () => {
    const inp = document.getElementById('new-cat-input');
    const label = inp.value.trim(); if (!label) return;
    data.categories.push({ id: 'cat-' + slugId(), label });
    inp.value = ''; save(); renderCategories(); renderArticles(); renderEpisodes();
  });

  // ── Articles ────────────────────────────────

  function catChecksHTML(selectedIds) {
    return data.categories.map(cat => `<label class="admin-check"><input type="checkbox" data-cat="${cat.id}" ${selectedIds.includes(cat.id) ? 'checked' : ''} />${escHtml(cat.label)}</label>`).join('');
  }
  function collectCategories(container) {
    const ids = []; container.querySelectorAll('[data-cat]:checked').forEach(cb => ids.push(cb.dataset.cat)); return ids;
  }

  function renderArticles() {
    const wrap = document.getElementById('admin-articles');
    wrap.innerHTML = '';
    data.articles.forEach(a => appendArticleCard(wrap, a));
  }

  function appendArticleCard(wrap, article, autoOpen = false) {
    const div = document.createElement('div');
    div.className = 'admin-item-card';
    const chartVals = article.chartData ? article.chartData.values.join(', ') : '';
    const chartLbls = article.chartData ? article.chartData.labels.join(', ')  : '';

    div.innerHTML = `
      <details class="admin-details" ${autoOpen ? 'open' : ''}>
        <summary class="admin-summary">${escHtml(article.title)}</summary>
        <div class="admin-form">
          <div class="admin-field"><label class="admin-label">Title</label>
            <input class="admin-input f-title" type="text" value="${escHtml(article.title)}" /></div>
          <div class="admin-field"><label class="admin-label">Excerpt <small>(intro paragraph)</small></label>
            <textarea class="admin-textarea f-excerpt" rows="4">${escHtml(article.excerpt)}</textarea></div>
          <div class="admin-field"><label class="admin-label">Body <small>(paragraph after chart)</small></label>
            <textarea class="admin-textarea f-body" rows="4">${escHtml(article.body)}</textarea></div>
          <div class="admin-field"><label class="admin-label">Chart values <small>(comma-separated numbers; leave blank to hide)</small></label>
            <input class="admin-input f-chart-vals" type="text" placeholder="e.g. 65, 42, 30, 88" value="${escHtml(chartVals)}" /></div>
          <div class="admin-field"><label class="admin-label">Chart labels <small>(comma-separated, one per value)</small></label>
            <input class="admin-input f-chart-lbls" type="text" placeholder="e.g. Germany, France, Italy, Spain" value="${escHtml(chartLbls)}" /></div>
          <div class="admin-field"><label class="admin-label">Keywords <small>(comma-separated)</small></label>
            <input class="admin-input f-keywords" type="text" placeholder="e.g. economy, trade, EU" value="${escHtml(article.keywords || '')}" /></div>
          <div class="admin-field"><label class="admin-label">Sources <small>(citations shown at bottom of article)</small></label>
            <textarea class="admin-textarea f-sources" rows="3" placeholder="e.g. European Commission 2024; Eurostat">${escHtml(article.sources || '')}</textarea></div>
          <div class="admin-field"><label class="admin-label">Categories</label>
            <div class="admin-checks">${catChecksHTML(article.categories)}</div></div>
          <div class="admin-item-actions">
            <button class="admin-btn admin-btn--primary btn-save">Save</button>
            <button class="admin-btn admin-btn--danger  btn-delete">Delete article</button>
          </div>
        </div>
      </details>`;

    div.querySelector('.btn-save').addEventListener('click', function () {
      article.title     = div.querySelector('.f-title').value.trim();
      article.excerpt   = div.querySelector('.f-excerpt').value.trim();
      article.body      = div.querySelector('.f-body').value.trim();
      article.keywords  = div.querySelector('.f-keywords').value.trim();
      article.sources   = div.querySelector('.f-sources').value.trim();
      const vStr = div.querySelector('.f-chart-vals').value.trim();
      const lStr = div.querySelector('.f-chart-lbls').value.trim();
      if (vStr) {
        const vals = vStr.split(',').map(v => parseFloat(v.trim())).filter(v => !isNaN(v));
        const lbls = lStr ? lStr.split(',').map(l => l.trim()) : vals.map((_, i) => `Element ${i + 1}`);
        article.chartData = { values: vals, labels: lbls };
      } else { article.chartData = null; }
      article.categories = collectCategories(div);
      div.querySelector('.admin-summary').textContent = article.title;
      save(); showSaved(this);
    });
    div.querySelector('.btn-delete').addEventListener('click', () => {
      if (!confirm(`Delete "${article.title}"?`)) return;
      data.articles = data.articles.filter(a => a.id !== article.id);
      save(); wrap.removeChild(div);
    });
    wrap.appendChild(div);
  }

  document.getElementById('add-article-btn').addEventListener('click', () => {
    const newArt = { id: 'article-' + slugId(), title: 'New Article', categories: [], excerpt: '', body: '', chartData: null, keywords: '', sources: '' };
    data.articles.push(newArt); save();
    const wrap = document.getElementById('admin-articles');
    appendArticleCard(wrap, newArt, true);
    wrap.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ── Episodes ────────────────────────────────

  function renderEpisodes() {
    const wrap = document.getElementById('admin-episodes');
    wrap.innerHTML = '';
    data.episodes.forEach(e => appendEpisodeCard(wrap, e));
  }

  function appendEpisodeCard(wrap, ep, autoOpen = false) {
    const div = document.createElement('div');
    div.className = 'admin-item-card';
    const mm = String(Math.floor(ep.duration / 60)).padStart(2, '0');
    const ss = String(ep.duration % 60).padStart(2, '0');

    div.innerHTML = `
      <details class="admin-details" ${autoOpen ? 'open' : ''}>
        <summary class="admin-summary">${escHtml(ep.title)}</summary>
        <div class="admin-form">
          <div class="admin-field"><label class="admin-label">Title</label>
            <input class="admin-input f-title" type="text" value="${escHtml(ep.title)}" /></div>
          <div class="admin-field"><label class="admin-label">Duration <small>(MM:SS)</small></label>
            <input class="admin-input f-duration" type="text" placeholder="03:46" value="${mm}:${ss}" style="max-width:110px" /></div>
          <div class="admin-field"><label class="admin-label">Audio file URL <small>(optional)</small></label>
            <input class="admin-input f-audio" type="text" placeholder="https://…/episode.mp3" value="${escHtml(ep.audioUrl || '')}" /></div>
          <div class="admin-field"><label class="admin-label">Cover Art</label>
            <div class="admin-cover-wrap">
              <img class="f-cover-preview admin-cover-preview" src="${escHtml(ep.coverArt || '')}" alt="preview" style="${ep.coverArt ? '' : 'display:none'}" />
              <input class="admin-input f-cover-url" type="text" placeholder="Image URL or upload below" value="${escHtml(ep.coverArt || '')}" />
              <label class="admin-btn admin-btn--secondary admin-upload-label">Upload image<input type="file" accept="image/*" class="f-cover-file" style="display:none" /></label>
            </div></div>
          <div class="admin-field admin-field--row">
            <div><label class="admin-label">Season</label><input class="admin-input f-season" type="number" min="1" value="${ep.season || 1}" style="max-width:90px" /></div>
            <div><label class="admin-label">Episode</label><input class="admin-input f-episode-num" type="number" min="1" value="${ep.episodeNumber || 1}" style="max-width:90px" /></div>
          </div>
          <div class="admin-field"><label class="admin-label">Keywords <small>(comma-separated)</small></label>
            <input class="admin-input f-keywords" type="text" placeholder="e.g. politics, EU, economy" value="${escHtml(ep.keywords || '')}" /></div>
          <div class="admin-field"><label class="admin-label">Episode Notes <small>(shown below player)</small></label>
            <textarea class="admin-textarea f-notes" rows="3" placeholder="Show notes…">${escHtml(ep.notes || '')}</textarea></div>
          <div class="admin-field"><label class="admin-label">Categories</label>
            <div class="admin-checks">${catChecksHTML(ep.categories)}</div></div>
          <div class="admin-item-actions">
            <button class="admin-btn admin-btn--primary btn-save">Save</button>
            <button class="admin-btn admin-btn--danger  btn-delete">Delete episode</button>
          </div>
        </div>
      </details>`;

    const fileInput = div.querySelector('.f-cover-file');
    const urlInput  = div.querySelector('.f-cover-url');
    const prevImg   = div.querySelector('.f-cover-preview');
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0]; if (!file) return;
      const dataUrl = await compressImage(file, 800, 0.85);
      urlInput.value = dataUrl; prevImg.src = dataUrl; prevImg.style.display = '';
    });
    urlInput.addEventListener('input', () => { prevImg.src = urlInput.value; prevImg.style.display = urlInput.value ? '' : 'none'; });

    div.querySelector('.btn-save').addEventListener('click', function () {
      ep.title         = div.querySelector('.f-title').value.trim();
      ep.audioUrl      = div.querySelector('.f-audio').value.trim();
      ep.coverArt      = div.querySelector('.f-cover-url').value.trim();
      ep.season        = parseInt(div.querySelector('.f-season').value) || 1;
      ep.episodeNumber = parseInt(div.querySelector('.f-episode-num').value) || 1;
      ep.keywords      = div.querySelector('.f-keywords').value.trim();
      ep.notes         = div.querySelector('.f-notes').value.trim();
      const dStr = div.querySelector('.f-duration').value.trim();
      const parts = dStr.split(':');
      ep.duration = parts.length === 2 ? (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0) : parseInt(dStr) || 0;
      ep.categories = collectCategories(div);
      div.querySelector('.admin-summary').textContent = ep.title;
      save(); showSaved(this);
    });
    div.querySelector('.btn-delete').addEventListener('click', () => {
      if (!confirm(`Delete "${ep.title}"?`)) return;
      data.episodes = data.episodes.filter(e => e.id !== ep.id);
      save(); wrap.removeChild(div);
    });
    wrap.appendChild(div);
  }

  document.getElementById('add-episode-btn').addEventListener('click', () => {
    const newEp = { id: 'episode-' + slugId(), title: 'New Episode', categories: [], duration: 0, audioUrl: '', coverArt: '', season: 1, episodeNumber: 1, keywords: '', notes: '' };
    data.episodes.push(newEp); save();
    const wrap = document.getElementById('admin-episodes');
    appendEpisodeCard(wrap, newEp, true);
    wrap.lastElementChild.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ── Export / Reset ───────────────────────────

  document.getElementById('export-btn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'content.json' });
    a.click();
  });

  document.getElementById('reset-btn').addEventListener('click', async () => {
    if (!confirm('Reset all CMS data to the default content.json?')) return;
    localStorage.removeItem(CMS_KEY);
    data = await getData();
    renderSettings(); renderCategories(); renderArticles(); renderEpisodes();
  });

  // ── Initial render ───────────────────────────
  renderSettings();
  renderCategories();
  renderArticles();
  renderEpisodes();
}
