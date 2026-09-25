import fs from 'fs';
import path from 'path';
import http from 'http';

if (!global.previewServer) {
    const previewDir = path.resolve(process.cwd(), 'database', 'preview');
    if (!fs.existsSync(previewDir)) fs.mkdirSync(previewDir, { recursive: true });

    const server = http.createServer((req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        if (req.url.startsWith('/view/')) {
            const fileId = req.url.split('/')[2]?.split('?')[0];
            const filePath = path.join(previewDir, `${fileId}.html`);
            
            if (fs.existsSync(filePath)) {
                res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
                res.end(fs.readFileSync(filePath));
                return;
            }
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('Preview tidak ditemukan atau sudah kadaluarsa.');
    });

    // Menggunakan port 6011 agar aman dari bentrok dengan stats.js (port 6010)
    server.listen(6011, () => console.log("[PREVIEW] Web Preview Server aktif di port 6011"));
    global.previewServer = server;
}

export default {
    command: ['htmlpreview', 'html', 'render'],
    category: 'owner',
    description: '> Membuat pratinjau web interaktif dari kode HTML.',
    
    run: async (m, { text, args, conn }) => {
        let code = (text || (args && args.join(' ')) || '').trim();

        if (!code && m.quoted) {
            code = (
                m.quoted.text || 
                m.quoted.caption || 
                m.quoted.body || 
                m.quoted.msg?.text ||
                m.quoted.msg?.caption ||
                m.quoted.raw?.message?.conversation ||
                m.quoted.raw?.message?.extendedTextMessage?.text ||
                ''
            ).trim();
        }

        if (!code && m.raw) {
            const contextInfo = m.raw.message?.extendedTextMessage?.contextInfo || m.raw.message?.imageMessage?.contextInfo || m.raw.message?.documentMessage?.contextInfo;
            if (contextInfo && contextInfo.quotedMessage) {
                const qMsg = contextInfo.quotedMessage;
                code = (qMsg.conversation || qMsg.extendedTextMessage?.text || qMsg.documentMessage?.caption || '').trim();
            }
        }

        if (!code) {
            return m.reply("Balas pesan berisi kode HTML lengkap yang ingin dijadikan Web Preview.");
        }

        try {
            const previewId = Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
            const previewDir = path.resolve(process.cwd(), 'database', 'preview');
            if (!fs.existsSync(previewDir)) fs.mkdirSync(previewDir, { recursive: true });
            
            const filePath = path.join(previewDir, `${previewId}.html`);
            fs.writeFileSync(filePath, code, 'utf-8');

            // Menggunakan port 6011 pada URL preview
            const previewUrl = `http://103.4.82.76:6011/view/${previewId}`;

            await conn.sendMessage(m.chat, {
                text: `*HTML Preview*\n\n🌐 *HTML PREVIEW LIVE*\n\nPreview HTML berhasil dibuat\nHTML Web Previewer\n\n🔗 ${previewUrl}`,
                contextInfo: {
                    externalAdReply: {
                        title: "HTML PREVIEW LIVE",
                        body: "HTML Web Previewer",
                        thumbnailUrl: "https://files.catbox.moe/k29l79.jpg",
                        sourceUrl: previewUrl,
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            }, { quoted: m });

        } catch (err) {
            console.error('[PREVIEW ERROR]', err);
            return m.reply(`Gagal membuat web preview: ${err.message}`);
        }
    }
};