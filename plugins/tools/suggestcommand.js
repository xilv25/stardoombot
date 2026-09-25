import fs from 'fs';
import path from 'path';

const dbDir = path.resolve('./database/groups');
const dbPath = path.join(dbDir, 'suggestcmd.json');

// Membaca database status grup dari satu file JSON
function getDatabase() {
    try {
        if (!fs.existsSync(dbPath)) {
            if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
            fs.writeFileSync(dbPath, JSON.stringify({}, null, 2));
            return {};
        }
        const data = fs.readFileSync(dbPath, 'utf-8');
        return JSON.parse(data || '{}');
    } catch {
        return {};
    }
}

// Menyimpan pembaruan status ke file JSON
function saveDatabase(data) {
    try {
        if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('[SuggestCmd DB Save Error]:', err);
    }
}

// Mengecek status aktif grup
function isSuggestActive(chatId) {
    if (!chatId) return false;
    const db = getDatabase();
    const cleanId = String(chatId).split('@')[0];
    
    if (db[chatId] !== undefined) return Boolean(db[chatId]);
    if (db[cleanId] !== undefined) return Boolean(db[cleanId]);

    try {
        const oldFile = path.resolve('./src/suggestcmd.json');
        if (fs.existsSync(oldFile)) {
            const oldData = JSON.parse(fs.readFileSync(oldFile, 'utf-8') || '{}');
            if (oldData.active) return true;
        }
    } catch {}

    return false;
}

// Mengatur status aktif grup
function setSuggestStatus(chatId, status) {
    if (!chatId) return;
    const db = getDatabase();
    db[chatId] = status;
    saveDatabase(db);
}

// Ekstraksi teks pesan masuk
function extractMessageText(m) {
    if (!m) return '';
    if (typeof m.text === 'string' && m.text.length > 0) return m.text;
    if (typeof m.body === 'string' && m.body.length > 0) return m.body;

    const msg = m.message || m.msg;
    if (!msg) return '';

    return msg.conversation
        || msg.extendedTextMessage?.text
        || msg.imageMessage?.caption
        || msg.videoMessage?.caption
        || '';
}

