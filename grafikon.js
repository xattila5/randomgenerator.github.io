// ── A rész: URL params + header ──────────────────────────────────────────────
const params = new URLSearchParams(location.search);
const symbol = params.get('symbol') || 'BINANCE:BTCUSDT';
const name   = params.get('name')   || '';
const ticker = params.get('ticker') || '';
const price  = params.get('price')  || '';
const change = parseFloat(params.get('change'));

document.title = (name || ticker) + ' – Grafikon – S.A.L. Tools';

const nameEl   = document.getElementById('grafikonName');
const priceEl  = document.getElementById('grafikonPrice');
const changeEl = document.getElementById('grafikonChange');

nameEl.textContent = name || ticker;
priceEl.textContent = price ? '$' + price : '';

if (!isNaN(change)) {
    const up = change >= 0;
    changeEl.textContent = (up ? '+' : '') + change.toFixed(2) + '%';
    changeEl.classList.add(up ? 'up' : 'down');
}

// ── B rész: Konstansok + utils ───────────────────────────────────────────────
const IS_NETLIFY = window.location.hostname !== 'localhost' &&
                   window.location.hostname !== '127.0.0.1' &&
                   !window.location.protocol.startsWith('file');

const TICKER_TO_CGID = {
    BTC: 'bitcoin',
    ETH: 'ethereum',
    BNB: 'binancecoin',
    XRP: 'ripple',
    SOL: 'solana',
};

const TVC_TO_YAHOO = {
    'TVC:GOLD':   'GC=F',
    'TVC:SILVER': 'SI=F',
    'TVC:COPPER': 'HG=F',
};

const CRYPTO_TICKER_TO_YAHOO = {
    BTC: 'BTC-USD',
    ETH: 'ETH-USD',
    BNB: 'BNB-USD',
    XRP: 'XRP-USD',
    SOL: 'SOL-USD',
};

function fmtPrice(p) {
    if (p == null || isNaN(p)) return '--';
    if (p >= 1000) return p.toLocaleString('en-US', { maximumFractionDigits: 0 });
    if (p >= 1)    return p.toFixed(2);
    return p.toFixed(4);
}

// ── C rész: TA számítások ────────────────────────────────────────────────────
function calcMA(data, period) {
    return data.map((_, i) => {
        if (i < period - 1) return null;
        const s = data.slice(i - period + 1, i + 1);
        return { time: data[i].time, value: s.reduce((a, b) => a + b.close, 0) / period };
    }).filter(Boolean);
}

function calcBB(data, period = 20, mult = 2) {
    return data.map((_, i) => {
        if (i < period - 1) return null;
        const s = data.slice(i - period + 1, i + 1).map(d => d.close);
        const mean = s.reduce((a, b) => a + b, 0) / period;
        const std  = Math.sqrt(s.reduce((a, b) => a + (b - mean) ** 2, 0) / period);
        return { time: data[i].time, upper: mean + mult * std, middle: mean, lower: mean - mult * std };
    }).filter(Boolean);
}

function calcRSI(closes, period = 14) {
    if (closes.length < period + 1) return null;
    const ch = closes.slice(-(period + 1));
    let g = 0, l = 0;
    for (let i = 1; i < ch.length; i++) {
        const d = ch[i] - ch[i - 1];
        if (d > 0) g += d; else l -= d;
    }
    const ag = g / period, al = l / period;
    return al === 0 ? 100 : 100 - 100 / (1 + ag / al);
}

function calcSwingLevels(data, lookback = 40) {
    const s = data.slice(-lookback);
    return { support: Math.min(...s.map(d => d.low)), resistance: Math.max(...s.map(d => d.high)) };
}

function calcTrend(closes) {
    if (closes.length < 20) return 'neutral';
    const s = closes.slice(-20);
    const seg = n => s.slice(n * 5, (n + 1) * 5);
    const segs = [seg(0), seg(1), seg(2), seg(3)];
    const highs = segs.map(sg => Math.max(...sg));
    const lows  = segs.map(sg => Math.min(...sg));
    const rH = highs.every((h, i) => i === 0 || h >= highs[i - 1]);
    const rL = lows.every((l, i)  => i === 0 || l >= lows[i - 1]);
    const fH = highs.every((h, i) => i === 0 || h <= highs[i - 1]);
    const fL = lows.every((l, i)  => i === 0 || l <= lows[i - 1]);
    if (rH && rL) return 'up';
    if (fH && fL) return 'down';
    return 'neutral';
}

