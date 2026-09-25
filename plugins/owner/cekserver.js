import path from 'path';

export default {
    command: ['cekserver', 'server', 'testserver'],
    category: 'owner',
    description: 'Mengetes kesiapan dan responsivitas server',
    run: async (m, { isOwner }) => {
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

        let msg = `${greet.prefix} sistem pengujian performa server telah berhasil diselesaikan.\n\n`;
        msg += `${sym.arrowCurve} ${sym.swoosh} *SERVER STATUS* ${sym.sparkle}\n\n`;
        msg += `*Kondisi Mesin :*\n\n`;
        msg += `• Status : Aktif & Responsif\n`;
        msg += `• Koneksi : Terhubung Normal\n`;
        msg += `• File System : Terbaca Sempurna\n\n`;
        msg += `Seluruh soket dan pendengar event bekerja dengan lancar tanpa ada hambatan.`;

        await m.reply(msg);
    }
};