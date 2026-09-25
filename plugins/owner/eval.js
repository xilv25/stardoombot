import util from 'util';
import path from 'path';

export default {
    command: ['eval', 'ev'],
    category: 'owner',
    description: 'Evaluate JavaScript code',

    before: async (m, { conn }) => {
        if (!m.text) return false;

        const clean = m.text.trim();
        if (clean.startsWith('=>')) {
            let isOwner = false;
            try {
                const ownPath = path.resolve(process.cwd(), 'lib/engine/own-engine.js');
                const { verifyOwner } = await import(`file://${ownPath}`);
                isOwner = verifyOwner(m.sender, m);
            } catch {
                isOwner = m.sender.includes('6281380518572') || m.key?.fromMe;
            }

            if (!isOwner) return false;

            const code = clean.replace(/^=>\s*/, '');
            if (!code) return false;

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

            try {
                let result = code.startsWith('{') ? await eval(`(async () => ${code})()`) : await eval(`(async () => { return ${code} })()`);
                if (typeof result !== 'string') result = util.inspect(result, { depth: 2 });

                let msg = `${greet.prefix} evaluasi kode JavaScript telah selesai diproses.\n\n`;
                msg += `${sym.arrowCurve} ${sym.swoosh} *EVALUATION RESULT* ${sym.sparkle}\n\n`;
                msg += `*Hasil Eksekusi :*\n\n`;
                msg += `\`\`\`javascript\n${result}\n\`\`\`\n\n`;
                msg += `Instruksi berhasil dieksekusi langsung pada runtime Node.js tanpa galat.`;
                await m.reply(msg);
            } catch (err) {
                let msg = `${greet.prefix} proses evaluasi kode mendeteksi adanya galat sintaks atau runtime.\n\n`;
                msg += `${sym.arrowCurve} ${sym.swoosh} *EVALUATION ERROR* ${sym.sparkle}\n\n`;
                msg += `*Detail Galat :*\n\n`;
                msg += `\`\`\`javascript\n${err.message || err}\n\`\`\`\n\n`;
                msg += `Silakan periksa kembali deklarasi variabel atau logika asinkron kode Anda.`;
                await m.reply(msg);
            }
            return true;
        }
        return false;
    },

    run: async (m, { conn, text, isOwner }) => {
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
            let msg = `${greet.prefix} silakan masukkan baris kode JavaScript yang ingin dievaluasi.\n\n`;
            msg += `${sym.arrowCurve} ${sym.swoosh} *EVALUATION INPUT* ${sym.sparkle}\n\n`;
            msg += `*Contoh Penggunaan :*\n\n`;
            msg += `• \`=> m.chat\`\n`;
            msg += `• \`.eval config\`\n\n`;
            msg += `Sistem siap mengeksekusi instruksi langsung pada konteks runtime bot.`;
            return m.reply(msg);
        }

        try {
            let result = text.startsWith('{') ? await eval(`(async () => ${text})()`) : await eval(`(async () => { return ${text} })()`);
            if (typeof result !== 'string') result = util.inspect(result, { depth: 2 });

            let msg = `${greet.prefix} evaluasi kode JavaScript telah selesai diproses.\n\n`;
            msg += `${sym.arrowCurve} ${sym.swoosh} *EVALUATION RESULT* ${sym.sparkle}\n\n`;
            msg += `*Hasil Eksekusi :*\n\n`;
            msg += `\`\`\`javascript\n${result}\n\`\`\`\n\n`;
            msg += `Instruksi berhasil dieksekusi langsung pada runtime Node.js tanpa galat.`;
            await m.reply(msg);
        } catch (err) {
            let msg = `${greet.prefix} proses evaluasi kode mendeteksi adanya galat sintaks atau runtime.\n\n`;
            msg += `${sym.arrowCurve} ${sym.swoosh} *EVALUATION ERROR* ${sym.sparkle}\n\n`;
            msg += `*Detail Galat :*\n\n`;
            msg += `\`\`\`javascript\n${err.message || err}\n\`\`\`\n\n`;
            msg += `Silakan periksa kembali deklarasi variabel atau logika asinkron kode Anda.`;
            await m.reply(msg);
        }
    }
};