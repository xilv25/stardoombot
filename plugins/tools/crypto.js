import { Buffer } from 'buffer';

let axios;
try { axios = await import('axios'); } 
catch { axios = require('axios'); }

let baileys;
try { baileys = await import('ourin'); } 
catch { baileys = await import('@whiskeysockets/baileys'); }
const { generateMessageID } = baileys;

export default {
    command: ['crypto', 'market', 'bursa', 'cc'],
    category: 'tools',
    description: '> Render Live Market Crypto UI TradingView Clone (Airich).',
    
    run: async (m, { conn }) => {
        try {
            const symbols = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT', 'DOGEUSDT', 'PEPEUSDT', 'AVAXUSDT', 'LINKUSDT', 'NEARUSDT'];
            
            const tickerRes = await axios.default.get(`https://api.binance.com/api/v3/ticker/24hr?symbols=${JSON.stringify(symbols)}`);
            const tickerData = tickerRes.data;

            const klinesPromises = symbols.map(sym => axios.default.get(`https://api.binance.com/api/v3/klines?symbol=${sym}&interval=1h&limit=24`));
            const klinesResults = await Promise.all(klinesPromises);

            let marketData = {};
            
            tickerData.forEach(coin => {
                const currentPrice = parseFloat(coin.lastPrice);
                const formattedPrice = currentPrice < 1 ? currentPrice.toFixed(5) : currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const change = parseFloat(coin.priceChangePercent);
                const vol = (parseFloat(coin.quoteVolume) / 1000000).toFixed(1) + 'M';
                const highPrice = parseFloat(coin.highPrice) < 1 ? parseFloat(coin.highPrice).toFixed(5) : parseFloat(coin.highPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                const lowPrice = parseFloat(coin.lowPrice) < 1 ? parseFloat(coin.lowPrice).toFixed(5) : parseFloat(coin.lowPrice).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                
                const coinIndex = symbols.indexOf(coin.symbol);
                const history = klinesResults[coinIndex].data.map(k => parseFloat(k[4])); 

                marketData[coin.symbol] = {
                    s: coin.symbol.replace('USDT', ''),
                    p: formattedPrice,
                    c: change.toFixed(2),
                    v: vol,
                    hi: highPrice,
                    lo: lowPrice,
                    hst: history
                };
            });

            const injectedData = JSON.stringify(marketData);

            // ==========================================
            // KODE HTML CSS KELAS ENTERPRISE TRADINGVIEW MURNI
            // Menggunakan warna, font kecil, dan layout presisi PC!
            // ==========================================
            const htmlCode = `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; user-select: none; -webkit-tap-highlight-color: transparent; }
        
        body { margin: 0; background: #000; position: relative; overflow: hidden; width: 100vw; }
        .dummy-aspect { width: 100vw; padding-top: 160%; }
        
        #ui { 
            position: absolute; top: 50%; left: 50%; 
            width: 160vw; height: 100vw;
            transform: translate(-50%, -50%) rotate(90deg);
            background: #131722; display: flex; flex-direction: row; 
            color: #d1d4dc; overflow: hidden; border-radius: 4px;
        }
        
        .tv-main { flex: 7.2; display: flex; flex-direction: column; border-right: 1px solid #2a2e39; position: relative; }
        
        .tv-topbar { height: 26px; border-bottom: 1px solid #2a2e39; display: flex; align-items: center; padding: 0 10px; font-size: 8px; font-weight: 600; }
        .tv-topbar span { margin-right: 14px; cursor: pointer; }
        .tv-topbar .t-active { color: #2962FF; }
        .tv-brand { margin-left: auto; color: #787b86; font-weight: 700; letter-spacing: 0.5px; }
        
        .tv-chart-container { flex: 1; position: relative; }
        .tv-legend { position: absolute; top: 10px; left: 10px; z-index: 2; display: flex; flex-direction: column; gap: 3px; }
        .tv-sym { font-size: 13px; font-weight: 700; color: #d1d4dc; display: flex; align-items: center; gap: 6px; }
        .tv-badge { background: #2a2e39; padding: 1px 4px; border-radius: 2px; font-size: 7px; color: #d1d4dc; }
        
        .tv-price-row { display: flex; gap: 8px; font-size: 10px; font-weight: 600; }
        .tv-val { font-variant-numeric: tabular-nums; }
        .tv-stats-row { display: flex; gap: 8px; font-size: 8px; font-weight: 500; color: #787b86; margin-top: 2px; }
        
        .tv-svg-area { width: 100%; height: 100%; position: absolute; bottom: 0; left: 0; }
        .grid-line { stroke: #2a2e39; stroke-width: 0.5; stroke-dasharray: 2 2; }
        
        .tv-right { flex: 2.8; display: flex; flex-direction: column; background: #131722; }
        .wl-head { display: flex; padding: 8px; font-size: 7px; color: #787b86; border-bottom: 1px solid #2a2e39; font-weight: 600; text-transform: uppercase; }
        .wl-head div { flex: 1; }
        .wl-head div:nth-child(2) { text-align: right; }
        .wl-head div:nth-child(3) { text-align: right; }
        
        .wl-list { flex: 1; overflow-y: auto; }
        .wl-list::-webkit-scrollbar { display: none; }
        .wl-item { display: flex; padding: 8px; font-size: 9px; border-bottom: 1px solid #1e222d; cursor: pointer; align-items: center; }
        .wl-item.active { background: #2a2e39; }
        .wl-item div { flex: 1; }
        .wl-item div:nth-child(2) { text-align: right; font-variant-numeric: tabular-nums; font-weight: 600; }
        .wl-item div:nth-child(3) { text-align: right; font-variant-numeric: tabular-nums; display: flex; justify-content: flex-end; }
        
        .sym-name { font-weight: 700; color: #d1d4dc; }
        .up { color: #089981; } .down { color: #F23645; }
        .bg-up { background: #089981; color: #fff; border-radius: 3px; padding: 2px 4px; font-weight: 600; font-size: 8px; }
        .bg-down { background: #F23645; color: #fff; border-radius: 3px; padding: 2px 4px; font-weight: 600; font-size: 8px; }
    </style>
</head>
<body>
    <div class="dummy-aspect"></div>
    <div id="ui">
        <div class="tv-main">
            <div class="tv-topbar">
                <span id="t-sym" style="font-weight:700;color:#d1d4dc;font-size:10px;">BTCUSDT</span>
                <span>1H</span>
                <span><span class="t-active">~</span> Indicators</span>
                <span>Alert</span>
                <span class="tv-brand">StarDoomView</span>
            </div>
            <div class="tv-chart-container">
                <div class="tv-legend">
                    <div class="tv-sym"><span id="l-sym">BTC / USDT</span> <span class="tv-badge">BINANCE</span></div>
                    <div class="tv-price-row">
                        <span class="tv-val" id="l-prc">0.00</span>
                        <span class="tv-val" id="l-chg">0.00%</span>
                    </div>
                    <div class="tv-stats-row">
                        Vol <span class="tv-val" id="l-vol">0</span>
                        H <span class="tv-val" id="l-hi">0</span>
                        L <span class="tv-val" id="l-lo">0</span>
                    </div>
                </div>
                <div id="m-chart" class="tv-svg-area"></div>
            </div>
        </div>
        <div class="tv-right">
            <div class="wl-head">
                <div>Symbol</div>
                <div>Last</div>
                <div>Chg</div>
            </div>
            <div class="wl-list" id="w-list"></div>
        </div>
    </div>
    
    <script>
        const marketData = ${injectedData};
        const symbols = Object.keys(marketData);
        let current = symbols[0];
        
        function drawSVG(hist, isUp) {
            const min = Math.min(...hist);
            const max = Math.max(...hist);
            const rng = max - min || 1;
            
            const w = 500; const h = 220;
            let path = '';
            
            hist.forEach((v, i) => {
                const x = (i / (hist.length - 1)) * w;
                const y = h - ((v - min) / rng) * h;
                path += (i===0?'M ':'L ') + x.toFixed(2) + ' ' + y.toFixed(2) + ' ';
            });
            
            const color = isUp ? '#089981' : '#F23645';
            
            return '<svg width="100%" height="100%" viewBox="0 0 '+w+' '+h+'" preserveAspectRatio="none">' +
                '<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="'+color+'" stop-opacity="0.2"/><stop offset="100%" stop-color="'+color+'" stop-opacity="0"/></linearGradient></defs>' +
                '<line x1="0" y1="'+(h/4)+'" x2="'+w+'" y2="'+(h/4)+'" class="grid-line" />' +
                '<line x1="0" y1="'+(h/2)+'" x2="'+w+'" y2="'+(h/2)+'" class="grid-line" />' +
                '<line x1="0" y1="'+(h*0.75)+'" x2="'+w+'" y2="'+(h*0.75)+'" class="grid-line" />' +
                '<path d="'+path+' L '+w+' '+h+' L 0 '+h+' Z" fill="url(#g)" />' +
                '<path d="'+path+'" fill="none" stroke="'+color+'" stroke-width="1.5" stroke-linejoin="round" />' +
            '</svg>';
        }
        
        function sel(sym) {
            current = sym;
            const d = marketData[sym];
            const isUp = parseFloat(d.c) >= 0;
            const cClass = isUp ? 'up' : 'down';
            const sign = isUp ? '+' : '';
            
            document.getElementById('t-sym').innerText = sym;
            document.getElementById('l-sym').innerText = d.s + ' / USDT';
            
            document.getElementById('l-prc').innerText = d.p;
            document.getElementById('l-prc').className = 'tv-val ' + cClass;
            
            document.getElementById('l-chg').innerText = sign + d.c + '%';
            document.getElementById('l-chg').className = 'tv-val ' + cClass;
            
            document.getElementById('l-hi').innerText = d.hi;
            document.getElementById('l-lo').innerText = d.lo;
            document.getElementById('l-vol').innerText = d.v;
            
            document.getElementById('m-chart').innerHTML = drawSVG(d.hst, isUp);
            render();
        }
        
        function render() {
            let h = '';
            symbols.forEach(s => {
                const d = marketData[s];
                const isUp = parseFloat(d.c) >= 0;
                const a = s === current ? 'active' : '';
                const cClass = isUp ? 'up' : 'down';
                const bgClass = isUp ? 'bg-up' : 'bg-down';
                const sign = isUp ? '+' : '';
                
                h += '<div class="wl-item '+a+'" onclick="sel(\\''+s+'\\')">' +
                    '<div class="sym-name">'+d.s+'</div>' +
                    '<div class="'+cClass+'">'+d.p+'</div>' +
                    '<div><span class="'+bgClass+'">'+sign+d.c+'%</span></div>' +
                '</div>';
            });
            document.getElementById('w-list').innerHTML = h;
        }
        
        sel(current);
    </script>
</body>
</html>`;

            const minifiedHtml = htmlCode.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim();

            const unifiedJson = {
                response_id: "4db57b2c-8393-484d-8b9a-8e6d1a14b349",
                sections: [{
                    view_model: {
                        primitive: {
                            __typename: "GenAIaeacdsnwHtmlPrimitive",
                            payload: minifiedHtml,
                            trusted_sources: ["stardoom.dev", "tradingview.com"]
                        },
                        __typename: "GenAISingleLayoutViewModel"
                    }
                }]
            };

            const rawPayload = {
                messageContextInfo: { deviceListMetadata: {}, deviceListMetadataVersion: 2, botMetadata: { botResponseId: "b2e40280-433c-45d8-9c1a-270bec558860", verificationMetadata: { proofs: [{ version: 1, useCase: 1, signature: "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YeN55YRyad2+ZA==", certificateChain: ["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"] }] } } },
                botForwardedMessage: { message: { richResponseMessage: { messageType: 1, submessages: [{ messageType: 2, messageText: "TradingView Hub" }], unifiedResponse: { data: Buffer.from(JSON.stringify(unifiedJson)).toString('base64') }, contextInfo: { forwardingScore: 1, isForwarded: true, forwardedAiBotMessageInfo: { botJid: "867051314767696@bot" }, forwardOrigin: 4 } } } }
            };

            const msgId = generateMessageID();
            await conn.relayMessage(m.chat, rawPayload, { messageId: msgId });

        } catch (err) {
            console.error('[CRYPTO ERROR]', err);
            return m.reply("Sistem gagal mengambil data bursa.");
        }
    }
};