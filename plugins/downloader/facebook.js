import path from 'path';

export default {
    command: ['fb', 'facebook'],
    category: 'download',
    description: '> Download video/reels dari Facebook',
    
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
            let msg = `Halo ${userTag}, harap cantumkan tautan video atau reels Facebook yang ingin kamu unduh ya.\n\n`;
            msg += `${sym.arrowCurve} ${sym.swoosh} *URL REQUIRED* ${sym.sparkle}\n\n`;
            msg += `*Contoh Penggunaan :*\n`;
            msg += `• \`${usedPrefix + command} https://www.facebook.com/share/v/...\`\n`;
            msg += `• \`${usedPrefix + command} https://www.facebook.com/reel/...\``;
            return m.reply(msg, null, { mentions: [m.sender] });
        }

        // Regex yang lebih longgar untuk mencakup semua jenis link Facebook (Web, Mobile, fb.gg, fb.watch, dll)
        if (!url.match(/facebook\.com|fb\.watch|fb\.com|fb\.gg/i)) {
            return m.reply(`Halo ${userTag}, tautan yang kamu berikan sepertinya bukan tautan Facebook yang valid. Coba periksa kembali.`, null, { mentions: [m.sender] });
        }

        try {
            const apiUrl = `https://api.makota.asia/api/v1/scrape/downloader/facebook?url=${encodeURIComponent(url)}`;
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

            if (!data.ok || !data.data || !data.data.media) {
                throw new Error('Video tidak ditemukan atau tautan diprivasi oleh pemiliknya.');
            }

            const mediaList = data.data.media;
            let selectedMedia = mediaList.find(m => m.quality === 'HD') || mediaList[0];

            if (!selectedMedia || !selectedMedia.link) {
                throw new Error('Gagal mengekstrak berkas media dari server sumber.');
            }

            // Ekstraksi Metadata dari API Makota
            const d = data.data;
            const title = d.title || d.desc || d.description || 'Tidak ada deskripsi.';
            const author = d.author || d.owner || 'Tidak diketahui';
            const like = d.like || d.likes || '-';
            const comment = d.comment || d.comments || '-';
            const share = d.share || d.shares || '-';
            const quality = selectedMedia.quality || 'HD';

            // Membangun Caption Final
            let caption = `Halo ${userTag}, ini video yang kamu minta.\n\n`;
            caption += `${sym.arrowCurve} ${sym.swoosh} *FACEBOOK DOWNLOADER* ${sym.sparkle}\n\n`;
            caption += `• *Kreator* : \`${author}\`\n`;
            caption += `• *Kualitas* : \`${quality}\`\n`;
            
            if (like !== '-') caption += `• *Suka* : \`${like}\`\n`;
            if (comment !== '-') caption += `• *Komentar* : \`${comment}\`\n`;
            if (share !== '-') caption += `• *Dibagikan* : \`${share}\`\n`;
            
            caption += `\n*Deskripsi :*\n${title}`;

            // Mengirim Video Langsung Tanpa Pesan Proses
            await conn.sendMessage(m.chat, {
                video: { url: selectedMedia.link },
                caption: caption,
                mimetype: 'video/mp4',
                mentions: [m.sender]
            }, { quoted: m });

        } catch (err) {
            console.error('[FACEBOOK DOWNLOAD ERROR]', err);

            if (String(err.message).includes('429') || String(err.message).includes('403') || String(err.message).includes('limit')) {
                let limitMsg = `Halo ${userTag}, mohon maaf saat ini sistem pengunduhan kami telah mencapai batas kuota proses harian.\n\n`;
                limitMsg += `${sym.arrowCurve} ${sym.swoosh} *DAILY LIMIT REACHED* ${sym.sparkle}\n\n`;
                limitMsg += `Silakan coba kembali besok hari ya.`;
                return m.reply(limitMsg, null, { mentions: [m.sender] });
            }

            let errMsg = `Halo ${userTag}, terjadi kendala saat memproses video tersebut.\n\n`;
            errMsg += `${sym.arrowCurve} ${sym.swoosh} *EXECUTION ERROR* ${sym.sparkle}\n\n`;
            errMsg += `• Detail: ${err.message}`;
            return m.reply(errMsg, null, { mentions: [m.sender] });
        }
    }
};