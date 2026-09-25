import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { pathToFileURL } from 'url';

// Fungsi konversi WebP stiker ke PNG menggunakan FFmpeg
function webpToImage(mediaBuffer) {
    return new Promise((resolve, reject) => {
        const tmpIn = path.join(os.tmpdir(), `toimg_in_${Date.now()}_${Math.random().toString(36).substring(2)}.webp`);
        const tmpOut = path.join(os.tmpdir(), `toimg_out_${Date.now()}_${Math.random().toString(36).substring(2)}.png`);

        fs.writeFileSync(tmpIn, mediaBuffer);

        const ffmpeg = spawn('ffmpeg', [
            '-i', tmpIn,
            tmpOut
        ]);

        ffmpeg.on('close', (code) => {
            try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch {}
            if (code !== 0) {
                try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch {}
                return reject(new Error(`FFmpeg keluar dengan status ${code}`));
            }
            try {
                const imgBuffer = fs.readFileSync(tmpOut);
                if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
                resolve(imgBuffer);
            } catch (err) {
                reject(err);
            }
        });

        ffmpeg.on('error', (err) => {
            try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch {}
            try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch {}
            reject(err);
        });
    });
}

export default {
    command: ['toimg', 'toimage'],
    category: 'converter',
    description: '> Mengubah stiker menjadi gambar biasa',

    run: async (m, { conn, command, isOwner, isAdmin }) => {
        const pfx = m.prefix || '.';
        const cmd = command.toLowerCase();

        // Pemuatan Greet Engine secara Dinamis
        let greeting = '';
        try {
            const enginePath = pathToFileURL(path.resolve(process.cwd(), 'lib/engine/greet-engine.js')).href;
            const greetMod = await import(enginePath);
            const fnGreet = greetMod.getGreeting || greetMod.default?.getGreeting || greetMod.default;

            if (typeof fnGreet === 'function') {
                const res = fnGreet(m, isOwner, isAdmin);
                greeting = typeof res === 'object' ? (res.text || res.greeting || `Selamat ${res.time || 'malam'} ${res.role || 'Tuan Muda'} *${m.pushName || 'User'}*`) : res;
            }
        } catch {}

        if (!greeting) {
            const hour = new Date().getHours();
            const ucapan = hour < 4 ? 'dini hari' : hour < 11 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam';
            const role = isOwner ? 'Tuan Muda' : (isAdmin ? 'Admin' : 'Kak');
            greeting = `Selamat ${ucapan} ${role} *${m.pushName || 'User'}*`;
        }

        const pushName = m.pushName || 'User';
        const fakeReply = {
            key: { fromMe: false, participant: '13135550002@s.whatsapp.net', remoteJid: 'status@broadcast' },
            message: { contactMessage: { displayName: pushName, vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${pushName}\nitem1.TEL;waid=13135550002:13135550002\nitem1.X-ABLabel:Ponsel\nEND:VCARD` } }
        };

        // 1. Ekstraksi Pesan Utama
        let msgObj = m.message || {};
        if (msgObj.ephemeralMessage) msgObj = msgObj.ephemeralMessage.message || msgObj;
        if (msgObj.viewOnceMessage) msgObj = msgObj.viewOnceMessage.message || msgObj;
        if (msgObj.viewOnceMessageV2) msgObj = msgObj.viewOnceMessageV2.message || msgObj;
        if (msgObj.documentWithCaptionMessage) msgObj = msgObj.documentWithCaptionMessage.message || msgObj;

        // 2. Ekstraksi Pesan yang Di-reply
        const contextInfo = msgObj.extendedTextMessage?.contextInfo || 
                            msgObj.imageMessage?.contextInfo || 
                            msgObj.stickerMessage?.contextInfo;
                            
        let quotedMsg = contextInfo?.quotedMessage;
        if (quotedMsg?.ephemeralMessage) quotedMsg = quotedMsg.ephemeralMessage.message || quotedMsg;
        if (quotedMsg?.viewOnceMessage) quotedMsg = quotedMsg.viewOnceMessage.message || quotedMsg;
        if (quotedMsg?.viewOnceMessageV2) quotedMsg = quotedMsg.viewOnceMessageV2.message || quotedMsg;

        // 3. Ambil Target Stiker
        let targetSticker = quotedMsg?.stickerMessage || msgObj?.stickerMessage;

        if (!targetSticker) {
            return await m.reply(
                `${greeting}, stiker tidak ditemukan.\n\n╰› ᯓ *SYSTEM WARNING* ˎˊ˗\n\n*Panduan Penggunaan :*\nBalas (reply) sebuah stiker dengan perintah:\n\`${pfx}${cmd}\`\n\nPastikan pesan yang dibalas merupakan stiker.`
            );
        }

        let mediaBuffer = null;

        try {
            let baileys;
            try { baileys = await import('ourin'); } 
            catch { baileys = await import('@whiskeysockets/baileys'); }
            const { downloadContentFromMessage } = baileys;

            const stream = await downloadContentFromMessage(targetSticker, 'sticker');
            let chunks = [];
            for await (const chunk of stream) {
                chunks.push(chunk);
            }
            mediaBuffer = Buffer.concat(chunks);
        } catch (err) {
            return await m.reply(
                `Gagal mengunduh stiker.\n\n╰› ᯓ *DOWNLOAD ERROR* ˎˊ˗\n\n• Pesan : ${err.message || 'Kendala saat mengambil berkas stiker'}`
            );
        }

        try {
            const imageBuffer = await webpToImage(mediaBuffer);

            // Kirim gambar hasil konversi dengan fakeReply vCard
            await conn.sendMessage(m.chat, { 
                image: imageBuffer 
            }, { quoted: fakeReply });

        } catch (err) {
            await m.reply(
                `Gagal mengubah stiker ke gambar.\n\n╰› ᯓ *CONVERSION ERROR* ˎˊ˗\n\n• Pesan : ${err.message || 'Kendala pemrosesan FFmpeg'}\n\nPastikan FFmpeg terpasang dengan benar di server.`
            );
        }
    }
};