export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=60');

    const { symbols, search, history } = req.query;

    try {
        if (search) {
            const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(search)}&quotesCount=8&newsCount=0&listsCount=0`;
            const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (!r.ok) return res.status(r.status).json({ error: 'Yahoo search error' });
            const data = await r.json();
            return res.status(200).json(data);
        }

        if (symbols) {
            const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols)}`;
            const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (!r.ok) return res.status(r.status).json({ error: 'Yahoo quote error' });
            const data = await r.json();
            return res.status(200).json(data);
        }

        if (history) {
            const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(history)}?interval=1d&range=6mo`;
            const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (!r.ok) return res.status(r.status).json({ error: 'Yahoo history error' });
            const data = await r.json();
            return res.status(200).json(data);
        }

        return res.status(400).json({ error: 'Hiányzó paraméter: symbols, search vagy history' });
    } catch (e) {
        return res.status(500).json({ error: e.message });
    }
}