function calcVolatility(closes, period = 20) {
    const s = closes.slice(-period);
    const returns = s.slice(1).map((c, i) => (c - s[i]) / s[i]);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    return Math.sqrt(returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length);
}

// ── D rész: Forgatókönyv kalkuláció ─────────────────────────────────────────
function ease(t) { return t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2; }

function calcScenarios(data, bb, swings) {
    const DAY   = 86400;
    const DAYS  = 20;
    const closes = data.map(d => d.close);
    const last   = data[data.length - 1];
    const cp     = last.close;
    const lastBB = bb[bb.length - 1];
    const vol    = calcVolatility(closes);   // napi volatilitás (pl. BTC ~0.03)
    const trend  = calcTrend(closes);
    const rsiVal = calcRSI(closes);

    // Lineáris regresszió: mi az organikus irány és céláp 20 nap alatt?
    const n = Math.min(closes.length, 30);
    const s = closes.slice(-n);
    const xm = (n - 1) / 2, ym = s.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    s.forEach((y, x) => { num += (x - xm) * (y - ym); den += (x - xm) ** 2; });
    const slope = den === 0 ? 0 : num / den;
    const lrTarget = cp + slope * DAYS;

    // Max elmozdulás: 1 szigma * sqrt(DAYS), de legfeljebb 10%
    const maxPct = Math.min(vol * Math.sqrt(DAYS), 0.10);

    // Bull cél: LR target ha pozitív, egyébként +maxPct; maxban capped
    const rawBull = slope > 0 ? lrTarget : cp * (1 + maxPct * 0.5);
    const bullTarget = Math.min(rawBull, cp * (1 + maxPct));

    // Bear cél: LR target ha negatív, egyébként -maxPct; minimumban capped
    const rawBear = slope < 0 ? lrTarget : cp * (1 - maxPct * 0.5);
    const bearTarget = Math.max(rawBear, cp * (1 - maxPct));

    // RSI: enyhe korrekció (túlvett → bull gyengítés, túladott → bull erősítés)
    const rsiFactor = rsiVal != null
        ? rsiVal > 70 ? 0.85 : rsiVal < 30 ? 1.15 : 1.0
        : 1.0;

    const finalBull = cp + (bullTarget - cp) * rsiFactor;
    const finalBear = cp + (bearTarget - cp) * (2 - rsiFactor);

    const s1IsBull = trend === 'up' || (trend === 'neutral' && rsiVal != null && rsiVal < 50);

    const genPath = (target) => {
        const pts = [{ time: last.time, value: cp }];
        for (let i = 1; i <= DAYS; i++) {
            pts.push({ time: last.time + i * DAY, value: cp + (target - cp) * ease(i / DAYS) });
        }
        return pts;
    };

    // Sáv: 0.4 szorzó (tömörebb, realisztikusabb)
    const genBand = (path, dir) =>
        path.map((p, i) => ({ time: p.time, value: p.value + dir * cp * vol * Math.sqrt(i + 1) * 0.4 }));

    const mkScenario = (target, label, colorHex, centerRgba, bandRgba) => {
        const center = genPath(target);
        return {
            label, colorHex, target, centerRgba, bandRgba,
            pct: ((target - cp) / cp * 100).toFixed(1),
            center,
            upper: genBand(center, 1),
            lower: genBand(center, -1),
        };
    };

    const bull = mkScenario(finalBull, 'Forgatókönyv 1 – Emelkedő', '#4ade80', 'rgba(74,222,128,0.9)', 'rgba(74,222,128,0.2)');
    const bear = mkScenario(finalBear, 'Forgatókönyv 2 – Csökkenő', '#f87171', 'rgba(248,113,113,0.9)', 'rgba(248,113,113,0.2)');

    return s1IsBull ? { primary: bull, secondary: bear } : { primary: bear, secondary: bull };
}

