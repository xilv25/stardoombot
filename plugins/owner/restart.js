import fs from 'fs';
import path from 'path';

export default {
    command: ['restart', 'reboot'],
    category: 'owner',
    description: 'Merestart sistem bot dan melaporkan status kembali ke grup asal',
    run: async (m, { conn, isOwner, pushName }) => {
        if (!isOwner) return;

        if (!m.isGroup) {
            return m.reply(`Perintah restart hanya dapat dijalankan di dalam grup obrolan.`);
        }

        const symPath = path.resolve(process.cwd(), 'lib/global-symbol.js');
        const { sym } = await import(`file://${symPath}`);

        let greet;
        try {
            const greetPath = path.resolve(process.cwd(), 'lib/engine/greet-engine.js');
            const { getGreeting } = await import(`file://${greetPath}`);
            greet = getGreeting(m, { isOwner: true });
        } catch {
            const hour = parseInt(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: '2-digit', hour12: false }), 10);
            const time = (hour >= 4 && hour < 11) ? 'pagi' : (hour >= 11 && hour < 15) ? 'siang' : (hour >= 15 && hour < 18) ? 'sore' : 'malam';
            greet = { prefix: `Selamat ${time} tuan muda *${m.pushName || 'Master'}*,` };
        }

        let msg = `${greet.prefix} siklus muat ulang sistem bot telah dimulai.\n\n`;
        msg += `${sym.arrowCurve} ${sym.swoosh} *SYSTEM RUNTIME* ${sym.sparkle}\n\n`;
        msg += `*Status Siklus :*\n\n`;
        msg += `• Proses : Menghentikan Soket & Tugas Latar\n`;
        msg += `• Alokasi : Membersihkan Cache Memori Sementara\n`;
        msg += `• Target : Bootloader Baru Sedang Dipicu\n\n`;
        msg += `Koneksi akan segera tersambung kembali dalam beberapa saat, Tuan Muda.`;

        await m.reply(msg);

        // Fakereply untuk pesan shutdown (tanpa watermark)
        const fakeReply = {
            key: { fromMe: false, participant: '13135550002@s.whatsapp.net', remoteJid: 'status@broadcast' },
            message: { contactMessage: { displayName: pushName || 'Master', vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${pushName || 'Master'}\nitem1.TEL;waid=13135550002:13135550002\nitem1.X-ABLabel:Ponsel\nEND:VCARD` } }
        };

        let shutdownMsg = `${sym.arrowCurve} ${sym.swoosh} *SYSTEM SHUTDOWN* ${sym.sparkle}\n\n`;
        shutdownMsg += `Proses penghentian server sedang berlangsung. Seluruh koneksi sementara diputus.`;

        await conn.sendMessage(m.chat, { text: shutdownMsg }, { quoted: fakeReply }).catch(() => {});

        // Simpan data sesi ke database/restart.json termasuk pushName
        const restartSessionPath = path.resolve(process.cwd(), 'database', 'restart.json');
        try {
            const sessionData = {
                chatId: m.chat,
                sender: m.sender,
                pushName: pushName || 'Master',
                timestamp: Date.now()
            };
            fs.writeFileSync(restartSessionPath, JSON.stringify(sessionData, null, 2), 'utf-8');
        } catch (err) {
            console.error('[Restart Session Error]:', err);
        }

        setTimeout(() => {
            process.exit(0);
        }, 1000);
    }
};