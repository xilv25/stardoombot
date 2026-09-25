import fs from 'fs';
import path from 'path';

export default {
    command: ['tescvr'],
    category: 'tools',
    description: '> Testing manipulasi cover dan tautan Saluran WA.',
    
    run: async (m, { conn }) => {
        // 1. PESAN PELACAK: Jika pesan ini muncul, berarti command terbaca dengan baik!
        await m.reply('*[+] MEMPROSES*\n\nSedang membaca gambar dan merakit cover saluran...');

        const coverPath = path.resolve(process.cwd(), 'src/image/cover.jpg');
        
        if (!fs.existsSync(coverPath)) {
            return m.reply('*[-] SYSTEM ERROR*\n\nFile gambar tidak ditemukan di `src/image/cover.jpg`.');
        }

        // 2. CEK UKURAN FILE (Mencegah Silent Drop)
        const stat = fs.statSync(coverPath);
        const fileSizeInMB = stat.size / (1024 * 1024);
        
        if (fileSizeInMB > 0.5) {
            // Peringatan jika file lebih dari 500 KB (Rawan gagal terkirim)
            await m.reply(`*[-] PERINGATAN UKURAN*\n\nUkuran file cover.jpg kamu adalah ${fileSizeInMB.toFixed(2)} MB. WhatsApp biasanya me-reject cover (externalAdReply) yang lebih besar dari 300 KB. Jika setelah ini pesan cover tidak muncul, kompres/kecilkan dulu ukuran cover.jpg kamu!`);
        }

        const coverBuffer = fs.readFileSync(coverPath);
        const channelLink = 'https://whatsapp.com/channel/0029Vb7Y84OLSmbaaAlKY70L';

        let msg = `*[+] MANIPULASI SALURAN*\n\n`;
        msg += `Pesan ini menggunakan injeksi Context Info untuk memuat gambar dari penyimpanan lokal.\n\n`;
        msg += `Coba klik gambar di bawah ini, Anda akan diarahkan ke saluran WhatsApp StarDoom.`;

        try {
            await conn.sendMessage(m.chat, {
                text: msg,
                contextInfo: {
                    isForwarded: true,
                    forwardingScore: 999,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: '120363293817123456@newsletter', 
                        newsletterName: 'StarDoom Universe', 
                        serverMessageId: -1
                    },
                    externalAdReply: {
                        title: 'Klik untuk Bergabung ke Saluran',
                        body: 'Official Channel of StarDoom Universe',
                        thumbnail: coverBuffer, 
                        sourceUrl: channelLink, 
                        mediaType: 1,
                        renderLargerThumbnail: true 
                    }
                }
            }, { quoted: m });

        } catch (err) {
            console.error('[TESCVR CMD ERROR]', err);
            return m.reply('*[-] GAGAL*\n\nTerjadi kesalahan saat memanipulasi Context Info pesan.');
        }
    }
};