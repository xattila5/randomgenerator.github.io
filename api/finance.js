export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=60');

    const { symbols, search, history } = req.query;

    const YF_HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'application/json',
        'Accept-Language': 'en-US,en;q=0.9',
        'Referer': 'https://finance.yahoo.com/',
        'Origin': 'https://finance.yahoo.com',
    };

    try {
        // ── Symbol quotes ── uses v8/chart (per-symbol, no crumb needed)
        if (symbols) {
            const syms = symbols.split(',').map(s => s.trim()).filter(Boolean);

            const results = await Promise.all(syms.map(async sym => {
                try {
                    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(sym)}?interval=1d&range=1d`;
                    const r   = await fetch(url, { headers: YF_HEADERS });
                    if (!r.ok) return null;
                    const data = await r.json();
                    const meta = data?.chart?.result?.[0]?.meta;
                    if (!meta) return null;

                    const price    = meta.regularMarketPrice ?? null;
                    const prevClose = meta.chartPreviousClose
                                   ?? meta.previousClose
                                   ?? meta.regularMarketPreviousClose
                                   ?? null;
                    const changePct = (price != null && prevClose)
                        ? ((price - prevClose) / prevClose) * 100
                        : null;

                    return {
                        symbol: sym,
                        regularMarketPrice: price,
                        regularMarketChangePercent: changePct,
                        exchDisp: meta.exchangeName ?? '',
                        exchange: meta.exchangeName ?? '',
                    };
                } catch {
                    return null;
                }
            }));

            return res.status(200).json({
                quoteResponse: { result: results.filter(Boolean) }
            });
        }

        // ── Search ──
        if (search) {
            const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(search)}&quotesCount=8&newsCount=0&listsCount=0`;
            const r   = await fetch(url, { headers: YF_HEADERS });
            if (!r.ok) return res.status(r.status).json({ error: 'Yahoo search error' });
            return res.status(200).json(await r.json());
        }

        // ── Historical chart ──
        if (history) {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(history)}?interval=1d&range=6mo`;
            const r   = await fetch(url, { headers: YF_HEADERS });
            if (!r.ok) return res.status(r.status).json({ error: 'Yahoo history error' });
            return res.status(200).json(await r.json());
        }

        return res.status(400).json({ error: 'Hiányzó paraméter: symbols, search vagy history' });

    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
