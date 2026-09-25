import axios from 'axios';
import path from 'path';
import { pathToFileURL } from 'url';

const BASE_URL = 'https://am.yappi.my.id';
const VERIFY_API = `${BASE_URL}/api/verify`;

export default {
    command: ['amverif', 'verifam'],
    category: 'generator',
    description: '> Verifikasi link alight motion premium',
    owner: true, 
    
    run: async (m, { args, isOwner, isAdmin }) => {
        const sender = m.sender;
        global.premData = global.premData || {};

        let magicLink = args.join(' ').trim();
        if (!magicLink && m.quoted) {
            magicLink = m.quoted.text || m.quoted.caption || m.quoted.raw?.message?.conversation || m.quoted.raw?.message?.extendedTextMessage?.text || '';
        }

        const pfx = m.prefix || '.';
        const cmd = m.command || 'amverif';

        // Pemuatan Greet Engine secara Dinamis berbasis Root Proyek
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

        // Mekanisme Cadangan (Fallback) jika Engine Gagal Dimuat
        if (!greeting) {
            const hour = new Date().getHours();
            const ucapan = hour < 4 ? 'dini hari' : hour < 11 ? 'pagi' : hour < 15 ? 'siang' : hour < 18 ? 'sore' : 'malam';
            const role = isOwner ? 'Tuan Muda' : (isAdmin ? 'Admin' : 'Kak');
            greeting = `Selamat ${ucapan} ${role} *${m.pushName || 'User'}*`;
        }

        if (!magicLink) {
            return await m.reply(
                `${greeting}, parameter link tidak ditemukan.\n\n╰› ᯓ *SYSTEM WARNING* ˎˊ˗\n\n*Panduan Penggunaan :*\nKirimkan link verifikasi yang telah disalin dari email kamu.\n\nContoh : \`${pfx}${cmd} https://alight-creative.firebaseapp.com/...\``
            );
        }
        
        const storedData = global.premData[sender];
        if (!storedData || !storedData.email) {
            return await m.reply(
                `${greeting}, sesi email kamu tidak ditemukan di dalam memori server.\n\n╰› ᯓ *SESSION NOT FOUND* ˎˊ˗\n\nSilakan gunakan perintah \`.amprem <email_kamu>\` terlebih dahulu untuk memulai sesi injeksi baru.`
            );
        }
        
        if (!storedData.cookie) {
            return await m.reply(
                `${greeting}, session cookie kamu telah expired atau hilang.\n\n╰› ᯓ *SESSION EXPIRED* ˎˊ˗\n\nSilakan ulangi proses dari awal menggunakan perintah \`.amprem <email_kamu>\`.`
            );
        }

        const { email, cookie } = storedData;
        
        await m.reply(
            `${greeting}, validasi link sedang diproses.\n\n╰› ᯓ *SYSTEM VERIFICATION* ˎˊ˗\n\n*Detail Status :*\n• Target Email : ${email}\n• Status : Mengonfirmasi data otorisasi...\n\nMohon tunggu sebentar selagi sistem memverifikasi data.`
        );
        
        try {
            const verifyRes = await axios.post(VERIFY_API, {
                email: email,
                link: magicLink,
                cookie: cookie
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Origin': BASE_URL,
                    'Referer': `${BASE_URL}/`,
                    'User-Agent': 'Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
                },
                timeout: 30000
            });

            if (!verifyRes.data?.ok) {
                throw new Error(verifyRes.data?.error || 'Link sudah expired, tidak valid, atau sudah digunakan.');
            }
            
            global.premData[sender].status = 'active';
            global.premData[sender].magicLink = magicLink;
            
            await m.reply(
                `Injeksi otorisasi telah berhasil diselesaikan.\n\n╰› ᯓ *PREMIUM ACTIVATED* ˎˊ˗\n\n*Informasi Akun :*\n• Email : ${email}\n• Status : Premium Aktif\n\nAkses premium telah terpasang. Sesuai dengan keamanan server, silakan minta link login yang baru langsung dari aplikasi menggunakan email tersebut untuk masuk dengan aman.\n\nModul berjalan tanpa hambatan.`
            );

        } catch (err) {
            const msgError = err.response?.data?.error || err.message || 'Unknown error';
            await m.reply(
                `Terjadi kendala pada saat memverifikasi link.\n\n╰› ᯓ *SYSTEM ERROR* ˎˊ˗\n\n*Detail Kendala :*\n• Pesan : ${msgError}\n\nPastikan link disalin secara utuh atau ulangi proses pengiriman email.`
            );
        }
    }
};