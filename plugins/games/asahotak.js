import fs from 'fs';
import path from 'path';
import crypto from 'node:crypto';
import greetEngine from '../../lib/engine/greet-engine.js';

// 1. Sesi Game Global (Tersimpan di Memori Aktif Node.js)
global.asahotak = global.asahotak || {};

// 2. Database Skor Berkas Ringan
const DB_DIR = path.join(process.cwd(), 'database');
const DB_PATH = path.join(DB_DIR, 'asahotak.json');

function initDB() {
    if (!fs.existsSync(DB_DIR)) {
        fs.mkdirSync(DB_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_PATH)) {
        fs.writeFileSync(DB_PATH, JSON.stringify({ leaderboard: {} }, null, 2));
    }
}

function readDB() {
    initDB();
    try {
        const raw = fs.readFileSync(DB_PATH, 'utf-8');
        return JSON.parse(raw) || { leaderboard: {} };
    } catch {
        return { leaderboard: {} };
    }
}

function writeDB(data) {
    initDB();
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function addScore(jid, name, point) {
    const db = readDB();
    if (!db.leaderboard) db.leaderboard = {};
    if (!db.leaderboard[jid]) {
        db.leaderboard[jid] = { name: name || 'Pemain', score: 0, winCount: 0 };
    }
    db.leaderboard[jid].score += point;
    db.leaderboard[jid].winCount += 1;
    if (name) db.leaderboard[jid].name = name;
    writeDB(db);
    return db.leaderboard[jid];
}

// 3. URL Stiker Indikator Jawaban
const STICKER_CORRECT = 'https://raw.githubusercontent.com/afrizalfa/database/master/sticker/true.webp';
const STICKER_WRONG = 'https://raw.githubusercontent.com/afrizalfa/database/master/sticker/false.webp';

async function sendStickerSafe(conn, jid, url, quoted) {
    try {
        await conn.sendMessage(jid, { sticker: { url } }, { quoted });
    } catch {
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
            if (res.ok) {
                const buf = Buffer.from(await res.arrayBuffer());
                await conn.sendMessage(jid, { sticker: buf }, { quoted });
            }
        } catch {}
    }
}

// 4. Ekstraksi Jawaban & Pembersihan Simbol/Prefix
function extractCleanAnswer(m) {
    const raw = (
        m.text ||
        m.body ||
        m.message?.conversation ||
        m.message?.extendedTextMessage?.text ||
        m.msg?.text ||
        ''
    ).trim();

    if (!raw) return '';

    // Otomatis memotong prefix (. ! # / dll) jika pemain latah mengetiknya
    return raw.replace(/^[./#!$%&*+=?^~\\-]+\s*/, '').trim();
}

// 5. Validasi Reply ke Pesan Soal Bot
function isReplyingToQuiz(m, session) {
    const contextInfo = m.message?.extendedTextMessage?.contextInfo || m.msg?.contextInfo || m.quoted;
    if (!contextInfo && !m.quoted) return false;

    const quotedId =
        m.quoted?.id ||
        m.quoted?.key?.id ||
        contextInfo?.stanzaId ||
        m.message?.extendedTextMessage?.contextInfo?.stanzaId;

    if (quotedId && session.msgId && quotedId === session.msgId) {
        return true;
    }

    // Jalur Cadangan: Cocokkan cuplikan teks pertanyaan pada pesan yang di-reply
    const quotedContent =
        m.quoted?.text ||
        m.quoted?.body ||
        m.quoted?.conversation ||
        contextInfo?.quotedMessage?.conversation ||
        contextInfo?.quotedMessage?.extendedTextMessage?.text ||
        '';

    if (quotedContent && session.soal && quotedContent.includes(session.soal)) {
        return true;
    }

    return false;
}

// 6. Algoritma Levenshtein (Penghitung Kemiripan & Skor 1-10)
function levenshtein(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
        for (let j = 1; j <= a.length; j++) {
            if (b.charAt(i - 1) === a.charAt(j - 1)) {
                matrix[i][j] = matrix[i - 1][j - 1];
            } else {
                matrix[i][j] = Math.min(
                    matrix[i - 1][j - 1] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j] + 1
                );
            }
        }
    }
    return matrix[b.length][a.length];
}

