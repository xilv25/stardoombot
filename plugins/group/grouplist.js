import fs from 'fs';
import path from 'path';

// Direktori dan Basis Data
const DB_DIR = path.resolve(process.cwd(), 'database');
const DB_FILE = path.join(DB_DIR, 'group-list.json');
const MEDIA_DIR = path.join(DB_DIR, 'list_media');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(MEDIA_DIR)) fs.mkdirSync(MEDIA_DIR, { recursive: true });

function loadDB() {
    if (!fs.existsSync(DB_FILE)) return {};
    try {
        return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
    } catch {
        return {};
    }
}

function saveDB(data) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('[DATABASE LIST ERROR]', err.message);
    }
}

// Konteks Waktu dan Tanggal Indonesia (WIB)
function getWibContext() {
    const now = new Date();
    const dateStr = now.toLocaleDateString('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
        timeZone: 'Asia/Jakarta'
    });
    const timeStr = now.toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit',
        timeZone: 'Asia/Jakarta'
    }) + ' WIB';

    return { dateStr, timeStr };
}

// Parser Unduhan Media (Mendukung Media Langsung ataupun Quoted)
async function extractMedia(m) {
    let targetMsg = null;
    let isQuoted = false;

    // Cek apakah gambar dikirim langsung bersama caption perintah
    const msgObj = m.message?.imageMessage || m.message?.videoMessage || m.message?.audioMessage || m.message?.stickerMessage || m.message?.documentMessage;
    if (msgObj) {
        targetMsg = m;
    } 
    // Cek apakah gambar di-reply
    else if (m.quoted || m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        targetMsg = m.quoted ? m.quoted : { message: m.message.extendedTextMessage.contextInfo.quotedMessage };
        isQuoted = true;
    }

    if (!targetMsg) return null;

    const rawMsg = targetMsg.message || targetMsg.msg || targetMsg;
    const imageMsg = rawMsg.imageMessage || rawMsg.message?.imageMessage;
    const videoMsg = rawMsg.videoMessage || rawMsg.message?.videoMessage;
    const audioMsg = rawMsg.audioMessage || rawMsg.message?.audioMessage;
    const stickerMsg = rawMsg.stickerMessage || rawMsg.message?.stickerMessage;
    const docMsg = rawMsg.documentMessage || rawMsg.message?.documentMessage;

    let type = null;
    let ext = 'bin';
    let msgRef = null;

    if (imageMsg) { type = 'image'; ext = 'jpg'; msgRef = imageMsg; }
    else if (videoMsg) { type = 'video'; ext = 'mp4'; msgRef = videoMsg; }
    else if (audioMsg) { type = 'audio'; ext = 'mp3'; msgRef = audioMsg; }
    else if (stickerMsg) { type = 'sticker'; ext = 'webp'; msgRef = stickerMsg; }
    else if (docMsg) { type = 'document'; ext = 'bin'; msgRef = docMsg; }

    if (!type) return null;

    let buffer = null;
    try {
        if (typeof targetMsg.download === 'function') {
            buffer = await targetMsg.download();
        } else if (isQuoted && m.quoted && typeof m.quoted.download === 'function') {
            buffer = await m.quoted.download();
        } else {
            const baileys = await import('ourin');
            const downloadContentFromMessage = baileys.downloadContentFromMessage || baileys.default?.downloadContentFromMessage;
            const stream = await downloadContentFromMessage(msgRef, type);
            buffer = Buffer.from([]);
            for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }
        }
    } catch (e) {
        console.error("Gagal mendownload media list:", e);
        return null;
    }

    if (!buffer) return null;

    const fileName = `media_${Date.now()}.${ext}`;
    const filePath = path.join(MEDIA_DIR, fileName);
    fs.writeFileSync(filePath, buffer);

    return {
        type,
        path: filePath,
        fileName: msgRef.fileName || fileName,
        mimetype: msgRef.mimetype || '',
        caption: msgRef.caption || targetMsg.text || ''
    };
}

