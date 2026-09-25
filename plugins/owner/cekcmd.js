import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

export default {
    command: ['cekcmd', 'detectcmd'],
    category: 'owner',
    description: 'Memindai konflik command antar plugin',
    
    run: async (m, { conn, usedPrefix }) => {
        const pfx = usedPrefix || m.prefix || '.';
        
        // Konfigurasi waktu sapaan otomatis
        const hour = new Date().toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false });
        let ucapan = 'malam';
        if (hour >= 4 && hour < 11) ucapan = 'pagi';
        else if (hour >= 11 && hour < 15) ucapan = 'siang';
        else if (hour >= 15 && hour < 18) ucapan = 'sore';
        
        const nama = m.pushName || 'Trikz Or Treat';
        const pluginsDir = path.join(process.cwd(), 'plugins');
        const commandMap = new Map();
        
        const getAllFiles = (dir) => {
            let results = [];
            const list = fs.readdirSync(dir);
            list.forEach(file => {
                file = path.join(dir, file);
                const stat = fs.statSync(file);
                if (stat && stat.isDirectory()) { 
                    results = results.concat(getAllFiles(file));
                } else if (file.endsWith('.js')) {
                    results.push(file);
                }
            });
            return results;
        };

        let files;
        try {
            files = getAllFiles(pluginsDir);
        } catch (e) {
            return m.reply(`Gagal membaca direktori sistem penyimpanan.`);
        }

        for (const file of files) {
            try {
                const fileUrl = pathToFileURL(file).href + '?t=' + Date.now();
                const module = await import(fileUrl);
                const plugin = module.default || module;
                
                if (plugin && plugin.command) {
                    let cmds = Array.isArray(plugin.command) ? plugin.command : [plugin.command];
                    
                    for (let cmd of cmds) {
                        if (typeof cmd === 'string') {
                            cmd = cmd.toLowerCase().trim();
                            if (!commandMap.has(cmd)) {
                                commandMap.set(cmd, []);
                            }
                            // Merapikan string path agar format slash rapi ( / )
                            const shortPath = file.replace(process.cwd(), '').replace(/\\/g, '/').replace(/^\//, '');
                            commandMap.get(cmd).push(shortPath);
                        }
                    }
                }
            } catch (e) {
                // Skip file error agar scanning tetap jalan
            }
        }

        let duplicates = [];
        for (const [cmd, filePaths] of commandMap.entries()) {
            if (filePaths.length > 1) {
                duplicates.push(`• Command : \`${pfx}${cmd}\`\n  Lokasi : \n  - ${filePaths.join('\n  - ')}`);
            }
        }

        let output = `Selamat ${ucapan} Tuan Muda *${nama}*, sistem telah selesai memindai seluruh direktori plugin.\n\n`;
        output += `╰› ᯓ *SCANNER COMMAND* ˎˊ˗\n\n`;
        output += `*Rincian Pemindaian :*\n\n`;

        if (duplicates.length === 0) {
            output += `• Status : Bersih\n`;
            output += `• Total Berkas : \`${files.length} File\`\n\n`;
            output += `Sistem terbebas dari tabrakan command. Seluruh berkas sinkron.\n`;
        } else {
            output += `• Status : Terdeteksi Konflik\n\n`;
            output += `${duplicates.join('\n\n')}\n\n`;
            output += `Silakan hapus atau ubah nama command pada berkas terkait untuk menghindari kegagalan eksekusi.\n`;
        }

        output += `メ ©StarDoom Universe`;

        return m.reply(output);
    }
};