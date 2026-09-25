import path from 'path';
import { pathToFileURL } from 'url';

export default {
    command: [
        'admingroup', 'admin-group',
        'open', 'close', 'opengc', 'closegc',
        'desc', 'setdesc', 'deskripsi',
        'cpp', 'setppgc', 'setppgroup',
        'tchat', 'ephemeral',
        'pending', 'approval'
    ],
    category: 'group',
    description: '> Alat pengelolaan dan pengaturan grup beserta panduannya',

    run: async (m, { conn, text, args, command, usedPrefix, isOwner, isAdmin }) => {
        const pfx = usedPrefix || '.';
        const cmd = command.toLowerCase();

        if (!m.isGroup) {
            return await m.reply('Perintah ini hanya dapat dijalankan di dalam grup.');
        }

        // COMMAND PANDUAN ADMIN GROUP
        if (['admingroup', 'admin-group'].includes(cmd)) {
            const guideText = 
                `╰› ᯓ *PANDUAN ADMIN GROUP* ˎˊ˗\n\n` +
                `Berikut adalah daftar dan penjelasan perintah pengelolaan grup:\n\n` +
                `*1. Buka / Tutup Grup*\n` +
                `• \`${pfx}open\` / \`${pfx}opengc\` : Membuka grup agar semua peserta dapat mengirim pesan.\n` +
                `• \`${pfx}close\` / \`${pfx}closegc\` : Menutup grup sehingga hanya admin yang dapat mengirim pesan.\n\n` +
                `*2. Deskripsi Grup*\n` +
                `• \`${pfx}desc <teks>\` / \`${pfx}setdesc\` : Mengubah deskripsi atau informasi teks grup.\n\n` +
                `*3. Foto Profil Grup*\n` +
                `• \`${pfx}cpp\` / \`${pfx}setppgc\` : Mengganti foto profil grup dengan cara membalas (reply) gambar.\n\n` +
                `*4. Pesan Sementara (Temporary Chat)*\n` +
                `• \`${pfx}tchat on 24h/7h/90h\` : Mengaktifkan pesan otomatis terhapus.\n` +
                `• \`${pfx}tchat off\` : Mematikan fitur pesan sementara.\n\n` +
                `*5. Persetujuan Anggota Baru*\n` +
                `• \`${pfx}pending on\` : Anggota baru wajib disetujui admin sebelum bergabung.\n` +
                `• \`${pfx}pending off\` : Anggota baru dapat langsung bergabung.`;

            return await m.reply(guideText);
        }

        // Pemuatan Greet Engine secara Dinamis
        let greeting = '';
        try {
            const enginePath = pathToFileURL(path.resolve(process.cwd(), 'lib/engine/greet-engine.js')).href;
            const greetMod = await import(enginePath);
            const fnGreet = greetMod.getGreeting || greetMod.default?.getGreeting || greetMod.default;

            if (typeof fnGreet === 'function') {
                const res = fnGreet(m, { isOwner, isAdmin });
                greeting = typeof res === 'object' ? (res.prefix || res.text) : res;
            }
        } catch {}

        if (!greeting) {
            greeting = `Halo ${isOwner ? 'Tuan Muda' : (isAdmin ? 'Admin' : 'Kak')} *${m.pushName || 'User'}*,`;
        }

        if (!isOwner && !isAdmin) {
            return await m.reply(`${greeting} perintah ini hanya dapat digunakan oleh Admin grup atau Owner bot.`);
        }

        // ==========================================
        // 1. BUKA / TUTUP GRUP (OPEN / CLOSE)
        // ==========================================
        if (['open', 'opengc', 'close', 'closegc'].includes(cmd)) {
            const shouldOpen = cmd.startsWith('open');
            try {
                await conn.groupSettingUpdate(m.chat, shouldOpen ? 'not_announcement' : 'announcement');
                return await m.reply(
                    `${greeting} setelan obrolan grup telah berhasil diperbarui.\n\n` +
                    `╰› ᯓ *GROUP SETTING UPDATED* ˎˊ˗\n\n` +
                    `• Status : Grup ${shouldOpen ? 'Dibuka (Semua peserta dapat mengirim pesan)' : 'Ditutup (Hanya admin yang dapat mengirim pesan)'}`
                );
            } catch (err) {
                return await m.reply(`Gagal mengubah setelan grup. Pastikan bot sudah dijadikan Admin di grup ini.`);
            }
        }

        // ==========================================
        // 2. EDIT DESKRIPSI (DESC)
        // ==========================================
        if (['desc', 'setdesc', 'deskripsi'].includes(cmd)) {
            const newDesc = text ? text.trim() : '';
            if (!newDesc) {
                return await m.reply(
                    `${greeting} masukkan teks deskripsi baru untuk grup ini.\n\n` +
                    `*Format :* \`${pfx}${cmd} <teks deskripsi baru>\``
                );
            }

            try {
                await conn.groupUpdateDescription(m.chat, newDesc);
                return await m.reply(
                    `${greeting} deskripsi grup berhasil diperbarui.\n\n` +
                    `╰› ᯓ *DESCRIPTION UPDATED* ˎˊ˗\n\n` +
                    `*Deskripsi Baru :*\n${newDesc}`
                );
            } catch (err) {
                return await m.reply(`Gagal memperbarui deskripsi grup. Pastikan bot sudah dijadikan Admin di grup ini.`);
            }
        }

        // ==========================================
        // 3. GANTI FOTO PROFIL GRUP (CPP)
        // ==========================================
        if (['cpp', 'setppgc', 'setppgroup'].includes(cmd)) {
            let msgObj = m.message || {};
            if (msgObj.ephemeralMessage) msgObj = msgObj.ephemeralMessage.message || msgObj;
            if (msgObj.viewOnceMessage) msgObj = msgObj.viewOnceMessage.message || msgObj;
            if (msgObj.viewOnceMessageV2) msgObj = msgObj.viewOnceMessageV2.message || msgObj;

            const contextInfo = msgObj.extendedTextMessage?.contextInfo || 
                                msgObj.imageMessage?.contextInfo;
                                
            let quotedMsg = contextInfo?.quotedMessage;
            if (quotedMsg?.ephemeralMessage) quotedMsg = quotedMsg.ephemeralMessage.message || quotedMsg;
            if (quotedMsg?.viewOnceMessage) quotedMsg = quotedMsg.viewOnceMessage.message || quotedMsg;
            if (quotedMsg?.viewOnceMessageV2) quotedMsg = quotedMsg.viewOnceMessageV2.message || quotedMsg;

            let targetMedia = quotedMsg?.imageMessage || msgObj?.imageMessage;

            if (!targetMedia) {
                return await m.reply(
                    `${greeting} gambar tidak ditemukan.\n\n` +
                    `╰› ᯓ *SYSTEM WARNING* ˎˊ˗\n\n` +
                    `*Panduan Penggunaan :*\nBalas (reply) gambar atau kirimkan gambar secara langsung dengan takarir (caption) \`${pfx}${cmd}\`.`
                );
            }

            try {
                let baileys;
                try { baileys = await import('ourin'); } 
                catch { baileys = await import('@whiskeysockets/baileys'); }
                const { downloadContentFromMessage } = baileys;

                const stream = await downloadContentFromMessage(targetMedia, 'image');
                let chunks = [];
                for await (const chunk of stream) chunks.push(chunk);
                const mediaBuffer = Buffer.concat(chunks);

                await conn.updateProfilePicture(m.chat, mediaBuffer);

                return await m.reply(
                    `${greeting} foto profil grup berhasil diperbarui.\n\n` +
                    `╰› ᯓ *PROFILE PICTURE UPDATED* ˎˊ˗`
                );
            } catch (err) {
                return await m.reply(`Gagal memperbarui foto profil grup. Pastikan bot sudah dijadikan Admin di grup ini.`);
            }
        }

        // ==========================================
        // 4. TEMPORARY CHAT (TCHAT)
        // ==========================================
        if (['tchat', 'ephemeral'].includes(cmd)) {
            const opt = (args[0] || '').toLowerCase();
            const dur = (args[1] || '').toLowerCase();

            let seconds = null;

            if (opt === 'off' || opt === 'disable' || opt === '0') {
                seconds = 0;
            } else if (opt === 'on' || opt === 'enable') {
                if (dur === '24h' || dur === '24' || dur === '1d') seconds = 86400;
                else if (dur === '7h' || dur === '7d' || dur === '7') seconds = 604800;
                else if (dur === '90h' || dur === '90d' || dur === '90') seconds = 7776000;
                else seconds = 86400;
            } else if (opt === '24h' || opt === '24') {
                seconds = 86400;
            } else if (opt === '7h' || opt === '7d' || opt === '7') {
                seconds = 604800;
            } else if (opt === '90h' || opt === '90d' || opt === '90') {
                seconds = 7776000;
            }

            if (seconds === null) {
                return await m.reply(
                    `${greeting} tentukan pengaturan pesan sementara:\n\n` +
                    `╰› ᯓ *TEMPORARY CHAT USAGE* ˎˊ˗\n\n` +
                    `*Pilihan Perintah :*\n` +
                    `• \`${pfx}${cmd} on 24h\` : Aktifkan durasi 24 jam\n` +
                    `• \`${pfx}${cmd} on 7h\` : Aktifkan durasi 7 hari\n` +
                    `• \`${pfx}${cmd} on 90h\` : Aktifkan durasi 90 hari\n` +
                    `• \`${pfx}${cmd} off\` : Matikan pesan sementara`
                );
            }

            try {
                await conn.sendMessage(m.chat, { disappearingMessagesInChat: seconds });
                const durLabel = seconds === 0 ? 'Dimatikan' : seconds === 86400 ? '24 Jam' : seconds === 604800 ? '7 Hari' : '90 Hari';

                return await m.reply(
                    `${greeting} pengaturan pesan sementara berhasil diubah.\n\n` +
                    `╰› ᯓ *TEMPORARY CHAT UPDATED* ˎˊ˗\n\n` +
                    `• Status : ${durLabel}`
                );
            } catch (err) {
                return await m.reply(`Gagal mengatur pesan sementara. Pastikan bot sudah dijadikan Admin di grup ini.`);
            }
        }

        // ==========================================
        // 5. PERSETUJUAN ANGGOTA BARU (PENDING)
        // ==========================================
        if (['pending', 'approval'].includes(cmd)) {
            const opt = (args[0] || '').toLowerCase();

            if (opt !== 'on' && opt !== 'off') {
                return await m.reply(
                    `${greeting} tentukan status persetujuan anggota baru:\n\n` +
                    `╰› ᯓ *JOIN APPROVAL USAGE* ˎˊ˗\n\n` +
                    `*Pilihan Perintah :*\n` +
                    `• \`${pfx}${cmd} on\` : Anggota baru wajib disetujui admin\n` +
                    `• \`${pfx}${cmd} off\` : Anggota baru langsung bergabung`
                );
            }

            try {
                await conn.groupJoinApprovalMode(m.chat, opt);
                return await m.reply(
                    `${greeting} pengaturan persetujuan anggota baru berhasil diperbarui.\n\n` +
                    `╰› ᯓ *JOIN APPROVAL UPDATED* ˎˊ˗\n\n` +
                    `• Mode : ${opt === 'on' ? 'Aktif (Perlu persetujuan admin)' : 'Nonaktif (Langsung masuk)'}`
                );
            } catch (err) {
                return await m.reply(`Gagal mengubah setelan persetujuan. Pastikan bot sudah dijadikan Admin di grup ini.`);
            }
        }
    }
};