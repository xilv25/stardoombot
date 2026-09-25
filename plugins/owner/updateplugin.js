import fs from 'fs';
import path from 'path';

export default {
    command: ['updateplugin', 'reload', 'saveplugin'],
    category: 'owner',
    description: 'Membuat atau memperbarui file plugin otomatis dari pesan yang di-reply',
    run: async (m, { text, isOwner, usedPrefix, command }) => {
        if (!isOwner) return;

        // 1. Dynamic Import Simbol & Greet Engine (Aman dari perbedaan struktur folder)
        const symPath = path.resolve(process.cwd(), 'lib/global-symbol.js');
        const { sym } = await import(`file://${symPath}`);

        let greet;
        try {
            const greetPath = path.resolve(process.cwd(), 'lib/engine/greet-engine.js');
            const { getGreeting } = await import(`file://${greetPath}`);
            greet = getGreeting(m, { isOwner: true });
        } catch {
            const hour = parseInt(
                new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: '2-digit', hour12: false }),
                10
            );
            const time = (hour >= 4 && hour < 11) ? 'pagi' : (hour >= 11 && hour < 15) ? 'siang' : (hour >= 15 && hour < 18) ? 'sore' : 'malam';
            greet = { prefix: `Selamat ${time} tuan muda *${m.pushName || 'Master'}*,` };
        }

        // 2. Kunci Direktori Plugins dari Root (Bebas dari risiko membaca node_modules)
        const pluginsRoot = path.resolve(process.cwd(), 'plugins');

        const getPluginFiles = (dir) => {
            let files = [];
            if (!fs.existsSync(dir)) return files;
            const items = fs.readdirSync(dir, { withFileTypes: true });
            for (let item of items) {
                if (['node_modules', '.git', 'session'].includes(item.name)) continue;
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    files = files.concat(getPluginFiles(fullPath));
                } else if (item.name.endsWith('.js')) {
                    files.push(fullPath);
                }
            }
            return files;
        };

        // 3. Ekstraksi Pesan Kutipan (Reply)
        const contextInfo = m.message?.extendedTextMessage?.contextInfo || 
                            m.message?.imageMessage?.contextInfo || 
                            m.message?.videoMessage?.contextInfo || 
                            m.message?.documentMessage?.contextInfo;
                            
        let quotedMessage = contextInfo?.quotedMessage;
        let code = '';

        if (quotedMessage) {
            code = quotedMessage.conversation || 
                   quotedMessage.extendedTextMessage?.text || 
                   quotedMessage.imageMessage?.caption || 
                   quotedMessage.videoMessage?.caption || 
                   quotedMessage.documentMessage?.caption || '';
        }

        // Mode 1: Menulis/Memperbarui Berkas dari Pesan Reply
        if (text && code) {
            let target = text.trim().replace(/\.js$/, '');
            if (target.startsWith('plugins/')) target = target.slice(8);

            const filePath = path.join(pluginsRoot, target + '.js');
            const dirPath = path.dirname(filePath);

            if (!fs.existsSync(dirPath)) {
                fs.mkdirSync(dirPath, { recursive: true });
            }

            if (code.startsWith('```') && code.endsWith('```')) {
                code = code.slice(3, -3).replace(/^(javascript|js)\n?/, '').trim();
            }

            fs.writeFileSync(filePath, code, 'utf-8');

            const allFiles = getPluginFiles(pluginsRoot);
            
            let msg = `${greet.prefix} injeksi modul plugin baru telah berhasil diselesaikan.\n\n`;
            msg += `${sym.arrowCurve} ${sym.swoosh} *PLUGIN INJECTED* ${sym.sparkle}\n\n`;
            msg += `*Detail Modul :*\n\n`;
            msg += `• Nama Berkas : \`${target}.js\`\n`;
            msg += `• Jalur Relatif : \`./plugins/${target}.js\`\n`;
            msg += `• Total Plugin Aktif : ${allFiles.length} berkas\n\n`;
            msg += `Modul tersebut telah tersinkronisasi dan siap dipanggil tanpa perlu merestart bot.`;
            return m.reply(msg);
        }

        // Mode 2: Reload & Sinkronisasi Seluruh Direktori Plugin
        const allFiles = getPluginFiles(pluginsRoot);

        let msg = `${greet.prefix} penyegaran seluruh direktori plugin berhasil dilakukan.\n\n`;
        msg += `${sym.arrowCurve} ${sym.swoosh} *SYSTEM SYNCHRONIZED* ${sym.sparkle}\n\n`;
        msg += `*Status Modul :*\n\n`;
        msg += `• Sinkronisasi : Berhasil\n`;
        msg += `• Total Plugin Terbaca : ${allFiles.length} berkas\n\n`;
        msg += `Seluruh berkas plugin dalam direktori kerja telah siap menjalankan instruksi tugas.`;
        return m.reply(msg);
    }
};
