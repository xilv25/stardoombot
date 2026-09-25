import fs from 'fs';
import path from 'path';
import greetEngine from '../../lib/engine/greet-engine.js';

// 1. Database Penyimpanan Berkas Ringan
const DB_DIR = path.join(process.cwd(), 'database');
const DB_PATH = path.join(DB_DIR, 'giveaway.json');

function initDB() {
    if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify({ active: [] }, null, 2));
    }
}

function readDB() {
    initDB();
    try {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        return JSON.parse(raw) || { active: [] };
    } catch {
        return { active: [] };
    }
}

function writeDB(data) {
    initDB();
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

// 2. Pengurai Durasi (s/m/h/d/w)
function parseDuration(input) {
    const match = input.match(/^(\d+)\s*(s|m|h|d|w)$/i);
    if (!match) return null;
    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    const multipliers = {
        s: 1000,
        m: 60 * 1000,
        h: 60 * 60 * 1000,
        d: 24 * 60 * 60 * 1000,
        w: 7 * 24 * 60 * 60 * 1000
    };
    return value * multipliers[unit];
}

// 3. Pengurai Tanggal Lengkap
function parseTargetDate(input) {
    const dur = parseDuration(input);
    if (dur) return Date.now() + dur;

    const standard = new Date(input);
    if (!isNaN(standard.getTime()) && standard.getTime() > Date.now()) {
        return standard.getTime();
    }

    const months = {
        januari: 0, jan: 0, februari: 1, feb: 1, maret: 2, mar: 2,
        april: 3, apr: 3, mei: 4, may: 4, juni: 5, jun: 5,
        juli: 6, jul: 6, agustus: 7, agu: 7, ags: 7,
        september: 8, sep: 8, oktober: 9, okt: 9,
        november: 10, nov: 10, desember: 11, des: 11
    };

    const regex = /(\d{1,2})\s+([a-zA-Z]+)\s+(\d{4})(?:\s+(\d{1,2})[:.](\d{1,2}))?/;
    const match = input.toLowerCase().match(regex);

    if (match) {
        const day = parseInt(match[1], 10);
        const monthName = match[2];
        const year = parseInt(match[3], 10);
        const hour = match[4] ? parseInt(match[4], 10) : 23;
        const min = match[5] ? parseInt(match[5], 10) : 59;

        if (months[monthName] !== undefined) {
            const parsed = new Date(year, months[monthName], day, hour, min, 0);
            if (!isNaN(parsed.getTime()) && parsed.getTime() > Date.now()) {
                return parsed.getTime();
            }
        }
    }

    return null;
}

// 4. Format Tanggal
function formatTime(ms) {
    const d = new Date(ms);
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()} pukul ${pad(d.getHours())}:${pad(d.getMinutes())} WIB`;
}

// 5. Background Task Pengundian Pemenang (True RNG + Fix Mention Order)
let giveawayLoopStarted = false;
let globalSocket = null;

function startGiveawayWatcher(conn) {
    globalSocket = conn;
    if (giveawayLoopStarted) return;
    giveawayLoopStarted = true;

    setInterval(async () => {
        if (!globalSocket) return;

        const db = readDB();
        if (!db.active || db.active.length === 0) return;

        const now = Date.now();
        const remaining = [];

        for (const item of db.active) {
            if (now >= item.endTime) {
                try {
                    const groupMeta = await globalSocket.groupMetadata(item.chatId);
                    const botJid = (globalSocket.user?.id || '').split(':')[0] + '@s.whatsapp.net';

                    // Seluruh member grup termasuk penyelenggara ikut diundi (hanya bot yang dikecualikan)
                    const pool = (groupMeta.participants || [])
                        .map(p => p.id)
                        .filter(jid => jid !== botJid);

                    if (pool.length === 0) continue;

                    // Pengacakan murni Fisher-Yates
                    const shuffled = [...pool];
                    for (let i = shuffled.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
                    }

                    // Ambil pemenang sesuai jumlah
                    const winnerCount = Math.max(1, Math.min(Number(item.winnerCount) || 1, shuffled.length));
                    const winners = shuffled.slice(0, winnerCount);

                    // Teks daftar pemenang
                    const winnerTags = winners.map((w, idx) => `• *Pemenang ${idx + 1} :* @${w.split('@')[0]}`).join('\n');

                    // Sinkronisasi Indeks Mention WhatsApp:
                    // 1. Array winners di urutan awal agar tag pemenang akurat
                    // 2. item.creator menyusul agar tag penyelenggara akurat
                    // 3. Sisa anggota untuk efek hidetag ke seluruh grup
                    const mentionedInText = [...winners];
                    if (!mentionedInText.includes(item.creator)) {
                        mentionedInText.push(item.creator);
                    }

                    const allMembers = (groupMeta.participants || []).map(p => p.id);
                    const remainingMembers = allMembers.filter(jid => !mentionedInText.includes(jid));
                    const finalMentions = [...mentionedInText, ...remainingMembers];

                    const announceText =
                        `╰› ᯓ *GIVEAWAY RESMI BERAKHIR* ˎˊ˗\n\n` +
                        `Selamat kepada pemenang terpilih!\n\n` +
                        `• *Hadiah :* ${item.prize}\n` +
                        `• *Total Pemenang :* ${winnerCount} orang\n` +
                        `• *Penyelenggara :* @${item.creator.split('@')[0]}\n\n` +
                        `*Daftar Pemenang :*\n${winnerTags}\n\n` +
                        `Silakan hubungi penyelenggara di atas untuk klaim hadiahmu.\n` +
                        `> *Catatan:* Pemilihan pemenang murni dilakukan secara acak (RNG) oleh sistem.`;

                    await globalSocket.sendMessage(item.chatId, {
                        text: announceText,
                        mentions: finalMentions
                    });

                } catch (err) {
                    console.error('[Giveaway Watcher Error]:', err);
                }
            } else {
                remaining.push(item);
            }
        }

        if (remaining.length !== db.active.length) {
            writeDB({ active: remaining });
        }
    }, 10000);
}

export default {
    command: ['giveaway', 'ga', 'giftaway'],
    category: 'group',
    description: '> Mengatur event giveaway grup dengan hitung mundur dan undian acak',

    run: async (m, { conn, text, command, usedPrefix, isOwner, isAdmin, isGroup, fakereply }) => {
        const pfx = usedPrefix || m.prefix || '.';
        const cmd = command ? command.toLowerCase() : 'giveaway';

        startGiveawayWatcher(conn);

        // Fakereply Mandiri (Tanpa Watermark)
        const pushName = m.pushName || 'User';
        const fake = fakereply || {
            key: { fromMe: false, participant: '13135550002@s.whatsapp.net', remoteJid: 'status@broadcast' },
            message: {
                contactMessage: {
                    displayName: pushName,
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${pushName}\nitem1.TEL;waid=13135550002:13135550002\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
                }
            }
        };

        const sendSafe = async (content) => {
            try {
                return await conn.sendMessage(m.chat, { text: content }, { quoted: fake });
            } catch {
                return await conn.sendMessage(m.chat, { text: content });
            }
        };

        // Greet Engine
        let greeting = '';
        try {
            const fnGreet = typeof greetEngine === 'function' ? greetEngine : (greetEngine?.getGreeting || greetEngine?.default);
            if (typeof fnGreet === 'function') {
                const res = fnGreet(m, { isOwner, isAdmin });
                greeting = typeof res === 'object' ? (res.prefix || res.text || '') : res;
            }
        } catch {}

        if (!greeting) {
            const hour = new Date().getHours();
            const ucapan = hour < 4 ? 'dini hari' : hour < 11 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam';
            greeting = `Selamat ${ucapan} ${isOwner ? 'Tuan Muda' : (isAdmin ? 'Admin' : 'Kak')} *${pushName}*,`;
        }

        // Panduan Penggunaan (.giveaway / .giftaway)
        if (cmd === 'giveaway' || cmd === 'giftaway') {
            return await sendSafe(
                `${greeting} berikut panduan lengkap fitur *Giveaway Grup*.\n\n` +
                `╰› ᯓ *SYSTEM INFORMATION* ˎˊ˗\n\n` +
                `*Format Perintah :*\n` +
                `• \`${pfx}ga <waktu> | <jumlah pemenang> | <hadiah>\`\n\n` +
                `*Format Waktu :*\n` +
                `1. *Durasi Hitung Mundur :*\n` +
                `   • \`s\` : detik (contoh: \`30s\`)\n` +
                `   • \`m\` : menit (contoh: \`15m\`)\n` +
                `   • \`h\` : jam (contoh: \`1h\` atau \`2h\`)\n` +
                `   • \`d\` : hari (contoh: \`1d\` atau \`3d\`)\n` +
                `2. *Tenggat Tanggal Tertentu :*\n` +
                `   • Contoh: \`6 November 2026\` atau \`6 November 2026 20:00\`\n\n` +
                `*Contoh Penggunaan :*\n` +
                `• \`${pfx}ga 1h | 1 | Akun Spotify Premium\`\n` +
                `• \`${pfx}ga 6 November 2026 20:00 | 2 | Saldo 100k\``
            );
        }

        // Validasi Pembuatan Giveaway (.ga)
        if (!isGroup) {
            return await sendSafe(`${greeting} fitur giveaway hanya dapat dijalankan di dalam grup.`);
        }

        if (!isAdmin && !isOwner) {
            return await sendSafe(`${greeting} pembuatan giveaway hanya dapat diatur oleh Admin Grup atau Owner.`);
        }

        if (!text || !text.includes('|')) {
            return await sendSafe(
                `${greeting} format pembuatan giveaway belum lengkap.\n\n` +
                `╰› ᯓ *SYSTEM WARNING* ˎˊ˗\n\n` +
                `*Format Penggunaan :*\n` +
                `• \`${pfx}ga <waktu/durasi> | <jumlah pemenang> | <hadiah>\`\n\n` +
                `*Contoh :*\n` +
                `• \`${pfx}ga 1h | 1 | Saldo Dana 50k\`\n` +
                `• \`${pfx}ga 2h | 2 | Akun Premium\`\n\n` +
                `Ketik \`${pfx}giveaway\` untuk membaca panduan selengkapnya.`
            );
        }

        const parts = text.split('|').map(s => s.trim());
        const rawTime = parts[0];
        const rawWinners = parts[1];
        const prize = parts.slice(2).join(' | ').trim();

        if (!rawTime || !rawWinners || !prize) {
            return await sendSafe(
                `${greeting} parameter tidak boleh kosong. Pastikan durasi, jumlah pemenang, dan hadiah terisi rapi.`
            );
        }

        const endTime = parseTargetDate(rawTime);
        if (!endTime) {
            return await sendSafe(
                `${greeting} format waktu tidak valid atau waktu sudah terlewat.\n` +
                `Gunakan durasi (\`30s\`, \`15m\`, \`1h\`, \`1d\`) atau tanggal valid (\`6 November 2026 20:00\`).`
            );
        }

        const winnerCount = parseInt(rawWinners, 10);
        if (isNaN(winnerCount) || winnerCount < 1) {
            return await sendSafe(`${greeting} jumlah pemenang harus berupa angka positif minimal 1.`);
        }

        const db = readDB();
        const giveawayItem = {
            id: `ga_${m.chat}_${Date.now()}`,
            chatId: m.chat,
            creator: m.sender,
            winnerCount: winnerCount,
            prize: prize,
            endTime: endTime,
            createdAt: Date.now()
        };

        db.active.push(giveawayItem);
        writeDB(db);

        // Ambil partisipan untuk pengumuman pembukaan
        let allMembers = [];
        try {
            const meta = await conn.groupMetadata(m.chat);
            allMembers = (meta.participants || []).map(p => p.id);
        } catch {
            allMembers = [m.sender];
        }

        // Penyelenggara diletakkan di indeks awal agar tag teks akurat
        const otherMembers = allMembers.filter(j => j !== m.sender);
        const openMentions = [m.sender, ...otherMembers];

        const successNotice =
            `${greeting} event giveaway resmi dibuka!\n\n` +
            `╰› ᯓ *EVENT GIVEAWAY RESMI* ˎˊ˗\n\n` +
            `• *Hadiah :* ${prize}\n` +
            `• *Total Pemenang :* ${winnerCount} orang\n` +
            `• *Tenggat Pengundian :* ${formatTime(endTime)}\n` +
            `• *Penyelenggara :* @${m.sender.split('@')[0]}\n\n` +
            `Semua anggota grup berkesempatan menang. Pemenang akan diundi dan diumumkan otomatis saat waktu berakhir.`;

        await conn.sendMessage(m.chat, {
            text: successNotice,
            mentions: openMentions
        }, { quoted: fake });
    }
};