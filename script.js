'use strict';

/* =============================================
   Europe Weekly – CMS engine + page renderers
   ============================================= */

// ── THEME TOGGLE ──────────────────────────────

const THEME_KEY = 'ew-theme';

const _SUN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/><line x1="12" y1="2" x2="12" y2="4"/><line x1="12" y1="20" x2="12" y2="22"/><line x1="2" y1="12" x2="4" y2="12"/><line x1="20" y1="12" x2="22" y2="12"/><line x1="4.93" y1="4.93" x2="6.34" y2="6.34"/><line x1="17.66" y1="17.66" x2="19.07" y2="19.07"/><line x1="19.07" y1="4.93" x2="17.66" y2="6.34"/><line x1="6.34" y1="17.66" x2="4.93" y2="19.07"/></svg>`;

const _MOON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;

function _getEffectiveTheme() {
  // Day mode is always the default; dark only when the user explicitly chose it.
  return localStorage.getItem(THEME_KEY) || 'light';
}

function _applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
}

function _updateToggleBtn() {
  const btn = document.getElementById('theme-toggle');
  if (!btn) return;
  const isDark = _getEffectiveTheme() === 'dark';
  btn.innerHTML = isDark
    ? `${_SUN_SVG}<span>Day</span>`
    : `${_MOON_SVG}<span>Night</span>`;
  btn.title = isDark ? 'Switch to light mode' : 'Switch to dark mode';
}

function initThemeToggle() {
  // Skip on the admin page
  if (document.body?.classList.contains('admin-page')) return;

  // Apply persisted preference immediately (also done inline in <head>)
  const saved = localStorage.getItem(THEME_KEY);
  if (saved) _applyTheme(saved);

  // Build button
  const btn = document.createElement('button');
  btn.id = 'theme-toggle';
  btn.setAttribute('aria-label', 'Toggle colour scheme');

  // Insert into whichever header is on this page
  const header = document.querySelector('.site-header, .article-header');
  if (header) header.appendChild(btn);

  _updateToggleBtn();

  btn.addEventListener('click', () => {
    const next = _getEffectiveTheme() === 'dark' ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    _applyTheme(next);
    _updateToggleBtn();
  });

}

// Run as soon as the DOM is ready (before any page-specific init)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initThemeToggle);
} else {
  initThemeToggle();
}

// ── DATA LAYER ────────────────────────────────

const CMS_KEY = 'ew-cms-data';

// ── GITHUB INTEGRATION ────────────────────────
// PAT is stored in sessionStorage only — cleared on tab close, never committed.

const GH_REPO        = 'tim-muky/europe-weekly';
const GH_FILE        = 'content.json';
const GH_RSS_FILE    = 'podcast-feed.xml';
const GH_BRANCH      = 'main';
const GH_API_URL     = `https://api.github.com/repos/${GH_REPO}/contents/${GH_FILE}`;
const GH_RSS_API_URL = `https://api.github.com/repos/${GH_REPO}/contents/${GH_RSS_FILE}`;
const GH_TOKEN_KEY   = 'ew-gh-token';
const GH_SHA_KEY     = 'ew-gh-sha';
const GH_RSS_SHA_KEY = 'ew-gh-rss-sha';

function getGHToken() { return sessionStorage.getItem(GH_TOKEN_KEY) || ''; }
function setGHToken(t) { t ? sessionStorage.setItem(GH_TOKEN_KEY, t) : sessionStorage.removeItem(GH_TOKEN_KEY); }

async function fetchFromGitHub(token) {
  const res = await fetch(`${GH_API_URL}?ref=${GH_BRANCH}&t=${Date.now()}`, {
    headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
  });
  if (!res.ok) throw Object.assign(new Error('GH fetch ' + res.status), { status: res.status });
  const { content, sha } = await res.json();
  const data = JSON.parse(atob(content.replace(/\s/g, '')));
  return { data, sha };
}