// Algoritma Levenshtein Distance untuk menghitung skor kemiripan
function calculateSimilarity(str1, str2) {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();

    let longer = s1;
    let shorter = s2;
    if (s1.length < s2.length) {
        longer = s2;
        shorter = s1;
    }

    const longerLength = longer.length;
    if (longerLength === 0) return 1.0;

    const costs = [];
    for (let i = 0; i <= longer.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= shorter.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (longer.charAt(i - 1) !== shorter.charAt(j - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[shorter.length] = lastValue;
    }

    return (longerLength - costs[shorter.length]) / parseFloat(longerLength);
}

// Mengambil seluruh perintah terdaftar di bot
function collectAllCommands(extra = {}) {
    const commandSet = new Set();
    const registries = [
        extra.plugins,
        global.plugins,
        extra.conn?.plugins,
        global.conn?.plugins
    ];

    for (const reg of registries) {
        if (!reg || typeof reg !== 'object') continue;

        const entries = Array.isArray(reg) ? reg : Object.entries(reg);
        for (const [key, rawItem] of entries) {
            if (!rawItem) continue;

            const p = rawItem.default || rawItem;

            if (Array.isArray(p.command)) {
                for (const c of p.command) {
                    if (typeof c === 'string' && c) commandSet.add(c.toLowerCase().trim());
                }
            } else if (typeof p.command === 'string' && p.command) {
                commandSet.add(p.command.toLowerCase().trim());
            } else if (p.command instanceof RegExp || (p.command && typeof p.command.test === 'function')) {
                const words = String(p.command.source || p.command).match(/[a-zA-Z0-9_-]+/g);
                if (words) {
                    for (const w of words) commandSet.add(w.toLowerCase().trim());
                }
            }

            if (Array.isArray(p.help)) {
                for (const h of p.help) {
                    if (typeof h === 'string' && h) {
                        const firstWord = h.trim().split(/\s+/)[0].replace(/^[^a-zA-Z0-9]/, '');
                        if (firstWord) commandSet.add(firstWord.toLowerCase());
                    }
                }
            } else if (typeof p.help === 'string' && p.help) {
                const firstWord = p.help.trim().split(/\s+/)[0].replace(/^[^a-zA-Z0-9]/, '');
                if (firstWord) commandSet.add(firstWord.toLowerCase());
            }

            if (typeof key === 'string' && key.endsWith('.js')) {
                const baseName = path.basename(key, '.js').toLowerCase();
                if (baseName && !['index', 'handler', 'config'].includes(baseName)) {
                    commandSet.add(baseName);
                }
            }
        }
    }

    try {
        const pluginsDir = path.resolve('./plugins');
        if (fs.existsSync(pluginsDir)) {
            const scanDir = (dir) => {
                const files = fs.readdirSync(dir);
                for (const file of files) {
                    const fullPath = path.join(dir, file);
                    const stat = fs.statSync(fullPath);
                    if (stat.isDirectory()) {
                        scanDir(fullPath);
                    } else if (file.endsWith('.js')) {
                        const baseName = path.basename(file, '.js').toLowerCase();
                        if (baseName) commandSet.add(baseName);

                        try {
                            const content = fs.readFileSync(fullPath, 'utf-8');
                            const match = content.match(/command:\s*(\[[^\]]+\]|['"`][^'"`]+['"`])/);
                            if (match) {
                                const words = match[1].match(/[a-zA-Z0-9_-]+/g);
                                if (words) {
                                    for (const w of words) commandSet.add(w.toLowerCase());
                                }
                            }
                        } catch {}
                    }
                }
            };
            scanDir(pluginsDir);
        }
    } catch {}

    return Array.from(commandSet);
}

// Verifikasi akses: Owner atau Admin
function checkPermission(m, conn, extra = {}) {
    if (extra.isOwner || extra.isROwner || m?.isOwner || m?.isROwner || m?.key?.fromMe || m?.fromMe) {
        return true;
    }

    if (extra.isAdmin || m?.isAdmin) {
        return true;
    }

    const senderRaw = m?.sender || m?.key?.participant || '';
    const senderNum = senderRaw.split('@')[0].split(':')[0].replace(/\D/g, '');

    if (Array.isArray(global.owner)) {
        for (const entry of global.owner) {
            let target = '';
            if (typeof entry === 'string' || typeof entry === 'number') target = String(entry);
            else if (Array.isArray(entry)) target = String(entry[0]);
            else if (entry && typeof entry === 'object') target = String(entry.number || entry.jid || entry.id || '');

            const targetNum = target.split('@')[0].split(':')[0].replace(/\D/g, '');
            if (targetNum && senderNum && (senderNum === targetNum || senderNum.endsWith(targetNum))) {
                return true;
            }
        }
    }

    return false;
}

export default {
    command: ['suggestcommand', 'suggestcmd'],
    category: 'tools',
    description: 'Menjelaskan atau mengatur saran perintah salah ketik per grup',

    before: async (m, extra = {}) => {
        const { conn, fakereply, fakeReply } = extra || {};
        if (!m || !m.chat) return false;

        // Hanya aktif jika status di grup bernilai true
        if (!isSuggestActive(m.chat)) return false;

        const rawText = extractMessageText(m).trim();
        if (!rawText) return false;

        // Wajib ber-prefix simbol. Pesan biasa / no-prefix diabaikan
        const prefixMatch = rawText.match(/^([^a-zA-Z0-9\s])([a-zA-Z0-9_-]+)/);
        if (!prefixMatch) return false;

        const usedSymbol = prefixMatch[1];
        const inputCmd = prefixMatch[2].toLowerCase();

        const allCommands = collectAllCommands(extra);
        if (allCommands.length === 0) return false;

        // Jika perintah valid, abaikan
        if (allCommands.includes(inputCmd)) return false;

        let bestMatch = '';
        let highestScore = 0;

        for (const target of allCommands) {
            const score = calculateSimilarity(inputCmd, target);
            if (score > highestScore) {
                highestScore = score;
                bestMatch = target;
            }
        }

        // Jika kemiripan mencapai ambang batas
        if (highestScore >= 0.5 && bestMatch) {
            const activeFakeReply = typeof fakereply === 'function'
                ? fakereply('')
                : (typeof fakeReply === 'function' ? fakeReply('') : (fakereply || fakeReply));

            const senderJid = m.sender || m.key?.participant || '';
            const userTag = senderJid ? senderJid.split('@')[0].split(':')[0] : '';

            const responseText = `Halo @${userTag},\n\nCommand '${usedSymbol + inputCmd}' tidak ditemukan, mungkin maksud kamu '${usedSymbol + bestMatch}' .\n\nSilahkan ketik .menu atau .menu2 untuk list command bot kami.`;

            const sendOptions = {
                text: responseText,
                mentions: senderJid ? [senderJid] : []
            };

            if (conn) {
                await conn.sendMessage(m.chat, sendOptions, { quoted: activeFakeReply || m });
            } else {
                await m.reply(responseText);
            }
        }

        return false;
    },

    run: async (m, extra = {}) => {
        const { conn, args, usedPrefix, command, fakereply, fakeReply } = extra || {};

        const activeFakeReply = typeof fakereply === 'function'
            ? fakereply('')
            : (typeof fakeReply === 'function' ? fakeReply('') : (fakereply || fakeReply));

        const replyMessage = async (text) => {
            if (conn && activeFakeReply) {
                return conn.sendMessage(m.chat, { text }, { quoted: activeFakeReply });
            }
            return m.reply(text);
        };

        if (!checkPermission(m, conn, extra)) {
            return replyMessage('Perintah ini hanya dapat digunakan oleh admin grup atau pemilik bot.');
        }

        const currentStatus = isSuggestActive(m.chat);

        // Menampilkan penjelasan fitur
        if (command === 'suggestcommand') {
            const statusText = currentStatus ? 'aktif' : 'nonaktif';
            return replyMessage(
                `Fitur Saran Perintah (Suggest Command)\n\n` +
                `Fungsi: mendeteksi kesalahan ketik (typo) pada perintah yang menggunakan prefix dan memberikan rekomendasi perintah yang sesuai.\n` +
                `Catatan: perintah tanpa prefix (no-prefix) tidak akan memicu saran ini.\n\n` +
                `Penyimpanan: database/groups/suggestcmd.json\n` +
                `Status di grup ini: ${statusText}\n\n` +
                `Perintah sakelar:\n` +
                `- ${usedPrefix}suggestcmd on\n` +
                `- ${usedPrefix}suggestcmd off`
            );
        }

        // Sakelar on/off
        if (command === 'suggestcmd') {
            const option = (args[0] || '').toLowerCase();

            if (option === 'on' || option === 'aktif' || option === 'enable') {
                setSuggestStatus(m.chat, true);
                return replyMessage('Fitur saran perintah berhasil diaktifkan untuk grup ini.');
            }

            if (option === 'off' || option === 'mati' || option === 'disable') {
                setSuggestStatus(m.chat, false);
                return replyMessage('Fitur saran perintah berhasil dinonaktifkan untuk grup ini.');
            }

            return replyMessage(
                `Format penggunaan:\n` +
                `- ${usedPrefix + command} on\n` +
                `- ${usedPrefix + command} off`
            );
        }
    }
};