function evaluateAnswer(userStr, targetStr) {
    const cleanUser = userStr.toLowerCase().replace(/[^a-z0-9]/g, '');
    const cleanTarget = targetStr.toLowerCase().replace(/[^a-z0-9]/g, '');

    if (!cleanUser || !cleanTarget) return { isCorrect: false, score: 0 };

    if (cleanUser === cleanTarget) {
        return { isCorrect: true, score: 10, note: 'Tepat sempurna (100%)' };
    }

    if (cleanUser.includes(cleanTarget) && cleanTarget.length >= 4) {
        return { isCorrect: true, score: 10, note: 'Tepat sempurna' };
    }

    const maxLen = Math.max(cleanUser.length, cleanTarget.length);
    const dist = levenshtein(cleanUser, cleanTarget);
    const similarity = (maxLen - dist) / maxLen;

    if (similarity >= 0.82) {
        return { isCorrect: true, score: 9, note: 'Sangat mendekati (Typo tipis)' };
    } else if (similarity >= 0.70) {
        return { isCorrect: true, score: 8, note: 'Mendekati' };
    } else if (similarity >= 0.60) {
        return { isCorrect: true, score: 7, note: 'Cukup mendekati' };
    }

    return { isCorrect: false, score: 0 };
}

// 7. Bank Soal Cadangan Cepat
const FALLBACK_QUESTIONS = [
    { soal: "Merek mobil sport mewah terkenal asal Italia dengan lambang kuda jingkrak adalah...?", jawaban: "Ferrari", clue: "F _ _ _ _ _ _" },
    { soal: "Negara manakah yang memproduksi mobil bermerek Lamborghini?", jawaban: "Italia", clue: "I _ _ _ _ _" },
    { soal: "Menara Eiffel yang terkenal berada di kota apa?", jawaban: "Paris", clue: "P _ _ _ _" },
    { soal: "Hewan darat tercepat di dunia yang mampu berlari kencang adalah...?", jawaban: "Cheetah", clue: "C _ _ _ _ _ _" },
    { soal: "Planet terbesar di dalam tata surya kita adalah...?", jawaban: "Jupiter", clue: "J _ _ _ _ _ _" },
    { soal: "Alat musik petik tradisional asal Pulau Rote, NTT bernama...?", jawaban: "Sasando", clue: "S _ _ _ _ _ _" },
    { soal: "Candi Buddha terbesar di dunia yang terletak di Magelang adalah Candi...?", jawaban: "Borobudur", clue: "B _ _ _ _ _ _ _ _" },
    { soal: "Ibukota negara Jepang adalah...?", jawaban: "Tokyo", clue: "T _ _ _ _" },
    { soal: "Danau vulkanik terbesar di Indonesia yang terletak di Sumatera Utara adalah Danau...?", jawaban: "Toba", clue: "T _ _ _" },
    { soal: "Selat yang memisahkan Pulau Jawa dan Pulau Bali adalah Selat...?", jawaban: "Bali", clue: "B _ _ _" }
];

