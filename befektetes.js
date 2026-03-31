const IS_NETLIFY = window.location.hostname !== 'localhost' &&
                   window.location.hostname !== '127.0.0.1' &&
                   !window.location.protocol.startsWith('file');

const CRYPTO_IDS = 'bitcoin,ethereum,binancecoin,ripple,solana';
const COMMODITY_SYMBOLS = 'GC=F,SI=F,HG=F';
const FEATURED_STOCK_SYMBOLS = 'NEM,RGLD,NVDA,FCX';

const FEATURED_STOCK_META = {
    'NEM':  { name: 'Newmont',          ticker: 'NEM',  icon: '⛏️', tvSymbol: 'NYSE:NEM'    },
    'RGLD': { name: 'Royal Gold',       ticker: 'RGLD', icon: '👑', tvSymbol: 'NASDAQ:RGLD' },
    'NVDA': { name: 'Nvidia',           ticker: 'NVDA', icon: '🟢', tvSymbol: 'NASDAQ:NVDA' },
    'FCX':  { name: 'Freeport-McMoRan', ticker: 'FCX',  icon: '🏭', tvSymbol: 'NYSE:FCX'    },
};

const CRYPTO_META = {
    bitcoin:      { name: 'Bitcoin',  ticker: 'BTC', icon: '₿',  tvSymbol: 'BINANCE:BTCUSDT' },
    ethereum:     { name: 'Ethereum', ticker: 'ETH', icon: 'Ξ',  tvSymbol: 'BINANCE:ETHUSDT' },
    binancecoin:  { name: 'BNB',      ticker: 'BNB', icon: '◆',  tvSymbol: 'BINANCE:BNBUSDT' },
    ripple:       { name: 'XRP',      ticker: 'XRP', icon: '✕',  tvSymbol: 'BINANCE:XRPUSDT' },
    solana:       { name: 'Solana',   ticker: 'SOL', icon: '◎',  tvSymbol: 'BINANCE:SOLUSDT' },
};

const COMMODITY_META = {
    'GC=F': { name: 'Arany',  ticker: 'GOLD', icon: '🥇', tvSymbol: 'TVC:GOLD',   unit: 'USD/troy oz' },
    'SI=F': { name: 'Ezüst',  ticker: 'SLVR', icon: '🥈', tvSymbol: 'TVC:SILVER', unit: 'USD/troy oz' },
    'HG=F': { name: 'Réz',    ticker: 'COPP', icon: '🪙', tvSymbol: 'TVC:COPPER', unit: 'USD/lb' },
};

const TV_EXCHANGE_MAP = {
    NMS: 'NASDAQ', NGM: 'NASDAQ', NCM: 'NASDAQ',
    NYQ: 'NYSE',   ASE: 'AMEX',
    BTS: 'AMEX',   PCX: 'NYSE',
};

function fmtPrice(p) {
    if (p == null || isNaN(p)) return '--';
    if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (p >= 1)    return p.toFixed(2);
    return p.toFixed(4);
}

function buildCard(icon, name, ticker, price, change, tvSymbol, unit) {
    const up = change >= 0;
    const changeStr = change != null ? (up ? '+' : '') + change.toFixed(2) + '%' : '--';
    const card = document.createElement('div');
    card.className = 'asset-card';
    card.innerHTML = `
        <span class="asset-icon">${icon}</span>
        <div class="asset-name">${name}</div>
        <div class="asset-ticker">${ticker}</div>
        <div class="asset-price">$${fmtPrice(price)}</div>
        ${unit ? `<div class="asset-unit">${unit}</div>` : ''}
        <span class="asset-change ${up ? 'up' : 'down'}">${changeStr}</span>
    `;
    card.addEventListener('click', () => {
        const params = new URLSearchParams({
            symbol: tvSymbol,
            name,
            ticker,
            price: price ?? '',
            change: change ?? '',
        });
        location.href = 'grafikon.html?' + params.toString();
    });
    return card;
}

