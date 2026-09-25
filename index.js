import './lib/global-symbol.js';
import pino from 'pino';
import readline from 'readline';
import fs from 'fs';
import path from 'path';
import { pathToFileURL, fileURLToPath } from 'url';
import { execSync } from 'child_process';
import messageHandler from './handler.js';
import config from './config.js';

import { startDiscordBridge } from './lib/engine/discord-bridge.js';
import { handleGroupEvents } from './lib/engine/events-engine.js';
import { startAfkEngine } from './lib/engine/afk-engine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(process.cwd(), 'database', 'groups.json');
if (!fs.existsSync(dbPath)) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
    fs.writeFileSync(dbPath, JSON.stringify({}));
}

try {
    await import('ourin');
    await import('yt-search');
    await import('discord.js');
    await import('express');
    await import('cors');
    await import('axios');
    await import('localtunnel');
} catch (err) {
    console.log('\n[!] Modul belum lengkap. Memaksa instalasi otomatis...\n');
    try {
        execSync('npm install ourin@npm:ourin-baileys@^0.8.1 @adiwajshing/keyed-db @hapi/boom pino qrcode wa-sticker-formatter awesome-phonenumber p-queue qs yt-search discord.js sharp jimp fluent-ffmpeg express cors axios localtunnel --legacy-peer-deps', { stdio: 'inherit' });
        console.log('\n[✓] Instalasi Paksa Selesai! Silakan klik tombol Start / Restart di panel Anda.\n');
        process.exit(0);
    } catch (installErr) {
        console.error('\n[X] Gagal menginstal otomatis.\n', installErr);
        process.exit(1);
    }
}

const baileys = await import('ourin');
const makeWASocket = baileys.default;
const { useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore, fetchLatestBaileysVersion } = baileys;

process.on('uncaughtException', (error) => {
    const ignored = ['write EOF', 'ECONNRESET', 'ETIMEDOUT'];
    if (ignored.some(msg => error.message?.includes(msg) || error.code === msg)) return;
    console.error('[!] Uncaught Exception:', error.message);
});

let handler = messageHandler;
const loadHandler = async () => {
    try {
        const handlerPath = pathToFileURL(path.resolve(process.cwd(), 'handler.js')).href;
        const module = await import(`${handlerPath}?v=${Date.now()}`);
        handler = module.default || module.handler;
        console.log(`\x1b[32m(SINKRONISASI)\x1b[0m Saraf pusat handler.js diperbarui.`);
    } catch (e) { console.error(e); }
};
fs.watchFile(path.resolve(process.cwd(), 'handler.js'), async () => { await loadHandler(); });

async function startStarDoom() {
    await loadHandler();

    const dbDir = path.resolve(process.cwd(), 'database');
    const groupSetDir = path.join(dbDir, 'groupset');

    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    if (!fs.existsSync(groupSetDir)) fs.mkdirSync(groupSetDir, { recursive: true });

    global.db = { data: { chats: {}, groups: {}, settings: {} }, users: {}, roblox: {} }; 
    
    if (fs.existsSync('./database/database.json')) {
        try { global.db.data = JSON.parse(fs.readFileSync('./database/database.json', 'utf-8')); } catch (e) {}
    }
    if (fs.existsSync('./database/users.json')) {
        try { global.db.users = JSON.parse(fs.readFileSync('./database/users.json', 'utf-8')); } catch (e) {}
    }
    if (fs.existsSync('./database/roblox.json')) {
        try { global.db.roblox = JSON.parse(fs.readFileSync('./database/roblox.json', 'utf-8')); } catch (e) {}
    }

    const groupFiles = fs.readdirSync(groupSetDir).filter(f => f.endsWith('.json'));
    for (let file of groupFiles) {
        try {
            let jid = file.replace('.json', '');
            global.db.data.chats[jid] = JSON.parse(fs.readFileSync(path.join(groupSetDir, file), 'utf-8'));
        } catch (e) {}
    }

    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestBaileysVersion();

    const logger = pino({ level: "silent" });

    const sock = makeWASocket({
        version,
        logger,
        printQRInTerminal: false,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        // Diperbarui ke konfigurasi Windows Chrome untuk stabilitas pairing
        browser: ["Windows", "Chrome", "115.0.5790.171"],
        syncFullHistory: false
    });

    if (!sock.authState.creds.registered) {
        setTimeout(async () => {
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            const askQuestion = (text) => new Promise((resolve) => rl.question(text, (ans) => { rl.close(); resolve(ans.trim()); }));

            console.log(`\n[SISTEM] Sesi otentikasi belum terdaftar.`);
            let phoneNumber = await askQuestion('[SISTEM] Masukkan nomor WhatsApp (Contoh: 6281234567890): \n> ');
            phoneNumber = phoneNumber.replace(/[^0-9]/g, "");

            console.log(`\n[!] Meminta kode untuk ${phoneNumber}...`);
            try {
                await new Promise((resolve) => setTimeout(resolve, 2000));
                const code = await sock.requestPairingCode(phoneNumber);
                const formattedCode = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(`\n=========================================`);
                console.log(`   PAIRING CODE: ${formattedCode}   `);
                console.log(`=========================================\n`);
            } catch (error) {
                console.log(`\n[!] Gagal meminta kode: ${error.message}\n`);
            }
        }, 2000); 
    }

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect } = update;
        if (connection === 'close') {
            const sc = lastDisconnect.error?.output?.statusCode;
            console.log(`\n[!] Koneksi tertutup (Kode: ${sc}). Menyambungkan ulang...`);
            if (sc !== DisconnectReason.loggedOut) {
                startStarDoom();
            } else {
                console.log("[!] Sesi telah keluar. Hapus folder 'session' dan pairing ulang.");
            }
        } else if (connection === 'open') {
            console.log('\n[✓] StarDoom Universe Berhasil Tersambung Aktif di WhatsApp.\n');
            startDiscordBridge(sock, dbPath);
            startAfkEngine(sock);
        }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify' && type !== 'append') return; 
        const msg = messages[0];
        if (!msg) return;

        if (msg.messageStubType) {
            await handleGroupEvents(sock, msg, dbPath);
            return;
        }

        if (!msg.message) return;

        try {
            if (handler) await handler(sock, msg); 
        } catch (e) {
            console.error('[Handler Upsert Error]:', e);
        }
    });

    setInterval(() => { 
        if (global.db.data) {
            if (global.db.data.chats) {
                for (let jid in global.db.data.chats) {
                    fs.writeFileSync(path.join(groupSetDir, `${jid}.json`), JSON.stringify(global.db.data.chats[jid], null, 2));
                }
            }
            let tempChats = global.db.data.chats;
            global.db.data.chats = {}; 
            fs.writeFileSync('./database/database.json', JSON.stringify(global.db.data, null, 2)); 
            global.db.data.chats = tempChats; 
        }

        if (global.db.users) fs.writeFileSync('./database/users.json', JSON.stringify(global.db.users, null, 2)); 
        if (global.db.roblox) fs.writeFileSync('./database/roblox.json', JSON.stringify(global.db.roblox, null, 2)); 
    }, 30000);
}

