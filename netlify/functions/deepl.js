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

    const res = await fetch('https://api-free.deepl.com/v2/translate', {
        method:  'POST',
        headers: {
            'Authorization': `DeepL-Auth-Key ${DEEPL_KEY}`,
            'Content-Type':  'application/json',
        },
        body: JSON.stringify(body),
    });

    const data = await res.json();

    return {
        statusCode: res.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(data),
    };
};
