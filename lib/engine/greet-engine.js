import fs from 'fs';
import path from 'path';

// 1. Deteksi Waktu WIB
export const getTimeGreeting = () => {
    const hour = parseInt(
        new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: '2-digit', hour12: false }),
        10
    );
    if (hour >= 4 && hour < 11) return 'pagi';
    if (hour >= 11 && hour < 15) return 'siang';
    if (hour >= 15 && hour < 18) return 'sore';
    return 'malam';
};

// 2. Deteksi Admin via database/users.json
export const checkAdminFromDb = (senderJid, groupJid) => {
    try {
        const usersPath = path.resolve(process.cwd(), 'database', 'users.json');
        if (!fs.existsSync(usersPath)) return false;

        const users = JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
        if (!Array.isArray(users)) return false;

        const cleanSender = (senderJid || '').replace(/[^0-9]/g, '');
        const user = users.find(u => 
            (u.jid === senderJid || u.lid === senderJid || u.number === cleanSender) &&
            (u.lastGroup === groupJid)
        );

        return user ? Boolean(user.isAdmin) : false;
    } catch {
        return false;
    }
};

// 3. Engine Hierarki Panggilan (Fleksibel Objek & Argumen Langsung)
export const getGreeting = (m, optOrOwner = false, maybeAdmin = false) => {
    const pushName = m?.pushName || 'User';
    const time = getTimeGreeting();

    let isOwner = false;
    let isAdmin = false;

    // Deteksi jika input berupa objek { isOwner, isAdmin } atau argumen terpisah (m, isOwner, isAdmin)
    if (typeof optOrOwner === 'object' && optOrOwner !== null) {
        isOwner = Boolean(optOrOwner.isOwner);
        isAdmin = Boolean(optOrOwner.isAdmin);
    } else {
        isOwner = Boolean(optOrOwner);
        isAdmin = Boolean(maybeAdmin);
    }

    // Verifikasi status admin otomatis jika di dalam grup dan belum di-passing
    const actualAdmin = isAdmin || (m?.isGroup ? checkAdminFromDb(m?.sender, m?.chat) : false);

    if (isOwner) {
        const str = `Selamat ${time} Tuan Muda *${pushName}*,`;
        return {
            role: 'owner',
            name: pushName,
            title: `tuan muda *${pushName}*`,
            time: time,
            prefix: str,
            text: str
        };
    }

    if (actualAdmin) {
        const str = `Halo Admin,`;
        return {
            role: 'admin',
            name: pushName,
            title: 'Admin',
            time: time,
            prefix: str,
            text: str
        };
    }

    const str = `Halo Kak *${pushName}*,`;
    return {
        role: 'member',
        name: pushName,
        title: `Kak *${pushName}*`,
        time: time,
        prefix: str,
        text: str
    };
};

export default {
    getTimeGreeting,
    checkAdminFromDb,
    getGreeting
};