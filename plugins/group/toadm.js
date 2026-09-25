import { sym } from '../../lib/global-symbol.js';
let baileys;
try { baileys = await import('ourin'); } 
catch { baileys = await import('@whiskeysockets/baileys'); }
const { generateWAMessageFromContent } = baileys;

export default {
    command: ['toadm', 'toadmin', 'panggiladmin'],
    category: 'group',
    description: '> Memanggil/tag seluruh admin grup untuk bertanya',
    
    run: async (m, { conn, text, isGroup, groupMetadata }) => {
        if (!isGroup) return m.reply('Perintah ini hanya dapat digunakan di dalam grup.');
        
        let targetSender = m.sender;
        let msgText = text ? text.trim() : '';

        if (m.quoted) {
            targetSender = m.quoted.sender;
            if (!msgText) {
                msgText = m.quoted.text || m.quoted.caption || m.quoted.body || m.quoted.conversation || '';
            }
        }

        if (!msgText) {
            const rawContext = m.msg?.contextInfo || m.message?.extendedTextMessage?.contextInfo || m.msg?.message?.extendedTextMessage?.contextInfo;
            if (rawContext && rawContext.quotedMessage) {
                if (rawContext.participant) targetSender = rawContext.participant;
                const q = rawContext.quotedMessage;
                msgText = q.conversation || 
                          q.extendedTextMessage?.text || 
                          q.imageMessage?.caption || 
                          q.videoMessage?.caption || 
                          q.documentMessage?.caption || '';
            }
        }

        if (!msgText) {
            return m.reply('Silakan ketik pesannya atau balas (reply) pesan member yang ingin ditanyakan ke admin.');
        }

        const sender = m.sender;
        const users = global.db.users;
        if (!users[sender]) users[sender] = {};

        const isOwner = sender === conn.user.id || (global.owner && global.owner.includes(sender.split('@')[0]));

        let metadata = groupMetadata;
        if (!metadata) {
            try { 
                metadata = await conn.groupMetadata(m.chat); 
            } catch (e) { 
                return m.reply('Gagal mengambil data grup.'); 
            }
        }
        
        const admins = metadata.participants.filter(p => p.admin).map(p => p.id);
        const isGroupAdmin = admins.includes(sender);

        if (!isOwner && !isGroupAdmin) {
            const today = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' });
            if (users[sender].toadmDate !== today) {
                users[sender].toadmDate = today;
                users[sender].toadmCount = 0;
            }

            const maxLimit = users[sender].toadmLimit || 1;
            if (users[sender].toadmCount >= maxLimit) {
                return m.reply(`Limit harian \`toadm\` kamu sudah habis (${maxLimit}/${maxLimit}).`);
            }
            users[sender].toadmCount += 1;
        }

        if (admins.length === 0) return m.reply('Tidak ada admin yang terdeteksi di grup ini.');

        const adminTags = admins.map(jid => `@${jid.split('@')[0]}`).join(' ');
        
        let msg = `Pemberitahuan kepada seluruh Admin untuk kenyamanan member yang ingin bertanya.\n\n`;
        msg += `╰› ᯓ *ADMIN ASSISTANT* ˎˊ˗\n\n`;
        msg += `• *Admin* : ${adminTags}\n`;
        msg += `• *Member* : @${targetSender.split('@')[0]}\n\n`;
        msg += `*Isi Pertanyaan :*\n\n\`\`\`\n${msgText.trim()}\n\`\`\`\n\n`;
        msg += `Mohon menunggu untuk Admin datang dan menjawab pertanyaan kamu.`;

        let mentions = [...new Set([...(msg.match(/@([0-9]{5,16})/g) || []).map(v => v.slice(1) + '@s.whatsapp.net'), ...admins, targetSender])];

        let msgContent = { viewOnceMessage: { message: { interactiveMessage: {
            body: { text: msg }, 
            footer: { text: `${sym.sword} ©Nameless StarDoom` },
            nativeFlowMessage: { buttons: [] }, 
            contextInfo: { mentionedJid: mentions }
        } } } };

        let waMsg = generateWAMessageFromContent(m.chat, msgContent, { userJid: conn.user.id });
        await conn.relayMessage(m.chat, waMsg.message, { messageId: waMsg.key.id });
    }
};