function getTargetJid(m) {
    if (m.mentionedJid && m.mentionedJid.length > 0) {
        return m.mentionedJid[0];
    }
    if (m.quoted) {
        return m.quoted.sender || m.quoted.participant || m.quoted.key?.participant || null;
    }
    const contextInfo = m.message?.extendedTextMessage?.contextInfo || m.msg?.contextInfo;
    if (contextInfo) {
        if (contextInfo.mentionedJid && contextInfo.mentionedJid[0]) {
            return contextInfo.mentionedJid[0];
        }
        if (contextInfo.participant) {
            return contextInfo.participant;
        }
        if (contextInfo.remoteJid && !contextInfo.remoteJid.endsWith('@g.us')) {
            return contextInfo.remoteJid;
        }
    }
    return m.sender;
}

export default {
    command: ['getpp', 'pp'],
    category: 'tools',
    description: '> Mengambil foto profil pengguna (diri sendiri, tag member, atau reply pesan)',

    run: async (m, { conn, fakereply }) => {
        let targetJid = getTargetJid(m);

        if (targetJid && targetJid.includes(':')) {
            targetJid = targetJid.split(':')[0] + '@s.whatsapp.net';
        }
        if (targetJid && !targetJid.includes('@')) {
            targetJid = targetJid + '@s.whatsapp.net';
        }

        const cleanNumber = targetJid.split('@')[0];
        const targetTag = `@${cleanNumber}`;

        const pushName = m.pushName || 'User';
        const fake = fakereply || {
            key: { fromMe: false, participant: '13135550002@s.whatsapp.net', remoteJid: 'status@broadcast' },
            message: {
                contactMessage: {
                    displayName: pushName,
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${pushName}\nitem1.TEL;waid=13135550002:13135550002\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
                }
            }
        };

        let ppUrl;
        try {
            ppUrl = await conn.profilePictureUrl(targetJid, 'image');
        } catch {
            ppUrl = null;
        }

        if (!ppUrl) {
            return conn.sendMessage(m.chat, {
                text: `Gagal mengambil foto profil. Pengguna ${targetTag} mungkin tidak memasang foto profil atau privasinya disembunyikan.`,
                mentions: [targetJid]
            }, { quoted: fake });
        }

        await conn.sendMessage(m.chat, {
            image: { url: ppUrl },
            caption: `╰› ᯓ *USER PROFILE PICTURE* ˎˊ˗\n\n• *Target :* ${targetTag}\n• *Status :* Berhasil dimuat`,
            mentions: [targetJid]
        }, { quoted: fake });
    }
};