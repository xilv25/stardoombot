import axios from 'axios';
import * as cheerio from 'cheerio';
import path from 'path';
import { pathToFileURL } from 'url';

// Pemformat angka ribuan standar Indonesia (contoh: 24.150)
function formatNumber(num) {
    if (typeof num !== 'number' || isNaN(num)) return num || '0';
    return new Intl.NumberFormat('id-ID').format(num);
}

// 1. Ekstraktor Metadata Terstruktur dari Halaman Web TikTok
async function getTikTokMetadata(targetUrl) {
    let metadata = {
        username: 'anonim',
        nickname: 'Pengguna TikTok',
        desc: 'Tidak ada takarir.',
        likes: '-',
        comments: '-',
        views: '-',
        shares: '-',
        tags: '-'
    };

    // Langkah A: Scrape dokumen HTML langsung
    try {
        const res = await axios.get(targetUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7'
            },
            maxRedirects: 5,
            timeout: 12000
        });

        const html = res.data;
        let itemStruct = null;

        const universalMatch = html.match(/<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/);
        if (universalMatch) {
            try {
                const parsed = JSON.parse(universalMatch[1]);
                itemStruct = parsed.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
            } catch {}
        }

        if (!itemStruct) {
            const sigiMatch = html.match(/<script id="SIGI_STATE"[^>]*>([\s\S]*?)<\/script>/);
            if (sigiMatch) {
                try {
                    const parsed = JSON.parse(sigiMatch[1]);
                    const itemModule = parsed.ItemModule;
                    if (itemModule) {
                        const firstKey = Object.keys(itemModule)[0];
                        itemStruct = itemModule[firstKey];
                    }
                } catch {}
            }
        }

        if (itemStruct) {
            const desc = itemStruct.desc || '';
            const tagsFromChallenges = (itemStruct.challenges || []).map(c => `#${c.title}`);
            const tagsFromDesc = (desc.match(/#[\w\u0590-\u05ff]+/g) || []);
            const uniqueTags = [...new Set([...tagsFromChallenges, ...tagsFromDesc])];

            return {
                username: itemStruct.author?.uniqueId || itemStruct.author || 'anonim',
                nickname: itemStruct.author?.nickname || itemStruct.nickname || 'Pengguna TikTok',
                desc: desc.trim() || 'Tidak ada takarir.',
                likes: formatNumber(itemStruct.stats?.diggCount ?? itemStruct.diggCount),
                comments: formatNumber(itemStruct.stats?.commentCount ?? itemStruct.commentCount),
                views: formatNumber(itemStruct.stats?.playCount ?? itemStruct.playCount),
                shares: formatNumber(itemStruct.stats?.shareCount ?? itemStruct.shareCount),
                tags: uniqueTags.length > 0 ? uniqueTags.join(' ') : '-'
            };
        }
    } catch {}

    // Langkah B: Cadangan jika struktur HTML di atas terproteksi
    try {
        const oembedRes = await axios.get(`https://www.tiktok.com/oembed?url=${encodeURIComponent(targetUrl)}`, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            timeout: 8000
        });

        if (oembedRes.data) {
            const d = oembedRes.data;
            const desc = d.title || '';
            const tags = (desc.match(/#[\w\u0590-\u05ff]+/g) || []);

            metadata.username = d.author_unique_id || 'anonim';
            metadata.nickname = d.author_name || 'Pengguna TikTok';
            metadata.desc = desc.trim() || 'Tidak ada takarir.';
            metadata.tags = tags.length > 0 ? tags.join(' ') : '-';
        }
    } catch {}

    return metadata;
}

// 2. Mesin Pengikis Berkas Media (Musicaldown)
async function scrapeTikTokMedia(targetUrl) {
    const baseUrl = 'https://musicaldown.com/id';
    
    const getRes = await axios.get(baseUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        timeout: 15000
    });

    const cookie = getRes.headers['set-cookie']?.map(c => c.split(';')[0]).join('; ') || '';
    const $initial = cheerio.load(getRes.data);
    
    const formAction = baseUrl + '/download';
    const postData = {};

    $initial('form input').each((_, el) => {
        const name = $initial(el).attr('name');
        const val = $initial(el).attr('value') || '';
        if (name) postData[name] = val;
    });

    const inputKey = Object.keys(postData).find(k => postData[k] === '');
    if (inputKey) postData[inputKey] = targetUrl;
    else postData[$initial('form input[type="text"]').attr('name') || 'link'] = targetUrl;

    const postRes = await axios.post(formAction, new URLSearchParams(postData).toString(), {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Cookie': cookie,
            'Origin': 'https://musicaldown.com',
            'Referer': baseUrl
        },
        timeout: 20000
    });

    const $result = cheerio.load(postRes.data);
    let videoUrl = '';

    $result('a.btn[href]').each((_, el) => {
        const href = $result(el).attr('href');
        const text = $result(el).text().toLowerCase();

        if (!videoUrl && href.startsWith('http') && (text.includes('unduh') || text.includes('download') || text.includes('server'))) {
            videoUrl = href;
        }
    });

    if (!videoUrl) {
        throw new Error('Gagal mengekstrak berkas video dari laman penyedia.');
    }

    return videoUrl;
}

