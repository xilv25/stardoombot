import fs from 'fs';
import path from 'path';

export default {
    command: ['clearsesi', 'clearsession', 'ds'],
    category: 'owner',
    description: 'Menghapus file sesi korup tanpa perlu pairing ulang',

    run: async (m, { conn, isOwner }) => {
        if (!isOwner && !m.isOwner && !m.fromMe) {
            return m.reply('Perintah ini hanya dapat dijalankan oleh pemilik bot.');
        }

        // SESUAIKAN: Ubah 'session' dengan nama folder sesi bot kamu (misal: 'auth_info', 'session', dll)
        const sessionFolderName = 'session'; 
        const sessionPath = path.resolve(`./${sessionFolderName}`);

        if (!fs.existsSync(sessionPath)) {
            return m.reply(`Folder sesi *${sessionFolderName}* tidak ditemukan. Pastikan nama foldernya benar di dalam skrip.`);
        }

        try {
            await m.reply('Membersihkan file sesi yang korup. Jangan kirim pesan apa pun...\n\nBot akan melakukan restart otomatis dan langsung terkoneksi kembali tanpa pairing.');

            const files = fs.readdirSync(sessionPath);
            let deletedCount = 0;

            for (const file of files) {
                // KUNCI UTAMA: Biarkan creds.json tetap hidup agar tidak minta pairing ulang
                if (file !== 'creds.json') {
                    const filePath = path.join(sessionPath, file);
                    if (fs.statSync(filePath).isFile()) {
                        fs.unlinkSync(filePath);
                        deletedCount++;
                    }
                }
            }

            // Memutuskan koneksi dengan server WhatsApp secara aman
            if (conn?.ws) conn.ws.close();
            
            // Mematikan proses. 
            // Jika bot berjalan di Panel (Pterodactyl), PM2, atau script auto-loop, 
            // bot akan langsung otomatis menyala ulang detik itu juga.
            setTimeout(() => {
                process.exit(0);
            }, 2000);

        } catch (err) {
            console.error('[ClearSesi Error]:', err);
            m.reply(`Gagal membersihkan sesi: ${err.message}`);
        }
    }
};