/*
 * finance.js — Vercel API route
 *
 * Yahoo Finance blocks some cloud-provider IPs.
 * Key fix: AbortController timeouts prevent Vercel function timeout.
 *
 * Cascade:
 *   quotes  : Yahoo query1 (3s) → Yahoo query2 (3s) → Stooq JSON
 *   history : Yahoo query1 (6s) → Yahoo query2 (6s) → 502 error
 *   search  : Yahoo query1 only
 */

const YF_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://finance.yahoo.com/',
};

// Yahoo symbol → Stooq symbol (single-symbol JSON quote endpoint)
const STOOQ_MAP = {
    'GC=F':  'gc.f',
    'SI=F':  'si.f',
    'HG=F':  'hg.f',
    'NEM':   'nem.us',
    'RGLD':  'rgld.us',
    'NVDA':  'nvda.us',
    'FCX':   'fcx.us',
};

/* ── Fetch with AbortController timeout ─────────────────── */
async function fetchT(url, options, ms) {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), ms);
    try {
        const r = await fetch(url, { ...options, signal: ctrl.signal });
        clearTimeout(timer);
        return r;
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

/* ── Yahoo Finance: single-symbol quote ─────────────────── */
async function tryYahooQuote(sym, host) {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
    const r   = await fetchT(url, { headers: YF_HEADERS }, 3000);
    if (!r.ok) return null;
    const meta  = (await r.json())?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice ?? null;
    if (!price) return null;
    const prev = meta.chartPreviousClose ?? meta.regularMarketPreviousClose ?? null;
    return {
        symbol: sym,
        regularMarketPrice: price,
        regularMarketChangePercent: prev ? ((price - prev) / prev * 100) : null,
    };
}

/* ── Stooq JSON: single-symbol quote (no prev close) ────── */
async function tryStooqQuote(sym) {
    const stooqSym = STOOQ_MAP[sym];
    if (!stooqSym) return null;
    // f=sd2ohlcv : symbol, date, open, high, low, close, volume
    const url = `https://stooq.com/q/l/?s=${encodeURIComponent(stooqSym)}&f=sd2t2ohlcv&h&e=json`;
    const r   = await fetchT(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }, 4000);
    if (!r.ok) return null;
    const data = await r.json();
    const s    = data?.symbols?.[0];
    if (!s?.close) return null;
    // Change: intraday open→close (best available without prev session close)
    const change = (s.open && s.close)
        ? ((s.close - s.open) / s.open * 100)
        : null;
    return {
        symbol: sym,
        regularMarketPrice: s.close,
        regularMarketChangePercent: change,
    };
}

/* ── Yahoo Finance: historical chart ────────────────────── */
async function tryYahooHistory(sym, host) {
    const url = `https://${host}/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=6mo`;
    const r   = await fetchT(url, { headers: YF_HEADERS }, 6000);
    if (!r.ok) return null;
    const data = await r.json();
    if (!data?.chart?.result?.[0]?.timestamp?.length) return null;
    return data;
}

/* ── Fetch one quote: Yahoo q1 → Yahoo q2 → Stooq ──────── */
async function fetchQuote(sym) {
    for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
        try { const r = await tryYahooQuote(sym, host); if (r) return r; } catch {}
    }
    try { const r = await tryStooqQuote(sym); if (r) return r; } catch {}
    return null;
}

/* ── Fetch history: Yahoo q1 → Yahoo q2 ────────────────── */
async function fetchHistory(sym) {
    for (const host of ['query1.finance.yahoo.com', 'query2.finance.yahoo.com']) {
        try { const r = await tryYahooHistory(sym, host); if (r) return r; } catch {}
    }
    return null;
}

/* ── Handler ─────────────────────────────────────────────── */
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=60');

    const { symbols, search, history } = req.query;

    try {
        if (symbols) {
            const syms    = symbols.split(',').map(s => s.trim()).filter(Boolean);
            const results = await Promise.all(syms.map(fetchQuote));
            return res.status(200).json({ quoteResponse: { result: results.filter(Boolean) } });
        }

        if (history) {
            const data = await fetchHistory(history);
            if (!data) return res.status(502).json({ error: 'Minden adatforrás elérhetetlen' });
            return res.status(200).json(data);
        }

        if (search) {
            const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(search)}&quotesCount=8&newsCount=0&listsCount=0`;
            const r   = await fetchT(url, { headers: YF_HEADERS }, 5000);
            if (!r.ok) return res.status(r.status).json({ error: 'search error' });
            return res.status(200).json(await r.json());
        }

        return res.status(400).json({ error: 'Hiányzó paraméter: symbols, search vagy history' });

    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
