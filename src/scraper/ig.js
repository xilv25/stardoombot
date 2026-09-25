import axios from 'axios';
import * as cheerio from 'cheerio';

// Pembersih URL hasil ekstraksi
function cleanUrl(rawUrl) {
    if (!rawUrl) return '';
    return rawUrl
        .replace(/\\u0026/g, '&')
        .replace(/&amp;/g, '&')
        .replace(/\\\//g, '/')
        .replace(/\\/g, '')
        .trim();
}

// Algoritma Dekoder Enkripsi SnapSave / SaveClip
function decodeSnapApp(h, u, n, t, e, r) {
    function rFunc(d, e, f) {
        const g = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+/'.split('');
        const hArr = g.slice(0, e);
        const iArr = g.slice(0, f);
        let j = d.split('').reverse().reduce((a, b, c) => {
            const idx = hArr.indexOf(b);
            return idx !== -1 ? a + idx * Math.pow(e, c) : a;
        }, 0);
        let k = '';
        while (j > 0) {
            k = iArr[j % f] + k;
            j = (j - (j % f)) / f;
        }
        return k || '0';
    }
    let res = '';
    for (let i = 0, len = h.length; i < len; i++) {
        let s = '';
        while (h[i] !== n[e]) {
            s += h[i];
            i++;
        }
        for (let j = 0; j < n.length; j++) {
            s = s.replace(new RegExp(n[j], 'g'), j.toString());
        }
        res += String.fromCharCode(Number(rFunc(s, e, 10)) - t);
    }
    return decodeURIComponent(encodeURIComponent(res));
}

function extractHtml(raw) {
    if (typeof raw !== 'string') return '';
    if (raw.includes('download-items') || raw.includes('download-bottom')) return raw;

    const match = raw.match(/\}\s*\(\s*("[\s\S]*?"|'[\s\S]*?'),\s*(\d+),\s*("[\s\S]*?"|'[\s\S]*?'),\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/);
    if (match) {
        const h = match[1].slice(1, -1);
        const u = parseInt(match[2], 10);
        const n = match[3].slice(1, -1);
        const t = parseInt(match[4], 10);
        const e = parseInt(match[5], 10);
        const r = parseInt(match[6], 10);

        const decoded = decodeSnapApp(h, u, n, t, e, r);
        const htmlMatch = decoded.match(/\.html\s*\(\s*(["'])([\s\S]*?)\1\s*\)/);
        if (htmlMatch) {
            return htmlMatch[2]
                .replace(/\\"/g, '"')
                .replace(/\\'/g, "'")
                .replace(/\\n/g, '')
                .replace(/\\t/g, '')
                .replace(/\\\//g, '/');
        }
        return decoded;
    }
    return raw;
}

// Jalur 1: Cobalt Scraper Core (Bypass proteksi Cloudflare VPS)
async function engineCobalt(targetUrl) {
    const instances = [
        'https://api.cobalt.tools/api/json',
        'https://cobalt-api.kwiatekm.tokyo/api/json'
    ];

    for (const endpoint of instances) {
        try {
            const res = await axios.post(endpoint, {
                url: targetUrl,
                videoQuality: 'max'
            }, {
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout: 10000
            });

            const data = res.data;
            const mediaList = [];

            if (data?.url) {
                mediaList.push({
                    type: data.url.includes('.mp4') || data.status === 'stream' ? 'video' : 'image',
                    url: data.url
                });
            } else if (Array.isArray(data?.picker)) {
                for (const p of data.picker) {
                    if (p.url) {
                        mediaList.push({
                            type: p.type === 'video' || p.url.includes('.mp4') ? 'video' : 'image',
                            url: p.url
                        });
                    }
                }
            }

            if (mediaList.length > 0) return mediaList;
        } catch {}
    }
    return [];
}

// Jalur 2: InDownloader Engine
async function engineInDownloader(targetUrl) {
    try {
        const res = await axios.post('https://indownloader.app/request', new URLSearchParams({
            link: targetUrl,
            downloader: 'video'
        }).toString(), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
                'X-Requested-With': 'XMLHttpRequest',
                'Origin': 'https://indownloader.app',
                'Referer': 'https://indownloader.app/'
            },
            timeout: 12000
        });

        const html = res.data?.html || res.data;
        if (!html || typeof html !== 'string') return [];

        const $ = cheerio.load(html);
        const mediaList = [];

        $('a[href^="http"]').each((_, el) => {
            const href = $(el).attr('href');
            const text = $(el).text().toLowerCase();

            if (href && (href.includes('.mp4') || href.includes('fbcdn') || href.includes('cdninstagram') || text.includes('download') || text.includes('unduh'))) {
                const isVid = href.includes('.mp4') || text.includes('video');
                if (!mediaList.some(m => m.url === href)) {
                    mediaList.push({ type: isVid ? 'video' : 'image', url: href });
                }
            }
        });

        return mediaList;
    } catch {
        return [];
    }
}

// Jalur 3: SnapSave / SaveClip Engine
async function engineSnapSave(targetUrl) {
    try {
        const res = await axios.post('https://snapsave.app/action.php?lang=id', new URLSearchParams({
            url: targetUrl
        }).toString(), {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Origin': 'https://snapsave.app',
                'Referer': 'https://snapsave.app/id'
            },
            timeout: 12000
        });

        const htmlString = extractHtml(res.data);
        if (!htmlString) return [];

        const $ = cheerio.load(htmlString);
        const mediaList = [];

        $('.download-items, .download-box').each((_, el) => {
            const video = $(el).find('a[href*="dl.php"], a:contains("Download Video"), a:contains("Unduh Video")').attr('href');
            const photo = $(el).find('a:contains("Download Photo"), a:contains("Unduh Foto")').attr('href') || $(el).find('img').attr('src');

            if (video) mediaList.push({ type: 'video', url: cleanUrl(video) });
            else if (photo) mediaList.push({ type: 'image', url: cleanUrl(photo) });
        });

        return mediaList;
    } catch {
        return [];
    }
}

// Fungsi Utama: Instagram Downloader
export async function instagramDownloader(targetUrl) {
    let media = [];

    // Prioritas 1: Cobalt Scraper Core
    media = await engineCobalt(targetUrl);

    // Prioritas 2: InDownloader
    if (!media || media.length === 0) {
        media = await engineInDownloader(targetUrl);
    }

    // Prioritas 3: SnapSave Engine
    if (!media || media.length === 0) {
        media = await engineSnapSave(targetUrl);
    }

    if (!media || media.length === 0) {
        throw new Error('Media tidak ditemukan. Pastikan akun tidak diprivat dan tautan valid.');
    }

    return {
        title: 'Instagram Media',
        username: '-',
        likes: '-',
        comment: '-',
        media
    };
}

export default instagramDownloader;