// ── E rész: OHLCV adatlekérés ────────────────────────────────────────────────
async function fetchOHLCV() {
    let yahooSym = null;
    if (symbol.startsWith('BINANCE:'))      yahooSym = CRYPTO_TICKER_TO_YAHOO[ticker.toUpperCase()];
    else if (symbol.startsWith('TVC:'))     yahooSym = TVC_TO_YAHOO[symbol];
    else if (symbol.includes(':'))          yahooSym = symbol.split(':')[1];
    else                                    yahooSym = symbol;

    if (yahooSym) {
        try {
            const r = await fetch(`/api/finance?history=${encodeURIComponent(yahooSym)}`);
            if (r.ok) {
                const data = await r.json();
                const res = data?.chart?.result?.[0];
                if (res) {
                    const ts = res.timestamp;
                    const q  = res.indicators.quote[0];
                    const ohlcv = ts.map((t, i) => ({
                        time:   t,
                        open:   q.open[i],
                        high:   q.high[i],
                        low:    q.low[i],
                        close:  q.close[i],
                        volume: q.volume[i],
                    })).filter(d => d.open != null && d.close != null);
                    if (ohlcv.length > 30) return ohlcv;
                }
            }
        } catch {}
    }

    // CoinGecko fallback (csak crypto)
    const cgId = TICKER_TO_CGID[ticker.toUpperCase()];
    if (cgId) {
        try {
            const r = await fetch(`https://api.coingecko.com/api/v3/coins/${cgId}/ohlc?vs_currency=usd&days=180`);
            if (r.ok) {
                const data = await r.json();
                const ohlcv = data.map(d => ({
                    time:  Math.floor(d[0] / 1000),
                    open:  d[1], high: d[2], low: d[3], close: d[4],
                })).filter((d, i, arr) =>
                    i === 0 || d.time !== arr[i - 1].time
                );
                if (ohlcv.length > 30) return ohlcv;
            }
        } catch {}
    }

    return null;
}

// ── F rész: TradingView Advanced Chart fallback ──────────────────────────────
function loadTVAdvancedChart(container) {
    container.style.height = '520px';
    container.style.borderRadius = '16px';
    container.style.overflow = 'hidden';
    const wrap = document.createElement('div');
    wrap.className = 'tradingview-widget-container';
    wrap.style.height = '100%';
    const inner = document.createElement('div');
    inner.className = 'tradingview-widget-container__widget';
    inner.style.height = '100%';
    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.async = true;
    script.text = JSON.stringify({
        autosize: true,
        symbol: symbol,
        interval: 'D',
        timezone: 'Etc/UTC',
        theme: 'dark',
        style: '1',
        locale: 'hu',
        allow_symbol_change: false,
        calendar: false,
        support_host: 'https://www.tradingview.com',
    });
    wrap.appendChild(inner);
    wrap.appendChild(script);
    container.innerHTML = '';
    container.appendChild(wrap);
}

