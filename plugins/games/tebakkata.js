import fs from 'fs';
import path from 'path';

// Konfigurasi Database Skor Persisten
const dbDir = path.resolve('./database/skor');
const dbFile = path.join(dbDir, 'tebakkata.json');

function getScoreData() {
    if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
    if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify({}, null, 2));
    try {
        return JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
    } catch {
        return {};
    }
}

function updateScore(senderJid, points) {
    const data = getScoreData();
    data[senderJid] = (data[senderJid] || 0) + points;
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
    return data[senderJid];
}

function getUserScore(senderJid) {
    const data = getScoreData();
    return data[senderJid] || 0;
}

// Bank Soal Tebak Kata
const daftarSoal = [
    { soal: 'Hewan pemakan rumput yang memiliki leher sangat panjang', jawaban: 'jerapah', clue: 'J _ R _ P _ H' },
    { soal: 'Benda langit yang memancarkan cahayanya sendiri pada malam hari', jawaban: 'bintang', clue: 'B _ N T _ N G' },
    { soal: 'Alat navigasi untuk menentukan arah mata angin', jawaban: 'kompas', clue: 'K _ M P _ S' },
    { soal: 'Tempat menyimpan buku-buku untuk dibaca atau dipinjam', jawaban: 'perpustakaan', clue: 'P _ R P _ S T _ K _ _ N' },
    { soal: 'Gas yang dihirup manusia saat bernapas untuk bertahan hidup', jawaban: 'oksigen', clue: 'O K S _ G _ N' },
    { soal: 'Negara yang terkenal dengan kincir angin dan bunga tulip', jawaban: 'belanda', clue: 'B _ L _ N D _' },
    { soal: 'Benda berkaki empat yang tidak bisa berjalan dan digunakan untuk duduk', jawaban: 'kursi', clue: 'K _ R S _' },
    { soal: 'Alat optik untuk melihat benda-benda renik atau mikroorganisme', jawaban: 'mikroskop', clue: 'M _ K R _ S K _ P' },
    { soal: 'Mamalia terbesar di bumi yang hidup di dalam lautan', jawaban: 'paus', clue: 'P _ _ S' },
    { soal: 'Cairan yang mengalir di dalam tubuh untuk mengangkut nutrisi dan oksigen', jawaban: 'darah', clue: 'D _ R _ H' },
    { soal: 'Ibu kota negara Jepang', jawaban: 'tokyo', clue: 'T _ K Y _' },
    { soal: 'Alat tulis yang tintanya bisa dihapus menggunakan setip karet', jawaban: 'pensil', clue: 'P _ N S _ L' }
];

function getRandomSoal() {
    return daftarSoal[Math.floor(Math.random() * daftarSoal.length)];
}

