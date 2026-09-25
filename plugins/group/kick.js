import fs from 'fs';
import path from 'path';

const checkAdminFromDb = (senderJid, groupJid) => {
    try {
        const usersPath = path.resolve(process.cwd(), 'database', 'users.json');
        if (!fs.existsSync(usersPath)) return false;
        
        const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
        if (!Array.isArray(users)) return false;

        const cleanSender = senderJid.replace(/[^0-9]/g, '');
        const user = users.find(u => 
            (u.jid === senderJid || u.lid === senderJid || u.number === cleanSender) &&
            (u.lastGroup === groupJid)
        );

        return user ? Boolean(user.isAdmin) : false;
    } catch {
        return false;
    }
};

let handler = async (m, { conn, text, isOwner, usedPrefix, command }) => {
    const symPath = path.resolve(process.cwd(), 'lib/global-symbol.js');
    const { sym } = await import(`file://${symPath}`);

    let greet;
    try {
        const greetPath = path.resolve(process.cwd(), 'lib/engine/greet-engine.js');
        const { getGreeting } = await import(`file://${greetPath}`);
        greet = getGreeting(m, { isOwner, isAdmin: checkAdminFromDb(m.sender, m.chat) });
    } catch {
        const hour = parseInt(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: '2-digit', hour12: false }), 10);
        const time = (hour >= 4 && hour < 11) ? 'pagi' : (hour >= 11 && hour < 15) ? 'siang' : (hour >= 15 && hour < 18) ? 'sore' : 'malam';
        greet = { prefix: isOwner ? `Selamat ${time} tuan muda *${m.pushName || 'Master'}*,` : `Halo Anda,` };
    }

    if (!m.isGroup) {
        let msg = `${greet.prefix} perintah ini hanya dapat dijalankan di dalam ruang obrolan grup.\n\n`;
        msg += `${sym.arrowCurve} ${sym.swoosh} *ACCESS DENIED* ${sym.sparkle}\n\n`;
        msg += `*Rincian Akses :*\n\n`;
        msg += `• Lokasi : Private Chat\n`;
        msg += `• Batasan : Khusus Dimensi Grup\n\n`;
        msg += `Pindahkan interaksi ke dalam grup untuk menggunakan perintah kick.\n\n`;
        msg += `${sym.sword} ©Nameless StarDoom`;
        return m.reply(msg);
    }

    const isAdmin = checkAdminFromDb(m.sender, m.chat);
    const pushName = m.pushName || 'User';

    if (!isOwner && !isAdmin) {
        let msg = `${greet.prefix} maaf Kak *${pushName}*, fitur kick ini khusus buat admin group doang.\n\n`;
        msg += `${sym.arrowCurve} ${sym.swoosh} *ACCESS DENIED* ${sym.sparkle}\n\n`;
        msg += `*Rincian Pembatasan :*\n\n`;
        msg += `• Hak Akses : Member Biasa\n`;
        msg += `• Diperlukan : Status Admin Grup\n\n`;
        msg += `Kamu ga punya izin buat ngeluarin member dari grup ini.\n\n`;
        msg += `${sym.sword} ©Nameless StarDoom`;
        return m.reply(msg);
    }

    let target = null;
    let msgObj = m.message || {};
    if (msgObj.ephemeralMessage) msgObj = msgObj.ephemeralMessage.message || msgObj;
    if (msgObj.viewOnceMessageV2) msgObj = msgObj.viewOnceMessageV2.message || msgObj;
    
    const contextInfo = msgObj?.extendedTextMessage?.contextInfo;

    if (contextInfo?.participant) {
        target = contextInfo.participant;
    } else if (contextInfo?.mentionedJid?.length) {
        target = contextInfo.mentionedJid[0];
    } else if (text) {
        const cleanNumber = text.replace(/[^0-9]/g, '');
        if (cleanNumber.length >= 5) {
            target = `${cleanNumber}@s.whatsapp.net`;
        }
    }

    if (!target) {
        let msg = `${greet.prefix} format parameter penargetan belum lengkap atau salah.\n\n`;
        msg += `${sym.arrowCurve} ${sym.swoosh} *KICK FORMAT* ${sym.sparkle}\n\n`;
        msg += `*Panduan Penggunaan :*\n\n`;
        msg += `• Reply chat orang yang mau di-kick\n`;
        msg += `• Tag orangnya langsung: \`${usedPrefix + command} @user\`\n\n`;
        msg += `Tentukan target yang valid sebelum mengeksekusi perintah.\n\n`;
        msg += `${sym.sword} ©Nameless StarDoom`;
        return m.reply(msg);
    }

    try {
        await conn.groupParticipantsUpdate(m.chat, [target], 'remove');
        const targetNum = target.replace(/[^0-9]/g, '');

        let successMsg = `${greet.prefix} tindakan pembersihan member berhasil dieksekusi.\n\n`;
        successMsg += `${sym.arrowCurve} ${sym.swoosh} *MEMBER KICKED* ${sym.sparkle}\n\n`;
        successMsg += `*Rincian Eksekusi :*\n\n`;
        successMsg += `• Target : @${targetNum}\n`;
        successMsg += `• Status : Berhasil Dikeluarkan\n\n`;
        successMsg += `Member tersebut telah disingkirkan dari ruang grup.\n\n`;
        successMsg += `${sym.sword} ©Nameless StarDoom`;

        return m.reply(successMsg, null, { mentions: [target] });
    } catch {
        let errMsg = `${greet.prefix} gagal mengeluarkan member dari grup obrolan.\n\n`;
        errMsg += `${sym.arrowCurve} ${sym.swoosh} *KICK ERROR* ${sym.sparkle}\n\n`;
        errMsg += `*Detail Kendala :*\n\n`;
        errMsg += `• Penyebab : Bot Belum Menjadi Admin Grup\n\n`;
        errMsg += `Jadikan bot sebagai admin grup terlebih dahulu agar memiliki wewenang mengeluarkan member.\n\n`;
        errMsg += `${sym.sword} ©Nameless StarDoom`;
        return m.reply(errMsg);
    }
};

handler.command = ['kick', 'tendang', 'dor'];
handler.group = true;

export default handler;