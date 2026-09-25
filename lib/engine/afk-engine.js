import fs from 'fs';
import path from 'path';

const afkDbPath = path.resolve(process.cwd(), 'database', 'afk.json');

function getAfkDb() {
    if (!fs.existsSync(afkDbPath)) {
        if (!fs.existsSync(path.dirname(afkDbPath))) {
            fs.mkdirSync(path.dirname(afkDbPath), { recursive: true });
        }
        fs.writeFileSync(afkDbPath, JSON.stringify({}));
    }
    try {
        return JSON.parse(fs.readFileSync(afkDbPath, 'utf-8'));
    } catch {
        return {};
    }
}

function saveAfkDb(data) {
    fs.writeFileSync(afkDbPath, JSON.stringify(data, null, 2));
}

// Format durasi 00:00:00
function formatDuration(ms) {
    const totalSec = Math.floor(ms / 1000);
    const hours = Math.floor(totalSec / 3600);
    const minutes = Math.floor((totalSec % 3600) / 60);
    const seconds = totalSec % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// Format waktu WIB
function getWIBTime(ts = Date.now()) {
    try {
        return new Date(ts).toLocaleTimeString('id-ID', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).replace(/\./g, ':') + ' WIB';
    } catch {
        const d = new Date(ts);
        const utc = d.getTime() + (d.getTimezoneOffset() * 60000);
        const wib = new Date(utc + (3600000 * 7));
        const pad = n => String(n).padStart(2, '0');
        return `${pad(wib.getHours())}:${pad(wib.getMinutes())}:${pad(wib.getSeconds())} WIB`;
    }
}

// Ambil tipe pesan & teks/caption
function getMessageTypeAndText(m) {
    const rawMsg = m.message?.ephemeralMessage?.message || m.message || m.msg || {};
    const keys = Object.keys(rawMsg);
    const mtype = keys.find(k => k.endsWith('Message')) || keys[0] || 'conversation';

    let typeLabel = 'Teks';
    let textBody = (m.text || m.body || rawMsg.conversation || rawMsg.extendedTextMessage?.text || rawMsg[mtype]?.caption || '').trim();

    if (mtype === 'imageMessage') typeLabel = 'Gambar / Foto';
    else if (mtype === 'videoMessage') typeLabel = 'Video';
    else if (mtype === 'audioMessage') typeLabel = rawMsg.audioMessage?.ptt ? 'Voice Note (VN)' : 'Audio';
    else if (mtype === 'stickerMessage') typeLabel = 'Stiker';
    else if (mtype === 'documentMessage') typeLabel = 'Dokumen';
    else if (mtype === 'contactMessage' || mtype === 'contactsArrayMessage') typeLabel = 'Kontak';
    else if (mtype === 'locationMessage') typeLabel = 'Lokasi';

    return { typeLabel, textBody: textBody || '_(Tanpa teks/caption)_' };
}

// Engine deteksi ketik untuk mematikan status AFK admin
export function startAfkEngine(sock) {
    sock.ev.on('presence.update', async ({ id, presences }) => {
        if (!id || !id.endsWith('@g.us')) return;
        
        const db = getAfkDb();
        if (!db[id]) return;

        for (const [participant, presence] of Object.entries(presences)) {
            if (presence.lastKnownPresence === 'composing' || presence.lastKnownPresence === 'recording') {
                if (db[id][participant]) {
                    const afkData = db[id][participant];
                    const durationMs = Date.now() - afkData.time;
                    const durationFormatted = formatDuration(durationMs);
                    const reasonText = afkData.reason ? afkData.reason : 'Tanpa alasan';

                    await sock.sendMessage(id, {
                        text: `Admin @${participant.split('@')[0]} telah kembali dari AFK karena terdeteksi mulai mengetik.\n\n` +
                              `╰› ᯓ *AFK RETURNED* ˎˊ˗\n\n` +
                              `• *Alasan :* ${reasonText}\n` +
                              `• *Durasi AFK :* ${durationFormatted}`,
                        mentions: [participant]
                    });

                    delete db[id][participant];
                    saveAfkDb(db);
                }
            }
        }
    });
}

// Pengecekan pesan masuk
export function checkAfkOnMessage(m, conn) {
    if (!m.isGroup || !m.chat || !m.sender) return;

    const botJid = (conn.user?.id || '').split(':')[0] + '@s.whatsapp.net';
    const cleanBotJid = botJid.replace(/[^0-9]/g, '');
    const cleanSender = m.sender.replace(/[^0-9]/g, '');

    // 1. Abaikan mutlak jika pesan dikirim oleh bot sendiri
    if (m.fromMe || m.key?.fromMe || cleanSender === cleanBotJid) {
        return;
    }

    const chatId = m.chat;
    const sender = m.sender;
    const db = getAfkDb();

    if (!db[chatId]) return;

    // 2. Jika pengirim adalah admin yang sedang AFK dan mengirim pesan (kembali)
    if (db[chatId][sender]) {
        const afkData = db[chatId][sender];
        const durationMs = Date.now() - afkData.time;
        const durationFormatted = formatDuration(durationMs);
        const reasonText = afkData.reason ? afkData.reason : 'Tanpa alasan';

        conn.sendMessage(chatId, {
            text: `Admin @${sender.split('@')[0]} telah kembali dari AFK.\n\n` +
                  `╰› ᯓ *AFK RETURNED* ˎˊ˗\n\n` +
                  `• *Alasan :* ${reasonText}\n` +
                  `• *Durasi AFK :* ${durationFormatted}`,
            mentions: [sender]
        }, { quoted: m });

        delete db[chatId][sender];
        saveAfkDb(db);
        return;
    }

    // 3. Jika ada member yang men-tag atau me-reply admin yang sedang AFK
    let targetJid = null;

    if (m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        const targetParticipant = m.message.extendedTextMessage.contextInfo.participant;
        if (targetParticipant && db[chatId][targetParticipant]) {
            targetJid = targetParticipant;
        }
    }

    if (!targetJid && m.message?.extendedTextMessage?.contextInfo?.mentionedJid) {
        const mentionedJids = m.message.extendedTextMessage.contextInfo.mentionedJid;
        for (let jid of mentionedJids) {
            // Pastikan JID yang di-tag bukan JID bot itu sendiri agar tag bot di dalam sistem tidak memicu diri sendiri
            const cleanJid = jid.replace(/[^0-9]/g, '');
            if (cleanJid !== cleanBotJid && db[chatId][jid]) {
                targetJid = jid;
                break;
            }
        }
    }

    if (targetJid && db[chatId][targetJid]) {
        const afkData = db[chatId][targetJid];
        const durationMs = Date.now() - afkData.time;
        const durationFormatted = formatDuration(durationMs);
        const reasonText = afkData.reason ? afkData.reason : 'Tanpa alasan';
        const { typeLabel, textBody } = getMessageTypeAndText(m);
        const sendTime = getWIBTime();

        let greetingText = `Halo`;
        try {
            const hour = new Date().getHours();
            const timeGreeting = hour < 4 ? 'dini hari' : hour < 11 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam';
            greetingText = `Selamat ${timeGreeting}`;
        } catch {}

        const notificationText = 
            `${greetingText} @${m.sender.split('@')[0]}, Admin @${targetJid.split('@')[0]} sedang dalam kondisi Away From Keyboard (AFK). Mohon ditunggu ya.\n\n` +
            `╰› ᯓ *AFK INFORMATION* ˎˊ˗\n\n` +
            `• *Pengirim :* ${m.pushName || m.sender.split('@')[0]}\n` +
            `• *Tipe Pesan :* ${typeLabel}\n` +
            `• *Waktu Pengiriman :* ${sendTime}\n\n` +
            `*Isi Pesan / Caption :*\n` +
            `\`${textBody}\`\n\n` +
            `• *Alasan AFK :* ${reasonText}\n` +
            `• *Durasi AFK :* ${durationFormatted}\n\n` +
            `Mohon ditunggu sampai Admin kembali.`;

        conn.sendMessage(chatId, {
            text: notificationText,
            mentions: [m.sender, targetJid]
        }, { quoted: m });
    }
}

export function setAfk(chatId, sender, reason) {
    const db = getAfkDb();
    if (!db[chatId]) db[chatId] = {};
    db[chatId][sender] = {
        reason: reason || '',
        time: Date.now()
    };
    saveAfkDb(db);
}