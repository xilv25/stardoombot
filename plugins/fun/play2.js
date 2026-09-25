import yts from 'yt-search';
import axios from 'axios';
import { Buffer } from 'buffer';

async function getAudioDownloadUrl(videoUrl) {
  const apiSources = [
    `https://api.azbry.com/api/download/ytplay2?q=${encodeURIComponent(videoUrl)}`,
    `https://api.ryzendesu.vip/api/downloader/ytmp3?url=${encodeURIComponent(videoUrl)}`,
    `https://api.siputzx.my.id/api/d/ytmp3?url=${encodeURIComponent(videoUrl)}`
  ];
  for (const api of apiSources) {
    try {
      const res = await axios.get(api, { timeout: 8000 });
      const dlUrl = res.data?.result?.download || res.data?.url || res.data?.data?.dl;
      if (dlUrl) return dlUrl;
    } catch (e) { continue; }
  }
  return null;
}

export default {
  command: ['play2', 'music2', 'song2'],
  category: 'download',
  description: '> Mengunduh musik dari YouTube dengan informasi detail dan gaya pesan khusus',

  run: async (m, { conn, text, args }) => {
    let query = text ? text.trim() : (args ? args.join(' ').trim() : '');

    if (!query && m.quoted) {
      query = (
        m.quoted.text ||
        m.quoted.caption ||
        m.quoted.message?.conversation ||
        m.quoted.message?.extendedTextMessage?.text ||
        ''
      ).trim();
    }

    if (!query) {
      const pfx = m.prefix || '.';
      return await m.reply(`Harap masukkan judul lagu.\nContoh: \`${pfx}play2 komang\``);
    }

    try {
      const search = await yts(query);
      const video = search?.videos?.[0];

      if (!video) {
        return await m.reply('Lagu tidak ditemukan di YouTube.');
      }

      const dlUrl = await getAudioDownloadUrl(video.url);
      if (!dlUrl) {
        throw new Error('Gagal mendapatkan tautan unduhan audio dari server.');
      }

      const audioRes = await axios.get(dlUrl, { responseType: 'arraybuffer', timeout: 20000 });
      const audioBuffer = Buffer.from(audioRes.data);
      const fileSizeMB = (audioBuffer.length / (1024 * 1024)).toFixed(2);

      const pushName = m.pushName || 'User';

      const caption = `Selamat malam Tuan Muda *${pushName}*,

╰› ᯓ *INFORMASI MUSIK* ˎˊ˗

• *Judul :* ${video.title}
• *Artis / Channel :* ${video.author?.name || 'Unknown'}
• *Durasi :* ${video.timestamp || '0:00'}
• *Ukuran File :* ${fileSizeMB} MB
• *Tanggal Rilis :* ${video.ago || 'Tidak diketahui'}
• *Total Ditonton :* ${video.views ? video.views.toLocaleString() : 'Tidak diketahui'}

*Tautan YouTube :*
${video.url}`;

      // Fake Reply Handler
      const fakeReply = {
        key: { fromMe: false, participant: '13135550002@s.whatsapp.net', remoteJid: 'status@broadcast' },
        message: {
          contactMessage: {
            displayName: pushName,
            vcard: `BEGIN:VCARD\nVERSION:3.0\nN:;a,;;;\nFN:${pushName}\nitem1.TEL;waid=13135550002:13135550002\nitem1.X-ABLabel:Ponsel\nEND:VCARD`
          }
        }
      };

      // 1. Kirim pesan informasi (thumbnail + caption) dengan fakeReply, simpan objek pesannya
      let infoMsg = await conn.sendMessage(m.chat, {
        image: { url: video.thumbnail },
        caption: caption
      }, { quoted: fakeReply });

      // 2. Kirim berkas audio yang me-reply pesan informasi (infoMsg) di atas
      await conn.sendMessage(m.chat, {
        audio: audioBuffer,
        mimetype: 'audio/mpeg',
        ptt: false
      }, { quoted: infoMsg });

    } catch (err) {
      console.error('[PLAY2 ERROR]', err);
      return await m.reply(`Gagal memproses audio: ${err.message || err}`);
    }
  }
};