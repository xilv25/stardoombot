export default {
    command: ['gclink', 'linkgc', 'linkgroup'],
    category: 'group',
    description: 'Mengambil tautan undangan grup saat ini',

    run: async (m, { conn, isGroup }) => {
        if (!isGroup) {
            return m.reply('Perintah ini hanya dapat digunakan di dalam grup.');
        }

        try {
            const groupMetadata = await conn.groupMetadata(m.chat).catch(() => null);
            const inviteCode = await conn.groupInviteCode(m.chat);

            const groupName = groupMetadata?.subject || 'Grup WhatsApp';
            const inviteLink = `https://chat.whatsapp.com/${inviteCode}`;

            let text = `Berikut adalah tautan undangan grup ini, @${m.sender.split('@')[0]}\n\n`;
            text += `╰› ᯓ *GROUP INVITATION LINK* ˎˊ˗\n\n`;
            text += `*Detail Tautan :*\n\n`;
            text += `• Nama Grup : ${groupName}\n`;
            text += `• Tautan Undangan : ${inviteLink}\n\n`;
            text += `Tautan undangan grup tersebut telah tersinkronisasi dan siap dibagikan.`;

            await m.reply(text.trim(), m.chat, {
                mentions: [m.sender],
                footer: 'メ ©Nameless StarDoom'
            });
        } catch (err) {
            await m.reply('Gagal mengambil tautan grup. Pastikan bot telah dijadikan admin terlebih dahulu untuk mengakses kode undangan.');
        }
    }
};