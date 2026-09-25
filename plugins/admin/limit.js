import fs from 'fs';
import path from 'path';

export default {
    command: ['nolimitcmd', 'setlimit', 'nolimitgc'],
    category: 'admin',
    description: 'Mengelola sistem pembatasan kuota (limit) perintah bot',

    run: async (m, { conn, args, usedPrefix, command, isOwner, isAdmin }) => {
        const limitDir = path.resolve(process.cwd(), 'database/limitscmd');
        const groupDir = path.resolve(process.cwd(), 'database/group');
        
        if (!fs.existsSync(limitDir)) fs.mkdirSync(limitDir, { recursive: true });
        if (!fs.existsSync(groupDir)) fs.mkdirSync(groupDir, { recursive: true });

        if (command === 'nolimitcmd') {
            return m.reply(
                `╰› ᯓ *LIMIT SYSTEM GUIDE* ˎˊ˗\n\n` +
                `Sistem limit membatasi jumlah eksekusi perintah harian untuk mencegah spam:\n` +
                `• *Default Limit:* 10 kali penggunaan.\n` +
                `• *Pengecualian:* Owner dan Admin grup dibebaskan dari batasan limit (Unlimited).\n` +
                `• *Grup Bebas Limit:* Grup dapat diatur agar seluruh anggotanya tidak terpotong kuota limitnya via perintah \`.nolimitgc\`.`
            );
        }

        if (command === 'setlimit') {
            if (!isOwner && !isAdmin) return m.reply('Perintah ini khusus untuk Admin atau Owner.');
            const count = parseInt(args[0]);
            if (isNaN(count) || count < 0) return m.reply('Masukkan angka limit global yang valid!');
            
            const globalLimitFile = path.join(limitDir, 'global_config.json');
            fs.writeFileSync(globalLimitFile, JSON.stringify({ defaultLimit: count }, null, 2));
            return m.reply(`Berhasil mengubah batas default limit global menjadi: *${count}*`);
        }

        if (command === 'nolimitgc') {
            if (!m.isGroup) return m.reply('Perintah ini hanya dapat digunakan di dalam grup.');
            if (!isOwner && !isAdmin) return m.reply('Perintah ini khusus untuk Admin atau Owner grup.');

            const gcFile = path.join(groupDir, `${m.chat}.json`);
            let gcData = {};
            if (fs.existsSync(gcFile)) {
                try { gcData = JSON.parse(fs.readFileSync(gcFile, 'utf8')); } catch {}
            }

            gcData.noLimit = !gcData.noLimit;
            fs.writeFileSync(gcFile, JSON.stringify(gcData, null, 2));

            return m.reply(
                `Status bebas limit untuk grup ini berhasil diubah.\n\n` +
                `╰› ᯓ *GROUP LIMIT STATUS* ˎˊ˗\n\n` +
                `• *Status:* ${gcData.noLimit ? 'AKTIF (Tanpa Limit)' : 'TIDAK AKTIF (Normal)'}`
            );
        }
    }
};