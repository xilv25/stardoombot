import fs from 'fs';
import path from 'path';

export default {
    command: ['noprefix'],
    category: 'admin',
    description: 'Mengaktifkan atau menonaktifkan mode tanpa prefix di grup',
    run: async (m, { conn, args, isOwner, isAdmin }) => {
        const symPath = path.resolve(process.cwd(), 'lib/global-symbol.js');
        const { sym } = await import(`file://${symPath}`);

        let greet;
        try {
            const greetPath = path.resolve(process.cwd(), 'lib/engine/greet-engine.js');
            const { getGreeting } = await import(`file://${greetPath}`);
            greet = getGreeting(m, { isOwner, isAdmin });
        } catch {
            greet = { prefix: `Halo Anda,` };
        }

        if (!m.isGroup && !isOwner) {
            return m.reply(`Perintah ini hanya dapat dijalankan di dalam grup.`);
        }

        if (!isOwner && !isAdmin) {
            return m.reply(`Maaf, fitur ini khusus untuk admin grup.`);
        }

        const action = args[0]?.toLowerCase();
        const targetInput = args[1];

        if (!['on', 'off'].includes(action)) {
            let msg = `${greet.prefix} tentukan parameter status noprefix.\n\n`;
            msg += `${sym.arrowCurve} ${sym.swoosh} *NOPREFIX CONFIG* ${sym.sparkle}\n\n`;
            msg += `• \`.noprefix on\` : Aktifkan mode tanpa prefix di grup ini\n`;
            msg += `• \`.noprefix off\` : Nonaktifkan mode tanpa prefix\n\n`;
            msg += `${sym.sword} ©Nameless StarDoom`;
            return m.reply(msg);
        }

        let targetGroupJid = m.chat;
        let groupName = 'Grup Ini';
        
        if (targetInput && isOwner) {
            if (targetInput.includes('chat.whatsapp.com/')) {
                try {
                    const inviteCode = targetInput.split('chat.whatsapp.com/')[1].split(' ')[0];
                    const groupMeta = await conn.groupGetInviteInfo(inviteCode);
                    targetGroupJid = groupMeta.id;
                    groupName = groupMeta.subject;
                } catch {
                    return m.reply(`Gagal membaca tautan grup WhatsApp.`);
                }
            } else if (targetInput.endsWith('@g.us')) {
                targetGroupJid = targetInput;
                try {
                    const meta = await conn.groupMetadata(targetGroupJid);
                    groupName = meta.subject;
                } catch {}
            }
        } else {
            try {
                const meta = await conn.groupMetadata(targetGroupJid);
                groupName = meta.subject;
            } catch {}
        }

        const dbPath = path.resolve(process.cwd(), 'database', 'groups.json');
        let db = {};
        if (fs.existsSync(dbPath)) {
            try { db = JSON.parse(fs.readFileSync(dbPath, 'utf-8')); } catch {}
        }

        if (!db[targetGroupJid]) db[targetGroupJid] = {};
        db[targetGroupJid].noprefix = action === 'on';

        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

        let statusText = db[targetGroupJid].noprefix ? 'AKTIF (Tanpa Prefix)' : 'NORMAL (Wajib Prefix)';
        let msg = `${greet.prefix} konfigurasi mode noprefix berhasil diperbarui.\n\n`;
        msg += `${sym.arrowCurve} ${sym.swoosh} *NOPREFIX STATUS* ${sym.sparkle}\n\n`;
        msg += `• *Target* Group : ${groupName}\n`;
        msg += `• *Status* : ${statusText}\n\n`;
        msg += `${sym.sword} ©Nameless StarDoom`;
        return m.reply(msg);
    }
};