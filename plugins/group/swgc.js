import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

let baileys;
try { baileys = await import('ourin'); } 
catch { baileys = await import('@whiskeysockets/baileys'); }
const { downloadContentFromMessage } = baileys;

export default {
    command: ['swgc', 'sw', 'swg'],
    category: 'group',
    description: '> Mengirim status grup (WhatsApp Story) dengan cincin hijau (teks, gambar, video, & audio)',

    run: async (m, { conn, text, command, isOwner, isAdmin }) => {
        if (!m.isGroup) {
            return await m.reply('Perintah ini hanya dapat digunakan di dalam grup.');
        }

        const pfx = m.prefix || '.';
        const cmd = command.toLowerCase();

        let greeting = '';
        try {
            const enginePath = pathToFileURL(path.resolve(process.cwd(), 'lib/engine/greet-engine.js')).href;
            const greetMod = await import(enginePath);
            const fnGreet = greetMod.getGreeting || greetMod.default?.getGreeting || greetMod.default;
            if (typeof fnGreet === 'function') {
                const res = fnGreet(m, { isOwner, isAdmin });
                greeting = typeof res === 'object' ? (res.prefix || res.text) : res;
            }
        } catch {}

        if (!greeting) {
            const hour = new Date().getHours();
            const ucapan = hour < 4 ? 'dini hari' : hour < 11 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam';
            greeting = `Selamat ${ucapan} ${isOwner ? 'Tuan Muda' : (isAdmin ? 'Admin' : 'Kak')} *${m.pushName || 'User'}*,`;
        }

        const tmpDir = path.resolve(process.cwd(), 'database', 'swgc');
        if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

        let mediaPath = null;

        try {
            // Ekstraksi manual quoted message dari contextInfo
            const contextInfo = m.msg?.contextInfo || m.message?.extendedTextMessage?.contextInfo;
            const quotedMessage = contextInfo?.quotedMessage;

            // Tentukan target: prioritaskan quoted message jika ada, jika tidak gunakan pesan saat ini
            let targetMsg = quotedMessage ? quotedMessage : (m.message || m.msg || m);

            // Kupas lapisan pembungkus pesan secara mendalam (ephemeral, viewOnce, dll)
            let innerMsg = targetMsg;
            for (let i = 0; i < 5; i++) {
                if (!innerMsg) break;
                if (innerMsg.ephemeralMessage) innerMsg = innerMsg.ephemeralMessage.message;
                else if (innerMsg.viewOnceMessage) innerMsg = innerMsg.viewOnceMessage.message;
                else if (innerMsg.viewOnceMessageV2) innerMsg = innerMsg.viewOnceMessageV2.message;
                else if (innerMsg.documentWithCaptionMessage) innerMsg = innerMsg.documentWithCaptionMessage.message;
                else if (innerMsg.message) innerMsg = innerMsg.message;
                else break;
            }

            let imageMsg = innerMsg?.imageManager || innerMsg?.imageMessage;
            let videoMsg = innerMsg?.videoMessage;
            let audioMsg = innerMsg?.audioMessage;

            let mediaType = null;
            let mediaObj = null;

            if (imageMsg) {
                mediaType = 'image';
                mediaObj = imageMsg;
            } else if (videoMsg) {
                mediaType = 'video';
                mediaObj = videoMsg;
            } else if (audioMsg) {
                mediaType = 'audio';
                mediaObj = audioMsg;
            }

            // Ambil teks: prioritas argumen command (misal: "wkwk"), jika kosong ambil dari teks/caption pesan yang direply
            let quotedText = innerMsg?.conversation || innerMsg?.extendedTextMessage?.text || innerMsg?.caption || '';
            let finalCaption = text || quotedText || '';

            if (!mediaObj && !finalCaption) {
                return await m.reply(
                    `${greeting} masukkan teks atau lampirkan/balas media untuk membuat status grup.\n\n` +
                    `╰› ᯓ *SYSTEM WARNING* ˎˊ˗\n\n` +
                    `*Format Penggunaan :*\n` +
                    `• \`${pfx}${cmd} <teks status>\`\n` +
                    `• Balas atau kirim gambar/video/audio dengan: \`${pfx}${cmd} <teks caption>\``
                );
            }

            if (mediaObj) {
                let ext = mediaType === 'image' ? '.jpg' : mediaType === 'video' ? '.mp4' : '.mp3';
                mediaPath = path.join(tmpDir, `${Date.now()}_${m.sender.split('@')[0]}${ext}`);
                
                const stream = await downloadContentFromMessage(mediaObj, mediaType);
                const writeStream = fs.createWriteStream(mediaPath);
                
                for await (const chunk of stream) {
                    writeStream.write(chunk);
                }
                writeStream.end();

                await new Promise((resolve, reject) => {
                    writeStream.on('finish', resolve);
                    writeStream.on('error', reject);
                });

                let content = {
                    groupStatusMessage: {
                        [mediaType]: { url: mediaPath },
                        ...(mediaType !== 'audio' && finalCaption ? { caption: finalCaption } : {})
                    }
                };

                let fallbackContent = {
                    [mediaType]: { url: mediaPath },
                    ...(mediaType !== 'audio' && finalCaption ? { caption: finalCaption } : {}),
                    groupStatus: true
                };

                try {
                    await conn.sendMessage(m.chat, content);
                } catch (err) {
                    await conn.sendMessage(m.chat, fallbackContent);
                }

            } else {
                let content = {
                    groupStatusMessage: {
                        text: finalCaption,
                        backgroundColor: '#FF1E1E1E', 
                        font: 1
                    }
                };

                let fallbackContent = {
                    text: finalCaption,
                    backgroundColor: '#FF1E1E1E',
                    font: 1,
                    groupStatus: true
                };

                try {
                    await conn.sendMessage(m.chat, content);
                } catch (err) {
                    await conn.sendMessage(m.chat, fallbackContent);
                }
            }

            await m.reply(
                `${greeting} status grup berhasil ditransmisikan.\n\n` +
                `╰› ᯓ *GROUP STATUS SUCCESS* ˎˊ˗\n\n` +
                `• *Status :* Cincin hijau aktif, silakan periksa profil grup.`
            );

        } catch (e) {
            console.error('[SWGC Engine Error]:', e);
            await m.reply(
                `Transmisi SWGC gagal diproses.\n\n` +
                `╰› ᯓ *SCRAPER ERROR* ˎˊ˗\n\n` +
                `• Pesan : ${e.message || 'Kendala saat mengirim status grup'}`
            );
        } finally {
            if (mediaPath && fs.existsSync(mediaPath)) {
                try {
                    fs.unlinkSync(mediaPath);
                } catch (err) {
                    console.error('Gagal membersihkan file sementara SWGC:', err);
                }
            }
        }
    }
};