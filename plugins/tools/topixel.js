import greetEngine from '../../lib/engine/greet-engine.js';

// Ekstraktor Gambar Mendalam (Mendukung Penuh Reply, Quoted, ViewOnce, dan Caption)
async function extractImageBuffer(m, conn) {
    let imageMessage = null;
    let quotedObj = m.quoted ? m.quoted : null;

    // Prioritas A: ContextInfo mentah (Reply standar)
    const rawQuoted = m.message?.extendedTextMessage?.contextInfo?.quotedMessage 
                   || m.msg?.contextInfo?.quotedMessage;

    if (rawQuoted) {
        let target = rawQuoted;
        if (target.viewOnceMessage?.message) target = target.viewOnceMessage.message;
        if (target.viewOnceMessageV2?.message) target = target.viewOnceMessageV2.message;
        if (target.ephemeralMessage?.message) target = target.ephemeralMessage.message;
        if (target.documentWithCaptionMessage?.message) target = target.documentWithCaptionMessage.message;

        if (target.imageMessage) imageMessage = target.imageMessage;
    }

    // Prioritas B: Serializer m.quoted
    if (!imageMessage && quotedObj) {
        let target = quotedObj.message || quotedObj.msg || quotedObj;
        if (target.viewOnceMessage?.message) target = target.viewOnceMessage.message;
        if (target.viewOnceMessageV2?.message) target = target.viewOnceMessageV2.message;

        if (target.imageMessage) {
            imageMessage = target.imageMessage;
        } else if (quotedObj.mtype === 'imageMessage' || /image/i.test(quotedObj.mimetype || '')) {
            imageMessage = quotedObj.msg || quotedObj;
        }
    }

    // Prioritas C: Kirim gambar langsung dengan caption
    if (!imageMessage) {
        let target = m.message || m.msg || m;
        if (target.viewOnceMessage?.message) target = target.viewOnceMessage.message;
        if (target.viewOnceMessageV2?.message) target = target.viewOnceMessageV2.message;

        if (target.imageMessage) {
            imageMessage = target.imageMessage;
        } else if (m.mtype === 'imageMessage' || /image/i.test(m.mimetype || '')) {
            imageMessage = m.msg || m;
        }
    }

    // Eksekusi Download
    if (quotedObj && typeof quotedObj.download === 'function') {
        try {
            const buf = await quotedObj.download();
            if (Buffer.isBuffer(buf) && buf.length > 0) return buf;
        } catch (e) {}
    }

    if (imageMessage) {
        try {
            let baileysLib;
            try { baileysLib = await import('ourin'); } 
            catch { baileysLib = await import('@whiskeysockets/baileys'); }
            const { downloadContentFromMessage } = baileysLib;

            if (downloadContentFromMessage) {
                const stream = await downloadContentFromMessage(imageMessage, 'image');
                let buffer = Buffer.from([]);
                for await (const chunk of stream) {
                    buffer = Buffer.concat([buffer, chunk]);
                }
                if (buffer.length > 0) return buffer;
            }
        } catch (e) {}

        if (conn && typeof conn.downloadMediaMessage === 'function') {
            try {
                const buf = await conn.downloadMediaMessage({
                    key: quotedObj?.key || m.key,
                    message: { imageMessage }
                });
                if (Buffer.isBuffer(buf) && buf.length > 0) return buf;
            } catch (e) {}
        }
    }

    if (typeof m.download === 'function') {
        try {
            const buf = await m.download();
            if (Buffer.isBuffer(buf) && buf.length > 0) return buf;
        } catch (e) {}
    }

    return null;
}

