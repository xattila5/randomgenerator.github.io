/* ── API végpontok ────────────────────────────────────── */
const IS_NETLIFY = window.location.hostname !== 'localhost' &&
                   window.location.hostname !== '127.0.0.1' &&
                   !window.location.protocol.startsWith('file');
const DEEPL_KEY  = (typeof SAL_CONFIG !== 'undefined') ? SAL_CONFIG.DEEPL_KEY : '';

let article         = null;
let currentLang     = 'en';
let translatedTitle = '';
let translatedPars  = [];
let paragraphs      = [];   // angol bekezdések – fordítás alapja
let deeplExhausted  = false;

/* ── Napi fordítási cache (localStorage) ─────────────── */

function getTodayCacheKey() {
    return 'sal_art_trans_' + new Date().toISOString().slice(0, 10);
}

function loadArticleCache() {
    const today = getTodayCacheKey();
    for (let i = localStorage.length - 1; i >= 0; i--) {
        const k = localStorage.key(i);
        if (k?.startsWith('sal_art_trans_') && k !== today) localStorage.removeItem(k);
    }
    try { return JSON.parse(localStorage.getItem(today) || '{}'); }
    catch { return {}; }
}

function saveArticleCache(cache) {
    try { localStorage.setItem(getTodayCacheKey(), JSON.stringify(cache)); }
    catch {}
}

function getCacheKey(url) {
    return url || '';
}

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

/* ── Bekezdések kinyerése a Guardian HTML-ből ────────── */
// A <p>, <h2>, <h3> elemeket szeparálja – ezek mennek fordításra
function extractParagraphs(html) {
    if (!html) return [];
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return [...doc.querySelectorAll('p, h2, h3')]
        .map(el => el.textContent.trim())
        .filter(t => t.length > 20);
}

/* ── Fordítás ────────────────────────────────────────── */

// DeepL: az összes bekezdés egyszerre – pontosabb kontextusértés
// onProgress(done, total) – opcionális callback az előrehaladáshoz
async function translateWithDeepL(texts, onProgress) {
    if (!IS_NETLIFY && !DEEPL_KEY?.trim()) throw new Error('nincs DeepL kulcs');
    if (deeplExhausted) throw new Error('DeepL keret elfogyott');
    // DeepL max 50 szöveg / kérés – ha több, feldaraboljuk
    const CHUNK = 50;
    const all   = [];
    for (let i = 0; i < texts.length; i += CHUNK) {
        const deeplBody = JSON.stringify({ text: texts.slice(i, i + CHUNK), target_lang: 'HU', source_lang: 'EN' });
        const deeplReq  = IS_NETLIFY
            ? fetch('/api/deepl', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: deeplBody })
            : fetch('https://api-free.deepl.com/v2/translate', {
                method:  'POST',
                headers: { 'Authorization': `DeepL-Auth-Key ${DEEPL_KEY}`, 'Content-Type': 'application/json' },
                body: deeplBody,
              });
        const res = await withTimeout(deeplReq, 15000);
        if (res.status === 456) {
            deeplExhausted = true;
            showDeeplWarning();
            throw new Error('DeepL keret elfogyott (456)');
        }
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(`DeepL ${res.status}: ${err.message || ''}`);
        }
        const data = await res.json();
        all.push(...data.translations.map(t => t.text));
        if (onProgress) onProgress(Math.min(i + CHUNK, texts.length), texts.length);
    }
    return all;
}

function showDeeplWarning() {
    if (document.getElementById('art-deepl-warning')) return;
    const el = document.createElement('div');
    el.id = 'art-deepl-warning';
    el.className = 'deepl-warning';
    el.style.margin = '0 0 12px';
    el.innerHTML = `<span>⚠️ A DeepL fordítási keret mára elfogyott — Google fordítóra váltottunk.</span>
        <button class="deepl-warning-close" onclick="this.parentElement.remove()">×</button>`;
    const status = document.getElementById('artStatus');
    if (status) status.insertAdjacentElement('beforebegin', el);
}

// Google Translate – fallback egy bekezdéshez (max 500 kar.)
async function translateWithGoogle(text) {
    const q   = text.substring(0, 500);
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hu&dt=t&q=${encodeURIComponent(q)}`;
    const res = await withTimeout(fetch(url), 8000);
    const data = await res.json();
    return data[0]?.map(c => c?.[0] || '').join('') || text;
}

// MyMemory – második fallback
async function translateWithMyMemory(text) {
    const q   = text.substring(0, 500);
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=en|hu`;
    const res = await withTimeout(fetch(url), 8000);
    const data = await res.json();
    if (data.responseStatus === 200) return decodeEntities(data.responseData.translatedText);
    throw new Error('MyMemory hiba');
}

