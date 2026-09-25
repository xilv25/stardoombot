import path from 'path';

export default {
    command: ['ig', 'instagram', 'igdl', 'igreels'],
    category: 'download',
    description: '> Download video/foto/reels dari Instagram',
    
    run: async (m, { text, args, usedPrefix, command, conn }) => {
        // Memanggil Global Symbol
        const symPath = path.resolve(process.cwd(), 'lib/global-symbol.js');
        let sym;
        try {
            sym = (await import(`file://${symPath}`)).sym;
        } catch {
            sym = { arrowCurve: '╰›', swoosh: 'ᯓ', sparkle: 'ˎˊ˗' };
        }

        const userTag = `@${m.sender.split('@')[0]}`;
        
        let axios;
        try {
            axios = (await import('axios')).default || await import('axios');
        } catch (err) {
            let msg = `Halo ${userTag}, modul \`axios\` diperlukan untuk menstabilkan koneksi.\n\n`;
            msg += `${sym.arrowCurve} ${sym.swoosh} *MODULE MISSING* ${sym.sparkle}\n\n`;
            msg += `Silakan instal di terminal panel dengan perintah: \`npm i axios\``;
            return m.reply(msg, null, { mentions: [m.sender] });
        }

        let url = (text || args.join(' ')).trim();

        // Ambil URL dari reply dan filter hanya link-nya saja jika ada teks lain
        if (!url && m.quoted) {
            let quotedText = m.quoted.text || m.quoted.caption || m.quoted.raw?.message?.conversation || m.quoted.raw?.message?.extendedTextMessage?.text || '';
            url = quotedText.match(/https?:\/\/[^\s]+/)?.[0] || '';
        }

        if (!url) {
            let msg = `Halo ${userTag}, harap cantumkan tautan Instagram yang ingin kamu unduh ya.\n\n`;
            msg += `${sym.arrowCurve} ${sym.swoosh} *URL REQUIRED* ${sym.sparkle}\n\n`;
            msg += `*Contoh Penggunaan :*\n`;
            msg += `• \`${usedPrefix + command} https://www.instagram.com/reel/...\`\n`;
            msg += `• \`${usedPrefix + command} https://www.instagram.com/p/...\``;
            return m.reply(msg, null, { mentions: [m.sender] });
        }

        if (!url.match(/instagram\.com/i)) {
            return m.reply(`Halo ${userTag}, tautan yang kamu berikan sepertinya bukan tautan Instagram yang valid. Coba periksa kembali.`, null, { mentions: [m.sender] });
        }

        try {
            const apiUrl = `https://api.makota.asia/api/v1/scrape/downloader/instagram?url=${encodeURIComponent(url)}`;
            const apiKey = 'mki.eyJ1aWQiOjc5LCJ0eXBlIjoiYXBpIiwianRpIjoiZGNlYzc5ZjdkMmI3MWM5NmE5NGEzZjk4OTJiM2EzMWMiLCJpYXQiOjE3ODg3MjkwMTZ9.rD7LZleCzUAPZmFbQvOsSSzsDSsTjPPDDYzLzElomTM';
            
            const response = await axios.get(apiUrl, {
                headers: {
                    'Makota-API': apiKey,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/114.0.0.0 Safari/537.36'
                },
                validateStatus: () => true
            });

            const data = response.data;
            const status = response.status;

            // Deteksi Limit (Status 429/403) atau pesan limit dari JSON
            if (status === 429 || status === 403 || (data.ok === false && String(data.message).toLowerCase().includes('limit'))) {
                let limitMsg = `Halo ${userTag}, mohon maaf saat ini sistem pengunduhan kami telah mencapai batas kuota proses harian.\n\n`;
                limitMsg += `${sym.arrowCurve} ${sym.swoosh} *DAILY LIMIT REACHED* ${sym.sparkle}\n\n`;
                limitMsg += `Silakan coba kembali besok hari ya.`;
                return m.reply(limitMsg, null, { mentions: [m.sender] });
            }

            if (!data.ok || !data.data) {
                throw new Error('Konten tidak ditemukan atau akun Instagram diprivasi oleh pemiliknya.');
            }

            // Normalisasi data (mengubah object tunggal menjadi array agar support format Album/Carousel)
            let mediaItems = Array.isArray(data.data) ? data.data : [data.data];
            
            if (mediaItems.length === 0 || !mediaItems[0].url) {
                throw new Error('Gagal mengekstrak berkas media dari server sumber.');
            }

            let caption = `Halo ${userTag}, ini konten Instagram yang kamu minta.\n\n`;
            caption += `${sym.arrowCurve} ${sym.swoosh} *INSTAGRAM DOWNLOADER* ${sym.sparkle}`;

            // Looping untuk mengirim semua media jika tipenya Carousel (Slide Post)
            for (let i = 0; i < mediaItems.length; i++) {
                let item = mediaItems[i];
                let isVideo = item.type === 'video' || String(item.url).includes('.mp4');

                let sendOptions = { mentions: [m.sender] };
                
                // Berikan caption hanya pada media pertama agar tidak spam teks
                if (i === 0) sendOptions.caption = caption;

                if (isVideo) {
                    sendOptions.video = { url: item.url };
                    sendOptions.mimetype = 'video/mp4';
                } else {
                    sendOptions.image = { url: item.url };
                }

                await conn.sendMessage(m.chat, sendOptions, { quoted: m });
            }

        } catch (err) {
            console.error('[INSTAGRAM DOWNLOAD ERROR]', err);

            if (String(err.message).includes('429') || String(err.message).includes('403') || String(err.message).includes('limit')) {
                let limitMsg = `Halo ${userTag}, mohon maaf saat ini sistem pengunduhan kami telah mencapai batas kuota proses harian.\n\n`;
                limitMsg += `${sym.arrowCurve} ${sym.swoosh} *DAILY LIMIT REACHED* ${sym.sparkle}\n\n`;
                limitMsg += `Silakan coba kembali besok hari ya.`;
                return m.reply(limitMsg, null, { mentions: [m.sender] });
            }

            let errMsg = `Halo ${userTag}, terjadi kendala saat memproses konten tersebut.\n\n`;
            errMsg += `${sym.arrowCurve} ${sym.swoosh} *EXECUTION ERROR* ${sym.sparkle}\n\n`;
            errMsg += `• Detail: ${err.message}`;
            return m.reply(errMsg, null, { mentions: [m.sender] });
        }
    }
};