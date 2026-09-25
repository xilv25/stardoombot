import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { sym } from '../../lib/global-symbol.js';

async function downloadAndCleanImage(url) {
    if (!url) return null;
    const manhwaDir = path.resolve(process.cwd(), 'src', 'manhwa');
    if (!fs.existsSync(manhwaDir)) fs.mkdirSync(manhwaDir, { recursive: true });

    const filename = `manhwa_test_${Date.now()}.jpg`;
    const filePath = path.join(manhwaDir, filename);

    try {
        const response = await axios({ url, method: 'GET', responseType: 'arraybuffer', timeout: 15000 });
        fs.writeFileSync(filePath, response.data);
        return filePath;
    } catch (err) {
        return null;
    }
}

function cleanupLocalImage(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    } catch (e) {}
}

// Logika Format Baru yang Sempurna
function formatShinigamiMessage(rawText) {
    let cleaned = rawText
        .replace(/<@&?[0-9]+>/g, '') 
        .replace(/<@[0-9]+>/g, '')
        .replace(/@everyone|@here/gi, '') 
        .replace(/Forwarded/gi, '')
        .trim();

    let lines = cleaned.split('\n').map(l => l.trim()).filter(Boolean);
    
    let titleText = '';
    let chapterText = 'Terbaru';
    let noteLines = [];

    for (let line of lines) {
        // 1. Buang baris tag (@All Komik dll)
        if (line.includes('@')) continue;

        // 2. Ekstrak Chapter
        let chRegex = /(?:chapter|bab)\s*:?\s*([0-9.\-]+)/i;
        if (chRegex.test(line)) {
            let match = line.match(chRegex);
            chapterText = match[1];
            continue;
        }

        // 3. Ekstrak Judul (di dalam double bintang **)
        let titleRegex = /\*\*([^*]+)\*\*/;
        if (titleRegex.test(line)) {
            let match = line.match(titleRegex);
            titleText = match[1].trim();
            // Masukkan teks sisa di baris yang sama ke catatan (jika ada)
            let leftover = line.replace(titleRegex, '').trim();
            if (leftover) noteLines.push(leftover.replace(/\*/g, ''));
            continue;
        }

        // 4. Masukkan sisanya ke Catatan
        let cleanNote = line.replace(/\*/g, '').trim();
        if (cleanNote) noteLines.push(cleanNote);
    }

    if (!titleText && noteLines.length > 0) {
        titleText = noteLines.shift();
    }
    if (!titleText) titleText = 'Manhwa Update';

    let noteText = noteLines.join('\n').trim() || 'Sudah up di Web!';

    return `╰› ᯓ *MANHWA UPDATE SERVICE* ˎˊ˗\n\n` +
           `Halo pembaca setia! Kami menginformasikan pembaruan terbaru untuk kenyamanan membaca Anda:\n\n` +
           `*• Judul:* _${titleText}_\n` +
           `*• Chapter:* _${chapterText}_\n` +
           `*• Catatan:* ${noteText}\n\n` +
           `_Silakan kunjungi situs resmi untuk menikmati bab ini secara utuh._`;
}

export default {
    command: ['testbridge', 'checkdiscord', 'td'],
    category: 'group',
    description: 'Uji coba manual menarik pesan terakhir dari Discord Bridge',
    run: async (m, { conn, isAdmin, isOwner }) => {
        if (!m.isGroup) return m.reply(`${sym.arrowCurve} ${sym.swoosh} *ACCESS DENIED* ${sym.sparkle}\n\nPerintah ini hanya dapat dijalankan di dalam dimensi grup.`);
        if (!isAdmin && !isOwner) return m.reply(`${sym.arrowCurve} ${sym.swoosh} *ACCESS DENIED* ${sym.sparkle}\n\nSistem terkunci. Memerlukan hak akses penuh sebagai Admin Grup.`);

        if (!global.discordClient) {
            return m.reply(`${sym.arrowCurve} ${sym.swoosh} *BRIDGE ERROR* ${sym.sparkle}\n\nKlien Discord belum terinisialisasi atau koneksi belum siap.`);
        }

        let localImagePath = null;
        try {
            const MY_DISCORD_CHANNEL_ID = '1544697631660576798';
            const channel = await global.discordClient.channels.fetch(MY_DISCORD_CHANNEL_ID);
            
            if (!channel) {
                return m.reply(`${sym.arrowCurve} ${sym.swoosh} *BRIDGE ERROR* ${sym.sparkle}\n\nChannel Discord tidak ditemukan atau bot tidak memiliki akses.`);
            }

            const messages = await channel.messages.fetch({ limit: 1 });
            const lastMessage = messages.first();

            if (!lastMessage) {
                return m.reply(`${sym.arrowCurve} ${sym.swoosh} *BRIDGE ERROR* ${sym.sparkle}\n\nTidak ada riwayat pesan ditemukan di dalam channel tersebut.`);
            }

            let rawText = lastMessage.content || "";
            let embeds = lastMessage.embeds || [];
            let attachments = lastMessage.attachments || [];

            if (lastMessage.messageSnapshots && lastMessage.messageSnapshots.size > 0) {
                const snapshot = lastMessage.messageSnapshots.first();
                if (snapshot) {
                    if (!rawText && snapshot.content) rawText = snapshot.content;
                    if (embeds.length === 0 && snapshot.embeds) embeds = snapshot.embeds;
                    if (attachments.size === 0 && snapshot.attachments) attachments = snapshot.attachments;
                }
            }

            if (!rawText && embeds.length > 0) {
                rawText = `${embeds[0].title || ''}\n${embeds[0].description || ''}`;
            }

            let imageUrl = attachments.first()?.url || embeds[0]?.image?.url || embeds[0]?.thumbnail?.url;

            if (imageUrl) {
                localImagePath = await downloadAndCleanImage(imageUrl);
            }

            const formattedCaption = formatShinigamiMessage(rawText);

            if (localImagePath && fs.existsSync(localImagePath)) {
                await conn.sendMessage(m.chat, { 
                    image: { url: localImagePath }, 
                    caption: formattedCaption 
                });
            } else {
                await conn.sendMessage(m.chat, { 
                    text: formattedCaption 
                });
            }

            cleanupLocalImage(localImagePath);

        } catch (err) {
            cleanupLocalImage(localImagePath);
            await m.reply(`${sym.arrowCurve} ${sym.swoosh} *SYSTEM ERROR* ${sym.sparkle}\n\nGagal menarik data dari channel Discord.\n\n*Log Kesalahan:*\n_${err.message}_`);
        }
    }
};