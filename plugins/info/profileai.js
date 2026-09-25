import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { Buffer } from 'buffer';
import { generateMessageID } from 'ourin';

async function resolvePhoneNumber(target, m, conn) {
    if (!target) return '';
    let clean = String(target).split('@')[0].split(':')[0].replace(/\D/g, '');
    if (clean.startsWith('62') && clean.length <= 14) return clean;
    if (conn?.contacts) {
        for (const contact of Object.values(conn.contacts)) {
            const cLid = (contact.lid || '').replace(/\D/g, '');
            const cId = (contact.id || contact.jid || '').replace(/\D/g, '');
            if (cLid === clean || cId === clean) {
                const realId = (contact.id || contact.jid || '').replace(/\D/g, '');
                if (realId.startsWith('62')) return realId;
            }
        }
    }
    if (m?.isGroup) {
        try {
            const metadata = await conn.groupMetadata(m.chat);
            for (const p of metadata.participants || []) {
                const pStr = JSON.stringify(p);
                if (pStr.includes(clean)) {
                    const match = pStr.match(/628\d{7,12}/);
                    if (match) return match[0];
                }
            }
        } catch (e) {}
    }
    try {
        if (typeof conn?.groupFetchAllParticipating === 'function') {
            const allGroups = await conn.groupFetchAllParticipating();
            for (const group of Object.values(allGroups)) {
                for (const p of group.participants || []) {
                    const pStr = JSON.stringify(p);
                    if (pStr.includes(clean)) {
                        const match = pStr.match(/628\d{7,12}/);
                        if (match) return match[0];
                    }
                }
            }
        }
    } catch (e) {}
    try {
        const usersDbPath = path.resolve(process.cwd(), 'database/users.json');
        if (fs.existsSync(usersDbPath)) {
            const users = JSON.parse(fs.readFileSync(usersDbPath, 'utf8'));
            const userMatch = users.find(u => {
                const uLid = (u.lid || '').replace(/\D/g, '');
                const uJid = (u.jid || '').replace(/\D/g, '');
                const uNum = (u.number || '').replace(/\D/g, '');
                return uLid === clean || uJid === clean || uNum === clean;
            });
            if (userMatch?.number && userMatch.number.startsWith('62')) return userMatch.number;
        }
    } catch (e) {}
    return clean;
}

