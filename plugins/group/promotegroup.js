import greetEngine from '../../lib/engine/greet-engine.js';

export default {
    command: ['promotegroup', 'promote', 'demote', 'adminin', 'unadmin'],
    category: 'group',
    description: '> Mengatur jabatan admin grup (promote, demote, & panduan sistem)',

    run: async (m, { conn, text, command, usedPrefix, isGroup, isAdmin, isOwner }) => {
        if (!isGroup) {
            return await conn.sendMessage(m.chat, { text: 'Perintah ini hanya dapat digunakan di dalam grup.' });
        }

        const pfx = usedPrefix || m.prefix || '.';
        const cmd = command ? command.toLowerCase() : 'promotegroup';

        // 1. Greet Engine
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
            greeting = `Selamat ${ucapan} ${isOwner ? 'Tuan Muda' : (isAdmin ? 'Admin' : 'Kak')} *${m.pushName || 'User'}*,`;
        }

        // 2. Panduan Sistem (.promotegroup)
        if (cmd === 'promotegroup') {
            return await conn.sendMessage(m.chat, {
                text: `${greeting} berikut penjelasan sistem manajemen jabatan grup.\n\n` +
                      `╰› ᯓ *SYSTEM INFORMATION* ˎˊ˗\n\n` +
                      `*Daftar Perintah :*\n` +
                      `• \`${pfx}promote @tag\` : Menaikkan member menjadi Admin Grup\n` +
                      `• \`${pfx}demote @tag\` : Menurunkan Admin menjadi Member biasa\n\n` +
                      `*Catatan Sistem :*\n` +
                      `1. Perintah dapat digunakan via balas (reply) pesan atau tag (@tag).\n` +
                      `2. Perintah hanya dapat dijalankan oleh Admin Grup atau Owner.`
            });
        }

        // 3. Validasi Hak Akses Eksekutor
        if (!isAdmin && !isOwner) {
            return await conn.sendMessage(m.chat, {
                text: `${greeting} kamu tidak memiliki izin.\n\n` +
                      `╰› ᯓ *SYSTEM WARNING* ˎˊ˗\n\n` +
                      `Perintah ini hanya dapat digunakan oleh Admin Grup atau Owner.`
            });
        }

        // 4. Ekstraksi Target (Quoted -> ContextInfo -> Mention -> Teks Nomor)
        let target = null;

        if (m.quoted) {
            target = m.quoted.sender || m.quoted.participant || m.quoted.key?.participant;
        }

        if (!target) {
            const ctx = m.msg?.contextInfo || m.message?.extendedTextMessage?.contextInfo || m.msg?.message?.extendedTextMessage?.contextInfo;
            if (ctx) {
                if (ctx.participant) target = ctx.participant;
                else if (ctx.quotedMessage && ctx.remoteJid) target = ctx.remoteJid;
            }
        }

        if (!target && m.mentionedJid && m.mentionedJid.length > 0) {
            target = m.mentionedJid[0];
        } else if (!target) {
            const ctx = m.msg?.contextInfo || m.message?.extendedTextMessage?.contextInfo;
            if (ctx?.mentionedJid && ctx.mentionedJid.length > 0) {
                target = ctx.mentionedJid[0];
            }
        }

        if (!target && text) {
            let cleaned = text.replace(/[^0-9]/g, '');
            if (cleaned.length >= 5) {
                target = cleaned + '@s.whatsapp.net';
            }
        }

        const isPromote = ['promote', 'adminin'].includes(cmd);
        const actionType = isPromote ? 'promote' : 'demote';
        const actionLabel = isPromote ? 'PROMOTE' : 'DEMOTE';

        if (!target) {
            return await conn.sendMessage(m.chat, {
                text: `${greeting} target belum ditentukan.\n\n` +
                      `╰› ᯓ *SYSTEM WARNING* ˎˊ˗\n\n` +
                      `*Format Penggunaan :*\n` +
                      `• Balas (reply) pesan orang yang ingin di-${actionType}\n` +
                      `• Tag orang langsung: \`${pfx}${cmd} @tag\`\n\n` +
                      `Silakan tentukan target kamu.`
            });
        }

        // 5. Eksekusi Langsung ke Baileys (Tanpa reply chat command)
        try {
            await conn.groupParticipantsUpdate(m.chat, [target], actionType);

            let descText = isPromote 
                ? `• *Status Jabatan :* Berhasil diangkat menjadi Admin Grup\n\nSelamat bertugas untuk Admin baru!`
                : `• *Status Jabatan :* Berhasil diturunkan menjadi Member biasa\n\nTerima kasih atas kontribusinya selama bertugas!`;

            await conn.sendMessage(m.chat, {
                text: `${greeting} struktur jabatan berhasil diperbarui.\n\n` +
                      `╰› ᯓ *${actionLabel} SUCCESS* ˎˊ˗\n\n` +
                      `• *Target :* @${target.split('@')[0]}\n` +
                      `${descText}`,
                mentions: [target]
            });

        } catch (e) {
            console.error(`[${actionLabel} Error]:`, e);
            await conn.sendMessage(m.chat, {
                text: `${greeting} proses ${cmd} gagal diproses.\n\n` +
                      `╰› ᯓ *SYSTEM ERROR* ˎˊ˗\n\n` +
                      `• *Pesan :* ${e.message || 'Kendala server saat mengeksekusi perubahan jabatan.'}`
            });
        }
    }
};