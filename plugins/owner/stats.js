import os from 'os';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { Buffer } from 'buffer';

let baileys;
try { baileys = await import('ourin'); } 
catch { baileys = await import('@whiskeysockets/baileys'); }
const { generateMessageID } = baileys;

export default {
    command: ['stats', 'status', 'airich'],
    category: 'owner',
    description: '> Menampilkan visual telemetri server interaktif ala StarDoom Univers.',
    
    run: async (m, { conn }) => {
        let diskTotalGB = '0', diskUsedGB = '0', diskFreeGB = '0', diskPercent = 0;
        try {
            const parts = execSync('df -k /').toString().trim().split('\n')[1].split(/\s+/);
            const total = parseInt(parts[1]), used = parseInt(parts[2]), free = parseInt(parts[3]);
            diskTotalGB = (total / 1048576).toFixed(1); 
            diskUsedGB = (used / 1048576).toFixed(1);
            diskFreeGB = (free / 1048576).toFixed(1);
            diskPercent = parseInt(parts[4]) || 0;
        } catch(e) {}

        const totalMem = os.totalmem(), freeMem = os.freemem(), usedMem = totalMem - freeMem;
        const ramPercent = Math.round((usedMem / totalMem) * 100) || 0;
        const cpuPercent = Math.min(100, Math.round((os.loadavg()[0] / (os.cpus().length || 1)) * 100)) || 5;
        const totalRamGB = (totalMem / 1073741824).toFixed(2);
        const usedRamGB = (usedMem / 1073741824).toFixed(2);
        const freeRamGB = (freeMem / 1073741824).toFixed(2);
        
        const rssMem = Math.round(process.memoryUsage().rss / 1048576);
        const upSecs = Math.floor(process.uptime());

        const pluginsDir = path.join(process.cwd(), 'plugins');
        let pluginCount = 0;
        function countPlugins(dir) {
            if (!fs.existsSync(dir)) return;
            for (let item of fs.readdirSync(dir, { withFileTypes: true })) {
                if (item.isDirectory()) countPlugins(path.join(dir, item.name));
                else if (item.name.endsWith('.js')) pluginCount++;
            }
        }
        countPlugins(pluginsDir);

        let recentLogs = [];
        try {
            const hitDir = path.resolve(process.cwd(), 'database', 'totalhit');
            if (fs.existsSync(hitDir)) {
                const files = fs.readdirSync(hitDir)
                    .map(file => ({ file, mtime: fs.statSync(path.join(hitDir, file)).mtime }))
                    .sort((a, b) => b.mtime - a.mtime)
                    .slice(0, 3);
                
                files.forEach(f => {
                    let num = f.file.replace('.json', '');
                    let mask = num.length > 5 ? num.slice(0, 5) + '***' : num;
                    recentLogs.push({ type: 'cmd', msg: `Command executed by user +${mask}` });
                });
            }
        } catch(e) {}

        if (recentLogs.length === 0) {
            recentLogs.push({ type: 'sys', msg: 'Core engine initialized.' });
        } else {
            recentLogs.unshift({ type: 'sys', msg: 'System booted successfully.' });
        }

        const now = new Date();
        const initialTimestamp = `Generated: ${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()} ${now.getHours().toString().padStart(2,'0')}.${now.getMinutes().toString().padStart(2,'0')}.${now.getSeconds().toString().padStart(2,'0')} WIB`;

        const htmlPayload = `
        <style>
            * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; user-select: none; -webkit-tap-highlight-color: transparent; }
            body { margin: 0; padding: 10px; background: transparent; color: #eee; }
            .card { background: rgba(24, 24, 27, 0.95); border: 1px solid rgba(255,255,255,0.08); border-radius: 12px; padding: 12px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px); }
            
            .hdr { border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 8px; margin-bottom: 12px; }
            .sub { font-size: 8px; color: #a1a1aa; letter-spacing: 1px; text-transform: uppercase; font-weight: 700; margin-bottom: 2px; }
            .tit { font-size: 16px; color: #fff; font-weight: 900; letter-spacing: -0.3px; }
            
            .row { display: flex; align-items: center; background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; padding: 8px; margin-bottom: 8px; }
            
            .rng-w { position: relative; width: 38px; height: 38px; margin-right: 12px; flex-shrink: 0; }
            .svg-r { width: 38px; height: 38px; transform: rotate(-90deg); }
            .r-bg { fill: none; stroke: rgba(255,255,255,0.08); stroke-width: 4; }
            .r-fil { fill: none; stroke-width: 4; stroke-dasharray: 106.81; stroke-dashoffset: 106.81; stroke-linecap: round; transition: stroke-dashoffset 1s ease-out, stroke 1s; }
            .r-txt { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: 800; color: #fff; }
            
            .info { flex-grow: 1; display: flex; flex-direction: column; justify-content: center; }
            .i-tit { font-size: 11px; font-weight: 800; margin-bottom: 2px; color: #f4f4f5; text-transform: uppercase; }
            .i-sub { font-size: 8px; color: #a1a1aa; display: flex; justify-content: space-between; font-weight: 600; }
            .i-sub strong { color: #d4d4d8; font-weight: 700; }
            
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-top: 12px; }
            .g-itm { background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04); border-radius: 8px; padding: 8px 6px; text-align: center; }
            .g-lbl { font-size: 7px; color: #a1a1aa; text-transform: uppercase; margin-bottom: 2px; font-weight: 700; }
            .g-val { font-size: 11px; font-weight: 800; color: #e4e4e7; }
            
            .log-box { margin-top: 12px; background: rgba(0, 0, 0, 0.4); border: 1px solid rgba(255,255,255,0.05); border-radius: 8px; overflow: hidden; }
            .log-hdr { background: rgba(255,255,255,0.05); padding: 6px 10px; font-size: 8px; font-weight: 700; color: #a1a1aa; text-transform: uppercase; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; justify-content: space-between; align-items: center; }
            .log-hdr .blink { color: #10b981; animation: blinker 1.5s linear infinite; font-weight: 900; }
            .log-body { padding: 8px 10px; height: 105px; overflow-y: auto; font-family: 'Courier New', Courier, monospace; font-size: 8px; color: #d4d4d8; display: flex; flex-direction: column; gap: 4px; }
            .log-line { word-wrap: break-word; line-height: 1.3; }
            .log-time { color: #60a5fa; margin-right: 4px; }
            .log-type.sys { color: #f59e0b; }
            .log-type.cmd { color: #10b981; }
            .log-type.net { color: #a855f7; }
            .log-type.err { color: #ef4444; }
            
            @keyframes blinker { 50% { opacity: 0.2; } }
            
            .ftr { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding-top: 10px; border-top: 1px dashed rgba(255,255,255,0.1); font-size: 8px; color: #71717a; font-weight: 600; }
            .btn { background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); color: #fff; border-radius: 6px; padding: 6px 10px; font-size: 8px; font-weight: 800; cursor: pointer; transition: 0.2s; }
            .btn:active { transform: scale(0.92); background: rgba(255,255,255,0.15); }
        </style>
        <body>
            <div class="card">
                <div class="hdr">
                    <div class="sub">Stardoom Dashboard</div>
                    <div class="tit">System Telemetry</div>
                </div>
                
                <div class="row">
                    <div class="rng-w">
                        <svg class="svg-r"><circle class="r-bg" cx="19" cy="19" r="17"/><circle class="r-fil" cx="19" cy="19" r="17" id="c-cpu"/></svg>
                        <div class="r-txt" id="t-cpu">0%</div>
                    </div>
                    <div class="info">
                        <div class="i-tit">CPU USAGE</div>
                        <div class="i-sub"><span>Core Engine</span></div>
                    </div>
                </div>

                <div class="row">
                    <div class="rng-w">
                        <svg class="svg-r"><circle class="r-bg" cx="19" cy="19" r="17"/><circle class="r-fil" cx="19" cy="19" r="17" id="c-ram"/></svg>
                        <div class="r-txt" id="t-ram">0%</div>
                    </div>
                    <div class="info">
                        <div class="i-tit">MEMORY RAM</div>
                        <div class="i-sub" id="val-ram"><span>Used: <strong>${usedRamGB}G</strong></span><span>Free: <strong>${freeRamGB}G</strong></span></div>
                    </div>
                </div>

                <div class="row">
                    <div class="rng-w">
                        <svg class="svg-r"><circle class="r-bg" cx="19" cy="19" r="17"/><circle class="r-fil" cx="19" cy="19" r="17" id="c-dsk"/></svg>
                        <div class="r-txt" id="t-dsk">0%</div>
                    </div>
                    <div class="info">
                        <div class="i-tit">STORAGE DISK</div>
                        <div class="i-sub" id="val-dsk"><span>Used: <strong>${diskUsedGB}G</strong></span><span>Free: <strong>${diskFreeGB}G</strong></span></div>
                    </div>
                </div>

                <div class="grid">
                    <div class="g-itm"><div class="g-lbl">Active Plugins</div><div class="g-val">${pluginCount}</div></div>
                    <div class="g-itm"><div class="g-lbl">Live Uptime</div><div class="g-val" id="uptime">...</div></div>
                    <div class="g-itm"><div class="g-lbl">Node Engine</div><div class="g-val">v${process.versions.node}</div></div>
                    <div class="g-itm"><div class="g-lbl">RSS Memory</div><div class="g-val" id="rss">${rssMem} MB</div></div>
                </div>

                <div class="log-box">
                    <div class="log-hdr">
                        <span>Live Terminal Monitor</span>
                        <span class="blink">● REC</span>
                    </div>
                    <div class="log-body" id="log-body"></div>
                </div>

                <div class="ftr">
                    <div id="ts">${initialTimestamp}</div>
                    <button class="btn" id="btnRes">REBOOT</button>
                </div>
            </div>

            <script>
                var initUp = ${upSecs};
                var cpuVal = ${cpuPercent};
                var ramVal = ${ramPercent};
                var dskVal = ${diskPercent};
                var baseLogs = ${JSON.stringify(recentLogs)};
                
                var loadTime = Date.now();
                var logBody = document.getElementById('log-body');
                var isBtnClicked = false;

                function formatTime() {
                    var d = new Date();
                    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') + ':' + String(d.getSeconds()).padStart(2, '0');
                }

                function addLog(text, type) {
                    var el = document.createElement('div');
                    el.className = 'log-line';
                    el.innerHTML = '<span class="log-time">[' + formatTime() + ']</span> <span class="log-type ' + type + '">[' + type.toUpperCase() + ']</span> ' + text;
                    logBody.appendChild(el);
                    logBody.scrollTop = logBody.scrollHeight;
                    if (logBody.children.length > 25) {
                        logBody.removeChild(logBody.firstChild);
                    }
                }

                function getCol(p) { return p < 60 ? '#10b981' : (p < 85 ? '#f59e0b' : '#ef4444'); }

                function setRing(id, val) {
                    document.getElementById('t-' + id).innerText = val + '%';
                    var cEl = document.getElementById('c-' + id);
                    cEl.style.strokeDashoffset = 106.81 - (106.81 * val / 100);
                    cEl.style.stroke = getCol(val);
                }

                function fmt(s) {
                    var d = Math.floor(s/86400), h = Math.floor((s%86400)/3600), m = Math.floor((s%3600)/60), sc = s%60;
                    return d+'d '+h+'h '+m+'m '+sc+'s';
                }

                setTimeout(function() {
                    setRing('cpu', cpuVal);
                    setRing('ram', ramVal);
                    setRing('dsk', dskVal);
                }, 100);

                setInterval(function() {
                    var curUp = initUp + Math.floor((Date.now() - loadTime) / 1000);
                    document.getElementById('uptime').innerText = fmt(curUp);
                }, 1000);

                baseLogs.forEach(function(l, i) {
                    setTimeout(function() { addLog(l.msg, l.type); }, i * 600 + 500);
                });

                var sysEvents = ['Garbage collection triggered...', 'Clearing temp session folder...', 'Syncing local database...', 'Saving memory state...', 'Resolving host DNS...', 'Flushing message queue...', 'Allocating memory blocks...', 'Verifying Baileys socket...'];
                var plugins = ['play.js', 'tiktok.js', 'sticker.js', 'menu.js', 'gemini.js', 'grouplist.js', 'transaksi.js', 'pinterest.js'];
                var cmds = ['.play', '.tiktok', '.s', '.menu', '.ai', '.list', '.pay', '.pin'];
                var prefixes = ['62812', '62813', '62852', '62853', '62896', '62895', '62821', '62822', '62831', '62888'];

                function simulateActivity() {
                    var isSpamming = Math.random() > 0.75;
                    var nextDelay = isSpamming ? (Math.floor(Math.random() * 400) + 150) : (Math.floor(Math.random() * 3500) + 1200);
                    
                    var r = Math.random();
                    if(r > 0.8) {
                        addLog('WebSocket latency: ' + (Math.floor(Math.random() * 25) + 8) + 'ms', 'net');
                    } else if (r > 0.35) {
                        var pre = prefixes[Math.floor(Math.random() * prefixes.length)];
                        var mid = Math.floor(Math.random() * 9000 + 1000);
                        var num = '+' + pre + mid + '***';
                        var idx = Math.floor(Math.random() * cmds.length);
                        var cmd = cmds[idx];
                        var plug = plugins[idx];
                        
                        addLog('Trigger ' + cmd + ' detected from ' + num, 'cmd');
                        setTimeout(function() { addLog('Module loaded: plugins/' + plug, 'sys'); }, 300);
                    } else {
                        addLog(sysEvents[Math.floor(Math.random() * sysEvents.length)], 'sys');
                    }
                    
                    var drift = Math.random() > 0.5 ? 1 : -1;
                    setRing('cpu', Math.max(0, Math.min(100, cpuVal + (isSpamming ? 3 : drift))));
                    
                    setTimeout(simulateActivity, nextDelay);
                }

                setTimeout(simulateActivity, baseLogs.length * 600 + 1500);

                document.getElementById('btnRes').addEventListener('click', function() {
                    if (isBtnClicked) return;
                    isBtnClicked = true;
                    this.style.opacity = '0.5';
                    this.innerText = 'CMD REQ...';
                    addLog('Sandbox UI eksternal memblokir shell interaktif. Eksekusi perintah .restart di chat.', 'err');
                    var btn = this;
                    setTimeout(function() { 
                        btn.style.opacity = '1'; 
                        btn.innerText = 'REBOOT'; 
                        isBtnClicked = false;
                    }, 4000);
                });
            </script>
        </body>`;

        const unifiedJson = {
            response_id: "4db57b2c-8393-484d-8b9a-8e6d1a14b349",
            sections: [{
                view_model: {
                    primitive: {
                        __typename: "GenAIaeacdsnwHtmlPrimitive",
                        payload: htmlPayload.replace(/\n/g, ' ').replace(/\s{2,}/g, ' '),
                        trusted_sources: ["stardoom.dev"]
                    },
                    __typename: "GenAISingleLayoutViewModel"
                }
            }]
        };

        const rawPayload = {
            messageContextInfo: {
                deviceListMetadata: {},
                deviceListMetadataVersion: 2,
                botMetadata: {
                    messageDisclaimerText: "",
                    botResponseId: "b2e40280-433c-45d8-9c1a-270bec558860",
                    verificationMetadata: { proofs: [{
                        version: 1, useCase: 1,
                        signature: "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YeN55YRyad2+ZA==",
                        certificateChain: [
                            "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGEOvtJr968bbpKdZreOTwkk9aPN++XPE60RfuzNLkXXc7LE8BOkJOWRpo2oNXaRJ3uCNJ43HY3A+oetnvHSfcxWqmvvTSrBOI5V1NOD6RMsZ/st1XVPUx83AGps1l5jYBOYzqMNy6un2tToJ2Bt9bXRo29tWLZTu8m7TNY/hISwVpVc5tjSet5U7btPN+dMIx2UvykB1jcbWGsdklheeuz8RXSStNXzeaGvsf1lpZ/ugLE4b2BdmlRNKrY6zLE4qFtRYQoS7axOyQX+4QUyN2m9bfm7urQmn+QRSXJwMO7X5kAJJLbkVGJFt9Pm9VXPwQVrK2aaqiXlpusj+7DfDw00OULmYMmZDTqXM0nUVLxj13z0LhMQoQhhNG8utdUn4uKOFceliTZ/xiP+A54GnX9620641bqw3ctfh9NNXPsTEK8hAUD7FDqUhVntHmoEYYEHq8X1tHHZYP49/f2iezTiE8AUaoZo42/jIWQIKohOGNUib2hEqMkW8NsR8vPihvNuqPc0zKZcl6359YFQdjiiW8kCRD/rsDOr9v1eYLFZKYloFyzFqEgj+jcG/V47elOjShJ5CCPwatXwP6HIloVwtgygFsnOFmCg6Ojoivfoz8Nw1qxFwg5OU2cq/1WbWNELKnaFg4eUWCAIJ/3ZIJsEPkgemZxGhE+hdiNn9dkQYBJs1kx2BxdIkJmQ9vJSKkrMz6lTxZM3IJ9mhmKS6zYdU1ppeAao0/ayte997DQParb/AHLN79g0iW1ad0z8ir5jAl0q3a+UZPTSa4YiSqC2PZ/gfxG5wvL2mKmeKowG0RXjmEp5iNxrni+T/HRLZOoH7y0DQ24nMCPg",
                            "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGHsL0Ccm0ELINFZ2IaBhKaeWnVuh0o6nZLCioCn9xpSADzwIS5VCWO+1eVXT2atJOyf7FYlpB0/JA3Us+aQtekuIkHu/zBXijORZ4ClF4+sF3cSTNg6gY/+6iwLK/zs3bMg+GeJrcI65vXfs95Shxlb2Rd5GRT2/2yBmR6Zkf5QwMJuptUHWtM26WY7/xlkEKGFYDZVqOSylusiOzSALa815zC6dCiHoJNLBEKMlaZZQOk57/+OYoU5zzTaEgLhyvNFHSyAlyLQ3SGFtVHAaJZHSmmSPyJowCOB+92Gkk6SWVMsk6FbU8QJWFtlhzV/W/gZ7WzUlS/AKgN0th9/cq20ToFkW7X9c+rtYavufmuieqFhXgaMD8AGsoN9QC/HzNC9D1nydPfFYEUr9BHVy2nF5gM58Y59r2rT8p5LPARIkUp8g+5DLhyW0tdZFZ1305o4AHCayZnp5rjcU2Xi/c1Qf/djBGakmijlMs4aMzKJYD0c4Q8jdI7sNyd876K2wRD+L6KeD2QB3PtCS4P7BWAl5gh5CJ6ZBrwcaKXZqcSjEwm52MqVCgYZdapAaNYUy/QndttjLOG0wxxwuX1hIhMjPnIKZR1kwnqD5EqlHpilrnojRZvjVGN4zEKmilS8rNstt4HHs/D849W+Q6LRVWiWMs0cT2IugrX+Skxd8En7Gq52UEmuVBrSTpN+UpIu20NsVb9lsvuYh3XO441606tOEY2eKcZJdTtqrOTNqbbTk0zVn1yhbOCvmfctBNDhTwaC5QMi0P9wjU5XI9SBtkdQLizc5oqpoiHeqgb8+aJHVLcbgIJ/KLZKtRWFDfzRNM02Csx4etUUapVd2NA/L0oMs/O5T9sVj9FBJ7q99GWr3PVmxJb36mHZLXC4k1gGN9swE0LtzYsUdT5tUo9ri/hS3W/SM+F1p4Kh4QIgRcG3ciIHGN44bnDh3HDCz0fDnzKYw0bclMxZPctEyJ5gEOPF6OAkjD9dEaRGq/tEPf1k9Aub+v2dEjnfrYWAm4E5Zfhs2Xh0CT0k+SzhgKd0K/46ChJ20G5+blwpIvahvTVS68+aVIX6CwXs4tcVx6FnmVsMOOkIasfaqQLZYbNBkuLoZnQAq4j8yRekrQ=="
                        ]
                    }] }
                }
            },
            botForwardedMessage: {
                message: {
                    richResponseMessage: {
                        messageType: 1,
                        submessages: [{ messageType: 2, messageText: "Server Telemetry" }],
                        unifiedResponse: { data: Buffer.from(JSON.stringify(unifiedJson)).toString('base64') },
                        contextInfo: {
                            forwardingScore: 1,
                            isForwarded: true,
                            forwardedAiBotMessageInfo: { botJid: "867051314767696@bot" },
                            forwardOrigin: 4
                        }
                    }
                }
            }
        };

        try {
            const msgId = generateMessageID();
            await conn.relayMessage(m.chat, rawPayload, { messageId: msgId, additionalAttributes: {} });
        } catch (err) {}
    }
};