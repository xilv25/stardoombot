import axios from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';
import { pathToFileURL } from 'url';

async function scrapeTwitter(targetUrl) {
    const res = await axios.get(`https://twitsave.com/info?url=${encodeURIComponent(targetUrl)}`, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
        },
        timeout: 15000
    });

    const $ = cheerio.load(res.data);
    const desc = $('p.text-gray-800, p.text-base').first().text().trim() || 'Postingan Twitter/X';
    
    // Cari video terlebih dahulu
    let videoUrl = '';
    $('a[href*="twitsave.com/download"], a:contains("Download")').each((_, el) => {
        const href = $(el).attr('href');
        if (!videoUrl && href && href.startsWith('http')) {
            videoUrl = href;
        }
    });

    // Jika tidak ada video, periksa apakah berbentuk gambar/foto
    const images = [];
    if (!videoUrl) {
        $('img[src*="twimg.com/media"]').each((_, el) => {
            const src = $(el).attr('src');
            if (src) images.push(src);
        });
    }

    if (!videoUrl && images.length === 0) {
        throw new Error('Media tidak ditemukan atau cuitan privat.');
    }

    return {
        desc,
        videoUrl,
        images
    };
}

export default {
    command: ['twitter', 'twt', 'x', 'xdl', 'twtdl'],
    category: 'downloader',
    description: '> Mengunduh video atau gambar dari Twitter/X via web scraper',

    run: async (m, { conn, text, command, isOwner, isAdmin }) => {
        const pfx = m.prefix || '.';
        const cmd = command.toLowerCase();

        let greeting = '';
        try {
            const enginePath = pathToFileURL(path.resolve(process.cwd(), 'lib/engine/greet-engine.js')).href;
            const greetMod = await import(enginePath);
            const fnGreet = greetMod.getGreeting || greetMod.default?.getGreeting || greetMod.default;
            if (typeof fnGreet === 'function') {
                const res = fnGreet(m, { isOwner, isAdmin });
                greeting = typeof res === 'object' ? (res.prefix || res.text) : res;
            }
        } catch {}

        if (!greeting) {
            const hour = new Date().getHours();
            const ucapan = hour < 4 ? 'dini hari' : hour < 11 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam';
            greeting = `Selamat ${ucapan} ${isOwner ? 'Tuan Muda' : (isAdmin ? 'Admin' : 'Kak')} *${m.pushName || 'User'}*,`;
        }

        const fakeReply = {
            key: { fromMe: false, participant: '13135550002@s.whatsapp.net', remoteJid: 'status@broadcast' },
            message: { contactMessage: { displayName: m.pushName || 'User', vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${m.pushName || 'User'}\nitem1.TEL;waid=13135550002:13135550002\nitem1.X-ABLabel:Ponsel\nEND:VCARD` } }
        };

        const targetUrl = (text || '').trim();
        if (!targetUrl || (!targetUrl.includes('twitter.com') && !targetUrl.includes('x.com'))) {
            return await m.reply(
                `${greeting} tautan Twitter/X tidak terdeteksi.\n\n` +
                `╰› ᯓ *SYSTEM WARNING* ˎˊ˗\n\n` +
                `*Format Penggunaan :*\n• \`${pfx}${cmd} <tautan twitter/x>\``
            );
        }

        try {
            const data = await scrapeTwitter(targetUrl);

            const caption = `${greeting}\n\n` +
                `╰› ᯓ *INFORMASI MEDIA* ˎˊ˗\n\n` +
                `• *Platform :* Twitter / X\n` +
                `• *Takarir :* ${data.desc}\n` +
                `• *Status :* Berhasil diunduh`;

            if (data.videoUrl) {
                await conn.sendMessage(m.chat, { video: { url: data.videoUrl }, caption }, { quoted: fakeReply });
            } else {
                for (let i = 0; i < data.images.length; i++) {
                    await conn.sendMessage(m.chat, {
                        image: { url: data.images[i] },
                        caption: i === 0 ? caption : undefined
                    }, { quoted: fakeReply });
                    if (data.images.length > 1) await new Promise(r => setTimeout(r, 1500));
                }
            }
        } catch (err) {
            await m.reply(
                `Gagal mengunduh media Twitter/X.\n\n` +
                `╰› ᯓ *SCRAPER ERROR* ˎˊ˗\n\n` +
                `• Pesan : ${err.message || 'Kendala saat memproses cuitan'}`
            );
        }
    }
};