export default {
    command: ['list', 'grouplist', 'addlist', 'dellist', 'updatelist', 'listmsg'],
    category: 'group',
    description: '> Manajemen daftar list informasi grup dan panduannya',

    // Eksekusi Pesan Tanpa Prefix (Trigger Otomatis Panggilan List oleh Member)
    before: async (m, { conn }) => {
        if (m.isBaileys || !m.isGroup) return false;

        const rawText = (m.text || m.body || m.budy || m.message?.conversation || m.message?.extendedTextMessage?.text || '').trim();
        if (!rawText) return false;

        const db = loadDB();
        const groupData = db[m.chat];
        if (!groupData || !groupData.items) return false;

        const keyword = rawText.toLowerCase();
        const item = groupData.items[keyword];
        if (!item) return false;

        const senderTag = m.sender;

        // Balasan Teks Bersih
        if (item.type === 'text') {
            await conn.sendMessage(m.chat, {
                text: item.content,
                mentions: [senderTag]
            }, { quoted: m });
            return true;
        }

        // Balasan Media Lengkap Beserta Caption-nya
        if (item.path && fs.existsSync(item.path)) {
            const fileBuffer = fs.readFileSync(item.path);

            if (item.type === 'image') {
                await conn.sendMessage(m.chat, { image: fileBuffer, caption: item.caption || '', mentions: [senderTag] }, { quoted: m });
            } else if (item.type === 'video') {
                await conn.sendMessage(m.chat, { video: fileBuffer, caption: item.caption || '', mentions: [senderTag] }, { quoted: m });
            } else if (item.type === 'audio') {
                await conn.sendMessage(m.chat, { audio: fileBuffer, mimetype: item.mimetype || 'audio/mp4' }, { quoted: m });
            } else if (item.type === 'sticker') {
                await conn.sendMessage(m.chat, { sticker: fileBuffer }, { quoted: m });
            } else if (item.type === 'document') {
                await conn.sendMessage(m.chat, { document: fileBuffer, mimetype: item.mimetype || 'application/octet-stream', fileName: item.fileName || 'file' }, { quoted: m });
            }
            return true;
        }

        return false;
    },

    run: async (m, { conn, text, command, isAdmin, isOwner, isGroup }) => {
        if (!isGroup) {
            return await m.reply('Perintah ini hanya dapat digunakan di dalam grup.');
        }

        const cmd = command.toLowerCase();
        const pfx = m.prefix || '.';
        const db = loadDB();

        if (!db[m.chat]) {
            db[m.chat] = {
                template: '',
                items: {}
            };
        }

        const groupData = db[m.chat];

        // COMMAND: GROUPLIST
        if (cmd === 'grouplist') {
            const guideText = 
                `╰› ᯓ *PANDUAN FITUR GROUplist* ˎˊ˗\n\n` +
                `Fitur ini digunakan untuk mengelola daftar informasi otomatis di grup.\n\n` +
                `*1. Melihat Daftar List*\n` +
                `• \`${pfx}list\` : Memunculkan seluruh daftar kata kunci informasi grup.\n\n` +
                `*2. Menambah List (Khusus Admin)*\n` +
                `• \`${pfx}addlist <keyword> | <isi teks>\`\n` +
                `• Atau kirim gambar dengan caption / balas pesan dengan: \`${pfx}addlist <keyword>\`\n\n` +
                `*3. Memperbarui List (Khusus Admin)*\n` +
                `• \`${pfx}updatelist <keyword> | <isi baru>\`\n` +
                `• Atau kirim gambar pembaruan dengan caption: \`${pfx}updatelist <keyword>\``;

            return await m.reply(guideText);
        }

        // COMMAND: LIST
        if (cmd === 'list') {
            const keys = Object.keys(groupData.items || {});
            if (keys.length === 0) {
                return await m.reply(`Belum ada daftar list yang tersimpan di grup ini.\nAdmin dapat menambahkan dengan perintah \`${pfx}addlist\`.`);
            }

            let metaSubject = 'Grup';
            try {
                const groupMeta = await conn.groupMetadata(m.chat);
                metaSubject = groupMeta.subject || 'Grup';
            } catch {}

            const { dateStr, timeStr } = getWibContext();
            const userMention = `@${m.sender.split('@')[0]}`;

            const listContent = keys.map(k => `• *${k}*`).join('\n');

            let response = groupData.template;
            if (!response) {
                response = `Halo +user, berikut daftar informasi di +group\n\n` +
                           `• Tanggal : +date\n` +
                           `• Waktu : +hour\n\n` +
                           `╰› ᯓ *DAFTAR LIST* ˎˊ˗\n\n` +
                           `+list\n\n` +
                           `Ketik langsung kata kunci di atas untuk melihat detailnya.`;
            }

            let finalMsg = response
                .replace(/\+group/gi, metaSubject)
                .replace(/\+date/gi, dateStr)
                .replace(/\+hour/gi, timeStr)
                .replace(/\+user/gi, userMention);

            if (finalMsg.includes('+list')) {
                finalMsg = finalMsg.replace(/\+list/gi, listContent);
            } else {
                finalMsg = finalMsg + '\n\n╰› ᯓ *DAFTAR LIST* ˎˊ˗\n\n' + listContent;
            }

            return await m.reply(finalMsg, null, { mentions: [m.sender] });
        }

        // Validasi Hak Akses Admin / Owner
        if (!isAdmin && !isOwner) {
            return await m.reply('Akses ditolak. Pengaturan daftar list hanya dapat dikelola oleh admin grup.');
        }

        // COMMAND: ADDLIST
        if (cmd === 'addlist') {
            let cleanText = text || m.text || m.body || '';
            let [keyPart, ...valParts] = cleanText.split('|');
            let key = (keyPart || '').trim().toLowerCase();
            let content = valParts.join('|').trim();

            if (!key && m.quoted) {
                key = (text || '').trim().toLowerCase();
            }

            if (!key) {
                return await m.reply(
                    `*Format Penggunaan :*\n` +
                    `• \`${pfx}addlist <keyword> | <isi teks>\`\n` +
                    `• Kirim gambar dengan caption: \`${pfx}addlist <keyword> | <caption Utama>\``
                );
            }

            if (groupData.items[key]) {
                return await m.reply(`Kata kunci *${key}* sudah terdaftar. Gunakan \`${pfx}updatelist\` untuk memperbarui isinya.`);
            }

            const mediaObj = await extractMedia(m);
            if (mediaObj) {
                // Jika admin menulis teks setelah tanda '|', gunakan itu. Jika kosong, ambil caption dari gambarnya
                let finalCaption = content || mediaObj.caption || '';
                groupData.items[key] = {
                    type: mediaObj.type,
                    path: mediaObj.path,
                    fileName: mediaObj.fileName,
                    mimetype: mediaObj.mimetype,
                    caption: finalCaption
                };
            } else {
                const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const quotedText = m.quoted?.text || m.quoted?.caption || quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text || '';
                
                const finalContent = content || quotedText || '';
                if (!finalContent) {
                    return await m.reply('Harap cantumkan isi teks atau kirim gambar beserta caption perintahnya.');
                }
                groupData.items[key] = {
                    type: 'text',
                    content: finalContent
                };
            }

            saveDB(db);
            return await m.reply(`Kata kunci *${key}* berhasil ditambahkan ke dalam daftar.`);
        }

        // COMMAND: DELLIST (File Fisik Gambar Ikut Terhapus)
        if (cmd === 'dellist') {
            const key = (text || '').trim().toLowerCase();
            if (!key) {
                return await m.reply(`Format penggunaan: \`${pfx}dellist <keyword>\``);
            }

            if (!groupData.items[key]) {
                return await m.reply(`Kata kunci *${key}* tidak ditemukan di dalam daftar grup ini.`);
            }

            if (groupData.items[key].path && fs.existsSync(groupData.items[key].path)) {
                try {
                    fs.unlinkSync(groupData.items[key].path);
                } catch (e) {
                    console.error('[Gagal Hapus File Media List]:', e);
                }
            }

            delete groupData.items[key];
            saveDB(db);

            return await m.reply(`Kata kunci *${key}* beserta file medianya berhasil dihapus.`);
        }

        // COMMAND: UPDATELIST (Mendukung Pembaruan Gambar Langsung/Reply)
        if (cmd === 'updatelist') {
            let cleanText = text || m.text || m.body || '';
            let [keyPart, ...valParts] = cleanText.split('|');
            let key = (keyPart || '').trim().toLowerCase();
            let content = valParts.join('|').trim();

            if (!key && m.quoted) {
                key = (text || '').trim().toLowerCase();
            }

            if (!key) {
                return await m.reply(
                    `*Format Penggunaan :*\n` +
                    `• \`${pfx}updatelist <keyword> | <isi teks baru>\`\n` +
                    `• Kirim gambar baru dengan caption: \`${pfx}updatelist <keyword> | <caption baru>\``
                );
            }

            if (!groupData.items[key]) {
                return await m.reply(`Kata kunci *${key}* belum terdaftar. Gunakan \`${pfx}addlist\` untuk menambahkannya.`);
            }

            // Hapus file media lama jika ada agar tidak jadi sampah server
            if (groupData.items[key].path && fs.existsSync(groupData.items[key].path)) {
                try { fs.unlinkSync(groupData.items[key].path); } catch {}
            }

            const mediaObj = await extractMedia(m);
            if (mediaObj) {
                let finalCaption = content || mediaObj.caption || '';
                groupData.items[key] = {
                    type: mediaObj.type,
                    path: mediaObj.path,
                    fileName: mediaObj.fileName,
                    mimetype: mediaObj.mimetype,
                    caption: finalCaption
                };
            } else {
                const quotedMsg = m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
                const quotedText = m.quoted?.text || m.quoted?.caption || quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text || '';

                const finalContent = content || quotedText || '';
                if (!finalContent) {
                    return await m.reply('Harap cantumkan isi teks pembaruan atau kirim gambar beserta caption.');
                }
                groupData.items[key] = {
                    type: 'text',
                    content: finalContent
                };
            }

            saveDB(db);
            return await m.reply(`Data untuk kata kunci *${key}* berhasil diperbarui.`);
        }

        // COMMAND: LISTMSG
        if (cmd === 'listmsg') {
            const templateInput = (text || '').trim();

            if (!templateInput) {
                const currentTpl = groupData.template || '(Masih menggunakan templat standar)';
                return await m.reply(
                    `*Pengaturan Pesan Daftar List*\n\n` +
                    `*Templat Saat Ini :*\n${currentTpl}\n\n` +
                    `*Variabel Tersedia :*\n` +
                    `• \`+group\` : Menampilkan nama grup\n` +
                    `• \`+date\`  : Menampilkan tanggal (WIB)\n` +
                    `• \`+hour\`  : Menampilkan jam (WIB)\n` +
                    `• \`+user\`  : Menandai (@) pengguna yang memanggil\n` +
                    `• \`+list\`  : Letak daftar kata kunci\n\n` +
                    `*Contoh Penggunaan :*\n` +
                    `• \`${pfx}listmsg Halo +user, selamat datang di +group.\\n\\n+list\`\n` +
                    `• Ketik \`${pfx}listmsg reset\` untuk mengembalikan ke bentuk bawaan.`
                );
            }

            if (templateInput.toLowerCase() === 'reset') {
                groupData.template = '';
                saveDB(db);
                return await m.reply('Templat tampilan daftar list dikembalikan ke bentuk bawaan.');
            }

            groupData.template = templateInput;
            saveDB(db);
            return await m.reply('Templat tampilan daftar list berhasil disimpan.');
        }
    }
};