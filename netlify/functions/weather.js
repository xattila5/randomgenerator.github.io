const { getStore } = require('@netlify/blobs');

const CITIES = {
    budapest: { lat: 47.4979,  lon: 19.0402,  tz: 'Europe/Budapest' },
    gyula:    { lat: 46.6469,  lon: 21.2803,  tz: 'Europe/Budapest' },
    szeged:   { lat: 46.2530,  lon: 20.1414,  tz: 'Europe/Budapest' },
    xian:     { lat: 34.3416,  lon: 108.9398, tz: 'Asia/Shanghai'   },
};

const TTL_MS = 60 * 60 * 1000; // 1 óra

exports.handler = async (event) => {
    const cityKey = event.queryStringParameters?.city;
    if (!CITIES[cityKey]) {
        return { statusCode: 400, body: 'Ismeretlen város' };
    }

    const force = event.queryStringParameters?.force === '1';

    let store;
    try { store = getStore('weather'); } catch { store = null; }

    // Cache ellenőrzés (ha nincs force refresh)
    if (store && !force) {
        try {
            const entry = await store.getWithMetadata(cityKey, { type: 'text' });
            if (entry?.metadata?.expires > Date.now()) {
                const payload = { ...JSON.parse(entry.data), _cachedAt: entry.metadata.cachedAt };
                return {
                    statusCode: 200,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify(payload),
                };
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

    const res = await fetch(url);
    if (!res.ok) {
        return { statusCode: 502, body: `Open-Meteo hiba: ${res.status}` };
    }

    const data = await res.json();
    const now  = Date.now();

    if (store) {
        try {
            await store.set(cityKey, JSON.stringify(data), {
                metadata: { expires: now + TTL_MS, cachedAt: now },
            });
        } catch { /* cache írás nem kritikus */ }
    }

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({ ...data, _cachedAt: now }),
    };
};
