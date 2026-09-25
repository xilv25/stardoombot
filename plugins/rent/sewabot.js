import fs from 'fs';
import path from 'path';

// ==========================================
// 1. DATABASE & DIRECTORY SETUP
// ==========================================
const dbDir = path.resolve(process.cwd(), 'database', 'sewa');
const dbFile = path.join(dbDir, 'rentals.json');

if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });
if (!fs.existsSync(dbFile)) fs.writeFileSync(dbFile, JSON.stringify([]));

const getRentals = () => JSON.parse(fs.readFileSync(dbFile, 'utf-8'));
const saveRentals = (data) => fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));

// ==========================================
// 2. AUTO-LEAVE DAEMON (Pengecek Waktu Sewa)
// ==========================================
if (!global.sewaDaemon) {
    global.sewaDaemon = setInterval(async () => {
        const rentals = getRentals();
        const now = Date.now();
        let changed = false;

        for (let i = rentals.length - 1; i >= 0; i--) {
            if (now > rentals[i].expire) {
                try {
                    if (global.conn) {
                        await global.conn.sendMessage(rentals[i].groupId, { 
                            text: `*[-] MASA SEWA HABIS*\n\nMasa sewa grup ini telah berakhir. Terima kasih telah menggunakan layanan kami. Bot akan keluar otomatis.` 
                        });
                        await global.conn.groupLeave(rentals[i].groupId);
                    }
                } catch (e) {
                    console.log(`[SEWA DAEMON] Gagal keluar dari ${rentals[i].groupId}`);
                }
                rentals.splice(i, 1);
                changed = true;
            }
        }
        if (changed) saveRentals(rentals);
    }, 60000);
}

// ==========================================
// 3. WIZARD SESSION MANAGER (STATE MACHINE)
// ==========================================
if (!global.sewaWizard) global.sewaWizard = {};

const parseDuration = (str) => {
    const match = str.match(/^(\d+)(s|m|h|d|w|mo|y)$/i);
    if (!match) return null;
    const val = parseInt(match[1]);
    const unit = match[2].toLowerCase();
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000, mo: 2592000000, y: 31536000000 };
    return val * multipliers[unit];
};

