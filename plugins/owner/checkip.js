import axios from 'axios';

export default {
    command: ['checkip', 'cekip', 'publicip'],
    category: 'owner',
    description: '> Mengekspos IP Publik peladen untuk kebutuhan konfigurasi API',

    run: async (m, { conn }) => {
        const pushName = m.pushName || 'Tuan Muda';
        const watermark = conn.watermark || global.watermark || 'メ ©Nameless StarDoom';
        
        let publicIP = 'Memindai...';
        const mainPort = process.env.SERVER_PORT || '2096';

        try {
            // Meminta IP Publik dari layanan eksternal
            const response = await axios.get('https://api.ipify.org?format=json', { timeout: 5000 });
            publicIP = response.data.ip;
        } catch (err) {
            publicIP = 'Gagal melacak IP (Koneksi terblokir)';
        }

        let textInfo = `Selamat malam Tuan Muda *${pushName}*, berikut adalah hasil pelacakan IP Publik peladen.\n\n`;
        textInfo += `╰› ᯓ *STARDOOM PUBLIC NETWORK* ˎˊ˗\n\n`;
        textInfo += `• *IP Publik :* ${publicIP}\n`;
        textInfo += `• *Port API :* ${mainPort}\n\n`;
        textInfo += `*Konfigurasi URL API:*\n`;
        textInfo += `Gunakan URL di bawah ini untuk disalin ke dalam kode Tetris AIRich bagian \`submitScore\`:\n\n`;
        textInfo += `\`http://${publicIP}:${mainPort}/api/tetris/save\`\n\n`;
        textInfo += `${watermark}`;

        const fakeReply = {
            key: { fromMe: false, participant: '13135550002@s.whatsapp.net', remoteJid: 'status@broadcast' },
            message: {
                contactMessage: {
                    displayName: 'Network Diagnostics',
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:Diagnostics\nitem1.TEL;waid=13135550002:13135550002\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
                }
            }
        };

        await conn.sendMessage(m.chat, { text: textInfo }, { quoted: fakeReply });
    }
};