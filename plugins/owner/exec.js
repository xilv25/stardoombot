import { exec } from 'child_process';
import util from 'util';
import path from 'path';

export default {
    command: ['exec', '$'],
    category: 'owner',
    description: 'Execute shell commands',

    before: async (m) => {
        if (!m.text) return false;

        const clean = m.text.trim();
        if (clean.startsWith('$')) {
            let isOwner = false;
            try {
                const ownPath = path.resolve(process.cwd(), 'lib/engine/own-engine.js');
                const { verifyOwner } = await import(`file://${ownPath}`);
                isOwner = verifyOwner(m.sender, m);
            } catch {
                isOwner = m.sender.includes('6281380518572') || m.key?.fromMe;
            }

            if (!isOwner) return false;

            const cmd = clean.slice(1).trim();
            if (!cmd) return false;

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

            const execAsync = util.promisify(exec);
            const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';

            try {
                const { stdout, stderr } = await execAsync(cmd, { shell, timeout: 60000, maxBuffer: 1024 * 1024, encoding: 'utf8' });
                const output = stdout || stderr || 'No output';

                let msg = `${greet.prefix} instruksi terminal shell berhasil diselesaikan.\n\n`;
                msg += `${sym.arrowCurve} ${sym.swoosh} *TERMINAL RESULT* ${sym.sparkle}\n\n`;
                msg += `*Perintah :*\n\n`;
                msg += `• \`$ ${cmd}\`\n\n`;
                msg += `*Output Konsol :*\n\n`;
                msg += `\`\`\`\n${output.slice(0, 3500)}\n\`\`\`\n\n`;
                msg += `Keluaran konsol di atas merupakan hasil langsung dari sistem operasi server.`;
                await m.reply(msg);
            } catch (err) {
                const errorMsg = err.stderr || err.stdout || err.message;
                let msg = `${greet.prefix} eksekusi terminal shell mengembalikan kode galat.\n\n`;
                msg += `${sym.arrowCurve} ${sym.swoosh} *TERMINAL ERROR* ${sym.sparkle}\n\n`;
                msg += `*Perintah :*\n\n`;
                msg += `• \`$ ${cmd}\`\n\n`;
                msg += `*Keluaran Galat :*\n\n`;
                msg += `\`\`\`\n${errorMsg.slice(0, 3500)}\n\`\`\`\n\n`;
                msg += `Periksa kembali ketersediaan paket atau izin akses pada instruksi shell yang dijalankan.`;
                await m.reply(msg);
            }
            return true;
        }
        return false;
    },

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
            let msg = `${greet.prefix} masukkan perintah bash atau shell yang ingin dijalankan.\n\n`;
            msg += `${sym.arrowCurve} ${sym.swoosh} *TERMINAL INPUT* ${sym.sparkle}\n\n`;
            msg += `*Contoh Penggunaan :*\n\n`;
            msg += `• \`$ ls -la\`\n`;
            msg += `• \`${usedPrefix + command} df -h\`\n\n`;
            msg += `Sistem siap mengeksekusi instruksi langsung pada lingkungan server.`;
            return m.reply(msg);
        }

        try {
            const execAsync = util.promisify(exec);
            const shell = process.platform === 'win32' ? 'powershell.exe' : '/bin/bash';

            const { stdout, stderr } = await execAsync(text, { shell, timeout: 60000, maxBuffer: 1024 * 1024, encoding: 'utf8' });
            const output = stdout || stderr || 'No output';

            let msg = `${greet.prefix} instruksi terminal shell berhasil diselesaikan.\n\n`;
            msg += `${sym.arrowCurve} ${sym.swoosh} *TERMINAL RESULT* ${sym.sparkle}\n\n`;
            msg += `*Perintah :*\n\n`;
            msg += `• \`$ ${text}\`\n\n`;
            msg += `*Output Konsol :*\n\n`;
            msg += `\`\`\`\n${output.slice(0, 3500)}\n\`\`\`\n\n`;
            msg += `Keluaran konsol di atas merupakan hasil langsung dari sistem operasi server.`;
            await m.reply(msg);
        } catch (err) {
            const errorMsg = err.stderr || err.stdout || err.message;
            let msg = `${greet.prefix} eksekusi terminal shell mengembalikan kode galat.\n\n`;
            msg += `${sym.arrowCurve} ${sym.swoosh} *TERMINAL ERROR* ${sym.sparkle}\n\n`;
            msg += `*Perintah :*\n\n`;
            msg += `• \`$ ${text}\`\n\n`;
            msg += `*Keluaran Galat :*\n\n`;
            msg += `\`\`\`\n${errorMsg.slice(0, 3500)}\n\`\`\`\n\n`;
            msg += `Periksa kembali ketersediaan paket atau izin akses pada instruksi shell yang dijalankan.`;
            await m.reply(msg);
        }
    }
};