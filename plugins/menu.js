import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { Buffer } from 'buffer';
import { generateMessageID } from 'ourin';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getPluginFiles(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    try {
        const list = fs.readdirSync(dir, { withFileTypes: true });
        for (let file of list) {
            const filePath = path.join(dir, file.name);
            if (file.isDirectory()) results = results.concat(getPluginFiles(filePath));
            else if (file.name.endsWith('.js')) results.push(filePath);
        }
    } catch (e) {}
    return results;
}

export default {
    command: ['menu', 'help', 'list', 'allmenu'],
    category: 'main',
    description: '> Menampilkan pusat perintah (Command Center) interaktif.',
    
    run: async (m, { conn }) => {
        let categoriesObj = {};
        const pluginsDir = path.resolve(process.cwd(), 'plugins');
        let pluginFiles = getPluginFiles(pluginsDir);
        
        for (let file of pluginFiles) {
            try {
                const pluginUrl = pathToFileURL(file).href;
                const plugin = await import(pluginUrl);
                let p = plugin.default || plugin;
                
                if (!p || !p.command) continue;

                let cmds = [];
                if (Array.isArray(p.command)) cmds = p.command;
                else if (typeof p.command === 'string') cmds = [p.command];
                else continue; 

                let baseName = path.basename(file, '.js').toLowerCase();
                if (cmds.includes(baseName)) {
                    cmds = [baseName];
                }

                let relativePath = path.relative(pluginsDir, file);
                let folderName = path.dirname(relativePath);
                let cat = (folderName === '.' ? (p.category ? p.category : 'OTHERS') : folderName).toUpperCase();

                if (!categoriesObj[cat]) categoriesObj[cat] = [];
                categoriesObj[cat].push(...cmds);
            } catch (e) {
                continue;
            }
        }

        let menuHtml = '';
        const sortedCats = Object.keys(categoriesObj).sort();
        
        for (const cat of sortedCats) {
            const uniqueCmds = [...new Set(categoriesObj[cat])].sort();
            if (uniqueCmds.length === 0) continue;
            
            menuHtml += `
            <div style="margin-bottom: 14px;">
                <div style="font-size: 10px; font-weight: 800; color: #a29bfe; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 4px;">${cat}</div>
                <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            `;
            uniqueCmds.forEach(cmd => {
                menuHtml += `<div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 5px 10px; font-size: 11px; font-weight: 700; color: #d4d4d8;">${cmd}</div>`;
            });
            menuHtml += `</div></div>`;
        }

        const htmlPayload = `
        <style>
            * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; user-select: none; -webkit-tap-highlight-color: transparent; }
            body { margin: 0; padding: 10px; background: transparent; color: #eee; }
            
            /* Kartu utama dengan tinggi pas dan flex layout agar tidak terpotong */
            /* Ditambahkan position: relative agar tombol scroll tetap berada di dalam area kartu */
            .card { position: relative; background: rgba(24, 24, 27, 0.95); border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; padding: 16px; box-shadow: 0 8px 24px rgba(0,0,0,0.6); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); display: flex; flex-direction: column; height: 380px; }
            
            .hdr { border-bottom: 1px dashed rgba(255,255,255,0.15); padding-bottom: 12px; margin-bottom: 10px; flex-shrink: 0; }
            .sub { font-size: 9px; color: #a29bfe; letter-spacing: 1.5px; text-transform: uppercase; font-weight: 800; margin-bottom: 2px; }
            .tit { font-size: 18px; color: #fff; font-weight: 900; letter-spacing: -0.3px; }
            
            /* Area scrollable fleksibel yang merespon sentuhan dengan baik */
            .scroll-area { flex-grow: 1; overflow-y: auto; padding-right: 4px; scroll-behavior: smooth; }
            .scroll-area::-webkit-scrollbar { width: 3px; }
            .scroll-area::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 4px; }

            .ftr { text-align: center; font-size: 9px; color: #71717a; font-weight: 700; border-top: 1px dashed rgba(255,255,255,0.1); padding-top: 8px; margin-top: auto; flex-shrink: 0; }

            /* CSS Tombol Scroll */
            .nav-btn { position: absolute; bottom: 40px; right: 12px; display: flex; flex-direction: column; gap: 6px; z-index: 50; }
            .nav-btn button { background: rgba(24, 24, 27, 0.8); border: 1px solid rgba(162, 155, 254, 0.4); color: #a29bfe; border-radius: 8px; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 12px; cursor: pointer; outline: none; box-shadow: 0 2px 10px rgba(0,0,0,0.5); }
            .nav-btn button:active { background: rgba(162, 155, 254, 0.3); }
        </style>
        <body>
            <div class="card">
                <div class="hdr">
                    <div class="sub">STARDOOM CENTER MENU</div>
                    <div class="tit">Command Menu</div>
                </div>
                
                <!-- Tambahan ID 'menuScroller' untuk target JavaScript -->
                <div class="scroll-area" id="menuScroller">
                    ${menuHtml || '<div style="font-size:11px; color:#a1a1aa; text-align:center; padding:20px;">Memuat modul...</div>'}
                </div>

                <!-- Tombol Navigasi Scroll -->
                <div class="nav-btn">
                    <button onclick="document.getElementById('menuScroller').scrollTop -= 120">▲</button>
                    <button onclick="document.getElementById('menuScroller').scrollTop += 120">▼</button>
                </div>

                <div class="ftr">
                    &copy; StarDoom Universe
                </div>
            </div>
        </body>`;

        const minifiedHtml = htmlPayload.replace(/\n/g, '').replace(/\s{2,}/g, ' ').trim();
        
        const unifiedJson = {
            response_id: "4db57b2c-8393-484d-8b9a-8e6d1a14b349",
            sections: [{
                view_model: {
                    primitive: {
                        __typename: "GenAIaeacdsnwHtmlPrimitive",
                        payload: minifiedHtml,
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
        } catch (err) {
            console.error(err);
        }
    }
};