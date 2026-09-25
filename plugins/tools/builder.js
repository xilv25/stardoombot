import fs from 'fs';
import path from 'path';

const GROQ_API_KEY = "API_KEY_KALIAN";

async function callGroqAI(prompt, systemInstruction) {
    if (!GROQ_API_KEY) {
        throw new Error("Groq API Key belum terkonfigurasi.");
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GROQ_API_KEY}`
        },
        body: JSON.stringify({
            model: "llama3-8b-8192",
            messages: [
                { role: "system", content: systemInstruction },
                { role: "user", content: prompt }
            ],
            temperature: 0.2
        }),
        signal: AbortSignal.timeout(30000)
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Groq API HTTP ${res.status}: ${errText.substring(0, 100)}`);
    }

    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    if (!text || !text.trim()) throw new Error("Groq mengembalikan respons kosong.");
    return text.trim();
}

const DEON_SYSTEM_CORE = `Identitasmu MUTLAK adalah Deon, asisten pribadi sekaligus tangan kanan setia Tuan Muda.
ATURAN KETAT FRAMEWORK BAILEYS (ESM):
1. Setiap file plugin WAJIB diekspor menggunakan struktur:
export default {
    command: ['namacommand'],
    category: 'tools',
    description: 'Deskripsi',
    run: async (m, extra = {}) => {
        const conn = extra.conn || global.conn;
        const args = extra.args || [];
        // Logika kode di sini
    }
};
2. Gunakan gaya estetika pesan dengan header: \`╰› ᯓ *JUDUL* ˎˊ˗\` dan footer: \`メ ©Nameless StarDoom\`.
3. Apabila diminta menyertakan nomor telepon atau kontak owner (seperti nomor +6281380518572 dengan nama Schneider), tulis secara mutlak dan hardcode apa adanya tanpa memecah spasi atau tanda minus.
4. Bungkus kode JavaScript murni secara mutlak di dalam tag [CODE] dan [/CODE] tanpa markdown tambahan.`;

function searchPluginFile(dir, targetName) {
    if (!fs.existsSync(dir)) return null;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            const found = searchPluginFile(fullPath, targetName);
            if (found) return found;
        } else {
            const baseName = path.basename(entry.name, '.js').toLowerCase();
            if (entry.name.toLowerCase() === targetName.toLowerCase() || baseName === targetName.toLowerCase()) {
                return fullPath;
            }
        }
    }
    return null;
}