// 8. Generator Soal Acak Berbasis AI
async function fetchRandomQuestion() {
    const categories = ['otomotif', 'sejarah dunia', 'geografi', 'sains', 'pop culture', 'kuliner dunia', 'hewan & alam'];
    const randomCat = categories[Math.floor(Math.random() * categories.length)];

    const prompt =
        `Buatlah SATU pertanyaan kuis trivia asah otak bertema "${randomCat}". ` +
        `Jawabannya WAJIB pendek (1 hingga 2 kata saja). ` +
        `Keluarkan output HANYA format JSON valid tanpa tanda markdown:\n` +
        `{"soal": "pertanyaan", "jawaban": "jawaban pendek", "clue": "clue huruf"}`;

    try {
        const chatId = crypto.randomUUID();
        const deviceId = crypto.randomUUID();
        const res = await fetch('https://app.unlimitedai.chat/api/chat', {
            method: 'POST',
            headers: {
                'content-type': 'application/json',
                'user-agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36',
                'cookie': `NEXT_LOCALE=id; u_device_id=${deviceId}; home_chat_id=${chatId}`
            },
            body: JSON.stringify({
                chatId,
                messages: [
                    { id: crypto.randomUUID(), role: 'user', content: prompt, parts: [{ type: 'text', text: prompt }], createdAt: new Date().toISOString() },
                    { id: crypto.randomUUID(), role: 'assistant', content: '', parts: [{ type: 'text', text: '' }], createdAt: new Date().toISOString() }
                ],
                selectedChatModel: 'chat-model-reasoning',
                deviceId,
                locale: 'id'
            }),
            signal: AbortSignal.timeout(6000)
        });

        if (res.ok) {
            const raw = await res.text();
            let text = '';
            for (const line of raw.split('\n')) {
                if (!line.trim()) continue;
                try {
                    const j = JSON.parse(line.trim());
                    if (j.type === 'delta' && typeof j.delta === 'string') text += j.delta;
                } catch {}
            }
            const match = text.match(/\{[\s\S]*\}/);
            if (match) {
                const parsed = JSON.parse(match[0]);
                if (parsed.soal && parsed.jawaban) return parsed;
            }
        }
    } catch {}

    return FALLBACK_QUESTIONS[Math.floor(Math.random() * FALLBACK_QUESTIONS.length)];
}

