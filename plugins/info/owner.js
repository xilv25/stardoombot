export default {
    command: ['owner', 'creator', 'developer', 'developerbot'],
    category: 'info',
    description: '> Menampilkan kontak Owner / Pembuat Bot',
    
    run: async (m, { conn }) => {
        const ownerNumber = '6281380518572';
        const displayNum = '081380518572';
        const ownerName = 'Schneider';
        const orgName = 'StarDoom Universe';

        let msg = `Berikut adalah informasi kontak resmi Owner / Developer bot ini.\n\n`;
        
        msg += `*[+] INFORMASI KONTAK*\n\n`;
        
        msg += `*Developer Profile*\n\n`;
        
        msg += `• Nama : ${ownerName}\n`;
        msg += `• Nomor : ${displayNum}\n`;
        msg += `• Organisasi : ${orgName}\n`;
        msg += `• Keperluan : Sewa Bot, Lapor Bug, Partnership\n\n`;
        
        msg += `Silakan simpan dan hubungi kontak yang terlampir di bawah jika ada keperluan penting. Mohon tidak melakukan spam chat atau panggilan agar nomor Anda tidak diblokir otomatis.`;

        try {
            // 1. Menggunakan m.reply() agar fakereply & watermark otomatis terpanggil
            await m.reply(msg);

            // 2. Membangun VCard (Virtual Contact Card)
            const vcard = 'BEGIN:VCARD\n' 
                + 'VERSION:3.0\n' 
                + `FN:${ownerName}\n` 
                + `ORG:${orgName};\n` 
                + `TEL;type=CELL;type=VOICE;waid=${ownerNumber}:+${ownerNumber}\n` 
                + 'END:VCARD';

            // 3. Mengirim Kartu Kontak (Contact Message) - TANPA quoted agar tidak dobel reply
            await conn.sendMessage(m.chat, { 
                contacts: { 
                    displayName: ownerName, 
                    contacts: [{ vcard }] 
                }
            });

        } catch (err) {
            console.error('[OWNER CMD ERROR]', err);
            return m.reply('*[-] SYSTEM ERROR*\n\nGagal memuat data kontak owner.');
        }
    }
};