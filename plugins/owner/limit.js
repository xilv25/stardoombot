export default {
    command: ['+limit', 'addlimit', 'resetlimit'],
    category: 'owner',
    description: '> Mengatur dan mereset limit harian fitur toadm',
    
    run: async (m, { conn, command, args }) => {
        const isOwner = m.sender === conn.user.id || (global.owner && global.owner.includes(m.sender.split('@')[0]));
        if (!isOwner) return m.reply('Perintah ini khusus untuk Owner.');

        const users = global.db.users;

        // Fitur 1: Reset Semua Limit ke Default (1)
        if (command === 'resetlimit') {
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

        // Fitur 2: Menambah/Mengubah Limit Spesifik
        const mentioned = m.mentionedJid && m.mentionedJid[0] ? m.mentionedJid[0] : (m.quoted ? m.quoted.sender : null);
        
        if (!mentioned) {
            return m.reply('Tag atau balas pesan pengguna yang ingin diubah limitnya.\nContoh: `+limit @user 5`');
        }

        // Mencari angka dari argumen (mengabaikan tag)
        const amountStr = args.find(a => !a.includes('@'));
        const amount = parseInt(amountStr);

        if (isNaN(amount) || amount < 1 || amount > 10) {
            return m.reply('Masukkan jumlah limit yang valid (1 - 10).\nContoh: `+limit @user 5`');
        }

        if (!users[mentioned]) users[mentioned] = {};
        
        users[mentioned].toadmLimit = amount;
        
        // Reset hitungan agar dia bisa langsung pakai limit barunya hari ini
        users[mentioned].toadmCount = 0; 
        users[mentioned].toadmDate = new Date().toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta' });

        await conn.sendMessage(m.chat, {
            text: `Berhasil menetapkan limit \`toadm\` pengguna @${mentioned.split('@')[0]} menjadi *${amount}* kali per hari.`,
            mentions: [mentioned]
        }, { quoted: m });
    }
};