const pluginsPath = path.join(__dirname, 'plugins');
if (!fs.existsSync(pluginsPath)) fs.mkdirSync(pluginsPath, { recursive: true });

async function startApiServer() {
    try {
        const expressModule = await import('express');
        const corsModule = await import('cors');
        const axiosModule = await import('axios');
        const localtunnelModule = await import('localtunnel');
        
        const express = expressModule.default;
        const cors = corsModule.default;
        const axios = axiosModule.default;
        const localtunnel = localtunnelModule.default;

        const app = express();
        const PORT = process.env.SERVER_PORT || 2096;

        app.use(cors());
        app.use(express.json());

        app.get('/api/stream/video', (req, res) => {
            const videoPath = path.resolve('./src/test/video.mp4');
            if (!fs.existsSync(videoPath)) return res.status(404).json({ error: 'Video tidak ditemukan.' });

            const stat = fs.statSync(videoPath);
            const fileSize = stat.size;
            const range = req.headers.range;

            if (range) {
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;

                if (start >= fileSize) {
                    res.status(416).setHeader('Content-Range', `bytes */${fileSize}`);
                    return res.send();
                }

                const chunksize = (end - start) + 1;
                const fileStream = fs.createReadStream(videoPath, { start, end });
                res.writeHead(206, {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': 'video/mp4',
                    'Access-Control-Allow-Origin': '*'
                });
                fileStream.pipe(res);
            } else {
                res.writeHead(200, { 'Content-Length': fileSize, 'Content-Type': 'video/mp4', 'Access-Control-Allow-Origin': '*' });
                fs.createReadStream(videoPath).pipe(res);
            }
        });

        app.get('/api/manga/proxy', async (req, res) => {
            const targetUrl = req.query.url;
            if (!targetUrl) return res.status(400).send('URL diperlukan');

            try {
                const response = await axios({
                    method: 'GET',
                    url: targetUrl,
                    responseType: 'stream',
                    headers: { 
                        "Makota-API": "mki.eyJ1aWQiOjc5LCJ0eXBlIjoiYXBpIiwianRpIjoiZGNlYzc5ZjdkMmI3MWM5NmE5NGEzZjk4OTJiM2EzMWMiLCJpYXQiOjE3ODg3MjkwMTZ9.rD7LZleCzUAPZmFbQvOsSSzsDSsTjPPDDYzLzElomTM",
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
                    }
                });

                res.setHeader('Content-Type', response.headers['content-type'] || 'image/jpeg');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Cache-Control', 'public, max-age=86400'); 
                
                response.data.pipe(res);
            } catch (e) {
                res.status(500).send('Gagal mengambil gambar');
            }
        });

        app.listen(PORT, '0.0.0.0', async () => {
            try {
                const tunnel = await localtunnel({ port: PORT });
                global.PROXY_URL = tunnel.url; 
                
                tunnel.on('close', () => {});
            } catch (tunnelErr) {}
        });
    } catch (err) {}
}

startApiServer();
startStarDoom();
