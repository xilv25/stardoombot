import fs from 'fs';
import path from 'path';
import greetEngine from '../../lib/engine/greet-engine.js';

// Direktori Database
const gamesDir = path.resolve('./database/games');
const sessionFile = path.join(gamesDir, 'family100.json');

const skorDir = path.resolve('./database/skor');
const skorFile = path.join(skorDir, 'family100.json');

// Helper Sesi Game (Disimpan ke Disk JSON, Nol Beban RAM)
function getAllSessions() {
    if (!fs.existsSync(gamesDir)) fs.mkdirSync(gamesDir, { recursive: true });
    if (!fs.existsSync(sessionFile)) fs.writeFileSync(sessionFile, '{}');
    try {
        return JSON.parse(fs.readFileSync(sessionFile, 'utf-8'));
    } catch {
        return {};
    }
}

function getSession(chatId) {
    const sessions = getAllSessions();
    return sessions[chatId] || null;
}

function saveSession(chatId, data) {
    const sessions = getAllSessions();
    sessions[chatId] = data;
    fs.writeFileSync(sessionFile, JSON.stringify(sessions, null, 2));
}

function deleteSession(chatId) {
    const sessions = getAllSessions();
    if (sessions[chatId]) {
        delete sessions[chatId];
        fs.writeFileSync(sessionFile, JSON.stringify(sessions, null, 2));
    }
}

// Helper Database Skor
function getScores() {
    if (!fs.existsSync(skorDir)) fs.mkdirSync(skorDir, { recursive: true });
    if (!fs.existsSync(skorFile)) fs.writeFileSync(skorFile, '{}');
    try {
        return JSON.parse(fs.readFileSync(skorFile, 'utf-8'));
    } catch {
        return {};
    }
}

function updateScore(senderJid, points) {
    const scores = getScores();
    const current = scores[senderJid] || 0;
    scores[senderJid] = Math.max(0, current + points);
    fs.writeFileSync(skorFile, JSON.stringify(scores, null, 2));
    return scores[senderJid];
}

// Bank Soal Family 100
const bankSoal = [
    {
        soal: 'Sebutkan makanan yang sering dipesan saat nongkrong di kafe!',
        jawaban: ['kopi', 'kentang goreng', 'roti bakar', 'teh', 'mie instan']
    },
    {
        soal: 'Apa yang biasanya dicari orang saat listrik padam atau mati lampu?',
        jawaban: ['lilin', 'senter', 'korek api', 'ponsel', 'kipas']
    },
    {
        soal: 'Sebutkan benda yang sering dibawa saat pergi berenang!',
        jawaban: ['baju renang', 'handuk', 'kacamata renang', 'pelampung', 'sabun']
    },
    {
        soal: 'Apa yang dilakukan orang ketika bangun tidur di pagi hari?',
        jawaban: ['cek hp', 'minum air', 'mandi', 'cuci muka', 'berdoa']
    },
    {
        soal: 'Apa yang biasa disimpan orang di dalam dompet selain uang?',
        jawaban: ['ktp', 'kartu atm', 'foto', 'sim', 'struk']
    },
    {
        soal: 'Sebutkan hewan yang sering dijadikan peliharaan di rumah!',
        jawaban: ['kucing', 'anjing', 'ikan', 'burung', 'hamster']
    },
    {
        soal: 'Apa alasan seseorang datang terlambat ke sekolah atau kantor?',
        jawaban: ['macet', 'kesiangan', 'ban bocor', 'hujan', 'sakit']
    },
    {
        soal: 'Sebutkan barang yang sering dibawa saat bepergian di musim hujan!',
        jawaban: ['payung', 'jas hujan', 'jaket', 'sandal', 'kantong plastik']
    }
];

function getRandomSoal() {
    const item = bankSoal[Math.floor(Math.random() * bankSoal.length)];
    return {
        soal: item.soal,
        jawaban: item.jawaban.map(v => v.toLowerCase().trim()),
        terjawab: Array(item.jawaban.length).fill(false),
        penjawab: Array(item.jawaban.length).fill(null),
        hints: Array(item.jawaban.length).fill(0),
        salah: 0,
        maxSalah: 3
    };
}

