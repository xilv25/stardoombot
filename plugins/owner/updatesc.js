import fs from 'fs';
import path from 'path';

export default {
    command: ['updatesc', 'savefile', 'sf'],
    category: 'owner',
    description: 'Membuat atau memperbarui file apa saja dari pesan yang di-reply',
    run: async (m, { text, isOwner, usedPrefix, command }) => {
        if (!isOwner) return;

        const symPath = path.resolve(process.cwd(), 'lib/global-symbol.js');
        const { sym } = await import(`file://${symPath}`);

        let greet;
        try {
            const greetPath = path.resolve(process.cwd(), 'lib/engine/greet-engine.js');
            const { getGreeting } = await import(`file://${greetPath}`);
            greet = getGreeting(m, { isOwner: true });
        } catch {
            const hour = parseInt(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: '2-digit', hour12: false }), 10);
            const time = (hour >= 4 && hour < 11) ? 'pagi' : (hour >= 11 && hour < 15) ? 'siang' : (hour >= 15 && hour < 18) ? 'sore' : 'malam';
            greet = { prefix: `Selamat ${time} tuan muda *${m.pushName || 'Master'}*,` };
        }
        
        if (!text) {
            let msg = `${greet.prefix} silakan tentukan jalur berkas yang ingin diperbarui.\n\n`;
            msg += `${sym.arrowCurve} ${sym.swoosh} *SCRIPT UPDATE* ${sym.sparkle}\n\n`;
            msg += `*Contoh Penggunaan :*\n\n`;
            msg += `• \`${usedPrefix + command} handler.js\`\n`;
            msg += `• \`${usedPrefix + command} lib/react-engine.js\`\n\n`;
            msg += `Balas pesan teks yang berisi kode pembaruan disertai penulisan jalur target di atas.`;
            return m.reply(msg);
        }

        const rootDir = process.cwd();

        let msgObj = m.message || {};
        if (msgObj.ephemeralMessage) msgObj = msgObj.ephemeralMessage.message || msgObj;
        if (msgObj.viewOnceMessage) msgObj = msgObj.viewOnceMessage.message || msgObj;
        if (msgObj.viewOnceMessageV2) msgObj = msgObj.viewOnceMessageV2.message || msgObj;

        const contextInfo = msgObj?.extendedTextMessage?.contextInfo || 
                            msgObj?.imageMessage?.contextInfo || 
                            msgObj?.videoMessage?.contextInfo || 
                            msgObj?.documentMessage?.contextInfo;
                            
        let quotedMessage = contextInfo?.quotedMessage || m.quoted;
        if (quotedMessage?.ephemeralMessage) quotedMessage = quotedMessage.ephemeralMessage.message || quotedMessage;
        if (quotedMessage?.viewOnceMessage) quotedMessage = quotedMessage.viewOnceMessage.message || quotedMessage;

        let code = '';
        if (quotedMessage) {
            code = quotedMessage.conversation || 
                   quotedMessage.extendedTextMessage?.text || 
                   quotedMessage.imageMessage?.caption || 
                   quotedMessage.videoMessage?.caption || 
                   quotedMessage.documentMessage?.caption || 
                   (typeof quotedMessage.text === 'string' ? quotedMessage.text : '');
        }

        if (!code) {
            let msg = `${greet.prefix} tidak ada baris kode yang terdeteksi pada pesan kutipan Anda.\n\n`;
            msg += `${sym.arrowCurve} ${sym.swoosh} *EMPTY PAYLOAD* ${sym.sparkle}\n\n`;
            msg += `*Instruksi :*\n\n`;
            msg += `• Balas (reply) pesan obrolan yang memuat kode sumber secara lengkap.\n\n`;
            msg += `Proses pembaruan dibatalkan karena tidak ada data yang dapat diinjeksikan.`;
            return m.reply(msg);
        }

        let targetPath = text.trim();
        const filePath = path.resolve(rootDir, targetPath);
        if (!filePath.startsWith(rootDir)) {
            let msg = `${greet.prefix} jalur target berada di luar cakupan direktori utama bot.\n\n`;
            msg += `${sym.arrowCurve} ${sym.swoosh} *INVALID PATH* ${sym.sparkle}\n\n`;
            msg += `*Path Dilarang :*\n\n`;
            msg += `• \`${targetPath}\`\n\n`;
            msg += `Akses ditolak demi melindungi integritas berkas di luar ruang lingkup proyek.`;
            return m.reply(msg);
        }

        const dirPath = path.dirname(filePath);
        if (!fs.existsSync(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }

        if (code.startsWith('```') && code.endsWith('```')) {
            code = code.slice(3, -3).replace(/^(javascript|js|json|html|css|txt)\n?/, '').trim();
        }

        fs.writeFileSync(filePath, code, 'utf-8');

        let msg = `${greet.prefix} berkas inti sistem berhasil diperbarui secara langsung.\n\n`;
        msg += `${sym.arrowCurve} ${sym.swoosh} *CORE SCRIPT UPDATED* ${sym.sparkle}\n\n`;
        msg += `*Detail Berkas :*\n\n`;
        msg += `• Lokasi : \`${targetPath}\`\n`;
        msg += `• Ukuran : ${Buffer.byteLength(code, 'utf-8')} bytes\n\n`;
        msg += `Seluruh perubahan kode telah tersimpan secara permanen ke disk server.`;
        return m.reply(msg);
    }
};