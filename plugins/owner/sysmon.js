import fs from 'fs';
import path from 'path';

// Helper rekursif untuk membaca semua file plugin
function getPluginFiles(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (let file of list) {
        const filePath = path.join(dir, file.name);
        if (file.isDirectory()) {
            results = results.concat(getPluginFiles(filePath));
        } else if (file.name.endsWith('.js')) {
            results.push(filePath);
        }
    }
    return results;
}

export default {
    command: ['sysmon', 'checkmod', 'ram'],
    category: 'owner',
    description: 'Memantau penggunaan RAM peladen dan mengaudit modul npm yang aktif di plugins.',
    run: async (m, { conn, text, usedPrefix, command, isOwner }) => {
        if (!isOwner) return;

        // Memanggil Global Symbol & Greeting
        const symPath = path.resolve(process.cwd(), 'lib/global-symbol.js');
        let sym;
        try { sym = (await import(`file://${symPath}`)).sym; } catch { sym = { arrowCurve: '╰›', swoosh: 'ᯓ', sparkle: 'ˎˊ˗' }; }

        if (command === 'ram' || command === 'sysmon') {
            const memory = process.memoryUsage();
            const formatMB = (bytes) => (bytes / 1024 / 1024).toFixed(2);

            let msg = `╰› ᯓ *SYSTEM RAM MONITOR* ˎˊ˗\n\n`;
            msg += `• *RSS (Total Memori OS):* \`${formatMB(memory.rss)} MB\`\n`;
            msg += `• *Heap Total:* \`${formatMB(memory.heapTotal)} MB\`\n`;
            msg += `• *Heap Used (Digunakan):* \`${formatMB(memory.heapUsed)} MB\`\n`;
            msg += `• *External (Buffer/C++):* \`${formatMB(memory.external)} MB\`\n\n`;
            msg += `• *Uptime Bot:* \`${Math.floor(process.uptime() / 60)} menit\`\n\n`;
            msg += `Ketik \`${usedPrefix}checkmod\` untuk mengaudit modul npm yang terpakai/tidak di plugin.`;

            return m.reply(msg);
        }

        if (command === 'checkmod') {
            const pkgPath = path.resolve(process.cwd(), 'package.json');
            if (!fs.existsSync(pkgPath)) return m.reply('File package.json tidak ditemukan.');

            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            const dependencies = { ...pkg.dependencies, ...pkg.devDependencies };
            const depNames = Object.keys(dependencies);

            const pluginsDir = path.resolve(process.cwd(), 'plugins');
            const pluginFiles = getPluginFiles(pluginsDir);

            // Baca semua isi kode plugin ke dalam satu string besar
            let allPluginCode = '';
            for (let file of pluginFiles) {
                try {
                    allPluginCode += fs.readFileSync(file, 'utf-8') + '\n';
                } catch {}
            }

            let usedMods = [];
            let unusedMods = [];

            for (let mod of depNames) {
                // Cek apakah nama modul di-import atau di-require di dalam kode plugin
                const regex = new RegExp(`(import.*['"].*${mod}.*['"]|require\\(['"]${mod}['"]\\))`, 'i');
                if (regex.test(allPluginCode) || mod === 'ourin' || mod === 'baileys') {
                    usedMods.push(mod);
                } else {
                    unusedMods.push(mod);
                }
            }

            let msg = `╰› ᯓ *MODULE AUDIT REPORT* ˎˊ˗\n\n`;
            msg += `• *Total Modul Terdaftar:* \`${depNames.length}\`\n`;
            msg += `• *Terdeteksi Dipakai:* \`${usedMods.length}\`\n`;
            msg += `• *Potensi Tidak Terpakai:* \`${unusedMods.length}\`\n\n`;

            if (unusedMods.length > 0) {
                msg += `*Daftar Modul Curigai Tak Terpakai :*\n`;
                unusedMods.forEach(mod => {
                    msg += `• \`${mod}\` (${dependencies[mod]})\n`;
                });
                msg += `\n_Catatan: Beberapa modul mungkin dipakai di file core (lib/), cek manual sebelum menghapusnya via \`npm uninstall <modul>\`._`;
            } else {
                msg += `Semua modul terdaftar tampaknya digunakan dalam sistem.`;
            }

            return m.reply(msg);
        }
    }
};