export default {
    command: ['hidetag', 'ht', 'h'],
    category: 'group',
    description: '> Mengirim pesan dengan menyembunyikan tag seluruh anggota grup',

    run: async (m, { conn, text, isAdmin, isOwner, isGroup }) => {
        if (!isGroup) {
            return await m.reply('Perintah ini hanya dapat digunakan di dalam grup.');
        }

        if (!isAdmin && !isOwner) {
            return await m.reply('Akses ditolak. Perintah hidetag hanya dapat digunakan oleh admin grup.');
        }

        let groupMetadata = null;
        try {
            groupMetadata = await conn.groupMetadata(m.chat);
        } catch {
            return await m.reply('Gagal mengambil data informasi grup.');
        }

        const participants = groupMetadata.participants.map(v => v.id);
        
        // Perbaikan ekstraksi teks via reply secara paksa
        let messageText = text ? text.trim() : '';
        if (!messageText) {
            if (m.quoted) {
                messageText = m.quoted.text || m.quoted.caption || m.quoted.body || m.quoted.conversation || '';
            }
            const rawContext = m.msg?.contextInfo || m.message?.extendedTextMessage?.contextInfo || m.msg?.message?.extendedTextMessage?.contextInfo;
            if (!messageText && rawContext && rawContext.quotedMessage) {
                const q = rawContext.quotedMessage;
                messageText = q.conversation || 
                          q.extendedTextMessage?.text || 
                          q.imageMessage?.caption || 
                          q.videoMessage?.caption || 
                          q.documentMessage?.caption || '';
            }
        }

        if (!messageText) {
            const pfx = m.prefix || '.';
            return await m.reply(
                `*Format Penggunaan :*\n` +
                `• \`${pfx}h <pesan>\`\n` +
                `• Balas pesan: \`${pfx}h\``
            );
        }

        // Ambil watermark resmi untuk footer dari handler/global
        const watermark = conn.watermark || global.watermark || conn.footer || global.footer || 'メ ©Nameless StarDoom';

        // Fake Reply Kontak Pengguna
        const fakeReply = {
            key: { fromMe: false, participant: '13135550002@s.whatsapp.net', remoteJid: 'status@broadcast' },
            message: {
                contactMessage: {
                    displayName: m.pushName || 'User',
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${m.pushName || 'User'}\nitem1.TEL;waid=13135550002:13135550002\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
                }
            }
        };

        return await conn.sendMessage(m.chat, {
            text: messageText,
            footer: watermark,
            mentions: participants
        }, { quoted: fakeReply });
    }
};