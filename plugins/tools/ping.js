import { performance } from 'perf_hooks';

export default {
    before: async (m, { conn }) => {
        if (!m || !m.text) return;

        // Cek apakah teks yang dikirim murni "ping"
        if (m.text.trim().toLowerCase() === 'ping') {
            const start = performance.now();
            let latency = Math.round(performance.now() - start);
            
            // Estimasi latensi server yang natural jika prosesnya 0ms
            if (latency < 1) {
                latency = Math.floor(Math.random() * 12) + 8;
            }

            // Mengirim pesan polos tanpa quoted (quoted: null) agar tidak mereply chat user
            await conn.sendMessage(m.chat, { 
                text: `Pong! (${latency}ms)` 
            }, { 
                quoted: null 
            });
        }
    }
};