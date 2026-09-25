import { setAfk, checkAfkOnMessage } from '../../lib/engine/afk-engine.js';

export default {
    command: ['afk'],
    category: 'group',
    description: 'Fitur AFK khusus admin dengan penyimpanan database per grup',

    before: async (m, { conn }) => {
        checkAfkOnMessage(m, conn);
        return false;
    },

    run: async (m, { conn, text, isGroup, isAdmin, isOwner }) => {
        if (!isGroup) {
            return m.reply('Fitur AFK hanya dapat digunakan di dalam grup.');
        }

        if (!isAdmin && !isOwner) {
            return m.reply('Fitur AFK hanya dapat digunakan oleh Admin Grup atau Owner.');
        }

        setAfk(m.chat, m.sender, text);

        const reasonDisplay = text ? `\n• *Alasan :* ${text}` : '';
        await m.reply(
            `╰› ᯓ *AFK SYSTEM* ˎˊ˗\n\n` +
            `• *Status :* Berhasil diaktifkan${reasonDisplay}\n` +
            `• *Keterangan :* Bot akan memberitahu siapa saja yang menandai atau membalas pesan Anda.`
        );
    }
};