export default {
    command: ['builder', 'build', 'rebuild', 'delsc'],
    category: 'tools',
    description: 'Sistem Manajemen dan Perbaikan Plugin AI Terpadu (Groq Powered)',

    run: async (m, extra = {}) => {
        const conn = extra.conn || global.conn;
        const args = extra.args || [];
        const command = extra.command || (args[0] ? args[0].replace(/^[./#!]/, '') : '');
        const rawText = args.join(' ').trim();

        if (command === 'builder') {
            return m.reply(
                `╰› ᯓ *BUILDER SYSTEM GUIDE* ˎˊ˗\n\n` +
                `Sistem Deon AI Builder dikhususkan untuk melayani Tuan Muda dalam mengelola plugin bot:\n\n` +
                `• \`.build <lokasi> <prompt>\`\n` +
                `  Membangun plugin baru dari nol secara otomatis.\n\n` +
                `• \`.rebuild <lokasi> <koreksi>\`\n` +
                `  Memperbarui, menimpa, atau memperbaiki error kode plugin.\n\n` +
                `• \`.delsc <nama_file>\`\n` +
                `  Mencari dan menghapus file plugin secara permanen.\n\n` +
                `メ ©Nameless StarDoom`
            );
        }

        if (command === 'delsc') {
            const query = args[0];
            if (!query) return m.reply("Format salah! Gunakan: `.delsc <nama_file>` (Contoh: `.delsc owner`)");

            const pluginsDir = path.resolve(process.cwd(), 'plugins');
            const targetFile = searchPluginFile(pluginsDir, query);

            if (!targetFile || !fs.existsSync(targetFile)) {
                return m.reply(`❌ File plugin dengan kata kunci *"${query}"* tidak ditemukan di dalam direktori.`);
            }

            try {
                const relativePath = path.relative(process.cwd(), targetFile);
                fs.unlinkSync(targetFile);
                
                const senderName = m.pushName || "Tuan Muda";
                return m.reply(
                    `Selamat pagi Tuan Muda *${senderName}*, berkas tujuan berhasil dibersihkan dari penyimpanan server.\n\n` +
                    `╰› ᯓ *FILE DELETED* ˎˊ˗\n\n` +
                    `*Rincian Berkas :*\n\n` +
                    `• Lokasi : \`${relativePath}\`\n` +
                    `• Tindakan : Dihapus Permanen\n\n` +
                    `Ruang penyimpanan telah disinkronkan kembali dan berkas tidak dapat dipulihkan.\n` +
                    `メ ©Nameless StarDoom`
                );
            } catch (err) {
                return m.reply(`Gagal menghapus berkas.\nError: ${err.message}`);
            }
        }

        if (command === 'build' || command === 'rebuild') {
            const firstSpace = rawText.indexOf(' ');
            if (firstSpace === -1 || args.length < 2) {
                return m.reply(`Format salah! Gunakan: \`.${command} <lokasi_file> <instruksi>\``);
            }

            const targetPath = rawText.substring(0, firstSpace).trim();
            const promptData = rawText.substring(firstSpace + 1).trim();

            let loadingMsg = await m.reply(`*SYSTEM ${command.toUpperCase()} AKTIF*\nDeon sedang merakit kode melalui Groq (Llama3 8B)...\nMohon tunggu.`);

            try {
                const aiResponse = await callGroqAI(promptData, DEON_SYSTEM_CORE);
                const codeMatch = aiResponse.match(/\[CODE\]([\s\S]*?)\[\/CODE\]/i) || aiResponse.match(/```(?:javascript|js)?([\s\S]*?)```/i);
                
                if (!codeMatch) {
                    if (loadingMsg && loadingMsg.key) await conn.sendMessage(m.chat, { delete: loadingMsg.key });
                    return m.reply(`Gagal memproses plugin.\nLaporan: AI tidak merespons dengan format [CODE].\nRespon: ${aiResponse.substring(0, 100)}...`);
                }

                let generatedCode = codeMatch[1].trim();
                generatedCode = generatedCode.replace(/^```(?:javascript|js)?|```$/gi, '').trim();

                if (loadingMsg && loadingMsg.key) await conn.sendMessage(m.chat, { delete: loadingMsg.key });

                const fullPath = path.resolve(process.cwd(), targetPath);
                const dirName = path.dirname(fullPath);
                if (!fs.existsSync(dirName)) fs.mkdirSync(dirName, { recursive: true });
                
                fs.writeFileSync(fullPath, generatedCode);

                const actionType = command === 'rebuild' ? 'Direkonstruksi & Ditimpa' : 'Dibangun dari Nol';
                return m.reply(
                    `╰› ᯓ *${command.toUpperCase()} SUCCESS* ˎˊ˗\n\n` +
                    `Plugin berhasil ${actionType} dan aktif secara instan (Hot-Reload).\n\n` +
                    `*Rincian Berkas :*\n\n` +
                    `• Lokasi : \`${targetPath}\`\n` +
                    `• Mesin : Groq Llama3 8B\n\n` +
                    `メ ©Nameless StarDoom`
                );

            } catch (error) {
                if (loadingMsg && loadingMsg.key) await conn.sendMessage(m.chat, { delete: loadingMsg.key });
                return m.reply(`Gagal memproses plugin.\nLaporan Kesalahan: ${error.message}`);
            }
        }
    }
};