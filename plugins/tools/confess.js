import path from 'path';

export default {
    command: ['confess', 'stopconfess'],
    category: 'tools',
    description: '> Kirim pesan rahasia secara anonim antar grup',
    
    run: async (m, { conn, text, command, usedPrefix }) => {
        const pfx = usedPrefix || '.';
        const cmd = (command || '').toLowerCase();

        // Memanggil Global Symbol
        const symPath = path.resolve(process.cwd(), 'lib/global-symbol.js');
        let sym;
        try {
            sym = (await import(`file://${symPath}`)).sym;
        } catch {
            sym = { arrowCurve: '╰›', swoosh: 'ᯓ', sparkle: 'ˎˊ˗' };
        }

        // Regex yang ditingkatkan untuk membersihkan parameter tracking (?s=cl&...) pada link WA
        const linkRegex = /(?:https?:\/\/)?chat\.whatsapp\.com\/([a-zA-Z0-9]+)(?:\S+)?/;

        if (cmd === 'stopconfess') {
            if (!text || !linkRegex.test(text)) {
                return m.reply(`Format salah.\nGunakan: \`${pfx}stopconfess <link grup target>\``);
            }
            
            const match = text.match(linkRegex);
            const inviteCode = match[1];
            
            if (typeof m.react === 'function') await m.react('⏳');
            
            try {
                const groupInfo = await conn.groupGetInviteInfo(inviteCode);
                const targetJid = groupInfo.id;
                
                await conn.groupLeave(targetJid);
                
                let leaveMsg = `Bot berhasil ditarik keluar dari grup *${groupInfo.subject}*.\n\n`;
                leaveMsg += `${sym.arrowCurve} ${sym.swoosh} *JEJAK CONFESS AMAN* ${sym.sparkle}`;
                return m.reply(leaveMsg);
            } catch (err) {
                return m.reply(`Gagal menarik bot. Pastikan tautan valid dan bot masih memiliki akses ke grup tersebut.`);
            }
        }

        if (!text || !linkRegex.test(text)) {
            let guideMsg = `Kirim pesan rahasia secara anonim ke grup lain.\n\n`;
            guideMsg += `${sym.arrowCurve} ${sym.swoosh} *CONFESS PANDUAN* ${sym.sparkle}\n\n`;
            guideMsg += `*Format:*\n• \`${pfx}confess <pesan> <link grup>\`\n\n`;
            guideMsg += `*Contoh:*\n• \`${pfx}confess Halo semuanya, ini pesan rahasia! https://chat.whatsapp.com/ABCxyz\`\n\n`;
            guideMsg += `Untuk menghapus jejak (menarik bot keluar), ketik:\n• \`${pfx}stopconfess <link grup>\``;
            return m.reply(guideMsg);
        }

        const match = text.match(linkRegex);
        const rawLink = match[0];
        const inviteCode = match[1];
        
        // Membersihkan URL beserta parameternya dari teks utama
        const isiPesan = text.replace(rawLink, '').trim();

        if (!isiPesan) {
            return m.reply('Isi pesan tidak boleh kosong. Pastikan kamu sudah mengetik pesannya sebelum/sesudah tautan.');
        }
        
        if (typeof m.react === 'function') await m.react('🚀');

        try {
            const groupInfo = await conn.groupGetInviteInfo(inviteCode);
            const targetJid = groupInfo.id;
            
            // Template baru dengan Global Symbol
            const templateConfess = `Sistem menerima transmisi rahasia yang ditujukan untuk grup ini.\n\n${sym.arrowCurve} ${sym.swoosh} *ANONYMOUS MESSAGE* ${sym.sparkle}\n\n" ${isiPesan} "\n\n_— Identitas pengirim disembunyikan sepenuhnya oleh server._`;

            await conn.sendMessage(targetJid, { text: templateConfess });

            let reportMsg = `Transmisi rahasia berhasil terkirim!\n\n`;
            reportMsg += `${sym.arrowCurve} ${sym.swoosh} *DELIVERY REPORT* ${sym.sparkle}\n\n`;
            reportMsg += `• *Tujuan* : Grup ${groupInfo.subject}\n`;
            reportMsg += `• *Asal* : ${m.isGroup ? 'Grup Obrolan' : 'Private Chat'}\n\n`;
            reportMsg += `Gunakan \`${pfx}stopconfess ${rawLink}\` untuk menarik bot keluar jika grup target rusuh.`;
            
            return m.reply(reportMsg);
        } catch (err) {
            console.error(err);
            if (typeof m.react === 'function') await m.react('❌');
            return m.reply(`Gagal mengirim confess! Pastikan tautan grup valid dan **Bot kamu memang sudah tergabung** di dalam grup target tersebut.`);
        }
    }
};