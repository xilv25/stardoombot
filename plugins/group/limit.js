export default {
    command: ['+limit', 'addlimit', '-limit', 'sublimit', 'resetlimit'],
    category: 'group',
    description: '> Mengatur, menambah, mengurangi, dan mereset limit harian fitur toadm',
    
    run: async (m, { conn, command, args, isGroup, groupMetadata }) => {
        if (!isGroup) return m.reply('Perintah ini khusus untuk grup.');

        const isOwner = m.sender === conn.user.id || (global.owner && global.owner.includes(m.sender.split('@')[0]));
        
        let isGroupAdmin = false;
        let metadata = groupMetadata;
        if (!metadata) {
            try { metadata = await conn.groupMetadata(m.chat); } catch (e) {}
        }
        if (metadata) {
            const admins = metadata.participants.filter(p => p.admin).map(p => p.id);
            isGroupAdmin = admins.includes(m.sender);
        }

        const users = global.db.users;

        if (command === 'resetlimit') {
            if (!isOwner) return m.reply('Perintah `resetlimit` khusus untuk Owner karena akan mereset database secara global.');
            
            let count = 0;
            for (let jid in users) {
                if (users[jid].toadmLimit !== undefined || users[jid].toadmCount !== undefined) {
                    users[jid].toadmLimit = 1;
                    users[jid].toadmCount = 0;
                    count++;
                }
            }
            return m.reply(`Berhasil mereset pengaturan \`toadm\` kembali ke default (1 limit/hari) untuk ${count} pengguna.`);
        }

        if (!isGroupAdmin && !isOwner) return m.reply('Perintah ini khusus untuk Admin Grup dan Owner.');

        // Ekstraksi target akurat: Prioritas Mention JID -> Quoted Sender -> Cek Nama di Grup
        let targetJid = m.mentionedJid?.[0] 
            || m.msg?.contextInfo?.mentionedJid?.[0] 
            || m.quoted?.sender;

        if (!targetJid && metadata && args.length > 0) {
            let query = args.find(arg => arg.includes('@') || !/^[0-9]+$/.test(arg));
            if (query) {
                query = query.replace('@', '').toLowerCase();
                let found = metadata.participants.find(p => p.id.includes(query) || (p.notify && p.notify.toLowerCase().includes(query)));
                if (found) targetJid = found.id;
            }
        }

        if (!targetJid) {
            return m.reply('Tag atau balas (reply) pesan pengguna yang ingin diubah limitnya.\nContoh: `+limit @user 5` atau `-limit @user 1`');
        }

        // Ambil angka limit (1 - 10)
        let amount = NaN;
        for (let arg of args) {
            let parsed = parseInt(arg);
            if (!isNaN(parsed) && parsed >= 1 && parsed <= 10) {
                amount = parsed;
                break;
            }
        }

        if (isNaN(amount)) {
            return m.reply('Masukkan jumlah limit yang valid (angka 1 sampai 10).\nContoh: `+limit @user 5`');
        }

        if (!users[targetJid]) users[targetJid] = {};
        
        let currentLimit = users[targetJid].toadmLimit || 1;
        let newLimit = currentLimit;

        if (command === '+limit' || command === 'addlimit') {
            newLimit = amount;
        } else if (command === '-limit' || command === 'sublimit') {
            newLimit = Math.max(1, currentLimit - amount);
        }

        users[targetJid].toadmLimit = newLimit;
        users[targetJid].toadmCount = 0; 
        users[targetJid].toadmDate = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' });

        const actionText = (command === '-limit' || command === 'sublimit') ? `mengurangi limit menjadi *${newLimit}*` : `menetapkan limit menjadi *${newLimit}*`;

        return await conn.sendMessage(m.chat, {
            text: `Berhasil ${actionText} \`toadm\` untuk pengguna @${targetJid.split('@')[0]}.`,
            mentions: [targetJid]
        }, { quoted: m });
    }
};