async function pushToGitHub(token, data, sha, message) {
  const json    = JSON.stringify(data, null, 2) + '\n';
  const content = btoa(unescape(encodeURIComponent(json)));
  const res = await fetch(GH_API_URL, {
    method: 'PUT',
    headers: {
      Authorization:  `token ${token}`,
      Accept:         'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message, content, sha, branch: GH_BRANCH })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw Object.assign(new Error('GH push ' + res.status), { status: res.status, ghErr: err });
  }
  return (await res.json()).content.sha;
}

async function pushRSSToGitHub(token, data) {
  // Generate the RSS XML from current data
  const xml = generateRSSFeed(data);
  const content = btoa(unescape(encodeURIComponent(xml)));

  // We need the current file SHA — fetch it if not cached
  let sha = sessionStorage.getItem(GH_RSS_SHA_KEY);
  if (!sha) {
    const res = await fetch(`${GH_RSS_API_URL}?ref=${GH_BRANCH}&t=${Date.now()}`, {
      headers: { Authorization: `token ${token}`, Accept: 'application/vnd.github.v3+json' }
    });
    if (res.ok) {
      sha = (await res.json()).sha;
      sessionStorage.setItem(GH_RSS_SHA_KEY, sha);
    }
  }

  const body = { message: 'cms: regenerate podcast-feed.xml', content, branch: GH_BRANCH };
  if (sha) body.sha = sha;

  const res = await fetch(GH_RSS_API_URL, {
    method: 'PUT',
    headers: {
      Authorization:  `token ${token}`,
      Accept:         'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  if (res.ok) {
    sessionStorage.setItem(GH_RSS_SHA_KEY, (await res.json()).content.sha);
  }
  // RSS push failure is non-fatal — log but don't throw
  else { console.warn('RSS feed push failed:', res.status); }
}

async function getData() {
  const token   = getGHToken();
  const isAdmin = document.body?.classList.contains('admin-page');

  // On the admin page with a token: always read from GitHub — single source of truth.
  // This ensures deletions, settings and categories made in the CMS are never
  // overwritten by an older published content.json.
  if (token && isAdmin) {
    try {
      const { data, sha } = await fetchFromGitHub(token);
      sessionStorage.setItem(GH_SHA_KEY, sha);
      localStorage.setItem(CMS_KEY, JSON.stringify(data));
      return data;
    } catch (e) {
      console.warn('GitHub fetch failed — falling back to local cache:', e);
    }
  }

  // Public pages (or no token): compare local cache with published content.json
  // so bot-published updates propagate to returning visitors automatically.
  const raw = localStorage.getItem(CMS_KEY);
  let local = null;
  if (raw) { try { local = JSON.parse(raw); } catch (e) { /* corrupt */ } }

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

// Render stored content: if it already contains HTML tags, use as-is;
// otherwise fall back to plain-text → paragraph conversion.
function renderHTML(str) {
  if (!str) return '';
  if (/<[a-z]/i.test(str)) return str;
  return textToHTML(str);
}

// ── SEO / META TAGS ───────────────────────────

const SITE_URL  = 'https://europe-weekly.eu';
const SITE_NAME = 'Europe Weekly';
const SITE_DESC = 'European news, politics and analysis – articles and podcast from Europe Weekly.';

// Convert ALL_CAPS or UPPER CASE titles to Title Case for use in meta/OG/Twitter tags.
// Leaves mixed-case strings untouched. Restores known political/EU acronyms.
const _TC_LOWER = new Set(['a','an','the','and','but','or','nor','for','so','yet',
  'at','by','in','of','on','to','up','as','if','it','is','vs']);
const _ACRONYMS = new Set([
  'EU','UN','UK','US','USA','NATO','IMF','GDP','ECB','WTO','MEP','MEPs',
  'EP','EC','G7','G8','G20','OECD','NGO','PM','VP','FM','MP','MPs',
  'ECJ','EEA','EIB','ESM','EMU','EFSF','PESCO','OSCE','IAEA','WHO',
  'CEE','CSDP','MFF','CAP','CFP','AI','COVID','BBC','CNN','DG','DGs'
]);
function toMetaTitle(str) {
  if (!str) return str;
  const alpha = str.replace(/[^a-zA-Z]/g, '');
  const upperRatio = alpha.length ? (alpha.split('').filter(c => c === c.toUpperCase()).length / alpha.length) : 0;
  if (upperRatio < 0.7) return str;   // already mixed case — leave as-is
  // Split on word boundaries, preserving separators, then title-case word by word
  const tokens  = str.toLowerCase().split(/(\b)/);
  let forceUpper = true;  // capitalise after start, colon or em-dash
  let prevTok    = '';
  const titled = tokens.map(tok => {
    if (/^[-–—:]$/.test(tok)) { forceUpper = true; prevTok = tok; return tok; }
    if (!/[a-z]/.test(tok))   { if (tok) prevTok = tok; return tok; }  // punctuation / spaces / digits — update prevTok only if non-empty
    if (prevTok === "'")       { prevTok = tok; return tok; }  // don't capitalise after apostrophe ('s, 't, etc.)
    if (forceUpper || !_TC_LOWER.has(tok)) {
      forceUpper = false; prevTok = tok;
      return tok.charAt(0).toUpperCase() + tok.slice(1);
    }
    forceUpper = false; prevTok = tok;
    return tok;
  }).join('');
  // Restore known acronyms
  return titled.replace(/\b[A-Za-z]{2,6}\b/g, w => _ACRONYMS.has(w.toUpperCase()) ? w.toUpperCase() : w);
}

function _setMeta(attr, key, content) {
  if (!content) return;
  let el = document.querySelector(`meta[${attr}="${CSS.escape(key)}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.content = content;
}

function setPageMeta({ title, description, image, url, type = 'website' }) {
  const fullTitle    = title ? `${toMetaTitle(title)} – ${SITE_NAME}` : SITE_NAME;
  const desc         = ((description || SITE_DESC).replace(/<[^>]+>/g, '').trim()).slice(0, 160);
  const canonicalUrl = url || (SITE_URL + location.pathname + location.search);

  document.title = fullTitle;

  // Standard meta
  _setMeta('name', 'description', desc);

  // Canonical link
  let canon = document.querySelector('link[rel="canonical"]');
  if (!canon) { canon = document.createElement('link'); canon.rel = 'canonical'; document.head.appendChild(canon); }
  canon.href = canonicalUrl;

  // Open Graph
  _setMeta('property', 'og:title',       fullTitle);
  _setMeta('property', 'og:description', desc);
  _setMeta('property', 'og:url',         canonicalUrl);
  _setMeta('property', 'og:type',        type);
  _setMeta('property', 'og:site_name',   SITE_NAME);
  if (image) _setMeta('property', 'og:image', image);

  // Twitter Card
  _setMeta('name', 'twitter:card',        image ? 'summary_large_image' : 'summary');
  _setMeta('name', 'twitter:title',       fullTitle);
  _setMeta('name', 'twitter:description', desc);
  if (image) _setMeta('name', 'twitter:image', image);
}

function setJsonLd(schema) {
  let el = document.getElementById('json-ld');
  if (!el) { el = document.createElement('script'); el.id = 'json-ld'; el.type = 'application/ld+json'; document.head.appendChild(el); }
  el.textContent = JSON.stringify(schema);
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

  // Hi-DPI / Retina: scale canvas buffer by devicePixelRatio
  const dpr  = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth  || 360;
  const cssH = canvas.clientHeight || 200;
  canvas.width  = Math.round(cssW * dpr);
  canvas.height = Math.round(cssH * dpr);
  canvas.style.width  = cssW + 'px';
  canvas.style.height = cssH + 'px';

  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const W = cssW, H = cssH;
  const padL = 38, padB = 42, padT = 16, padR = 10; // padB for two-line horizontal labels
  const chartW = W - padL - padR, chartH = H - padB - padT;
  const colors = ['#5ec8b8', '#1c6080', '#122c4a', '#8adeca'];
  const maxVal = Math.max(...values) * 1.15;

  ctx.clearRect(0, 0, W, H);
  ctx.strokeStyle = '#ccc'; ctx.lineWidth = 0.5;
  ctx.fillStyle = '#555'; ctx.font = '10px Arial'; ctx.textAlign = 'right';
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
    // Value label above bar
    ctx.fillStyle = '#333'; ctx.font = 'bold 10px Arial'; ctx.textAlign = 'center';
    ctx.fillText(val, x + bw / 2, y - 4);
    // X-axis label: two horizontal lines to prevent overflow
    const words = (labels[i] || '').split(' ');
    const mid   = Math.ceil(words.length / 2);
    const line1 = words.slice(0, mid).join(' ');
    const line2 = words.slice(mid).join(' ');
    ctx.font = '10px Arial';
    ctx.fillStyle = '#555';
    ctx.textAlign = 'center';
    ctx.fillText(line1, x + bw / 2, padT + chartH + 14);
    if (line2) ctx.fillText(line2, x + bw / 2, padT + chartH + 26);
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

function initPlayer(total, prefix, audioUrl) {
  const playBtn   = document.getElementById(prefix + 'playBtn');
  const playIcon  = document.getElementById(prefix + 'playIcon');
  const pauseIcon = document.getElementById(prefix + 'pauseIcon');
  const fill      = document.getElementById(prefix + 'progressFill');
  const thumb     = document.getElementById(prefix + 'progressThumb');
  const curEl     = document.getElementById(prefix + 'currentTime');
  const durEl     = document.getElementById(prefix + 'duration');
  const bar       = document.getElementById(prefix + 'progressBar');
  if (!playBtn) return;

  if (audioUrl) {
    const audio = new Audio(audioUrl);
    function updateUI() {
      const cur = audio.currentTime;
      const dur = isFinite(audio.duration) ? audio.duration : (total || 1);
      const pct = dur ? (cur / dur) * 100 : 0;
      fill.style.width  = pct + '%'; thumb.style.left  = pct + '%';
      curEl.textContent = fmtTime(Math.floor(cur));
      durEl.textContent = '-' + fmtTime(Math.max(0, Math.floor(dur - cur)));
    }
    audio.addEventListener('timeupdate', updateUI);
    audio.addEventListener('loadedmetadata', updateUI);
    audio.addEventListener('ended', () => { playIcon.style.display = 'block'; pauseIcon.style.display = 'none'; });
    playBtn.addEventListener('click', () => {
      if (audio.paused) { audio.play(); playIcon.style.display = 'none'; pauseIcon.style.display = 'block'; }
      else              { audio.pause(); playIcon.style.display = 'block'; pauseIcon.style.display = 'none'; }
    });
    const prev = document.getElementById(prefix + 'prevBtn');
    const next = document.getElementById(prefix + 'nextBtn');
    if (prev) prev.addEventListener('click', () => { audio.currentTime = 0; });
    if (next) next.addEventListener('click', () => { audio.currentTime = 0; });
    if (bar)  bar.addEventListener('click', e => {
      const r   = bar.getBoundingClientRect();
      const dur = isFinite(audio.duration) ? audio.duration : (total || 1);
      audio.currentTime = ((e.clientX - r.left) / r.width) * dur;
    });
    curEl.textContent = '00:00';
    durEl.textContent = '-' + fmtTime(total || 0);
  } else {
    // No audio URL — fake timer for UI preview
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
}

// ── NAV ───────────────────────────────────────

function renderNav(data) {
  const al = document.getElementById('nav-articles');
  const el = document.getElementById('nav-episodes');
  if (al) al.innerHTML = data.articles.slice(0, 5).map(a => `<li><a href="article.html?id=${a.id}">${escHtml(a.title)}</a></li>`).join('');
  if (el) el.innerHTML = data.episodes.slice(0, 5).map(e => `<li><a href="episode.html?id=${e.id}">${escHtml(e.title)}</a></li>`).join('');
}

// ── HOME ──────────────────────────────────────

async function initHome() {
  const data = await getData();
  renderNav(data);
  renderFooter(data);
  setPageMeta({ url: `${SITE_URL}/` });

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
    document.getElementById('preview-tags').innerHTML  = tagsHTML(data, art.categories);
    document.getElementById('preview-excerpt').innerHTML = renderHTML(art.excerpt);
    document.getElementById('preview-body').innerHTML    = renderHTML(art.body);
    document.getElementById('preview-more').href = `article.html?id=${art.id}`;
    const homeChartWrap = document.querySelector('.chart-container');
    if (art.chartData) { drawBarChart('homeChart', art.chartData.values, art.chartData.labels); }
    else if (homeChartWrap) { homeChartWrap.style.display = 'none'; }
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
    if (wrap) { wrap.innerHTML = playerHTML('ep-'); initPlayer(ep.duration, 'ep-', ep.audioUrl); }
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

  setPageMeta({
    title:       art.title,
    description: art.excerpt,
    url:         `${SITE_URL}/article.html?id=${art.id}`,
    type:        'article'
  });
  setJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type':       'NewsArticle',
        'headline':    art.title,
        'description': (art.excerpt || '').replace(/<[^>]+>/g, '').slice(0, 160),
        'url':         `${SITE_URL}/article.html?id=${art.id}`,
        'publisher':   { '@type': 'Organization', 'name': SITE_NAME, 'url': SITE_URL },
        'keywords':    art.keywords || ''
      },
      {
        '@type':           'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home',     'item': `${SITE_URL}/` },
          { '@type': 'ListItem', 'position': 2, 'name': 'Articles', 'item': `${SITE_URL}/articles.html` },
          { '@type': 'ListItem', 'position': 3, 'name': art.title,  'item': `${SITE_URL}/article.html?id=${art.id}` }
        ]
      }
    ]
  });
  document.getElementById('article-title').textContent = art.title;
  const bcTitle = document.getElementById('breadcrumb-title');
  if (bcTitle) bcTitle.textContent = toMetaTitle(art.title);

  const rtEl = document.getElementById('article-reading-time');
  if (rtEl) {
    const wordCount = ((art.excerpt || '') + ' ' + (art.body || ''))
      .replace(/<[^>]+>/g, '').trim().split(/\s+/).filter(Boolean).length;
    const mins = Math.max(1, Math.round(wordCount / 200));
    rtEl.textContent = `${mins} min read`;
  }

  const dtEl = document.getElementById('article-date');
  if (dtEl && art.pubDate) {
    const d = new Date(art.pubDate);
    if (!isNaN(d)) dtEl.textContent = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  document.getElementById('article-tags').innerHTML     = tagsHTML(data, art.categories);
  document.getElementById('article-excerpt').innerHTML  = renderHTML(art.excerpt);
  document.getElementById('article-body').innerHTML     = renderHTML(art.body);

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

  // Related articles: same category first, then fill to 3 from other articles
  const relWrap = document.getElementById('related-articles');
  const relList = document.getElementById('related-list');
  if (relWrap && relList) {
    const others = data.articles.filter(a => a.id !== art.id);
    const sameCategory = others.filter(a => a.categories.some(c => art.categories.includes(c)));
    const rest = others.filter(a => !a.categories.some(c => art.categories.includes(c)));
    const related = [...sameCategory, ...rest].slice(0, 3);
    if (related.length) {
      relList.innerHTML = related.map(a => `
        <a href="article.html?id=${a.id}" class="related-card">
          <div class="related-card-tags">${(a.categories || []).map(id => `<span class="related-tag">${catLabel(data, id)}</span>`).join('')}</div>
          <div class="related-card-title">${escHtml(a.title)}</div>
          <p class="related-card-excerpt">${escHtml((a.excerpt || '').replace(/<[^>]+>/g, '').slice(0, 110))}…</p>
        </a>`).join('');
      relWrap.style.display = '';
    }
  }
}

// ── ARTICLES LIST ─────────────────────────────

async function initArticlesList() {
  const data = await getData();
  renderFooter(data);
  setPageMeta({
    title:       'All Articles',
    description: 'Browse all Europe Weekly articles covering European news, politics and analysis.',
    url:         `${SITE_URL}/articles.html`
  });
  const container  = document.getElementById('articles-list');
  const searchInput = document.getElementById('article-search');
  const countEl    = document.getElementById('search-count');

  function articleCard(a) {
    const d = a.pubDate ? new Date(a.pubDate) : null;
    const dateStr = (d && !isNaN(d))
      ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    return `
      <div class="cat-item" data-title="${escHtml(a.title.toLowerCase())}" data-excerpt="${escHtml((a.excerpt || '').replace(/<[^>]+>/g, '').toLowerCase())}" data-keywords="${escHtml((a.keywords || '').toLowerCase())}">
        <a href="article.html?id=${a.id}" class="cat-item-title">${escHtml(a.title)}</a>
        <div class="cat-item-tags">${tagsHTML(data, a.categories)}</div>
        ${dateStr ? `<p class="cat-item-date">${dateStr}</p>` : ''}
        <p class="cat-item-excerpt">${a.excerpt || ''}</p>
      </div>`;
  }

  const PAGE_SIZE   = 10;
  const moreWrap    = document.getElementById('articles-more-wrap');
  const moreBtn     = document.getElementById('articles-more-btn');

  if (!data.articles.length) {
    container.innerHTML = '<p class="no-results">No articles yet.</p>';
    return;
  }

  // Render all cards (hidden beyond page 1); search works across all of them
  container.innerHTML = data.articles.map((a, i) =>
    articleCard(a).replace('class="cat-item"',
      `class="cat-item"${i >= PAGE_SIZE ? ' style="display:none"' : ''} data-page-idx="${i}"`)
  ).join('');

  let shown = Math.min(PAGE_SIZE, data.articles.length);
  if (moreWrap) moreWrap.style.display = data.articles.length > PAGE_SIZE ? '' : 'none';

  if (moreBtn) {
    moreBtn.addEventListener('click', () => {
      const next = shown + PAGE_SIZE;
      container.querySelectorAll('.cat-item[data-page-idx]').forEach(el => {
        const idx = parseInt(el.dataset.pageIdx, 10);
        if (idx < next) el.style.display = '';
      });
      shown = Math.min(next, data.articles.length);
      if (shown >= data.articles.length && moreWrap) moreWrap.style.display = 'none';
    });
  }

  if (searchInput) {
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      let visible = 0;
      container.querySelectorAll('.cat-item').forEach(el => {
        const match = !q
          || el.dataset.title.includes(q)
          || el.dataset.excerpt.includes(q)
          || el.dataset.keywords.includes(q);
        // During a search ignore pagination — show all matches; restore pagination when cleared
        if (q) {
          el.style.display = match ? '' : 'none';
        } else {
          const idx = parseInt(el.dataset.pageIdx, 10);
          el.style.display = idx < shown ? '' : 'none';
        }
        if (match && (q || parseInt(el.dataset.pageIdx, 10) < shown)) visible++;
      });
      if (moreWrap) moreWrap.style.display = q ? 'none' : (shown < data.articles.length ? '' : 'none');
      if (countEl)  countEl.textContent = q ? `${visible} result${visible !== 1 ? 's' : ''}` : '';
    });
  }
}

// ── EPISODES LIST ─────────────────────────────

async function initEpisodesList() {
  const data = await getData();
  renderFooter(data);
  setPageMeta({
    title:       'Podcast Episodes',
    description: 'Listen to all Europe Weekly podcast episodes on European affairs and politics.',
    url:         `${SITE_URL}/episodes.html`
  });
  const container = document.getElementById('episodes-list');

  function epThumb(ep) {
    if (ep.coverArt) return `<img src="${escHtml(ep.coverArt)}" alt="" class="ep-list-thumb" loading="lazy">`;
    const initials = ep.title.split(/\s+/).slice(0, 2).map(w => (w[0] || '').toUpperCase()).join('');
    return `<div class="ep-list-thumb ep-list-thumb--placeholder" aria-hidden="true">${escHtml(initials)}</div>`;
  }

  const EP_PAGE_SIZE = 10;
  const epMoreWrap   = document.getElementById('episodes-more-wrap');
  const epMoreBtn    = document.getElementById('episodes-more-btn');

  if (!data.episodes.length) {
    container.innerHTML = '<p class="no-results">No episodes yet.</p>';
    return;
  }

  // Outer element is a <div>, not <a> — episode cards contain <a class="tag"> links,
  // and nested <a> tags are invalid HTML (browsers auto-close the outer one, breaking
  // layout). Title link uses ::after to cover the full card; tags sit above via z-index.
  container.innerHTML = data.episodes.map((ep, i) => `
      <div class="ep-list-card" data-ep-idx="${i}"${i >= EP_PAGE_SIZE ? ' style="display:none"' : ''}>
        <a href="episode.html?id=${ep.id}" class="ep-list-thumb-link" tabindex="-1" aria-hidden="true">${epThumb(ep)}</a>
        <div class="ep-list-body">
          <span class="episode-badge ep-list-badge">S${ep.season || 1} · E${ep.episodeNumber || 1}</span>
          <a href="episode.html?id=${ep.id}" class="ep-list-title">${escHtml(ep.title)}</a>
          <div class="cat-item-tags">${tagsHTML(data, ep.categories)}</div>
          ${ep.notes ? `<p class="ep-list-notes">${escHtml(ep.notes.slice(0, 120))}${ep.notes.length > 120 ? '…' : ''}</p>` : ''}
        </div>
      </div>`).join('');

  let epShown = Math.min(EP_PAGE_SIZE, data.episodes.length);
  if (epMoreWrap) epMoreWrap.style.display = data.episodes.length > EP_PAGE_SIZE ? '' : 'none';

  if (epMoreBtn) {
    epMoreBtn.addEventListener('click', () => {
      const next = epShown + EP_PAGE_SIZE;
      container.querySelectorAll('.ep-list-card[data-ep-idx]').forEach(el => {
        if (parseInt(el.dataset.epIdx, 10) < next) el.style.display = '';
      });
      epShown = Math.min(next, data.episodes.length);
      if (epShown >= data.episodes.length && epMoreWrap) epMoreWrap.style.display = 'none';
    });
  }
}

// ── CATEGORY ─────────────────────────────────

async function initCategory() {
  const data  = await getData();
  renderFooter(data);
  const id    = new URLSearchParams(location.search).get('id');
  const cat   = data.categories.find(c => c.id === id);
  const label = cat?.label ?? id ?? 'Category';

  setPageMeta({
    title:       label,
    description: `Europe Weekly articles and podcast episodes about ${label}.`,
    url:         `${SITE_URL}/category.html?id=${encodeURIComponent(id)}`
  });
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
  setPageMeta({
    title: titleText,
    url:   `${SITE_URL}/${pageKey}.html`
  });
  const el = document.getElementById('page-content');
  if (el) el.innerHTML = renderHTML(data.pages?.[pageKey] || '');
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

  setPageMeta({
    title:       ep.title,
    description: ep.notes,
    image:       ep.coverArt || null,
    url:         `${SITE_URL}/episode.html?id=${ep.id}`,
    type:        'music.song'
  });
  setJsonLd({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type':           'BreadcrumbList',
        'itemListElement': [
          { '@type': 'ListItem', 'position': 1, 'name': 'Home',    'item': `${SITE_URL}/` },
          { '@type': 'ListItem', 'position': 2, 'name': 'Podcast', 'item': `${SITE_URL}/episodes.html` },
          { '@type': 'ListItem', 'position': 3, 'name': ep.title,  'item': `${SITE_URL}/episode.html?id=${ep.id}` }
        ]
      },
      {
        '@type':         'PodcastEpisode',
        'name':          ep.title,
        'description':   (ep.notes || '').slice(0, 300),
        'url':           `${SITE_URL}/episode.html?id=${ep.id}`,
        'associatedMedia': ep.audioUrl ? {
          '@type':          'MediaObject',
          'contentUrl':     ep.audioUrl,
          'encodingFormat': 'audio/mpeg',
          'duration':       ep.duration ? `PT${Math.floor(ep.duration / 60)}M${ep.duration % 60}S` : undefined
        } : undefined,
        'partOfSeries': {
          '@type': 'PodcastSeries',
          'name':  SITE_NAME,
          'url':   SITE_URL
        },
        'episodeNumber': ep.episodeNumber || 1,
        'datePublished': ep.pubDate || undefined,
        'image':         ep.coverArt || undefined,
        'keywords':      ep.keywords || ''
      }
    ]
  });

  const coverEl          = document.getElementById('episode-cover');
  const coverPlaceholder = document.getElementById('episode-cover-placeholder');
  if (ep.coverArt) {
    if (coverEl)          { coverEl.src = ep.coverArt; coverEl.alt = escHtml(ep.title); coverEl.style.display = ''; }
    if (coverPlaceholder)   coverPlaceholder.style.display = 'none';
  } else {
    if (coverEl)            coverEl.style.display = 'none';
    if (coverPlaceholder) {
      const initials = ep.title.split(/\s+/).slice(0, 2).map(w => (w[0] || '').toUpperCase()).join('');
      coverPlaceholder.textContent = initials;
      coverPlaceholder.style.display = '';
    }
  }

  document.getElementById('episode-badge').textContent  = `S${ep.season || 1} · E${ep.episodeNumber || 1}`;
  document.getElementById('episode-title').textContent  = ep.title;
  const bcTitle = document.getElementById('breadcrumb-title');
  if (bcTitle) bcTitle.textContent = toMetaTitle(ep.title);
  document.getElementById('episode-tags').innerHTML     = tagsHTML(data, ep.categories);

  const epDtEl = document.getElementById('episode-date');
  if (epDtEl && ep.pubDate) {
    const d = new Date(ep.pubDate);
    if (!isNaN(d)) epDtEl.textContent = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  }

  const wrap = document.getElementById('episode-player-wrap');
  if (wrap) { wrap.innerHTML = playerHTML('ep-single-'); initPlayer(ep.duration, 'ep-single-', ep.audioUrl); }

  const kwEl = document.getElementById('episode-keywords');
  if (kwEl) {
    const kws = (ep.keywords || '').split(',').map(k => k.trim()).filter(Boolean);
    kwEl.innerHTML   = kws.length ? kws.map(k => `<span class="keyword">${escHtml(k)}</span>`).join('') : '';
    kwEl.style.display = kws.length ? '' : 'none';
  }

  const notesEl = document.getElementById('episode-notes');
  if (notesEl) { notesEl.textContent = ep.notes || ''; notesEl.style.display = ep.notes ? '' : 'none'; }
}

// ── PODCAST RSS FEED GENERATOR ────────────────

function generateRSSFeed(data) {
  const siteUrl = 'https://europe-weekly.eu';
  const pod     = (data.settings || {}).podcast || {};

  function escXml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function fmtDur(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return h > 0
      ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
      : `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }
  function toRFC2822(dateStr) {
    const d = dateStr ? new Date(dateStr) : null;
    return (d && !isNaN(d)) ? d.toUTCString() : new Date().toUTCString();
  }
  // OP3 / Podtrac: prefix + domain+path (no https://)
  const rawPrefix = (pod.trackingPrefix || '').trim().replace(/\/$/, '');
  function withPrefix(url) {
    if (!rawPrefix || !url) return url;
    return rawPrefix + '/' + url.replace(/^https?:\/\//, '');
  }

  const cover = escXml(pod.coverArt || ''); // declare early so epImg can reference it

  const items = data.episodes.map(ep => {
    const desc    = escXml(ep.notes || ep.description || '');
    const epSize  = ep.fileSize || 0;
    const trackedUrl = withPrefix(ep.audioUrl);
    const enc     = trackedUrl
      ? `\n      <enclosure url="${escXml(trackedUrl)}" length="${epSize}" type="audio/mpeg"/>`
      : '';
    const epImg   = ep.coverArt || pod.coverArt || '';
    return `    <item>
      <title>${escXml(ep.title)}</title>
      <description>${desc}</description>${enc}
      <guid isPermaLink="false">${escXml(ep.id)}</guid>
      <pubDate>${toRFC2822(ep.pubDate)}</pubDate>
      <link>${siteUrl}/episode.html?id=${encodeURIComponent(ep.id)}</link>
      <itunes:duration>${fmtDur(ep.duration || 0)}</itunes:duration>
      <itunes:season>${ep.season || 1}</itunes:season>
      <itunes:episode>${ep.episodeNumber || 1}</itunes:episode>${epImg ? `\n      <itunes:image href="${escXml(epImg)}"/>` : ''}
      <itunes:explicit>false</itunes:explicit>
    </item>`;
  }).join('\n');

  const title    = escXml(pod.title       || 'Europe Weekly');
  const desc     = escXml(pod.description || '');
  const author   = escXml(pod.author      || 'Europe Weekly');
  const email    = escXml(pod.email       || '');
  const category = escXml(pod.category    || 'News');
  const lang     = escXml(pod.language    || 'en');
  const year     = new Date().getFullYear();

  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="podcast-feed.xsl"?>
<rss version="2.0"
     xmlns:itunes="http://www.itunes.com/dtds/podcast-1_0.dtd"
     xmlns:atom="http://www.w3.org/2005/Atom"
     xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>${title}</title>
    <link>${siteUrl}</link>
    <description>${desc}</description>
    <language>${lang}</language>
    <copyright>© ${year} ${author}</copyright>
    <atom:link href="${siteUrl}/podcast-feed.xml" rel="self" type="application/rss+xml"/>
    <itunes:author>${author}</itunes:author>
    <itunes:owner>
      <itunes:name>${author}</itunes:name>
      <itunes:email>${email}</itunes:email>
    </itunes:owner>${cover ? `\n    <itunes:image href="${cover}"/>` : ''}
    <itunes:type>episodic</itunes:type>
    <itunes:category text="${category}">
      <itunes:category text="Politics"/>
    </itunes:category>
    <itunes:explicit>false</itunes:explicit>
${items}
  </channel>
</rss>`;
}

// ── GITHUB PUSH STATUS ────────────────────────

function showGHStatus(msg, type) {
  const el = document.getElementById('gh-status');
  if (!el) return;
  el.textContent = msg;
  el.className = 'gh-status' + (type ? ' gh-status--' + type : '');
  if (type === 'success') {
    setTimeout(() => {
      if (el.textContent === msg) { el.textContent = ''; el.className = 'gh-status'; }
    }, 4000);
  }
}

function generateSitemap(data) {
  const siteUrl = 'https://europe-weekly.eu';
  const now     = new Date().toISOString().slice(0, 10);

  const staticPages = [
    { loc: `${siteUrl}/`,              priority: '1.0',  changefreq: 'daily'   },
    { loc: `${siteUrl}/articles.html`, priority: '0.8',  changefreq: 'daily'   },
    { loc: `${siteUrl}/episodes.html`, priority: '0.8',  changefreq: 'weekly'  },
    { loc: `${siteUrl}/about.html`,      priority: '0.5',  changefreq: 'monthly' },
    { loc: `${siteUrl}/ai-podcast.html`, priority: '0.5',  changefreq: 'monthly' },
  ];

  const articleUrls = (data.articles || []).map(a => ({
    loc:        `${siteUrl}/article.html?id=${encodeURIComponent(a.id)}`,
    priority:   '0.9',
    changefreq: 'monthly'
  }));

  const episodeUrls = (data.episodes || []).map(ep => ({
    loc:        `${siteUrl}/episode.html?id=${encodeURIComponent(ep.id)}`,
    lastmod:    ep.pubDate || now,
    priority:   '0.7',
    changefreq: 'monthly'
  }));

  const categoryUrls = (data.categories || []).map(c => ({
    loc:        `${siteUrl}/category.html?id=${encodeURIComponent(c.id)}`,
    priority:   '0.6',
    changefreq: 'weekly'
  }));

  const allUrls = [...staticPages, ...articleUrls, ...episodeUrls, ...categoryUrls];

  const urlNodes = allUrls.map(u => {
    const lastmod = u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : '';
    return `  <url>\n    <loc>${u.loc}</loc>${lastmod}\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urlNodes}\n</urlset>`;
}

async function pushDataToGitHub(message) {
  const token = getGHToken();
  if (!token) return;               // No token — localStorage is authoritative

  const raw = localStorage.getItem(CMS_KEY);
  if (!raw) return;
  const data = JSON.parse(raw);

  showGHStatus('Pushing to GitHub…', 'pending');

  let sha = sessionStorage.getItem(GH_SHA_KEY);
  try {
    if (!sha) {
      // No SHA cached yet — fetch it first (e.g. token was just entered this session)
      const fetched = await fetchFromGitHub(token);
      sha = fetched.sha;
      sessionStorage.setItem(GH_SHA_KEY, sha);
    }
    const newSha = await pushToGitHub(token, data, sha, message);
    sessionStorage.setItem(GH_SHA_KEY, newSha);
    // Also regenerate podcast-feed.xml on every save (non-fatal if it fails)
    await pushRSSToGitHub(token, data);
    showGHStatus('Pushed to GitHub ✓', 'success');
  } catch (e) {
    // 409 / 422 = conflict (file changed on GitHub since last fetch) — retry with fresh SHA
    if (e.status === 409 || e.status === 422) {
      try {
        const { sha: freshSha } = await fetchFromGitHub(token);
        sessionStorage.setItem(GH_SHA_KEY, freshSha);
        const newSha = await pushToGitHub(token, data, freshSha, message + ' (retry)');
        sessionStorage.setItem(GH_SHA_KEY, newSha);
        await pushRSSToGitHub(token, data);
        showGHStatus('Pushed to GitHub ✓', 'success');
      } catch (e2) {
        showGHStatus('GitHub push failed — check token / network.', 'error');
        console.error('GitHub push failed (retry):', e2);
      }
    } else {
      showGHStatus('GitHub push failed — check token / network.', 'error');
      console.error('GitHub push failed:', e);
    }
  }
}

// ── ADMIN ─────────────────────────────────────

async function initAdmin() {
  let data = await getData();
  renderFooter(data);

  // Sync current settings form values into the data object before every save,
  // so that no field is lost even if the user didn't click "Save Settings".
  function syncSettingsFromForm() {
    data.settings = data.settings || {};
    const bgUrlEl = document.getElementById('settings-bg-url');
    if (bgUrlEl) data.settings.backgroundImage = bgUrlEl.value.trim();
    data.settings.social = {
      instagram: (document.getElementById('settings-instagram')?.value || '').trim(),
      x:         (document.getElementById('settings-x')?.value || '').trim(),
      youtube:   (document.getElementById('settings-youtube')?.value || '').trim()
    };
    data.pages = data.pages || {};
    const aboutEl     = document.getElementById('settings-about');
    const imprintEl   = document.getElementById('settings-imprint');
    const aiPodcastEl = document.getElementById('settings-ai-podcast');
    if (aboutEl)     data.pages.about          = aboutEl.innerHTML;
    if (imprintEl)   data.pages.imprint        = imprintEl.innerHTML;
    if (aiPodcastEl) data.pages['ai-podcast']  = aiPodcastEl.innerHTML;
    data.settings.podcast = {
      title:          (document.getElementById('settings-podcast-title')?.value || '').trim(),
      description:    (document.getElementById('settings-podcast-desc')?.value || '').trim(),
      coverArt:       (document.getElementById('settings-podcast-cover')?.value || '').trim(),
      author:         (document.getElementById('settings-podcast-author')?.value || '').trim(),
      email:          (document.getElementById('settings-podcast-email')?.value || '').trim(),
      category:       (document.getElementById('settings-podcast-category')?.value || '').trim(),
      language:       (document.getElementById('settings-podcast-language')?.value || '').trim(),
      trackingPrefix: (document.getElementById('settings-tracking-prefix')?.value || '').trim()
    };
  }

  function save(msg) { syncSettingsFromForm(); setData(data); pushDataToGitHub(msg || 'cms: update'); }

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
    document.getElementById('settings-about').innerHTML      = pages.about        || '';
    document.getElementById('settings-imprint').innerHTML    = pages.imprint      || '';
    document.getElementById('settings-ai-podcast').innerHTML = pages['ai-podcast'] || '';
    const pod = s.podcast || {};
    document.getElementById('settings-podcast-title').value    = pod.title       || '';
    document.getElementById('settings-podcast-desc').value     = pod.description || '';
    document.getElementById('settings-podcast-cover').value    = pod.coverArt    || '';
    document.getElementById('settings-podcast-author').value   = pod.author      || '';
    document.getElementById('settings-podcast-email').value    = pod.email       || '';
    document.getElementById('settings-podcast-category').value = pod.category    || '';
    document.getElementById('settings-podcast-language').value = pod.language    || '';
    const prefixEl = document.getElementById('settings-tracking-prefix');
    if (prefixEl) prefixEl.value = pod.trackingPrefix || '';
    const tokenEl = document.getElementById('settings-gh-token');
    if (tokenEl) tokenEl.value = getGHToken();
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
    const tokenVal = (document.getElementById('settings-gh-token')?.value ?? '').trim();
    setGHToken(tokenVal);
    save('cms: update settings');
    showSaved(this);
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
        if (c) { c.label = inp.value.trim(); save('cms: update categories'); renderArticles(); renderEpisodes(); }
      });
    });
    ul.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.del;
        if (!confirm(`Delete category "${catLabel(data, id)}"?`)) return;
        data.categories = data.categories.filter(c => c.id !== id);
        data.articles.forEach(a => { a.categories = a.categories.filter(x => x !== id); });
        data.episodes.forEach(e => { e.categories = e.categories.filter(x => x !== id); });
        save('cms: delete category'); renderCategories(); renderArticles(); renderEpisodes();
      });
    });
  }

  document.getElementById('add-cat-btn').addEventListener('click', () => {
    const inp = document.getElementById('new-cat-input');
    const label = inp.value.trim(); if (!label) return;
    data.categories.push({ id: 'cat-' + slugId(), label });
    inp.value = ''; save('cms: add category'); renderCategories(); renderArticles(); renderEpisodes();
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
          <div class="admin-field"><label class="admin-label">Publish Date</label>
            <input class="admin-input f-pubdate" type="date" value="${article.pubDate || ''}" style="max-width:180px" /></div>
          <div class="admin-field"><label class="admin-label">Excerpt <small>(intro paragraph — paste formatted text)</small></label>
            <div class="admin-textarea admin-richtext f-excerpt" contenteditable="true" data-placeholder="Paste or type excerpt…">${article.excerpt || ''}</div></div>
          <div class="admin-field"><label class="admin-label">Body <small>(main text — paste formatted text)</small></label>
            <div class="admin-textarea admin-richtext f-body" contenteditable="true" data-placeholder="Paste or type body text…">${article.body || ''}</div></div>
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
      article.title   = div.querySelector('.f-title').value.trim();
      article.pubDate = div.querySelector('.f-pubdate').value || '';
      article.excerpt = div.querySelector('.f-excerpt').innerHTML.trim();
      article.body    = div.querySelector('.f-body').innerHTML.trim();
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
      save('cms: update article – ' + article.title); showSaved(this);
    });
    div.querySelector('.btn-delete').addEventListener('click', () => {
      if (!confirm(`Delete "${article.title}"?`)) return;
      data.articles = data.articles.filter(a => a.id !== article.id);
      save('cms: delete article – ' + article.title); wrap.removeChild(div);
    });
    wrap.appendChild(div);
  }

  document.getElementById('add-article-btn').addEventListener('click', () => {
    const newArt = { id: 'article-' + slugId(), title: 'New Article', categories: [], excerpt: '', body: '', chartData: null, keywords: '', sources: '' };
    data.articles.push(newArt); save('cms: add article');
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
          <div class="admin-field"><label class="admin-label">Publish Date <small>(used in RSS feed)</small></label>
            <input class="admin-input f-pubdate" type="date" value="${ep.pubDate || ''}" style="max-width:180px" /></div>
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
      ep.pubDate       = div.querySelector('.f-pubdate').value || '';
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
      save('cms: update episode – ' + ep.title); showSaved(this);
    });
    div.querySelector('.btn-delete').addEventListener('click', () => {
      if (!confirm(`Delete "${ep.title}"?`)) return;
      data.episodes = data.episodes.filter(e => e.id !== ep.id);
      save('cms: delete episode – ' + ep.title); wrap.removeChild(div);
    });
    wrap.appendChild(div);
  }

  document.getElementById('add-episode-btn').addEventListener('click', () => {
    const newEp = { id: 'episode-' + slugId(), title: 'New Episode', categories: [], duration: 0, audioUrl: '', coverArt: '', season: 1, episodeNumber: 1, keywords: '', notes: '', pubDate: new Date().toISOString().slice(0, 10) };
    data.episodes.push(newEp); save('cms: add episode');
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

  document.getElementById('export-rss-btn').addEventListener('click', () => {
    const xml  = generateRSSFeed(data);
    const blob = new Blob([xml], { type: 'application/rss+xml' });
    const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'podcast-feed.xml' });
    a.click();
  });

  document.getElementById('export-sitemap-btn').addEventListener('click', () => {
    const xml  = generateSitemap(data);
    const blob = new Blob([xml], { type: 'application/xml' });
    const a    = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'sitemap.xml' });
    a.click();
  });

  document.getElementById('reset-btn').addEventListener('click', async () => {
    if (!confirm('Reset all CMS data to the default content.json?')) return;
    localStorage.removeItem(CMS_KEY);
    data = await getData();
    renderSettings(); renderCategories(); renderArticles(); renderEpisodes(); renderDownloads();
  });

  // ── Downloads ────────────────────────────────

  function renderDownloads() {
    const tbody = document.getElementById('downloads-tbody');
    if (!tbody) return;
    const eps = (data.episodes || []).slice().sort((a, b) =>
      (b.episodeNumber || 0) - (a.episodeNumber || 0));
    tbody.innerHTML = eps.map(ep => {
      const dl = ep.downloads || 0;
      const label = `S${ep.season || 1}·E${ep.episodeNumber || 1}`;
      return `<tr>
        <td>${label}</td>
        <td>${escHtml(ep.title)}</td>
        <td style="text-align:right;padding-right:8px">
          <input class="dl-input" type="number" min="0" step="1"
                 data-ep-id="${ep.id}" value="${dl}" />
        </td>
        <td>
          <button class="dl-save-btn" data-ep-id="${ep.id}">Save</button>
        </td>
      </tr>`;
    }).join('');

    tbody.querySelectorAll('.dl-save-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const id  = btn.dataset.epId;
        const inp = tbody.querySelector(`.dl-input[data-ep-id="${id}"]`);
        const val = parseInt(inp.value, 10) || 0;
        const ep  = data.episodes.find(e => e.id === id);
        if (!ep) return;
        ep.downloads = val;
        save('cms: update downloads');
        btn.textContent = '✓ Saved';
        btn.classList.add('saved');
        setTimeout(() => { btn.textContent = 'Save'; btn.classList.remove('saved'); }, 2000);
      });
    });
  }


  // ── Initial render ───────────────────────────
  renderSettings();
  renderCategories();
  renderArticles();
  renderEpisodes();
  renderDownloads();
}
