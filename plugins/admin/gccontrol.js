import fs from 'fs';
import path from 'path';
import greetEngine from '../../lib/engine/greet-engine.js';
import { addWarn, getGroupSettings, updateGroupSettings, isTargetImmune } from './warn.js';

const BASE_STORAGE_DIR = path.join(process.cwd(), 'src', 'gccontrol');
if (!fs.existsSync(BASE_STORAGE_DIR)) {
    fs.mkdirSync(BASE_STORAGE_DIR, { recursive: true });
}

function getWIBTime(ts = Date.now()) {
    try {
        return new Date(ts).toLocaleTimeString('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }) + ' WIB';
    } catch {
        const d = new Date(ts);
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        const wib = new Date(utc + (3600000 * 7));
        const pad = n => String(n).padStart(2, '0');
        return `${pad(wib.getHours())}:${pad(wib.getMinutes())}:${pad(wib.getSeconds())} WIB`;
    }
}

const botDeletedIds = new Set();
function registerBotDelete(msgId) {
    if (!msgId) return;
    botDeletedIds.add(msgId);
    setTimeout(() => botDeletedIds.delete(msgId), 5 * 60 * 1000);
}

const spamTracker = new Map();
const vipWarnCache = new Set();

// Daftar Frasa Netral / Whitelist 3 Kata (Pengecualian Khusus)
const WHITELIST_PHRASES = [
    /ngocok\s+(arisan|dadu|kartu|semen|cat)/i,
    /(lagi|ikut|sedang)\s+ngocok\s+arisan/i,
    /arisan\s+kocok/i,
    /(kucing|anjing|bebek)\s+(mandi|dimandiin)/i,
    /mandi\s+(kucing|puss|anabul)/i
];

// Sensor Teks Porno / Singkatan
const PORN_REGEX = /\b(b+o*k+e*p+|bkp|porn|porno|xvideos|xnxx|hentai|nekopoi|onlyfans|c+o*l+m+e*k+|clmk|ngocok|k+o*n*t+o*l+|kntl|m+e*m+e*k+|mmk|t+e+t+e+|p+e*p+e*k+|ppk|bugil|telanjang|javhd|redporn)\b/i;
const LINK_REGEX = /(https?:\/\/[^\s]+|chat\.whatsapp\.com\/[^\s]+|wa\.me\/[^\s]+|bit\.ly\/[^\s]+|t\.me\/[^\s]+|instagram\.com\/[^\s]+|tiktok\.com\/[^\s]+|youtube\.com\/[^\s]+|youtu\.be\/[^\s]+|[a-zA-Z0-9][-a-zA-Z0-90-]+\.(com|net|org|edu|gov|mil|io|me|id|cc|to|co|uk|us|info|biz))/i;

function isPornContent(text) {
    if (!text || typeof text !== 'string') return false;
    const clean = text.trim();
    if (!PORN_REGEX.test(clean)) return false;
    for (const phrase of WHITELIST_PHRASES) {
        if (phrase.test(clean)) return false;
    }
    return true;
}

function isVirtex(text) {
    if (!text) return false;
    if (text.length > 8000) return true;
    const invisibleCount = (text.match(/[\u200B-\u200D\uFEFF\u061C\u2066-\u2069]/g) || []).length;
    if (invisibleCount > 150) return true;
    const combiningCount = (text.match(/[\u0300-\u036F\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/g) || []).length;
    return combiningCount > 200;
}

async function checkBotIsAdmin(conn, chatId) {
    try {
        const groupMeta = await conn.groupMetadata(chatId);
        const botJid = (conn.user?.id || '').split(':')[0] + '@s.whatsapp.net';
        return groupMeta.participants.some(p => (p.id === botJid || p.jid === botJid) && p.admin);
    } catch {
        return false;
    }
}

async function downloadMediaBuffer(m, msg, mtype) {
    try {
        if (typeof m.download === 'function') {
            return await m.download();
        }
        const streamType = mtype.replace('Message', '');
        const targetMedia = msg[mtype];
        if (!targetMedia || !targetMedia.mediaKey) return null;

        const { downloadContentFromMessage } = await import('@whiskeysockets/baileys');
        const stream = await downloadContentFromMessage(targetMedia, streamType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
        }
        return buffer;
    } catch (err) {
        return null;
    }
}

function getChatStorageDir(chatId) {
    const dir = path.join(BASE_STORAGE_DIR, chatId.replace(/[^a-zA-Z0-9_-]/g, '_'));
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return dir;
}

function manageQueueAndSave(chatId, msgId, metaData, mediaBuffer = null) {
    try {
        const chatDir = getChatStorageDir(chatId);
        const queueFile = path.join(chatDir, 'queue.json');

        let queue = [];
        if (fs.existsSync(queueFile)) {
            try { queue = JSON.parse(fs.readFileSync(queueFile, 'utf-8')); } catch { queue = []; }
        }

        if (mediaBuffer && metaData.mediaExt) {
            const mediaFileName = `${msgId}.${metaData.mediaExt}`;
            fs.writeFileSync(path.join(chatDir, mediaFileName), mediaBuffer);
            metaData.mediaFileName = mediaFileName;
        }

        fs.writeFileSync(path.join(chatDir, `${msgId}.json`), JSON.stringify(metaData));
        queue.push(msgId);

        while (queue.length > 20) {
            const oldId = queue.shift();
            const oldMetaPath = path.join(chatDir, `${oldId}.json`);

            if (fs.existsSync(oldMetaPath)) {
                try {
                    const oldMeta = JSON.parse(fs.readFileSync(oldMetaPath, 'utf-8'));
                    if (oldMeta.mediaFileName) {
                        const oldMediaFile = path.join(chatDir, oldMeta.mediaFileName);
                        if (fs.existsSync(oldMediaFile)) fs.unlinkSync(oldMediaFile);
                    }
                    fs.unlinkSync(oldMetaPath);
                } catch {}
            }
        }

        fs.writeFileSync(queueFile, JSON.stringify(queue));
    } catch {}
}

function getCachedMessage(chatId, msgId) {
    const chatDir = getChatStorageDir(chatId);
    const metaPath = path.join(chatDir, `${msgId}.json`);
    if (!fs.existsSync(metaPath)) return null;

    try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
        let mediaBuffer = null;

        if (meta.mediaFileName) {
            const mediaPath = path.join(chatDir, meta.mediaFileName);
            if (fs.existsSync(mediaPath)) {
                mediaBuffer = fs.readFileSync(mediaPath);
                fs.unlinkSync(mediaPath);
            }
        }

        fs.unlinkSync(metaPath);

        const queueFile = path.join(chatDir, 'queue.json');
        if (fs.existsSync(queueFile)) {
            try {
                let queue = JSON.parse(fs.readFileSync(queueFile, 'utf-8'));
                queue = queue.filter(id => id !== msgId);
                fs.writeFileSync(queueFile, JSON.stringify(queue));
            } catch {}
        }

        return { ...meta, mediaBuffer };
    } catch {
        return null;
    }
}

export default {
    command: [
        'gccontrol', 'gccstatus', 'antidelete', 'antispam',
        'antisticker', 'antivirtex', 'antipicture', 'antivoice',
        'antiporn', 'antinude', 'antilink', 'antibot', 'anti'
    ],
    category: 'admin',
    description: '> Pusat kendali keamanan grup dan pemulihan pesan/media terhapus',

    before: async (m, { conn }) => {
        if (!m.isGroup || !m.chat) return false;

        const botJid = (conn.user?.id || '').split(':')[0] + '@s.whatsapp.net';
        const senderJid = m.sender || m.key?.participant || m.participant || '';

        // 1. KEBAL MUTLAK UNTUK BOT SENDIRI (Termasuk dari Teguran & Logging)
        if (m.fromMe || m.key?.fromMe || senderJid.includes(botJid.split('@')[0])) {
            return false;
        }

        const chatId = m.chat;
        const cfg = getGroupSettings(chatId);

        // 2. CEK STATUS VIP (Owner, Admin, Trusted Member)
        let isSenderImmune = false;
        if (typeof isTargetImmune === 'function') {
            try {
                isSenderImmune = await isTargetImmune(conn, chatId, senderJid);
            } catch {}
        }

        // Helper Teguran VIP
        const warnVIP = async (tipe) => {
            const key = `${chatId}_${senderJid}_${tipe}`;
            if (vipWarnCache.has(key)) return;
            vipWarnCache.add(key);
            setTimeout(() => vipWarnCache.delete(key), 60000);

            const msg = `╰› ᯓ *VIP ADVISORY NOTICE* ˎˊ˗\n\n` +
                `• *Target :* @${senderJid.split('@')[0]}\n` +
                `• *Kategori :* ${tipe}\n` +
                `• *Keterangan :* Pelanggaran terdeteksi. Pesan tidak dihapus karena memiliki otoritas grup, mohon tetap mematuhi regulasi obrolan.`;

            if (typeof m.reply === 'function') {
                await m.reply(msg, chatId, { mentions: [senderJid] });
            } else {
                await conn.sendMessage(chatId, { text: msg, mentions: [senderJid] });
            }
        };

        // A. DETEKSI PROTOKOL REVOKE / HAPUS PESAN
        const proto =
            m.message?.protocolMessage ||
            m.msg?.protocolMessage ||
            m.message?.ephemeralMessage?.message?.protocolMessage;

        const isRevoke = Boolean(
            proto && proto.key &&
            (proto.type === 0 || proto.type === 'REVOKE' || proto.type === 'revoke' || !proto.type)
        );

        if (isRevoke) {
            if (cfg.antidelete) {
                const targetKey = proto.key;
                const deletedMsgId = targetKey?.id;

                if (deletedMsgId) {
                    const deleterJid = m.key?.participant || m.participant || m.sender;

                    let isDeleterImmune = botDeletedIds.has(deletedMsgId);
                    if (!isDeleterImmune && typeof isTargetImmune === 'function') {
                        try {
                            isDeleterImmune = await isTargetImmune(conn, chatId, deleterJid);
                        } catch {}
                    }

                    if (isDeleterImmune) {
                        getCachedMessage(chatId, deletedMsgId);
                        return false;
                    }

                    const cached = getCachedMessage(chatId, deletedMsgId);
                    
                    if (cached) {
                        if (cached.isPorn || isPornContent(cached.text || '')) {
                            return false;
                        }

                        const originalSender = cached.sender || targetKey.participant || m.sender;
                        const senderTag = `@${originalSender.split('@')[0]}`;
                        const sendTime = cached.time || getWIBTime();
                        const captionText = cached.text || '';

                        const infoHeader =
                            `╰› ᯓ *PESAN TERHAPUS TERDETEKSI* ˎˊ˗\n\n` +
                            `• *Pengirim :* ${senderTag}\n` +
                            `• *Tipe Pesan :* ${cached.typeLabel || 'Teks'}\n` +
                            `• *Waktu Pengiriman :* ${sendTime}\n`;

                        if (cached.mediaBuffer) {
                            const mtype = cached.rawType;
                            if (mtype === 'imageMessage') {
                                await conn.sendMessage(chatId, { image: cached.mediaBuffer, caption: `${infoHeader}\n*Isi Pesan / Caption :*\n${captionText || '_(Tanpa teks)_'}`, mentions: [originalSender] });
                            } else if (mtype === 'videoMessage') {
                                await conn.sendMessage(chatId, { video: cached.mediaBuffer, caption: `${infoHeader}\n*Isi Pesan / Caption :*\n${captionText || '_(Tanpa teks)_'}`, mentions: [originalSender] });
                            } else if (mtype === 'audioMessage') {
                                await conn.sendMessage(chatId, { text: infoHeader, mentions: [originalSender] });
                                await conn.sendMessage(chatId, { audio: cached.mediaBuffer, mimetype: 'audio/mp4', ptt: Boolean(cached.isPtt) });
                            } else if (mtype === 'stickerMessage') {
                                await conn.sendMessage(chatId, { text: infoHeader, mentions: [originalSender] });
                                await conn.sendMessage(chatId, { sticker: cached.mediaBuffer });
                            } else if (mtype === 'documentMessage') {
                                await conn.sendMessage(chatId, { document: cached.mediaBuffer, mimetype: cached.mimetype || 'application/octet-stream', fileName: cached.fileName || 'Dokumen', caption: `${infoHeader}\n*Isi Pesan / Caption :*\n${captionText || '_(Tanpa teks)_'}`, mentions: [originalSender] });
                            }
                        } else {
                            await conn.sendMessage(chatId, { text: `${infoHeader}\n*Isi Pesan :*\n${captionText || '_(Pesan kosong)_'}`, mentions: [originalSender] });
                        }
                    }
                }
            }
            return false;
        }

        // B. SIMPAN PESAN AKTIF KE DISK
        const currentMsgId = m.key?.id || m.id;
        if (cfg.antidelete && currentMsgId) {
            const rawMsg = m.message?.ephemeralMessage?.message || m.message || m.msg || {};
            const keys = Object.keys(rawMsg);
            const mtype = keys.find(k => k.endsWith('Message')) || keys[0] || 'conversation';

            const sender = m.key?.participant || m.sender || m.participant;
            const textBody = (m.text || m.body || rawMsg.conversation || rawMsg.extendedTextMessage?.text || rawMsg[mtype]?.caption || '').trim();

            let typeLabel = 'Teks', mediaExt = null, isMedia = false, isPtt = false;
            if (mtype === 'imageMessage') { typeLabel = 'Gambar / Foto'; mediaExt = 'jpg'; isMedia = true; } 
            else if (mtype === 'videoMessage') { typeLabel = 'Video'; mediaExt = 'mp4'; isMedia = true; } 
            else if (mtype === 'audioMessage') { typeLabel = rawMsg.audioMessage?.ptt ? 'Voice Note (VN)' : 'Audio'; mediaExt = 'ogg'; isMedia = true; isPtt = Boolean(rawMsg.audioMessage?.ptt); } 
            else if (mtype === 'stickerMessage') { typeLabel = 'Stiker'; mediaExt = 'webp'; isMedia = true; } 
            else if (mtype === 'documentMessage') { typeLabel = 'Dokumen'; mediaExt = 'bin'; isMedia = true; }

            const metaData = {
                sender: sender, rawType: mtype, typeLabel: typeLabel, text: textBody, mediaExt: mediaExt,
                isPtt: isPtt, isPorn: isPornContent(textBody), fileName: rawMsg.documentMessage?.fileName || null,
                mimetype: rawMsg[mtype]?.mimetype || null, time: getWIBTime(), timestamp: Date.now()
            };

            if (isMedia) {
                downloadMediaBuffer(m, rawMsg, mtype).then(buf => {
                    if (buf) manageQueueAndSave(chatId, currentMsgId, metaData, buf);
                    else manageQueueAndSave(chatId, currentMsgId, metaData);
                }).catch(() => manageQueueAndSave(chatId, currentMsgId, metaData));
            } else {
                manageQueueAndSave(chatId, currentMsgId, metaData);
            }
        }

        const botAdmin = await checkBotIsAdmin(conn, chatId);
        const textContent = m.text || m.body || m.message?.conversation || m.message?.extendedTextMessage?.text || '';

        // C. DETEKSI ANTI-BOT
        const isForeignBot = (m.isBaileys || /^(BAE5|3EB0|FZZ|B1E)/.test(currentMsgId));
        if (cfg.antibot && isForeignBot) {
            if (isSenderImmune) return false;
            if (botAdmin) {
                registerBotDelete(m.key?.id);
                await conn.sendMessage(chatId, { delete: m.key });
                await conn.sendMessage(chatId, { text: `╰› ᯓ *SECURITY ALERT* ˎˊ˗\n\nBot asing terdeteksi (@${m.sender.split('@')[0]}). Menendang bot dari grup...`, mentions: [m.sender] });
                await conn.groupParticipantsUpdate(chatId, [m.sender], 'remove');
                return true;
            }
        }

        // D. DETEKSI ANTI-VIRTEX
        if (cfg.antivirtex && isVirtex(textContent)) {
            if (isSenderImmune) {
                await warnVIP('Anti-Virtex');
                return false;
            }
            if (botAdmin) {
                registerBotDelete(m.key?.id);
                await conn.sendMessage(chatId, { delete: m.key });
                await conn.sendMessage(chatId, { text: `╰› ᯓ *SECURITY ALERT* ˎˊ˗\n\nPesan virtex terdeteksi dari @${m.sender.split('@')[0]}. Pelaku otomatis dikeluarkan dari grup.`, mentions: [m.sender] });
                await conn.groupParticipantsUpdate(chatId, [m.sender], 'remove');
                return true;
            }
        }

        // E. ANTI-PICTURE
        const isImage = m.mtype === 'imageMessage' || !!m.message?.imageMessage;
        if (cfg.antipicture && isImage) {
            if (isSenderImmune) { await warnVIP('Anti-Picture'); return false; }
            if (botAdmin) { registerBotDelete(m.key?.id); await conn.sendMessage(chatId, { delete: m.key }); }
            await addWarn(conn, chatId, m.sender, 1, 'Mengirim gambar saat proteksi anti-picture aktif');
            return true;
        }

        // F. ANTI-VOICE
        const isVoice = m.mtype === 'audioMessage' || !!m.message?.audioMessage;
        if (cfg.antivoice && isVoice) {
            if (isSenderImmune) { await warnVIP('Anti-Voice'); return false; }
            if (botAdmin) { registerBotDelete(m.key?.id); await conn.sendMessage(chatId, { delete: m.key }); }
            await addWarn(conn, chatId, m.sender, 1, 'Mengirim voice note saat proteksi anti-voice aktif');
            return true;
        }

        // G. ANTI-STICKER
        const isSticker = m.mtype === 'stickerMessage' || !!m.message?.stickerMessage;
        if (cfg.antisticker && isSticker) {
            if (isSenderImmune) { await warnVIP('Anti-Sticker'); return false; }
            if (botAdmin) { registerBotDelete(m.key?.id); await conn.sendMessage(chatId, { delete: m.key }); }
            await addWarn(conn, chatId, m.sender, 1, 'Mengirim stiker saat proteksi anti-sticker aktif');
            return true;
        }

        // H. ANTI-PORN (Didukung Filter Frasa Kontekstual)
        const isPornActive = cfg.antiporn !== undefined ? cfg.antiporn : cfg.antinude;
        if (isPornActive && isPornContent(textContent)) {
            if (isSenderImmune) { await warnVIP('Anti-Porn'); return false; }
            if (botAdmin) { registerBotDelete(m.key?.id); await conn.sendMessage(chatId, { delete: m.key }); }
            await addWarn(conn, chatId, m.sender, 1, 'Mengirim konten berbau pornografi');
            return true;
        }

        // I. ANTI-LINK
        if (cfg.antilink && textContent && LINK_REGEX.test(textContent)) {
            if (isSenderImmune) { await warnVIP('Anti-Link'); return false; }
            if (botAdmin) { registerBotDelete(m.key?.id); await conn.sendMessage(chatId, { delete: m.key }); }
            await addWarn(conn, chatId, m.sender, 1, 'Mengirim tautan saat proteksi anti-link aktif');
            return true;
        }

        // J. ANTI-SPAM
        if (cfg.antispam) {
            const now = Date.now();
            const userKey = `${chatId}_${m.sender}`;
            const timestamps = spamTracker.get(userKey) || [];
            const recent = timestamps.filter(t => now - t < 3000);
            recent.push(now);
            spamTracker.set(userKey, recent);

            if (recent.length >= 5) {
                spamTracker.delete(userKey);
                if (isSenderImmune) { await warnVIP('Anti-Spam'); return false; }
                if (botAdmin) { registerBotDelete(m.key?.id); await conn.sendMessage(chatId, { delete: m.key }); }
                await addWarn(conn, chatId, m.sender, 1, 'Melakukan spam pesan');
                return true;
            }
        }

        return false;
    },

    run: async (m, { conn, text, command, usedPrefix, isGroup }) => {
        const pfx = usedPrefix || m.prefix || '.';
        const cmd = command ? command.toLowerCase() : 'gccontrol';
        const pushName = m.pushName || 'User';

        const replySafe = async (content) => {
            if (typeof m.reply === 'function') {
                return await m.reply(content, m.chat);
            }
            return await conn.sendMessage(m.chat, { text: content });
        };

        let greeting = '';
        try {
            const fnGreet = typeof greetEngine === 'function' ? greetEngine : (greetEngine?.getGreeting || greetEngine?.default);
            if (typeof fnGreet === 'function') {
                const res = fnGreet(m, { isOwner: false, isAdmin: false });
                greeting = typeof res === 'object' ? (res.prefix || res.text || '') : res;
            }
        } catch {}

        if (!greeting) {
            const hour = new Date().getHours();
            const ucapan = hour < 4 ? 'dini hari' : hour < 11 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam';
            greeting = `Selamat ${ucapan} Tuan Muda/Admin *${pushName}*,`;
        }

        if (!isGroup) return await replySafe(`${greeting} fitur pengelolaan proteksi grup hanya dapat digunakan di dalam grup.`);

        const chatId = m.chat;
        const currentCfg = getGroupSettings(chatId);

        if (cmd === 'gccontrol') {
            const manual = `${greeting} berikut panduan operasional sistem keamanan grup beserta rincian sanksinya.\n\n` +
                `╰› ᯓ *GROUP CONTROL DASHBOARD* ˎˊ˗\n\n` +
                `*Daftar Perintah & Detail Sanksi :*\n` +
                `• \`${pfx}antidelete on/off\`\n  › Menampilkan ulang teks, VN, foto, atau video yang dihapus member.\n` +
                `• \`${pfx}antispam on/off\`\n  › Mendeteksi spam (≥5 pesan dalam 3 detik), menghapus pesan, dan menambah *+1 Warn*.\n` +
                `• \`${pfx}antisticker on/off\`\n  › Menghapus stiker dan menambah *+1 Warn*.\n` +
                `• \`${pfx}antivirtex on/off\`\n  › Menghapus pesan virtex dan *menendang* pelaku.\n` +
                `• \`${pfx}antipicture on/off\`\n  › Menghapus gambar/foto dan menambah *+1 Warn*.\n` +
                `• \`${pfx}antivoice on/off\`\n  › Menghapus voice note dan menambah *+1 Warn*.\n` +
                `• \`${pfx}antiporn on/off\`\n  › Menghapus teks/tautan porno dan menambah *+1 Warn*.\n` +
                `• \`${pfx}antilink on/off\`\n  › Menghapus tautan dan menambah *+1 Warn*.\n` +
                `• \`${pfx}antibot on/off\`\n  › Mendeteksi bot asing dan *menendang* bot tersebut.\n\n` +
                `*Perintah Manajemen Warn & Trusted :*\n` +
                `• \`${pfx}warn\` : Cek jumlah warn.\n• \`${pfx}setwarn <1-10>\` : Atur batas maksimal warn.\n` +
                `• \`${pfx}addwarn @member <1-10>\` : Beri warn manual.\n• \`${pfx}resetwarn @member\` : Hapus riwayat warn.\n` +
                `• \`${pfx}trust @member\` : Kebal dari semua sanksi.\n• \`${pfx}untrust @member\` : Cabut status kebal.\n\n` +
                `> Catatan: Owner, Admin Grup, Bot, dan Trusted Member sepenuhnya kebal sanksi dan menerima teguran tertulis sistem.`;
            return await replySafe(manual);
        }

        if (cmd === 'gccstatus') {
            const statusLabel = (val) => (val ? '[ ON ]' : '[ OFF ]');
            const isPornVal = currentCfg.antiporn !== undefined ? currentCfg.antiporn : currentCfg.antinude;
            const statusReport = `${greeting} berikut status konfigurasi proteksi aktif di grup ini.\n\n` +
                `╰› ᯓ *GROUP CONFIGURATION STATUS* ˎˊ˗\n\n` +
                `• *Batas Maksimal Warn :* ${currentCfg.maxwarn} kali pelanggaran\n\n` +
                `*Daftar Sakelar Keamanan :*\n` +
                `• Anti Delete   : ${statusLabel(currentCfg.antidelete)}\n• Anti Spam     : ${statusLabel(currentCfg.antispam)}\n` +
                `• Anti Sticker  : ${statusLabel(currentCfg.antisticker)}\n• Anti Virtex   : ${statusLabel(currentCfg.antivirtex)}\n` +
                `• Anti Picture  : ${statusLabel(currentCfg.antipicture)}\n• Anti Voice    : ${statusLabel(currentCfg.antivoice)}\n` +
                `• Anti Porn     : ${statusLabel(isPornVal)}\n• Anti Link     : ${statusLabel(currentCfg.antilink)}\n` +
                `• Anti Bot      : ${statusLabel(currentCfg.antibot)}\n\n` +
                `Ketik \`${pfx}gccontrol\` untuk membaca panduan pengubahan sakelar.`;
            return await replySafe(statusReport);
        }

        const isImmuneUser = await isTargetImmune(conn, chatId, m.sender);
        if (!isImmuneUser) return await replySafe(`${greeting} hanya Admin Grup atau Owner yang berhak mengubah konfigurasi proteksi grup.`);

        let targetKey = cmd;
        let toggleState = (text || '').toLowerCase().trim();

        if (cmd === 'anti') {
            const tokens = (text || '').trim().split(/\s+/);
            targetKey = 'anti' + (tokens[0] || '').toLowerCase();
            toggleState = (tokens[1] || '').toLowerCase();
        }
        if (targetKey === 'antinude') targetKey = 'antiporn';

        const validFeatures = ['antidelete', 'antispam', 'antisticker', 'antivirtex', 'antipicture', 'antivoice', 'antiporn', 'antilink', 'antibot'];
        if (!validFeatures.includes(targetKey)) {
            return await replySafe(`${greeting} fitur tidak dikenali.\n\nGunakan format: \`${pfx}<fitur> on/off\` atau \`${pfx}anti <fitur> on/off\`.\nContoh: \`${pfx}antilink on\` atau \`${pfx}anti link on\`.`);
        }

        if (toggleState !== 'on' && toggleState !== 'off') {
            return await replySafe(`${greeting} tentukan status sakelar yang valid.\n\n*Format Penggunaan :*\n• \`${pfx}${targetKey} on\`\n• \`${pfx}${targetKey} off\``);
        }

        const isEnable = toggleState === 'on';
        const updatePayload = { [targetKey]: isEnable };
        if (targetKey === 'antiporn') updatePayload.antinude = isEnable;
        updateGroupSettings(chatId, updatePayload);

        return await replySafe(`${greeting} konfigurasi keamanan grup berhasil diperbarui.\n\n╰› ᯓ *SYSTEM UPDATE* ˎˊ˗\n\n• *Fitur :* ${targetKey}\n• *Status :* ${isEnable ? '[ ON ]' : '[ OFF ]'}\nPerubahan telah dicatat ke database grup.`);
    }
};