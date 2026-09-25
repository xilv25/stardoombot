import fs from 'fs';
import path from 'path';

const VALID_TIERS = ['member', 'senior', 'ancestor', 'emperor', 'peak'];

export default {
    command: ['tier', 'uptier', 'downtier'],
    category: 'owner',
    description: 'Mengelola sistem tingkatan (tier) pengguna bot',
    owner: true,

    run: async (m, { conn, args, usedPrefix, command }) => {
        const tierDir = path.resolve(process.cwd(), 'database/tier');
        if (!fs.existsSync(tierDir)) fs.mkdirSync(tierDir, { recursive: true });

        if (command === 'tier') {
            return m.reply(
                `╰› ᯓ *SYSTEM TIER INFORMATION* ˎˊ˗\n\n` +
                `Daftar tingkatan pengguna dalam sistem peladen:\n\n` +
                `1. *Member* (Limit Default: 10)\n` +
                `2. *Senior* (Limit: 30)\n` +
                `3. *Ancestor* (Limit: 100)\n` +
                `4. *Emperor* (Unlimited + Akses Plugin Admin)\n` +
                `5. *Peak* (Unlimited + Akses Seluruh Plugin Owner)\n\n` +
                `*Perintah Pengaturan:*\n` +
                `• \`${usedPrefix}uptier @tag <tier>\`\n` +
                `• \`${usedPrefix}downtier @tag <tier>\``
            );
        }

        const target = m.mentionedJid?.[0] || m.quoted?.sender;
        const newTier = args[1]?.toLowerCase();

        if (!target || !newTier) {
            return m.reply(`Harap tag target pengguna dan tentukan tier tujuannya!\nContoh: \`${usedPrefix}${command} @user senior\``);
        }

        if (!VALID_TIERS.includes(newTier)) {
            return m.reply(`Tier tidak valid! Pilihan tier yang tersedia:\n- ${VALID_TIERS.join('\n- ')}`);
        }

        const cleanNum = target.split('@')[0];
        const tierFile = path.join(tierDir, `${cleanNum}.json`);

        const tierData = {
            jid: target,
            number: cleanNum,
            tier: newTier,
            updatedAt: new Date().toISOString()
        };

        fs.writeFileSync(tierFile, JSON.stringify(tierData, null, 2));

        return m.reply(
            `Berhasil memperbarui tier pengguna.\n\n` +
            `╰› ᯓ *TIER UPDATED* ˎˊ˗\n\n` +
            `• *Target:* @${cleanNum}\n` +
            `• *Tier Baru:* ${newTier.toUpperCase()}`
        );
    }
};