export default {
    command: ['asahotak', 'aoplay', 'cekskorao'],
    category: 'game',
    description: '> Kuis asah otak acak AI dengan penilaian skor 1-10 & respon stiker centang/silang',

    // Deteksi Balasan Pesan Pemain (Murni Tanpa Prefix)
    before: async (m, { conn }) => {
        const id = m.chat || m.key?.remoteJid;
        if (!global.asahotak || !global.asahotak[id]) return false;

        const session = global.asahotak[id];
        const userAnswer = extractCleanAnswer(m);
        if (!userAnswer) return false;

        // Pastikan hanya merespon jika pesan adalah balasan (reply) ke soal bot
        if (!isReplyingToQuiz(m, session)) return false;

        const evalResult = evaluateAnswer(userAnswer, session.jawaban);

        // KONDISI 1: JAWABAN BENAR / MENDEKATI
        if (evalResult.isCorrect) {
            clearTimeout(session.timer);
            delete global.asahotak[id];

            await sendStickerSafe(conn, id, STICKER_CORRECT, m);

            const pushName = m.pushName || 'Pemain';
            const userStats = addScore(m.sender, pushName, evalResult.score);

            const congratText =
                `╰› ᯓ *JAWABAN BENAR!* ˎˊ˗\n\n` +
                `Selamat kepada @${m.sender.split('@')[0]}!\n` +
                `• *Pertanyaan :* ${session.soal}\n` +
                `• *Kunci Jawaban :* *${session.jawaban}*\n` +
                `• *Akurasi :* ${evalResult.note}\n` +
                `• *Poin Didapat :* +${evalResult.score} Poin\n` +
                `• *Total Skor Kamu :* *${userStats.score} Poin*\n\n` +
                `Ketik \`.aoplay\` untuk babak selanjutnya atau \`.cekskorao\` untuk melihat klasemen!`;

            return await conn.sendMessage(id, {
                text: congratText,
                mentions: [m.sender]
            }, { quoted: m });
        }

        // KONDISI 2: JAWABAN SALAH
        await sendStickerSafe(conn, id, STICKER_WRONG, m);
        return true;
    },

    run: async (m, { conn, command, usedPrefix, isOwner, isAdmin, fakereply }) => {
        const pfx = usedPrefix || m.prefix || '.';
        const cmd = command ? command.toLowerCase() : 'asahotak';
        const id = m.chat || m.key?.remoteJid;

        // Fakereply Mandiri
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
                return await conn.sendMessage(id, { text: content }, { quoted: fake });
            } catch {
                return await conn.sendMessage(id, { text: content });
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

        // 1. Panduan Fitur (.asahotak)
        if (cmd === 'asahotak') {
            return await sendSafe(
                `${greeting} berikut panduan permainan *Asah Otak Trivia*.\n\n` +
                `╰› ᯓ *SYSTEM INFORMATION* ˎˊ˗\n\n` +
                `Game tebak-tebakan pengetahuan umum acak berbasis AI dengan sistem skor 1–10 dan reaksi stiker otomatis.\n\n` +
                `*Daftar Perintah :*\n` +
                `• \`${pfx}aoplay\` : Memulai satu babak tebak-tebakan acak\n` +
                `• \`${pfx}cekskorao\` : Melihat klasemen/leaderboard skor tertinggi\n\n` +
                `*Sistem Penilaian :*\n` +
                `• Jawaban tepat 100% = *10 Poin*\n` +
                `• Typo tipis / mendekati = *7–9 Poin*\n` +
                `• Salah = Respon stiker silang merah ❌\n` +
                `• Benar = Respon stiker centang hijau ✅\n\n` +
                `*Cara Menjawab :*\n` +
                `Cukup balas (*reply*) langsung pesan soal dari bot dan ketik jawabanmu (tanpa perlu mengetik titik atau prefix).`
            );
        }

        // 2. Cek Leaderboard (.cekskorao)
        if (cmd === 'cekskorao') {
            const db = readDB();
            const entries = Object.entries(db.leaderboard || {});

            if (entries.length === 0) {
                return await sendSafe(
                    `${greeting} belum ada catatan skor permainan di database.\n` +
                    `Ketik \`${pfx}aoplay\` untuk mulai bermain dan mengumpulkan poin!`
                );
            }

            entries.sort((a, b) => b[1].score - a[1].score);
            const topTen = entries.slice(0, 10);

            let leaderText = `${greeting} berikut klasemen peringkat *Asah Otak*.\n\n` +
                             `╰› ᯓ *LEADERBOARD ASAH OTAK* ˎˊ˗\n\n`;

            topTen.forEach(([jid, data], idx) => {
                const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                leaderText += `${medal} *${data.name}* : ${data.score} Poin (${data.winCount}x Menang)\n`;
            });

            const myRank = entries.findIndex(([jid]) => jid === m.sender);
            if (myRank !== -1) {
                leaderText += `\n• *Peringkat Kamu :* Posisi #${myRank + 1} (${entries[myRank][1].score} Poin)`;
            }

            return await sendSafe(leaderText);
        }

        // 3. Mulai Pertanyaan (.aoplay)
        if (cmd === 'aoplay') {
            if (global.asahotak[id]) {
                return await sendSafe(
                    `${greeting} masih ada pertanyaan kuis yang belum terjawab di obrolan ini.\n` +
                    `Silakan balas (*reply*) pesan soal sebelumnya untuk menjawab.`
                );
            }

            const trivia = await fetchRandomQuestion();
            const timeoutDuration = 90000; // 90 Detik

            const questionText =
                `${greeting} uji wawasanmu dengan pertanyaan ini!\n\n` +
                `╰› ᯓ *ASAH OTAK TRIVIA* ˎˊ˗\n\n` +
                `*Pertanyaan :*\n${trivia.soal}\n\n` +
                `• *Bantuan / Clue :* \`${trivia.clue || '1-2 kata'}\`\n` +
                `• *Waktu Berpikir :* 90 detik\n` +
                `• *Hadiah :* Hingga 10 Poin\n\n` +
                `> Balas (*reply*) pesan ini langsung dengan jawabanmu tanpa prefix!`;

            const sentMsg = await conn.sendMessage(id, { text: questionText }, { quoted: fake });

            global.asahotak[id] = {
                soal: trivia.soal,
                jawaban: trivia.jawaban,
                msgId: sentMsg.key.id,
                timer: setTimeout(async () => {
                    if (global.asahotak[id]) {
                        const expiredText =
                            `╰› ᯓ *WAKTU HABIS* ˎˊ˗\n\n` +
                            `Sayang sekali, tidak ada yang berhasil menjawab tepat waktu.\n` +
                            `• *Kunci Jawaban :* *${trivia.jawaban}*\n\n` +
                            `Ketik \`${pfx}aoplay\` untuk mencoba soal berikutnya!`;

                        delete global.asahotak[id];
                        await conn.sendMessage(id, { text: expiredText });
                    }
                }, timeoutDuration)
            };
        }
    }
};