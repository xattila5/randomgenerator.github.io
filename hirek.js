/* ── API végpontok ────────────────────────────────────── */
// Ha Netlify-on fut: /api/... proxy (kulcsok a szerveren)
// Ha lokálisan fut: config.js-ből olvassa a kulcsokat
const IS_NETLIFY = window.location.hostname !== 'localhost' &&
                   window.location.hostname !== '127.0.0.1' &&
                   !window.location.protocol.startsWith('file');
const LOCAL_CFG  = (typeof SAL_CONFIG !== 'undefined') ? SAL_CONFIG : {};
const DEEPL_KEY  = LOCAL_CFG.DEEPL_KEY || '';
let deeplExhausted = false;
let translationCache = {};   // napi cache, localStorage-ból töltve

const GUARDIAN_SECTIONS = ['politics', 'world', 'business'];
const TIMEOUT = 9000;

let articles     = [];
let translations = {};
let currentLang  = 'en';

/* ── Utils ──────────────────────────────────────────── */

function withTimeout(p, ms) {
    return Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), ms))]);
}

function esc(str) {
    return (str || '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function decodeEntities(str) {
    return (str || '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

function stripHtml(str) {
    return (str || '').replace(/<[^>]*>/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('hu-HU', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const SECTION_LABELS = {
    politics: 'POLITIKA',
    world:    'VILÁG',
    business: 'GAZDASÁG',
};

/* ── Guardian fetch ──────────────────────────────────── */

function sanitizeGuardianHtml(html) {
    if (!html) return '';
    const doc = new DOMParser().parseFromString(html, 'text/html');
    // Zaj eltávolítása
    ['script','style','iframe','noscript',
     '[class*="rich-link"]','[class*="ad-slot"]','[class*="witness"]',
     '[data-component="rich-link"]','.element-rich-link',
    ].forEach(sel => { try { doc.querySelectorAll(sel).forEach(e => e.remove()); } catch {} });
    // Event handlerek eltávolítása
    doc.querySelectorAll('*').forEach(el => {
        [...el.attributes].filter(a => a.name.startsWith('on')).forEach(a => el.removeAttribute(a.name));
    });
    return doc.body.innerHTML;
}

async function fetchSection(section) {
    let res;
    if (IS_NETLIFY) {
        res = await withTimeout(
            fetch(`/api/guardian?section=${encodeURIComponent(section)}`), TIMEOUT
        );
    } else {
        const params = new URLSearchParams({
            'api-key':     LOCAL_CFG.GUARDIAN_KEY || '',
            section,
            'show-fields': 'body,thumbnail,trailText',
            'order-by':    'newest',
            'page-size':   '10',
        });
        res = await withTimeout(
            fetch(`https://content.guardianapis.com/search?${params}`), TIMEOUT
        );
    }
    if (!res.ok) throw new Error(`Guardian HTTP ${res.status}`);
    const data = await res.json();
    if (data.response?.status !== 'ok') throw new Error('Guardian API hiba');

    return data.response.results
        .filter(a => a.webTitle && a.webUrl)
        .map(a => {
            const rawBody = a.fields?.body || '';
            return {
                title:       a.webTitle,
                description: stripHtml(a.fields?.trailText || ''),
                url:         a.webUrl,
                image:       a.fields?.thumbnail || '',
                date:        a.webPublicationDate || '',
                category:    SECTION_LABELS[section] || section.toUpperCase(),
                source:      'The Guardian',
                fullHtml:    sanitizeGuardianHtml(rawBody),   // képekkel, formázással
                fullText:    stripHtml(rawBody),               // fordításhoz
            };
        });
}

/* ── Main fetch ─────────────────────────────────────── */

async function fetchNews() {
    const btn = document.getElementById('refreshBtn');
    if (btn) btn.classList.add('loading');
    translations = {};
    initTranslationCache();

    if (!IS_NETLIFY && !LOCAL_CFG.GUARDIAN_KEY?.trim()) {
        document.getElementById('newsContainer').innerHTML = `
            <div class="weather-error">
                <div class="weather-error-icon">🔑</div>
                <div>Hiányzik a Guardian API kulcs.</div>
                <div style="font-size:.65rem;margin-top:8px;opacity:.6;line-height:1.6">
                    Regisztrálj ingyen:<br>
                    <strong>open-platform.theguardian.com/access</strong><br>
                    majd add meg a kulcsot a <code>hirek.js</code> tetején.
                </div>
            </div>`;
        if (btn) btn.classList.remove('loading');
        return;
    }

    setLoading('Hírek betöltése…');

    try {
        // Politika + Világ + Gazdaság párhuzamosan
        const results = await Promise.allSettled(
            GUARDIAN_SECTIONS.map(s => fetchSection(s))
        );

        const merged = results
            .filter(r => r.status === 'fulfilled')
            .flatMap(r => r.value);

        // Deduplikálás URL szerint + dátum szerinti rendezés
        const seen = new Set();
        articles = merged
            .filter(a => { if (seen.has(a.url)) return false; seen.add(a.url); return true; })
            .sort((a, b) => new Date(b.date) - new Date(a.date));

        if (!articles.length) throw new Error('Üres cikklista – ellenőrizd az API kulcsot');

        const lbl = document.getElementById('newsSourceLabel');
        if (lbl) lbl.textContent = 'The Guardian — Politika · Világ · Gazdaság';

        if (currentLang === 'hu') await translateAll();
        renderNews();

    } catch (err) {
        document.getElementById('newsContainer').innerHTML = `
            <div class="weather-error">
                <div class="weather-error-icon">⚠️</div>
                <div>Nem sikerült betölteni a híreket.</div>
                <div style="font-size:.62rem;margin-top:6px;opacity:.5">${esc(err?.message || '')}</div>
                <button class="btn-primary" style="margin-top:20px" onclick="fetchNews()"><span>Újrapróbálás</span></button>
            </div>`;
    }

    if (btn) btn.classList.remove('loading');
}

function setLoading(msg) {
    document.getElementById('newsContainer').innerHTML = `
        <div class="news-loading">
            <div class="weather-spinner"></div>
            <div>${esc(msg)}</div>
        </div>`;
}

/* ── Render cards ───────────────────────────────────── */

function renderNews() {
    const container = document.getElementById('newsContainer');
    container.innerHTML = articles.map((article, i) => {
        const t       = (currentLang === 'hu' && translations[i]) ? translations[i] : article;
        const title   = esc(t.title       || article.title);
        const desc    = esc(t.description || article.description);
        const openLbl = currentLang === 'hu' ? 'Megnyitás' : 'Open';

        const imgHTML = article.image
            ? `<div class="news-card-img-wrap">
                   <img class="news-card-img" src="${esc(article.image)}" alt="" loading="lazy"
                        onerror="this.closest('.news-card-img-wrap').style.display='none'">
               </div>`
            : '';

        return `
        <div class="news-card" onclick="openArticle(${i})">
            <div class="news-card-accent"></div>
            ${imgHTML}
            <div class="news-card-body">
                <div class="news-card-category">${esc(article.category)}</div>
                <div class="news-card-title">${title}</div>
                <div class="news-card-desc">${desc}</div>
                <div class="news-card-footer">
                    <span class="news-card-date">${esc(formatDate(article.date))}</span>
                    <span class="news-open-hint">${openLbl} ↗</span>
                </div>
            </div>
        </div>`;
    }).join('');
}

/* ── Article page ────────────────────────────────────── */

function openArticle(i) {
    const article = articles[i];
    if (!article) return;
    localStorage.setItem('sal_article', JSON.stringify(article));
    window.open('cikk.html', '_blank');
}

/* ── Language ───────────────────────────────────────── */

function launchConfetti(originEl) {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const rect = originEl.getBoundingClientRect();
    const ox = rect.left + rect.width / 2;
    const oy = rect.top  + rect.height / 2;
    const colors = ['#d4b87a', '#b89a5a', '#f0d49a', '#8a6e38', '#e8cc88', '#fae8b4'];
    const particles = Array.from({ length: 60 }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = 3 + Math.random() * 5;
        const size  = 4 + Math.random() * 5;
        return {
            x: ox, y: oy,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - (2 + Math.random() * 3),
            w: size, h: size * (0.3 + Math.random() * 0.5),
            rot: Math.random() * 360,
            rotV: (Math.random() - 0.5) * 8,
            color: colors[Math.floor(Math.random() * colors.length)],
            alpha: 1,
            gravity: 0.18 + Math.random() * 0.1,
        };
    });
    function tick() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        let alive = false;
        for (const p of particles) {
            p.vy += p.gravity; p.x += p.vx; p.y += p.vy;
            p.rot += p.rotV; p.alpha -= 0.016;
            if (p.alpha <= 0) continue;
            alive = true;
            ctx.save(); ctx.globalAlpha = p.alpha;
            ctx.translate(p.x, p.y); ctx.rotate(p.rot * Math.PI / 180);
            ctx.fillStyle = p.color;
            ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            ctx.restore();
        }
        if (alive) requestAnimationFrame(tick); else canvas.remove();
    }
    requestAnimationFrame(tick);
}

async function setLang(lang, btn) {
    if (lang === currentLang) return;
    if (btn) launchConfetti(btn);
    currentLang = lang;
    document.getElementById('btn-en').classList.toggle('active', lang === 'en');
    document.getElementById('btn-hu').classList.toggle('active', lang === 'hu');

    if (lang === 'hu') {
        const missing = articles.filter((_, i) => !translations[i]);
        if (missing.length) {
            setLoading('AI fordítás folyamatban…');
            await translateAll();
        }
    }
    renderNews();
}

/* ── Translation cache (napi, localStorage) ─────────── */

function getTodayCacheKey() {
    return 'sal_trans_' + new Date().toISOString().slice(0, 10);
}

function initTranslationCache() {
    const today = getTodayCacheKey();
    // Régi napok törlése
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith('sal_trans_') && k !== today) localStorage.removeItem(k);
    }
    try {
        translationCache = JSON.parse(localStorage.getItem(today) || '{}');
    } catch { translationCache = {}; }
}

function persistCache() {
    try {
        localStorage.setItem(getTodayCacheKey(), JSON.stringify(translationCache));
    } catch {}
}

/* ── DeepL quota figyelmeztetés ─────────────────────── */

function showDeeplWarning() {
    if (document.getElementById('deepl-warning')) return;
    const el = document.createElement('div');
    el.id = 'deepl-warning';
    el.className = 'deepl-warning';
    el.innerHTML = `<span>⚠️ A DeepL fordítási keret mára elfogyott — Google fordítóra váltottunk.</span>
        <button class="deepl-warning-close" onclick="this.parentElement.remove()">×</button>`;
    const controls = document.querySelector('.news-controls');
    if (controls) controls.insertAdjacentElement('afterend', el);
}

/* ── AI Translation ─────────────────────────────────── */

async function translateAll() {
    const indices = articles.map((_, i) => i).filter(i => !translations[i]);
    await Promise.all(indices.map(async i => {
        const a = articles[i];
        const [title, description] = await Promise.all([
            translateText(a.title),
            translateText(a.description.substring(0, 500)),
        ]);
        translations[i] = { title, description };
    }));
}

async function translateText(text) {
    if (!text?.trim()) return text;
    const q = text.substring(0, 500);

    // Cache találat
    if (translationCache[q]) return translationCache[q];

    let result = '';

    // 1. DeepL (ha még nincs kimerítve)
    if (!deeplExhausted) {
        try {
            const deeplBody = JSON.stringify({ text: [q], source_lang: 'EN', target_lang: 'HU' });
            const deeplReq  = IS_NETLIFY
                ? fetch('/api/deepl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: deeplBody })
                : fetch('https://api-free.deepl.com/v2/translate', {
                    method: 'POST',
                    headers: { 'Authorization': `DeepL-Auth-Key ${DEEPL_KEY}`, 'Content-Type': 'application/json' },
                    body: deeplBody,
                  });
            const res = await withTimeout(deeplReq, 8000);
            if (res.status === 456) {
                // Keret elfogyott
                deeplExhausted = true;
                showDeeplWarning();
            } else if (res.ok) {
                const data = await res.json();
                result = data.translations?.[0]?.text || '';
            }
        } catch { /* hálózati hiba, tovább */ }
    }

    // 2. Google fordító (fallback)
    if (!result) {
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hu&dt=t&q=${encodeURIComponent(q)}`;
            const res = await withTimeout(fetch(url), 6000);
            const data = await res.json();
            result = data[0]?.map(c => c?.[0] || '').join('') || '';
        } catch { /* fall through */ }
    }

    if (result) {
        translationCache[q] = result;
        persistCache();
        return result;
    }
    return text;
}

/* ── Boot ───────────────────────────────────────────── */
fetchNews();