// ── G rész: Grafikon rajzolás ────────────────────────────────────────────────
async function initChart() {
    const container = document.getElementById('lwChart');
    if (!container || typeof LightweightCharts === 'undefined') return;

    const ohlcv = await fetchOHLCV();
    if (!ohlcv || ohlcv.length < 30) {
        loadTVAdvancedChart(container);
        return;
    }

    const { createChart, CrosshairMode, LineStyle } = LightweightCharts;
    const chart = createChart(container, {
        layout:          { background: { color: '#0e0e10' }, textColor: 'rgba(200,200,200,0.7)' },
        grid:            { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.04)' } },
        crosshair:       { mode: CrosshairMode.Normal },
        rightPriceScale: { borderColor: 'rgba(255,255,255,0.08)' },
        timeScale:       { borderColor: 'rgba(255,255,255,0.08)', timeVisible: true, secondsVisible: false },
        width:  container.offsetWidth,
        height: 520,
    });

    window.addEventListener('resize', () => chart.applyOptions({ width: container.offsetWidth }));

    const closes = ohlcv.map(d => d.close);

    // ── Gyertyák ────────────────────────────────────────────────────────────
    const candleSeries = chart.addCandlestickSeries({
        upColor: '#4ade80', downColor: '#f87171',
        borderUpColor: '#4ade80', borderDownColor: '#f87171',
        wickUpColor: '#4ade80', wickDownColor: '#f87171',
    });
    candleSeries.setData(ohlcv.map(d => ({ time: d.time, open: d.open, high: d.high, low: d.low, close: d.close })));

    // ── MA vonalak ───────────────────────────────────────────────────────────
    const addLine = (color, width, style, title) => chart.addLineSeries({
        color, lineWidth: width, lineStyle: style,
        priceLineVisible: false, lastValueVisible: true, title,
    });

    const ma20s = addLine('rgba(74,222,128,0.7)', 1, LineStyle.Solid, 'MA20');
    const ma50s = addLine('rgba(250,204,21,0.6)',  1, LineStyle.Solid, 'MA50');
    ma20s.setData(calcMA(ohlcv, 20));
    ma50s.setData(calcMA(ohlcv, 50));

    // ── Bollinger Bands ──────────────────────────────────────────────────────
    const bb = calcBB(ohlcv);
    const bbU = addLine('rgba(99,179,237,0.4)', 1, LineStyle.Dashed, 'BB+');
    const bbL = addLine('rgba(99,179,237,0.4)', 1, LineStyle.Dashed, 'BB-');
    bbU.setData(bb.map(d => ({ time: d.time, value: d.upper })));
    bbL.setData(bb.map(d => ({ time: d.time, value: d.lower })));

    // ── Támaszt / Ellenállás szintek ─────────────────────────────────────────
    const swings = calcSwingLevels(ohlcv);
    candleSeries.createPriceLine({ price: swings.support,    color: 'rgba(250,204,21,0.5)', lineWidth: 1, lineStyle: LineStyle.Dotted, title: 'Támaszt' });
    candleSeries.createPriceLine({ price: swings.resistance, color: 'rgba(250,204,21,0.5)', lineWidth: 1, lineStyle: LineStyle.Dotted, title: 'Ellenállás' });

    // ── Forgatókönyvek ───────────────────────────────────────────────────────
    const sc = calcScenarios(ohlcv, bb, swings);

    const addScenario = (scenario) => {
        const c = addLine(scenario.centerRgba, 2, LineStyle.Dashed, '');
        const u = addLine(scenario.bandRgba,   1, LineStyle.Dotted, '');
        const l = addLine(scenario.bandRgba,   1, LineStyle.Dotted, '');
        c.setData(scenario.center);
        u.setData(scenario.upper);
        l.setData(scenario.lower);
    };

    addScenario(sc.primary);
    addScenario(sc.secondary);

    // ── Forgatókönyv legenda ─────────────────────────────────────────────────
    const legend = document.getElementById('scenarioLegend');
    if (legend) {
        const pct1 = parseFloat(sc.primary.pct);
        const pct2 = parseFloat(sc.secondary.pct);
        legend.innerHTML = `
            <div class="sc-item" style="border-color:${sc.primary.colorHex}">
                <span class="sc-dot" style="background:${sc.primary.colorHex}"></span>
                <span class="sc-label">${sc.primary.label}</span>
                <span class="sc-target" style="color:${sc.primary.colorHex}">
                    $${fmtPrice(sc.primary.target)}&nbsp;
                    (${pct1 >= 0 ? '+' : ''}${pct1}%)
                </span>
                <span class="sc-days">20 nap</span>
            </div>
            <div class="sc-item" style="border-color:${sc.secondary.colorHex}">
                <span class="sc-dot" style="background:${sc.secondary.colorHex}"></span>
                <span class="sc-label">${sc.secondary.label}</span>
                <span class="sc-target" style="color:${sc.secondary.colorHex}">
                    $${fmtPrice(sc.secondary.target)}&nbsp;
                    (${pct2 >= 0 ? '+' : ''}${pct2}%)
                </span>
                <span class="sc-days">20 nap</span>
            </div>
        `;
    }

    // TA panel
    renderTA(closes);
}

// ── H rész: TradingView TA widget ────────────────────────────────────────────
function loadWidget(containerId, src, config) {
    const container = document.getElementById(containerId);
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.text = JSON.stringify(config);
    container.appendChild(script);
}

loadWidget('tvTA',
    'https://s3.tradingview.com/external-embedding/embed-widget-technical-analysis.js',
    {
        interval: '1D',
        width: '100%',
        isTransparent: false,
        height: 450,
        symbol,
        showIntervalTabs: true,
        displayMode: 'single',
        locale: 'hu',
        colorTheme: 'dark',
    }
);

// ── H rész: TA panel (saját elemzés) ────────────────────────────────────────

function sma(prices, n) {
    if (prices.length < n) return null;
    const s = prices.slice(-n);
    return s.reduce((a, b) => a + b, 0) / n;
}

