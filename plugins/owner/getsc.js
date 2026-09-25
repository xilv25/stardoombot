import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let handler = async (m, { text, isOwner, usedPrefix, command, pushName, conn }) => {
    // 1. Dynamic Import Mutlak
    const symPath = path.resolve(process.cwd(), 'lib/global-symbol.js');
    const { sym } = await import(`file://${symPath}`);

    // 2. Validasi Akses Owner Mutlak
    if (!isOwner) {
        await m.react('❌');
        return m.reply(`${sym.arrowCurve} ${sym.swoosh} *AKSES DITOLAK*\n\nPerintah ini khusus untuk Master.`);
    }

    if (!text) {
        await m.react('❌');
        return m.reply(`${sym.arrowCurve} ${sym.swoosh} *PARAMETER KOSONG*\n\nBerikan nama file yang ingin diambil.\n*Contoh:* \`${usedPrefix + command} menu\` atau \`${usedPrefix + command} lib/builder.js\``);
    }

    // 3. Engine Builder
    let AIRich;
    try {
        const builderPath = path.resolve(process.cwd(), 'lib/builder.js');
        const builder = await import(`file://${builderPath}?v=${Date.now()}`);
        AIRich = builder.AIRich;
    } catch (err) {
        await m.react('❌');
        return m.reply(`${sym.arrowCurve} ${sym.swoosh} *CRASH PADA BUILDER*\n\nSistem gagal memuat module pembuat UI. Detail:\n\`\`\`\n${err.message}\n\`\`\``);
    }

    // 4. Penentuan Waktu WIB untuk Sapaan Dinamis
    const getGreeting = () => {
        const hour = parseInt(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: '2-digit', hour12: false }));
        if (hour >= 4 && hour < 11) return 'pagi';
        if (hour >= 11 && hour < 15) return 'siang';
        if (hour >= 15 && hour < 18) return 'sore';
        return 'malam';
    };

    // 5. Smart File Locator (Bisa baca path langsung atau auto-search seluruh folder)
    const cleanText = text.trim();
    const rootDir = process.cwd();
    let targetPath = path.resolve(rootDir, cleanText);

    // Jika tidak ditulis path lengkapnya, sistem akan mencari ke seluruh sudut folder
    if (!fs.existsSync(targetPath)) {
        let targetFileName = cleanText.split('/').pop();
        if (!targetFileName.includes('.')) targetFileName += '.js';

        const findFileUniversal = (dir, fileName) => {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                // Abaikan folder berat & rahasia agar pencarian secepat kilat
                if (['node_modules', '.git', 'session'].includes(file)) continue;
                
                const fullPath = path.join(dir, file);
                const stat = fs.statSync(fullPath);
                
                if (stat.isDirectory()) {
                    const result = findFileUniversal(fullPath, fileName);
                    if (result) return result;
                } else if (file === fileName) {
                    return fullPath;
                }
            }
            return null;
        };

        targetPath = findFileUniversal(rootDir, targetFileName);
    }

    if (!targetPath || !fs.existsSync(targetPath)) {
        await m.react('❌');
        return m.reply(`${sym.arrowCurve} ${sym.swoosh} *TIDAK DITEMUKAN*\n\nSistem tidak dapat menemukan file \`${cleanText}\` di dalam direktori manapun.`);
    }

    // 6. Eksekusi NIXCODE AIRich
    try {
        const code = fs.readFileSync(targetPath, 'utf-8');
        const relativePath = path.relative(rootDir, targetPath);
        const fileExt = path.extname(targetPath).substring(1) || 'javascript'; // Deteksi bahasa otomatis
        
        // Memastikan bahasa dikenali oleh syntax highlighter builder
        const langMap = { 'js': 'javascript', 'json': 'json', 'ts': 'typescript', 'py': 'python' };
        const highlightLang = langMap[fileExt] || 'javascript';

        const fakeReply = {
            key: { fromMe: false, participant: '13135550002@s.whatsapp.net', remoteJid: 'status@broadcast' },
            message: { contactMessage: { displayName: pushName, vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${pushName}\nitem1.TEL;waid=13135550002:13135550002\nitem1.X-ABLabel:Ponsel\nEND:VCARD` } }
        };

        const rich = new AIRich(conn);
        
        // Header dengan sapaan eksklusif
        rich.addText(`Selamat ${getGreeting()} tuan muda *${pushName}*, ini adalah source code yang Anda minta:\n\n${sym.dot} *Nama File* : ${path.basename(targetPath)}\n${sym.dot} *Lokasi* : ${relativePath}\n\n`);
        
        // Code Block
        rich.addCode(highlightLang, code);
        
        // Footer eksklusif pengganti Note
        rich.addText(`Eksekusi selesai. Jaga kerahasiaan kode ini, Master.`);
        
        // Watermark tanpa _italic_
        rich.setFooter(`${sym.sword} ©Nameless StarDoom`);

        await rich.send(m.chat, { quoted: fakeReply });
        await m.react('✅');
    } catch (err) {
        await m.react('❌');
        await m.reply(`${sym.arrowCurve} ${sym.swoosh} *SYSTEM ERROR*\n\nGagal merender file kode:\n\`\`\`\n${err.message}\n\`\`\``);
    }
};

handler.command = ['getsc', 'getplugin', 'sc'];
handler.owner = true;

export default handler;