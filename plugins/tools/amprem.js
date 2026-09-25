import path from 'path';

export default {
    command: ['amprem', 'alightmotion'],
    category: 'tools',
    description: '> Generate Magic Link Alight Motion Premium',
    
    run: async (m, { conn, text, usedPrefix, command }) => {
        const pfx = usedPrefix || '.';
        
        const symPath = path.resolve(process.cwd(), 'lib/global-symbol.js');
        let sym;
        try {
            sym = (await import(`file://${symPath}`)).sym;
        } catch {
            sym = { arrowCurve: '╰›', swoosh: 'ᯓ', sparkle: 'ˎˊ˗' };
        }

        if (!text) {
            let guideMsg = `Harap masukkan alamat email yang ingin disuntikkan.\n\n`;
            guideMsg += `${sym.arrowCurve} ${sym.swoosh} *AM PREMIUM INJECTOR* ${sym.sparkle}\n\n`;
            guideMsg += `*Format:*\n• \`${pfx + command} <email>\`\n\n`;
            guideMsg += `*Contoh:*\n• \`${pfx + command} stardoom@gmail.com\``;
            return m.reply(guideMsg);
        }

        const email = text.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return m.reply(`Format email tidak valid. Pastikan penulisan email benar tanpa spasi ekstra.`);
        }

        let axios;
        try {
            axios = (await import('axios')).default || await import('axios');
        } catch (err) {
            return m.reply(`Modul \`axios\` belum terinstal. Ketik \`npm i axios\` di terminal.`);
        }

        try {
            // GANTI BAGIAN INI: Masukkan URL API scraper AM yang valid di bawah ini
            // Contoh jika kamu jalankan scraper di peladen sendiri: `http://103.4.82.76:6010/api/am?email=${encodeURIComponent(email)}`
            const apiUrl = `MASUKKAN_URL_API_KAMU_DISINI?email=${encodeURIComponent(email)}`;
            
            const response = await axios.get(apiUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Mobile Safari/537.36'
                },
                timeout: 15000
            });

            const data = response.data;

            // Pastikan objek "magic_link" sesuai dengan output dari API buatanmu
            if (!data || !data.magic_link) {
                throw new Error('Gagal mendapatkan Magic Link. Endpoint scraper mungkin sedang limit atau di-patch.');
            }

            let resultMsg = `Suntikan Magic Link berhasil dieksekusi!\n\n`;
            resultMsg += `${sym.arrowCurve} ${sym.swoosh} *ALIGHT MOTION PREMIUM* ${sym.sparkle}\n\n`;
            resultMsg += `• *Target* : \`${email}\`\n`;
            resultMsg += `• *Status* : \`Verified\`\n\n`;
            resultMsg += `🔗 *Magic Link:*\n${data.magic_link}\n\n`;
            resultMsg += `_⚠️ Segera klik tautan di atas melalui HP yang terinstal Alight Motion. Link akan kadaluarsa dalam beberapa menit._`;

            return m.reply(resultMsg);

        } catch (err) {
            console.error('[AMPREM ERROR]', err);
            
            let errMsg = `Terjadi kendala saat menyuntikkan email ke server Alight Motion.\n\n`;
            errMsg += `${sym.arrowCurve} ${sym.swoosh} *EXECUTION ERROR* ${sym.sparkle}\n\n`;
            errMsg += `• Detail: ${err.message || 'Koneksi ke scraper terputus atau API tidak valid.'}`;
            return m.reply(errMsg);
        }
    }
};