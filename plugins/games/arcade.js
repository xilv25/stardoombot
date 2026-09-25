export default {
    command: ['arcade'],
    category: 'tools',
    description: 'Membuka tautan ke Dans Arcade.',
    run: async (m, extra = {}) => {
        const conn = extra.conn || global.conn;
        
        const arcadeLink = "https://linktr.ee/dansarcade"; // Atau tautan yang sebenarnya jika ada
        
        await conn.sendMessage(m.chat, {
            text: `Selamat datang di Dans Arcade! Temukan berbagai keseruan di sini: ${arcadeLink}`
        }, { quoted: m });
    }
};