import { Buffer } from 'buffer';
import axios from 'axios';

if (!global.readmanSearch) global.readmanSearch = {};
if (!global.readmanActiveSession) global.readmanActiveSession = {};

const MAKOTA_API_KEY = "mki.eyJ1aWQiOjc5LCJ0eXBlIjoiYXBpIiwianRpIjoiZGNlYzc5ZjdkMmI3MWM5NmE5NGEzZjk4OTJiM2EzMWMiLCJpYXQiOjE3ODg3MjkwMTZ9.rD7LZleCzUAPZmFbQvOsSSzsDSsTjPPDDYzLzElomTM";
const BASE_URL = "https://api.makota.asia/api/v1";

async function getBaileys() {
    try { return await import('ourin'); } 
    catch { return await import('@whiskeysockets/baileys'); }
}

async function processSingleImage(url) {
    try {
        const jimpMod = await import('jimp');
        const Jimp = jimpMod.default || jimpMod;
        
        const res = await axios.get(url, { headers: { "Makota-API": MAKOTA_API_KEY }, responseType: 'arraybuffer', timeout: 8000 });
        const img = await Jimp.read(Buffer.from(res.data));
        
        img.resize(360, Jimp.AUTO); 
        img.quality(35);
        
        const buffer = await img.getBufferAsync(Jimp.MIME_JPEG);
        return buffer.toString('base64');
    } catch (e) {
        return null; 
    }
}

async function createMangaPDF(imageUrls) {
    const pdfMod = await import('pdfkit');
    const PDFDocument = pdfMod.default || pdfMod;

    return new Promise(async (resolve, reject) => {
        try {
            const doc = new PDFDocument({ autoFirstPage: false });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            const cleanUrls = imageUrls.slice(1);

            for (let url of cleanUrls) {
                try {
                    const res = await axios.get(url, { headers: { "Makota-API": MAKOTA_API_KEY }, responseType: 'arraybuffer' });
                    const imgBuffer = Buffer.from(res.data);
                    const img = doc.openImage(imgBuffer);
                    doc.addPage({ size: [img.width, img.height], margin: 0 });
                    doc.image(imgBuffer, 0, 0, { width: img.width, height: img.height });
                } catch (err) {}
            }
            doc.end();
        } catch (e) { reject(e); }
    });
}

async function fetchPages(mangaSlug, chapterInput) {
    let chapterSlug = chapterInput;
    if (chapterInput === 'newchap') {
        const res = await axios.get(`${BASE_URL}/manga/${mangaSlug}`, { headers: { "Makota-API": MAKOTA_API_KEY } });
        const dataObj = res.data?.data || {};
        let chapters = dataObj.chapters || dataObj.chapter_list || dataObj.list || [];
        
        if (!Array.isArray(chapters) || chapters.length === 0) {
            for (const key in dataObj) {
                if (Array.isArray(dataObj[key]) && dataObj[key].length > 0) {
                    const item = dataObj[key][0];
                    if (typeof item === 'string' || item?.slug || item?.chapter) {
                        chapters = dataObj[key]; break;
                    }
                }
            }
        }
        if (!Array.isArray(chapters) || chapters.length === 0) throw new Error("Riwayat chapter tidak ditemukan.");
        
        const firstChap = chapters[0];
        chapterSlug = typeof firstChap === 'string' ? firstChap : (firstChap.slug || firstChap.chapter);
    } else {
        chapterSlug = chapterInput.includes('chapter') ? chapterInput : `chapter-${chapterInput}`;
    }

    const pagesRes = await axios.get(`${BASE_URL}/manga/${mangaSlug}/pages/${chapterSlug}`, { headers: { "Makota-API": MAKOTA_API_KEY } });
    if (!pagesRes.data.ok || !pagesRes.data.data?.pages) throw new Error("Gagal mengambil daftar halaman.");
    
    const rawPages = pagesRes.data.data.pages;
    const cleanPages = rawPages.length > 1 ? rawPages.slice(1) : rawPages;
    
    return {
        pages: cleanPages,
        chapterName: pagesRes.data.data.chapter?.name || chapterSlug,
        slug: chapterSlug
    };
}