// Fungsi Sensor Huruf Presisi (Sinkron tanpa kelebihan spasi/karakter)
function formatSensorWord(word, hints = 0) {
    const cleanWord = word.trim().replace(/\s+/g, ' ');
    const parts = cleanWord.split(' ');
    let hintRemaining = hints;

    const maskedParts = parts.map(part => {
        return part.split('').map(char => {
            if (hintRemaining > 0) {
                hintRemaining--;
                return char.toUpperCase();
            }
            return '_';
        }).join(' ');
    });

    return maskedParts.join('   ');
}

// Struktur Tampilan Pesan Game Sesuai Permintaan
function renderGameText(session, statusNote = '') {
    const isGameOver = session.salah >= session.maxSalah;
    const isCompleted = session.terjawab.every(v => v === true);

    let blocks = [];

    // 1. Basa-basi pembuka
    if (session.greeting) {
        blocks.push(session.greeting);
    }

    // 2. Judul dengan simbol
    const title = (isGameOver || isCompleted)
        ? '╰› ᯓ *GAME FAMILY 100 — SELESAI* ˎˊ˗'
        : '╰› ᯓ *GAME FAMILY 100* ˎˊ˗';
    blocks.push(title);

    // 3. Isi konten (Pertanyaan & Papan Jawaban)
    let content = `• *Pertanyaan :* ${session.soal}\n\n• *Papan Jawaban :*\n`;

    for (let i = 0; i < session.jawaban.length; i++) {
        const num = i + 1;
        if (session.terjawab[i]) {
            content += `  ${num}. ${session.jawaban[i].toUpperCase()}\n`;
        } else if (isGameOver) {
            content += `  ${num}. ${session.jawaban[i].toUpperCase()} *(Kunci)*\n`;
        } else {
            const masked = formatSensorWord(session.jawaban[i], session.hints[i] || 0);
            content += `  ${num}. \`${masked}\`\n`;
        }
    }

    // Daftar Penjawab di bawah (hanya nama, tanpa tag ID alay)
    const answeredEntries = session.jawaban
        .map((jwb, idx) => ({ idx, jwb, data: session.penjawab[idx] }))
        .filter(item => session.terjawab[item.idx] && item.data);

    if (answeredEntries.length > 0) {
        content += `\n• *Penjawab :*\n`;
        for (let item of answeredEntries) {
            content += `  - Kata nomor ${item.idx + 1} : *${item.data.name}* (+10 Poin)\n`;
        }
    }

    const sisa = Math.max(0, session.maxSalah - session.salah);
    content += `\n• *Sisa Kesempatan :* ${sisa} kali salah`;

    if (statusNote) {
        content += `\n\n${statusNote}`;
    }

    blocks.push(content);

    // 4. Instruksi reply / footer
    let footer = '';
    if (isCompleted) {
        footer = `_Semua jawaban berhasil ditebak! Ketik \`.family100\` untuk bermain ronde berikutnya._`;
    } else if (isGameOver) {
        footer = `_Permainan berakhir. Ketik \`.family100\` untuk memulai ronde baru._`;
    } else {
        footer = `_Balas pesan ini langsung dengan jawabanmu._\n_Ketik *clue* jika butuh bantuan huruf (-3 poin)._`;
    }
    blocks.push(footer);

    return blocks.join('\n\n');
}

