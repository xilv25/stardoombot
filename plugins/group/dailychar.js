import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { pathToFileURL } from 'url';

const ANILIST_API = 'https://graphql.anilist.co';
const DB_DIR = path.resolve(process.cwd(), 'database');
const DB_FILE = path.join(DB_DIR, 'groups.json');

function loadGroupDB() {
    try {
        if (!fs.existsSync(DB_FILE)) return {};
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    } catch {
        return {};
    }
}

function saveGroupDB(data) {
    try {
        if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch {}
}

function cleanText(text) {
    if (!text) return '';
    return text
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]*>?/gm, '')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
}

// Fungsi Penerjemah dengan Fallback Berlapis
async function translateToId(text) {
    if (!text) return 'Tidak ada deskripsi tersedia.';
    const cleaned = cleanText(text);
    if (!cleaned) return 'Tidak ada deskripsi tersedia.';
    const shortText = cleaned.length > 400 ? cleaned.substring(0, 397) + '...' : cleaned;

    // Jalur 1: Google Translate Engine
    try {
        const res = await axios.get('https://translate.googleapis.com/translate_a/single', {
            params: {
                client: 'gtx',
                sl: 'auto',
                tl: 'id',
                dt: 't',
                q: shortText
            },
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 7000
        });

        if (res.data && Array.isArray(res.data[0])) {
            const translated = res.data[0].map(item => item[0]).join('').trim();
            if (translated) return translated;
        }
    } catch {}

    // Jalur 2: Cadangan MyMemory API
    try {
        const res = await axios.get('https://api.mymemory.translated.net/get', {
            params: {
                q: shortText,
                langpair: 'en|id'
            },
            timeout: 7000
        });

        if (res.data?.responseData?.translatedText) {
            return res.data.responseData.translatedText.trim();
        }
    } catch {}

    return shortText;
}

const DAILY_MANHWA_QUERY = `
query ($page: Int) {
  Page(page: $page, perPage: 1) {
    media(type: MANGA, countryOfOrigin: "KR", sort: POPULARITY_DESC) {
      title { romaji english }
      description
      characters(perPage: 25) {
        nodes {
          name { full native }
          image { large }
          gender
          description
        }
      }
    }
  }
}
`;

async function fetchDailyCharacter() {
    for (let attempt = 0; attempt < 5; attempt++) {
        try {
            const randomPage = Math.floor(Math.random() * 250) + 1;
            const res = await axios.post(ANILIST_API, {
                query: DAILY_MANHWA_QUERY,
                variables: { page: randomPage }
            }, {
                headers: { 'Content-Type': 'application/json', 'User-Agent': 'Mozilla/5.0' },
                timeout: 15000
            });

            const media = res.data?.data?.Page?.media?.[0];
            if (!media) continue;

            const chars = (media.characters?.nodes || []).filter(c => c.image?.large && c.gender);
            if (chars.length === 0) continue;

            const chosen = chars[Math.floor(Math.random() * chars.length)];
            const manhwaTitle = media.title.english || media.title.romaji || 'Manhwa Korea';
            const rawDesc = chosen.description || media.description || '';

            const translatedDesc = await translateToId(rawDesc);

            return {
                name: chosen.name.full || 'Tanpa Nama',
                nativeName: chosen.name.native || '',
                gender: chosen.gender || 'Tidak diketahui',
                image: chosen.image.large,
                from: manhwaTitle,
                description: translatedDesc
            };
        } catch {
            continue;
        }
    }
    return null;
}