// Tömbös fordítás: DeepL egyszerre mindent, ha nem megy → Google egyenként
// onProgress(done, total) – callback az előrehaladáshoz
async function translateBatch(texts, onProgress) {
    if (!texts.length) return [];
    try {
        return await translateWithDeepL(texts, onProgress);
    } catch (deeplErr) {
        console.warn('DeepL nem elérhető, Google Translate fallback:', deeplErr.message);
    }
    // Google: 3-asával párhuzamosan, 300ms szünet (rate limit elkerülés)
    const result = [];
    for (let i = 0; i < texts.length; i += 3) {
        const batch = await Promise.all(
            texts.slice(i, i + 3).map(t =>
                translateWithGoogle(t)
                    .catch(() => translateWithMyMemory(t))
                    .catch(() => t)
            )
        );
        result.push(...batch);
        if (onProgress) onProgress(Math.min(i + 3, texts.length), texts.length);
        if (i + 3 < texts.length) await new Promise(r => setTimeout(r, 300));
    }
    return result;
}

/* ── Megjelenítés ────────────────────────────────────── */

function setStatus(msg) {
    const el = document.getElementById('artStatus');
    el.textContent = msg;
    el.style.display = msg ? 'block' : 'none';
}

function renderMeta(title) {
    document.getElementById('artTitle').textContent    = title;
    document.getElementById('artDate').textContent     = formatDate(article.date);
    document.getElementById('artCategory').textContent = article.category || '';
    document.getElementById('artExtLink').href         = article.url || '#';
    document.title = `${title} – S.A.L. Tools`;

    const img = document.getElementById('artImg');
    if (article.image) {
        img.src = article.image;
        img.style.display = 'block';
        img.onerror = () => { img.style.display = 'none'; };
    } else {
        img.style.display = 'none';
    }
}

function renderEnglish() {
    renderMeta(article.title);
    const content = document.getElementById('artContent');
    if (article.fullHtml) {
        content.innerHTML = article.fullHtml;
        content.querySelectorAll('a').forEach(a => {
            a.target = '_blank'; a.rel = 'noopener noreferrer';
        });
    } else if (paragraphs.length) {
        content.innerHTML = paragraphs.map(p => `<p>${esc(p)}</p>`).join('');
    } else {
        content.innerHTML = '<p class="art-placeholder">Nincs tartalom.</p>';
    }
}

function renderHungarian() {
    renderMeta(translatedTitle || article.title);
    const content = document.getElementById('artContent');
    if (translatedPars.length) {
        content.innerHTML = translatedPars.map(p => `<p>${esc(p)}</p>`).join('');
    } else {
        content.innerHTML = '<p class="art-placeholder">Fordítás folyamatban…</p>';
    }
}

/* ── Nyelvváltás ─────────────────────────────────────── */

async function setLang(lang) {
    if (lang === currentLang) return;
    currentLang = lang;
    document.getElementById('btn-en').classList.toggle('active', lang === 'en');
    document.getElementById('btn-hu').classList.toggle('active', lang === 'hu');

    if (lang === 'hu' && !translatedPars.length) {
        await runTranslation();
    }
    lang === 'en' ? renderEnglish() : renderHungarian();
}

async function runTranslation() {
    if (!paragraphs.length) return;

    // Cache ellenőrzés
    const cache    = loadArticleCache();
    const cacheKey = getCacheKey(article.url);
    if (cacheKey && cache[cacheKey]) {
        const saved = cache[cacheKey];
        translatedTitle = saved.title || article.title;
        translatedPars  = saved.pars  || [];
        return;
    }

    const total = paragraphs.length + 1; // +1 a cím
    setStatus(`AI fordítás folyamatban… (0 / ${total} bekezdés)`);

    const onProgress = (done, _total) => {
        setStatus(`AI fordítás folyamatban… (${done} / ${total} bekezdés)`);
    };

    // Cím + összes bekezdés egyszerre DeepL-lel (vagy Google fallbackkel)
    try {
        const all     = [article.title, ...paragraphs];
        const results = await translateBatch(all, onProgress);
        translatedTitle = results[0] || article.title;
        translatedPars  = results.slice(1);
    } catch {
        translatedTitle = article.title;
        translatedPars  = [...paragraphs];
    }

    // Cache mentés
    if (cacheKey) {
        cache[cacheKey] = { title: translatedTitle, pars: translatedPars };
        saveArticleCache(cache);
    }

    setStatus('');
}

/* ── Init ────────────────────────────────────────────── */

async function init() {
    const raw = localStorage.getItem('sal_article');
    if (!raw) {
        document.getElementById('artContent').innerHTML =
            '<div class="weather-error">Nem található cikk. Nyissa meg a ' +
            '<a href="hirek.html" style="color:var(--accent-light)">hírek oldalról</a>.</div>';
        return;
    }

    try { article = JSON.parse(raw); }
    catch {
        document.getElementById('artContent').innerHTML =
            '<div class="weather-error">Hibás adatok.</div>';
        return;
    }

    // Bekezdések kinyerése fordításhoz – a <p>/<h2>/<h3> elemekből, nem stripHtml-ből
    if (article.fullHtml) {
        paragraphs = extractParagraphs(article.fullHtml);
    } else if (article.fullText) {
        // Fallback: mondatonkénti darabolás
        paragraphs = article.fullText
            .split(/(?<=[.!?])\s{1,3}(?=[A-Z])/)
            .map(s => s.trim())
            .filter(s => s.length > 20);
    } else if (article.description) {
        paragraphs = [article.description];
    }

    renderEnglish();
}

init();
