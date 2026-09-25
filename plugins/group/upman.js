import fs from 'fs';
import path from 'path';

export default {
    command: ['upman', 'update-manhwa'],
    category: 'group',
    description: 'Mengaktifkan atau menonaktifkan otomatis update manhwa Shinigami di grup',
    run: async (m, { conn, args, isOwner }) => {
        // 1. Dynamic Import Simbol dan Greet Engine
        const symPath = path.resolve(process.cwd(), 'lib/global-symbol.js');
        const { sym } = await import(`file://${symPath}`);

        let greet;
        try {
            const greetPath = path.resolve(process.cwd(), 'lib/engine/greet-engine.js');
            const { getGreeting } = await import(`file://${greetPath}`);
            greet = getGreeting(m, { isOwner });
        } catch {
            const hour = parseInt(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: '2-digit', hour12: false }), 10);
            const time = (hour >= 4 && hour < 11) ? 'pagi' : (hour >= 11 && hour < 15) ? 'siang' : (hour >= 15 && hour < 18) ? 'sore' : 'malam';
            greet = { prefix: isOwner ? `Selamat ${time} tuan muda *${m.pushName || 'Master'}*,` : `Halo Anda,` };
        }

        // Validasi akses grup dan admin lokal via users.json atau argumen handler utama
        if (!m.isGroup && !isOwner) {
            let msg = `${greet.prefix} perintah ini tidak dapat dieksekusi di luar ruang obrolan grup.\n\n`;
            msg += `${sym.arrowCurve} ${sym.swoosh} *ACCESS DENIED* ${sym.sparkle}\n\n`;
            msg += `*Rincian Akses :*\n\n`;
            msg += `• Lokasi : Private Chat\n`;
            msg += `• Batasan : Khusus Dimensi Grup\n\n`;
            msg += `Pindahkan interaksi ke dalam grup untuk menggunakan konfigurasi ini.\n\n`;
            msg += `${sym.sword} ©Nameless StarDoom`;
            return m.reply(msg);
        }

        // Cek admin dengan aman (mendukung bypass owner)
        let isAdminLocal = false;
        if (!isOwner) {
            try {
                const usersPath = path.resolve(process.cwd(), 'database', 'users.json');
                if (fs.existsSync(usersPath)) {
                    const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
                    const cleanSender = m.sender.replace(/[^0-9]/g, '');
                    const user = users.find(u => (u.jid === m.sender || u.number === cleanSender) && u.lastGroup === m.chat);
                    isAdminLocal = user ? Boolean(user.isAdmin) : false;
                }
            } catch {
                isAdminLocal = false;
            }

            if (!isAdminLocal) {
                let msg = `${greet.prefix} maaf, hak akses Anda tidak mencukupi untuk mengubah konfigurasi ini.\n\n`;
                msg += `${sym.arrowCurve} ${sym.swoosh} *ACCESS DENIED* ${sym.sparkle}\n\n`;
                msg += `*Rincian Pembatasan :*\n\n`;
                msg += `• Hak Akses : Member Biasa\n`;
                msg += `• Diperlukan : Status Admin Grup\n\n`;
                msg += `Silakan hubungi pengurus grup untuk melakukan pengaturan sistem.\n\n`;
                msg += `${sym.sword} ©Nameless StarDoom`;
                return m.reply(msg);
            }
        }

        const action = args[0]?.toLowerCase(); // 'on' atau 'off'
        const targetInput = args[1]; // Tautan grup opsional (khusus owner)

        if (!['on', 'off'].includes(action)) {
            let msg = `${greet.prefix} parameter status untuk update manhwa belum ditentukan dengan benar.\n\n`;
            msg += `${sym.arrowCurve} ${sym.swoosh} *MANHWA CONFIG* ${sym.sparkle}\n\n`;
            msg += `*Panduan Penggunaan :*\n\n`;
            msg += `• \`.upman on\` : Mengaktifkan notifikasi otomatis\n`;
            msg += `• \`.upman off\` : Menonaktifkan notifikasi otomatis\n\n`;
            msg += `Gunakan parameter di atas untuk mengatur sirkulasi pembaruan pada grup.\n\n`;
            msg += `${sym.sword} ©Nameless StarDoom`;
            return m.reply(msg);
        }

        let targetGroupJid = m.chat;

        if (targetInput && isOwner) {
            if (targetInput.includes('chat.whatsapp.com/')) {
                try {
                    const inviteCode = targetInput.split('chat.whatsapp.com/')[1].split(' ')[0];
                    const groupMeta = await conn.groupGetInviteInfo(inviteCode);
                    targetGroupJid = groupMeta.id;
                } catch {
                    let errNotice = `${greet.prefix} sistem gagal membaca tautan undangan grup WhatsApp yang Anda berikan.\n\n`;
                    errNotice += `${sym.arrowCurve} ${sym.swoosh} *SYSTEM ERROR* ${sym.sparkle}\n\n`;
                    errNotice += `• Penyebab : Tautan Tidak Valid atau Kedaluwarsa\n\n`;
                    errNotice += `Pastikan tautan undangan grup dapat diakses secara publik.\n\n`;
                    errNotice += `${sym.sword} ©Nameless StarDoom`;
                    return m.reply(errNotice);
                }
            } else if (targetInput.endsWith('@g.us')) {
                targetGroupJid = targetInput;
            }
        }

        const dbPath = path.resolve(process.cwd(), 'database', 'groups.json');
        let db = {};
        if (fs.existsSync(dbPath)) {
            try {
                db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
            } catch {}
        }

        if (!db[targetGroupJid]) {
            db[targetGroupJid] = {};
        }

        if (!db[targetGroupJid].shinigami) {
            db[targetGroupJid].shinigami = { status: false, mode: 'both' };
        }

        const isTurnOn = action === 'on';
        db[targetGroupJid].shinigami.status = isTurnOn;

        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

        const statusText = isTurnOn ? 'AKTIF (ON)' : 'NONAKTIF (OFF)';
        const descText = isTurnOn 
            ? 'Grup ini sekarang terdaftar dan akan menerima pembaruan manhwa Shinigami secara otomatis.'
            : 'Pembaruan otomatis manhwa Shinigami untuk grup ini telah dihentikan.';

        let successMsg = `${greet.prefix} konfigurasi pembaruan manhwa telah berhasil diperbarui.\n\n`;
        successMsg += `${sym.arrowCurve} ${sym.swoosh} *MANHWA CONFIGURATION* ${sym.sparkle}\n\n`;
        successMsg += `*Status Sistem :*\n\n`;
        successMsg += `• Target JID : \`${targetGroupJid}\`\n`;
        successMsg += `• Status : _${statusText}_\n`;
        successMsg += `• Keterangan : ${descText}\n\n`;
        successMsg += `Sistem akan memantau rilis terbaru sesuai preferensi yang ditetapkan.\n\n`;
        successMsg += `${sym.sword} ©Nameless StarDoom`;

        await m.reply(successMsg);
    }
};