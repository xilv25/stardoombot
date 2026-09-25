import { proto, getContentType, downloadContentFromMessage } from '@whiskeysockets/baileys';
import fs from 'fs';

export function smsg(conn, m, hasParent) {
    if (!m) return m;
    let M = proto.WebMessageInfo;
    if (m.key) {
        m.id = m.key.id;
        m.isBaileys = m.id.startsWith('BAE5') && m.id.length === 16;
        m.chat = m.key.remoteJid;
        m.fromMe = m.key.fromMe;
        m.isGroup = m.chat.endsWith('@g.us');
        m.sender = conn.decodeJid(m.fromMe && conn.user.id || m.participant || m.key.participant || m.chat || '');
        if (m.isGroup) m.participant = conn.decodeJid(m.key.participant || '');
    }
    if (m.message) {
        m.mtype = getContentType(m.message);
        m.msg = (m.mtype == 'viewOnceMessage' ? m.message[m.mtype].message[getContentType(m.message[m.mtype].message)] : m.message[m.mtype]);
        m.body = m.msg?.text || m.msg?.conversation || m.msg?.caption || m.message?.conversation || m.msg?.selectedButtonId || m.msg?.singleSelectReply?.selectedRowId || '';
        
        let quoted = m.msg?.contextInfo?.quotedMessage;
        if (quoted) {
            let type = getContentType(quoted);
            m.quoted = {
                object: quoted,
                mtype: type,
                msg: quoted[type],
                chat: m.chat,
                sender: conn.decodeJid(m.msg.contextInfo.participant),
                fromMe: m.msg.contextInfo.participant === conn.decodeJid(conn.user.id),
                id: m.msg.contextInfo.stanzaId,
                text: quoted[type]?.text || quoted[type]?.caption || '',
                mentionedJid: quoted[type]?.contextInfo?.mentionedJid || []
            };
        } else {
            m.quoted = null;
        }
    }
    
    m.reply = (text, chatId = m.chat, options = {}) => {
        return conn.sendMessage(chatId, { text: text, ...options }, { quoted: m });
    };

    return m;
}
