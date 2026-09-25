import fs from 'fs';
import path from 'path';
import { sym } from '../global-symbol.js';

export async function handleGroupEvents(sock, msg, dbPath) {
    if (!msg.messageStubType) return;
    const chatId = msg.key.remoteJid;
    const stubType = msg.messageStubType;
    const participants = msg.messageStubParameters || [];
    
    // 27 = ADD, 28 = KICK, 32 = LEAVE
    if (![27, 28, 32].includes(stubType) || !chatId || !chatId.endsWith('@g.us')) return;

    try {
        if (!fs.existsSync(dbPath)) return;
        const dbData = await fs.promises.readFile(dbPath, 'utf-8');
        const db = JSON.parse(dbData);
        const groupConfig = db[chatId];
        
        if (!groupConfig) return;

        const isAdd = stubType === 27;
        const eventType = isAdd ? 'welcome' : 'goodbye';
        const configTarget = groupConfig[eventType];
        if (!configTarget || !configTarget.status) return;

        let groupSubject = 'Grup';
        try {
            const meta = await sock.groupMetadata(chatId);
            if (meta?.subject) groupSubject = meta.subject;
        } catch (e) {}

        const now = new Date();
        const dateStr = now.toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', day: '2-digit', month: 'long', year: 'numeric' });
        const hour = parseInt(now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', hour12: false }));
        
        // Pembaruan variabel greeting dengan sisipan kata "Selamat"
        let greeting = hour >= 11 && hour < 15 ? 'Selamat Siang' : hour >= 15 && hour < 18 ? 'Selamat Sore' : hour >= 18 || hour < 4 ? 'Selamat Malam' : 'Selamat Pagi';

        for (let user of participants) {
            let rawUser = '';
            if (typeof user === 'string') {
                rawUser = user;
            } else if (typeof user === 'object' && user !== null) {
                rawUser = user.id || user.jid || Object.values(user)[0] || '';
            } else {
                rawUser = String(user);
            }

            if (typeof rawUser === 'string' && rawUser.startsWith('{')) {
                try {
                    const parsed = JSON.parse(rawUser);
                    rawUser = parsed.id || parsed.jid || rawUser;
                } catch (e) {}
            }

            const cleanJid = String(rawUser).trim();
            const numberPart = cleanJid.includes('@') ? cleanJid.split('@')[0] : cleanJid;
            const cleanNumber = numberPart.replace(/[^0-9]/g, '');

            const userJid = cleanJid.includes('@') ? cleanJid : `${cleanNumber}@s.whatsapp.net`;
            const userTag = `@${cleanNumber}`;
            
            // Pembaruan Judul
            const titleText = isAdd ? 'SELAMAT DATANG' : 'SELAMAT TINGGAL';
            
            // ≛ KALIMAT ENTERPRISE TERSTRUKTUR ≛
            let defaultWelcome = `Halo, selamat datang di +group dan +greeting.\n\n${sym.dot} *User* : +user\n${sym.dot} *Tanggal* : +date\n\nSaya merupakan asisten bot yang bertugas disini. Silakan perkenalkan diri Anda dan pastikan untuk meninjau panduan grup agar komunikasi dapat berjalan dengan selaras tanpa melanggar peraturan yang ada.\n\nTerima kasih sudah bergabung bersama kami.`;
            
            let defaultGoodbye = `Halo, +greeting.\n\n${sym.dot} *User* : +user\n${sym.dot} *Tanggal* : +date\n\nSistem mencatat bahwa user telah pergi meninggalkan +group.\n\nTerima kasih atas partisipasi dan waktu yang telah Anda berikan selama berada disini. Selamat jalan.`;
            
            let descText = isAdd ? defaultWelcome : defaultGoodbye;

            if (configTarget.msg && configTarget.msg.trim() !== '') {
                descText = configTarget.msg;
            }

            // Membedah Parameter Dinamis
            descText = descText
                .replace(/\+user|@user/gi, userTag)
                .replace(/\+group|@group/gi, `*${groupSubject}*`)
                .replace(/\+date/gi, dateStr)
                .replace(/\+greeting/gi, greeting);

            let captionText = `${sym.arrowCurve} ${sym.swoosh} *${titleText}* ${sym.sparkle}\n\n${descText}`;
            
            let customImgUrl = configTarget.image;
            let defaultMp4Path = path.resolve(process.cwd(), 'src', 'image', 'welcomer.mp4');
            
            let mediaPayload = null;
            let isVideoAnim = false;

            if (customImgUrl && customImgUrl.startsWith('http')) {
                mediaPayload = { url: customImgUrl };
            } else if (fs.existsSync(defaultMp4Path)) {
                isVideoAnim = true;
                mediaPayload = fs.readFileSync(defaultMp4Path);
            }

            if (mediaPayload) {
                try {
                    let sendMsg = { mentions: [userJid], caption: captionText };
                    
                    if (isVideoAnim) {
                        sendMsg.video = mediaPayload; 
                        sendMsg.gifPlayback = true;   
                    } else {
                        sendMsg.image = mediaPayload; 
                    }

                    await sock.sendMessage(chatId, sendMsg);
                    continue;
                } catch (e) {
                    console.error('[Event Engine Media Error]:', e);
                }
            }
            
            await sock.sendMessage(chatId, { text: captionText, mentions: [userJid] });
        }
    } catch (err) {}
}