function rsi(prices, n = 14) {
    if (prices.length < n + 1) return null;
    const ch = prices.slice(-(n + 1));
    let gains = 0, losses = 0;
    for (let i = 1; i < ch.length; i++) {
        const d = ch[i] - ch[i - 1];
        if (d > 0) gains += d; else losses -= d;
    }
    const ag = gains / n, al = losses / n;
    if (al === 0) return 100;
    return 100 - 100 / (1 + ag / al);
}

function linearRegressionForecast(prices, lookback = 30, forecastDays = 14) {
    const s = prices.slice(-lookback);
    const n = s.length;
    const xm = (n - 1) / 2;
    const ym = s.reduce((a, b) => a + b, 0) / n;
    let num = 0, den = 0;
    s.forEach((y, x) => { num += (x - xm) * (y - ym); den += (x - xm) ** 2; });
    const slope = den === 0 ? 0 : num / den;
    const intercept = ym - slope * xm;
    return { slope, target: intercept + slope * (n - 1 + forecastDays) };
}

function swingLevels(prices, lookback = 30) {
    const s = prices.slice(-lookback);
    return { support: Math.min(...s), resistance: Math.max(...s) };
}

function detectTrend(prices) {
    const s = prices.slice(-20);
    const segs = [
        [...s.slice(0, 5)],
        [...s.slice(5, 10)],
        [...s.slice(10, 15)],
        [...s.slice(15, 20)],
    ];
    const highs = segs.map(seg => Math.max(...seg));
    const lows  = segs.map(seg => Math.min(...seg));
    const risingH  = highs.every((h, i) => i === 0 || h >= highs[i - 1]);
    const risingL  = lows.every((l, i)  => i === 0 || l >= lows[i - 1]);
    const fallingH = highs.every((h, i) => i === 0 || h <= highs[i - 1]);
    const fallingL = lows.every((l, i)  => i === 0 || l <= lows[i - 1]);
    if (risingH && risingL)   return 'up';
    if (fallingH && fallingL) return 'down';
    return 'neutral';
}

async function fetchPrices() {
    const tvSymbol = symbol;

    if (tvSymbol.startsWith('BINANCE:')) {
        const cgId = TICKER_TO_CGID[ticker.toUpperCase()];
        if (!cgId) return null;
        const url = `https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=90&interval=daily`;
        const r = await fetch(url);
        if (!r.ok) return null;
        const data = await r.json();
        return data.prices.map(p => p[1]);
    }

    if (tvSymbol.startsWith('TVC:')) {
        if (!IS_NETLIFY) return null;
        const yahooSym = TVC_TO_YAHOO[tvSymbol];
        if (!yahooSym) return null;
        const r = await fetch(`/api/finance?history=${encodeURIComponent(yahooSym)}`);
        if (!r.ok) return null;
        const data = await r.json();
        const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
        if (!closes) return null;
        return closes.filter(x => x != null);
    }

    if (!IS_NETLIFY) return null;
    const parts = tvSymbol.split(':');
    const yahooSym = parts.length > 1 ? parts[1] : tvSymbol;
    const r = await fetch(`/api/finance?history=${encodeURIComponent(yahooSym)}`);
    if (!r.ok) return null;
    const data = await r.json();
    const closes = data?.chart?.result?.[0]?.indicators?.quote?.[0]?.close;
    if (!closes) return null;
    return closes.filter(x => x != null);
}