async function dispatchDailyChar(conn, targetJids = null) {
    const db = loadGroupDB();
    const targets = targetJids || Object.keys(db).filter(jid => db[jid]?.dailyChar === true);

    if (targets.length === 0) return false;

    const charData = await fetchDailyCharacter();
    if (!charData) {
        console.error('[DailyChar] Gagal mengambil data karakter dari AniList.');
        return false;
    }

    const caption = `*DAILY MANHWA CHARACTER*\n\n` +
        `╰› ᯓ *EDISI HARI INI* ˎˊ˗\n\n` +
        `• *Nama Karakter :* ${charData.name}${charData.nativeName ? ` (${charData.nativeName})` : ''}\n` +
        `• *Asal Manhwa :* ${charData.from}\n` +
        `• *Gender :* ${charData.gender}\n\n` +
        `*Deskripsi Singkat :*\n${charData.description}`;

    const fakeReply = {
        key: { fromMe: false, participant: '13135550002@s.whatsapp.net', remoteJid: 'status@broadcast' },
        message: { contactMessage: { displayName: 'Daily Manhwa', vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:Daily Manhwa\nitem1.TEL;waid=13135550002:13135550002\nitem1.X-ABLabel:Ponsel\nEND:VCARD` } }
    };

    for (const jid of targets) {
        try {
            await conn.sendMessage(jid, { image: { url: charData.image }, caption }, { quoted: fakeReply });
            await new Promise(r => setTimeout(r, 2500));
        } catch (err) {
            console.error(`[DailyChar Error] Gagal mengirim ke ${jid}:`, err.message);
        }
    }
    return true;
}

function startSchedulerOnce(conn) {
    if (global._dailySchedulerStarted) return;
    global._dailySchedulerStarted = true;

    setInterval(async () => {
        try {
            const now = new Date();
            const wibDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
            const wibHour = parseInt(now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }), 10);
            const wibMinute = parseInt(now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Jakarta', minute: '2-digit', hour12: false }), 10);

            if (wibHour === 7 && wibMinute <= 30 && global._lastDailySentDate !== wibDate) {
                global._lastDailySentDate = wibDate;
                await dispatchDailyChar(conn);
            }
        } catch (e) {
            console.error('[Scheduler Interval Error]:', e);
        }
    }, 20000);
}

export default {
    command: ['dailychar', 'dailymanhwa'],
    category: 'group',
    description: '> Mengatur kiriman karakter manhwa harian otomatis',

    before: async (m, { conn }) => {
        if (conn && !global._dailySchedulerStarted) {
            startSchedulerOnce(conn);
        }
        return false;
    },

    run: async (m, { conn, args, isOwner, isAdmin }) => {
        startSchedulerOnce(conn);

        const pfx = m.prefix || '.';
        const action = (args[0] || '').toLowerCase();

        if (!m.chat.endsWith('@g.us')) {
            return await m.reply('Perintah ini hanya dapat dikonfigurasi di dalam grup atau ruang pengumuman komunitas.');
        }

        let greeting = '';
        try {
            const enginePath = pathToFileURL(path.resolve(process.cwd(), 'lib/engine/greet-engine.js')).href;
            const greetMod = await import(enginePath);
            const fnGreet = greetMod.getGreeting || greetMod.default?.getGreeting || greetMod.default;
            if (typeof fnGreet === 'function') {
                const res = fnGreet(m, { isOwner, isAdmin });
                greeting = typeof res === 'object' ? (res.prefix || res.text) : res;
            }
        } catch {}

        if (!greeting) {
            greeting = `Halo ${isOwner ? 'Tuan Muda' : (isAdmin ? 'Admin' : 'Kak')} *${m.pushName || 'User'}*,`;
        }

        if (!isOwner && !isAdmin) {
            return await m.reply(`${greeting} konfigurasi ini hanya dapat diubah oleh Admin atau Owner.`);
        }

        const db = loadGroupDB();
        db[m.chat] = db[m.chat] || {};

        if (action === 'test') {
            const ok = await dispatchDailyChar(conn, [m.chat]);
            if (!ok) {
                await m.reply('Gagal mengirim sampel. Periksa koneksi atau pastikan bot sudah menjadi admin jika ini adalah ruang pengumuman.');
            }
            return;
        }

        if (action === 'on' || action === 'enable') {
            if (db[m.chat].dailyChar) {
                return await m.reply(`${greeting} fitur Daily Manhwa Character sudah aktif di ruang ini.`);
            }
            db[m.chat].dailyChar = true;
            saveGroupDB(db);
            return await m.reply(
                `${greeting} fitur Daily Manhwa Character berhasil diaktifkan.\n\n` +
                `╰› ᯓ *DAILY CHARACTER ACTIVATED* ˎˊ˗\n\n` +
                `• Jadwal : Setiap hari pukul 07:00 WIB\n` +
                `• Target : Ruang obrolan ini\n\n` +
                `Pastikan bot berstatus sebagai Admin jika grup ini merupakan ruang pengumuman.`
            );
        }

        if (action === 'off' || action === 'disable') {
            if (!db[m.chat].dailyChar) {
                return await m.reply(`${greeting} fitur Daily Manhwa Character memang sedang tidak aktif.`);
            }
            db[m.chat].dailyChar = false;
            saveGroupDB(db);
            return await m.reply(`${greeting} fitur Daily Manhwa Character telah dinonaktifkan dari ruang ini.`);
        }

        const currentStatus = db[m.chat].dailyChar ? 'Aktif' : 'Nonaktif';
        return await m.reply(
            `${greeting} tentukan opsi konfigurasi fitur:\n\n` +
            `╰› ᯓ *DAILY CHAR CONFIGURATION* ˎˊ˗\n\n` +
            `• Status Saat Ini : *${currentStatus}*\n` +
            `• Jadwal Kirim : 07:00 WIB\n\n` +
            `*Pilihan Perintah :*\n` +
            `• \`${pfx}dailychar on\` : Mengaktifkan kiriman harian\n` +
            `• \`${pfx}dailychar off\` : Menonaktifkan kiriman harian\n` +
            `• \`${pfx}dailychar test\` : Menguji kiriman langsung detik ini`
        );
    }
};