export default {
    command: ['family100', 'f100', 'nyerahf100'],
    category: 'games',
    description: 'Game Family 100 interaktif live edit dan database JSON',

    run: async (m, { conn, command, usedPrefix, isOwner, isAdmin }) => {
        const pfx = usedPrefix || m.prefix || '.';
        const cmd = command.toLowerCase();

        // Fitur Menyerah
        if (cmd === 'nyerahf100') {
            const session = getSession(m.chat);
            if (!session) {
                return await m.reply('Tidak ada sesi Family 100 yang sedang berjalan di chat ini.');
            }

            session.salah = session.maxSalah;
            const finalBoard = renderGameText(session, 'Permainan dihentikan karena pemain menyerah.');

            try {
                if (session.key) {
                    await conn.sendMessage(m.chat, { text: finalBoard, edit: session.key });
                }
            } catch {}

            deleteSession(m.chat);
            return;
        }

        // Hapus data sesi lama dan inisialisasi sesi baru
        deleteSession(m.chat);

        const pushName = m.pushName || 'User';
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

        const sessionData = getRandomSoal();
        sessionData.greeting = greeting;

        const initialText = renderGameText(sessionData);

        // Menggunakan m.reply agar otomatis menggunakan FakeReply Meta AI dari handler.js
        const sent = await m.reply(initialText);

        sessionData.key = {
            remoteJid: m.chat,
            fromMe: true,
            id: sent?.key?.id || sent?.id
        };

        saveSession(m.chat, sessionData);
    },

    // Listener Jawaban Masuk
    before: async (m, { conn }) => {
        if (!m.text || m.isBaileys) return;
        if (/^[.!#/\\]/.test(m.text.trim())) return;

        const session = getSession(m.chat);
        if (!session || !session.key) return;

        // Validasi Reply Pesan Game (Super fleksibel agar selalu merespon saat di-reply)
        const isRepliedToBot = m.quoted && m.quoted.fromMe;
        const quotedText = (m.quoted?.text || m.quoted?.body || m.quoted?.caption || '').toLowerCase();
        const isGameContext = quotedText.includes('family 100') || quotedText.includes('papan jawaban') || quotedText.includes('sisa kesempatan');

        if (m.isGroup && !isRepliedToBot && !isGameContext) return;

        const textInput = m.text.toLowerCase().trim();
        const playerName = m.pushName || 'Pemain';

        // 1. FITUR CLUE (-3 Poin)
        if (textInput === 'clue' || textInput === 'bantuan') {
            const targetIdx = session.terjawab.findIndex(v => !v);
            if (targetIdx === -1) return;

            const cleanLetters = session.jawaban[targetIdx].replace(/\s+/g, '');
            const maxLetters = cleanLetters.length;

            if ((session.hints[targetIdx] || 0) >= maxLetters - 1) return;

            session.hints[targetIdx] = (session.hints[targetIdx] || 0) + 1;
            updateScore(m.sender, -3);

            const statusNote = `*${playerName}* meminta petunjuk huruf untuk kata nomor ${targetIdx + 1} (-3 Poin).`;
            const updatedText = renderGameText(session, statusNote);

            saveSession(m.chat, session);

            try {
                await conn.sendMessage(m.chat, { text: updatedText, edit: session.key });
            } catch (e) {
                console.error('[Family100 Edit Error]:', e);
            }
            return;
        }

        // 2. ABAIKAN KATA YANG SUDAH PERNAH DITEBAK
        const alreadyAnswered = session.jawaban.findIndex((jwb, i) => {
            return session.terjawab[i] && (jwb === textInput || (textInput.length >= 3 && jwb.split(' ').includes(textInput)));
        });

        if (alreadyAnswered !== -1) return;

        // 3. CEK TEBAKAN BENAR
        const foundIndex = session.jawaban.findIndex((jwb, i) => {
            if (session.terjawab[i]) return false;
            if (jwb === textInput) return true;
            if (textInput.length >= 3 && jwb.split(' ').includes(textInput)) return true;
            return false;
        });

        if (foundIndex !== -1) {
            session.terjawab[foundIndex] = true;
            session.penjawab[foundIndex] = { name: playerName, jid: m.sender };

            updateScore(m.sender, 10);
            const isAllCompleted = session.terjawab.every(v => v === true);

            const statusNote = isAllCompleted
                ? `*${playerName}* berhasil melengkapi jawaban terakhir (*${session.jawaban[foundIndex].toUpperCase()}*)! (+10 Poin)`
                : `*${playerName}* berhasil menebak kata nomor ${foundIndex + 1} (*${session.jawaban[foundIndex].toUpperCase()}*)! (+10 Poin)`;

            const updatedText = renderGameText(session, statusNote);

            try {
                await conn.sendMessage(m.chat, { text: updatedText, edit: session.key });
            } catch (e) {
                console.error('[Family100 Edit Error]:', e);
            }

            if (isAllCompleted) {
                deleteSession(m.chat);
            } else {
                saveSession(m.chat, session);
            }
            return;
        }

        // 4. TEBAKAN SALAH
        session.salah += 1;
        const isGameOver = session.salah >= session.maxSalah;

        const statusNote = isGameOver
            ? `Tebakan *"${textInput.toUpperCase()}"* salah! Kesempatan telah habis. Kunci jawaban telah dibuka.`
            : `Tebakan *"${textInput.toUpperCase()}"* belum tepat.`;

        const updatedText = renderGameText(session, statusNote);

        try {
            await conn.sendMessage(m.chat, { text: updatedText, edit: session.key });
        } catch (e) {
            console.error('[Family100 Edit Error]:', e);
        }

        if (isGameOver) {
            deleteSession(m.chat);
        } else {
            saveSession(m.chat, session);
        }
    }
};