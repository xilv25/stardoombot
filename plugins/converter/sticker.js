import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import { pathToFileURL } from 'url';

function imageToWebp(mediaBuffer) {
    return new Promise((resolve, reject) => {
        const tmpIn = path.join(os.tmpdir(), `stk_in_${Date.now()}_${Math.random().toString(36).substring(2)}.jpg`);
        const tmpOut = path.join(os.tmpdir(), `stk_out_${Date.now()}_${Math.random().toString(36).substring(2)}.webp`);

        fs.writeFileSync(tmpIn, mediaBuffer);

        const ffmpeg = spawn('ffmpeg', [
            '-i', tmpIn,
            '-vf', 'scale=512:512:flags=lanczos:force_original_aspect_ratio=decrease,format=rgba,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=#00000000',
            '-c:v', 'libwebp',
            '-lossless', '0',
            '-compression_level', '4',
            '-q:v', '70',
            '-loop', '0',
            '-an',
            '-vsync', '0',
            '-s', '512:512',
            tmpOut
        ]);

        ffmpeg.on('close', (code) => {
            try { if (fs.existsSync(tmpIn)) fs.unlinkSync(tmpIn); } catch {}
            if (code !== 0) {
                try { if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut); } catch {}
                return reject(new Error(`FFmpeg keluar dengan status ${code}`));
            }
            try {
                const webpBuffer = fs.readFileSync(tmpOut);
                if (fs.existsSync(tmpOut)) fs.unlinkSync(tmpOut);
                resolve(webpBuffer);
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
    command: ['s', 'sticker', 'stiker'],
    category: 'converter',
    description: '> Mengubah gambar menjadi stiker WhatsApp',

    run: async (m, { conn, command, isOwner, isAdmin }) => {
        const pfx = m.prefix || '.';
        const cmd = command.toLowerCase();

        // Pemuatan Greet Engine Dinamis
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

        // 2. Ekstraksi Pesan yang Di-reply (Context Info Quoted Message)
        const contextInfo = msgObj.extendedTextMessage?.contextInfo || 
                            msgObj.imageMessage?.contextInfo || 
                            msgObj.videoMessage?.contextInfo;
                            
        let quotedMsg = contextInfo?.quotedMessage;
        if (quotedMsg?.ephemeralMessage) quotedMsg = quotedMsg.ephemeralMessage.message || quotedMsg;
        if (quotedMsg?.viewOnceMessage) quotedMsg = quotedMsg.viewOnceMessage.message || quotedMsg;
        if (quotedMsg?.viewOnceMessageV2) quotedMsg = quotedMsg.viewOnceMessageV2.message || quotedMsg;
        if (quotedMsg?.documentWithCaptionMessage) quotedMsg = quotedMsg.documentWithCaptionMessage.message || quotedMsg;

        // 3. Tentukan Target Media (Prioritaskan pesan reply, lalu pesan langsung)
        let targetMedia = null;
        if (quotedMsg?.imageMessage) {
            targetMedia = quotedMsg.imageMessage;
        } else if (msgObj?.imageMessage) {
            targetMedia = msgObj.imageMessage;
        }

        let mediaBuffer = null;

        if (targetMedia) {
            try {
                let baileys;
                try { baileys = await import('ourin'); } 
                catch { baileys = await import('@whiskeysockets/baileys'); }
                const { downloadContentFromMessage } = baileys;

                const stream = await downloadContentFromMessage(targetMedia, 'image');
                let chunks = [];
                for await (const chunk of stream) {
                    chunks.push(chunk);
                }
                mediaBuffer = Buffer.concat(chunks);
            } catch {}
        }

        if (!mediaBuffer) {
            return await m.reply(
                `${greeting}, gambar tidak ditemukan.\n\n╰› ᯓ *SYSTEM WARNING* ˎˊ˗\n\n*Panduan Penggunaan :*\nBalas (reply) gambar dengan perintah \`${pfx}${cmd}\` atau kirimkan gambar secara langsung dengan takarir (caption) \`${pfx}${cmd}\`.\n\nPastikan berkas yang dikirimkan berformat gambar.`
            );
        }

        try {
            const stickerWebp = await imageToWebp(mediaBuffer);
            await conn.sendMessage(m.chat, { sticker: stickerWebp }, { quoted: fakeReply });
        } catch (err) {
            await m.reply(
                `Gagal membuat stiker.\n\n╰› ᯓ *CONVERSION ERROR* ˎˊ˗\n\n• Pesan : ${err.message || 'Kendala pemrosesan berkas'}\n\nPastikan FFmpeg terpasang dengan baik di server.`
            );
        }
    }
};