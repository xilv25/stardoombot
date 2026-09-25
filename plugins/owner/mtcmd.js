import fs from 'fs';
import path from 'path';

const dbPath = path.resolve('./src/maintenance.json');

function getMaintenanceList() {
    try {
        if (!fs.existsSync(dbPath)) {
            const dir = path.dirname(dbPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(dbPath, JSON.stringify([], null, 2));
            return [];
        }
        const data = fs.readFileSync(dbPath, 'utf-8');
        return JSON.parse(data || '[]');
    } catch {
        return [];
    }
}

function saveMaintenanceList(list) {
    try {
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(dbPath, JSON.stringify(list, null, 2));
    } catch (err) {
        console.error('[Maintenance Save Error]:', err);
    }
}

// Mengumpulkan semua konfigurasi nomor, LID, dan JID pemilik dari runtime maupun config.js
function getAllOwnerEntries(conn) {
    const set = new Set();

    const candidates = [
        global.owner,
        global.owners,
        global.ownerLid,
        global.ownerlid,
        global.lid,
        global.lids,
        global.ownerJid,
        global.ownerjid,
        global.nomorOwner,
        global.nomorowner,
        global.rowner,
        global.mods,
        global.prems,
        global.config?.owner,
        global.config?.lid,
        conn?.user?.id,
        conn?.user?.jid,
        conn?.user?.lid
    ];

    function addEntry(item) {
        if (!item) return;
        if (typeof item === 'string' || typeof item === 'number') {
            set.add(String(item).trim());
        } else if (Array.isArray(item)) {
            for (const sub of item) addEntry(sub);
        } else if (typeof item === 'object') {
            for (const key of Object.keys(item)) {
                addEntry(item[key]);
            }
        }
    }

    for (const item of candidates) {
        addEntry(item);
    }

    // Pindai langsung file config.js sebagai cadangan jika variabel global belum termuat
    try {
        const configPath = path.resolve('./config.js');
        if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf-8');
            const lines = content.split('\n');
            for (const line of lines) {
                if (/owner|lid|jid|nomor|mods/i.test(line)) {
                    const matched = line.match(/['"`]([^'"`]+)['"`]/g);
                    if (matched) {
                        for (const str of matched) {
                            const val = str.replace(/['"`]/g, '').trim();
                            if (/\d/.test(val)) set.add(val);
                        }
                    }
                }
            }
        }
    } catch {}

    return Array.from(set);
}

// Kumpulkan seluruh kandidat ID pengirim pesan saat ini
function getSenderCandidates(m, conn) {
    const candidates = new Set();

    if (m?.sender) candidates.add(m.sender);
    if (m?.key?.participant) candidates.add(m.key.participant);
    if (m?.key?.remoteJid) candidates.add(m.key.remoteJid);
    if (m?.key?.participantPn) candidates.add(m.key.participantPn);
    if (m?.key?.remoteJidAlt) candidates.add(m.key.remoteJidAlt);
    if (m?.participant) candidates.add(m.participant);
    if (m?.from) candidates.add(m.from);

    if (typeof conn?.decodeJid === 'function') {
        try { if (m?.sender) candidates.add(conn.decodeJid(m.sender)); } catch {}
        try { if (m?.key?.participant) candidates.add(conn.decodeJid(m.key.participant)); } catch {}
        try { if (m?.key?.remoteJid) candidates.add(conn.decodeJid(m.key.remoteJid)); } catch {}
    }

    return Array.from(candidates).filter(Boolean);
}

// Verifikasi kecocokan antara pengirim dan daftar pemilik (mendukung JID, LID, dan nomor biasa)
function isOwnerMatch(senderStr, ownerStr) {
    if (!senderStr || !ownerStr) return false;

    // 1. Kecocokan langsung string utuh
    if (senderStr.toLowerCase() === ownerStr.toLowerCase()) return true;

    // 2. Kecocokan ID murni sebelum tanda @ (efektif untuk mencocokkan LID atau nomor tanpa domain)
    const sUser = senderStr.split('@')[0].split(':')[0];
    const oUser = ownerStr.split('@')[0].split(':')[0];
    if (sUser && oUser && sUser.toLowerCase() === oUser.toLowerCase()) return true;

    // 3. Normalisasi angka untuk format nomor ponsel
    let sNum = sUser.replace(/\D/g, '');
    let oNum = oUser.replace(/\D/g, '');

    if (sNum && oNum) {
        if (sNum.startsWith('08')) sNum = '628' + sNum.slice(2);
        if (oNum.startsWith('08')) oNum = '628' + oNum.slice(2);

        if (sNum === oNum) return true;
        if (sNum.length >= 9 && oNum.length >= 9) {
            if (sNum.endsWith(oNum) || oNum.endsWith(sNum)) return true;
        }
    }

    return false;
}

