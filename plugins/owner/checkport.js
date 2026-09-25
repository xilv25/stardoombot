import os from 'os';

export default {
    command: ['checkport', 'cekport', 'network'],
    category: 'owner',
    description: '> Mengekspos informasi Port dan Jaringan peladen Pterodactyl',

    run: async (m, { conn }) => {
        // Hanya owner yang boleh mengecek konfigurasi server
        const isOwner = m.sender === conn.user.id || (global.owner && global.owner.includes(m.sender.split('@')[0]));
        
        // Baca variabel lingkungan yang disuntikkan oleh Pterodactyl Daemon (Wings)
        const mainPort = process.env.SERVER_PORT || 'Tidak dialokasikan (Bukan Pterodactyl/Panel)';
        const extraPorts = process.env.P_SERVER_ALLOCATIONS || 'Tidak ada port tambahan';
        const serverUUID = process.env.P_SERVER_UUID || 'Tidak terdeteksi';
        
        // Ambil IP lokal dari antarmuka jaringan
        const nets = os.networkInterfaces();
        let localIP = '127.0.0.1';
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                if (net.family === 'IPv4' && !net.internal) {
                    localIP = net.address;
                }
            }
        }

        const pushName = m.pushName || 'Tuan Muda';
        const watermark = conn.watermark || global.watermark || 'メ ©Nameless StarDoom';

        const textInfo = `Selamat malam ${pushName}, berikut adalah hasil pemindaian jaringan peladen.

╰› ᯓ *STARDOOM NETWORK EXPOSE* ˎˊ˗

• *Port Utama :* ${mainPort}
• *Port Tambahan :* ${extraPorts}
• *IP Lokal (Container) :* ${localIP}
• *Server ID :* ${serverUUID.split('-')[0]}***

*Analisis Sistem:*
Jika Port Utama menunjukkan angka (misal: 2096), maka port itulah yang WAJIB digunakan untuk menjalankan peladen API (Express.js) bot ini, karena hanya port tersebut yang memiliki akses tembus pandang ke internet global.

${watermark}`;

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