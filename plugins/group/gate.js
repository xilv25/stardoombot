import fs from 'fs';
import path from 'path';

async function uploadToCloud(buffer) {
    try {
        const FormData = (await import('form-data')).default;
        const axios = (await import('axios')).default;
        let form = new FormData();
        form.append('files[]', buffer, 'image.jpg');
        let res = await axios.post('https://pomf2.lain.la/upload.php', form, { headers: form.getHeaders() });
        return res.data.files[0].url;
    } catch (e) { 
        try {
            const FormData = (await import('form-data')).default;
            const axios = (await import('axios')).default;
            let form2 = new FormData();
            form2.append('reqtype', 'fileupload');
            form2.append('fileToUpload', buffer, 'image.jpg');
            let res = await axios.post('https://catbox.moe/user/api.php', form2, { headers: form2.getHeaders() });
            return res.data;
        } catch (err) { return null; }
    }
}

let handler = async (m, { conn, args, command, usedPrefix, isOwner, isAdmin }) => {
    // 1. Dynamic Import Simbol, Wizard Engine, dan Greet Engine
    const symPath = path.resolve(process.cwd(), 'lib/global-symbol.js');
    const { sym } = await import(`file://${symPath}`);

    const wizPath = path.resolve(process.cwd(), 'lib/engine/wizard-engine.js');
    const { setWizardLock } = await import(`file://${wizPath}`);

    let greet;
    try {
        const greetPath = path.resolve(process.cwd(), 'lib/engine/greet-engine.js');
        const { getGreeting } = await import(`file://${greetPath}`);
        greet = getGreeting(m, { isOwner, isAdmin });
    } catch {
        const hour = parseInt(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: '2-digit', hour12: false }), 10);
        const time = (hour >= 4 && hour < 11) ? 'pagi' : (hour >= 11 && hour < 15) ? 'siang' : (hour >= 15 && hour < 18) ? 'sore' : 'malam';
        greet = { prefix: isOwner ? `Selamat ${time} tuan muda *${m.pushName || 'Master'}*,` : `Halo Anda,` };
    }

    const dbPath = path.resolve(process.cwd(), 'database', 'groups.json');
    let db = {};
    if (fs.existsSync(dbPath)) {
        try { db = JSON.parse(fs.readFileSync(dbPath, 'utf-8')); } catch (e) {}
    }
    if (!db[m.chat]) db[m.chat] = {};

    if (!db[m.chat].welcome) db[m.chat].welcome = { status: false, msg: '', image: '' };
    if (!db[m.chat].goodbye) db[m.chat].goodbye = { status: false, msg: '', image: '' };

    const saveDb = () => {
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
    };

    // Sub-Command 0: Menu Pusat Kendali Gate
    if (command === 'gate' || command === 'gateway') {
        let welcomeStatus = db[m.chat].welcome.status ? 'AKTIF' : 'NONAKTIF';
        let goodbyeStatus = db[m.chat].goodbye.status ? 'AKTIF' : 'NONAKTIF';

        let msg = `${greet.prefix} berikut adalah pusat kendali dan informasi layanan gateway grup ini.\n\n`;
        msg += `${sym.arrowCurve} ${sym.swoosh} *SISTEM GATEWAY* ${sym.sparkle}\n\n`;
        msg += `*Status Ruang Grup :*\n\n`;
        msg += `• Layanan Welcome : *${welcomeStatus}*\n`;
        msg += `• Layanan Goodbye : *${goodbyeStatus}*\n\n`;
        msg += `*Daftar Perintah :*\n\n`;
        msg += `• \`${usedPrefix}welcome <on/off>\` : Mengatur status aktif sambutan kedatangan\n`;
        msg += `• \`${usedPrefix}goodbye <on/off>\` : Mengatur status aktif perpisahan kepergian\n`;
        msg += `• \`${usedPrefix}setwelcomemsg <teks>\` : Mengatur teks kustom kedatangan\n`;
        msg += `• \`${usedPrefix}setgoodbyemsg <teks>\` : Mengatur teks kustom perpisahan\n`;
        msg += `• \`${usedPrefix}setwelcomeimg\` : Mengunci sesi untuk unggah gambar kedatangan\n`;
        msg += `• \`${usedPrefix}setgoodbyeimg\` : Mengunci sesi untuk unggah gambar perpisahan\n\n`;
        msg += `*Variabel Format Teks :*\n\n`;
        msg += `• *+user* : Menandai pengguna secara otomatis\n`;
        msg += `• *+group* : Menampilkan nama grup obrolan\n`;
        msg += `• *+date* : Menampilkan tanggal operasional aktif\n`;
        msg += `• *+greeting* : Menampilkan sapaan waktu dinamis\n\n`;
        msg += `Gunakan perintah di atas untuk mengonfigurasi gerbang grup ini.`;
        return m.reply(msg);
    }

    const isWelcome = command.includes('welcome');
    const type = isWelcome ? 'welcome' : 'goodbye';
    const label = isWelcome ? 'Kedatangan' : 'Kepergian';

    // Sub-Command 1: ON / OFF
    if (command === 'welcome' || command === 'goodbye') {
        if (!args[0] || !/^(on|off)$/i.test(args[0])) {
            let msg = `${greet.prefix} sistem membutuhkan parameter status untuk gerbang grup ini.\n\n`;
            msg += `${sym.arrowCurve} ${sym.swoosh} *SISTEM GATEWAY* ${sym.sparkle}\n\n`;
            msg += `*Panduan Penggunaan :*\n\n`;
            msg += `• \`${usedPrefix + command} on\` : Mengaktifkan layanan ${label.toLowerCase()}\n`;
            msg += `• \`${usedPrefix + command} off\` : Menonaktifkan layanan ${label.toLowerCase()}\n\n`;
            msg += `Silakan tentukan status layanan untuk mengatur respon otomatis grup.`;
            return m.reply(msg);
        }
        let action = args[0].toLowerCase() === 'on';
        db[m.chat][type].status = action;
        saveDb();
        
        let statusLabel = action ? 'AKTIF' : 'NONAKTIF';
        let msg = `${greet.prefix} konfigurasi gerbang grup berhasil diperbarui.\n\n`;
        msg += `${sym.arrowCurve} ${sym.swoosh} *GATEWAY UPDATED* ${sym.sparkle}\n\n`;
        msg += `*Status Layanan :*\n\n`;
        msg += `• Kategori : ${label}\n`;
        msg += `• Status : ${statusLabel}\n\n`;
        msg += `Sistem bot akan langsung menyesuaikan respons otomatis ketika ada member yang masuk atau keluar.`;
        return m.reply(msg);
    }

    // Sub-Command 2: Set Teks Sapaan
    if (command === 'setwelcome' || command === 'setgoodbye' || command === 'setwelcomemsg' || command === 'setgoodbyemsg') {
        const text = args.join(' ');
        if (!text) {
            let msg = `${greet.prefix} parameter teks kustom tidak boleh dibiarkan kosong.\n\n`;
            msg += `${sym.arrowCurve} ${sym.swoosh} *TEMPLATE SETTING* ${sym.sparkle}\n\n`;
            msg += `*Variabel Dinamis :*\n\n`;
            msg += `• *+user* : Menandai pengguna secara otomatis\n`;
            msg += `• *+group* : Menampilkan nama grup obrolan\n`;
            msg += `• *+date* : Menampilkan tanggal operasional aktif\n`;
            msg += `• *+greeting* : Menampilkan sapaan waktu otomatis\n\n`;
            msg += `*Contoh Penggunaan :*\n\n`;
            msg += `• \`${usedPrefix + command} Hai, +greeting +user. Selamat datang di +group tanggal +date.\`\n\n`;
            msg += `Ketik \`${usedPrefix + command} default\` jika ingin mengembalikan struktur teks ke standar bawaan sistem.`;
            return m.reply(msg);
        }

        if (text.toLowerCase() === 'default') {
            db[m.chat][type].msg = '';
            saveDb();
            let msg = `${greet.prefix} struktur teks berhasil dikembalikan ke standar awal.\n\n`;
            msg += `${sym.arrowCurve} ${sym.swoosh} *TEMPLATE RESET* ${sym.sparkle}\n\n`;
            msg += `*Status Konfigurasi :*\n\n`;
            msg += `• Layanan : ${label}\n`;
            msg += `• Format : Standar Bawaan\n\n`;
            msg += `Pesan otomatis grup kini akan menggunakan susunan format dasar bawaan sistem.`;
            return m.reply(msg);
        }

        db[m.chat][type].msg = text;
        saveDb();
        let msg = `${greet.prefix} struktur teks kustom baru berhasil disimpan ke memori grup.\n\n`;
        msg += `${sym.arrowCurve} ${sym.swoosh} *TEMPLATE SAVED* ${sym.sparkle}\n\n`;
        msg += `*Detail Konfigurasi :*\n\n`;
        msg += `• Layanan : ${label}\n`;
        msg += `• Pratinjau Teks : "${text}"\n`;
        msg += `• Status : Tersimpan Permanen\n\n`;
        msg += `Teks baru tersebut akan langsung diterapkan pada setiap peristiwa terkait di grup ini.`;
        return m.reply(msg);
    }

    // Sub-Command 3: Set Gambar
    if (command === 'setwelcomeimg' || command === 'setgoodbyeimg') {
        let msgObj = m.message || {};
        if (msgObj.ephemeralMessage) msgObj = msgObj.ephemeralMessage.message || msgObj;
        if (msgObj.viewOnceMessageV2) msgObj = msgObj.viewOnceMessageV2.message || msgObj;
        
        let isImageMsg = !!msgObj.imageMessage;
        let quotedMsg = msgObj.extendedTextMessage?.contextInfo?.quotedMessage;
        if (quotedMsg?.ephemeralMessage) quotedMsg = quotedMsg.ephemeralMessage.message;
        if (quotedMsg?.viewOnceMessageV2) quotedMsg = quotedMsg.viewOnceMessageV2.message;
        let isQuotedImage = !!(quotedMsg && quotedMsg.imageMessage);
        
        // Sesi Lock Target
        if (!isImageMsg && !isQuotedImage) {
            const usersDbPath = path.resolve(process.cwd(), 'database', 'users.json');
            let usersDb = [];
            if (fs.existsSync(usersDbPath)) {
                usersDb = JSON.parse(fs.readFileSync(usersDbPath, 'utf-8'));
            }
            
            let adminData = usersDb.find(u => u.jid === m.sender);
            let targetJid = adminData ? adminData.jid : m.sender;

            setWizardLock(targetJid, m.chat, type);
            
            let lockMsg = `${greet.prefix} sesi pengunggahan berkas visual telah dikunci untuk Anda.\n\n`;
            lockMsg += `${sym.arrowCurve} ${sym.swoosh} *LOCK TARGET AKTIF* ${sym.sparkle}\n\n`;
            lockMsg += `*Petunjuk Sesi :*\n\n`;
            lockMsg += `• Target : Gambar ${label}\n`;
            lockMsg += `• Durasi Kunci : 5 Menit\n`;
            lockMsg += `• Pembatalan : Ketik *cancel* atau *batal*\n\n`;
            lockMsg += `Silakan kirimkan sebuah berkas gambar langsung ke grup ini, atau ketik *cancel* untuk membatalkan sesi.`;
            return m.reply(lockMsg);
        }

        // Eksekusi pengunggahan langsung
        try {
            const { downloadContentFromMessage } = await import('@whiskeysockets/baileys').catch(() => import('ourin'));
            let targetMsg = isImageMsg ? msgObj.imageMessage : quotedMsg.imageMessage;
            let stream = await downloadContentFromMessage(targetMsg, 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }

            let link = await uploadToCloud(buffer);
            if (!link) throw new Error("Kegagalan unggah");

            db[m.chat][type].image = link;
            saveDb();

            let okMsg = `${greet.prefix} berkas visual latar berhasil ditautkan ke database.\n\n`;
            okMsg += `${sym.arrowCurve} ${sym.swoosh} *IMAGE LINKED* ${sym.sparkle}\n\n`;
            okMsg += `*Informasi Berkas :*\n\n`;
            okMsg += `• Layanan : Visual ${label}\n`;
            okMsg += `• Penyimpanan : Server Awan Aktif\n\n`;
            okMsg += `Gambar ini akan disertakan secara otomatis saat ada notifikasi member keluar atau masuk.`;
            return m.reply(okMsg);
        } catch (err) {
            let errMsg = `${greet.prefix} sistem mengalami kendala saat menghubungkan ke server penyimpanan awan.\n\n`;
            errMsg += `${sym.arrowCurve} ${sym.swoosh} *CLOUD ERROR* ${sym.sparkle}\n\n`;
            errMsg += `*Status Kendala :*\n\n`;
            errMsg += `• Masalah : Kegagalan Unggah Berkas\n\n`;
            errMsg += `Terjadi lonjakan lalu lintas pada server awan. Silakan ulangi beberapa saat lagi.`;
            return m.reply(errMsg);
        }
    }
};