async function loadCrypto() {
    const grid = document.getElementById('cryptoGrid');
    try {
        const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${CRYPTO_IDS}&vs_currencies=usd&include_24hr_change=true`);
        const data = await r.json();
        grid.innerHTML = '';
        for (const [id, meta] of Object.entries(CRYPTO_META)) {
            const d = data[id];
            const price = d?.usd ?? null;
            const change = d?.usd_24h_change ?? null;
            grid.appendChild(buildCard(meta.icon, meta.name, meta.ticker, price, change, meta.tvSymbol, null));
        }
    } catch {
        grid.innerHTML = '<div class="news-loading" style="color:var(--muted)">Nem sikerült betölteni</div>';
    }
}

async function loadCommodities() {
    const grid = document.getElementById('commodityGrid');
    if (!IS_NETLIFY) {
        grid.innerHTML = '';
        for (const [sym, meta] of Object.entries(COMMODITY_META)) {
            grid.appendChild(buildCard(meta.icon, meta.name, meta.ticker, null, null, meta.tvSymbol, meta.unit));
        }
        return;
    }
    try {
        const r = await fetch(`/api/finance?symbols=${COMMODITY_SYMBOLS}`);
        const data = await r.json();
        const quotes = data?.quoteResponse?.result ?? [];
        grid.innerHTML = '';
        for (const [sym, meta] of Object.entries(COMMODITY_META)) {
            const q = quotes.find(x => x.symbol === sym);
            const price = q?.regularMarketPrice ?? null;
            const change = q?.regularMarketChangePercent ?? null;
            grid.appendChild(buildCard(meta.icon, meta.name, meta.ticker, price, change, meta.tvSymbol, meta.unit));
        }
    } catch {
        grid.innerHTML = '';
        for (const [sym, meta] of Object.entries(COMMODITY_META)) {
            grid.appendChild(buildCard(meta.icon, meta.name, meta.ticker, null, null, meta.tvSymbol, meta.unit));
        }
    }
}

async function searchStocks() {
    const input = document.getElementById('stockSearchInput');
    const q = input.value.trim();
    if (!q) return;
    const grid = document.getElementById('stockGrid');
    grid.innerHTML = '<div class="news-loading"><div class="weather-spinner"></div></div>';

    if (!IS_NETLIFY) {
        grid.innerHTML = '<div class="news-loading" style="color:var(--muted)">Részvény keresés csak Vercel-en érhető el</div>';
        return;
    }

    try {
        const r = await fetch(`/api/finance?search=${encodeURIComponent(q)}`);
        const data = await r.json();
        const quotes = (data?.quotes ?? []).filter(x => x.quoteType === 'EQUITY' || x.quoteType === 'ETF');
        grid.innerHTML = '';
        if (!quotes.length) {
            grid.innerHTML = '<div class="news-loading" style="color:var(--muted)">Nincs találat</div>';
            return;
        }
        for (const q of quotes.slice(0, 8)) {
            const exchDisp = q.exchDisp || q.exchange || '';
            const tvExch = TV_EXCHANGE_MAP[q.exchange] || exchDisp || 'NASDAQ';
            const tvSymbol = `${tvExch}:${q.symbol}`;
            const name = q.shortname || q.longname || q.symbol;
            grid.appendChild(buildCard('📊', name, q.symbol, q.regularMarketPrice ?? null, q.regularMarketChangePercent ?? null, tvSymbol, null));
        }
    } catch {
        grid.innerHTML = '<div class="news-loading" style="color:var(--muted)">Keresési hiba</div>';
    }
}

document.getElementById('stockSearchInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') searchStocks();
});

async function loadFeaturedStocks() {
    const grid = document.getElementById('featuredStockGrid');
    if (!grid) return;
    if (!IS_NETLIFY) {
        grid.innerHTML = '';
        for (const [, meta] of Object.entries(FEATURED_STOCK_META)) {
            grid.appendChild(buildCard(meta.icon, meta.name, meta.ticker, null, null, meta.tvSymbol, null));
        }
        return;
    }
    try {
        const r = await fetch(`/api/finance?symbols=${FEATURED_STOCK_SYMBOLS}`);
        const data = await r.json();
        const quotes = data?.quoteResponse?.result ?? [];
        grid.innerHTML = '';
        for (const [sym, meta] of Object.entries(FEATURED_STOCK_META)) {
            const q = quotes.find(x => x.symbol === sym);
            grid.appendChild(buildCard(meta.icon, meta.name, meta.ticker,
                q?.regularMarketPrice ?? null,
                q?.regularMarketChangePercent ?? null,
                meta.tvSymbol, null));
        }
    } catch {
        grid.innerHTML = '';
        for (const [, meta] of Object.entries(FEATURED_STOCK_META)) {
            grid.appendChild(buildCard(meta.icon, meta.name, meta.ticker, null, null, meta.tvSymbol, null));
        }
    }
}

function refresh() {
    loadCrypto();
    loadCommodities();
    loadFeaturedStocks();
}

refresh();
setInterval(refresh, 60000);
