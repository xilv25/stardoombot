import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default {
    command: ['backup'],
    category: 'owner',
    description: 'Mencadangkan seluruh file source code panel dan mengirimkannya ke WhatsApp.',
    run: async (m, { text, args, usedPrefix, command, conn, isOwner }) => {
        if (!isOwner) return;

        // Memanggil Global Symbol
        const symPath = path.resolve(process.cwd(), 'lib/global-symbol.js');
        let sym;
        try {
            sym = (await import(`file://${symPath}`)).sym;
        } catch {
            sym = { arrowCurve: '╰›', swoosh: 'ᯓ', sparkle: 'ˎˊ˗' };
        }

        // Memanggil Greeting Engine
        let greet;
        try {
            const greetPath = path.resolve(process.cwd(), 'lib/engine/greet-engine.js');
            const { getGreeting } = await import(`file://${greetPath}`);
            greet = getGreeting(m, { isOwner: true });
        } catch {
            const hour = parseInt(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: '2-digit', hour12: false }), 10);
            const time = (hour >= 4 && hour < 11) ? 'pagi' : (hour >= 11 && hour < 15) ? 'siang' : (hour >= 15 && hour < 18) ? 'sore' : 'malam';
            greet = { prefix: `Selamat ${time} Tuan Muda *${m.pushName || 'Master'}*,` };
        }

        let startMsg = `${greet.prefix} sistem sedang memulai proses pencadangan menggunakan utilitas peladen...\n\n`;
        startMsg += `${sym.arrowCurve} ${sym.swoosh} *BACKUP STARTED* ${sym.sparkle}\n\n`;
        startMsg += `Mohon tunggu sebentar, proses ini memerlukan waktu tergantung ukuran berkas.`;
        await m.reply(startMsg);

        const backupDir = path.resolve(process.cwd(), 'database/backup');
        if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

        const dateTag = new Date().toISOString().replace(/[:.]/g, '-');
        const zipName = `Backup-Panel_${dateTag}.zip`;
        const zipPath = path.join(backupDir, zipName);

        try {
            // Memanfaatkan perintah sistem Linux 'zip' secara langsung (Tanpa modul tambahan)
            await execAsync(`zip -r "${zipPath}" . -x "node_modules/*" "database/backup/*" "session/*" ".git/*"`);

            if (!fs.existsSync(zipPath)) {
                throw new Error("Gagal menghasilkan berkas arsip ZIP.");
            }

            const stats = fs.statSync(zipPath);
            const fileSizeInMB = (stats.size / (1024 * 1024)).toFixed(2);

            let caption = `${greet.prefix} arsip berkas panel berhasil dicadangkan dan dikemas.\n\n`;
            caption += `${sym.arrowCurve} ${sym.swoosh} *BACKUP SUCCESSFUL* ${sym.sparkle}\n\n`;
            caption += `*Rincian Berkas :*\n\n`;
            caption += `• Nama Berkas : \`${zipName}\`\n`;
            caption += `• Ukuran File : \`${fileSizeInMB} MB\`\n`;
            caption += `• Waktu Arsip : \`${new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })}\`\n\n`;
            caption += `Arsip direktori peladen siap diunduh.`;

            await conn.sendMessage(m.chat, {
                document: fs.readFileSync(zipPath),
                mimetype: 'application/zip',
                fileName: zipName,
                caption: caption
            }, { quoted: m });

            try { fs.unlinkSync(zipPath); } catch {}

        } catch (err) {
            let errText = `${greet.prefix} proses pencadangan gagal dieksekusi oleh sistem.\n\n`;
            errText += `${sym.arrowCurve} ${sym.swoosh} *BACKUP ERROR* ${sym.sparkle}\n\n• ${err.message}`;
            await m.reply(errText);
        }
    }
};