export default {
    command: ['tt', 'tiktok', 'ttdl'],
    category: 'downloader',
    description: '> Mengunduh media TikTok beserta statistik terstruktur via web scraper',

    run: async (m, { conn, text, command, isOwner, isAdmin }) => {
        const pfx = m.prefix || '.';
        const cmd = command.toLowerCase();

        // Pemuatan Greet Engine Dinamis
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
            const role = isOwner ? 'Tuan Muda' : (isAdmin ? 'Admin' : 'Kak');
            greeting = `Selamat ${ucapan} ${role} *${m.pushName || 'User'}*,`;
        }

        const pushName = m.pushName || 'User';
        const fakeReply = {
            key: { fromMe: false, participant: '13135550002@s.whatsapp.net', remoteJid: 'status@broadcast' },
            message: { contactMessage: { displayName: pushName, vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${pushName}\nitem1.TEL;waid=13135550002:13135550002\nitem1.X-ABLabel:Ponsel\nEND:VCARD` } }
        };

        const targetUrl = (text || '').trim();

        if (!targetUrl || !targetUrl.includes('tiktok.com')) {
            return await m.reply(
                `${greeting} tautan TikTok tidak terdeteksi.\n\n` +
                `╰› ᯓ *SYSTEM WARNING* ˎˊ˗\n\n` +
                `*Format Penggunaan :*\n` +
                `• \`${pfx}${cmd} <tautan tiktok>\`\n\n` +
                `Contoh : \`${pfx}${cmd} https://vt.tiktok.com/ZS.../\``
            );
        }

        try {
            const [meta, videoUrl] = await Promise.all([
                getTikTokMetadata(targetUrl),
                scrapeTikTokMedia(targetUrl)
            ]);

            const caption = `${greeting}\n\n` +
                `╰› ᯓ *INFORMASI MEDIA* ˎˊ˗\n\n` +
                `• *Pengguna :* ${meta.nickname} (@${meta.username})\n` +
                `• *Total Suka :* ${meta.likes}\n` +
                `• *Total Komentar :* ${meta.comments}\n` +
                `• *Total Tayangan :* ${meta.views}\n` +
                `• *Total Dibagikan :* ${meta.shares}\n\n` +
                `*Takarir :*\n${meta.desc}\n\n` +
                `*Tagar :*\n${meta.tags}`;

            await conn.sendMessage(m.chat, {
                video: { url: videoUrl },
                caption: caption
            }, { quoted: fakeReply });

        } catch (err) {
            await m.reply(
                `Gagal mengunduh media TikTok.\n\n` +
                `╰› ᯓ *SCRAPER ERROR* ˎˊ˗\n\n` +
                `• Pesan : ${err.message || 'Kendala saat memproses halaman TikTok'}\n\n` +
                `Pastikan tautan bersifat publik dan dapat dibuka.`
            );
        }
    }
};