export default {
    command: ['sewabot', 'addsewa', 'sewalist', 'leavegc'],
    category: 'management',
    description: '> Sistem Manajemen Sewa Bot & Price List',

    before: async (m, { conn }) => {
        if (!m.text || m.isBaileys) return;
        const sender = m.sender;
        const session = global.sewaWizard[sender];

        if (!session) return;

        // Cancel Command
        if (m.text.toLowerCase() === 'cancel') {
            clearTimeout(session.timeout);
            delete global.sewaWizard[sender];
            return m.reply('*[-] DIBATALKAN*\n\nTransaksi sewa bot dibatalkan.');
        }

        const text = m.text.trim();

        try {
            // STATE 1: PILIH PLAN SEWA
            if (session.state === 'AWAIT_PLAN') {
                if (text === '1' || text === '2') {
                    session.plan = text === '1' ? 'Standard' : 'Premium';
                    session.price = text === '1' ? '10.000' : '25.000';
                    session.state = 'AWAIT_PAYMENT_METHOD';
                    
                    let payMsg = `*[+] PLAN ${session.plan.toUpperCase()} TERPILIH*\n\n`;
                    payMsg += `Silakan pilih metode pembayaran:\n`;
                    payMsg += `1. Payment Gateway (Otomatis QRIS)\n`;
                    payMsg += `2. Manual (QRIS Pribadi)\n\n`;
                    payMsg += `_Ketik angka 1 atau 2, atau ketik cancel untuk membatalkan._`;
                    return m.reply(payMsg);
                } else {
                    return m.reply('*[-] INVALID*\n\nPilihan tidak valid. Ketik 1 atau 2.');
                }
            }

            // STATE 2: PILIH METODE PEMBAYARAN & RENDER QRIS
            if (session.state === 'AWAIT_PAYMENT_METHOD') {
                if (text === '1' || text === '2') {
                    session.method = text === '1' ? 'Paygate' : 'Manual';
                    session.state = 'AWAIT_PAYMENT';
                    
                    if (session.method === 'Paygate') {
                        // MOCKUP API PAYGATE
                        const qrisUrl = 'https://files.catbox.moe/k29l79.jpg';
                        
                        await conn.sendMessage(m.chat, { 
                            image: { url: qrisUrl }, 
                            caption: `*[+] PAYMENT GATEWAY*\n\nSilakan scan QRIS di atas untuk membayar Rp${session.price}.\n\n_Sesi ini akan expired dalam 5 menit. Ketik cancel untuk membatalkan._` 
                        });

                        session.timeout = setTimeout(() => {
                            if (global.sewaWizard[sender]) {
                                m.reply('*[-] TIMEOUT*\n\nWaktu pembayaran habis (Timeout 5 Menit). Transaksi dibatalkan otomatis.');
                                delete global.sewaWizard[sender];
                            }
                        }, 5 * 60 * 1000);

                        m.reply('_*(Simulasi Paygate)* Ketik lunas jika sudah pura-pura membayar_');
                        
                    } else {
                        // MANUAL QRIS
                        const qrisLocalPath = path.resolve(process.cwd(), 'src/image/qris.jpg');
                        
                        if (!fs.existsSync(qrisLocalPath)) {
                            return m.reply('*[-] SYSTEM ERROR*\n\nFile QRIS tidak ditemukan di `src/image/qris.jpg`. Harap lapor ke Owner.');
                        }

                        const qrisBuffer = fs.readFileSync(qrisLocalPath);

                        await conn.sendMessage(m.chat, { 
                            image: qrisBuffer, 
                            caption: `*[+] PAYMENT MANUAL*\n\nScan QRIS All Payment di atas.\nJika sudah bayar, kirim bukti transfer ke Owner, lalu ketik *lanjut* di sini untuk memasukkan link grup.\n\n_Ketik cancel untuk membatalkan._` 
                        });
                    }
                    return;
                } else {
                    return m.reply('*[-] INVALID*\n\nPilihan tidak valid. Ketik 1 atau 2.');
                }
            }

            // STATE 3: KONFIRMASI PEMBAYARAN
            if (session.state === 'AWAIT_PAYMENT') {
                if (text.toLowerCase() === 'lunas' || text.toLowerCase() === 'lanjut') {
                    clearTimeout(session.timeout); 
                    session.state = 'AWAIT_LINK';
                    return m.reply(`*[+] PEMBAYARAN DIKONFIRMASI*\n\nSilakan kirimkan link invite grup WhatsApp yang ingin dimasukkan bot.\nContoh: https://chat.whatsapp.com/xxx`);
                }
            }

            // STATE 4: MASUKKAN LINK GRUP
            if (session.state === 'AWAIT_LINK') {
                const linkRegex = /chat\.whatsapp\.com\/([a-zA-Z0-9]+)/i;
                if (!linkRegex.test(text)) return m.reply('*[-] INVALID LINK*\n\nItu bukan link grup WhatsApp yang valid. Coba lagi atau ketik cancel.');
                
                const inviteCode = text.match(linkRegex)[1];
                await m.reply('*[+] MEMPROSES*\n\nMenganalisis tautan dan mencoba bergabung ke dalam grup...');

                try {
                    const groupInfo = await conn.groupGetInviteInfo(inviteCode);
                    const targetJid = groupInfo.id;
                    
                    await conn.groupAcceptInvite(inviteCode);
                    
                    const durationMs = parseDuration('30d'); 
                    const rentals = getRentals();
                    rentals.push({
                        groupId: targetJid,
                        groupName: groupInfo.subject,
                        type: session.plan,
                        expire: Date.now() + durationMs,
                        addedBy: sender
                    });
                    saveRentals(rentals);

                    delete global.sewaWizard[sender];
                    
                    return m.reply(`*[+] SEWA BERHASIL*\n\nBot telah masuk ke grup *${groupInfo.subject}* dengan paket *${session.plan}*.\nMasa aktif: 30 Hari.`);
                } catch (e) {
                    return m.reply(`*[-] GAGAL MASUK*\n\nBot tidak dapat masuk. Pastikan bot tidak di-kick sebelumnya dari grup tersebut atau link telah di-reset.`);
                }
            }

        } catch (err) {
            console.error(err);
            delete global.sewaWizard[sender];
            return m.reply('*[-] SYSTEM ERROR*\n\nTerjadi kesalahan pada sistem wizard. Sesi dibatalkan.');
        }
    },

    run: async (m, { conn, command, text, args, isOwner }) => {
        const cmd = command.toLowerCase();

        // 1. SEWA BOT (Main Menu)
        if (cmd === 'sewabot') {
            if (global.sewaWizard[m.sender]) return m.reply('*[-] SESI AKTIF*\n\nKamu masih memiliki sesi transaksi yang menggantung. Selesaikan atau ketik cancel.');

            global.sewaWizard[m.sender] = { state: 'AWAIT_PLAN' };
            
            let groupSubject = 'STARDOOM';
            if (m.isGroup) {
                try {
                    const groupMetadata = await conn.groupMetadata(m.chat);
                    groupSubject = groupMetadata.subject;
                } catch (e) {}
            }
            
            let menu = `Berikut adalah list harga sewa bot by *${groupSubject}*\n\n`;
            
            menu += `*SEWABOT PRICE LIST*\n`;
            menu += ` ╰ _Price list paket rental bot bulanan_\n\n`;
            menu += `• Paket Standard (1 Bulan) : *Rp10.000*\n`;
            menu += `• Paket Premium (1 Bulan) : *Rp25.000*\n\n\n`;
            
            menu += `*PLAN FEATURES*\n`;
            menu += ` ╰ _Benefit & akses fitur masing-masing paket_\n\n`;
            menu += `• Standard : *Akses fitur grup & admin dasar*\n`;
            menu += `• Premium : *Akses ALL fitur plugin admin Enterprise*\n\n\n`;
            
            menu += `*CATATAN:*\n\n`;
            menu += `> Pilih plan terlebih dahulu, lalu bot akan memandu proses pembayaran QRIS.\n\n\n`;
            
            menu += `_Ketik *1* atau *2* untuk memilih plan. Ketik *cancel* untuk membatalkan._\n`;
            menu += `メ ©StarDoom Universe`;
            
            return m.reply(menu);
        }

        // 2. ADD SEWA MANUAL
        if (cmd === 'addsewa') {
            if (!isOwner) return m.reply('*[-] AKSES DITOLAK*\n\nPerintah ini khusus Owner.');
            if (args.length < 3) return m.reply(`*[-] FORMAT SALAH*\n\nGunakan: .addsewa <waktu> <standard/premium> <link>\nContoh: .addsewa 30d premium https://chat... `);
            
            const duration = args[0];
            const type = args[1].toLowerCase();
            const link = args[2];
            
            const durationMs = parseDuration(duration);
            if (!durationMs) return m.reply('*[-] INVALID TIME*\n\nFormat waktu tidak valid. Gunakan s/m/h/d/w/mo/y (Contoh: 1d, 30m).');
            if (type !== 'standard' && type !== 'premium') return m.reply('*[-] INVALID TYPE*\n\nTipe paket hanya boleh standard atau premium.');
            
            const linkRegex = /chat\.whatsapp\.com\/([a-zA-Z0-9]+)/i;
            if (!linkRegex.test(link)) return m.reply('*[-] INVALID LINK*\n\nTautan grup tidak valid.');

            try {
                const inviteCode = link.match(linkRegex)[1];
                const groupInfo = await conn.groupGetInviteInfo(inviteCode);
                await conn.groupAcceptInvite(inviteCode);
                
                const rentals = getRentals();
                rentals.push({
                    groupId: groupInfo.id,
                    groupName: groupInfo.subject,
                    type: type.charAt(0).toUpperCase() + type.slice(1),
                    expire: Date.now() + durationMs,
                    addedBy: 'OWNER_MANUAL'
                });
                saveRentals(rentals);
                
                return m.reply(`*[+] SEWA DITAMBAHKAN*\n\nSukses memasukkan grup *${groupInfo.subject}* ke dalam database sewa (${type}) selama ${duration}.`);
            } catch (e) {
                return m.reply(`*[-] GAGAL MASUK*\n\nGagal mengeksekusi tautan. Mungkin bot baru saja di-kick dari grup tersebut.`);
            }
        }

        // 3. SEWA LIST
        if (cmd === 'sewalist') {
            if (!isOwner) return m.reply('*[-] AKSES DITOLAK*\n\nPerintah ini khusus Owner.');
            const rentals = getRentals();
            if (rentals.length === 0) return m.reply('*[-] DATA KOSONG*\n\nTidak ada grup sewa yang aktif saat ini.');
            
            let msg = `*[+] DAFTAR SEWA AKTIF*\n\n`;
            rentals.forEach((r, i) => {
                const sisaWaktu = Math.max(0, r.expire - Date.now());
                const hari = Math.floor(sisaWaktu / 86400000);
                const jam = Math.floor((sisaWaktu % 86400000) / 3600000);
                
                msg += `*${i + 1}. ${r.groupName}*\n`;
                msg += `• Tipe : ${r.type}\n`;
                msg += `• Sisa : ${hari} Hari, ${jam} Jam\n`;
                msg += `• ID : ${r.groupId}\n\n`;
            });
            msg += `_Gunakan .leavegc <nomor> untuk mengeluarkan bot._`;
            return m.reply(msg);
        }

        // 4. LEAVE GC
        if (cmd === 'leavegc') {
            if (!isOwner) return m.reply('*[-] AKSES DITOLAK*\n\nPerintah ini khusus Owner.');
            const index = parseInt(args[0]) - 1;
            const rentals = getRentals();
            
            if (isNaN(index) || index < 0 || index >= rentals.length) {
                return m.reply(`*[-] INVALID INDEX*\n\nNomor urut tidak ditemukan. Cek .sewalist terlebih dahulu.`);
            }
            
            const target = rentals[index];
            const sisaWaktu = Math.max(0, target.expire - Date.now());
            const hari = Math.floor(sisaWaktu / 86400000);
            const jam = Math.floor((sisaWaktu % 86400000) / 3600000);
            
            try {
                await conn.sendMessage(target.groupId, { 
                    text: `*[-] PENARIKAN BOT*\n\nSisa masa sewa grup ini adalah ${hari} Hari, ${jam} Jam. Namun bot ditarik paksa oleh Owner (Pelanggaran/Pembatalan).` 
                });
                
                await conn.groupLeave(target.groupId);
                
                rentals.splice(index, 1);
                saveRentals(rentals);
                
                return m.reply(`*[+] LEAVE SUCCESS*\n\nBerhasil mengeluarkan bot dari grup *${target.groupName}* dan menghapus data sewanya.`);
            } catch (e) {
                return m.reply(`*[-] GAGAL KELUAR*\n\nBot tidak dapat keluar otomatis. Kemungkinan sudah dikeluarkan manual oleh admin grup.`);
            }
        }
    }
};