import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import config from './config.js';
import { sym } from './lib/global-symbol.js';
import { injectReact } from './lib/react-engine.js';
import { verifyOwner } from './lib/engine/own-engine.js';

let baileys;
try { baileys = await import('ourin'); } 
catch { baileys = await import('@whiskeysockets/baileys'); }
const { generateWAMessageFromContent, jidDecode } = baileys;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const usersDbPath = path.resolve(__dirname, 'database', 'users.json');
const settingsDbPath = path.resolve(__dirname, 'database', 'settings.json');
const groupsDbPath = path.resolve(__dirname, 'database', 'groups.json');

function recordUserToDb(m, isAdminGroup) {
    try {
        if (!fs.existsSync(path.dirname(usersDbPath))) fs.mkdirSync(path.dirname(usersDbPath), { recursive: true });
        let users = [];
        if (fs.existsSync(usersDbPath)) {
            try { users = JSON.parse(fs.readFileSync(usersDbPath, 'utf-8')); } catch { users = []; }
        }

        const userJid = m.sender;
        const userNumber = userJid.split('@')[0];
        const userLid = m.key?.participant || m.participant || '';
        const currentGroup = m.isGroup ? m.chat : 'Private Chat';

        let existingIndex = users.findIndex(u => u.jid === userJid || u.number === userNumber);
        
        const userData = {
            number: userNumber,
            jid: userJid,
            lid: userLid,
            lastGroup: currentGroup,
            isAdmin: isAdminGroup,
            lastSeen: new Date().toISOString()
        };

        if (existingIndex !== -1) {
            users[existingIndex] = userData;
        } else {
            users.push(userData);
            if (users.length > 100) {
                users.shift();
            }
        }

        fs.writeFileSync(usersDbPath, JSON.stringify(users, null, 2));
    } catch (err) {
        console.error('[User DB Error]:', err);
    }
}

const decodeJid = (jid) => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
        let decode = jidDecode(jid) || {};
        return decode.user && decode.server ? decode.user + '@' + decode.server : jid;
    } else return jid;
};

function getPluginFiles(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (let file of list) {
        const filePath = path.join(dir, file.name);
        if (file.isDirectory()) {
            results = results.concat(getPluginFiles(filePath));
        } else if (file.name.endsWith('.js')) {
            results.push(filePath);
        }
    }
    return results;
}

