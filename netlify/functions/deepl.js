const { getStore } = require('@netlify/blobs');
const crypto       = require('crypto');

const TTL_MS = 24 * 60 * 60 * 1000; // 24 óra

function cacheKey(text) {
    return 'tr_' + crypto.createHash('md5').update(text).digest('hex');
}

exports.handler = async (event) => {
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    const DEEPL_KEY = process.env.DEEPL_KEY;
    if (!DEEPL_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Hiányzó DeepL API kulcs' }) };
    }

    let body;
    try { body = JSON.parse(event.body); }
    catch { return { statusCode: 400, body: JSON.stringify({ error: 'Érvénytelen JSON' }) }; }

    const texts = Array.isArray(body.text) ? body.text : [body.text];

    let store;
    try { store = getStore('translations'); } catch { store = null; }

    // Cache ellenőrzés
    const results   = new Array(texts.length).fill(null);
    const toFetch   = []; // { idx, text }

    if (store) {
        await Promise.all(texts.map(async (text, i) => {
            try {
                const entry = await store.getWithMetadata(cacheKey(text), { type: 'text' });
                if (entry?.metadata?.expires > Date.now()) {
                    results[i] = entry.data;
                } else {
                    toFetch.push({ idx: i, text });
                }
            } catch {
                toFetch.push({ idx: i, text });
            }
        }));
    } else {
        texts.forEach((text, i) => toFetch.push({ idx: i, text }));
    }

    // DeepL hívás csak a nem cachelt szövegekre
    if (toFetch.length > 0) {
        const deeplBody = {
            text:        toFetch.map(t => t.text),
            source_lang: body.source_lang || 'EN',
            target_lang: body.target_lang || 'HU',
        };

        const res = await fetch('https://api-free.deepl.com/v2/translate', {
            method:  'POST',
            headers: {
                'Authorization': `DeepL-Auth-Key ${DEEPL_KEY}`,
                'Content-Type':  'application/json',
            },
            body: JSON.stringify(deeplBody),
        });

        if (!res.ok) {
            return {
                statusCode: res.status,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
                body: await res.text(),
            };
        }

        const data = await res.json();

        await Promise.all(toFetch.map(async ({ idx, text }, j) => {
            const translated = data.translations?.[j]?.text || '';
            results[idx] = translated;
            if (store && translated) {
                try {
                    await store.set(
                        cacheKey(text),
                        translated,
                        { metadata: { expires: Date.now() + TTL_MS } }
                    );
                } catch { /* cache írás nem kritikus */ }
            }
        }));
    }

    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify({
            translations: results.map(text => ({ text: text ?? '' })),
        }),
    };
};
