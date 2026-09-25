import fs from 'fs';
import path from 'path';

export default {
    command: ['proses', 'antrian', 'done'],
    category: 'store',
    description: 'Sistem manajemen antrian transaksi & auto-testi saluran.',
    run: async (m, { text, args, usedPrefix, command, conn, isOwner }) => {
        
        // Memanggil Global Symbol
        const symPath = path.resolve(process.cwd(), 'lib/global-symbol.js');
        let sym;
        try {
            sym = (await import(`file://${symPath}`)).sym;
        } catch {
            sym = { arrowCurve: '╰›', swoosh: 'ᯓ', sparkle: 'ˎˊ˗' };
        }

        // Memanggil Greeting Engine
        let greet;
        try {
            const greetPath = path.resolve(process.cwd(), 'lib/engine/greet-engine.js');
            const { getGreeting } = await import(`file://${greetPath}`);
            greet = getGreeting(m, { isOwner });
        } catch {
            const hour = parseInt(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: '2-digit', hour12: false }), 10);
            const time = (hour >= 4 && hour < 11) ? 'pagi' : (hour >= 11 && hour < 15) ? 'siang' : (hour >= 15 && hour < 18) ? 'sore' : 'malam';
            greet = { prefix: `Selamat ${time} Tuan Muda *${m.pushName || 'Master'}*,` };
        }

        // Inisialisasi Database Antrean
        const storeDir = path.resolve(process.cwd(), 'database', 'store');
        const queuePath = path.join(storeDir, 'queue.json');
        const watermarkPath = path.resolve(process.cwd(), 'src', 'image', 'watermark.png');

        if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });
        if (!fs.existsSync(queuePath)) fs.writeFileSync(queuePath, JSON.stringify([]));

        const getQueue = () => JSON.parse(fs.readFileSync(queuePath, 'utf-8'));
        const saveQueue = (data) => fs.writeFileSync(queuePath, JSON.stringify(data, null, 2));

        let q = getQueue();
        
        // Format Waktu Spesifik (Misal: 9/9/2026 18.17.58)
        const now = new Date();
        const timeString = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()} ${now.getHours().toString().padStart(2, '0')}.${now.getMinutes().toString().padStart(2, '0')}.${now.getSeconds().toString().padStart(2, '0')}`;

        // ==========================================
        // LOGIKA PROSES
        // ==========================================
        if (command === 'proses') {
            const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
            const isImage = (m.quoted && m.quoted.mtype === 'imageMessage') || (quotedMsg && quotedMsg.imageMessage);
            
            if (!isImage) {
                let msg = `${greet.prefix} media bukti transaksi tidak ditemukan pada pesan yang Anda balas.\n\n`;
                msg += `╰› ᯓ *PROCESS FAILED* ˎˊ˗\n\n`;
                msg += `*Panduan Penggunaan :*\n\n`;
                msg += `• Format : \`${usedPrefix + command} <nama_item>\`\n`;
                msg += `• Contoh : \`${usedPrefix + command} Topup 100 DM\`\n\n`;
                msg += `Silakan balas (reply) gambar bukti transfer untuk memproses pesanan.`;
                return m.reply(msg);
            }

            try {
                let buffer;
                if (m.quoted && typeof m.quoted.download === 'function') {
                    buffer = await m.quoted.download();
                } else {
                    const baileys = await import('ourin');
                    const downloadContentFromMessage = baileys.downloadContentFromMessage || baileys.default?.downloadContentFromMessage;
                    const imageMessageObject = quotedMsg?.imageMessage || m.quoted?.msg;
                    const stream = await downloadContentFromMessage(imageMessageObject, 'image');
                    buffer = Buffer.from([]);
                    for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }
                }

                let adminInput = (text || '').trim();
                let quotedCaption = m.quoted?.text || m.quoted?.caption || quotedMsg?.imageMessage?.caption || '';
                
                let itemDesc = adminInput;
                if (!itemDesc) itemDesc = quotedCaption.trim();
                if (!itemDesc) itemDesc = 'Pesanan Reguler';

                const id = Date.now().toString();
                const savedImagePath = path.join(storeDir, `tf_${id}.jpg`);
                fs.writeFileSync(savedImagePath, buffer);

                const targetUser = m.quoted?.sender || m.message?.extendedTextMessage?.contextInfo?.participant || m.chat;

                q.push({ id, target: targetUser, item: itemDesc, time: timeString, imagePath: savedImagePath });
                saveQueue(q);

                let msg = `${greet.prefix} pesanan baru telah berhasil diregistrasi ke dalam antrean sistem.\n\n`;
                msg += `╰› ᯓ *ORDER PROCESSED* ˎˊ˗\n\n`;
                msg += `*Rincian Pesanan :*\n\n`;
                msg += `• Pelanggan : @${targetUser.split('@')[0]}\n`;
                msg += `• Item : \`${itemDesc}\`\n`;
                msg += `• Waktu : \`${timeString}\`\n\n`;
                msg += `Mohon ditunggu, pesanan sedang dikerjakan dan otomatis tersinkronisasi.`;
                
                return m.reply(msg, null, { mentions: [targetUser] });

            } catch (err) {
                let msg = `${greet.prefix} proses pengunduhan media gagal diproses oleh sistem.\n\n`;
                msg += `╰› ᯓ *DOWNLOAD ERROR* ˎˊ˗\n\n`;
                msg += `*Kendala :*\n\n`;
                msg += `• ${err.message}\n\n`;
                msg += `Silakan coba kirim ulang gambar dan lakukan proses kembali.`;
                return m.reply(msg);
            }
        }

        // ==========================================
        // LOGIKA ANTRIAN
        // ==========================================
        if (command === 'antrian') {
            if (q.length === 0) {
                let msg = `${greet.prefix} tidak ada antrean yang berjalan pada sistem saat ini.\n\n`;
                msg += `╰› ᯓ *QUEUE EMPTY* ˎˊ˗\n\n`;
                msg += `Toko sedang senggang, belum ada pesanan yang diregistrasi.`;
                return m.reply(msg);
            }

            let msg = `${greet.prefix} berikut adalah daftar antrean yang sedang berjalan di sistem.\n\n`;
            msg += `╰› ᯓ *ACTIVE QUEUE* ˎˊ˗\n\n`;
            msg += `*Detail Antrean :*\n\n`;
            
            let mentionsData = [];
            q.forEach((v, i) => {
                msg += `• *${i + 1}.* @${v.target.split('@')[0]}\n`;
                msg += `   └ Item : \`${v.item}\`\n`;
                msg += `   └ Jam : \`${v.time}\`\n\n`;
                mentionsData.push(v.target);
            });
            
            msg += `• Total Antrean : \`${q.length} pesanan\`\n\n`;
            msg += `Ketik \`done <nomor>\` untuk menyelesaikan pesanan.`;
            
            return m.reply(msg, null, { mentions: mentionsData });
        }

        // ==========================================
        // LOGIKA DONE
        // ==========================================
        if (command === 'done') {
            if (q.length === 0) {
                let msg = `${greet.prefix} sistem mendeteksi tidak ada antrean yang sedang diproses.\n\n`;
                msg += `╰› ᯓ *QUEUE EMPTY* ˎˊ˗\n\n`;
                msg += `Pesanan kosong, tidak ada transaksi yang dapat diselesaikan.`;
                return m.reply(msg);
            }

            const antrianNo = parseInt(args[0]);
            if (isNaN(antrianNo) || antrianNo < 1 || antrianNo > q.length) {
                let msg = `${greet.prefix} nomor antrean yang Anda masukkan tidak valid.\n\n`;
                msg += `╰› ᯓ *INVALID QUEUE* ˎˊ˗\n\n`;
                msg += `*Panduan :*\n\n`;
                msg += `• Silakan ketik \`${usedPrefix}antrian\` untuk melihat nomor urutan yang sah.`;
                return m.reply(msg);
            }

            if (!fs.existsSync(watermarkPath)) {
                let msg = `${greet.prefix} file watermark utama tidak ditemukan pada sistem.\n\n`;
                msg += `╰› ᯓ *MISSING ASSET* ˎˊ˗\n\n`;
                msg += `*Kendala :*\n\n`;
                msg += `• Direktori \`src/image/watermark.png\` kosong.\n\n`;
                msg += `Mohon lengkapi aset sebelum melanjutkan penyelesaian.`;
                return m.reply(msg);
            }

            const targetData = q[antrianNo - 1];

            if (!fs.existsSync(targetData.imagePath)) {
                let msg = `${greet.prefix} berkas bukti transaksi asli sudah terhapus dari penyimpanan.\n\n`;
                msg += `╰› ᯓ *MISSING FILE* ˎˊ˗\n\n`;
                msg += `Transaksi tidak dapat dilanjutkan karena kehilangan jejak media.`;
                return m.reply(msg);
            }

            try {
                const jimpMod = await import('jimp');
                const Jimp = jimpMod.default || jimpMod.Jimp || jimpMod;
                
                if (typeof Jimp.read !== 'function') throw new Error("Fungsi baca (read) pada modul Jimp tidak ditemukan.");

                const image = await Jimp.read(targetData.imagePath);
                const watermark = await Jimp.read(watermarkPath);
                
                const targetWidth = Math.floor(image.bitmap.width * 0.5);
                
                if (typeof watermark.resize === 'function') {
                    try {
                        watermark.resize(targetWidth, Jimp.AUTO || -1);
                    } catch(e) {
                        watermark.resize({ w: targetWidth });
                    }
                }
                
                // Opacity aman untuk semua versi Jimp
                try {
                    if (typeof watermark.opacity === 'function') watermark.opacity(0.25);
                    else if (typeof watermark.fade === 'function') watermark.fade(0.75); 
                } catch(e) {}
                
                const x = Math.floor((image.bitmap.width - watermark.bitmap.width) / 2);
                const y = Math.floor((image.bitmap.height - watermark.bitmap.height) / 2);
                
                // Penggabungan aman tanpa parameter mode yang memicu crash
                try {
                    image.composite(watermark, x, y, { opacitySource: 0.25, opacityDest: 1 });
                } catch (e) {
                    image.composite(watermark, x, y); // Fallback absolut
                }
                
                const mime = Jimp.MIME_JPEG || 'image/jpeg';
                let resultBuffer;
                
                if (typeof image.getBufferAsync === 'function') {
                    resultBuffer = await image.getBufferAsync(mime);
                } else {
                    const buf = image.getBuffer(mime);
                    resultBuffer = buf instanceof Promise ? await buf : buf;
                }

                let channelJid;
                try {
                    const metadata = await conn.newsletterMetadata("invite", "0029VbBnm29LikgBh6LFBM39");
                    channelJid = metadata.id;
                } catch (e) {
                    throw new Error("Gagal menghubungkan bot ke Saluran (Newsletter) ESTE.");
                }

                try { fs.unlinkSync(targetData.imagePath); } catch (e) {}
                q.splice(antrianNo - 1, 1);
                saveQueue(q);

                let msg = `${greet.prefix} pesanan pelanggan telah berhasil diselesaikan secara penuh.\n\n`;
                msg += `╰› ᯓ *TRANSACTION DONE* ˎˊ˗\n\n`;
                msg += `*Rincian Penyelesaian :*\n\n`;
                msg += `• Pelanggan : @${targetData.target.split('@')[0]}\n`;
                msg += `• Item : \`${targetData.item}\`\n`;
                msg += `• Waktu : \`${timeString}\`\n\n`;
                msg += `Bukti transaksi telah dimarkahi (watermark) dan testimoni telah diunggah ke saluran secara otomatis.`;

                const captionTesti = `🎉 *TESTIMONI BERHASIL*\n\n` +
                                     `• *Item:* ${targetData.item}\n` +
                                     `• *Waktu:* ${timeString}\n` +
                                     `• *Pelanggan:* +${targetData.target.split('@')[0]}\n\n` +
                                     `_Terima kasih atas kepercayaannya!_ 🛒`;

                await conn.sendMessage(channelJid, { image: resultBuffer, caption: captionTesti });
                
                return m.reply(msg, null, { mentions: [targetData.target] });

            } catch (err) {
                let msg = `${greet.prefix} proses penyelesaian transaksi gagal dieksekusi oleh sistem.\n\n`;
                msg += `╰› ᯓ *EXECUTION ERROR* ˎˊ˗\n\n`;
                msg += `*Kendala :*\n\n`;
                msg += `• ${err.message}\n\n`;
                msg += `Operasi dibatalkan, silakan periksa log server untuk detailnya.`;
                return m.reply(msg);
            }
        }
    }
};