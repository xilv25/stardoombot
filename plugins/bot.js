import { sym } from '../lib/global-symbol.js';

export default {
    command: ['bot', 'status'],
    run: async (m, { conn }) => {
        // Penataan presisi sesuai arahan
        const statusText = `${sym.arrowCurve} ${sym.swoosh} *STATUS SISTEM* ${sym.sparkle}\n\n`
            + `${sym.dot} Sistem: *Online & Stabil*\n`
            + `${sym.dot} Respon: *Real-time*`;

        await m.reply(statusText);
    }
};