// Mesin Pembuat Piksel (Kotak disetel lebih kecil & rapat)
async function processPixelate(buffer, level = 5) {
    // Makin kecil angka level, makin kecil & halus ukuran kotak pixelnya (rentang 2 - 30)
    const pixelSize = Math.max(2, Math.min(level, 30));

    // Metode 1: Menggunakan Jimp
    try {
        let jimpMod;
        try { jimpMod = await import('jimp'); } catch {}
        const Jimp = jimpMod?.default || jimpMod?.Jimp || jimpMod;

        if (Jimp && typeof Jimp.read === 'function') {
            const img = await Jimp.read(buffer);
            const w = img.bitmap?.width || 500;
            const h = img.bitmap?.height || 500;
            const sw = Math.max(1, Math.round(w / pixelSize));
            const sh = Math.max(1, Math.round(h / pixelSize));

            if (typeof img.pixelate === 'function') {
                img.pixelate(pixelSize);
            } else {
                const nearest = Jimp.RESIZE_NEAREST_NEIGHBOR || 'nearestNeighbor';
                img.resize(sw, sh, nearest);
                img.resize(w, h, nearest);
            }

            const mime = Jimp.MIME_JPEG || 'image/jpeg';
            if (typeof img.getBufferAsync === 'function') {
                return await img.getBufferAsync(mime);
            } else if (typeof img.getBuffer === 'function') {
                return await img.getBuffer(mime);
            }
        }
    } catch (e) {
        console.error('[Jimp Error]:', e);
    }

    // Metode 2: Menggunakan Sharp (Fallback)
    try {
        let sharpMod;
        try { sharpMod = await import('sharp'); } catch {}
        const sharp = sharpMod?.default || sharpMod;

        if (sharp) {
            const meta = await sharp(buffer).metadata();
            const w = meta.width || 500;
            const h = meta.height || 500;
            const smallW = Math.max(1, Math.round(w / pixelSize));
            const smallH = Math.max(1, Math.round(h / pixelSize));

            return await sharp(buffer)
                .resize(smallW, smallH, { kernel: 'nearest' })
                .resize(w, h, { kernel: 'nearest' })
                .jpeg({ quality: 95 })
                .toBuffer();
        }
    } catch (e) {
        console.error('[Sharp Error]:', e);
    }

    throw new Error('Pustaka pengolah gambar (Jimp/Sharp) tidak dapat dimuat.');
}

export default {
    command: ['topixel', 'pixel', 'pixelate'],
    category: 'maker',
    description: 'Mengubah gambar menjadi pixel art halus (Mendukung Reply & Caption)',

    run: async (m, { conn, text, command, usedPrefix, isOwner, isAdmin }) => {
        const pfx = usedPrefix || m.prefix || '.';
        const cmd = command ? command.toLowerCase() : 'topixel';

        const pushName = m.pushName || 'User';
        let greeting = '';
        try {
            const fnGreet = typeof greetEngine === 'function' ? greetEngine : (greetEngine?.getGreeting || greetEngine?.default);
            if (typeof fnGreet === 'function') {
                const res = fnGreet(m, { isOwner, isAdmin });
                greeting = typeof res === 'object' ? (res.prefix || res.text || '') : res;
            }
        } catch {}

        if (!greeting) {
            const hour = new Date().getHours();
            const ucapan = hour < 4 ? 'dini hari' : hour < 11 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam';
            greeting = `Selamat ${ucapan} ${isOwner ? 'Tuan Muda' : (isAdmin ? 'Admin' : 'Kak')} *${pushName}*,`;
        }

        try {
            const imageBuffer = await extractImageBuffer(m, conn);

            if (!imageBuffer) {
                const warnText = `${greeting} berkas gambar tidak ditemukan.\n\n` +
                                 `╰› ᯓ *SYSTEM WARNING* ˎˊ˗\n\n` +
                                 `*Format Penggunaan :*\n` +
                                 `• Balas (*reply*) gambar dengan: \`${pfx}${cmd}\`\n` +
                                 `• Kirim gambar dengan *caption*: \`${pfx}${cmd}\`\n` +
                                 `• Atur kehalusan piksel (2 – 20): \`${pfx}${cmd} 3\` *(makin kecil angkanya, makin halus kotaknya)*\n\n` +
                                 `Silakan balas foto yang ingin diubah menjadi piksel.`;

                return await m.reply(warnText, m.chat, { mentions: [m.sender] });
            }

            // Default level diubah ke 5 (jauh lebih halus dari sebelumnya)
            const inputLevel = parseInt(text?.trim()) || 5;
            const resultBuffer = await processPixelate(imageBuffer, inputLevel);

            await conn.sendMessage(m.chat, { image: resultBuffer }, { quoted: m });

        } catch (e) {
            console.error('[Topixel Error]:', e);
            const errText = `${greeting} gagal memproses gambar menjadi piksel.\n\n` +
                            `╰› ᯓ *SYSTEM ERROR* ˎˊ˗\n\n` +
                            `• *Pesan :* ${e.message || 'Kendala pada modul media.'}\n\n` +
                            `Sistem gagal memproses permintaan.`;

            await m.reply(errText, m.chat, { mentions: [m.sender] });
        }
    }
};