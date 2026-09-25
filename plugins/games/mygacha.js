import axios from 'axios';
import path from 'path';
import { pathToFileURL } from 'url';

const ANILIST_API = 'https://graphql.anilist.co';

const MANHWA_QUERY = `
query ($page: Int) {
  Page(page: $page, perPage: 1) {
    media(type: MANGA, countryOfOrigin: "KR", sort: POPULARITY_DESC) {
      title {
        romaji
        english
      }
      characters(perPage: 30) {
        nodes {
          name {
            full
            native
          }
          image {
            large
          }
          gender
        }
      }
    }
  }
}
`;

// Fungsi pencarian karakter berdasarkan gender spesifik
async function getRandomCharByGender(targetGender) {
    // Percobaan ulang hingga 6 kali jika halaman terpilih tidak memiliki gender target
    for (let attempt = 0; attempt < 6; attempt++) {
        try {
            const randomPage = Math.floor(Math.random() * 250) + 1;
            const res = await axios.post(ANILIST_API, {
                query: MANHWA_QUERY,
                variables: { page: randomPage }
            }, {
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0'
                },
                timeout: 12000
            });

            const mediaList = res.data?.data?.Page?.media || [];
            if (mediaList.length === 0) continue;

            const manhwa = mediaList[0];
            const nodes = manhwa.characters?.nodes || [];

            const filtered = nodes.filter(c => {
                if (!c.image?.large || !c.gender) return false;
                const g = c.gender.toLowerCase();
                if (targetGender === 'female') {
                    return g.includes('female') || g === 'woman';
                } else if (targetGender === 'male') {
                    return (g.includes('male') || g === 'man') && !g.includes('female');
                }
                return false;
            });

            if (filtered.length > 0) {
                const chosen = filtered[Math.floor(Math.random() * filtered.length)];
                const manhwaTitle = manhwa.title.english || manhwa.title.romaji || 'Manhwa';
                return {
                    name: chosen.name.full || 'Tanpa Nama',
                    nativeName: chosen.name.native || '',
                    gender: chosen.gender,
                    image: chosen.image.large,
                    from: manhwaTitle
                };
            }
        } catch {
            continue;
        }
    }
    return null;
}

export default {
    command: ['my', 'mybini', 'mysuami', 'bini', 'suami'],
    category: 'game',
    description: '> Gacha karakter manhwa khusus bini (female) atau suami (male)',

    run: async (m, { conn, args, command, isOwner, isAdmin }) => {
        const pfx = m.prefix || '.';
        const cmd = command.toLowerCase();
        const sub = (args[0] || '').toLowerCase();

        // Pemuatan Greet Engine Dinamis
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

        const pushName = m.pushName || 'User';
        const fakeReply = {
            key: { fromMe: false, participant: '13135550002@s.whatsapp.net', remoteJid: 'status@broadcast' },
            message: { contactMessage: { displayName: pushName, vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${pushName}\nitem1.TEL;waid=13135550002:13135550002\nitem1.X-ABLabel:Ponsel\nEND:VCARD` } }
        };

        // Penentuan kategori gacha (Bini = Female, Suami = Male)
        let targetGender = null;
        let roleName = '';

        if (cmd === 'my') {
            if (sub === 'bini' || sub === 'waifu') {
                targetGender = 'female';
                roleName = 'BINI';
            } else if (sub === 'suami' || sub === 'husbu') {
                targetGender = 'male';
                roleName = 'SUAMI';
            }
        } else if (cmd === 'mybini' || cmd === 'bini') {
            targetGender = 'female';
            roleName = 'BINI';
        } else if (cmd === 'mysuami' || cmd === 'suami') {
            targetGender = 'male';
            roleName = 'SUAMI';
        }

        if (!targetGender) {
            return await m.reply(
                `${greeting}, pilihan gacha belum ditentukan.\n\n╰› ᯓ *SYSTEM WARNING* ˎˊ˗\n\n*Format Penggunaan :*\n• \`${pfx}my bini\` : Khusus karakter perempuan\n• \`${pfx}my suami\` : Khusus karakter laki-laki\n\nSilakan tentukan target gacha kamu.`
            );
        }

        try {
            const result = await getRandomCharByGender(targetGender);

            if (!result) {
                throw new Error(`Karakter ${roleName.toLowerCase()} tidak ditemukan dalam antrean undian, silakan coba lagi.`);
            }

            const caption = `${greeting}, berikut karakter manhwa yang berhasil kamu dapatkan:\n\n` +
                `╰› ᯓ *GACHA MY ${roleName}* ˎˊ˗\n\n` +
                `• *Nama Karakter :* ${result.name}${result.nativeName ? ` (${result.nativeName})` : ''}\n` +
                `• *Asal Manhwa :* ${result.from}\n` +
                `• *Gender :* ${result.gender}\n\n` +
                `Ketik \`${pfx}my ${roleName.toLowerCase()}\` untuk mengundi kembali.`;

            // Pengiriman gambar tanpa watermark teks, menggunakan fakeReply bawaan
            await conn.sendMessage(m.chat, {
                image: { url: result.image },
                caption: caption
            }, { quoted: fakeReply });

        } catch (err) {
            await m.reply(
                `Gagal melakukan gacha karakter.\n\n╰› ᯓ *GACHA ERROR* ˎˊ˗\n\n• Pesan : ${err.message || 'Peladen AniList tidak merespons'}\n\nSilakan coba beberapa saat lagi.`
            );
        }
    }
};