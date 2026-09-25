import fs from 'fs';
import path from 'path';
import greetEngine from '../../lib/engine/greet-engine.js';

// 1. Direktori Database Berkas (Hemat RAM)
const DB_DIR = path.join(process.cwd(), 'database');
const GC_SETTINGS_PATH = path.join(DB_DIR, 'gccontrol.json');
const WARN_DIR = path.join(DB_DIR, 'warn');
const TRUST_DIR = path.join(DB_DIR, 'trust');

if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
if (!fs.existsSync(WARN_DIR)) fs.mkdirSync(WARN_DIR, { recursive: true });
if (!fs.existsSync(TRUST_DIR)) fs.mkdirSync(TRUST_DIR, { recursive: true });

// 2. Operasi Pengaturan Grup
export function getGroupSettings(chatId) {
    if (!fs.existsSync(GC_SETTINGS_PATH)) {
        fs.writeFileSync(GC_SETTINGS_PATH, JSON.stringify({}, null, 2));
    }
    try {
        const all = JSON.parse(fs.readFileSync(GC_SETTINGS_PATH, 'utf-8'));
        if (!all[chatId]) {
            all[chatId] = {
                antidelete: false,
                antispam: false,
                antisticker: false,
                antivirtex: false,
                antipicture: false,
                antivoice: false,
                antiporn: false,
                antilink: false,
                antibot: false,
                maxwarn: 3
            };
            fs.writeFileSync(GC_SETTINGS_PATH, JSON.stringify(all, null, 2));
        } else {
            if (all[chatId].antiporn === undefined) {
                all[chatId].antiporn = all[chatId].antinude ?? false;
                delete all[chatId].antinude;
                fs.writeFileSync(GC_SETTINGS_PATH, JSON.stringify(all, null, 2));
            }
            if (all[chatId].antilink === undefined) {
                all[chatId].antilink = false;
                fs.writeFileSync(GC_SETTINGS_PATH, JSON.stringify(all, null, 2));
            }
        }
        return all[chatId];
    } catch {
        return {
            antidelete: false, antispam: false, antisticker: false,
            antivirtex: false, antipicture: false, antivoice: false,
            antiporn: false, antilink: false, antibot: false, maxwarn: 3
        };
    }
}

export function updateGroupSettings(chatId, newFields) {
    const all = fs.existsSync(GC_SETTINGS_PATH) ? JSON.parse(fs.readFileSync(GC_SETTINGS_PATH, 'utf-8')) : {};
    all[chatId] = { ...getGroupSettings(chatId), ...newFields };
    fs.writeFileSync(GC_SETTINGS_PATH, JSON.stringify(all, null, 2));
    return all[chatId];
}

// 3. Helper Universal Ekstraktor Target Jid (Tag / Reply / Mention)
function getTargetJid(m) {
    if (m.mentionedJid && m.mentionedJid.length > 0) {
        return m.mentionedJid[0];
    }
    if (m.quoted) {
        return m.quoted.sender || m.quoted.participant || m.quoted.key?.participant || null;
    }
    const contextInfo = m.message?.extendedTextMessage?.contextInfo || m.msg?.contextInfo;
    if (contextInfo) {
        if (contextInfo.mentionedJid && contextInfo.mentionedJid[0]) {
            return contextInfo.mentionedJid[0];
        }
        if (contextInfo.participant) {
            return contextInfo.participant;
        }
    }
    return null;
}

// 4. Operasi Berkas Database Warn & Trust
function getWarnFilePath(chatId) {
    const safeName = chatId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(WARN_DIR, `${safeName}.json`);
}

function getTrustFilePath(chatId) {
    const safeName = chatId.replace(/[^a-zA-Z0-9_-]/g, '_');
    return path.join(TRUST_DIR, `${safeName}.json`);
}

export function readWarnData(chatId) {
    const p = getWarnFilePath(chatId);
    if (!fs.existsSync(p)) return {};
    try {
        return JSON.parse(fs.readFileSync(p, 'utf-8')) || {};
    } catch {
        return {};
    }
}

