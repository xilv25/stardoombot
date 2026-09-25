import axios from 'axios'

export default {
  command: ['pinterest', 'pin', 'pint'],
  category: 'search',
  description: `> Mencari gambar di pinterest. gambar dikirim dalam bentuk album.

*Keterangan Format:*
> \`<query>\` = kata kunci pencarian.

contoh penggunaan:
> \`.pin <query>\`
> \`.pin furina genshin\``,
  help: '<query>',
  typing: true,

  async run(m, { conn, args, usedPrefix, command }) {
    const query = args.join(' ').trim()

    if (!query) {
      return m.reply(`Masukkan query pencarian!\nContoh: ${usedPrefix || '.'}${command || 'pin'} furina`)
    }

    try {
      const res = await axios.get('https://wolep.dev/pinterest-search-lite', {
        params: { query },
        timeout: 30000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'application/json'
        }
      })

      const urls = res.data?.data
      if (!Array.isArray(urls) || !urls.length) {
        return m.reply('Tidak ada hasil ditemukan.')
      }

      // Membatasi hasil maksimal 5 gambar
      const images = urls.slice(0, 5)
      
      // Mengirim gambar satu per satu tanpa me-reply pesan pengguna
      for (const url of images) {
        await conn.sendMessage(m.chat, { image: { url: url } })
      }
      
    } catch (err) {
      return m.reply(`Gagal mencari gambar: ${err.response?.status || ''} ${err.message}`)
    }
  }
}