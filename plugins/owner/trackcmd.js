import fs from 'fs';
import path from 'path';

export default {
    command: ['trackcmd', 'findcmd', 'whereis'],
    category: 'owner',
    description: '> Melacak lokasi direktori fisik dari sebuah command.',
    
    run: async (m, { text, usedPrefix, command }) => {
        if (!text) {
            return m.reply(`Harap masukkan nama command yang ingin dilacak.\nContoh: \`${usedPrefix + command} confess\``);
        }

        const targetCmd = text.trim().toLowerCase();
        const pluginsDir = path.resolve(process.cwd(), 'plugins');
        let foundFiles = [];

        // Fungsi pemindai folder secara rekursif
        function scanDir(dir) {
            if (!fs.existsSync(dir)) return;
            
            const files = fs.readdirSync(dir);
            for (let file of files) {
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    scanDir(fullPath);
                } else if (file.endsWith('.js')) {
                    const content = fs.readFileSync(fullPath, 'utf-8');
                    
                    // Deteksi kata kunci command dengan berbagai gaya kutipan
                    if (content.includes(`'${targetCmd}'`) || content.includes(`"${targetCmd}"`) || content.includes(`\`${targetCmd}\``)) {
                        // Validasi tambahan agar tidak menangkap file secara acak (harus memiliki properti command)
                        if (content.includes('command:')) {
                            // Merapikan path agar mudah dibaca
                            foundFiles.push(fullPath.replace(process.cwd(), ''));
                        }
                    }
                }
            }
        }

        scanDir(pluginsDir);

        if (foundFiles.length > 0) {
            let msg = `[ COMMAND TRACKER ]\n\nCommand *${targetCmd}* terdeteksi di lokasi berikut:\n\n`;
            foundFiles.forEach((file, i) => {
                msg += `*${i + 1}.* \`.${file}\`\n`;
            });
            msg += `\nSilakan periksa dan hapus file tersebut jika terjadi duplikasi.`;
            return m.reply(msg);
        } else {
            let warnMsg = `[ TRACKER RESULT ]\n\nCommand *${targetCmd}* TIDAK DITEMUKAN secara fisik di dalam sistem.\n\n`;
            warnMsg += `⚠️ *Analisis:* Jika command ini masih merespon saat diketik, berarti command tersebut menyangkut di dalam **Cache RAM**. Kamu wajib melakukan \`.restart\` atau memuat ulang panel/VPS agar bot membuang sisa ingatannya.`;
            return m.reply(warnMsg);
        }
    }
};