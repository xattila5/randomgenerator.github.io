import { kv } from '@vercel/kv';
import crypto from 'crypto';

const TTL_SEC = 24 * 60 * 60; // 24 óra

function cacheKey(text) {
    return 'tr_' + crypto.createHash('md5').update(text).digest('hex');
}

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (req.method === 'OPTIONS') {
        res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    const DEEPL_KEY = process.env.DEEPL_KEY;
    if (!DEEPL_KEY) {
        return res.status(500).json({ error: 'Hiányzó DeepL API kulcs' });
    }

    const body = req.body;
    if (!body) {
        return res.status(400).json({ error: 'Érvénytelen kérés' });
    }

    const texts    = Array.isArray(body.text) ? body.text : [body.text];
    const results  = new Array(texts.length).fill(null);
    const toFetch  = [];

    // Cache ellenőrzés
    await Promise.all(texts.map(async (text, i) => {
        try {
            const cached = await kv.get(cacheKey(text));
            if (cached !== null) {
                results[i] = cached;
            } else {
                toFetch.push({ idx: i, text });
            }
        } catch {
            toFetch.push({ idx: i, text });
        }
    }));

    // DeepL hívás csak a nem cachelt szövegekre
    if (toFetch.length > 0) {
        const deeplBody = {
            text:        toFetch.map(t => t.text),
            source_lang: body.source_lang || 'EN',
            target_lang: body.target_lang || 'HU',
        };

        const upstream = await fetch('https://api-free.deepl.com/v2/translate', {
            method:  'POST',
            headers: {
                'Authorization': `DeepL-Auth-Key ${DEEPL_KEY}`,
                'Content-Type':  'application/json',
            },
            body: JSON.stringify(deeplBody),
        });

        if (!upstream.ok) {
            return res.status(upstream.status).send(await upstream.text());
        }

        const data = await upstream.json();

        await Promise.all(toFetch.map(async ({ idx, text }, j) => {
            const translated = data.translations?.[j]?.text || '';
            results[idx] = translated;
            if (translated) {
                try {
                    await kv.set(cacheKey(text), translated, { ex: TTL_SEC });
                } catch { /* cache írás nem kritikus */ }
            }
        }));
    }

    return res.status(200).json({
        translations: results.map(text => ({ text: text ?? '' })),
    });
}