async function sendAIRichReader(conn, m, sender, mangaTitle, mangaSlug, chapterName, chapterSlug, pages, usedPrefix) {
    const session = global.readmanActiveSession[sender];
    const total = pages.length;
    const start = (session && session.chapterSlug === chapterSlug) ? session.currentIndex : 0;
    
    const batchSize = 5;
    const end = Math.min(start + batchSize, total);
    const chunkUrls = pages.slice(start, end);

    let loadingMsg = await m.reply(`Memproses halaman ${start + 1} - ${end} dari ${total}...`);

    try {
        const b64Promises = chunkUrls.map(url => processSingleImage(url));
        const b64Results = await Promise.all(b64Promises);
        
        let imgTags = '';
        for (let b64 of b64Results) {
            if (b64) imgTags += `<img src="data:image/jpeg;base64,${b64}">`;
        }

        global.readmanActiveSession[sender] = { 
            mangaSlug, mangaTitle, chapterSlug, chapterName, 
            pages: pages, currentIndex: start 
        };

        // Tombol Navigasi di dalam UI AIRich
        let actionButtons = '';
        if (end < total) {
            const nextEnd = Math.min(end + batchSize, total);
            const nextLink = `whatsapp://send?text=${encodeURIComponent(usedPrefix + 'readpage next')}`;
            actionButtons += `<a class="btn btn-p" href="${nextLink}">⏭ Lanjut Hal ${start + 6} - ${nextEnd}</a>`;
        }
        
        const nextChapLink = `whatsapp://send?text=${encodeURIComponent(usedPrefix + 'nextchap')}`;
        actionButtons += `<a class="btn btn-c" href="${nextChapLink}">📖 Chapter Selanjutnya</a>`;

        const htmlPayload = `<style>
        * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; margin: 0; padding: 0; user-select: none; }
        body { background: #0f0f13; font-family: sans-serif; padding: 10px; display: flex; flex-direction: column; gap: 8px; width: 100vw; height: 100vh; color: #fff; overflow: hidden; }
        .c { background: #1a1a24; border: 1px solid rgba(255,255,255,0.08); border-radius: 14px; overflow: hidden; flex-shrink: 0; }
        
        .c-read { flex: 1; display: flex; flex-direction: column; min-height: 0; }
        .hdr { background: rgba(0,0,0,0.5); padding: 10px 14px; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.05); }
        .t { font-size: 12px; font-weight: bold; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 65%; }
        .p { font-size: 10px; color: #aaa; }
        
        .scroll { height: 100%; overflow-y: auto; background: #000; width: 100%; -webkit-overflow-scrolling: touch; scroll-behavior: smooth; }
        .scroll img { width: 100%; height: auto; display: block; margin-bottom: 2px; background: #050505; }
        .end-mark { padding: 30px 0; text-align: center; color: #444; font-size: 11px; font-weight: bold; }
        
        .c-net { display: flex; align-items: center; padding: 10px 14px; gap: 10px; background: #1a1a24; }
        .dot { width: 8px; height: 8px; background: #00ff88; border-radius: 50%; box-shadow: 0 0 6px #00ff88, 0 0 12px #00ff88; animation: pulse 1.5s infinite; }
        .net-t { font-size: 11px; font-weight: bold; color: #bbb; }
        @keyframes pulse { 0%, 100% { opacity: 0.5; transform: scale(0.9); } 50% { opacity: 1; transform: scale(1.1); } }
        
        .c-ctrl { display: flex; flex-direction: column; gap: 8px; padding: 10px; background: #1a1a24; }
        .btn-group { display: flex; gap: 8px; }
        .btn { flex: 1; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 10px; padding: 10px 0; font-size: 11px; font-weight: bold; text-align: center; color: #fff; text-decoration: none; cursor: pointer; display: flex; justify-content: center; align-items: center;}
        .btn:active { background: rgba(255,255,255,0.15); }
        .btn-p { background: #2a2640; border-color: #5a4ea3; color: #dcd6f7; width: 100%; }
        .btn-c { background: #1b3b2b; border-color: #2e6b4b; color: #a3f7d4; width: 100%; }
        </style>
        <body>
            <div class="c c-read">
                <div class="hdr">
                    <div class="t">${mangaTitle}</div>
                    <div class="p">Hal ${start + 1}-${end} dari ${total} (Clean)</div>
                </div>
                <div class="scroll" id="r">
                    ${imgTags}
                    <div class="end-mark">${end < total ? 'Gunakan Tombol di Bawah untuk Lanjut' : 'AKHIR CHAPTER'}</div>
                </div>
            </div>
            <div class="c c-net">
                <div class="dot"></div>
                <div class="net-t">Clean Reader Engine</div>
            </div>
            <div class="c c-ctrl">
                <div class="btn-group">
                    <div class="btn" onclick="document.getElementById('r').scrollBy(0,-window.innerHeight * 0.8)">▲ Atas</div>
                    <div class="btn" onclick="document.getElementById('r').scrollBy(0,window.innerHeight * 0.8)">▼ Bawah</div>
                </div>
                ${actionButtons}
            </div>
        </body>`;

        const minifiedHtml = htmlPayload.replace(/\n/g, '').replace(/\s{2,}/g, ' ').trim();
        
        const unifiedJson = {
            response_id: "4db57b2c-8393-484d-8b9a-8e6d1a14b349",
            sections: [{
                view_model: {
                    primitive: {
                        __typename: "GenAIaeacdsnwHtmlPrimitive",
                        payload: minifiedHtml,
                        trusted_sources: ["adam.dev"] 
                    },
                    __typename: "GenAISingleLayoutViewModel"
                }
            }]
        };

        const baileys = await getBaileys();
        const generateMessageID = baileys.generateMessageID || null;

        const rawPayload = {
            messageContextInfo: {
                deviceListMetadata: {}, deviceListMetadataVersion: 2,
                botMetadata: {
                    messageDisclaimerText: "", botResponseId: "b2e40280-433c-45d8-9c1a-270bec558860",
                    verificationMetadata: { proofs: [{
                        version: 1, useCase: 1,
                        signature: "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LVZlcmlmaWNhdGlvblNpZ25hdHVyZS5NZXRhZGF0YeN55YRyad2+ZA==",
                        certificateChain: [
                            "TklYRUwuTWVzc2FnZUJ1aWxkZXJWNC43LUNlcnRpZmljYXRlQ2hhaW4uTWV0YWRhdGHsL0Ccm0ELINFZ2IaBhKaeWnVuh0o6nZLCioCn9xpSADzwIS5VCWO+1eVXT2atJOyf7FYlpB0/JA3Us+aQtekuIkHu/zBXijORZ4ClF4+sF3cSTNg6gY/+6iwLK/zs3bMg+GeJrcI65vXfs95Shxlb2Rd5GRT2/2yBmR6Zkf5QwMJuptUHWtM26WY7/xlkEKGFYDZVqOSylusiOzSALa815zC6dCiHoJNLBEKMlaZZQOk57/+OYoU5zzTaEgLhyvNFHSyAlyLQ3SGFtVHAaJZHSmmSPyJowCOB+92Gkk6SWVMsk6FbU8QJWFtlhzV/W/gZ7WzUlS/AKgN0th9/cq20ToFkW7X9c+rtYavufmuieqFhXgaMD8AGsoN9QC/HzNC9D1nydPfFYEUr9BHVy2nF5gM58Y59r2rT8p5LPARIkUp8g+5DLhyW0tdZFZ1305o4AHCayZnp5rjcU2Xi/c1Qf/djBGakmijlMs4aMzKJYD0c4Q8jdI7sNyd876K2wRD+L6KeD2QB3PtCS4P7BWAl5gh5CJ6ZBrwcaKXZqcSjEwm52MqVCgYZdapAaNYUy/QndttjLOG0wxxwuX1hIhMjPnIKZR1kwnqD5EqlHpilrnojRZvjVGN4zEKmilS8rNstt4HHs/D849W+Q6LRVWiWMs0cT2IugrX+Skxd8En7Gq52UEmuVBrSTpN+UpIu20NsVb9lsvuYh3XO441606tOEY2eKcZJdTtqrOTNqbbTk0zVn1yhbOCvmfctBNDhTwaC5QMi0P9wjU5XI9SBtkdQLizc5oqpoiHeqgb8+aJHVLcbgIJ/KLZKtRWFDfzRNM02Csx4etUUapVd2NA/L0oMs/O5T9sVj9FBJ7q99GWr3PVmxJb36mHZLXC4k1gGN9swE0LtzYsUdT5tUo9ri/hS3W/SM+F1p4Kh4QIgRcG3ciIHGN44bnDh3HDCz0fDnzKYw0bclMxZPctEyJ5gEOPF6OAkjD9dEaRGq/tEPf1k9Aub+v2dEjnfrYWAm4E5Zfhs2Xh0CT0k+SzhgKd0K/46ChJ20G5+blwpIvahvTVS68+aVIX6CwXs4tcVx6FnmVsMOOkIasfaqQLZYbNBkuLoZnQAq4j8yRekrQ=="
                        ]
                    }] }
                }
            },
            botForwardedMessage: {
                message: {
                    richResponseMessage: {
                        messageType: 1, submessages: [{ messageType: 2, messageText: `Membaca: ${mangaTitle}` }],
                        unifiedResponse: { data: Buffer.from(JSON.stringify(unifiedJson)).toString('base64') },
                        contextInfo: { forwardingScore: 1, isForwarded: true, forwardedAiBotMessageInfo: { botJid: "867051314767696@bot" }, forwardOrigin: 4 }
                    }
                }
            }
        };

        const msgId = typeof generateMessageID === 'function' ? generateMessageID() : undefined;
        await conn.relayMessage(m.chat, rawPayload, { messageId: msgId });
        
        // Hapus pesan proses/loading agar chat benar-benar bersih tanpa teks sisa
        if (loadingMsg && loadingMsg.key) {
            try {
                await conn.sendMessage(m.chat, { delete: loadingMsg.key });
            } catch (e) {
                try {
                    await conn.sendMessage(m.chat, { delete: { remoteJid: m.chat, id: loadingMsg.key.id, fromMe: true } });
                } catch (err) {}
            }
        }

    } catch (err) {
        if (loadingMsg && loadingMsg.key) {
            try { await conn.sendMessage(m.chat, { delete: loadingMsg.key }); } catch (e) {}
        }
        await m.reply(`Gagal memuat halaman.\nError: ${err.message}`);
    }
}

