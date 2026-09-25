export default {
    command: ['tescvr'],
    category: 'tools',
    description: '> Testing saluran murni.',
    
    run: async (m, { conn }) => {
        const channelLink = 'https://whatsapp.com/channel/0029Vb7Y84OLSmbaaAlKY70L';
        const msg = `Halo, ini adalah undangan resmi ke saluran StarDoom Universe. Silakan klik gambar di bawah untuk bergabung.`;

        try {
            await conn.sendMessage(m.chat, {
                text: msg,
                contextInfo: {
                    externalAdReply: {
                        title: 'StarDoom Universe',
                        body: 'Official Channel',
                        // Menggunakan gambar dari URL online agar tidak kena limit buffer lokal
                        thumbnailUrl: 'https://telegra.ph/file/8b387431e5f8f30740a64.jpg', 
                        sourceUrl: channelLink,
                        mediaType: 1,
                        renderLargerThumbnail: true
                    }
                }
            }); // Sengaja tanpa { quoted: m } agar tidak ada reply
        } catch (err) {
            console.error('\n[ERROR TESCVER]', err);
        }
    }
};