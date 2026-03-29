import { kv } from '@vercel/kv';

const CITIES = {
    budapest: { lat: 47.4979,  lon: 19.0402,  tz: 'Europe/Budapest' },
    gyula:    { lat: 46.6469,  lon: 21.2803,  tz: 'Europe/Budapest' },
    szeged:   { lat: 46.2530,  lon: 20.1414,  tz: 'Europe/Budapest' },
    xian:     { lat: 34.3416,  lon: 108.9398, tz: 'Asia/Shanghai'   },
};

const TTL_SEC = 60 * 60; // 1 óra

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    const cityKey = req.query.city;
    if (!CITIES[cityKey]) {
        return res.status(400).send('Ismeretlen város');
    }

    const force = req.query.force === '1';

    // Cache ellenőrzés
    if (!force) {
        try {
            const cached = await kv.get(`weather:${cityKey}`);
            if (cached) {
                return res.status(200).json(cached);
            }
        } catch { /* cache miss, folytatás */ }
    }

    // Friss adat az Open-Meteo-tól
    const { lat, lon, tz } = CITIES[cityKey];
    const url = 'https://api.open-meteo.com/v1/forecast'
        + `?latitude=${lat}&longitude=${lon}`
        + '&hourly=temperature_2m,weathercode,windspeed_10m,precipitation_probability'
        + `&timezone=${encodeURIComponent(tz)}`
        + '&forecast_days=9';

    const upstream = await fetch(url);
    if (!upstream.ok) {
        return res.status(502).send(`Open-Meteo hiba: ${upstream.status}`);
    }

    const data    = await upstream.json();
    const payload = { ...data, _cachedAt: Date.now() };

    try {
        await kv.set(`weather:${cityKey}`, payload, { ex: TTL_SEC });
    } catch { /* cache írás nem kritikus */ }

    return res.status(200).json(payload);
}
