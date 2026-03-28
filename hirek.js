/* ── Config ─────────────────────────────────────────── */

const FEEDS = [
    { name: 'CNN',      url: 'https://rss.cnn.com/rss/edition.rss' },
    { name: 'BBC News', url: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
    { name: 'NPR',      url: 'https://feeds.npr.org/1001/rss.xml' },
];

const PROXIES  = [
    u => `https://corsproxy.io/?${encodeURIComponent(u)}`,
    u => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
    u => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(u)}`,
];

const MEDIA_NS = 'http://search.yahoo.com/mrss/';
const TIMEOUT  = 8000;

let articles     = [];
let translations = {};
let currentLang  = 'en';

/* ── Utils ──────────────────────────────────────────── */

function withTimeout(p, ms) {
    return Promise.race([p, new Promise((_, r) => setTimeout(() => r(new Error('Időtúllépés')), ms))]);
}

// Safe HTML escape for inserting into innerHTML
function esc(str) {
    return (str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function decodeEntities(str) {
    return (str || '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

function stripHtml(str) {
    return (str || '').replace(/<[^>]*>/g, ' ').replace(/\s{2,}/g, ' ').trim();
}

function sanitizeDesc(str) {
    // Keep basic formatting but strip scripts/events
    return (str || '')
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/\son\w+="[^"]*"/gi, '')
        .replace(/\son\w+='[^']*'/gi, '');
}

function getText(el, tag) {
    return el.querySelector(tag)?.textContent?.trim() || '';
}

function getImage(el) {
    const mc = el.getElementsByTagNameNS(MEDIA_NS, 'content')[0];
    if (mc?.getAttribute('url')) return mc.getAttribute('url');
    const mt = el.getElementsByTagNameNS(MEDIA_NS, 'thumbnail')[0];
    if (mt?.getAttribute('url')) return mt.getAttribute('url');
    const enc = el.querySelector('enclosure');
    if (enc?.getAttribute('url')) return enc.getAttribute('url');
    const m = getText(el, 'description').match(/<img[^>]+src=["']([^"']+)["']/i);
    return m ? m[1] : '';
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d)) return '';
    return d.toLocaleDateString('hu-HU', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ── RSS fetch (proxy chain + feed fallback) ────────── */

async function fetchViaProxy(feedUrl) {
    let lastErr;
    for (const makeProxy of PROXIES) {
        try {
            const res = await withTimeout(fetch(makeProxy(feedUrl)), TIMEOUT);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            let text = await res.text();
            if (text.trimStart().startsWith('{')) {
                const j = JSON.parse(text);
                text = j.contents || j.data || text;
            }
            const xml   = new DOMParser().parseFromString(text, 'text/xml');
            if (xml.querySelector('parsererror')) throw new Error('XML parse hiba');
            const items = [...xml.querySelectorAll('item')].slice(0, 15);
            if (!items.length) throw new Error('Üres feed');
            return items;
        } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('Proxy elérhetetlen');
}

function parseItems(items, sourceName) {
    return items.map(el => {
        const rawDesc = getText(el, 'description');
        return {
            title:       decodeEntities(getText(el, 'title')),
            description: decodeEntities(stripHtml(rawDesc)).substring(0, 400),
            descHtml:    sanitizeDesc(rawDesc),
            url:         getText(el, 'link') || getText(el, 'guid') || '#',
            image:       getImage(el),
            date:        getText(el, 'pubDate'),
            category:    (getText(el, 'category') || sourceName).toUpperCase(),
        };
    }).filter(a => a.title);
}

/* ── Main fetch ─────────────────────────────────────── */

async function fetchNews() {
    const container = document.getElementById('newsContainer');
    const btn       = document.getElementById('refreshBtn');

    if (btn) btn.classList.add('loading');
    translations = {};
    setLoading('Hírek betöltése…');

    let lastErr;
    for (const feed of FEEDS) {
        try {
            const items = await fetchViaProxy(feed.url);
            articles    = parseItems(items, feed.name);
            if (!articles.length) throw new Error('Üres cikklista');

            const lbl = document.getElementById('newsSourceLabel');
            if (lbl) lbl.textContent = `${feed.name} — Legfrissebb hírek`;

            if (currentLang === 'hu') await translateAll();
            renderNews();
            if (btn) btn.classList.remove('loading');
            return;
        } catch (e) { lastErr = e; }
    }

    container.innerHTML = `
        <div class="weather-error">
            <div class="weather-error-icon">⚠️</div>
            <div>Nem sikerült betölteni a híreket.</div>
            <div style="font-size:.62rem;margin-top:6px;opacity:.5">${esc(lastErr?.message || '')}</div>
            <button class="btn-primary" style="margin-top:20px" onclick="fetchNews()"><span>Újrapróbálás</span></button>
        </div>`;
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

/* ── Drawer ─────────────────────────────────────────── */

function openArticle(i) {
    const article = articles[i];
    if (!article) return;

    const t     = (currentLang === 'hu' && translations[i]) ? translations[i] : article;
    const title = t.title       || article.title;
    const desc  = t.description || article.description;
    const descHtml = t.descHtml || article.descHtml || esc(desc);

    // Image
    const imgEl = document.getElementById('drawerImg');
    if (article.image) {
        imgEl.src   = article.image;
        imgEl.style.display = 'block';
        imgEl.onerror = () => { imgEl.style.display = 'none'; };
    } else {
        imgEl.style.display = 'none';
    }

    // External link
    document.getElementById('drawerExtLink').href = article.url;

    // Content
    document.getElementById('drawerContent').innerHTML = `
        <div class="news-drawer-cat">${esc(article.category)}</div>
        <div class="news-drawer-title">${esc(title)}</div>
        <div class="news-drawer-date">${esc(formatDate(article.date))}</div>
        <div class="news-drawer-sep"></div>
        <div class="news-drawer-desc">${descHtml || `<p>${esc(desc)}</p>`}</div>`;

    document.getElementById('newsDrawer').classList.add('open');
    document.body.style.overflow = 'hidden';
}

function closeDrawer() {
    document.getElementById('newsDrawer').classList.remove('open');
    document.body.style.overflow = '';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDrawer(); });

/* ── Language ───────────────────────────────────────── */

async function setLang(lang) {
    if (lang === currentLang) return;
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

/* ── AI Translation (Google Neural MT) ─────────────── */

async function translateAll() {
    const indices = articles.map((_, i) => i).filter(i => !translations[i]);
    await Promise.all(indices.map(async i => {
        const a = articles[i];
        const [title, description, descHtml] = await Promise.all([
            translateText(a.title),
            translateText(a.description),
            translateText(stripHtml(a.descHtml)).then(t => `<p>${t}</p>`),
        ]);
        translations[i] = { title, description, descHtml };
    }));
}

async function translateText(text) {
    if (!text?.trim()) return text;
    const q = text.substring(0, 500);
    // Primary: Google Neural MT (unofficial CORS endpoint)
    try {
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=hu&dt=t&q=${encodeURIComponent(q)}`;
        const res = await withTimeout(fetch(url), 6000);
        const data = await res.json();
        const translated = data[0]?.map(c => c?.[0] || '').join('') || '';
        if (translated) return translated;
    } catch { /* fall through */ }

    // Fallback: MyMemory
    try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(q)}&langpair=en|hu`;
        const res = await withTimeout(fetch(url), 6000);
        const data = await res.json();
        if (data.responseStatus === 200) return decodeEntities(data.responseData.translatedText);
    } catch { /* fall through */ }

    return text; // original if all fail
}

/* ── Boot ───────────────────────────────────────────── */
fetchNews();