export default async (conn, m) => {
    try {
        if (!m || !m.message) return;

        m.sender = decodeJid(m.key?.participant || m.key?.remoteJid);
        m.chat = decodeJid(m.key?.remoteJid);
        
        injectReact(conn, m);

        const isBaileys = m.key?.id?.startsWith('BAE5') || m.key?.id?.length === 16;
        if (isBaileys) return; 

        m.isGroup = m.chat.endsWith('@g.us');

        let isAdminGroup = false;
        if (m.isGroup) {
            try {
                const groupMetadata = await conn.groupMetadata(m.chat).catch(() => ({ participants: [] }));
                const participant = groupMetadata.participants.find(p => decodeJid(p.id) === m.sender);
                isAdminGroup = participant ? (participant.admin === 'admin' || participant.admin === 'superadmin') : false;
            } catch (e) {}
        }

        recordUserToDb(m, isAdminGroup);

        const pushName = m.pushName || "User";

        let thumbnailBuffer = null;
        let base64Image = '';
        
        try {
            const ppUrl = await conn.profilePictureUrl(m.sender, 'preview').catch(() => null);
            if (ppUrl) {
                const response = await fetch(ppUrl, {
                    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
                });
                if (response.ok) {
                    thumbnailBuffer = Buffer.from(await response.arrayBuffer());
                    base64Image = thumbnailBuffer.toString('base64');
                }
            }
        } catch (e) {}

        const senderNumber = m.sender ? m.sender.split('@')[0] : '13135550002';

        let vcard = `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${pushName}\nitem1.TEL;waid=${senderNumber}:${senderNumber}\nitem1.X-ABLabel:Ponsel`;
        if (base64Image) {
            vcard += `\nPHOTO;ENCODING=b;TYPE=JPEG:${base64Image}`;
        }
        vcard += `\nEND:VCARD`;

        const fakeReply = {
            key: { 
                fromMe: false, 
                participant: '13135550002@s.whatsapp.net', 
                remoteJid: 'status@broadcast'    
            },
            message: { 
                contactMessage: { 
                    displayName: pushName, 
                    vcard: vcard,
                    ...(thumbnailBuffer ? { jpegThumbnail: thumbnailBuffer } : {})
                } 
            }
        };

        m.reply = async (text, chatId, options = {}) => {
            let targetChat = chatId ? chatId : m.chat;
            let strText = typeof text === 'string' ? text : text.toString();
            let cleanText = strText.replace(/\n+.*?StarDoom.*?$/i, '').trim();

            let mentions = [...new Set([...(cleanText.match(/@([0-9]{5,16})/g) || []).map(v => v.slice(1) + '@s.whatsapp.net'), ...(options.mentions || [])])];

            let msgContent = { viewOnceMessage: { message: { interactiveMessage: {
                body: { text: cleanText }, 
                footer: { text: options.footer || `${sym.sword} ©StarDoom Universe` },
                nativeFlowMessage: { buttons: options.buttons || [] }, 
                contextInfo: { mentionedJid: mentions }
            } } } };

            let msg = generateWAMessageFromContent(targetChat, msgContent, { quoted: options.quoted || fakeReply, userJid: conn.user.id });
            await conn.relayMessage(targetChat, msg.message, { messageId: msg.key.id });
        };

        let msgObj = m.message || {};
        if (msgObj.ephemeralMessage) msgObj = msgObj.ephemeralMessage.message || msgObj;
        if (msgObj.viewOnceMessage) msgObj = msgObj.viewOnceMessage.message || msgObj;
        if (msgObj.viewOnceMessageV2) msgObj = msgObj.viewOnceMessageV2.message || msgObj;
        if (msgObj.documentWithCaptionMessage) msgObj = msgObj.documentWithCaptionMessage.message || msgObj;

        let bodyText = msgObj?.conversation || msgObj?.extendedTextMessage?.text || msgObj?.imageMessage?.caption || msgObj?.videoMessage?.caption || "";
        
        m.text = bodyText;

        const pluginsDir = path.join(__dirname, 'plugins');
        const pluginFiles = getPluginFiles(pluginsDir);
        for (let file of pluginFiles) {
            try {
                const pluginUrl = pathToFileURL(file).href;
                const plugin = await import(`${pluginUrl}?update=${Date.now()}`);
                if (plugin.default && typeof plugin.default.before === 'function') {
                    let handled = await plugin.default.before(m, { conn, isGroup: m.isGroup });
                    if (handled) return;
                }
            } catch (err) {}
        }

        if (!bodyText) return; 

        let isOwner = verifyOwner(m.sender, m);

        let globalSettings = {};
        if (fs.existsSync(settingsDbPath)) {
            try { globalSettings = JSON.parse(fs.readFileSync(settingsDbPath, 'utf-8')); } catch {}
        }
        if (globalSettings.offcmd && !isOwner) return;

        let groupsDb = {};
        if (fs.existsSync(groupsDbPath)) {
            try { groupsDb = JSON.parse(fs.readFileSync(groupsDbPath, 'utf-8')); } catch {}
        }
        let groupConfig = m.isGroup ? (groupsDb[m.chat] || {}) : {};

        if (m.isGroup && groupConfig.offcmdgc && !isOwner && !isAdminGroup) return;

        let usedPrefix = "";
        let command = "";
        let args = [];
        let text = "";

        let matchPrefix = bodyText.match(new RegExp(config.prefix));

        if (matchPrefix) {
            usedPrefix = matchPrefix[0];
            args = bodyText.trim().slice(usedPrefix.length).trim().split(/ +/);
            command = args.shift().toLowerCase();
            text = args.join(" ");
        } else if (groupConfig.noprefix && !bodyText.startsWith('$') && !bodyText.startsWith('=>')) {
            let splitText = bodyText.trim().split(/ +/);
            command = splitText.shift().toLowerCase();
            args = splitText;
            text = args.join(" ");
            usedPrefix = "";
        } else {
            return;
        }

        let targetPluginPath = null;
        for (let file of pluginFiles) {
            try {
                const pluginUrl = pathToFileURL(file).href;
                const plugin = await import(`${pluginUrl}?update=${Date.now()}`);
                const cmds = plugin.default?.command;
                
                if (Array.isArray(cmds) && cmds.includes(command)) {
                    targetPluginPath = file;
                    break;
                } else if (typeof cmds === 'string' && cmds === command) {
                    targetPluginPath = file;
                    break;
                } else if (path.basename(file, '.js') === command && !cmds) {
                    targetPluginPath = file;
                    break;
                }
            } catch (err) {
                continue;
            }
        }

        if (targetPluginPath) {
            const cleanNum = m.sender.split('@')[0].split(':')[0];

            const pluginUrl = pathToFileURL(targetPluginPath).href;
            const plugin = await import(`${pluginUrl}?update=${Date.now()}`);
            
            let run;
            if (plugin.default && typeof plugin.default.run === 'function') run = plugin.default.run;
            else if (plugin.default && typeof plugin.default === 'function') run = plugin.default;
            else if (typeof plugin.run === 'function') run = plugin.run;

            if (run) {
                try {
                    let pluginTask = run(m, { conn, text, args, command, usedPrefix, isOwner, isAdmin: isAdminGroup, isGroup: m.isGroup, pushName, fakeReply });
                    await pluginTask;

                    const hitDir = path.resolve(__dirname, 'database', 'totalhit');
                    if (!fs.existsSync(hitDir)) fs.mkdirSync(hitDir, { recursive: true });
                    
                    const hitFile = path.join(hitDir, `${cleanNum}.json`);
                    let hitData = { hit: 0 };
                    
                    if (fs.existsSync(hitFile)) {
                        try { hitData = JSON.parse(fs.readFileSync(hitFile, 'utf-8')); } catch {}
                    }
                    
                    hitData.hit += 1;
                    hitData.lastHit = new Date().toISOString();
                    fs.writeFileSync(hitFile, JSON.stringify(hitData, null, 2));

                } catch (err) {
                    await m.react('❌');
                    console.error('[Plugin Execution Error]:', err);
                }
            }
        }
    } catch (e) {
        console.error('[Handler Error]:', e);
    }
};