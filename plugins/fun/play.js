import path from 'path';

const API_URL = 'https://api.azbry.com/api/download/ytplay2';

async function getJson(url) {
    const response = await fetch(url, {
        headers: {
            'Accept': 'application/json',
            'User-Agent': 'Mozilla/5.0'
        }
    });

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
}

async function downloadBuffer(url) {
    const response = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0',
            'Accept': 'audio/mpeg,audio/*;q=0.9,*/*;q=0.8'
        }
    });

    if (!response.ok) {
        throw new Error(`Gagal download audio: HTTP ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!buffer.length) {
        throw new Error('Audio kosong');
    }

    return buffer;
}

export default {
    command: ['play', 'music', 'song'],
    category: 'download',
    description: 'Download lagu dari youtube berdasarkan judul.',
    run: async (m, { text, args, usedPrefix, command, conn, isOwner }) => {
        // Memanggil Global Symbol
        const symPath = path.resolve(process.cwd(), 'lib/global-symbol.js');
        let sym;
        try {
            sym = (await import(`file://${symPath}`)).sym;
        } catch {
            sym = { arrowCurve: '╰›', swoosh: 'ᯓ', sparkle: 'ˎˊ˗' };
        }

        // Memanggil Greeting Engine
        let greet;
        try {
            const greetPath = path.resolve(process.cwd(), 'lib/engine/greet-engine.js');
            const { getGreeting } = await import(`file://${greetPath}`);
            greet = getGreeting(m, { isOwner });
        } catch {
            const hour = parseInt(new Date().toLocaleString("en-US", { timeZone: "Asia/Jakarta", hour: '2-digit', hour12: false }), 10);
            const time = (hour >= 4 && hour < 11) ? 'pagi' : (hour >= 11 && hour < 15) ? 'siang' : (hour >= 15 && hour < 18) ? 'sore' : 'malam';
            greet = { prefix: `Selamat ${time} Tuan Muda *${m.pushName || 'Master'}*,` };
        }

        let query = (text || args.join(' ')).trim();

        // Jika query kosong, ambil teks dari pesan yang direply.
        if (!query && m.quoted) {
            const q = m.quoted;
            query = q.text || q.caption || q.raw?.message?.conversation || q.raw?.message?.extendedTextMessage?.text || '';
        }

        if (!query) {
            let msg = `${greet.prefix} judul lagu tidak ditemukan pada perintah atau pesan yang Anda balas.\n\n`;
            msg += `${sym.arrowCurve} ${sym.swoosh} *QUERY REQUIRED* ${sym.sparkle}\n\n`;
            msg += `*Panduan Penggunaan :*\n`;
            msg += `• Format : \`${usedPrefix + command} <judul lagu>\`\n`;
            msg += `• Contoh : \`${usedPrefix + command} DJ Remix Terbaru\``;
            return m.reply(msg);
        }

        try {
            if (typeof m.react === 'function') await m.react('🎵');

            const url = `${API_URL}?q=${encodeURIComponent(query)}`;
            const data = await getJson(url);

            if (!data?.status || !data?.result) {
                throw new Error('API tidak mengembalikan hasil yang valid');
            }

            const res = data.result;
            const title = res.title || query;
            const downloadUrl = res.download;

            if (!downloadUrl) {
                throw new Error('Url download audio tidak tersedia');
            }

            let infoMsg = `${greet.prefix} berhasil menemukan dan memproses lagu permintaan Anda.\n\n`;
            infoMsg += `${sym.arrowCurve} ${sym.swoosh} *YOUTUBE PLAY* ${sym.sparkle}\n\n`;
            infoMsg += `• Judul : \`${title}\`\n\n`;
            infoMsg += `Mohon tunggu sebentar, berkas audio sedang diunduh dan dikirimkan.`;

            await m.reply(infoMsg);

            // Ambil audio menjadi buffer
            const audioBuffer = await downloadBuffer(downloadUrl);

            await conn.sendMessage(
                m.chat,
                {
                    audio: audioBuffer,
                    mimetype: 'audio/mpeg',
                    ptt: false
                },
                { quoted: m }
            );

            if (typeof m.react === 'function') await m.react('✅');

        } catch (err) {
            console.error('[PLAY ERROR]', err);

            if (typeof m.react === 'function') await m.react('❌');

            let errText = `${greet.prefix} proses pengunduhan audio gagal dieksekusi oleh sistem.\n\n`;
            errText += `${sym.arrowCurve} ${sym.swoosh} *EXECUTION ERROR* ${sym.sparkle}\n\n`;
            errText += `• ${err.message}`;
            return m.reply(errText);
        }
    }
};