export default {
    command: ['profileai', 'profilai'],
    category: 'info',
    description: 'Menampilkan profil format AIRich dengan background abu-abu minimalis',

    run: async (m, extra = {}) => {
        const { conn, isOwner: senderIsOwner } = extra || {};
        if (!m || !m.chat) return;

        const target = m.mentionedJid?.[0] || m.quoted?.sender || m.sender;
        let name = m.pushName || 'Pengguna';
        try { name = await conn.getName(target) || name; } catch {}

        // Mengambil PP dan Konversi ke Base64 via Fetch bawaan (Tanpa Jimp)
        let ppUrl = 'https://files.catbox.moe/xr1z9u.png';
        try { 
            const url = await conn.profilePictureUrl(target, 'image'); 
            if (url) ppUrl = url;
        } catch {}

        let ppBase64 = ppUrl; 
        try {
            if (!ppUrl.includes('catbox')) {
                const response = await fetch(ppUrl);
                const arrayBuffer = await response.arrayBuffer();
                const b64 = Buffer.from(arrayBuffer).toString('base64');
                ppBase64 = `data:image/jpeg;base64,${b64}`;
            }
        } catch (e) {
            console.log('[Base64 Error] Gagal konversi PP, menggunakan fallback.');
        }

        let isTargetOwner = false;
        if (target === m.sender && senderIsOwner !== undefined) {
            isTargetOwner = senderIsOwner; 
        } else {
            try {
                const ownEnginePath = pathToFileURL(path.resolve(process.cwd(), 'lib/engine/own-engine.js')).href;
                const ownEngine = await import(ownEnginePath);
                if (ownEngine && typeof ownEngine.verifyOwner === 'function') {
                    isTargetOwner = ownEngine.verifyOwner(target, m);
                }
            } catch (e) {
                const targetNum = target.split('@')[0];
                const ownerStr = JSON.stringify(global.owner || []);
                if (ownerStr.includes(targetNum)) isTargetOwner = true;
            }
        }
        
        let isTargetAdmin = false;
        if (m.isGroup) {
            try {
                const metadata = await conn.groupMetadata(m.chat);
                const participant = metadata.participants.find(p => p.id === target || p.lid === target);
                if (participant && (participant.admin === 'admin' || participant.admin === 'superadmin')) {
                    isTargetAdmin = true;
                }
            } catch {}
        }

        const verifyPath = path.resolve(process.cwd(), 'database/verify');
        const tierPath = path.resolve(process.cwd(), 'database/tier');
        const hitPath = path.resolve(process.cwd(), 'database/totalhit');
        const limitPath = path.resolve(process.cwd(), 'database/limitscmd');

        const rawCleanNum = target.split('@')[0].split(':')[0];
        const displayId = `ID: ${rawCleanNum}`;

        let isVerified = false;
        try {
            const fileByRaw = path.join(verifyPath, `${rawCleanNum}.json`);
            if (fs.existsSync(fileByRaw)) isVerified = JSON.parse(fs.readFileSync(fileByRaw, 'utf8')).verified || false;
        } catch {}

        let userTier = 'Member';
        if (isTargetOwner) {
            userTier = 'Peak';
        } else if (isTargetAdmin) {
            userTier = 'Emperor';
        } else {
            try {
                const tierFile = path.join(tierPath, `${rawCleanNum}.json`);
                if (fs.existsSync(tierFile)) {
                    let t = JSON.parse(fs.readFileSync(tierFile, 'utf8')).tier || 'Member';
                    userTier = t.charAt(0).toUpperCase() + t.slice(1);
                }
            } catch {}
        }

        let currentLimit = 10;
        try {
            const limitFile = path.join(limitPath, `${rawCleanNum}.json`);
            if (fs.existsSync(limitFile)) currentLimit = JSON.parse(fs.readFileSync(limitFile, 'utf8')).limit ?? 10;
        } catch {}

        let hitCount = 0;
        try {
            const hitFile = path.join(hitPath, `${rawCleanNum}.json`);
            if (fs.existsSync(hitFile)) hitCount = JSON.parse(fs.readFileSync(hitFile, 'utf8')).hit || 0;
        } catch {}

        const userDb = global.db?.data?.users?.[target] || {};
        const warnCount = userDb.warn || 0;
        const limitDisplay = (['Emperor', 'Peak'].includes(userTier) || isTargetOwner) ? '∞' : currentLimit;
        const verifText = isVerified ? 'Verified' : 'Unverified';
        const verifColor = isVerified ? '#22c55e' : '#ef4444';

        const html = `<html>
<head>
<style>
  * { box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 0; }
  body { background: transparent; display: flex; justify-content: center; align-items: flex-start; width: 100%; min-height: 100vh; padding: 4px; }
  
  /* Kotak Utama Abu-abu Gelap */
  .card { width: 100%; max-width: 340px; background: #2d2d2d; border-radius: 14px; padding: 16px; color: #fff; border: 1px solid rgba(255,255,255,0.05); }
  
  /* Header Referensi */
  .head-section { padding-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.1); margin-bottom: 14px; }
  .head-sub { font-size: 10px; color: #a1a1aa; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
  .head-title { font-size: 20px; font-weight: bold; color: #ffffff; }

  /* Info Profil (Gambar & Nama) */
  .profile-row { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
  .avatar { width: 50px; height: 50px; border-radius: 50%; object-fit: cover; }
  .user-text { flex: 1; min-width: 0; }
  .name { font-size: 16px; font-weight: bold; margin-bottom: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .phone { font-size: 11px; color: #a1a1aa; font-family: monospace; }
  
  /* Kotak Statistik */
  .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-bottom: 6px; }
  .box { background: rgba(0, 0, 0, 0.2); border-radius: 8px; padding: 10px 8px; text-align: center; }
  .box-title { font-size: 8px; color: #a1a1aa; text-transform: uppercase; margin-bottom: 2px; letter-spacing: 0.5px; }
  .box-val { font-size: 13px; font-weight: bold; color: #fff; }
  .tier-val { color: #facc15; }
  
  /* Status Verifikasi */
  .verif-box { grid-column: span 2; background: rgba(0,0,0,0.25); display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border-radius: 8px; }
  .verif-status { font-weight: bold; font-size: 12px; color: ${verifColor}; }
  
  .footer { text-align: center; font-size: 10px; color: #a1a1aa; margin-top: 14px; }
</style>
</head>
<body>
<div class="card">
  <div class="head-section">
    <div class="head-sub">Stardoom Universe</div>
    <div class="head-title">User Profile</div>
  </div>
  
  <div class="profile-row">
    <img src="${ppBase64}" alt="Ava" class="avatar" />
    <div class="user-text">
      <div class="name">${name}</div>
      <div class="phone">${displayId}</div>
    </div>
  </div>

  <div class="grid">
    <div class="box">
      <div class="box-title">Tier Class</div>
      <div class="box-val tier-val">${userTier}</div>
    </div>
    <div class="box">
      <div class="box-title">Limit</div>
      <div class="box-val">${limitDisplay}</div>
    </div>
    <div class="box">
      <div class="box-title">Global Hits</div>
      <div class="box-val">${hitCount.toLocaleString()}</div>
    </div>
    <div class="box">
      <div class="box-title">Warns</div>
      <div class="box-val" style="color: ${warnCount > 0 ? '#ef4444' : '#fff'};">${warnCount}</div>
    </div>
    <div class="box verif-box">
      <div class="box-title" style="margin:0;">Status Verifikasi</div>
      <div class="verif-status">${verifText}</div>
    </div>
  </div>
  
  <div class="footer">Stardoom User Information Data</div>
</div>
</body>
</html>`;

        const minifiedHtml = html.replace(/\n/g, '').replace(/\s{2,}/g, ' ').trim();
        const responseId = generateMessageID();

        const payload = {
            response_id: responseId,
            sections: [{
                view_model: {
                    primitive: {
                        __typename: "GenAIaeacdsnwHtmlPrimitive",
                        payload: minifiedHtml,
                        trusted_sources: []
                    },
                    __typename: "GenAISingleLayoutViewModel"
                }
            }]
        };

        try {
            await conn.relayMessage(
                m.chat,
                {
                    messageContextInfo: {
                        deviceListMetadata: {},
                        deviceListMetadataVersion: 2,
                        botMetadata: {
                            messageDisclaimerText: "",
                            botResponseId: responseId
                        }
                    },
                    botForwardedMessage: {
                        message: {
                            richResponseMessage: {
                                messageType: 1,
                                submessages: [{ messageType: 2, messageText: `Profil: ${name}` }],
                                unifiedResponse: {
                                    data: Buffer.from(JSON.stringify(payload)).toString('base64')
                                },
                                contextInfo: {
                                    forwardingScore: 1, 
                                    isForwarded: true,
                                    forwardedAiBotMessageInfo: { botJid: "867051314767696@bot" },
                                    forwardOrigin: 4
                                }
                            }
                        }
                    }
                },
                { messageId: responseId }
            );
        } catch (e) {
            console.error('[profileai]', e);
            await m.reply(`❌ Gagal merender profil AIRich: ${e.message}`);
        }
    }
};