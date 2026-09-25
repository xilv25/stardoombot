import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { Client, GatewayIntentBits, Options } from 'discord.js';

async function downloadAndCleanImage(url) {
    if (!url) return null;
    const manhwaDir = path.resolve(process.cwd(), 'src', 'manhwa');
    if (!fs.existsSync(manhwaDir)) fs.mkdirSync(manhwaDir, { recursive: true });

    const filename = `manhwa_${Date.now()}.jpg`;
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

// Logika Format Baru yang Sempurna (Terkunci Permanen di Engine)
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

export function startDiscordBridge(sock, dbPath) {
    const client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
        makeCache: Options.cacheWithLimits({ MessageManager: 10, PresenceManager: 0, ThreadManager: 0, GuildMemberManager: 10 })
    });

    client.once('clientReady', () => {
        global.discordClient = client; 
        console.log(`[✓] Discord Bridge aktif memantau channel server: ${client.user.tag}`);
    });

    client.on('messageCreate', async (message) => {
        const MY_DISCORD_CHANNEL_ID = '1544697631660576798';
        if (message.channel.id !== MY_DISCORD_CHANNEL_ID) return;
        
        let rawText = message.content || "";
        let embeds = message.embeds || [];
        let attachments = message.attachments || [];

        if (message.messageSnapshots && message.messageSnapshots.size > 0) {
            const snapshot = message.messageSnapshots.first();
            if (snapshot) {
                if (!rawText && snapshot.content) rawText = snapshot.content;
                if (embeds.length === 0 && snapshot.embeds) embeds = snapshot.embeds;
                if (attachments.size === 0 && snapshot.attachments) attachments = snapshot.attachments;
            }
        }

        if (!rawText && embeds.length > 0) rawText = `${embeds[0].title || ''}\n${embeds[0].description || ''}`;
        if (!rawText && embeds.length === 0 && attachments.size === 0) return;

        let imageUrl = attachments.first()?.url || embeds[0]?.image?.url || embeds[0]?.thumbnail?.url;
        let localImagePath = imageUrl ? await downloadAndCleanImage(imageUrl) : null;
        
        if (!fs.existsSync(dbPath)) {
            cleanupLocalImage(localImagePath);
            return;
        }
        
        const db = JSON.parse(await fs.promises.readFile(dbPath, 'utf-8'));
        
        // Memanggil fungsi format sempurna
        let formattedCaption = formatShinigamiMessage(rawText);
        const isProject = rawText.toLowerCase().includes('project');

        for (const [groupId, configData] of Object.entries(db)) {
            if (!configData.shinigami || !configData.shinigami.status) continue;
            
            const groupMode = configData.shinigami.mode; 
            if (groupMode !== 'both' && ((groupMode === 'project' && !isProject) || (groupMode === 'mirror' && isProject))) continue;

            try {
                if (localImagePath && fs.existsSync(localImagePath)) {
                    await sock.sendMessage(groupId, { image: { url: localImagePath }, caption: formattedCaption });
                } else {
                    await sock.sendMessage(groupId, { text: formattedCaption });
                }
            } catch (e) {}
        }
        
        cleanupLocalImage(localImagePath);
    });

    client.login('API_KALIAN').catch(e => console.error('[Discord Error]:', e.message));
}