function checkIsOwner(m, conn, extra = {}) {
    if (extra?.isOwner || extra?.isROwner || m?.isOwner || m?.isROwner || m?.key?.fromMe || m?.fromMe) {
        return true;
    }

    if (global.db?.data?.users?.[m?.sender]?.owner || global.db?.data?.users?.[m?.sender]?.rowner) {
        return true;
    }

    const senders = getSenderCandidates(m, conn);
    const owners = getAllOwnerEntries(conn);

    for (const s of senders) {
        for (const o of owners) {
            if (isOwnerMatch(s, o)) return true;
        }
    }

    return false;
}

export default {
    command: ['mtcmd', 'mt'],
    category: 'owner',
    description: 'Menyegel atau membuka segel pemeliharaan pada perintah tertentu',

    // Interceptor sebelum perintah dijalankan oleh plugin lain
    before: async (m, extra = {}) => {
        const { conn, fakereply, fakeReply } = extra || {};
        if (!m || !m.text) return false;

        // Pemilik bot langsung lolos dari pencegatan
        if (checkIsOwner(m, conn, extra)) return false;

        const cleanText = m.text.trim();
        const match = cleanText.match(/^[./!#]?([a-zA-Z0-9_-]+)/);
        if (!match) return false;

        const invokedCmd = match[1].toLowerCase();
        const list = getMaintenanceList();

        if (list.includes(invokedCmd)) {
            const activeFakeReply = typeof fakereply === 'function'
                ? fakereply('')
                : (typeof fakeReply === 'function' ? fakeReply('') : (fakereply || fakeReply));

            if (conn && activeFakeReply) {
                await conn.sendMessage(m.chat, {
                    text: `Fitur ${invokedCmd} sedang dalam pemeliharaan (maintenance) dan belum dapat digunakan untuk sementara waktu.`
                }, { quoted: activeFakeReply });
            } else {
                await m.reply(`Fitur ${invokedCmd} sedang dalam pemeliharaan (maintenance) dan belum dapat digunakan untuk sementara waktu.`);
            }

            return true;
        }

        return false;
    },

    run: async (m, extra = {}) => {
        const { conn, args, usedPrefix, command, fakereply, fakeReply } = extra || {};

        const activeFakeReply = typeof fakereply === 'function'
            ? fakereply('')
            : (typeof fakeReply === 'function' ? fakeReply('') : (fakereply || fakeReply));

        if (!checkIsOwner(m, conn, extra)) {
            const text = 'Perintah ini hanya dapat dijalankan oleh pemilik bot.';
            if (conn && activeFakeReply) {
                return conn.sendMessage(m.chat, { text }, { quoted: activeFakeReply });
            }
            return m.reply(text);
        }

        const targetCmd = (args[0] || '').toLowerCase().replace(/^[./!#]/, '').trim();

        if (!targetCmd) {
            const currentList = getMaintenanceList();
            const listText = currentList.length > 0 ? currentList.join(', ') : 'kosong';
            const text = `Format penggunaan:\n${usedPrefix + command} <nama_perintah>\n\nDaftar fitur disegel: ${listText}`;
            if (conn && activeFakeReply) {
                return conn.sendMessage(m.chat, { text }, { quoted: activeFakeReply });
            }
            return m.reply(text);
        }

        if (targetCmd === command || targetCmd === 'mt') {
            const text = 'Perintah mtcmd tidak dapat disegel.';
            if (conn && activeFakeReply) {
                return conn.sendMessage(m.chat, { text }, { quoted: activeFakeReply });
            }
            return m.reply(text);
        }

        let list = getMaintenanceList();

        if (list.includes(targetCmd)) {
            list = list.filter(item => item !== targetCmd);
            saveMaintenanceList(list);
            const text = `Segel dibuka: perintah ${targetCmd} kini dapat digunakan kembali oleh semua orang.`;
            if (conn && activeFakeReply) {
                return conn.sendMessage(m.chat, { text }, { quoted: activeFakeReply });
            }
            return m.reply(text);
        } else {
            list.push(targetCmd);
            saveMaintenanceList(list);
            const text = `Segel aktif: perintah ${targetCmd} sedang masuk masa pemeliharaan (maintenance).`;
            if (conn && activeFakeReply) {
                return conn.sendMessage(m.chat, { text }, { quoted: activeFakeReply });
            }
            return m.reply(text);
        }
    }
};