function renderTA(prices) {
    const container = document.getElementById('taAnalysis');
    if (!container) return;

    if (!prices || prices.length < 22) {
        container.innerHTML = '';
        return;
    }

    const currentPrice = prices[prices.length - 1];
    const rsiVal   = rsi(prices);
    const ma20     = sma(prices, 20);
    const { support, resistance } = swingLevels(prices);
    const trend    = detectTrend(prices);
    const forecast = linearRegressionForecast(prices);

    let trendLabel, trendClass;
    if (trend === 'up')        { trendLabel = '↑ EMELKEDŐ'; trendClass = 'trend-up'; }
    else if (trend === 'down') { trendLabel = '↓ CSÖKKENŐ'; trendClass = 'trend-down'; }
    else                       { trendLabel = '→ SEMLEGES'; trendClass = 'trend-neutral'; }

    let rsiLabel = '--', rsiClass = '';
    if (rsiVal != null) {
        const rsiRounded = rsiVal.toFixed(1);
        if (rsiVal > 70)      { rsiLabel = `${rsiRounded} – TÚLVETT`;   rsiClass = 'trend-down'; }
        else if (rsiVal < 30) { rsiLabel = `${rsiRounded} – TÚLADOTT`;  rsiClass = 'trend-up'; }
        else                  { rsiLabel = `${rsiRounded} – SEMLEGES`;  rsiClass = ''; }
    }

    let ma20Label = '--', ma20Class = '';
    if (ma20 != null) {
        const aboveBelow = currentPrice >= ma20 ? '– Ár felette' : '– Ár alatta';
        ma20Class = currentPrice >= ma20 ? 'trend-up' : 'trend-down';
        ma20Label = `$${fmtPrice(ma20)} ${aboveBelow}`;
    }

    const forecastPct = ((forecast.target - currentPrice) / currentPrice * 100);
    const forecastSign = forecastPct >= 0 ? '↑ +' : '↓ ';
    const forecastLabel = `~$${fmtPrice(forecast.target)} (${forecastSign}${Math.abs(forecastPct).toFixed(1)}%)`;
    const forecastClass = forecastPct >= 0 ? 'trend-up' : 'trend-down';

    let signalClass, signalText, signalDesc;
    const isBuy  = trend === 'up'   && (rsiVal == null || rsiVal < 65)  && (ma20 == null || currentPrice > ma20) && forecast.slope > 0;
    const isSell = trend === 'down' && (rsiVal == null || rsiVal > 60)  && (ma20 == null || currentPrice < ma20) && forecast.slope < 0;

    if (isBuy) {
        signalClass = 'buy';
        signalText  = 'VÉTEL';
        if (rsiVal != null && rsiVal >= 50) signalDesc = 'Emelkedő struktúra, RSI semleges zónában';
        else signalDesc = 'Emelkedő struktúra, pozitív momentum';
    } else if (isSell) {
        signalClass = 'sell';
        signalText  = 'ELADÁS';
        if (rsiVal != null && rsiVal >= 70) signalDesc = 'Csökkenő struktúra, RSI túlvett tartományban';
        else signalDesc = 'Csökkenő struktúra, negatív momentum';
    } else {
        signalClass = 'neutral';
        signalText  = 'SEMLEGES';
        if (trend === 'up')        signalDesc = 'Emelkedő trend, de más jelek ellentmondásosak';
        else if (trend === 'down') signalDesc = 'Csökkenő trend, de más jelek ellentmondásosak';
        else                       signalDesc = 'Vegyes jelek, nincs egyértelmű irány';
    }

    container.innerHTML = `
        <div class="invest-section-title">SAJÁT ELEMZÉS</div>
        <div class="ta-stat-grid">
            <div class="ta-stat">
                <div class="ta-stat-label">TREND</div>
                <div class="ta-stat-value ${trendClass}">${trendLabel}</div>
            </div>
            <div class="ta-stat">
                <div class="ta-stat-label">RSI(14)</div>
                <div class="ta-stat-value ${rsiClass}">${rsiLabel}</div>
            </div>
            <div class="ta-stat">
                <div class="ta-stat-label">MA20</div>
                <div class="ta-stat-value ${ma20Class}">${ma20Label}</div>
            </div>
            <div class="ta-stat">
                <div class="ta-stat-label">TÁMASZ</div>
                <div class="ta-stat-value">$${fmtPrice(support)}</div>
            </div>
            <div class="ta-stat">
                <div class="ta-stat-label">ELLENÁLLÁS</div>
                <div class="ta-stat-value">$${fmtPrice(resistance)}</div>
            </div>
            <div class="ta-stat">
                <div class="ta-stat-label">14 NAPOS VETÍTÉS</div>
                <div class="ta-stat-value ${forecastClass}">${forecastLabel}</div>
            </div>
        </div>
        <div class="ta-signal-row">
            <span class="ta-signal-badge ${signalClass}">${signalText}</span>
            <span class="ta-signal-desc">${signalDesc}</span>
        </div>
    `;
}

async function initTA() {
    try {
        const prices = await fetchPrices();
        renderTA(prices);
    } catch {
        const container = document.getElementById('taAnalysis');
        if (container) container.innerHTML = '';
    }
}

initTA();

// ── Befejezés ────────────────────────────────────────────────────────────────
initChart();
