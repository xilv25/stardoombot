import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getPluginFiles(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    try {
        const list = fs.readdirSync(dir, { withFileTypes: true });
        for (let file of list) {
            const filePath = path.join(dir, file.name);
            if (file.isDirectory()) results = results.concat(getPluginFiles(filePath));
            else if (file.name.endsWith('.js')) results.push(filePath);
        }
    } catch (e) {}
    return results;
}

export default {
    command: ['menu2', 'help2', 'list2', 'allmenu2'],
    category: 'main',
    description: '> Menampilkan pusat perintah versi teks yang rapi dan dinamis',

    run: async (m, { conn, usedPrefix }) => {
        let categoriesObj = {};
        const pluginsDir = path.resolve(process.cwd(), 'plugins');
        let pluginFiles = getPluginFiles(pluginsDir);

        // DAFTAR PENGECUALIAN (MULTI-COMMAND YANG DIIZINKAN TAMPIL SEMUA):
        const multiCommandPlugins = [];

        // DAFTAR KHUSUS COMMAND UTAMA YANG DITAMPILKAN UNTUK BERKAS TERTENTU (MENCEGAH BOCOR):
        const specificMainCommands = {
            'gate': ['gate'],
            'grouplist': ['grouplist'], // Hanya menampilkan 'grouplist' saja, 'list' disembunyikan dari menu
            'list': ['list'],
            'admin-group': ['open', 'desc', 'cpp', 'tchat', 'pending'] // Menampilkan command utama perwakilan fitur di admin-group
        };

        for (let file of pluginFiles) {
            try {
                // Menggunakan cache buster agar auto-update setiap kali ada plugin baru/perubahan
                const pluginUrl = `${pathToFileURL(file).href}?update=${Date.now()}`;
                const plugin = await import(pluginUrl);
                let p = plugin.default || plugin;

                if (!p || !p.command) continue;

                let cmds = [];
                if (Array.isArray(p.command)) cmds = p.command;
                else if (typeof p.command === 'string') cmds = [p.command];
                else continue;

                let baseName = path.basename(file, '.js').toLowerCase();
                let validCmds = [];

                if (specificMainCommands[baseName]) {
                    // Ambil command spesifik yang diset dalam daftar penyaringan
                    validCmds = specificMainCommands[baseName].filter(c => cmds.includes(c));
                    if (validCmds.length === 0 && cmds.length > 0) validCmds = [cmds[0]];
                } else if (multiCommandPlugins.includes(baseName)) {
                    validCmds = cmds;
                } else {
                    let mainCmd = cmds.includes(baseName) ? baseName : cmds[0];
                    validCmds = [mainCmd];
                }

                let relativePath = path.relative(pluginsDir, file);
                let folderName = path.dirname(relativePath);
                let cat = (folderName === '.' ? (p.category ? p.category : 'OTHERS') : folderName).toUpperCase();

                if (!categoriesObj[cat]) categoriesObj[cat] = [];
                categoriesObj[cat].push(...validCmds);
            } catch (e) {
                continue;
            }
        }

        const pushName = m.pushName || 'User';
        const watermark = conn.watermark || global.watermark || conn.footer || global.footer || 'メ ©Nameless StarDoom';
        const pfx = usedPrefix || m.prefix || '.';

        let menuText = `Selamat malam Tuan Muda *${pushName}*, berikut adalah daftar perintah cadangan berbasis teks.\n\n`;
        menuText += `╰› ᯓ *STARDOOM TEXT MENU* ˎˊ˗\n\n`;

        const sortedCats = Object.keys(categoriesObj).sort();
        
        for (const cat of sortedCats) {
            const uniqueCmds = [...new Set(categoriesObj[cat])].sort();
            if (uniqueCmds.length === 0) continue;

            // Langsung menampilkan nama kategori tanpa tulisan "Kategori :"
            menuText += `*${cat}*\n`;
            uniqueCmds.forEach(cmd => {
                menuText += `• \`${pfx}${cmd}\`\n`;
            });
            menuText += `\n`;
        }

        menuText += `${watermark}`;

        const fakeReply = {
            key: { fromMe: false, participant: '13135550002@s.whatsapp.net', remoteJid: 'status@broadcast' },
            message: {
                contactMessage: {
                    displayName: pushName,
                    vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${pushName}\nitem1.TEL;waid=13135550002:13135550002\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
                }
            }
        };

        await conn.sendMessage(m.chat, { text: menuText }, { quoted: fakeReply });
    }
};