// ==========================================
// INTERCEPTOR (PENANGKAP SESI LOCK WIZARD)
// ==========================================
handler.before = async (m) => {
    if (!m.chat || !m.sender) return false;
    
    const wizPath = path.resolve(process.cwd(), 'lib/engine/wizard-engine.js');
    const { getWizardLock, deleteWizardLock } = await import(`file://${wizPath}`);

    let lockType = getWizardLock(m.sender, m.chat);
    if (!lockType) return false;

    let msgObj = m.message || {};
    if (msgObj.ephemeralMessage) msgObj = msgObj.ephemeralMessage.message || msgObj;
    if (msgObj.viewOnceMessageV2) msgObj = msgObj.viewOnceMessageV2.message || msgObj;
    
    let bodyText = msgObj?.conversation || msgObj?.extendedTextMessage?.text || '';
    let isImageMsg = !!msgObj.imageMessage;

    const symPath = path.resolve(process.cwd(), 'lib/global-symbol.js');
    const { sym } = await import(`file://${symPath}`);

    let greet;
    try {
        const greetPath = path.resolve(process.cwd(), 'lib/engine/greet-engine.js');
        const { getGreeting } = await import(`file://${greetPath}`);
        greet = getGreeting(m, { isOwner: false, isAdmin: true });
    } catch {
        greet = { prefix: `Halo Anda,` };
    }

    // 1. Deteksi Pembatalan Manual
    if (/^(cancel|batal)$/i.test(bodyText.trim())) {
        deleteWizardLock(m.sender, m.chat);
        const label = lockType === 'welcome' ? 'Kedatangan' : 'Kepergian';

        let cancelMsg = `${greet.prefix} sesi pengunggahan visual telah dibatalkan atas permintaan Anda.\n\n`;
        cancelMsg += `${sym.arrowCurve} ${sym.swoosh} *SESI DIBATALKAN* ${sym.sparkle}\n\n`;
        cancelMsg += `*Status Sesi :*\n\n`;
        cancelMsg += `• Target : Gambar ${label}\n`;
        cancelMsg += `• Status : Kunci Target Dibebaskan\n\n`;
        cancelMsg += `Grup kini kembali ke mode normal dan sesi wizard telah ditutup.`;
        await m.reply(cancelMsg);
        return true;
    }

    // 2. Deteksi Gambar Masuk
    if (isImageMsg) {
        deleteWizardLock(m.sender, m.chat);
        const label = lockType === 'welcome' ? 'Kedatangan' : 'Kepergian';
        
        try {
            const { downloadContentFromMessage } = await import('@whiskeysockets/baileys').catch(() => import('ourin'));
            let stream = await downloadContentFromMessage(msgObj.imageMessage, 'image');
            let buffer = Buffer.from([]);
            for await (const chunk of stream) { buffer = Buffer.concat([buffer, chunk]); }

            let link = await uploadToCloud(buffer);
            if (!link) throw new Error("Upload Failed");

            const dbPath = path.resolve(process.cwd(), 'database', 'groups.json');
            let db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
            if (!db[m.chat]) db[m.chat] = {};
            if (!db[m.chat][lockType]) db[m.chat][lockType] = {};
            
            db[m.chat][lockType].image = link;
            
            const dir = path.dirname(dbPath);
            if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));

            let okMsg = `${greet.prefix} deteksi berkas visual otomatis berhasil diproses.\n\n`;
            okMsg += `${sym.arrowCurve} ${sym.swoosh} *IMAGE LINKED* ${sym.sparkle}\n\n`;
            okMsg += `*Informasi Berkas :*\n\n`;
            okMsg += `• Layanan : Visual ${label}\n`;
            okMsg += `• Status : Sesi Kunci Berhasil Ditutup\n\n`;
            okMsg += `Gambar tersebut telah disimpan dan siap dimuat saat ada aktivitas member di grup.`;
            return m.reply(okMsg);
        } catch (err) {
            let errMsg = `${greet.prefix} sistem mengalami kendala saat memproses berkas visual ke server awan.\n\n`;
            errMsg += `${sym.arrowCurve} ${sym.swoosh} *CLOUD ERROR* ${sym.sparkle}\n\n`;
            errMsg += `*Status Kendala :*\n\n`;
            errMsg += `• Masalah : Kegagalan Unggah Berkas\n\n`;
            errMsg += `Server awan tidak merespons secara optimal. Silakan ulangi pengiriman gambar.`;
            return m.reply(errMsg);
        }
    }
    
    return false;
};

handler.command = [
    'gate',
    'welcome', 
    'goodbye', 
    'setwelcome', 
    'setgoodbye', 
    'setwelcomemsg', 
    'setgoodbyemsg', 
    'setwelcomeimg', 
    'setgoodbyeimg'
];
handler.tags = ['admin'];
handler.group = true;
handler.admin = true;

export default handler;