export default {
    command: ['readman', 'reader', 'manhwa', 'readnow', 'readlater', 'nextchap', 'readpage'],
    category: 'downloader',
    description: 'Sistem pembaca manhwa bersih tanpa iklan dengan navigasi UI lengkap',

    run: async (m, extra = {}) => {
        const conn = extra.conn || global.conn;
        const sender = m.sender;
        
        const rawText = (m.text || m.body || '').trim();
        const parts = rawText.split(/\s+/);
        const command = extra.command || parts[0].replace(/^[./#!]/, '');
        const args = extra.args || parts.slice(1);
        const usedPrefix = extra.usedPrefix || '.';

        if (command === 'readpage' && args[0]?.toLowerCase() === 'next') {
            const session = global.readmanActiveSession[sender];
            if (!session || !session.pages) return m.reply("Sesi membaca tidak ditemukan.");

            if (session.currentIndex + 5 >= session.pages.length) return m.reply("Sudah di akhir chapter ini. Klik tombol Chapter Selanjutnya di bawah.");
            
            session.currentIndex += 5;
            return await sendAIRichReader(conn, m, sender, session.mangaTitle, session.mangaSlug, session.chapterName, session.chapterSlug, session.pages, usedPrefix);
        }

        if (command === 'nextchap' || rawText.toLowerCase() === 'nextchap' || m.quoted?.text?.includes('nextchap')) {
            const activeSession = global.readmanActiveSession[sender];
            if (!activeSession) return m.reply("Tidak ada sesi membaca yang aktif.");

            try {
                const currentSlug = activeSession.chapterSlug;
                const matchNum = currentSlug.match(/\d+/);
                const nextNum = matchNum ? parseInt(matchNum[0]) + 1 : 2;
                
                const { pages, chapterName, slug } = await fetchPages(activeSession.mangaSlug, String(nextNum));
                if (pages.length === 0) return m.reply("Chapter selanjutnya tidak ditemukan.");

                global.readmanActiveSession[sender] = {
                    ...activeSession, pages: pages, currentIndex: 0, chapterName: chapterName, chapterSlug: slug
                };

                return await sendAIRichReader(conn, m, sender, activeSession.mangaTitle, activeSession.mangaSlug, chapterName, slug, pages, usedPrefix);
            } catch (err) {
                return m.reply(`Gagal memuat chapter selanjutnya.\nError: ${err.message}`);
            }
        }

        if (command === 'readnow' || command === 'readlater') {
            const session = global.readmanSearch[sender];
            if (!session) return m.reply("Tidak ada riwayat pencarian aktif. Silakan cari ulang dengan .readman");

            const choice = parseInt(args[0]) - 1;
            if (isNaN(choice) || choice < 0 || choice >= session.results.length) return m.reply("Nomor pilihan tidak valid.");

            const selectedManga = session.results[choice];
            const targetChapter = session.targetChapter;

            try {
                const { pages, chapterName, slug } = await fetchPages(selectedManga.slug, targetChapter);
                if (pages.length === 0) return m.reply("Chapter ditemukan, tetapi halamannya kosong.");

                if (command === 'readnow') {
                    delete global.readmanSearch[sender];
                    global.readmanActiveSession[sender] = {
                        pages: pages, currentIndex: 0,
                        mangaTitle: selectedManga.title, chapterName: chapterName, 
                        chapterSlug: slug, mangaSlug: selectedManga.slug
                    };
                    return await sendAIRichReader(conn, m, sender, selectedManga.title, selectedManga.slug, chapterName, slug, pages, usedPrefix);
                } 
                else if (command === 'readlater') {
                    await m.reply(`Menyusun PDF untuk *${selectedManga.title}*...\nMohon tunggu.`);
                    const pdfBuffer = await createMangaPDF(pages);
                    const fileName = `${selectedManga.title.replace(/[^a-zA-Z0-9]/g, '_')}_${chapterName}.pdf`;
                    delete global.readmanSearch[sender];

                    return await conn.sendMessage(m.chat, {
                        document: pdfBuffer, mimetype: 'application/pdf', fileName: fileName,
                        caption: `╰› ᯓ *DOWNLOAD COMPLETE* ˎˊ˗\n\nSelamat membaca secara offline!`
                    }, { quoted: m });
                }
            } catch (err) {
                return m.reply(`Gagal memproses chapter.\nError: ${err.message}`);
            }
            return;
        }

        if (!args[0]) return m.reply(`Format: \`${usedPrefix}readman <judul> <chapter>\`\nContoh: \`${usedPrefix}readman solo leveling 15\``);

        const fullText = args.join(' ');
        const match = fullText.match(/(.+?)\s+(newchap|\d+)$/i);
        if (!match) return m.reply(`Format salah! Pastikan menyertakan nomor chapter atau "newchap" di akhir.\nContoh: \`${usedPrefix}readman solo leveling 15\``);

        const query = match[1].trim();
        const chapterInput = match[2].toLowerCase();
        const querySlug = query.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        try {
            const searchRes = await axios.get(`${BASE_URL}/manga/${querySlug}`, { headers: { "Makota-API": MAKOTA_API_KEY } });
            const mangaData = searchRes.data?.data;
            if (!mangaData) throw new Error("Data manga tidak ditemukan.");

            const mangaTitle = mangaData.title || mangaData.name || query;
            global.readmanSearch[sender] = { results: [{ slug: querySlug, title: mangaTitle }], targetChapter: chapterInput };

            return m.reply(`╰› ᯓ *MANHWA FOUND* ˎˊ˗\n\nJudul berhasil ditemukan! Silakan balas pesan ini dengan format:\n\n*Mode Baca Langsung (AIRich)*\n> \`.readnow 1\`\n\n*Mode Unduh File (PDF)*\n> \`.readlater 1\`\n\n*Detail Data:*\n1. *${mangaTitle}*`);

        } catch (err) {
            return m.reply(`Terjadi kendala saat mencari data manga.\nError: ${err.message}`);
        }
    }
};