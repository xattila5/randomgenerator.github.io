exports.handler = async (event) => {
    const GUARDIAN_KEY = process.env.GUARDIAN_KEY;
    if (!GUARDIAN_KEY) {
        return { statusCode: 500, body: JSON.stringify({ error: 'Hiányzó Guardian API kulcs' }) };
    }

    const { section } = event.queryStringParameters || {};
    if (!section) {
        return { statusCode: 400, body: JSON.stringify({ error: 'Hiányzó section paraméter' }) };
    }

    const params = new URLSearchParams({
        'api-key':     GUARDIAN_KEY,
        section,
        'show-fields': 'body,thumbnail,trailText',
        'order-by':    'newest',
        'page-size':   '10',
    });

    const res = await fetch(`https://content.guardianapis.com/search?${params}`);
    const data = await res.json();

    return {
        statusCode: res.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        body: JSON.stringify(data),
    };
};
