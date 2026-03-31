/*
 * finance.js — Vercel API route
 *
 * Data sources (cascade per symbol):
 *   1. Yahoo Finance v8/chart  (query1)
 *   2. Yahoo Finance v8/chart  (query2)  ← different IP pool
 *   3. Stooq daily CSV                   ← fallback, cloud-friendly
 */

const YF_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://finance.yahoo.com/',
};

// Yahoo symbol → Stooq symbol
const STOOQ_MAP = {
    'GC=F':  'gc.f',
    'SI=F':  'si.f',
    'HG=F':  'hg.f',
    'NEM':   'nem.us',
    'RGLD':  'rgld.us',
    'NVDA':  'nvda.us',
    'FCX':   'fcx.us',
};

/* ── Try Yahoo Finance v8/chart on a given host ──────────── */
async function tryYahoo(sym, host) {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
    const r   = await fetch(url, { headers: YF_HEADERS });
    if (!r.ok) return null;
    const data  = await r.json();
    const meta  = data?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice ?? null;
    if (!price) return null;
    const prev  = meta.chartPreviousClose
               ?? meta.regularMarketPreviousClose
               ?? null;
    return {
        symbol: sym,
        regularMarketPrice: price,
        regularMarketChangePercent: prev ? ((price - prev) / prev * 100) : null,
    };
}

/* ── Stooq daily CSV fallback ────────────────────────────── */
async function tryStooq(sym) {
    const stooqSym = STOOQ_MAP[sym];
    if (!stooqSym) return null;

    const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSym)}&i=d&l=3`;
    const r   = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible)', 'Accept': 'text/csv' },
    });
    if (!r.ok) return null;

    const text  = await r.text();
    const rows  = text.trim().split('\n').filter(l => !/^Date/i.test(l) && l.trim());
    if (rows.length < 1) return null;

    const latest   = rows[rows.length - 1].split(',');
    const previous = rows.length >= 2 ? rows[rows.length - 2].split(',') : null;

    const close    = parseFloat(latest[4]);
    const prevClose = previous ? parseFloat(previous[4]) : null;

    if (isNaN(close)) return null;

    return {
        symbol: sym,
        regularMarketPrice: close,
        regularMarketChangePercent: (prevClose && !isNaN(prevClose))
            ? ((close - prevClose) / prevClose * 100)
            : null,
    };
}

/* ── Fetch one symbol: Yahoo → Yahoo query2 → Stooq ─────── */
async function fetchQuote(sym) {
    try {
        const q1 = await tryYahoo(sym, 'query1.finance.yahoo.com');
        if (q1) return q1;
    } catch {}

    try {
        const q2 = await tryYahoo(sym, 'query2.finance.yahoo.com');
        if (q2) return q2;
    } catch {}

    try {
        const sq = await tryStooq(sym);
        if (sq) return sq;
    } catch {}

    return null;
}

/* ── Handler ─────────────────────────────────────────────── */
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=60');

    const { symbols, search, history } = req.query;

    try {
        // ── Multi-symbol quotes ──
        if (symbols) {
            const syms    = symbols.split(',').map(s => s.trim()).filter(Boolean);
            const results = await Promise.all(syms.map(fetchQuote));
            return res.status(200).json({
                quoteResponse: { result: results.filter(Boolean) }
            });
        }

        // ── Search ──
        if (search) {
            const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(search)}&quotesCount=8&newsCount=0&listsCount=0`;
            const r   = await fetch(url, { headers: YF_HEADERS });
            if (!r.ok) return res.status(r.status).json({ error: 'search error' });
            return res.status(200).json(await r.json());
        }

        // ── Historical chart ──
        if (history) {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(history)}?interval=1d&range=6mo`;
            const r   = await fetch(url, { headers: YF_HEADERS });
            if (!r.ok) return res.status(r.status).json({ error: 'history error' });
            return res.status(200).json(await r.json());
        }

        return res.status(400).json({ error: 'Hiányzó paraméter: symbols, search vagy history' });

    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
