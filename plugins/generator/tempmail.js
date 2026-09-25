import axios from 'axios';
import crypto from 'crypto';
import path from 'path';
import { pathToFileURL } from 'url';

const BASE_URL = 'https://api.mail.tm';

export default {
    command: ['tempmail', 'tmail', 'checkmail', 'inboxmail', 'listmail'],
    category: 'generator',
    description: '> Generator multi email sementara dan pembaca kode OTP',
    
    run: async (m, { args, command, isOwner, isAdmin }) => {
        const sender = m.sender;
        
        // Inisialisasi struktur multi-sesi per pengguna
        global.tempMail = global.tempMail || {};
        global.tempMail[sender] = global.tempMail[sender] || { emails: {}, _last: null };

        const pfx = m.prefix || '.';
        const cmd = command.toLowerCase();

        // Pemuatan Greet Engine secara Dinamis
        let greeting = '';
        try {
            const enginePath = pathToFileURL(path.resolve(process.cwd(), 'lib/engine/greet-engine.js')).href;
            const greetMod = await import(enginePath);
            const fnGreet = greetMod.getGreeting || greetMod.default?.getGreeting || greetMod.default;
            
            if (typeof fnGreet === 'function') {
                const res = fnGreet(m, isOwner, isAdmin);
                greeting = typeof res === 'object' ? (res.text || res.greeting || `Selamat ${res.time || 'malam'} ${res.role || 'Tuan Muda'} *${m.pushName || 'User'}*`) : res;
            }
        } catch {}

        if (!greeting) {
            const hour = new Date().getHours();
            const ucapan = hour < 4 ? 'dini hari' : hour < 11 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam';
            const role = isOwner ? 'Tuan Muda' : (isAdmin ? 'Admin' : 'Kak');
            greeting = `Selamat ${ucapan} ${role} *${m.pushName || 'User'}*`;
        }

        const userSessions = global.tempMail[sender];

        // Mode Tampilkan Daftar Email Aktif
        if (cmd === 'listmail' || args[0] === 'list') {
            const list = Object.keys(userSessions.emails);
            if (list.length === 0) {
                return await m.reply(
                    `${greeting}, kamu belum memiliki email sementara yang aktif.\n\n╰› ᯓ *NO ACTIVE SESSIONS* ˎˊ˗\n\nKetik \`${pfx}tempmail\` untuk membuat alamat baru.`
                );
            }

            let textList = `${greeting}, berikut daftar email sementara aktif kamu:\n\n╰› ᯓ *ACTIVE TEMP MAIL LIST* ˎˊ˗\n\n`;
            list.forEach((addr, idx) => {
                const isLatest = addr === userSessions._last ? ' (Terbaru)' : '';
                textList += `${idx + 1}. \`${addr}\`${isLatest}\n`;
            });
            textList += `\n*Panduan Cek Pesan :*\nKetik \`${pfx}checkmail <alamat_email>\` untuk memeriksa kotak masuk email tertentu.`;

            return await m.reply(textList);
        }

        // Mode Cek Kotak Masuk (Inbox)
        if (cmd === 'checkmail' || cmd === 'inboxmail' || args[0] === 'check') {
            let targetEmail = '';
            if (cmd === 'checkmail' || cmd === 'inboxmail') {
                targetEmail = args[0]?.trim() || userSessions._last;
            } else if (args[0] === 'check') {
                targetEmail = args[1]?.trim() || userSessions._last;
            }

            if (!targetEmail || !userSessions.emails[targetEmail]) {
                return await m.reply(
                    `${greeting}, sesi email tidak ditemukan.\n\n╰› ᯓ *SESSION NOT FOUND* ˎˊ˗\n\nPastikan alamat email benar dan ada di daftar aktif kamu.\nKetik \`${pfx}listmail\` untuk melihat daftar email yang kamu miliki.`
                );
            }

            const session = userSessions.emails[targetEmail];

            try {
                const res = await axios.get(`${BASE_URL}/messages`, {
                    headers: {
                        'Authorization': `Bearer ${session.token}`,
                        'Accept': 'application/json'
                    },
                    timeout: 15000
                });

                const mails = res.data['hydra:member'] || [];

                if (mails.length === 0) {
                    return await m.reply(
                        `${greeting}, kotak masuk masih kosong.\n\n╰› ᯓ *INBOX EMPTY* ˎˊ˗\n\n*Target Email :* ${session.address}\nBelum ada pesan atau kode OTP yang masuk. Silakan tunggu beberapa saat lalu periksa kembali.`
                    );
                }

                // Ambil pesan paling terbaru
                const latestId = mails[0].id;
                const readRes = await axios.get(`${BASE_URL}/messages/${latestId}`, {
                    headers: {
                        'Authorization': `Bearer ${session.token}`,
                        'Accept': 'application/json'
                    },
                    timeout: 15000
                });

                const msg = readRes.data;
                const cleanBody = (msg.text || msg.intro || '').replace(/<[^>]*>?/gm, '').trim();

                return await m.reply(
                    `Pesan verifikasi terbaru berhasil diterima.\n\n╰› ᯓ *INBOX RECEIVED* ˎˊ˗\n\n*Target Email :* ${session.address}\n*Dari :* ${msg.from?.address || msg.from?.name || 'Tidak diketahui'}\n*Subjek :* ${msg.subject || 'Tanpa Subjek'}\n*Waktu :* ${new Date(msg.createdAt).toLocaleString('id-ID')}\n\n*Isi Pesan / OTP :*\n${cleanBody || 'Tidak ada teks konten.'}\n\nModul berjalan normal.`
                );
            } catch (err) {
                const errMsg = err.response?.data?.message || err.message || 'Peladen tidak merespons';
                return await m.reply(
                    `Gagal memeriksa kotak masuk.\n\n╰› ᯓ *FETCH ERROR* ˎˊ˗\n\n*Target Email :* ${targetEmail}\n• Pesan : ${errMsg}`
                );
            }
        }

        // Mode Reset / Hapus Seluruh Sesi
        if (args[0] === 'reset') {
            delete global.tempMail[sender];
            return await m.reply(
                `${greeting}, seluruh sesi email sementara kamu telah berhasil dibersihkan dari memori sistem.`
            );
        }

        // Mode Generate Email Baru
        try {
            const domainsRes = await axios.get(`${BASE_URL}/domains`, { timeout: 10000 });
            const domainList = domainsRes.data['hydra:member'] || [];
            
            if (domainList.length === 0) {
                throw new Error('Tidak ada domain publik yang tersedia saat ini.');
            }

            const activeDomain = domainList[0].domain;
            const username = 'usr_' + crypto.randomBytes(4).toString('hex');
            const password = crypto.randomBytes(6).toString('hex');
            const address = `${username}@${activeDomain}`;

            // Pendaftaran akun email
            await axios.post(`${BASE_URL}/accounts`, {
                address: address,
                password: password
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000
            });

            // Permintaan token otentikasi (JWT)
            const tokenRes = await axios.post(`${BASE_URL}/token`, {
                address: address,
                password: password
            }, {
                headers: { 'Content-Type': 'application/json' },
                timeout: 15000
            });

            const token = tokenRes.data.token;

            // Simpan ke daftar multi-sesi pengguna
            userSessions.emails[address] = { address, token, createdAt: Date.now() };
            userSessions._last = address;

            const totalActive = Object.keys(userSessions.emails).length;

            await m.reply(
                `Alamat email sementara baru berhasil diaktifkan.\n\n╰› ᯓ *TEMP MAIL CREATED* ˎˊ˗\n\n*Detail Akun :*\n• Email : ${address}\n• Domain : ${activeDomain}\n• Total Email Aktif : ${totalActive} alamat\n\n*Panduan Penggunaan :*\n1. Gunakan email di atas untuk mendaftar di layanan target.\n2. Cek pesan masuk email ini: \`${pfx}checkmail ${address}\`\n3. Cek pesan email terbaru secara instan: \`${pfx}checkmail\`\n4. Lihat semua daftar email: \`${pfx}listmail\``
            );
        } catch (err) {
            const errMsg = err.response?.data?.message || err.message || 'Peladen tidak merespons';
            await m.reply(
                `Gagal membuat email baru.\n\n╰› ᯓ *GENERATOR ERROR* ˎˊ˗\n\n• Pesan : ${errMsg}`
            );
        }
    }
};