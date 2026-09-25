import fs from 'fs';
import path from 'path';

const SAMBUNG_DIR = path.join(process.cwd(), 'database', 'sambungkata');
if (!fs.existsSync(SAMBUNG_DIR)) {
    fs.mkdirSync(SAMBUNG_DIR, { recursive: true });
}

function getDbPath(chatId) {
    const safeName = chatId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(SAMBUNG_DIR, `${safeName}.json`);
}

function loadSession(chatId) {
    const p = getDbPath(chatId);
    if (!fs.existsSync(p)) return null;
    try {
        return JSON.parse(fs.readFileSync(p, 'utf-8'));
    } catch {
        return null;
    }
}

function saveSession(chatId, data) {
    const p = getDbPath(chatId);
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function deleteSession(chatId) {
    const p = getDbPath(chatId);
    if (fs.existsSync(p)) {
        fs.unlinkSync(p);
    }
}

const wordsDict = {
    a: ['apel', 'anak', 'api', 'alam', 'angsa', 'arah', 'asap', 'ayah', 'akal', 'air'],
    b: ['buku', 'bunga', 'bola', 'bulan', 'batu', 'baju', 'besi', 'biru', 'bebek', 'bata'],
    c: ['cacing', 'cinta', 'cangkir', 'cabai', 'cicak', 'cermin', 'cepat', 'cahaya', 'catur'],
    d: ['daun', 'daging', 'desa', 'domba', 'dunia', 'duri', 'darah', 'dana', 'dada'],
    e: ['elang', 'emas', 'embun', 'enam', 'energi', 'esok', 'ekor', 'ember'],
    f: ['fajar', 'foto', 'fikir', 'film', 'faedah', 'fitrah', 'fisik', 'fakta'],
    g: ['gigi', 'gajah', 'garam', 'gelap', 'guru', 'gedung', 'gelas', 'gaya', 'gula'],
    h: ['hari', 'hutan', 'hujan', 'hati', 'hijau', 'hewan', 'harga', 'harta', 'hiu', 'hotel'],
    i: ['ikan', 'itik', 'ibu', 'ilmu', 'intan', 'istana', 'ijazah'],
    j: ['jalan', 'jeruk', 'jamur', 'jarum', 'jendela', 'jerapah', 'jaring', 'jantung'],
    k: ['kucing', 'kuda', 'kayu', 'kapal', 'kertas', 'kotak', 'kunci', 'kipas', 'kolam'],
    l: ['lampu', 'langit', 'laut', 'lidah', 'lilin', 'lorong', 'lengan', 'lomba', 'laba'],
    m: ['makan', 'mata', 'madu', 'meja', 'mobil', 'malam', 'macan', 'manggis', 'mawar'],
    n: ['nasi', 'nangka', 'nilai', 'nyamuk', 'nadi', 'nampan', 'napas', 'nenek', 'nomor'],
    o: ['obat', 'ombak', 'otak', 'ongkos', 'oranye', 'oleh', 'opor', 'otot', 'oktaf'],
    p: ['pohon', 'paku', 'pintu', 'pisau', 'paus', 'pasar', 'padi', 'piring', 'payung'],
    q: ['qurani', 'qari', 'qashar'],
    r: ['rumah', 'roti', 'rambut', 'racun', 'ranting', 'rupa', 'raja', 'rusa', 'roda'],
    s: ['susu', 'sate', 'sawah', 'sendok', 'sepatu', 'sungai', 'sabun', 'sikat', 'suara'],
    t: ['tali', 'tahu', 'tanah', 'tikus', 'taman', 'telinga', 'topi', 'tinta', 'tulang'],
    u: ['ular', 'uang', 'ubi', 'udang', 'utama', 'ujung', 'uban', 'ukir', 'umpan'],
    v: ['vandel', 'vila', 'visi', 'voli', 'vaksin', 'vena'],
    w: ['wajan', 'waktu', 'warga', 'warna', 'wilayah', 'wajah', 'warta', 'wasiat'],
    y: ['yoyo', 'yodium', 'yakin', 'yard'],
    z: ['zaitun', 'zebra', 'zaman', 'zakat', 'zona']
};

const allStarterWords = [
    'rumah', 'makan', 'buku', 'jalan', 'pohon', 'kucing', 'mobil', 'awan',
    'bunga', 'cinta', 'daun', 'emas', 'fajar', 'gigi', 'hutan', 'ikan',
    'jarum', 'kapal', 'lampu', 'mata', 'nasi', 'ombak', 'paku', 'roti',
    'susu', 'tali', 'ular', 'waktu', 'zebra'
];

function extractParticipants(m) {
    const participants = [m.sender];
    if (m.mentionedJid && m.mentionedJid.length > 0) {
        for (const jid of m.mentionedJid) {
            if (!participants.includes(jid)) participants.push(jid);
        }
    }
    const contextInfo = m.message?.extendedTextMessage?.contextInfo || m.msg?.contextInfo;
    if (contextInfo) {
        if (contextInfo.mentionedJid && contextInfo.mentionedJid.length > 0) {
            for (const jid of contextInfo.mentionedJid) {
                if (!participants.includes(jid)) participants.push(jid);
            }
        }
        if (contextInfo.participant && !participants.includes(contextInfo.participant)) {
            participants.push(contextInfo.participant);
        }
    }
    if (m.quoted) {
        const qSender = m.quoted.sender || m.quoted.participant || m.quoted.key?.participant;
        if (qSender && !participants.includes(qSender)) {
            participants.push(qSender);
        }
    }
    return participants;
}

export default {
    command: ['sambungkata', 'skregis'],
    category: 'game',
    description: 'Permainan sambung kata beregu dengan sistem registrasi peserta',

    before: async (m, { conn }) => {
        if (!m.chat || !m.text) return false;

        const chatId = m.chat;
        const session = loadSession(chatId);
        if (!session) return false;

        // Wajib mereply pesan terakhir dari bot
        if (session.lastBotMessageId) {
            const quotedMessageId = m.message?.extendedTextMessage?.contextInfo?.stanzaId || m.msg?.contextInfo?.stanzaId;
            if (!quotedMessageId || quotedMessageId !== session.lastBotMessageId) {
                return false;
            }
        }

        // Hanya merespons peserta terdaftar
        if (!session.participants.includes(m.sender)) {
            return false;
        }

        const text = m.text.trim().toLowerCase();

        if (text === 'stop') {
            deleteSession(chatId);
            await m.reply(
                `╰› ᯓ *SAMBUNG KATA STOPPED* ˎˊ˗\n\n` +
                `• *Status :* Permainan dihentikan\n` +
                `• *Keterangan :* Data sesi grup telah dihapus dari database.`
            );
            return true;
        }

        const currentTurnUser = session.participants[session.turnIndex];
        if (m.sender !== currentTurnUser) {
            await m.reply(
                `╰› ᯓ *SAMBUNG KATA WARNING* ˎˊ˗\n\n` +
                `• *Status :* Bukan giliran Anda\n` +
                `• *Giliran :* @${currentTurnUser.split('@')[0]}`,
                null,
                { mentions: [currentTurnUser] }
            );
            return true;
        }

        if (text.includes(' ') || text.length < 2) return false;

        const firstLetter = text.charAt(0);
        if (firstLetter !== session.requiredLetter) {
            await m.reply(
                `╰› ᯓ *SAMBUNG KATA WARNING* ˎˊ˗\n\n` +
                `• *Status :* Huruf tidak sesuai\n` +
                `• *Ketentuan :* Kata harus berawal dari huruf *${session.requiredLetter.toUpperCase()}*`
            );
            return true;
        }

        session.lastWord = text;
        session.requiredLetter = text.slice(-1);
        session.turnIndex++;

        // Jika giliran seluruh manusia selesai, bot membalas kata peserta terakhir, lalu melempar giliran kembali ke peserta pertama
        if (session.turnIndex >= session.participants.length) {
            session.turnIndex = 0;

            const possibleWords = wordsDict[session.requiredLetter] || ['buku', 'kayu', 'jalan', 'nasi'];
            const botWord = possibleWords[Math.floor(Math.random() * possibleWords.length)];
            session.requiredLetter = botWord.slice(-1);
            session.lastWord = botWord;

            const nextUser = session.participants[session.turnIndex];
            const sentMsg = await conn.sendMessage(chatId, {
                text: `${botWord}\n\nGiliran @${nextUser.split('@')[0]}, huruf wajib: *${session.requiredLetter.toUpperCase()}*`,
                mentions: [nextUser]
            });

            session.lastBotMessageId = sentMsg.key.id;
            saveSession(chatId, session);
            return true;
        } else {
            // Lanjut ke peserta berikutnya (misal dari kamu ke temanmu)
            const nextUser = session.participants[session.turnIndex];
            const sentMsg = await conn.sendMessage(chatId, {
                text: `Kata diterima: *${text}*\n\nGiliran @${nextUser.split('@')[0]}, huruf wajib: *${session.requiredLetter.toUpperCase()}*`,
                mentions: [nextUser]
            });

            session.lastBotMessageId = sentMsg.key.id;
            saveSession(chatId, session);
            return true;
        }
    },

    run: async (m, { conn, text, command }) => {
        const chatId = m.chat;

        if (command === 'sambungkata') {
            return m.reply(
                `╰› ᯓ *SAMBUNG KATA GUIDE* ˎˊ˗\n\n` +
                `Permainan kata bergiliran antar peserta terdaftar dengan keharusan membalas pesan bot.\n\n` +
                `*Daftar Perintah :*\n` +
                `• \`.skregis @member\` : Mendaftarkan peserta permainan di grup.\n` +
                `• \`stop\` : Balas pesan bot dengan kata stop untuk mengakhiri permainan.\n\n` +
                `*Aturan Main :*\n` +
                `1. Bot hanya merespons peserta terdaftar yang melakukan reply pesan bot.\n` +
                `2. Urutan giliran: Bot -> Kamu -> Teman -> Bot mendeteksi kata temanmu lalu membalas -> kembali ke Kamu -> dan seterusnya.\n` +
                `3. Pesan di luar peserta terdaftar atau tanpa reply akan diabaikan.`
            );
        }

        if (command === 'skregis') {
            if (!m.isGroup) {
                return m.reply('Fitur registrasi peserta hanya dapat digunakan di dalam grup.');
            }

            if (loadSession(chatId)) {
                return m.reply('Permainan sambung kata sedang aktif di grup ini. Ketik "stop" pada balasan untuk mengakhiri sesi.');
            }

            const participants = extractParticipants(m);

            if (participants.length < 2) {
                return m.reply('Minimal harus mendaftarkan 1 peserta lain dengan cara tag.\nContoh: .skregis @teman');
            }

            const initialWord = allStarterWords[Math.floor(Math.random() * allStarterWords.length)];
            const requiredLetter = initialWord.slice(-1);

            const sessionData = {
                participants: participants,
                turnIndex: 0,
                requiredLetter: requiredLetter,
                lastWord: initialWord,
                lastBotMessageId: null
            };

            saveSession(chatId, sessionData);

            const mentionsList = participants.map(p => `@${p.split('@')[0]}`).join(', ');
            
            await m.reply(
                `╰› ᯓ *SAMBUNG KATA STARTED* ˎˊ˗\n\n` +
                `• *Peserta Terdaftar :* ${mentionsList}\n` +
                `• *Kata Awal (Bot) :* *${initialWord}*\n` +
                `• *Giliran Pertama :* @${participants[0].split('@')[0]}\n` +
                `• *Huruf Wajib :* *${requiredLetter.toUpperCase()}*\n\n` +
                `Balas (reply) pesan ini dengan satu kata yang berawal dari huruf *${requiredLetter.toUpperCase()}* untuk mulai!`,
                null,
                { mentions: participants }
            );
        }
    }
};