export function writeWarnData(chatId, data) {
    const p = getWarnFilePath(chatId);
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

export function readTrustData(chatId) {
    const p = getTrustFilePath(chatId);
    if (!fs.existsSync(p)) return {};
    try {
        return JSON.parse(fs.readFileSync(p, 'utf-8')) || {};
    } catch {
        return {};
    }
}

export function writeTrustData(chatId, data) {
    const p = getTrustFilePath(chatId);
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

// 5. Verifikasi Hak Kebal (Owner, Admin, Bot, Trusted Member)
export async function isTargetImmune(conn, chatId, targetJid) {
    if (!targetJid) return false;
    const botJid = (conn.user?.id || '').split(':')[0] + '@s.whatsapp.net';
    const targetClean = targetJid.replace(/[^0-9]/g, '');

    if (targetClean === botJid.replace(/[^0-9]/g, '')) return true;

    const rawOwner = global.owner || [];
    const isOwner = rawOwner.some(o => {
        const val = Array.isArray(o) ? o[0] : (typeof o === 'object' && o !== null ? o.id || o.number || '' : o);
        return String(val).replace(/[^0-9]/g, '') === targetClean;
    });
    if (isOwner) return true;

    try {
        const groupMeta = await conn.groupMetadata(chatId);
        const participant = groupMeta.participants.find(p => (p.id || p.jid)?.replace(/[^0-9]/g, '') === targetClean);
        if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin' || participant.admin)) {
            return true;
        }
    } catch {}

    try {
        const trustData = readTrustData(chatId);
        for (const k of Object.keys(trustData)) {
            if (k.replace(/[^0-9]/g, '') === targetClean) return true;
        }
    } catch {}

    return false;
}

// 6. Eksekusi Penambahan Warn & Auto-Kick
export async function addWarn(conn, chatId, targetJid, count = 1, reason = 'Pelanggaran peraturan grup') {
    const immune = await isTargetImmune(conn, chatId, targetJid);
    if (immune) return;

    const warnData = readWarnData(chatId);
    const settings = getGroupSettings(chatId);
    const maxLimit = settings.maxwarn || 3;

    if (!warnData[targetJid]) {
        warnData[targetJid] = { count: 0, reasons: [] };
    }

    warnData[targetJid].count += count;
    warnData[targetJid].reasons.push(reason);

    const currentWarn = warnData[targetJid].count;
    writeWarnData(chatId, warnData);

    const targetTag = `@${targetJid.split('@')[0]}`;

    if (currentWarn >= maxLimit) {
        delete warnData[targetJid];
        writeWarnData(chatId, warnData);

        const kickNotice =
            `╰› ᯓ *MAXIMUM WARNING REACHED* ˎˊ˗\n\n` +
            `Member ${targetTag} telah mencapai batas maksimal peringatan (*${currentWarn}/${maxLimit}*).\n` +
            `• *Pelanggaran Terakhir :* ${reason}\n\n` +
            `Member otomatis dikeluarkan dari grup!`;

        await conn.sendMessage(chatId, { text: kickNotice, mentions: [targetJid] });

        try {
            await conn.groupParticipantsUpdate(chatId, [targetJid], 'remove');
        } catch {
            await conn.sendMessage(chatId, {
                text: `> *Peringatan:* Bot gagal mengeluarkan member. Pastikan bot sudah diangkat menjadi Admin Grup.`
            });
        }
    } else {
        const warnNotice =
            `╰› ᯓ *MEMBER WARNING NOTICE* ˎˊ˗\n\n` +
            `Peringatan diberikan kepada ${targetTag}!\n` +
            `• *Total Warn :* *${currentWarn}/${maxLimit}*\n` +
            `• *Alasan :* ${reason}\n\n` +
            `_Jika peringatan menyentuh ${maxLimit} kali, member akan otomatis dikeluarkan dari grup._`;

        await conn.sendMessage(chatId, { text: warnNotice, mentions: [targetJid] });
    }
}

export default {
    command: ['warn', 'setwarn', 'addwarn', 'delwarn', 'resetwarn', 'trust', 'untrust'],
    category: 'admin',
    description: '> Mengatur dan memantau status peringatan kartu member serta daftar trusted grup',

    run: async (m, { conn, text, command, usedPrefix, isOwner, isAdmin, isGroup, fakereply }) => {
        const pfx = usedPrefix || m.prefix || '.';
        const cmd = command ? command.toLowerCase() : 'warn';
        const chatId = m.chat;
        const pushName = m.pushName || 'User';

        const sendSafe = async (content, mentions = []) => {
            try {
                return await conn.sendMessage(chatId, { text: content, mentions }, { quoted: fakereply });
            } catch {
                return await conn.sendMessage(chatId, { text: content, mentions });
            }
        };

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

        if (!isGroup) {
            return await sendSafe(`${greeting} fitur ini hanya berlaku di dalam ruang grup.`);
        }

        const settings = getGroupSettings(chatId);
        const warnData = readWarnData(chatId);

        // 1. CEK STATUS WARN (.warn)
        if (cmd === 'warn') {
            let targetJid = getTargetJid(m) || m.sender;
            const immune = await isTargetImmune(conn, chatId, targetJid);
            const current = warnData[targetJid]?.count || 0;
            const reasons = warnData[targetJid]?.reasons || [];
            const tag = `@${targetJid.split('@')[0]}`;

            let detailReasons = reasons.length > 0
                ? reasons.map((r, i) => `  ${i + 1}. ${r}`).join('\n')
                : '  _Belum ada riwayat pelanggaran._';

            const replyText =
                `${greeting} berikut status kartu peringatan member.\n\n` +
                `╰› ᯓ *STATUS WARN MEMBER* ˎˊ˗\n\n` +
                `• *Member :* ${tag}\n` +
                `• *Status :* ${immune ? '*Kebal Peringatan (Owner/Admin/Bot/Trusted)*' : `*${current} / ${settings.maxwarn}*`}\n\n` +
                `*Riwayat Pelanggaran :*\n${detailReasons}`;

            return await sendSafe(replyText, [targetJid]);
        }

        // 2. ATUR LIMIT MAKSIMAL WARN (.setwarn <1-10>)
        if (cmd === 'setwarn') {
            if (!isAdmin && !isOwner) {
                return await sendSafe(`${greeting} hanya Admin Grup atau Owner yang berhak mengatur batas warn.`);
            }

            const val = parseInt(text?.trim(), 10);
            if (isNaN(val) || val < 1 || val > 10) {
                return await sendSafe(
                    `${greeting} masukkan angka batas maksimal warn yang valid (1 hingga 10).\n` +
                    `Contoh: \`${pfx}setwarn 3\``
                );
            }

            updateGroupSettings(chatId, { maxwarn: val });

            return await sendSafe(
                `${greeting} batas maksimal peringatan berhasil diubah.\n\n` +
                `╰› ᯓ *CONFIG UPDATED* ˎˊ˗\n\n` +
                `• *Batas Peringatan Baru :* *${val} kali*\n` +
                `Member biasa yang melanggar aturan hingga ${val} kali akan otomatis ditendang oleh sistem.`
            );
        }

        // 3. TAMBAH WARN MANUAL (.addwarn <@user/reply> <1-10>)
        if (cmd === 'addwarn') {
            if (!isAdmin && !isOwner) {
                return await sendSafe(`${greeting} penambahan warn manual hanya dapat dilakukan oleh Admin Grup atau Owner.`);
            }

            let targetJid = getTargetJid(m);
            let warnAmount = 1;

            const args = text ? text.trim().split(/\s+/) : [];
            for (const arg of args) {
                const parsed = parseInt(arg, 10);
                if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
                    warnAmount = parsed;
                    break;
                }
            }

            if (!targetJid) {
                return await sendSafe(
                    `${greeting} target member belum ditentukan.\n\n` +
                    `*Format Penggunaan :*\n` +
                    `• Tag target: \`${pfx}addwarn @member 2\`\n` +
                    `• Reply pesan: Balas pesan target lalu ketik \`${pfx}addwarn 2\``
                );
            }

            const immune = await isTargetImmune(conn, chatId, targetJid);
            if (immune) {
                return await sendSafe(
                    `${greeting} target tersebut (@${targetJid.split('@')[0]}) kebal terhadap peringatan karena berstatus Owner, Admin, Bot, atau Trusted Member.`,
                    [targetJid]
                );
            }

            await addWarn(conn, chatId, targetJid, warnAmount, `Diberikan manual oleh Admin (${pushName})`);
            return;
        }

        // 4. RESET / HAPUS WARN (.resetwarn / .delwarn)
        if (cmd === 'resetwarn' || cmd === 'delwarn') {
            if (!isAdmin && !isOwner) {
                return await sendSafe(`${greeting} penghapusan warn hanya dapat dilakukan oleh Admin Grup atau Owner.`);
            }

            let targetJid = getTargetJid(m);
            if (!targetJid) {
                return await sendSafe(
                    `${greeting} tentukan member yang ingin dihapus catatannya dengan cara di-tag atau di-reply.\n` +
                    `Contoh: \`${pfx}resetwarn @member\``
                );
            }

            delete warnData[targetJid];
            writeWarnData(chatId, warnData);

            return await sendSafe(
                `${greeting} catatan peringatan member berhasil direset.\n\n` +
                `╰› ᯓ *WARN RESET* ˎˊ˗\n\n` +
                `• *Member :* @${targetJid.split('@')[0]}\n` +
                `• *Total Warn Saat Ini :* *0 / ${settings.maxwarn}*`,
                [targetJid]
            );
        }

        // 5. FITUR TRUST MEMBER (.trust @member / reply)
        if (cmd === 'trust') {
            if (!isAdmin && !isOwner) {
                return await sendSafe(`${greeting} hanya Admin Grup atau Owner yang berhak menambahkan member ke daftar trusted.`);
            }

            let targetJid = getTargetJid(m);
            if (!targetJid) {
                return await sendSafe(
                    `${greeting} tentukan member yang ingin di-trust dengan cara di-tag atau di-reply.\n` +
                    `Contoh: \`${pfx}trust @member\``
                );
            }

            const trustData = readTrustData(chatId);
            trustData[targetJid] = { addedBy: pushName, time: Date.now() };
            writeTrustData(chatId, trustData);

            return await sendSafe(
                `${greeting} member berhasil ditambahkan ke daftar *Trusted*.\n\n` +
                `• *Member :* @${targetJid.split('@')[0]}\n` +
                `• *Status :* Kebal dari seluruh kontrol & sanksi grup.`,
                [targetJid]
            );
        }

        // 6. FITUR UNTRUST MEMBER (.untrust @member / reply)
        if (cmd === 'untrust') {
            if (!isAdmin && !isOwner) {
                return await sendSafe(`${greeting} hanya Admin Grup atau Owner yang berhak menghapus member dari daftar trusted.`);
            }

            let targetJid = getTargetJid(m);
            if (!targetJid) {
                return await sendSafe(
                    `${greeting} tentukan member yang ingin dihapus dari trusted dengan cara di-tag atau di-reply.\n` +
                    `Contoh: \`${pfx}untrust @member\``
                );
            }

            const trustData = readTrustData(chatId);
            if (trustData[targetJid]) {
                delete trustData[targetJid];
                writeTrustData(chatId, trustData);
            } else {
                const cleanTarget = targetJid.replace(/[^0-9]/g, '');
                for (const k of Object.keys(trustData)) {
                    if (k.replace(/[^0-9]/g, '') === cleanTarget) {
                        delete trustData[k];
                    }
                }
                writeTrustData(chatId, trustData);
            }

            return await sendSafe(
                `${greeting} member berhasil dihapus dari daftar *Trusted*.\n\n` +
                `• *Member :* @${targetJid.split('@')[0]}`,
                [targetJid]
            );
        }
    }
};