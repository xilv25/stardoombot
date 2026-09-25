import fs from 'fs';
import path from 'path';

export default {
    command: ['cmd', 'globalcmd'],
    category: 'owner',
    description: 'Menonaktifkan seluruh command bot secara global kecuali untuk owner',
    run: async (m, { args, isOwner }) => {
        if (!isOwner) return;

        const symPath = path.resolve(process.cwd(), 'lib/global-symbol.js');
        const { sym } = await import(`file://${symPath}`);

        let greet;
        try {
            const greetPath = path.resolve(process.cwd(), 'lib/engine/greet-engine.js');
            const { getGreeting } = await import(`file://${greetPath}`);
            greet = getGreeting(m, { isOwner: true });
        } catch {
            greet = { prefix: `Selamat malam tuan muda *${m.pushName || 'Master'}*,` };
        }

        const action = args[0]?.toLowerCase();
        if (!['on', 'off'].includes(action)) {
            let msg = `${greet.prefix} tentukan parameter status global command.\n\n`;
            msg += `${sym.arrowCurve} ${sym.swoosh} *GLOBAL CMD CONFIG* ${sym.sparkle}\n\n`;
            msg += `• \`.cmd off\` : Matikan command untuk publik (Owner Only)\n`;
            msg += `• \`.cmd on\` : Nyalakan kembali command untuk publik\n\n`;
            msg += `${sym.sword} ©Nameless StarDoom`;
            return m.reply(msg);
        }

        const settingPath = path.resolve(process.cwd(), 'database', 'settings.json');
        let settings = {};
        if (fs.existsSync(settingPath)) {
            try { settings = JSON.parse(fs.readFileSync(settingPath, 'utf-8')); } catch {}
        }

        // JIKA 'off', MAKA BOT DI-OFF-KAN UNTUK PUBLIK (Owner Only)
        settings.offcmd = (action === 'off');
        fs.writeFileSync(settingPath, JSON.stringify(settings, null, 2));

        let statusText = settings.offcmd ? 'AKTIF (Khusus Owner / Public Off)' : 'NORMAL (Publik Bisa)';
        let msg = `${greet.prefix} status pembatasan command global berhasil diperbarui.\n\n`;
        msg += `${sym.arrowCurve} ${sym.swoosh} *GLOBAL CMD STATUS* ${sym.sparkle}\n\n`;
        msg += `• *Status* : ${statusText}\n\n`;
        msg += `${sym.sword} ©Nameless StarDoom`;
        return m.reply(msg);
    }
};