export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const GUARDIAN_KEY = process.env.GUARDIAN_KEY;
    if (!GUARDIAN_KEY) {
        return res.status(500).json({ error: 'Hiányzó Guardian API kulcs' });
    }

    const { section } = req.query;
    if (!section) {
        return res.status(400).json({ error: 'Hiányzó section paraméter' });
    }

    const params = new URLSearchParams({
        'api-key':     GUARDIAN_KEY,
        section,
        'show-fields': 'body,thumbnail,trailText',
        'order-by':    'newest',
        'page-size':   '10',
    });

    const upstream = await fetch(`https://content.guardianapis.com/search?${params}`);
    const data = await upstream.json();

    return res.status(upstream.status).json(data);
}