export default {
    command: ['tebakkata', 'tebak', 'nyerah'],
    category: 'games',
    description: 'Tebak kata 1x kesempatan per soal tanpa batas waktu',

    run: async (m, { conn, command, usedPrefix }) => {
        conn.tebakkata = conn.tebakkata || {};
        const pfx = usedPrefix || m.prefix || '.';
        const cmd = command.toLowerCase();

        // Fitur Menyerah jika pemain buntu
        if (cmd === 'nyerah') {
            if (!conn.tebakkata[m.chat]) {
                return await m.reply('Tidak ada sesi permainan Tebak Kata yang sedang aktif di chat ini.');
            }
            const jawabanBenar = conn.tebakkata[m.chat].jawaban;
            delete conn.tebakkata[m.chat];

            let textNyerah = `╰› ᯓ *KAMU MENYERAH* ˎˊ˗\n\n`;
            textNyerah += `• *Kunci Jawaban :* ${jawabanBenar.toUpperCase()}\n\n`;
            textNyerah += `Sesi permainan dihentikan. Ketik \`${pfx}tebakkata\` untuk bermain kembali.`;
            return await m.reply(textNyerah);
        }

        // Cek jika sesi sudah ada
        if (conn.tebakkata[m.chat]) {
            const current = conn.tebakkata[m.chat];
            let infoText = `╰› ᯓ *GAME SEDANG BERJALAN* ˎˊ˗\n\n`;
            infoText += `• *Pertanyaan :* ${current.soal}\n`;
            infoText += `• *Petunjuk :* \`${current.clue}\`\n`;
            infoText += `• *Kesempatan :* 1 kali jawab\n\n`;
            infoText += `Balas (*reply*) pesan pertanyaan di atas dengan jawabanmu!`;
            return await m.reply(infoText);
        }

        // Buat soal pertama
        const item = getRandomSoal();
        conn.tebakkata[m.chat] = {
            soal: item.soal,
            jawaban: item.jawaban.toLowerCase().trim(),
            clue: item.clue,
            poin: 10
        };

        let msgText = `╰› ᯓ *GAME TEBAK KATA* ˎˊ˗\n\n`;
        msgText += `• *Pertanyaan :* ${item.soal}\n`;
        msgText += `• *Petunjuk :* \`${item.clue}\`\n`;
        msgText += `• *Aturan :* Kesempatan menjawab hanya 1 kali!\n\n`;
        msgText += `_Balas (reply) pesan ini langsung dengan jawabanmu._`;

        const sent = await m.reply(msgText);
        conn.tebakkata[m.chat].msgId = sent?.key?.id;
    },

    // Listener pengecekan jawaban (1 kali kesempatan per soal)
    before: async (m, { conn }) => {
        conn.tebakkata = conn.tebakkata || {};
        if (!conn.tebakkata[m.chat] || m.isBaileys || !m.text) return;

        // Abaikan command awalan bot
        if (m.prefix || /^[.!#/\\]/.test(m.text)) return;

        const session = conn.tebakkata[m.chat];
        const isQuoted = m.quoted && (m.quoted.id === session.msgId || (m.quoted.fromMe && /TEBAK KATA|SOAL BERIKUTNYA/i.test(m.quoted.text || '')));
        const isPC = !m.isGroup;

        // Di grup, pemain WAJIB me-reply pesan soal agar obrolan biasa tidak dianggap tebakan salah
        if (!isQuoted && !isPC) return;

        const senderJid = m.sender;
        const userAnswer = m.text.toLowerCase().trim();
        const isCorrect = userAnswer === session.jawaban;

        if (isCorrect) {
            // KONDISI BENAR: Tambah poin ke database
            const totalSkor = updateScore(senderJid, session.poin);

            let winText = `╰› ᯓ *TEBAKAN TEPAT!* ˎˊ˗\n\n`;
            winText += `Selamat @${senderJid.split('@')[0]}, tebakan kamu tepat!\n`;
            winText += `• *Jawaban :* ${session.jawaban.toUpperCase()}\n`;
            winText += `• *Skor Diperoleh :* +${session.poin} Poin\n`;
            winText += `• *Total Skor Kamu :* ${totalSkor} Poin\n\n`;
            winText += `_Menyiapkan pertanyaan berikutnya..._`;

            await m.reply(winText, m.chat, { mentions: [senderJid] });
        } else {
            // KONDISI SALAH: Dapat skor 0, kesempatan hangus
            const currentSkor = getUserScore(senderJid);

            let loseText = `╰› ᯓ *TEBAKAN SALAH!* ˎˊ˗\n\n`;
            loseText += `Sayang sekali @${senderJid.split('@')[0]}, jawaban kamu salah!\n`;
            loseText += `• *Jawabanmu :* ${userAnswer}\n`;
            loseText += `• *Kunci Jawaban :* ${session.jawaban.toUpperCase()}\n`;
            loseText += `• *Skor Diperoleh :* 0 Poin\n`;
            loseText += `• *Total Skor Kamu :* ${currentSkor} Poin\n\n`;
            loseText += `_Kesempatan habis! Menyiapkan pertanyaan berikutnya..._`;

            await m.reply(loseText, m.chat, { mentions: [senderJid] });
        }

        // Langsung siapkan soal berikutnya (baik tebakan benar maupun salah)
        const nextItem = getRandomSoal();
        conn.tebakkata[m.chat] = {
            soal: nextItem.soal,
            jawaban: nextItem.jawaban.toLowerCase().trim(),
            clue: nextItem.clue,
            poin: 10
        };

        let nextText = `╰› ᯓ *SOAL BERIKUTNYA* ˎˊ˗\n\n`;
        nextText += `• *Pertanyaan :* ${nextItem.soal}\n`;
        nextText += `• *Petunjuk :* \`${nextItem.clue}\`\n`;
        nextText += `• *Aturan :* Kesempatan menjawab hanya 1 kali!\n\n`;
        nextText += `_Balas (reply) pesan ini langsung dengan jawabanmu._`;

        const nextSent = await conn.sendMessage(m.chat, { text: nextText }, { quoted: m });
        conn.tebakkata[m.chat].msgId = nextSent?.key?.id;
    }
};