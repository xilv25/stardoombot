import fs from 'fs';
import path from 'path';

// Fungsi Bantuan Database Store Eksternal
const storeDbDir = path.resolve(process.cwd(), 'database', 'storegame');
if (!fs.existsSync(storeDbDir)) fs.mkdirSync(storeDbDir, { recursive: true });

function getStoreDb(chatId) {
    const dbFile = path.join(storeDbDir, `${chatId}.json`);
    if (fs.existsSync(dbFile)) {
        try { return JSON.parse(fs.readFileSync(dbFile, 'utf-8')); } catch (e) { return { rates: {}, products: {} }; }
    }
    return { rates: {}, products: {} };
}

function saveStoreDb(chatId, data) {
    const dbFile = path.join(storeDbDir, `${chatId}.json`);
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

export default {
    command: ['storeopen', 'addproduk', 'updateproduk', 'delproduk', 'produklist', 'list', 'setrate'],
    category: 'store',
    description: 'Manajemen Store Top-Up, Multi-Kategori Rate & Welcome Gate',

    // Memantau pesan untuk merender output produk
    before: async (m, { conn, isGroup }) => {
        if (!isGroup) return false;

        let body = (m.text || '').trim().toLowerCase();
        if (!body) return false;

        let storeDb = getStoreDb(m.chat);
        if (!storeDb.products || !storeDb.products[body]) return false;

        let prod = storeDb.products[body];
        let currentRate = storeDb.rates[prod.category] || 15000; // Default 15.000 jika rate kategori belum diset

        // Kalkulasi Harga Berdasarkan Kategori
        let responseText = prod.content.replace(/\+rate([0-9]+(?:\.[0-9]+)?)/gi, (match, num) => {
            let value = parseFloat(num);
            let total = value * currentRate;
            return `*Rp${total.toLocaleString('id-ID')}*`; 
        });

        await m.reply(responseText);
        return true; 
    },

    run: async (m, { conn, text, command, usedPrefix, isGroup, isAdmin }) => {
        if (!isGroup) return m.reply('*[!] Akses Ditolak*\n\nFitur store hanya dapat digunakan di dalam grup.');

        const cmd = command.toLowerCase();
        const pfx = usedPrefix || '.';

        let storeDb = getStoreDb(m.chat);
        if (!storeDb.rates) storeDb.rates = {};
        if (!storeDb.products) storeDb.products = {};

        const groupMeta = await conn.groupMetadata(m.chat).catch(() => ({ subject: 'Store Kami' }));
        const groupName = groupMeta.subject;

        const now = new Date();
        const optionsDate = { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        const dateStr = now.toLocaleDateString('id-ID', optionsDate);
        const timeStr = now.toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' }).replace(/\./g, ':') + ' WIB';

        try {
            // 1. STORE GATE (ON/OFF)
            if (cmd === 'storeopen') {
                if (!isAdmin) return m.reply('*[!] Akses Ditolak*\n\nHanya Admin Grup yang dapat menggunakan perintah ini.');
                let state = (text || '').toLowerCase();

                const dbPath = path.resolve(process.cwd(), 'database', 'groups.json');
                let groupDb = {};
                if (fs.existsSync(dbPath)) {
                    try { groupDb = JSON.parse(fs.readFileSync(dbPath, 'utf-8')); } catch (e) {}
                }
                if (!groupDb[m.chat]) groupDb[m.chat] = {};
                if (!groupDb[m.chat].welcome) groupDb[m.chat].welcome = { status: false, msg: '', image: '' };
                
                if (state === 'on') {
                    const welcomeText = `Halo +user, Selamat datang di *+group*\n\n• Ketik \`${pfx}list\`\n      ╰ Untuk melihat daftar produk kami.\n\n• Ketik \`${pfx}produklist\`\n       ╰ Untuk melihat daftar produk yang menggunakan rate seperti top-up game dll.\n\n*[!] Catatan :*\n\n_Harap menghubungi admin jika terdapat kendala dan memastikan untuk menanyakan stok produk yang kamu pilih._\nメ ©StarDoom Universe`;

                    groupDb[m.chat].welcome.status = true;
                    groupDb[m.chat].welcome.msg = welcomeText;
                    groupDb[m.chat].welcome.image = './src/image/welcomer.mp4';
                    
                    fs.writeFileSync(dbPath, JSON.stringify(groupDb, null, 2));

                    return m.reply('*[+] Store Gate Aktif*\n\nKonfigurasi pangkalan data grup telah diperbarui. Mesin otomatis akan mengirimkan kartu sambutan beserta video setiap kali ada anggota baru yang masuk.');
                } else if (state === 'off') {
                    groupDb[m.chat].welcome.status = false;
                    fs.writeFileSync(dbPath, JSON.stringify(groupDb, null, 2));
                    return m.reply('*[-] Store Gate Dinonaktifkan*\n\nSistem welcome otomatis telah dimatikan.');
                } else {
                    return m.reply(`*[?] Format Tidak Valid*\n\nGunakan format:\n\`${pfx}storeopen on\` (Aktifkan fitur)\n\`${pfx}storeopen off\` (Matikan fitur)`);
                }
            }

            // 2. SET RATE MULTI-KATEGORI
            if (cmd === 'setrate') {
                if (!isAdmin) return m.reply('*[!] Akses Ditolak*\n\nHanya Admin yang dapat mengubah rate.');
                
                let parts = text.trim().split(/\s+/);
                if (parts.length < 2) return m.reply(`*[?] Format Tidak Valid*\n\nContoh penggunaan:\n\`${pfx}setrate 15.000 k1\`\n\`${pfx}setrate 13000 k2\``);
                
                let category = parts.pop().toLowerCase(); 
                let num = parseInt(parts.join('').replace(/[^0-9]/g, ''));
                
                if (isNaN(num) || num <= 0) return m.reply('*[!] Nilai Tidak Valid*\n\nMasukkan angka rate yang valid.');
                
                storeDb.rates[category] = num;
                saveStoreDb(m.chat, storeDb);
                
                return m.reply(`*[+] Rate Kategori Diperbarui*\n\nBerhasil mengubah patokan rate untuk kategori *${category.toUpperCase()}* ke *Rp${num.toLocaleString('id-ID')}*.`);
            }

            // 3. TAMBAH PRODUK (DENGAN KATEGORI)
            if (cmd === 'addproduk') {
                if (!isAdmin) return m.reply('*[!] Akses Ditolak*\n\nHanya Admin yang dapat menambah produk.');
                if (!text.includes('|') || text.split('|').length < 3) return m.reply(`*[?] Format Tidak Valid*\n\nTambahkan kategori di tengah!\nContoh untuk game rate:\n\`${pfx}addproduk ml | k1 | Harga 60 DM = +rate5\`\n\nContoh untuk produk reguler:\n\`${pfx}addproduk netflix | reguler | Akun 1 Bulan Rp25.000\``);
                
                let [nama, kategori, ...isiArr] = text.split('|');
                let key = nama.trim().toLowerCase();
                let cat = kategori.trim().toLowerCase();
                let isi = isiArr.join('|').trim();
                
                if (!key || !cat || !isi) return m.reply('*[!] Data Kosong*\n\nNama produk, kategori, atau isi pesan tidak boleh kosong.');
                
                storeDb.products[key] = { category: cat, content: isi };
                saveStoreDb(m.chat, storeDb);
                
                return m.reply(`*[+] Produk Ditambahkan*\n\nBerhasil menambahkan produk *${key}* ke dalam kategori *${cat.toUpperCase()}*.`);
            }

            // 4. UPDATE PRODUK
            if (cmd === 'updateproduk') {
                if (!isAdmin) return m.reply('*[!] Akses Ditolak*\n\nHanya Admin yang dapat memperbarui produk.');
                if (!text.includes('|') || text.split('|').length < 3) return m.reply(`*[?] Format Tidak Valid*\n\nContoh:\n\`${pfx}updateproduk ml | k1 | Harga 60 DM = +rate5.5\``);
                
                let [nama, kategori, ...isiArr] = text.split('|');
                let key = nama.trim().toLowerCase();
                let cat = kategori.trim().toLowerCase();
                let isi = isiArr.join('|').trim();
                
                if (!storeDb.products[key]) return m.reply(`*[!] Tidak Ditemukan*\n\nProduk *${key}* tidak ditemukan di dalam database.`);
                
                storeDb.products[key] = { category: cat, content: isi };
                saveStoreDb(m.chat, storeDb);
                
                return m.reply(`*[+] Produk Diperbarui*\n\nBerhasil memperbarui produk *${key}* (Kategori: ${cat.toUpperCase()}).`);
            }

            // 5. HAPUS PRODUK
            if (cmd === 'delproduk') {
                if (!isAdmin) return m.reply('*[!] Akses Ditolak*\n\nHanya Admin yang dapat menghapus produk.');
                let key = text.trim().toLowerCase();
                
                if (!storeDb.products[key]) return m.reply(`*[!] Tidak Ditemukan*\n\nProduk *${key}* tidak ditemukan.`);
                
                delete storeDb.products[key];
                saveStoreDb(m.chat, storeDb);
                
                return m.reply(`*[-] Produk Dihapus*\n\nBerhasil menghapus produk: *${key}*`);
            }

            // 6. DAFTAR PRODUK REGULER
            if (cmd === 'list') {
                let keys = Object.keys(storeDb.products).filter(k => storeDb.products[k].category === 'reguler' || !storeDb.products[k].content.includes('+rate'));
                
                if (keys.length === 0) return m.reply(`*[!] Kosong*\n\nBelum ada produk reguler yang terdaftar di store ini.`);

                let output = `Halo @${m.sender.split('@')[0]}, berikut daftar informasi di *${groupName}*\n\n`;
                output += `• Tanggal : ${dateStr}\n`;
                output += `• Waktu : ${timeStr}\n\n`;
                output += `╰› ᯓ *DAFTAR PRODUK REGULER* ˎˊ˗\n\n`;
                
                keys.forEach((k) => { output += `• *${k}*\n`; });
                output += `\nKetik langsung kata kunci di atas untuk melihat detailnya.`;
                
                return m.reply(output, m.chat, { mentions: [m.sender] });
            }

            // 7. DAFTAR PRODUK TOP-UP (DIKELOMPOKKAN BERDASARKAN KATEGORI)
            if (cmd === 'produklist') {
                let rateProducts = Object.keys(storeDb.products).filter(k => storeDb.products[k].category !== 'reguler' && storeDb.products[k].content.includes('+rate'));
                
                if (rateProducts.length === 0) return m.reply(`*[!] Kosong*\n\nBelum ada produk top-up yang terdaftar di store ini.`);

                // Mengelompokkan berdasarkan kategori
                let grouped = {};
                rateProducts.forEach(k => {
                    let cat = storeDb.products[k].category;
                    if (!grouped[cat]) grouped[cat] = [];
                    grouped[cat].push(k);
                });

                let output = `Halo @${m.sender.split('@')[0]}, berikut daftar informasi di *${groupName}*\n\n`;
                output += `• Tanggal : ${dateStr}\n`;
                output += `• Waktu : ${timeStr}\n\n`;
                output += `╰› ᯓ *DAFTAR PRODUK TOP-UP* ˎˊ˗\n\n`;

                for (let cat in grouped) {
                    let currentRate = storeDb.rates[cat] || 15000;
                    output += `*KATEGORI : ${cat.toUpperCase()}* (Rate: Rp${currentRate.toLocaleString('id-ID')})\n`;
                    grouped[cat].forEach(k => {
                        output += `• *${k}*\n`;
                    });
                    output += `\n`;
                }

                output += `Ketik langsung kata kunci di atas untuk melihat detailnya.`;
                return m.reply(output, m.chat, { mentions: [m.sender] });
            }

        } catch (error) {
            console.error('[Store Plugin Error]:', error);
            return m.reply(`*[!] Kesalahan Sistem*\n\nTerjadi kesalahan pada sistem Store: ${error.message}`);
        }
    }
};