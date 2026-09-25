import { Buffer } from 'buffer';

function extractMediaFromMessage(m) {
    const contextInfo = m.message?.extendedTextMessage?.contextInfo
        || m.msg?.contextInfo
        || m.message?.imageMessage?.contextInfo
        || m.message?.videoMessage?.contextInfo;

    const candidates = [
        m.quoted?.message,
        m.quoted?.msg,
        m.quoted,
        contextInfo?.quotedMessage
    ];

    for (const item of candidates) {
        if (!item) continue;
        let cur = item;

        for (let i = 0; i < 6; i++) {
            if (cur.ephemeralMessage?.message) cur = cur.ephemeralMessage.message;
            else if (cur.viewOnceMessage?.message) cur = cur.viewOnceMessage.message;
            else if (cur.viewOnceMessageV2?.message) cur = cur.viewOnceMessageV2.message;
            else if (cur.viewOnceMessageV2Extension?.message) cur = cur.viewOnceMessageV2Extension.message;
            else if (cur.documentWithCaptionMessage?.message) cur = cur.documentWithCaptionMessage.message;
            else break;
        }

        if (cur.imageMessage) {
            return { type: 'image', node: cur.imageMessage, caption: cur.imageMessage.caption || '' };
        }
        if (cur.videoMessage) {
            return { type: 'video', node: cur.videoMessage, caption: cur.videoMessage.caption || '' };
        }
        if (cur.audioMessage) {
            return { type: 'audio', node: cur.audioMessage, caption: '' };
        }

        if (cur.mimetype) {
            if (cur.mimetype.startsWith('image/')) return { type: 'image', node: cur, caption: cur.caption || '' };
            if (cur.mimetype.startsWith('video/')) return { type: 'video', node: cur, caption: cur.caption || '' };
            if (cur.mimetype.startsWith('audio/')) return { type: 'audio', node: cur, caption: '' };
        }
    }

    return null;
}

async function downloadMediaBuffer(targetNode, mediaType, q, conn) {
    if (typeof q?.download === 'function') {
        try {
            const buf = await q.download();
            if (buf && buf.length > 0) return buf;
        } catch {}
    }

    if (conn?.downloadMediaMessage && q) {
        try {
            const buf = await conn.downloadMediaMessage(q);
            if (buf && buf.length > 0) return buf;
        } catch {}
    }

    let downloadContentFromMessage;
    try {
        const ourin = await import('ourin');
        downloadContentFromMessage = ourin.downloadContentFromMessage;
    } catch {
        try {
            const baileys = await import('@whiskeysockets/baileys');
            downloadContentFromMessage = baileys.downloadContentFromMessage;
        } catch {}
    }

    if (downloadContentFromMessage) {
        const stream = await downloadContentFromMessage(targetNode, mediaType);
        let chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        const buf = Buffer.concat(chunks);
        if (buf && buf.length > 0) return buf;
    }

    return null;
}

export default {
    command: ['spill'],
    category: 'tools',
    description: 'Membuka dan mengirim ulang isi pesan sekali lihat tanpa quoted',

    run: async (m, { conn, usedPrefix, command }) => {
        const mediaData = extractMediaFromMessage(m);
        if (!mediaData) {
            return conn.sendMessage(m.chat, {
                text: `Balas pesan sekali lihat dengan perintah: ${usedPrefix + command}`
            }, { quoted: null });
        }

        try {
            const buffer = await downloadMediaBuffer(mediaData.node, mediaData.type, m.quoted, conn);
            if (!buffer || buffer.length === 0) {
                return conn.sendMessage(m.chat, {
                    text: 'Gagal mengunduh berkas media sekali lihat.'
                }, { quoted: null });
            }

            const captionText = mediaData.caption ? mediaData.caption : undefined;

            if (mediaData.type === 'image') {
                await conn.sendMessage(m.chat, {
                    image: buffer,
                    caption: captionText
                }, { quoted: null });
            } else if (mediaData.type === 'video') {
                await conn.sendMessage(m.chat, {
                    video: buffer,
                    caption: captionText,
                    mimetype: mediaData.node.mimetype || 'video/mp4'
                }, { quoted: null });
            } else if (mediaData.type === 'audio') {
                await conn.sendMessage(m.chat, {
                    audio: buffer,
                    mimetype: mediaData.node.mimetype || 'audio/mp4',
                    ptt: Boolean(mediaData.node.ptt)
                }, { quoted: null });
            }

        } catch (err) {
            console.error('[Spill Error]:', err);
            conn.sendMessage(m.chat, {
                text: `Gagal memproses pesan: ${err.message}`
            }, { quoted: null });
        }
    }
};