export default {
    command: ['lacakip', 'iplookup', 'traceip'],
    category: 'tools',
    description: 'Melacak informasi detail dari alamat IP target',
    
    run: async (m, { text, usedPrefix, command }) => {
        const pfx = usedPrefix || '.';
        
        if (!text) {
            return m.reply(
                `[ PANDUAN PELACAKAN IP ]\n\n` +
                `Masukkan alamat IP target yang ingin dilacak.\n\n` +
                `• Format : \`${pfx}${command} <alamat_ip>\`\n` +
                `• Contoh : \`${pfx}${command} 1.1.1.1\``
            );
        }

        const targetIp = text.trim();
        await m.reply(`Memproses pelacakan alamat IP: \`${targetIp}\`...`);

        try {
            const res = await fetch(`https://api.makota.asia/api/v1/scrape/tools/iplook?ip=${targetIp}`, {
                method: "GET",
                headers: {
                    "Makota-API": "mki.eyJ1aWQiOjc5LCJ0eXBlIjoiYXBpIiwianRpIjoiZGNlYzc5ZjdkMmI3MWM5NmE5NGEzZjk4OTJiM2EzMWMiLCJpYXQiOjE3ODg3MjkwMTZ9.rD7LZleCzUAPZmFbQvOsSSzsDSsTjPPDDYzLzElomTM",
                },
            });

            if (!res.ok) {
                throw new Error(`Server API merespon dengan status: ${res.status}`);
            }

            const json = await res.json();

            if (!json.ok || !json.data) {
                return m.reply(`[ GAGAL MELACAK ]\nSistem tidak dapat menemukan informasi untuk IP \`${targetIp}\`. Pastikan format IP valid.`);
            }

            const { 
                ip, isp, asNumber, isoCode, region, 
                state, city, postalCode, organization, lat, lon 
            } = json.data;

            const mapLink = `https://www.google.com/maps?q=${lat},${lon}`;

            let output = `╰› ᯓ *HASIL PELACAKAN IP* ˎˊ˗\n\n`;
            output += `• *IP Address* : ${ip || '-'}\n`;
            output += `• *ISP* : ${isp || '-'}\n`;
            output += `• *Organisasi* : ${organization || '-'}\n`;
            output += `• *AS Number* : ${asNumber || '-'}\n\n`;
            output += `*Detail Lokasi :*\n`;
            output += `• *Negara* : ${region || '-'} (${isoCode || '-'}) \n`;
            output += `• *Provinsi* : ${state || '-'}\n`;
            output += `• *Kota* : ${city || '-'}\n`;
            output += `• *Kode Pos* : ${postalCode || '-'}\n`;
            output += `• *Koordinat* : ${lat || '-'}, ${lon || '-'}\n\n`;
            output += `📍 *Google Maps* : \n${mapLink}`;

            return m.reply(output);

        } catch (error) {
            console.error('[Lacak IP Error]:', error);
            return m.reply(`[ KESALAHAN SISTEM ]\nGagal terhubung ke penyedia layanan pelacakan: ${error.message}`);
        }
    }
};